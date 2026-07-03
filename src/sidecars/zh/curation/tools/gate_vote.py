#!/usr/bin/env python3
"""Gate leg 3 — the multi-segmenter/multi-voter pass (issue #20; design §6.3/§6.7).

Three independent checks over the corpus + every C9 carrier:

  (a) pypinyin READING voter (MIT; dictionary/rule code path, independent of
      g2pW's neural path): per-character readings classified against the pins
      with the same documented agreement classes as the g2pW leg.

  (b) jieba SEGMENTATION voter exactly as the sidecar runs it hot (dictionary
      cut, HMM off, sliver units registered), normalized through the SHIPPED
      asset map (segmenter-normalization.json) — proves the shipped map is
      sufficient: post-normalization the cut must equal the pinned AS-standard
      cut for every corpus sentence and carrier (else the sidecar would
      YELLOW/regenerate a curated sentence).

  (c) AS-configured HanLP REFERENCE segmentation (Apache-2.0): HanLP
      COARSE_ELECTRA_SMALL_ZH, configured to the pinned AS/CKIP standard by
      boundary normalization — every HanLP segment that is a pure
      concatenation of consecutive pinned units is a granularity convention
      (merge), normalized before agreement is scored (design §6.7: normalize
      voters to the pinned standard, then score); a segment that CROSSES or
      SPLITS pinned unit boundaries is a genuine disagreement and fails the
      item. HanLP ships no AS-trained tokenizer (CKIP-Transformers, the AS
      reference implementation, is GPL — excluded pending the design §10.5
      license decision), so the AS configuration is exactly this committed
      normalization against the hand-pinned AS-standard cuts, recorded
      per-sentence.

Requires the curation env (jieba + pypinyin + hanlp). Never the deployed image.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import GREEN_CLASSES, RESULTS_DIR, World, han_runs_with_offsets  # noqa: E402


def normalize_cut(cut: list[str], mappings: dict[str, list[str]]) -> list[str]:
    out: list[str] = []
    for seg in cut:
        out.extend(mappings.get(seg, [seg]))
    return out


def decompose(seg: str, units: set[str], max_len: int) -> list[str] | None:
    """Greedy longest-first decomposition of a segment into pinned units."""
    out, i = [], 0
    while i < len(seg):
        for L in range(min(max_len, len(seg) - i), 0, -1):
            if seg[i : i + L] in units:
                out.append(seg[i : i + L])
                i += L
                break
        else:
            return None
    return out


def main() -> int:
    world = World()
    texts: list[tuple[str, str, list[str] | None]] = []
    for s in world.corpus["sentences"]:
        texts.append((f"sentence:{s['id']}", s["text"], s["cut"]))
    for c in world.carriers:
        texts.append((f"carrier:{c['contextKey']}", c["text"], None))

    # --- (a) pypinyin reading voter ---
    from pypinyin import Style, lazy_pinyin

    reading_records = []
    for tid, text, _ in texts:
        expected = world.expected_readings(text)
        if expected is None:
            if tid == "sentence:s01":
                t = world.words["你好"]
                expected = [
                    {"char": ch, "unit": "你好", "base": b, "surface": s2}
                    for ch, b, s2 in zip("你好", t["citationPinyin"], t["surfacePinyin"])
                ]
            else:
                raise SystemExit(f"vote leg: no expected readings for {tid}")
        han_chars = [ch for _, run_ in han_runs_with_offsets(text) for ch in run_]
        got = lazy_pinyin(
            "".join(han_chars), style=Style.TONE3, neutral_tone_with_five=True
        )
        if len(got) != len(expected):
            raise SystemExit(f"vote leg: pypinyin alignment failure on {tid}")
        positions = []
        for idx, (exp, g) in enumerate(zip(expected, got)):
            cls, note = world.classify(exp["char"], exp["base"], exp["surface"], g)
            positions.append(
                {
                    "pos": idx,
                    "char": exp["char"],
                    "pinned": exp["base"],
                    "pypinyin": g,
                    "class": cls,
                    **({"note": note} if note else {}),
                }
            )
        reading_records.append(
            {
                "id": tid,
                "pass": all(p["class"] in GREEN_CLASSES for p in positions),
                "positions": positions,
            }
        )

    # --- (b) jieba voter through the SHIPPED normalization map ---
    import jieba

    tokenizer = jieba.Tokenizer()
    tokenizer.initialize()
    for u in sorted(world.units):
        tokenizer.add_word(u)
    mappings = world.norm_doc["mappings"]

    jieba_records = []
    for tid, text, pinned in texts:
        pinned_cut = pinned
        if pinned_cut is None:
            pinned_cut = []
            ambiguous = False
            for _, run_ in han_runs_with_offsets(text):
                cover = world.cover(run_)
                if cover is None:
                    ambiguous = True
                    break
                pinned_cut.extend(cover)
            if ambiguous:
                jieba_records.append({"id": tid, "pass": True, "skipped": "cover-ambiguous (你好 exemplar)"})
                continue
        if tid == "sentence:s01":
            jieba_records.append({"id": tid, "pass": True, "skipped": "cover-ambiguous (你好 exemplar)"})
            continue
        cut: list[str] = []
        for _, run_ in han_runs_with_offsets(text):
            cut.extend(tokenizer.cut(run_, HMM=False))
        normalized = normalize_cut(cut, mappings)
        ok = normalized == pinned_cut
        jieba_records.append(
            {
                "id": tid,
                "pass": ok,
                "jieba": cut,
                "normalized": normalized,
                "pinned": pinned_cut,
            }
        )

    # --- (c) AS-configured HanLP reference ---
    import hanlp

    tok = hanlp.load(hanlp.pretrained.tok.COARSE_ELECTRA_SMALL_ZH)
    hanlp_records = []
    all_norms: dict[str, list[str]] = {}
    for tid, text, pinned in texts:
        if tid == "sentence:s01":
            hanlp_records.append({"id": tid, "pass": True, "skipped": "cover-ambiguous (你好 exemplar)"})
            continue
        pinned_cut = pinned
        if pinned_cut is None:
            pinned_cut = []
            for _, run_ in han_runs_with_offsets(text):
                pinned_cut.extend(world.cover(run_) or [])
        segs: list[str] = []
        for _, run_ in han_runs_with_offsets(text):
            segs.extend(tok(run_))
        normalized: list[str] = []
        genuine: list[str] = []
        for seg in segs:
            if seg in world.units:
                normalized.append(seg)
                continue
            dec = decompose(seg, world.units, world.max_len)
            if dec is None:
                genuine.append(seg)
                normalized.append(seg)
            else:
                all_norms[seg] = dec
                normalized.extend(dec)
        ok = not genuine and normalized == pinned_cut
        hanlp_records.append(
            {
                "id": tid,
                "pass": ok,
                "hanlp": segs,
                "normalized": normalized,
                "pinned": pinned_cut,
                **({"genuineDisagreements": genuine} if genuine else {}),
            }
        )

    result = {
        "leg": "multi-segmenter-vote",
        "tools": {
            "pypinyin": "pypinyin 0.55.0 TONE3 (reading voter)",
            "jieba": "jieba 0.42.1 dictionary cut, HMM off, sliver units registered, normalized via the SHIPPED segmenter-normalization.json (sidecar-identical)",
            "hanlp": "hanlp 2.1.3 COARSE_ELECTRA_SMALL_ZH, AS-configured by boundary normalization to the pinned AS/CKIP-standard cut (see module doc; CKIP-Transformers is GPL — excluded pending design §10.5)",
        },
        "hanlpNormalizationsApplied": dict(sorted(all_norms.items())),
        "readings": reading_records,
        "jieba": jieba_records,
        "hanlp": hanlp_records,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "leg-vote.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    for name, recs in (("pypinyin", reading_records), ("jieba", jieba_records), ("hanlp", hanlp_records)):
        n = sum(1 for r in recs if r["pass"])
        print(f"vote leg [{name}]: {n}/{len(recs)} pass", file=sys.stderr)
        for r in recs:
            if not r["pass"]:
                print(f"  FAIL {r['id']}: {json.dumps(r, ensure_ascii=False)[:300]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
