#!/usr/bin/env python3
"""The offline gate orchestrator (issue #20) — merges the per-leg result
files into curation/results/gate-results.json, the committed record the
curation validator enforces (AC6: every tuple + every C9 context + every
corpus sentence has a recorded pass; anything non-GREEN does not merge).

Run the legs first (each writes results/leg-*.json):

  python3 tools/gate_membership.py            # stdlib
  python3 tools/gate_sandhi.py                # stdlib
  <curation-env> tools/gate_opencc.py         # OpenCC (advisory screen)
  <curation-env> tools/gate_vote.py           # pypinyin + jieba + AS-configured HanLP
  <curation-env> tools/gate_g2pw.py --baseline baseline/g2pw-drift-baseline.json
  OPENAI_API_KEY=… <curation-env> tools/gate_jury.py

then merge:

  python3 tools/run_gate.py

Verdict per item: GREEN iff every leg that touches the item passes (with
gate_lib's documented agreement classes — every non-exact agreement carries
a recorded note and a targeted gold-pass question; see goldpass/).
The one-time native-checker gold pass is AC7 — a separate completion step,
deliberately NOT a leg here (the machine PR never bundles it).
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import GREEN_CLASSES, RESULTS_DIR, World, han_runs_with_offsets  # noqa: E402


def load(name: str) -> dict:
    p = RESULTS_DIR / name
    if not p.exists():
        raise SystemExit(f"run_gate: missing {p} — run the leg first (see module doc)")
    return json.loads(p.read_text("utf-8"))


def main() -> int:
    world = World()
    membership = load("leg-membership.json")
    sandhi = load("leg-sandhi.json")
    vote = load("leg-vote.json")
    g2pw = load("leg-g2pw.json")
    jury = load("leg-jury.json")
    opencc = load("leg-opencc.json")

    # --- index the legs ---
    mem = {r["id"]: r for r in membership["records"]}
    san = {r["id"]: r for r in sandhi["records"]}
    jur = {r["id"]: r for r in jury["records"]}
    occ = {r["id"]: r for r in opencc["records"]}
    votes_by_id = {}
    for kind in ("readings", "jieba", "hanlp"):
        for r in vote[kind]:
            votes_by_id.setdefault(r["id"], {})[kind] = r

    # g2pW/vote sentence-level records feed per-tuple and per-context items:
    # an item passes the corpus-borne legs iff every sentence/carrier that
    # CONTAINS it passes and its own positions carry GREEN classes.
    g2 = {("sentence:" + r["id"] if r["kind"] == "sentence" else "carrier:" + r["id"]): r for r in g2pw["records"]}

    def texts_containing(unit: str) -> list[str]:
        out = []
        for s in world.corpus["sentences"]:
            if unit in s["cut"]:
                out.append(f"sentence:{s['id']}")
        for c in world.carriers:
            covered = []
            for _, run_ in han_runs_with_offsets(c["text"]):
                covered.extend(world.cover(run_) or [])
            if unit in covered:
                out.append(f"carrier:{c['contextKey']}")
        return out

    def corpus_legs_pass(ids: list[str], notes: list[str]) -> bool:
        ok = True
        for tid in ids:
            g = g2.get(tid)
            if g is None or not g["pass"]:
                ok = False
                notes.append(f"g2pw fail in {tid}")
            v = votes_by_id.get(tid, {})
            for kind, r in v.items():
                if not r["pass"]:
                    ok = False
                    notes.append(f"vote/{kind} fail in {tid}")
        return ok

    def variant_notes_for(unit: str, ids: list[str]) -> list[str]:
        notes: list[str] = []
        for tid in ids:
            g = g2.get(tid)
            if not g:
                continue
            for p in g["positions"]:
                if p["unit"] == unit and p["class"] not in ("exact",):
                    n = f"g2pW {tid}@{p['pos']}: {p['class']} ({p.get('note', '')})"
                    if n not in notes:
                        notes.append(n)
            v = votes_by_id.get(tid, {}).get("readings")
            if v:
                for p in v["positions"]:
                    if p["class"] not in ("exact",) and p["char"] in unit:
                        n = f"pypinyin {tid}@{p['pos']}: {p['class']} ({p.get('note', '')})"
                        if n not in notes:
                            notes.append(n)
        return notes

    items = []
    legs_run = [
        "cedict-unihan-membership",
        "g2pw-base-reading",
        "multi-segmenter-vote (pypinyin + jieba/shipped-map + AS-configured HanLP)",
        "sandhi-resolver",
        "diverse-vendor-refutation-jury (single-vendor panel — see leg-jury.json)",
        "opencc-roundtrip-screen (advisory)",
    ]

    for t in world.tuples_doc["tuples"]:
        iid = f"tuple:{t['readingId']}"
        notes: list[str] = []
        ids = texts_containing(t["word"])
        legs = {
            "membership": mem[iid]["pass"],
            "sandhi": san[iid]["pass"],
            "corpus(g2pw+vote)": corpus_legs_pass(ids, notes),
            "jury": jur[iid]["pass"],
        }
        occ_r = occ.get(iid)
        if occ_r and not occ_r["roundtrip"]:
            notes.append(f"opencc roundtrip flagged (advisory): {occ_r['t2s']} -> {occ_r['s2t']}")
        notes.extend(variant_notes_for(t["word"], ids))
        verdict = "GREEN" if all(legs.values()) else "NOT-GREEN"
        items.append({"itemId": iid, "kind": "tuple", "verdict": verdict, "legs": legs, "coveredBy": ids, **({"notes": notes} if notes else {})})

    for e in world.table_doc["entries"]:
        key = f"{e['char']}|{e['prev']}|{e['next']}"
        iid = f"context:{key}"
        notes = []
        ids = [f"carrier:{key}"]
        legs = {
            "membership": mem[iid]["pass"],
            "sandhi": san[iid]["pass"],
            "carrier(g2pw+vote)": corpus_legs_pass(ids, notes),
            "jury": jur[iid]["pass"],
        }
        g = g2.get(ids[0])
        if g:
            for p in g["positions"]:
                if p.get("contextKey") == key and p["class"] not in ("exact",):
                    notes.append(f"g2pW: {p['class']} ({p.get('note', '')})")
        verdict = "GREEN" if all(legs.values()) else "NOT-GREEN"
        items.append({"itemId": iid, "kind": "context", "verdict": verdict, "legs": legs, "coveredBy": ids, **({"notes": notes} if notes else {})})

    for s in world.corpus["sentences"]:
        iid = f"sentence:{s['id']}"
        notes = []
        ids = [iid]
        legs = {
            "sandhi": san[iid]["pass"],
            "g2pw+vote": corpus_legs_pass(ids, notes),
            "jury": jur[iid]["pass"],
        }
        verdict = "GREEN" if all(legs.values()) else "NOT-GREEN"
        items.append({"itemId": iid, "kind": "sentence", "verdict": verdict, "legs": legs, **({"notes": notes} if notes else {})})

    not_green = [i for i in items if i["verdict"] != "GREEN"]
    result = {
        "$doc": (
            "The recorded offline machine gate results (issue #20 AC6): every sliver "
            "tuple, every C9 context, and every curated corpus sentence, each with its "
            "per-leg record. ALL-GREEN UNDER THE LEGS RUN TO DATE ships; any non-GREEN "
            "item is dropped or corrected, never merged. The one-time native-checker "
            "gold pass (AC7) is the separate completion step — tracked in GAPS.md, "
            "goldpass/ carries the task package. Agreement classes and their "
            "per-position records: see tools/gate_lib.py and the leg-*.json files."
        ),
        "date": date.today().isoformat(),
        "legsRun": legs_run,
        "juryPanel": jury["panel"],
        "juryVendors": jury["juryVendors"],
        "vendorDiversityNote": jury["vendorDiversityNote"],
        "counts": {
            "tuples": len(world.tuples_doc["tuples"]),
            "contexts": len(world.table_doc["entries"]),
            "sentences": len(world.corpus["sentences"]),
            "green": len(items) - len(not_green),
            "notGreen": len(not_green),
        },
        "items": items,
    }
    out = RESULTS_DIR / "gate-results.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(
        f"gate-results: {result['counts']['green']}/{len(items)} GREEN "
        f"({result['counts']['notGreen']} non-GREEN)",
        file=sys.stderr,
    )
    for i in not_green:
        print(f"  NOT-GREEN {i['itemId']}: {i['legs']} {i.get('notes')}", file=sys.stderr)
    return 0 if not not_green else 1


if __name__ == "__main__":
    raise SystemExit(main())
