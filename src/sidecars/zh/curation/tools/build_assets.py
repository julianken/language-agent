#!/usr/bin/env python3
"""Build `@la/lang-zh/assets` from the curation sources (issue #20).

Inputs (the curation source of truth, hand-edited):
  curation/sliver/words.json            — the hand-curated sliver + variant map
  curation/sliver/contexts-grammar.json — the C9 role templates (the committed
                                          definition of "reachable")
  curation/corpus/sentences.json        — the curated sentence corpus

Outputs (BUILD-GENERATED, committed — never hand-edited):
  src/packages/lang-zh/assets/seed-tuples.json
  src/packages/lang-zh/assets/c9-context-table.json
  src/packages/lang-zh/assets/segmenter-normalization.json
  curation/corpus/c9-carriers.generated.json   (the C9 carrier sentences the
      gate, the drift job, and the gold-pass sheets all share)

Deterministic on purpose (stable ordering, no timestamps) — the sidecar's
lexicon freshness gate chains off these files, and `validate_assets.py`
re-derives the expansion to prove the committed table matches the grammar.

The segmenter-normalization map is derived from REAL jieba dictionary cuts
over the corpus + carriers (jieba 0.42.1, HMM off, sliver units registered —
the exact voter configuration the sidecar runs): every jieba segment that
merges >=2 pinned units by pure convention gets a mapping to the pinned
AS-standard unit sequence. The DELIBERATE_EXCLUSIONS are genuine lexical
disagreements (not conventions) kept OUT of the map so the vote leg honestly
disagrees — the golden fixtures use 好喝 (YELLOW path) and 好好
(vote-disagreement ∩ sandhi-span regenerate path) exactly for this.

Requires jieba (curation env / the curation container) — run via:
  python3 src/sidecars/zh/curation/tools/build_assets.py
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

PROVENANCE = "curated — machine gate complete; native gold pass pending (#20 AC7)"

# The ADR's normative heteronym policy, VERBATIM (docs/decisions/
# language-module-architecture.md, dual-instance amendment Decision 1 —
# issue #20 AC2 requires this exact string in curation docs + validator).
HETERONYM_POLICY = (
    "no surface form carries two sliver `reading_id`s; every non-sliver "
    "alternate CC-CEDICT reading of a sliver word is confirmed "
    "closed-world-unreachable at curation (machine-checked injectivity + "
    "reviewed unreachability); head-set singles admitted per C3/C9."
)

# Genuine lexical disagreements deliberately kept OUT of the normalization
# map (see module docstring). Value = why.
DELIBERATE_EXCLUSIONS = {
    "好喝": "lexicalized adjective jieba knows; the pinned closed world composes 好|喝 — genuine disagreement, the golden YELLOW exemplar (fixture 09)",
    "好好": "lexicalized reduplication jieba knows; genuine disagreement intersecting a sandhi span — the golden regenerate exemplar (fixture 19)",
}

START, END = "<START>", "<END>"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def load_sources() -> tuple[dict, dict, dict]:
    words = json.loads((CURATION_ROOT / "sliver" / "words.json").read_text("utf-8"))
    grammar = json.loads(
        (CURATION_ROOT / "sliver" / "contexts-grammar.json").read_text("utf-8")
    )
    corpus = json.loads(
        (CURATION_ROOT / "corpus" / "sentences.json").read_text("utf-8")
    )
    return words, grammar, corpus


def tone_of(syllable: str) -> int:
    return int(syllable[-1]) if syllable and syllable[-1].isdigit() else 5


def first_base_tone(unit: str, words_by_surface: dict[str, dict], grammar: dict) -> int:
    """First base-tone syllable of the FOLLOWING unit (word or single)."""
    if unit in words_by_surface:
        return tone_of(words_by_surface[unit]["citationPinyin"][0])
    for t in grammar["templates"]:
        if t["char"] == unit:
            return tone_of(t["base"])
    raise SystemExit(f"build_assets: unknown next unit {unit!r}")


def surface_for(char: str, base: str, rule_fixed: str | None, next_unit: str,
                words_by_surface: dict[str, dict], grammar: dict) -> tuple[str, str | None]:
    """Compute (surface, rule) for a C9 entry, mirroring the sidecar's
    deterministic resolver (app/legs/sandhi.py `_consistency_check`)."""
    if rule_fixed == "ordinal-date":
        return base, "ordinal-date"
    if char == "不":
        if next_unit in (START, END):
            return base, None
        nt = first_base_tone(next_unit, words_by_surface, grammar)
        if nt == 4:
            return "bu2", "tone-shift-before-4"
        return base, None
    if char == "一":
        if next_unit in (START, END):
            return base, None
        nt = first_base_tone(next_unit, words_by_surface, grammar)
        if nt == 4:
            return "yi2", "tone-shift-before-4"
        if nt in (1, 2, 3):
            return "yi4", "tone-shift-before-non-4"
        return base, None  # neutral-tone follower: no shift
    return base, None


def expand_contexts(grammar: dict, words_by_surface: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    """Expand the role templates into (entries, carriers)."""
    entries: dict[tuple[str, str, str], dict] = {}
    carriers: list[dict] = []
    for t in grammar["templates"]:
        pairs: list[tuple[str, str]]
        if "pairs" in t:
            pairs = [(p, n) for p, n in t["pairs"]]
        else:
            pairs = [(p, n) for p in t["prev"] for n in t["next"]]
        for prev, nxt in pairs:
            key = (t["char"], prev, nxt)
            if key in entries:
                raise SystemExit(f"build_assets: duplicate context {key} (templates overlap)")
            surface, rule = surface_for(
                t["char"], t["base"], t.get("rule"), nxt, words_by_surface, grammar
            )
            entry = {
                "char": t["char"],
                "prev": prev,
                "next": nxt,
                "base": t["base"],
                "surface": surface,
                **({"rule": rule} if rule else {}),
                "note": f"{t['id']}: {t['role']}",
            }
            entries[key] = entry
            carrier = None
            if "carrierByPair" in t:
                carrier = t["carrierByPair"][f"{prev}|{nxt}"]
            elif "carrierByPrev" in t and prev in t.get("carrierByPrev", {}):
                carrier = t["carrierByPrev"][prev]
            elif "carrierByPrev" in t and t["char"] == "了" and prev in t["carrierByPrev"]:
                carrier = t["carrierByPrev"][prev]
            if carrier is None:
                carrier = t["carrier"]
            carrier = carrier.replace("{prev}", "" if prev == START else prev)
            carrier = carrier.replace("{next}", "" if nxt == END else nxt)
            carrier = carrier.replace("{q}", "？" if "誰" in (prev, nxt) or "誰" in carrier else "。")
            carriers.append(
                {
                    "contextKey": f"{t['char']}|{prev}|{nxt}",
                    "templateId": t["id"],
                    "text": carrier,
                }
            )
    ordered = sorted(entries.values(), key=lambda e: (e["char"], e["prev"], e["next"]))
    carriers.sort(key=lambda c: c["contextKey"])
    return ordered, carriers


def unique_cover(text: str, units: set[str], max_len: int) -> list[str] | None:
    """Exact-cover a Han run over the closed world; None if 0 or >1 covers.
    (Mirrors the sidecar's leg (a) for carrier/corpus verification.)"""
    covers: list[list[str]] = []

    def rec(i: int, acc: list[str]) -> None:
        if len(covers) > 1:
            return
        if i == len(text):
            covers.append(list(acc))
            return
        for L in range(1, max_len + 1):
            if i + L <= len(text) and text[i : i + L] in units:
                acc.append(text[i : i + L])
                rec(i + L, acc)
                acc.pop()

    rec(0, [])
    return covers[0] if len(covers) == 1 else None


def han_runs(text: str) -> list[str]:
    runs, cur = [], ""
    for ch in text:
        if "一" <= ch <= "鿿":
            cur += ch
        else:
            if cur:
                runs.append(cur)
            cur = ""
    if cur:
        runs.append(cur)
    return runs


def contexts_of_cut(cut: list[str], singles: set[str]) -> list[tuple[str, str, str]]:
    out = []
    for i, u in enumerate(cut):
        if u in singles:
            prev = cut[i - 1] if i > 0 else START
            nxt = cut[i + 1] if i + 1 < len(cut) else END
            out.append((u, prev, nxt))
    return out


def assert_carrier_realizes(carrier: dict, entries: list[dict], units: set[str],
                            singles: set[str], max_len: int) -> None:
    """Every carrier must contain a Han run whose unique cover realizes its
    exact (char, prev, next) context — and every single context the carrier
    realizes must itself be enumerated (self-consistency)."""
    char, prev, nxt = carrier["contextKey"].split("|")
    keys = {(e["char"], e["prev"], e["next"]) for e in entries}
    realized: list[tuple[str, str, str]] = []
    for run in han_runs(carrier["text"]):
        cover = unique_cover(run, units, max_len)
        if cover is None:
            raise SystemExit(
                f"build_assets: carrier {carrier['text']!r} has no unique closed-world cover"
            )
        realized.extend(contexts_of_cut(cover, singles))
    if (char, prev, nxt) not in realized:
        raise SystemExit(
            f"build_assets: carrier {carrier['text']!r} does not realize its context "
            f"({char},{prev},{nxt}); realized={realized}"
        )
    for ctx in realized:
        if ctx not in keys:
            raise SystemExit(
                f"build_assets: carrier {carrier['text']!r} realizes UNENUMERATED context {ctx}"
            )


def jieba_normalization(corpus: dict, carriers: list[dict], words_doc: dict,
                        singles: set[str], units: set[str]) -> dict[str, list[str]]:
    """Derive the voter-boundary normalization map from real jieba cuts."""
    import jieba

    tokenizer = jieba.Tokenizer()
    tokenizer.initialize()
    for u in sorted(units):
        tokenizer.add_word(u)

    unit_list = sorted(units, key=len, reverse=True)

    def pinned_split(segment: str) -> list[str] | None:
        """Greedy split of a jieba segment into pinned units (longest first)."""
        out, i = [], 0
        while i < len(segment):
            for u in unit_list:
                if segment.startswith(u, i):
                    out.append(u)
                    i += len(u)
                    break
            else:
                return None
        return out

    mappings: dict[str, list[str]] = {}
    texts = [s["text"] for s in corpus["sentences"]] + [c["text"] for c in carriers]
    for text in texts:
        for run in han_runs(text):
            for seg in tokenizer.cut(run, HMM=False):
                if seg in units or len(seg) < 2:
                    continue
                if seg in DELIBERATE_EXCLUSIONS:
                    continue
                split = pinned_split(seg)
                if split and len(split) >= 2:
                    prevm = mappings.get(seg)
                    if prevm is not None and prevm != split:
                        raise SystemExit(f"build_assets: inconsistent mapping for {seg!r}")
                    mappings[seg] = split
    return dict(sorted(mappings.items()))


def main() -> int:
    words_doc, grammar, corpus = load_sources()
    words = words_doc["words"]
    words_by_surface = {w["word"]: w for w in words}
    singles = set(grammar["singles"])
    units = set(words_by_surface) | singles
    max_len = max(len(u) for u in units)

    ranks = [w["rank"] for w in words]
    if ranks != sorted(ranks) or len(set(ranks)) != len(ranks):
        raise SystemExit("build_assets: ranks must be unique and ascending (Sinica-frequency order)")

    entries, carriers = expand_contexts(grammar, words_by_surface)
    for c in carriers:
        assert_carrier_realizes(c, entries, units, singles, max_len)

    # Corpus self-consistency: unique cover matches the pinned cut; every
    # single context the corpus realizes is enumerated.
    keys = {(e["char"], e["prev"], e["next"]) for e in entries}
    for s in corpus["sentences"]:
        runs = han_runs(s["text"])
        if s.get("coverAmbiguous"):
            continue
        covered: list[str] = []
        for run in runs:
            cover = unique_cover(run, units, max_len)
            if cover is None:
                raise SystemExit(f"build_assets: corpus {s['id']} has no unique cover")
            covered.extend(cover)
        if covered != s["cut"]:
            raise SystemExit(
                f"build_assets: corpus {s['id']} pinned cut {s['cut']} != unique cover {covered}"
            )
        for ctx in contexts_of_cut(s["cut"], singles):
            # contexts are per Han run — recompute per run
            pass
        for run in runs:
            cover = unique_cover(run, units, max_len)
            for ctx in contexts_of_cut(cover or [], singles):
                if ctx not in keys:
                    raise SystemExit(
                        f"build_assets: corpus {s['id']} realizes unenumerated context {ctx}"
                    )

    seed_tuples = {
        "provenance": PROVENANCE,
        "note": (
            "The zh seed sliver (issue #20): "
            f"{len(words)} hand-curated TOCFL/SC-TOP band-1 Traditional words "
            "(one deliberate exemplar exception, 展覽館 — see curation/sliver/words.json), "
            "Sinica-frequency-informed ordering, cleanroom-curated (no copied content; "
            "CC-CEDICT/Unihan consulted as membership authorities only). "
            "BUILD-GENERATED from src/sidecars/zh/curation/sliver/words.json by "
            "curation/tools/build_assets.py — edit the curation source, never this file. "
            "Every tuple has a recorded pass through the full offline machine gate "
            "(curation/results/gate-results.json); the one-time native-checker gold pass "
            "is #20 AC7, tracked in GAPS.md. Heteronym policy (ADR-verbatim): "
            + HETERONYM_POLICY
        ),
        "variantMap": dict(sorted(words_doc["variantMap"].items())),
        "variantMapNote": words_doc["variantMapNote"],
        "tuples": [
            {
                "word": w["word"],
                "readingId": f"{w['word']}:{''.join(w['citationPinyin'])}",
                "citationPinyin": w["citationPinyin"],
                "surfacePinyin": w["surfacePinyin"],
                "pos": w["pos"],
                "senseId": w["senseId"],
                "gloss": w["gloss"],
                "intentBearing": w["intentBearing"],
            }
            for w in sorted(words, key=lambda w: w["rank"])
        ],
    }

    context_table = {
        "provenance": PROVENANCE,
        "note": (
            "The C9 context enumeration (issue #20, constraint C9): every reachable "
            "local context of the C3 singles ({的, 了, 不, 一} plus 嗎/呢 — the v0 "
            "sliver function-word subset; 'head-set singles admitted per C3/C9'), where "
            "REACHABLE is the committed role grammar "
            "src/sidecars/zh/curation/sliver/contexts-grammar.json closed over the "
            "sliver. BUILD-GENERATED by curation/tools/build_assets.py — edit the "
            "grammar, never this file. The sidecar leg (#19 `headset-context-pinned`) "
            "is FAIL-CLOSED: any single occurring in a context absent from this "
            "enumeration regenerates. Every entry has a recorded machine-gate pass "
            "(curation/results/gate-results.json) and one gold-pass verdict row "
            "(curation/goldpass/, #20 AC7). This file is the artifact "
            "src/sidecars/zh consumes (cross-referenced in #19/#20 PRs)."
        ),
        "contextMarkers": {
            "START": START,
            "END": END,
            "meaning": "prev/next are the adjacent unit surfaces inside the same Han run; a run boundary (start/end of run, or adjacent punctuation) is <START>/<END>.",
        },
        "singles": sorted(singles, key=lambda s2: ["的", "了", "不", "一", "嗎", "呢"].index(s2)),
        "entries": entries,
    }

    normalization = jieba_normalization(corpus, carriers, words_doc, singles, units)
    norm_doc = {
        "provenance": PROVENANCE,
        "note": (
            "Boundary-normalization map for the jieba voter (design §6.7): voter "
            "boundaries are normalized to the pinned AS/CKIP-standard unit sequence "
            "BEFORE agreement is scored, so a vote counts as disagreement only when "
            "the cut genuinely differs — not when the voter merely follows a different "
            "segmentation convention. BUILD-GENERATED from real jieba 0.42.1 cuts "
            "(HMM off, sliver units registered — the sidecar voter's exact "
            "configuration) over the curation corpus + C9 carriers by "
            "curation/tools/build_assets.py. Deliberately ABSENT (genuine lexical "
            "disagreements, NOT conventions): "
            + "; ".join(f"{k} — {v}" for k, v in sorted(DELIBERATE_EXCLUSIONS.items()))
        ),
        "mappings": normalization,
    }

    carriers_doc = {
        "$doc": (
            "C9 carrier sentences — GENERATED by curation/tools/build_assets.py from "
            "sliver/contexts-grammar.json (one carrier per enumerated context; the "
            "builder asserts each carrier's unique closed-world cover realizes its "
            "exact context). Shared by the offline gate (g2pW leg + jury), the "
            "scheduled g2pW drift job, and the gold-pass item sheets. Do not hand-edit."
        ),
        "carriers": carriers,
    }

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        ASSETS_DIR / "seed-tuples.json": seed_tuples,
        ASSETS_DIR / "c9-context-table.json": context_table,
        ASSETS_DIR / "segmenter-normalization.json": norm_doc,
        CURATION_ROOT / "corpus" / "c9-carriers.generated.json": carriers_doc,
    }
    for path, payload in outputs.items():
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", "utf-8")
        print(f"wrote {path.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(
        f"sliver: {len(words)} words; C9 contexts: {len(entries)}; "
        f"normalization mappings: {len(normalization)}; carriers: {len(carriers)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
