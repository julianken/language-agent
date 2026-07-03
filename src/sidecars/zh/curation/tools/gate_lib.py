"""Shared library for the zh offline curation gate (issue #20).

Loads the committed assets + curation sources, derives the EXPECTED per-
character base/surface readings for every corpus sentence and C9 carrier,
and defines the documented reading-agreement classes the legs record.

Agreement classes (every non-exact agreement is RECORDED per item, never
silent — the gold-pass sheets carry each variant-note item as a targeted
adjudication question for the native checkers):

  exact            — tool output == pinned reading (tone3 normalization).
  singles-surface  — for a C3 single, the tool emitted the entry's pinned
                     SURFACE rather than its base (sandhi-aware tools such as
                     g2pW/pypinyin emit bu2/yi2 forms; both values are
                     curation-pinned, so either counts).
  neutral-register — segmentally identical; exactly one side is neutral
                     (tone 5) and the full-tone side is an attested candidate
                     for that character (the 個 ge4/ge5, 學生 sheng5/sheng1,
                     朋友 you5/you3 class — dictionaries pin citation tones,
                     Taiwan usage neutralizes some, tools differ by register).
  attested-variant — the differing reading is recorded on the SAME CC-CEDICT
                     entry as a `Taiwan pr.`/`also pr.` variant (期 qi1/qi2,
                     誰 shei2/shui2) — a regional/free pronunciation of the
                     same lexeme, not a meaning-bearing heteronym.

Anything outside these classes is a DISAGREEMENT: the item is non-GREEN and
is dropped or corrected before merge (AC6 — no recorded non-GREEN ships).
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

CURATION_ROOT = Path(__file__).resolve().parent.parent
SIDECAR_ROOT = CURATION_ROOT.parent
REPO_ROOT = SIDECAR_ROOT.parent.parent.parent
ASSETS_DIR = REPO_ROOT / "src" / "packages" / "lang-zh" / "assets"
DATA_DIR = SIDECAR_ROOT / "data"
RESULTS_DIR = CURATION_ROOT / "results"

START, END = "<START>", "<END>"

_TONE_MARKS = {"̄": "1", "́": "2", "̌": "3", "̀": "4"}


def norm_syl(s: str) -> str:
    """Any pinyin spelling → canonical tone3 (mirrors app/pinyin.py without
    the pypinyin dependency so stdlib callers can use it too)."""
    s = unicodedata.normalize("NFC", s.strip()).lower().replace("u:", "v").replace("ü", "v")
    decomp = unicodedata.normalize("NFD", s)
    tone, base = "", ""
    for ch in decomp:
        if ch in _TONE_MARKS:
            tone = _TONE_MARKS[ch]
        else:
            base += ch
    base = unicodedata.normalize("NFC", base)
    if base and base[-1].isdigit():
        return base
    return f"{base}{tone or 5}"


def han_runs_with_offsets(text: str) -> list[tuple[int, str]]:
    runs, cur, start = [], "", 0
    for i, ch in enumerate(text):
        if "一" <= ch <= "鿿":
            if not cur:
                start = i
            cur += ch
        else:
            if cur:
                runs.append((start, cur))
            cur = ""
    if cur:
        runs.append((start, cur))
    return runs


class World:
    """The loaded closed world + expected readings."""

    def __init__(self) -> None:
        self.tuples_doc = json.loads((ASSETS_DIR / "seed-tuples.json").read_text("utf-8"))
        self.table_doc = json.loads((ASSETS_DIR / "c9-context-table.json").read_text("utf-8"))
        self.norm_doc = json.loads((ASSETS_DIR / "segmenter-normalization.json").read_text("utf-8"))
        self.corpus = json.loads((CURATION_ROOT / "corpus" / "sentences.json").read_text("utf-8"))
        self.carriers = json.loads(
            (CURATION_ROOT / "corpus" / "c9-carriers.generated.json").read_text("utf-8")
        )["carriers"]

        self.words = {t["word"]: t for t in self.tuples_doc["tuples"]}
        self.singles = set(self.table_doc["singles"])
        self.units = set(self.words) | self.singles
        self.max_len = max(len(u) for u in self.units)
        self.context = {
            (e["char"], e["prev"], e["next"]): e for e in self.table_doc["entries"]
        }

        # char -> attested candidate syllables (Unihan kMandarin ∪ CEDICT
        # per-position), tone3.
        self.char_candidates: dict[str, set[str]] = {}
        unihan = json.loads((DATA_DIR / "unihan-kmandarin.json").read_text("utf-8"))
        for char, info in unihan["characters"].items():
            self.char_candidates.setdefault(char, set()).update(
                norm_syl(r) for r in info["kMandarin"]
            )
        cedict = json.loads((DATA_DIR / "cedict-extract.json").read_text("utf-8"))
        self.cedict_readings: dict[str, list[list[str]]] = {}
        self.attested_variants: dict[str, set[str]] = {}
        for entry in cedict["entries"]:
            trad = entry["traditional"]
            reading = [norm_syl(s) for s in entry["pinyin"]]
            self.cedict_readings.setdefault(trad, []).append(reading)
            if len(reading) == len(trad):
                for ch, syl in zip(trad, reading):
                    self.char_candidates.setdefault(ch, set()).add(syl)
            # `Taiwan pr. [x]` / `also pr. [x]` on the entry attest same-lexeme
            # pronunciation variants (期 qi2, 誰 shui2, 知道 zhi1dao5 …).
            for m in re.finditer(r"(?:Taiwan|also)\s+pr\.\s*\[([^\]]+)\]", entry["line"]):
                syls = [norm_syl(s) for s in m.group(1).split()]
                for ch, syl in zip(trad, syls) if len(syls) == len(trad) else []:
                    self.attested_variants.setdefault(ch, set()).add(syl)
                    self.char_candidates.setdefault(ch, set()).add(syl)

    # ---- expected readings ----------------------------------------------

    def cover(self, run: str) -> list[str] | None:
        covers: list[list[str]] = []

        def rec(i: int, acc: list[str]) -> None:
            if len(covers) > 1:
                return
            if i == len(run):
                covers.append(list(acc))
                return
            for L in range(1, self.max_len + 1):
                if i + L <= len(run) and run[i : i + L] in self.units:
                    acc.append(run[i : i + L])
                    rec(i + L, acc)
                    acc.pop()

        rec(0, [])
        return covers[0] if len(covers) == 1 else None

    @staticmethod
    def display_reading(expected: list[dict]) -> tuple[str, str | None]:
        """Human/jury-display surface reading string for a sentence's
        `expected_readings()` output, with the sidecar's own
        length-exactly-2 cross-word third-tone shift applied on top of the
        per-unit pinned surfaces (mirrors app/legs/sandhi.py's unconditional
        pairwise 3-3 -> 2-3 branch — "no grouping ambiguity" — so a
        compositional sequence like 很+好, curated as two independently-
        pinned tone-3 singles, displays the same hen2 hao3 a deployed turn
        actually renders; longer within-word runs are already correctly
        pre-shifted in each tuple's own curated surfacePinyin and are left
        untouched here). Shared by the jury prompt text and the gold-pass
        item sheets — both show this text to a human/LLM asked to judge
        correctness, so both must show the phonologically real form).

        Returns (reading, note): note is a short, per-position explanation
        of every cross-word shift APPLIED, e.g. "我->wo2 before 有 (you3):
        standard pairwise third-tone sandhi, not an error" — or None if no
        cross-word shift fired. This is deliberately colocated with the
        item text (not just a general system-prompt rule) because a native-
        jury run showed this specific judgment is where LLM jurors are
        least reliable (design §10.5's own acknowledged residual): stating
        the applied rule inline, per occurrence, is far more stable than
        expecting the juror to recall and re-derive a general rule.

        One conservative exception, confirmed by a native-jury refutation
        (issue #20, curation run 2026-07): the shift is SKIPPED when the
        run's second syllable is the start of a bare subject pronoun (我/你/
        他/我們). In this sliver those four words are used exclusively as a
        NEW clause's fronted subject, so a preceding tone-3 syllable ending
        an unrelated constituent (e.g. 星期五 + 你, "on Friday, are you...")
        sits across a topic/clause prosodic break — real speech does not
        sandhi across it, unlike a same-clause pronoun+predicate pair (我+
        有) or a same-phrase modifier+head pair (很+好), which stay shifted.
        This is a narrow, corpus-scoped heuristic, not a syntactic parser —
        it resolves the one instance this scope actually contains (deferred
        general grouping is design §10.5's tracked open item, not a v1
        blocker).
        """
        SUBJECT_PRONOUNS = {"我", "你", "他", "我們"}

        def tone(syl: str) -> int:
            n = norm_syl(syl)
            return int(n[-1]) if n and n[-1].isdigit() else 5

        def with_tone2(syl: str) -> str:
            n = norm_syl(syl)
            return f"{n[:-1]}2" if n and n[-1].isdigit() else f"{n}2"

        base_tones = [tone(p["base"]) for p in expected]
        surfaces = [p["surface"] for p in expected]
        shifts: list[str] = []
        i, n = 0, len(base_tones)
        while i < n:
            if base_tones[i] != 3:
                i += 1
                continue
            j = i
            while j + 1 < n and base_tones[j + 1] == 3:
                j += 1
            if (
                j - i + 1 == 2
                and tone(surfaces[i]) == 3
                and expected[j]["unit"] not in SUBJECT_PRONOUNS
            ):
                shifted = with_tone2(surfaces[i])
                shifts.append(
                    f"{expected[i]['char']}->{shifted} before {expected[j]['char']} "
                    f"({surfaces[j]}): standard pairwise third-tone sandhi, not an error"
                )
                surfaces[i] = shifted
            i = j + 1
        note = "; ".join(shifts) if shifts else None
        return " ".join(surfaces), note

    def expected_readings(self, text: str, pinned_cut: list[str] | None = None
                          ) -> list[dict] | None:
        """Per-character expected readings for a sentence: a list of
        {char, unit, base, surface, contextKey?} aligned to the text's Han
        characters (in order). None if any run has no unique cover."""
        out: list[dict] = []
        for _, run in han_runs_with_offsets(text):
            cover = self.cover(run)
            if cover is None:
                return None
            for i, unit in enumerate(cover):
                if unit in self.singles:
                    prev = cover[i - 1] if i > 0 else START
                    nxt = cover[i + 1] if i + 1 < len(cover) else END
                    entry = self.context.get((unit, prev, nxt))
                    if entry is None:
                        return None
                    out.append(
                        {
                            "char": unit,
                            "unit": unit,
                            "base": entry["base"],
                            "surface": entry["surface"],
                            "contextKey": f"{unit}|{prev}|{nxt}",
                        }
                    )
                else:
                    t = self.words[unit]
                    for ch, cit, sur in zip(unit, t["citationPinyin"], t["surfacePinyin"]):
                        out.append(
                            {"char": ch, "unit": unit, "base": norm_syl(cit), "surface": norm_syl(sur)}
                        )
        return out

    # ---- agreement classification ----------------------------------------

    def classify(self, char: str, expected_base: str, expected_surface: str,
                 got: str | None) -> tuple[str, str | None]:
        """Classify a tool's reading against the pins.
        Returns (class, note) — class 'disagreement' is non-GREEN."""
        if got is None:
            return "no-output", "tool produced no reading for this position"
        got = norm_syl(got)
        if got == expected_base:
            return "exact", None
        if got == expected_surface:
            return "singles-surface" if expected_surface != expected_base else "exact", (
                f"matched pinned surface {expected_surface} (sandhi-aware tool)"
                if expected_surface != expected_base else None
            )
        # neutral-register: segmental equal, exactly one side tone-5, the
        # full-tone side attested for the char.
        gb, gt = got[:-1], got[-1]
        eb, et = expected_base[:-1], expected_base[-1]
        if gb == eb and gt != et and "5" in (gt, et):
            full = got if gt != "5" else expected_base
            if full in self.char_candidates.get(char, set()):
                return "neutral-register", f"pinned {expected_base}, tool {got} — neutral-tone register variant (full tone attested)"
        # attested-variant: same-entry Taiwan pr./also pr.
        if got in self.attested_variants.get(char, set()):
            return "attested-variant", f"pinned {expected_base}, tool {got} — same CC-CEDICT entry records it (Taiwan pr./also pr.)"
        return "disagreement", f"pinned {expected_base} (surface {expected_surface}), tool said {got}"


GREEN_CLASSES = {"exact", "singles-surface", "neutral-register", "attested-variant"}
