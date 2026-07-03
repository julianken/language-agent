#!/usr/bin/env python3
"""Gate leg 2 — g2pW base-reading agreement (issue #20; design §6.2), and
the scheduled drift job's diff tool (Decision 5; .github/workflows/drift-g2pw.yml).

Runs REAL g2pW (torch/onnxruntime — curation container / CI only, never the
deployed sidecar) over the curation corpus + every C9 carrier sentence and
compares each Han character's reading against the pinned expectation
(tuple citation / C9 entry base-or-surface), classifying every non-exact
agreement per gate_lib's documented classes.

Modes:
  (default)          — write results/leg-g2pw.json (consumed by run_gate.py)
  --baseline PATH    — additionally record the drift BASELINE: the exact
                       per-position fingerprint of every non-exact class.
                       This is the baseline #20 commits and N4 inherits.
  --check PATH       — drift mode (the scheduled CI job): recompute and diff
                       against the committed baseline; exit 1 on ANY new or
                       changed non-exact position (g2pW drifted against the
                       pinned readings / C9 table), exit 0 on no-drift.

g2pw 0.1.1 notes: model auto-downloads to ./G2PWModel on first run (set
cwd accordingly); `num_workers=0` must be FORCED post-construction (the
constructor treats 0 as falsy and falls back to config, which spawns
multiprocessing workers — hangs under spawn without a __main__ guard).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import GREEN_CLASSES, RESULTS_DIR, World, han_runs_with_offsets  # noqa: E402


def g2pw_readings(texts: list[str]) -> list[list[str | None]]:
    from g2pw import G2PWConverter

    conv = G2PWConverter(style="pinyin", num_workers=0, enable_non_tradional_chinese=False)
    conv.num_workers = 0  # 0 is falsy in the constructor — force it (see module doc)
    return conv(texts)


def run(world: World) -> dict:
    items: list[dict] = [
        {"kind": "sentence", "id": s["id"], "text": s["text"]}
        for s in world.corpus["sentences"]
    ] + [
        {"kind": "carrier", "id": c["contextKey"], "text": c["text"]}
        for c in world.carriers
    ]
    outputs = g2pw_readings([i["text"] for i in items])

    records: list[dict] = []
    for item, out in zip(items, outputs):
        expected = world.expected_readings(item["text"])
        if expected is None:
            if item["id"] == "s01":  # 你好 — the documented cover-ambiguous carrier
                t = world.words["你好"]
                expected = [
                    {"char": ch, "unit": "你好", "base": b, "surface": s2}
                    for ch, b, s2 in zip("你好", t["citationPinyin"], t["surfacePinyin"])
                ]
            else:
                raise SystemExit(f"g2pw leg: no expected readings for {item}")
        han_chars = [ch for _, run_ in han_runs_with_offsets(item["text"]) for ch in run_]
        got = [g for g in out if g is not None]
        if len(got) != len(han_chars) or len(expected) != len(han_chars):
            raise SystemExit(
                f"g2pw leg: alignment failure on {item['id']}: {len(han_chars)} han chars, "
                f"{len(expected)} expected, {len(got)} g2pW outputs"
            )
        positions = []
        for idx, (exp, g) in enumerate(zip(expected, got)):
            cls, note = world.classify(exp["char"], exp["base"], exp["surface"], g)
            positions.append(
                {
                    "pos": idx,
                    "char": exp["char"],
                    "unit": exp["unit"],
                    "pinned": exp["base"],
                    "pinnedSurface": exp["surface"],
                    "g2pw": g,
                    "class": cls,
                    **({"note": note} if note else {}),
                    **({"contextKey": exp["contextKey"]} if "contextKey" in exp else {}),
                }
            )
        records.append(
            {
                "kind": item["kind"],
                "id": item["id"],
                "text": item["text"],
                "pass": all(p["class"] in GREEN_CLASSES for p in positions),
                "positions": positions,
            }
        )
    return {
        "leg": "g2pw-base-reading",
        "tool": "g2pw 0.1.1 (G2PWModel-v2-onnx, Traditional-native), style=pinyin",
        "records": records,
    }


def fingerprint(result: dict) -> list[dict]:
    """The drift fingerprint: every non-exact position, stably ordered."""
    fp = []
    for r in result["records"]:
        for p in r["positions"]:
            if p["class"] != "exact":
                fp.append(
                    {
                        "id": r["id"],
                        "pos": p["pos"],
                        "char": p["char"],
                        "pinned": p["pinned"],
                        "g2pw": p["g2pw"],
                        "class": p["class"],
                    }
                )
    return sorted(fp, key=lambda x: (x["id"], x["pos"]))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", type=Path, help="write the drift baseline here")
    ap.add_argument("--check", type=Path, help="diff against this committed baseline (CI drift job)")
    args = ap.parse_args()

    world = World()
    result = run(world)
    fp = fingerprint(result)

    if args.check:
        baseline = json.loads(args.check.read_text("utf-8"))
        base_fp = baseline["fingerprint"]
        drift = [x for x in fp if x not in base_fp]
        vanished = [x for x in base_fp if x not in fp]
        print(
            f"g2pw drift check: {len(fp)} non-exact positions "
            f"(baseline {len(base_fp)}); new={len(drift)} vanished={len(vanished)}"
        )
        if drift or vanished:
            for x in drift[:20]:
                print(f"  NEW DRIFT: {x}")
            for x in vanished[:20]:
                print(f"  VANISHED (baseline position now differs): {x}")
            print(
                "g2pW drifted against the pinned readings / C9 context table — "
                "investigate before trusting the curation pins (non-blocking job; "
                "this red is the alarm, not a merge gate)."
            )
            return 1
        print("g2pw drift check: no drift against the recorded curation baseline")
        return 0

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / "leg-g2pw.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    n_pass = sum(1 for r in result["records"] if r["pass"])
    print(f"g2pw leg: {n_pass}/{len(result['records'])} sentences/carriers pass; "
          f"{len(fp)} non-exact positions (all classed)", file=sys.stderr)

    if args.baseline:
        args.baseline.parent.mkdir(parents=True, exist_ok=True)
        args.baseline.write_text(
            json.dumps(
                {
                    "$doc": (
                        "The g2pW drift baseline (issue #20, ADR Decision 5): the "
                        "recorded fingerprint of every non-exact g2pW position over the "
                        "curation corpus + C9 carriers at curation time, each classed "
                        "per gate_lib (neutral-register / attested-variant / "
                        "singles-surface). The scheduled non-blocking CI job "
                        "(.github/workflows/drift-g2pw.yml) recomputes and diffs "
                        "against this; any NEW or changed position is drift and reds "
                        "the (non-blocking) job. N4 inherits this baseline as its "
                        "acceptance floor and does NOT re-enable the job."
                    ),
                    "tool": result["tool"],
                    "corpusSentences": len(world.corpus["sentences"]),
                    "carriers": len(world.carriers),
                    "fingerprint": fp,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            "utf-8",
        )
        print(f"wrote drift baseline: {args.baseline}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
