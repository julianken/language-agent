"""The /v1/verify gate: TEXT-IN, TOKENS-OUT (shared spec, ADR §3.3).

Segmentation, banding, and annotation minting all happen INSIDE the gate —
token boundaries are an OUTPUT of verification, not an input. Two
deterministic legs only (issue #7 walking-skeleton scope; the diverse-LLM
refutation jury and the 2nd diacritizer are named follow-ups):

  leg 1 `dediac-roundtrip`  — rule-based structural round-trip (dediac_leg).
  leg 2 `camel-morph`       — calima-msa-r13 analyzer membership: analyze
                              the bare skeleton, require the emitted
                              vocalized form among the returned analyses.

Banding (deterministic mapping of docs/research/arabic-validation.md §6):

  GREEN  — every deterministic check passes: leg 1 ok AND the emitted form
           is exactly (NFC) one of the analyzer's legal vocalizations.
  YELLOW — degraded confidence: the emitted form matches an analysis on the
           CORE word but its word-final vocalization (the case-ending slot,
           which §6 says to treat separately — "ignore case endings …
           beginners don't need them yet") is not among the analyzer's
           forms. Surfaced; the engine pins scaffolds / suppresses the fade.
  RED    — any deterministic check fails: leg-1 corruption, NO_ANALYSIS
           (empty analysis set — never a silent pass), a vocalization the
           analyzer does not license at all (the wrong-vowel case), or an
           OUT-OF-WORLD token (below).

Out-of-world rule (fail closed; PR #29 review finding): the hot path's
contract sends pure verified-Arabic targetText — a word-kind token whose
skeleton carries no Arabic-script codepoints (e.g. a space/NBSP-separated
Latin word) is out-of-world by construction and bands RED. Two belts
enforce it: (1) the script check itself, before the analyzer is consulted;
(2) the analyzer's passthrough-class analyses (pos foreign/punc/digit,
whose `diac` merely echoes the input verbatim) never constitute
membership in the exact/core-match filters, so the trivial echo cannot
turn a match even if a script check were bypassed.

Turn intents: the request carries the TURN's communicative intents, not a
per-token intended lemma. The gate therefore uses intent–gloss alignment to
SELECT the analysis reported in the annotations payload and to record
alignment in the leg-2 evidence detail; the research's stricter
"intended-gloss → different diac ⇒ reject" needs per-token intent binding,
which arrives with #9's hot path (it knows the intended lemma per word
before calling the gate).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from camel_tools.tokenizers.word import simple_word_tokenize
from camel_tools.utils.charsets import AR_DIAC_CHARSET, AR_LETTERS_CHARSET

from app.contractmeta import ANNOTATION_SCHEMA_ID, LANGUAGE, LEG_DEDIAC, LEG_MORPH
from app.dediac_leg import dediac_roundtrip
from app.morph_leg import MorphAnalyzer
from generated.models import (
    AnnotationEnvelope,
    Band,
    LegEvidence,
    TokenSpine,
    TurnIntent,
    VerifiedToken,
    VerifyResponse,
)

_DIAC_CHARS = "".join(AR_DIAC_CHARSET)
_WORD_SPLIT_RE = re.compile(r"[^a-zA-Zء-ي]+")

# The analyzer's PASSTHROUGH classes: for non-lexicon input shapes (Latin
# words, digit runs, punctuation) camel-tools' Analyzer emits a single
# synthetic analysis whose `diac` echoes the input verbatim, with pos
# foreign/punc/digit — even under backoff NONE. Such an echo must NEVER
# constitute gate membership: a space-separated Latin token banded GREEN
# through exactly this hole (PR #29 review, belt 2 of the fix).
_PASSTHROUGH_POS = frozenset({"foreign", "punc", "digit"})


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _classify(token: str) -> str:
    """Pack-declared token kinds: word | num | punct (opaque to the engine)."""
    if any(c in AR_LETTERS_CHARSET or c in AR_DIAC_CHARSET for c in token):
        return "word"
    if all(c.isdigit() for c in token):
        return "num"
    if any(c.isalpha() for c in token):
        # Foreign-script token — the gate must judge it, not skip it: the
        # word path's out-of-world rule (belt 1 in _verify_word) bands it RED.
        return "word"
    return "punct"


def _core(form: str) -> str:
    """Strip the word-final diacritic cluster (the case-ending slot)."""
    return form.rstrip(_DIAC_CHARS)


def _intent_words(intents: list[TurnIntent]) -> frozenset[str]:
    words: set[str] = set()
    for intent in intents:
        words.update(w for w in _WORD_SPLIT_RE.split(intent.description.lower()) if w)
    return frozenset(words)


def _gloss_words(analysis: dict) -> frozenset[str]:
    gloss = str(analysis.get("gloss") or "")
    return frozenset(w for w in _WORD_SPLIT_RE.split(gloss.lower()) if w)


def _str_or(value: Any, fallback: str) -> str:
    s = str(value) if value is not None else ""
    return s if s else fallback


def _morphology_payload(analysis: dict | None, skeleton: str, surface: str, kind: str) -> dict[str, Any]:
    """The ar-annotations/v1 `morphology` object (all fields required,
    minLength 1 — see src/packages/lang-ar/ar-annotations.schema.json).

    For tokens with no analyzer-backed analysis the fields carry honest
    sentinels: non-lexical tokens (punct/num) use the surface form with
    their CAMeL-convention pos; unanalyzable word tokens use `unknown`.
    """
    if analysis is not None:
        payload: dict[str, Any] = {
            "lemma": _str_or(analysis.get("lex"), skeleton or surface),
            "root": _str_or(analysis.get("root"), "unknown"),
            "pattern": _str_or(analysis.get("pattern"), "unknown"),
            "pos": _str_or(analysis.get("pos"), "unknown"),
            "gloss": _str_or(analysis.get("gloss"), "unknown"),
        }
        caphi = str(analysis.get("caphi") or "")
        if caphi:
            payload["caphi"] = caphi
        return payload
    if kind in ("punct", "num"):
        return {
            "lemma": surface,
            "root": surface,
            "pattern": surface,
            "pos": "punc" if kind == "punct" else "digit",
            "gloss": surface,
        }
    return {
        "lemma": skeleton or surface,
        "root": "unknown",
        "pattern": "unknown",
        "pos": "unknown",
        "gloss": "unknown",
    }


def _evidence(leg_id: str, ok: bool, detail: str | None = None) -> LegEvidence:
    return LegEvidence(**{"legId": leg_id, "pass": ok, "detail": detail})


def _vowel_state(candidate: str, exact_match: bool) -> str:
    """ar-annotations/v1 vowelState for the emitted form: `full` when the
    analyzer licensed exactly this vocalization (the canonical full form),
    `none` when the token carries no marks at all, `partial` otherwise.
    The engine applies the mastery-driven fade downstream — the gate always
    reports the pre-fade state of the form it verified."""
    if exact_match:
        return "full"
    if not any(c in AR_DIAC_CHARSET for c in candidate):
        return "none"
    return "partial"


def _verify_word(
    candidate: str,
    skeleton_hint: str,
    intent_words: frozenset[str],
    analyzer: MorphAnalyzer,
) -> tuple[Band, list[LegEvidence], dict | None, bool]:
    """Run both legs on one word token.

    Returns (band, evidence, chosen_analysis, exact_match).
    """
    leg1 = dediac_roundtrip(candidate)
    evidence = [_evidence(LEG_DEDIAC, leg1.ok, leg1.detail)]
    skeleton = leg1.skeleton or skeleton_hint

    # Empty skeleton (a diacritics-only token): leg 1 already failed with
    # the accurate reason — leg 2 just states there is nothing to analyze
    # rather than mislabeling the token "out-of-world" (PR #29 round-2
    # review suggestion: evidence-string honesty; band is RED either way).
    if not skeleton:
        evidence.append(
            _evidence(LEG_MORPH, False, "no skeleton to analyze (the dediac-roundtrip evidence carries the reason)")
        )
        return Band.RED, evidence, None, False

    # Belt 1 — the out-of-world rule (fail closed): the hot path sends pure
    # verified-Arabic targetText, so a word-kind token with no
    # Arabic-script codepoints in its (non-empty) skeleton (a
    # space/NBSP-separated Latin word, presentation-form junk, …) is
    # out-of-world by construction. Band RED before the analyzer is even
    # consulted — its foreign-passthrough echo must never get the chance
    # to "match".
    if not any(c in AR_LETTERS_CHARSET for c in skeleton):
        evidence.append(
            _evidence(
                LEG_MORPH,
                False,
                "out-of-world token: skeleton carries no Arabic-script letters "
                "(the hot path sends verified-Arabic targetText only)",
            )
        )
        return Band.RED, evidence, None, False

    try:
        analyses = analyzer.analyze(skeleton)
    except Exception as exc:  # fail CLOSED: an analyzer error is a RED band, never a 500
        evidence.append(_evidence(LEG_MORPH, False, f"analyzer error: {type(exc).__name__}"))
        return Band.RED, evidence, None, False

    # Belt 2 — membership comes from LEXICAL analyses only: passthrough
    # classes (pos foreign/punc/digit) echo the input as `diac` verbatim
    # and would trivially satisfy the filters below.
    lexical = [a for a in analyses if str(a.get("pos") or "") not in _PASSTHROUGH_POS]
    if not lexical:
        detail = (
            f"NO_ANALYSIS: analyzer returned only passthrough-class analyses for skeleton '{skeleton}' "
            "(an input echo never constitutes membership)"
            if analyses
            else f"NO_ANALYSIS: analyzer returned no analyses for skeleton '{skeleton}'"
        )
        evidence.append(_evidence(LEG_MORPH, False, detail))
        return Band.RED, evidence, None, False

    exact = [a for a in lexical if _nfc(str(a.get("diac") or "")) == candidate]
    core = [a for a in lexical if _core(_nfc(str(a.get("diac") or ""))) == _core(candidate)]
    aligned = [a for a in lexical if _gloss_words(a) & intent_words]

    def _choose(pool: list[dict]) -> dict:
        for a in pool:
            if a in aligned:
                return a
        return pool[0]

    if exact:
        chosen = _choose(exact)
        alignment = (
            f"intent-gloss aligned: {sorted(_gloss_words(chosen) & intent_words)}"
            if chosen in aligned
            else "turn-intent gloss alignment unconfirmed (per-token intent binding is #9's hot path)"
        )
        evidence.append(_evidence(LEG_MORPH, True, f"emitted vocalization is a legal analysis of '{skeleton}'; {alignment}"))
        band = Band.GREEN if leg1.ok else Band.RED
        return band, evidence, chosen, True

    if core:
        chosen = _choose(core)
        evidence.append(
            _evidence(
                LEG_MORPH,
                True,
                "core-word match only: word-final (case-ending) vocalization is not among the "
                f"analyzer's forms for '{skeleton}' — degraded confidence",
            )
        )
        band = Band.YELLOW if leg1.ok else Band.RED
        return band, evidence, chosen, False

    chosen = aligned[0] if aligned else None
    evidence.append(
        _evidence(
            LEG_MORPH,
            False,
            f"emitted vocalization is not among the analyzer's legal forms for skeleton '{skeleton}' (wrong-vowel)",
        )
    )
    return Band.RED, evidence, chosen, False


def verify_text(target_text: str, intents: list[TurnIntent], analyzer: MorphAnalyzer) -> VerifyResponse:
    """The gate. NFC-normalizes once, segments, runs both legs per token."""
    text = _nfc(target_text)
    intent_words = _intent_words(intents)

    tokens: list[VerifiedToken] = []
    for i, raw in enumerate(simple_word_tokenize(text)):
        kind = _classify(raw)
        skeleton = "".join(c for c in raw if c not in AR_DIAC_CHARSET)

        if kind == "word":
            band, evidence, chosen, exact_match = _verify_word(raw, skeleton, intent_words, analyzer)
            vowel_state = _vowel_state(raw, exact_match)
            payload = _morphology_payload(chosen, skeleton, raw, kind)
        else:
            # Non-lexical token: nothing vocalizable to verify. Leg 1 still
            # runs (it catches stray marks); leg 2 is honestly absent from
            # the evidence rather than reported as a fake pass.
            leg1 = dediac_roundtrip(raw)
            evidence = [_evidence(LEG_DEDIAC, leg1.ok, leg1.detail)]
            band = Band.GREEN if leg1.ok else Band.RED
            vowel_state = "none"
            payload = _morphology_payload(None, skeleton, raw, kind)

        annotations_payload = {
            "diac": raw,
            "skeleton": skeleton if skeleton else raw,
            "vowelState": vowel_state,
            "morphology": payload,
        }

        spine = TokenSpine(
            id=f"t{i + 1}",
            lang=LANGUAGE,
            surface=raw,
            kind=kind,
            status="new",  # v0: gates mint a pack-chosen initial status (contract spine.ts)
            band=band,
            # spanGroup deliberately absent: v0 MSA segmentation mints no
            # discontinuous learnable units (the field exists for packs that
            # do — e.g. zh separable verbs).
        )
        tokens.append(
            VerifiedToken(
                spine=spine,
                band=band,
                evidence=evidence,
                annotations=AnnotationEnvelope(lang=LANGUAGE, schemaId=ANNOTATION_SCHEMA_ID, payload=annotations_payload),
            )
        )

    return VerifyResponse(tokens=tokens)
