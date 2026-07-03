#!/usr/bin/env python3
"""The zh curation validator (issue #20, concrete-plan step 6) — stdlib-only.

Hard-fails (exit 1) on any violation of the curation constraints C1–C9 over
the committed `@la/lang-zh/assets` + curation sources, including the two
AC5 fixture classes:

  (a) a second `reading_id` on one surface form (C1/C2 injectivity — this
      mechanizes part of N4's deferral trigger: the first legitimate second
      reading is exactly the token-universe opening that wakes the neural
      legs, see GAPS.md);
  (b) an inconsistent per-character reading inside a multi-char tuple
      (each per-character citation syllable must sit in that character's
      CC-CEDICT/Unihan candidate set).

Every injectivity/consistency failure message carries the heteronym policy
VERBATIM (ADR normative wording, dual-instance amendment Decision 1 — AC2).

Run:      python3 src/sidecars/zh/curation/tools/validate_assets.py
Selftest: python3 src/sidecars/zh/curation/tools/validate_assets.py --selftest
          (proves both AC5 fixture classes hard-fail)
Pre-gate: --skip-results (before curation/results/gate-results.json exists)

No torch / no neural deps: this validator runs in the sidecar CI job (via
tests/test_curation_validator.py) and in the plain curation env alike.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

CURATION_ROOT = Path(__file__).resolve().parent.parent
SIDECAR_ROOT = CURATION_ROOT.parent
REPO_ROOT = SIDECAR_ROOT.parent.parent.parent
ASSETS_DIR = REPO_ROOT / "src" / "packages" / "lang-zh" / "assets"
DATA_DIR = SIDECAR_ROOT / "data"

sys.path.insert(0, str(CURATION_ROOT / "tools"))
import build_assets  # noqa: E402  (stdlib-only at import time)

HETERONYM_POLICY = build_assets.HETERONYM_POLICY
PROVENANCE = build_assets.PROVENANCE
START, END = "<START>", "<END>"

# C2: §6.8 head-set members OUTSIDE C3 (plus 長) may never appear as
# standalone sliver words or singles.
FORBIDDEN_STANDALONE = {"地", "得", "行", "重", "著", "和", "長"}
# C6: 離合詞 (separable verbs) — the hand-review list; none may be a tuple.
LIHECI = {"吃飯", "睡覺", "唱歌", "洗澡", "見面", "上課", "說話", "游泳", "跳舞", "照相"}
C3_SINGLES = ["的", "了", "不", "一", "嗎", "呢"]


class Fail(SystemExit):
    def __init__(self, msg: str) -> None:
        super().__init__(f"curation validator: HARD FAIL — {msg}")


def fail_injectivity(word: str, detail: str) -> None:
    raise Fail(
        f"C1/C2 injectivity violation on surface form {word!r} ({detail}). "
        f"Heteronym policy (verbatim, ADR Decision 1): {HETERONYM_POLICY} "
        "A second reading_id on one surface form is the token-universe-opening "
        "trigger — it wakes the deferred neural legs (GAPS.md), it does not ship."
    )


def fail_per_char(word: str, char: str, syllable: str, candidates: set[str]) -> None:
    raise Fail(
        f"inconsistent per-character reading inside multi-char tuple {word!r}: "
        f"character {char!r} pinned {syllable!r} but its CC-CEDICT/Unihan candidate "
        f"set is {sorted(candidates) or '∅'}. "
        f"Heteronym policy (verbatim, ADR Decision 1): {HETERONYM_POLICY}"
    )


def norm_syl(s: str) -> str:
    """tone3 normalization for extract data (stdlib mirror of app/pinyin.py:
    the extracts are already tone3 except Unihan tone marks)."""
    s = unicodedata.normalize("NFC", s.strip()).lower().replace("u:", "v").replace("ü", "v")
    marks = {
        "̄": "1", "́": "2", "̌": "3", "̀": "4",
    }
    decomp = unicodedata.normalize("NFD", s)
    tone = ""
    base = ""
    for ch in decomp:
        if ch in marks:
            tone = marks[ch]
        else:
            base += ch
    base = unicodedata.normalize("NFC", base)
    if base and base[-1].isdigit():
        return base
    return f"{base}{tone or 5}"


def load_char_candidates() -> dict[str, set[str]]:
    """char -> candidate citation syllables, from the committed sidecar
    extracts (Unihan kMandarin ∪ per-position CC-CEDICT), mirroring
    app/state.py."""
    cands: dict[str, set[str]] = {}
    unihan = json.loads((DATA_DIR / "unihan-kmandarin.json").read_text("utf-8"))
    for char, info in unihan["characters"].items():
        cands.setdefault(char, set()).update(norm_syl(r) for r in info["kMandarin"])
    cedict = json.loads((DATA_DIR / "cedict-extract.json").read_text("utf-8"))
    for entry in cedict["entries"]:
        trad = entry["traditional"]
        reading = [norm_syl(s) for s in entry["pinyin"]]
        if len(reading) == len(trad):
            for ch, syl in zip(trad, reading):
                cands.setdefault(ch, set()).add(syl)
    return cands


def load_cedict_word_readings() -> dict[str, list[list[str]]]:
    cedict = json.loads((DATA_DIR / "cedict-extract.json").read_text("utf-8"))
    out: dict[str, list[list[str]]] = {}
    for entry in cedict["entries"]:
        out.setdefault(entry["traditional"], []).append(
            [norm_syl(s) for s in entry["pinyin"]]
        )
    return out


def validate(tuples_doc: dict, table_doc: dict, norm_doc: dict,
             check_against_sources: bool = True, check_results: bool = True) -> list[str]:
    """Validate the asset documents; return an info summary (raises Fail)."""
    info: list[str] = []
    tuples = tuples_doc["tuples"]
    singles = list(table_doc["singles"])
    words_set = {t["word"] for t in tuples}
    units = words_set | set(singles)

    # --- C1 (machine-checked injectivity) + C2 (one reading_id per word) ---
    seen: dict[str, str] = {}
    for t in tuples:
        w = unicodedata.normalize("NFC", t["word"])
        if w in seen and seen[w] != t["readingId"]:
            fail_injectivity(w, f"reading_ids {seen[w]!r} and {t['readingId']!r}")
        if w in seen:
            fail_injectivity(w, f"duplicate tuple for {w!r}")
        seen[w] = t["readingId"]
        expected = f"{w}:{''.join(t['citationPinyin'])}"
        if t["readingId"] != expected:
            raise Fail(f"readingId {t['readingId']!r} != canonical {expected!r}")
    info.append(f"C1 injectivity: {len(tuples)} tuples, one reading_id per surface form")

    # --- heteronym policy verbatim in the committed curation note (AC2) ---
    if HETERONYM_POLICY not in tuples_doc.get("note", ""):
        raise Fail("seed-tuples note does not carry the ADR-verbatim heteronym policy")

    # --- provenance ---
    for name, doc in (("seed-tuples", tuples_doc), ("c9-context-table", table_doc),
                      ("segmenter-normalization", norm_doc)):
        if doc.get("provenance") != PROVENANCE:
            raise Fail(f"{name} provenance is {doc.get('provenance')!r}, expected {PROVENANCE!r}")

    # --- C2: forbidden standalone head-set members ---
    bad = FORBIDDEN_STANDALONE & units
    if bad:
        raise Fail(f"C2: forbidden standalone §6.8 head-set/heteronym forms in the sliver: {sorted(bad)}")

    # --- C3 ---
    if singles != C3_SINGLES:
        raise Fail(f"C3: singles {singles} != committed {C3_SINGLES}")
    if set(singles) & words_set:
        raise Fail(f"C3: singles double-admitted as words: {sorted(set(singles) & words_set)}")
    for t in tuples:
        if len(t["word"]) > 1 and set(t["word"]) & set(singles):
            raise Fail(
                f"C3: multi-char word {t['word']!r} contains a referent-(2) single "
                f"character — excluded at skeleton scope"
            )

    # --- C4: decomposable multi-char words (collision scan, committed part) ---
    max_len = max(len(u) for u in units)
    decomposable = []
    for t in tuples:
        if len(t["word"]) < 2:
            continue
        others = units - {t["word"]}
        cover = build_assets.unique_cover(t["word"], others, max_len)
        # ANY full cover by other units is a collision (unique or not).
        covers_exist = cover is not None or _any_cover(t["word"], others, max_len)
        if covers_exist:
            decomposable.append(t["word"])
    if set(decomposable) - {"你好"}:
        raise Fail(
            f"C4: segmentation collisions beyond the documented 你好 exemplar: "
            f"{sorted(set(decomposable) - {'你好'})} — resolve or document before shipping"
        )
    info.append(f"C4 collision scan: decomposable words = {decomposable} (你好 is the documented >1-cover exemplar, golden fixture 10)")

    # --- C5: no erhua; neutral tone only with citation pinned ---
    for t in tuples:
        if "兒" in t["word"]:
            raise Fail(f"C5: erhua form {t['word']!r} in the sliver")
        for syl in t["citationPinyin"]:
            if syl == "r5":
                raise Fail(f"C5: erhua syllable in {t['word']!r}")
        if len(t["citationPinyin"]) != len(t["word"]):
            raise Fail(f"{t['word']!r}: citation syllable count != char count (erhua/fusion not allowed)")
        if len(t["surfacePinyin"]) != len(t["word"]):
            raise Fail(f"{t['word']!r}: surface syllable count != char count")

    # --- C6: no 離合詞 ---
    liheci = LIHECI & words_set
    if liheci:
        raise Fail(f"C6: 離合詞 in the sliver: {sorted(liheci)} (spanGroup stays fake-covered until the separable-verb child)")

    # --- C7: 兩/二 roles explicit ---
    roles = {t["word"]: t["senseId"] for t in tuples if t["word"] in ("兩", "二")}
    if roles.get("兩") != "two-quantity" or roles.get("二") != "two-digit":
        raise Fail(f"C7: 兩/二 role senses wrong: {roles}")

    # --- C9: table structure, closure, hard patterns, surface consistency ---
    entries = table_doc["entries"]
    keys = {(e["char"], e["prev"], e["next"]) for e in entries}
    if len(keys) != len(entries):
        raise Fail("C9: duplicate context keys")
    for e in entries:
        if e["char"] not in singles:
            raise Fail(f"C9: entry for non-single {e['char']!r}")
        for side in ("prev", "next"):
            u = e[side]
            if u not in (START, END) and u not in units:
                raise Fail(f"C9: context {e} references out-of-world unit {u!r}")
        # hard pattern 1: V+不/得+了 must never be enumerated for 了
        if e["char"] == "了" and e["prev"] in ("不", "得"):
            raise Fail(f"C9: 了 context with prev {e['prev']!r} collides with the hard-coded potential-infix regenerate")
        # hard pattern 2: ordinal/date 一 only via the ordinal-date rule
        if e["char"] == "一":
            ordinal_pos = e["prev"] in {"星期", "週", "禮拜", "第"} or e["next"] in {"月", "日", "號"}
            if ordinal_pos and e.get("rule") != "ordinal-date":
                raise Fail(f"C9: ordinal/date 一 context {e} without rule ordinal-date")
            if not ordinal_pos and e.get("rule") == "ordinal-date":
                raise Fail(f"C9: non-ordinal 一 context {e} carries rule ordinal-date")
        # closure under single adjacency (sentence-final particles)
        if e["next"] in singles:
            if not any(k[0] == e["next"] and k[1] == e["char"] for k in keys):
                raise Fail(f"C9: context {e} implies unenumerated continuation for {e['next']!r}")
        if e["prev"] in singles:
            if not any(k[0] == e["prev"] and k[2] == e["char"] for k in keys):
                raise Fail(f"C9: context {e} implies unenumerated predecessor for {e['prev']!r}")
    info.append(f"C9: {len(entries)} enumerated contexts, closed under single-adjacency, hard patterns guarded")

    # --- per-character reading cross-check (multi-char tuples) — AC5(b) ---
    cands = load_char_candidates()
    for t in tuples:
        if len(t["word"]) < 2:
            continue
        for ch, syl in zip(t["word"], t["citationPinyin"]):
            cset = cands.get(ch, set())
            nsyl = norm_syl(syl)
            if nsyl not in cset:
                # neutral-tone register: a tone-5 pin whose full-tone base is a
                # candidate is consistent (dictionaries list citation tones).
                if nsyl.endswith("5") and any(
                    c[:-1] == nsyl[:-1] and c[-1].isdigit() for c in cset
                ):
                    continue
                fail_per_char(t["word"], ch, syl, cset)
    info.append("per-character reading cross-check: consistent for all multi-char tuples")

    # --- word citation must be a CC-CEDICT reading (deterministic floor) ---
    cedict = load_cedict_word_readings()
    for t in tuples:
        readings = cedict.get(t["word"], [])
        if [norm_syl(s) for s in t["citationPinyin"]] not in readings:
            raise Fail(
                f"{t['word']!r}: pinned citation {t['citationPinyin']} not a CC-CEDICT "
                f"reading of the Traditional headword (candidates: {readings})"
            )

    # --- normalization map well-formedness ---
    for seg, split in norm_doc["mappings"].items():
        if seg in units:
            raise Fail(f"normalization key {seg!r} is itself a pinned unit")
        if "".join(split) != seg:
            raise Fail(f"normalization mapping {seg!r} -> {split} is not a re-segmentation")
        for u in split:
            if u not in units:
                raise Fail(f"normalization mapping {seg!r} -> {split} references out-of-world unit {u!r}")
    for excluded in build_assets.DELIBERATE_EXCLUSIONS:
        if excluded in norm_doc["mappings"]:
            raise Fail(f"deliberately-excluded segment {excluded!r} found in the normalization map")

    # --- sources ↔ assets freshness (the committed table matches the grammar) ---
    if check_against_sources:
        words_doc, grammar, corpus = build_assets.load_sources()
        words_by_surface = {w["word"]: w for w in words_doc["words"]}
        expected_entries, expected_carriers = build_assets.expand_contexts(grammar, words_by_surface)
        if expected_entries != entries:
            raise Fail("c9-context-table.json is stale — rerun curation/tools/build_assets.py")
        committed_words = {w["word"]: w for w in words_doc["words"]}
        if {t["word"] for t in tuples} != set(committed_words):
            raise Fail("seed-tuples.json word set does not match curation/sliver/words.json — rerun build_assets.py")
        carriers_doc = json.loads(
            (CURATION_ROOT / "corpus" / "c9-carriers.generated.json").read_text("utf-8")
        )
        if carriers_doc["carriers"] != expected_carriers:
            raise Fail("c9-carriers.generated.json is stale — rerun build_assets.py")
        # C8: ranks + corpus coverage
        ranks = [w["rank"] for w in words_doc["words"]]
        if ranks != sorted(ranks) or len(set(ranks)) != len(ranks):
            raise Fail("C8: Sinica-frequency ranks must be unique and ascending")
        covered = {u for s in corpus["sentences"] for u in s["cut"]}
        missing = words_set - covered
        if missing:
            raise Fail(f"corpus coverage: sliver words in no curated sentence: {sorted(missing)}")
        # corpus cross-word third-tone runs (base tones) — display-shaped corpus
        base_tones: dict[str, list[int]] = {
            t["word"]: [int(s[-1]) if s[-1].isdigit() else 5 for s in t["citationPinyin"]]
            for t in tuples
        }
        for e in entries:
            base_tones.setdefault(e["char"], [int(e["base"][-1]) if e["base"][-1].isdigit() else 5])
        for s in corpus["sentences"]:
            stream: list[tuple[str, int]] = []
            for u in s["cut"]:
                for tn in base_tones.get(u, [0]):
                    stream.append((u, tn))
            run_len, run_units = 0, set()
            for u, tn in stream + [("", 0)]:
                if tn == 3:
                    run_len += 1
                    run_units.add(u)
                else:
                    if run_len >= 3 and len(run_units) > 1:
                        raise Fail(f"corpus {s['id']}: cross-word third-tone run (regenerate-shaped) in {s['text']!r}")
                    run_len, run_units = 0, set()
        info.append(f"corpus: {len(corpus['sentences'])} sentences, full sliver coverage, no cross-word third-tone runs")

    # --- gate results: every item recorded, all GREEN (AC6) ---
    if check_results:
        results = json.loads((CURATION_ROOT / "results" / "gate-results.json").read_text("utf-8"))
        by_id = {r["itemId"]: r for r in results["items"]}
        expected_ids = (
            [f"tuple:{t['readingId']}" for t in tuples]
            + [f"context:{e['char']}|{e['prev']}|{e['next']}" for e in entries]
            + [f"sentence:{s['id']}" for s in json.loads((CURATION_ROOT / 'corpus' / 'sentences.json').read_text('utf-8'))["sentences"]]
        )
        missing = [i for i in expected_ids if i not in by_id]
        if missing:
            raise Fail(f"gate results missing for {len(missing)} items (first: {missing[:5]})")
        not_green = [i for i in expected_ids if by_id[i]["verdict"] != "GREEN"]
        if not_green:
            raise Fail(
                f"AC6: non-GREEN recorded results present — a tuple/context with a "
                f"recorded non-GREEN result never merges: {not_green[:10]}"
            )
        info.append(
            f"gate results: {len(expected_ids)} items all GREEN under the legs run to date "
            f"(legs: {', '.join(results['legsRun'])})"
        )
    return info


def _any_cover(text: str, units: set[str], max_len: int) -> bool:
    def rec(i: int) -> bool:
        if i == len(text):
            return True
        return any(
            text[i : i + L] in units and rec(i + L)
            for L in range(1, max_len + 1)
            if i + L <= len(text)
        )
    return rec(0)


def selftest() -> None:
    """AC5: prove both fixture classes hard-fail, with the verbatim policy."""
    tuples_doc = json.loads((ASSETS_DIR / "seed-tuples.json").read_text("utf-8"))
    table_doc = json.loads((ASSETS_DIR / "c9-context-table.json").read_text("utf-8"))
    norm_doc = json.loads((ASSETS_DIR / "segmenter-normalization.json").read_text("utf-8"))

    # Fixture (a): a second reading_id on one surface form.
    poisoned = json.loads(json.dumps(tuples_doc))
    victim = dict(poisoned["tuples"][0])
    victim["readingId"] = victim["word"] + ":poisoned9"
    victim["citationPinyin"] = ["poisoned9"]
    poisoned["tuples"].append(victim)
    try:
        validate(poisoned, table_doc, norm_doc, check_against_sources=False, check_results=False)
    except SystemExit as exc:
        msg = str(exc)
        assert "C1/C2 injectivity violation" in msg, msg
        assert HETERONYM_POLICY in msg, "verbatim policy missing from failure message"
        print("selftest (a): second reading_id on one surface form → HARD FAIL ✓")
    else:
        raise Fail("selftest (a) did not fail")

    # Fixture (b): inconsistent per-character reading inside a multi-char tuple.
    poisoned = json.loads(json.dumps(tuples_doc))
    for t in poisoned["tuples"]:
        if len(t["word"]) > 1:
            t["citationPinyin"] = ["xx9"] + t["citationPinyin"][1:]
            t["readingId"] = f"{t['word']}:{''.join(t['citationPinyin'])}"
            break
    try:
        validate(poisoned, table_doc, norm_doc, check_against_sources=False, check_results=False)
    except SystemExit as exc:
        msg = str(exc)
        assert "inconsistent per-character reading" in msg, msg
        assert HETERONYM_POLICY in msg, "verbatim policy missing from failure message"
        print("selftest (b): inconsistent per-character reading in multi-char tuple → HARD FAIL ✓")
    else:
        raise Fail("selftest (b) did not fail")
    print("selftest passed: both AC5 fixture classes hard-fail with the ADR-verbatim policy text")


def main(argv: list[str]) -> int:
    if "--selftest" in argv:
        selftest()
        return 0
    tuples_doc = json.loads((ASSETS_DIR / "seed-tuples.json").read_text("utf-8"))
    table_doc = json.loads((ASSETS_DIR / "c9-context-table.json").read_text("utf-8"))
    norm_doc = json.loads((ASSETS_DIR / "segmenter-normalization.json").read_text("utf-8"))
    info = validate(
        tuples_doc, table_doc, norm_doc,
        check_against_sources=True,
        check_results="--skip-results" not in argv,
    )
    for line in info:
        print(f"OK: {line}")
    print("curation validator: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
