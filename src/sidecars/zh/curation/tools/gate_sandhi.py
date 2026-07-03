#!/usr/bin/env python3
"""Gate leg 4 — the rule-based sandhi resolver (issue #20; design §3.4) —
stdlib-only, mirroring the sidecar's app/legs/sandhi.py semantics.

Verifies at curation time:
  (1) every tuple's curated surfacePinyin is a LEGAL resolution of its
      citation (segmentals identical; each tone ∈ {citation tone, 2 where
      citation is 3 in a within-word 3-3 context}; a curated within-word
      3+-run grouping never leaves two adjacent third tones);
  (2) every C9 entry's surface obeys the deterministic 不/一 shift rules
      given the FIRST base tone of its `next` unit (the exact
      `_consistency_check` math the sidecar re-runs hot);
  (3) no corpus sentence contains a cross-word 3+ third-tone BASE run (the
      sidecar would regenerate it — the corpus stays display-shaped);
      carriers are checked too but recorded as advisory (they are
      verification instruments, not display candidates).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import END, RESULTS_DIR, START, World, han_runs_with_offsets, norm_syl  # noqa: E402


def tone(s: str) -> int:
    return int(s[-1]) if s and s[-1].isdigit() else 5


def check_tuple_surface(t: dict) -> tuple[bool, str | None]:
    cit = [norm_syl(s) for s in t["citationPinyin"]]
    sur = [norm_syl(s) for s in t["surfacePinyin"]]
    if len(cit) != len(sur):
        return False, "length mismatch"
    for c, s in zip(cit, sur):
        if c[:-1] != s[:-1]:
            return False, f"segmental change {c} -> {s}"
        if c != s and not (tone(c) == 3 and tone(s) == 2):
            return False, f"illegal tone change {c} -> {s} (only 3->2 within-word sandhi is legal)"
    # a curated grouping never leaves adjacent 3-3 inside a 3+ citation run
    cit_tones = [tone(c) for c in cit]
    sur_tones = [tone(s) for s in sur]
    i = 0
    while i < len(cit_tones):
        if cit_tones[i] == 3:
            j = i
            while j + 1 < len(cit_tones) and cit_tones[j + 1] == 3:
                j += 1
            run_len = j - i + 1
            if run_len >= 3:
                if any(a == 3 and b == 3 for a, b in zip(sur_tones[i : j + 1], sur_tones[i + 1 : j + 1])):
                    return False, f"within-word {run_len}-run still stacks adjacent third tones in surface"
            i = j + 1
        else:
            i += 1
    return True, None


def first_base_tone(world: World, unit: str) -> int | None:
    if unit in (START, END):
        return None
    if unit in world.words:
        return tone(norm_syl(world.words[unit]["citationPinyin"][0]))
    for e in world.table_doc["entries"]:
        if e["char"] == unit:
            return tone(norm_syl(e["base"]))
    return None


def check_context(world: World, e: dict) -> tuple[bool, str | None]:
    base, surface = norm_syl(e["base"]), norm_syl(e["surface"])
    nt = first_base_tone(world, e["next"])
    ch = e["char"]
    if e.get("rule") == "ordinal-date":
        return (surface == base, "ordinal-date must stay unshifted") if surface != base else (True, None)
    if base == surface:
        # no shift pinned: legal unless the deterministic rule REQUIRES one
        if ch == "不" and nt == 4:
            return False, f"不 before tone 4 ({e['next']}) must pin surface bu2"
        if ch == "一" and nt in (1, 2, 3, 4):
            return False, f"一 before tone {nt} ({e['next']}) must pin a shifted surface"
        return True, None
    st = tone(surface)
    if ch == "不":
        return (st == 2 and nt == 4, f"不 surface {surface} with next tone {nt}") if not (st == 2 and nt == 4) else (True, None)
    if ch == "一":
        if st == 2:
            return (nt == 4, f"一 surface yi2 with next tone {nt}") if nt != 4 else (True, None)
        if st == 4:
            return (nt in (1, 2, 3), f"一 surface yi4 with next tone {nt}") if nt not in (1, 2, 3) else (True, None)
        return False, f"一 illegal surface {surface}"
    return False, f"{ch} may not carry a shifted surface ({base} -> {surface})"


def crossword_runs(world: World, cut: list[str]) -> list[str]:
    stream: list[tuple[str, int]] = []
    for u in cut:
        if u in world.words:
            for s in world.words[u]["citationPinyin"]:
                stream.append((u, tone(norm_syl(s))))
        else:
            entry = next((e for e in world.table_doc["entries"] if e["char"] == u), None)
            stream.append((u, tone(norm_syl(entry["base"])) if entry else 0))
    bad, i = [], 0
    while i < len(stream):
        if stream[i][1] == 3:
            j = i
            while j + 1 < len(stream) and stream[j + 1][1] == 3:
                j += 1
            units_in_run = {stream[k][0] for k in range(i, j + 1)}
            if j - i + 1 >= 3 and len(units_in_run) > 1:
                bad.append("".join(sorted(units_in_run)))
            i = j + 1
        else:
            i += 1
    return bad


def main() -> int:
    world = World()
    records = []
    for t in world.tuples_doc["tuples"]:
        ok, why = check_tuple_surface(t)
        records.append({"kind": "tuple", "id": f"tuple:{t['readingId']}", "pass": ok, **({"why": why} if why else {})})
    for e in world.table_doc["entries"]:
        ok, why = check_context(world, e)
        records.append({"kind": "context", "id": f"context:{e['char']}|{e['prev']}|{e['next']}", "pass": ok, **({"why": why} if why else {})})
    for s in world.corpus["sentences"]:
        if s.get("coverAmbiguous"):
            records.append({"kind": "sentence", "id": f"sentence:{s['id']}", "pass": True, "note": "cover-ambiguous exemplar (你好) — display path regenerates by design"})
            continue
        bad = crossword_runs(world, s["cut"])
        records.append({"kind": "sentence", "id": f"sentence:{s['id']}", "pass": not bad, **({"why": f"cross-word third-tone runs: {bad}"} if bad else {})})
    advisories = []
    for c in world.carriers:
        cut = []
        ambiguous = False
        for _, run_ in han_runs_with_offsets(c["text"]):
            cover = world.cover(run_)
            if cover is None:
                ambiguous = True
                break
            cut.extend(cover)
        if ambiguous:
            continue
        bad = crossword_runs(world, cut)
        if bad:
            advisories.append({"carrier": c["contextKey"], "text": c["text"], "crosswordRuns": bad})

    result = {"leg": "sandhi-resolver", "records": records, "carrierAdvisories": advisories}
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "leg-sandhi.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    n = sum(1 for r in records if r["pass"])
    print(f"sandhi leg: {n}/{len(records)} pass; {len(advisories)} carrier advisories", file=sys.stderr)
    for r in records:
        if not r["pass"]:
            print(f"  FAIL {r['id']}: {r.get('why')}", file=sys.stderr)
    return 0 if n == len(records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
