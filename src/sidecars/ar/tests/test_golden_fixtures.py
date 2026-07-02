"""Golden gate fixtures in the contract shape: (targetText + intents) in →
(token stream + bands + evidence) out.

Coverage per issue #7's AC: a passing case, a deliberate wrong-vowel case,
and corrupted-input cases — plus a deterministic YELLOW (core-word match
with an unlicensed case-ending vocalization) and the NO_ANALYSIS → RED law.
Expected values were derived from the calima-msa-r13 analyzer itself
(research §6: golden glosses/forms come from the CAMeL lexicon — the DB's
own pre-validated diac+gloss tuples), then pinned here; the DB is an exact
build-time artifact, so these are deterministic.

Every response is also checked against the module-owned annotation schema
(src/packages/lang-ar/ar-annotations.schema.json): this is the "conformance
fixtures validate their annotation payloads" AC.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from jsonschema import Draft202012Validator


def _verify(client, text: str, intents: list[dict] | None = None) -> dict:
    response = client.post("/v1/verify", json={"targetText": text, "intents": intents or []})
    assert response.status_code == 200
    return response.json()


def _assert_no_nulls(value: Any, path: str = "$") -> None:
    """Optional fields are typed as plain strings in the shared spec — an
    unset field must be ABSENT from the wire shape, never null."""
    if isinstance(value, dict):
        for key, item in value.items():
            assert item is not None, f"null at {path}.{key}"
            _assert_no_nulls(item, f"{path}.{key}")
    elif isinstance(value, list):
        for i, item in enumerate(value):
            _assert_no_nulls(item, f"{path}[{i}]")


@pytest.fixture(scope="session")
def ar_payload_validator(ar_schema_path) -> Draft202012Validator:
    schema = json.loads(ar_schema_path.read_text(encoding="utf-8"))
    return Draft202012Validator(schema)


def _assert_token_invariants(body: dict, validator: Draft202012Validator) -> None:
    _assert_no_nulls(body)
    for token in body["tokens"]:
        assert token["spine"]["band"] == token["band"], "spine.band must mirror token.band"
        assert token["spine"]["lang"] == "ar"
        assert token["annotations"]["lang"] == "ar"
        assert token["annotations"]["schemaId"] == "ar-annotations/v1"
        validator.validate(token["annotations"]["payload"])
        assert token["evidence"], "every token carries leg evidence"
        for evidence in token["evidence"]:
            assert evidence["legId"] in ("dediac-roundtrip", "camel-morph")
            assert isinstance(evidence["pass"], bool)


# --- The passing case (GREEN) -----------------------------------------------


def test_green_exact_vocalization_with_intent_alignment(client, ar_payload_validator) -> None:
    body = _verify(client, "كَتَبَ", intents=[{"id": "i1", "description": "write"}])
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "GREEN"
    assert token["spine"] == {
        "id": "t1",
        "lang": "ar",
        "surface": "كَتَبَ",
        "kind": "word",
        "status": "new",
        "band": "GREEN",
    }
    legs = {e["legId"]: e for e in token["evidence"]}
    assert legs["dediac-roundtrip"]["pass"] is True
    assert legs["camel-morph"]["pass"] is True
    assert "intent-gloss aligned" in legs["camel-morph"]["detail"]
    # The annotation payload carries the analyzer's own tuple (calima-msa-r13).
    assert token["annotations"]["payload"] == {
        "diac": "كَتَبَ",
        "skeleton": "كتب",
        "vowelState": "full",
        "morphology": {
            "lemma": "كَتَب",
            "root": "ك.ت.ب",
            "pattern": "1َ2َ3َ",
            "pos": "verb",
            "gloss": "write+he;it_<verb>",
            "caphi": "k_a_t_a_b_a",
        },
    }


def test_green_full_sentence_with_punctuation(client, ar_payload_validator) -> None:
    body = _verify(client, "كَتَبَ الوَلَدُ الدَرْسَ.", intents=[{"id": "i1", "description": "the boy wrote the lesson"}])
    _assert_token_invariants(body, ar_payload_validator)
    tokens = body["tokens"]
    assert [t["spine"]["surface"] for t in tokens] == ["كَتَبَ", "الوَلَدُ", "الدَرْسَ", "."]
    assert [t["spine"]["id"] for t in tokens] == ["t1", "t2", "t3", "t4"]
    assert [t["band"] for t in tokens] == ["GREEN", "GREEN", "GREEN", "GREEN"]
    assert [t["spine"]["kind"] for t in tokens] == ["word", "word", "word", "punct"]
    punct = tokens[3]
    assert punct["annotations"]["payload"]["vowelState"] == "none"
    assert punct["annotations"]["payload"]["morphology"]["pos"] == "punc"
    # Non-lexical tokens honestly carry no analyzer-leg evidence.
    assert [e["legId"] for e in punct["evidence"]] == ["dediac-roundtrip"]


# --- Deterministic YELLOW (degraded confidence) ------------------------------


def test_yellow_unlicensed_case_ending_core_match(client, ar_payload_validator) -> None:
    # كُتُبْ: the core word كُتُب is a legal analysis, but the sukūn-final
    # vocalization is not among the analyzer's forms — the case-ending slot
    # is unverified (§6: case endings are judged separately), so the token
    # surfaces YELLOW and the engine pins scaffolds.
    body = _verify(client, "كُتُبْ")
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "YELLOW"
    legs = {e["legId"]: e for e in token["evidence"]}
    assert legs["dediac-roundtrip"]["pass"] is True
    assert legs["camel-morph"]["pass"] is True
    assert "core-word match only" in legs["camel-morph"]["detail"]
    assert token["annotations"]["payload"]["vowelState"] == "partial"
    assert token["annotations"]["payload"]["morphology"]["root"] == "ك.ت.ب"


# --- Deliberate wrong-vowel case (RED) ---------------------------------------


def test_red_wrong_internal_vowels(client, ar_payload_validator) -> None:
    # كِتَبَ: structurally clean (leg 1 passes) but the analyzer licenses no
    # such vocalization of the skeleton كتب — a wrong vowel is a different
    # (here: non-existent) word, the highest-severity silent failure the
    # research names. RED, never surfaced.
    body = _verify(client, "كِتَبَ")
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "RED"
    legs = {e["legId"]: e for e in token["evidence"]}
    assert legs["dediac-roundtrip"]["pass"] is True
    assert legs["camel-morph"]["pass"] is False
    assert "wrong-vowel" in legs["camel-morph"]["detail"]


def test_red_bare_unvocalized_word(client, ar_payload_validator) -> None:
    # The generator must emit fully vocalized MSA; a bare skeleton is not a
    # licensed emitted form (no exact analysis match) → RED.
    body = _verify(client, "كتاب")
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "RED"
    assert token["annotations"]["payload"]["vowelState"] == "none"


# --- NO_ANALYSIS → RED, never a silent pass ----------------------------------


def test_red_no_analysis_is_never_a_silent_pass(client, ar_payload_validator) -> None:
    body = _verify(client, "قخصعث")
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "RED"
    legs = {e["legId"]: e for e in token["evidence"]}
    assert legs["camel-morph"]["pass"] is False
    assert "NO_ANALYSIS" in legs["camel-morph"]["detail"]
    # Unanalyzable word: morphology carries honest sentinels, still
    # schema-valid (validated by _assert_token_invariants above).
    assert token["annotations"]["payload"]["morphology"]["pos"] == "unknown"


# --- Out-of-world tokens (RED, fail closed — PR #29 review regression) -------


def test_red_space_separated_latin_token(client, ar_payload_validator) -> None:
    # Regression (PR #29 review): a separated pure-Latin token used to band
    # GREEN via the analyzer's pos="foreign" passthrough, whose diac echoes
    # the input verbatim and trivially satisfied the exact-match filter.
    # Belt 1: no Arabic-script codepoints in the skeleton → out-of-world → RED.
    body = _verify(client, "كَتَبَ book")
    _assert_token_invariants(body, ar_payload_validator)
    arabic, latin = body["tokens"]
    assert arabic["band"] == "GREEN"
    assert latin["spine"]["surface"] == "book"
    assert latin["spine"]["kind"] == "word"
    assert latin["band"] == "RED"
    legs = {e["legId"]: e for e in latin["evidence"]}
    assert legs["camel-morph"]["pass"] is False
    assert "out-of-world" in legs["camel-morph"]["detail"]


def test_red_nbsp_separated_latin_token(client, ar_payload_validator) -> None:
    # NBSP (U+00A0) separation splits like a space in the gate's segmenter —
    # pinned so a future tokenizer change that stops splitting NBSP still
    # has to keep the Latin content RED (the glued form would then fail
    # leg 1's mixed-script rule instead).
    body = _verify(client, "كَتَبَ\u00a0book")
    _assert_token_invariants(body, ar_payload_validator)
    assert [t["spine"]["surface"] for t in body["tokens"]] == ["كَتَبَ", "book"]
    assert [t["band"] for t in body["tokens"]] == ["GREEN", "RED"]


def test_red_pure_latin_text(client, ar_payload_validator) -> None:
    body = _verify(client, "book")
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["spine"]["kind"] == "word"
    assert token["band"] == "RED"
    legs = {e["legId"]: e for e in token["evidence"]}
    assert "out-of-world" in legs["camel-morph"]["detail"]
    assert token["annotations"]["payload"]["morphology"]["pos"] == "unknown"


def test_passthrough_echo_never_constitutes_membership() -> None:
    # Belt 2, tested independently of belt 1: even for an Arabic-script
    # skeleton, an analyzer answer consisting only of passthrough-class
    # echoes (pos foreign/punc/digit, diac == input) is NO membership —
    # RED, never a trivially-exact GREEN.
    from app.gate import _verify_word
    from generated.models import Band

    class _PassthroughOnlyAnalyzer:
        def analyze(self, skeleton: str) -> tuple[dict, ...]:
            return ({"diac": skeleton, "lex": skeleton, "pos": "foreign", "gloss": ""},)

    band, evidence, chosen, exact = _verify_word("كتب", "كتب", frozenset(), _PassthroughOnlyAnalyzer())
    assert band is Band.RED
    assert exact is False
    assert chosen is None
    morph = next(e for e in evidence if e.legId == "camel-morph")
    assert morph.pass_ is False
    assert "passthrough" in morph.detail


# --- Non-lexical tokens: handling pinned as a decision, not an accident ------


def test_digits_only_tokens_are_num_green(client, ar_payload_validator) -> None:
    # Decision (pinned): pure digit runs — ASCII or Arabic-Indic — are
    # non-lexical `num` tokens: nothing vocalizable to verify, leg 2 is
    # honestly absent from the evidence, GREEN with pos=digit sentinels
    # (research §7 keeps numerals a legitimate part of the rendered stream).
    body = _verify(client, "123 ٤٥")
    _assert_token_invariants(body, ar_payload_validator)
    assert len(body["tokens"]) == 2
    for token in body["tokens"]:
        assert token["spine"]["kind"] == "num"
        assert token["band"] == "GREEN"
        assert [e["legId"] for e in token["evidence"]] == ["dediac-roundtrip"]
        assert token["annotations"]["payload"]["vowelState"] == "none"
        assert token["annotations"]["payload"]["morphology"]["pos"] == "digit"


def test_punctuation_tokens_are_punct_green(client, ar_payload_validator) -> None:
    # Decision (pinned): punctuation — ASCII or Arabic (U+061F) — is a
    # non-lexical `punct` token: GREEN, leg 2 honestly absent, pos=punc.
    body = _verify(client, ". ؟")
    _assert_token_invariants(body, ar_payload_validator)
    assert len(body["tokens"]) == 2
    for token in body["tokens"]:
        assert token["spine"]["kind"] == "punct"
        assert token["band"] == "GREEN"
        assert [e["legId"] for e in token["evidence"]] == ["dediac-roundtrip"]
        assert token["annotations"]["payload"]["morphology"]["pos"] == "punc"


# --- Corrupted input (RED via leg 1) -----------------------------------------


@pytest.mark.parametrize(
    ("text", "detail_fragment"),
    [
        ("َكتب", "not attached"),  # orphan leading vowel mark
        ("كََتَبَ", "stacked"),  # doubled fatha on one letter
        ("كتبbook", "mixed"),  # half-Latin/half-Arabic splice
    ],
)
def test_red_corrupted_input(client, ar_payload_validator, text: str, detail_fragment: str) -> None:
    body = _verify(client, text)
    _assert_token_invariants(body, ar_payload_validator)
    (token,) = body["tokens"]
    assert token["band"] == "RED"
    legs = {e["legId"]: e for e in token["evidence"]}
    assert legs["dediac-roundtrip"]["pass"] is False
    assert detail_fragment in legs["dediac-roundtrip"]["detail"]


# --- Envelope edges -----------------------------------------------------------


def test_empty_target_text_yields_empty_stream(client) -> None:
    assert _verify(client, "") == {"tokens": []}


def test_evidence_serializes_pass_by_alias(client) -> None:
    body = _verify(client, "كَتَبَ")
    evidence = body["tokens"][0]["evidence"]
    assert all("pass" in e and "pass_" not in e for e in evidence)
