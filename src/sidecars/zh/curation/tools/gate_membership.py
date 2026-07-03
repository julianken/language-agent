#!/usr/bin/env python3
"""Gate leg 1 — CC-CEDICT(Traditional)/Unihan citation-membership (issue #20;
design §6.1 — the deterministic floor, citation layer ONLY, never surface).

Per tuple: the pinned citation must be a CC-CEDICT reading of the Traditional
headword, and every per-character citation syllable must sit in that
character's candidate set (Unihan kMandarin ∪ CEDICT per-position; the
neutral-register rule of gate_lib applies to tone-5 pins whose full-tone base
is attested — dictionaries list citation tones).

Per C9 context: the entry's BASE syllable must be attested for the character
(surfaces bu2/yi2/yi4 are sandhi forms — deliberately NOT membership-checked,
mirroring the sidecar's headset leg which re-checks entry base only).

Stdlib-only; reads the committed extracts (regenerate them with
scripts/extract_membership.py when the closed world changes).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import RESULTS_DIR, World, norm_syl  # noqa: E402


def main() -> int:
    world = World()
    records = []

    for t in world.tuples_doc["tuples"]:
        word = t["word"]
        citation = [norm_syl(s) for s in t["citationPinyin"]]
        word_ok = citation in world.cedict_readings.get(word, [])
        char_checks = []
        for ch, syl in zip(word, citation):
            cands = world.char_candidates.get(ch, set())
            ok = syl in cands
            note = None
            if not ok and syl.endswith("5"):
                full = [c for c in cands if c[:-1] == syl[:-1]]
                if full:
                    ok = True
                    note = f"neutral-register citation ({syl}); full tone attested: {sorted(full)}"
            char_checks.append({"char": ch, "syllable": syl, "pass": ok, **({"note": note} if note else {})})
        records.append(
            {
                "kind": "tuple",
                "id": f"tuple:{t['readingId']}",
                "wordLevel": {"pass": word_ok, "cedictReadings": world.cedict_readings.get(word, [])},
                "perCharacter": char_checks,
                "pass": word_ok and all(c["pass"] for c in char_checks),
            }
        )

    for e in world.table_doc["entries"]:
        base = norm_syl(e["base"])
        cands = world.char_candidates.get(e["char"], set())
        ok = base in cands
        records.append(
            {
                "kind": "context",
                "id": f"context:{e['char']}|{e['prev']}|{e['next']}",
                "base": base,
                "candidates": sorted(cands),
                "pass": ok,
            }
        )

    result = {
        "leg": "cedict-unihan-membership",
        "sources": "committed extracts src/sidecars/zh/data/{cedict-extract,unihan-kmandarin}.json (regenerated for this closed world; see NOTICE.md for licenses)",
        "records": records,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "leg-membership.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    n = sum(1 for r in records if r["pass"])
    print(f"membership leg: {n}/{len(records)} pass", file=sys.stderr)
    for r in records:
        if not r["pass"]:
            print(f"  FAIL {r['id']}: {json.dumps(r, ensure_ascii=False)[:240]}", file=sys.stderr)
    return 0 if n == len(records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
