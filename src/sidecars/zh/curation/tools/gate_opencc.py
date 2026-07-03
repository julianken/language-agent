#!/usr/bin/env python3
"""Advisory screen — OpenCC S↔T roundtrip (issue #20; design §6.6 context).

The sliver is Traditional-native, so OpenCC sits on NO verification leg here
(S→T ingestion is deferred to the future ingestion child). This screen uses
it the other way round as a curation tripwire: for every sliver word,
t2s → s2t roundtrip. A character that fails the roundtrip sits on a
many-to-one S→T expansion (the 發/髮-class hazard, design §6.6) and is
flagged for extra review + a targeted gold-pass question — flagging only,
never a gate failure (a roundtrip miss is a property of the script mapping,
not an error in the tuple).

Requires OpenCC (curation env only — the deployed sidecar bans it).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import RESULTS_DIR, World  # noqa: E402


def main() -> int:
    import opencc

    t2s = opencc.OpenCC("t2s")
    s2t = opencc.OpenCC("s2t")
    world = World()
    records = []
    for t in world.tuples_doc["tuples"]:
        word = t["word"]
        simplified = t2s.convert(word)
        back = s2t.convert(simplified)
        records.append(
            {
                "id": f"tuple:{t['readingId']}",
                "word": word,
                "t2s": simplified,
                "s2t": back,
                "roundtrip": back == word,
            }
        )
    flagged = [r for r in records if not r["roundtrip"]]
    result = {
        "leg": "opencc-roundtrip-screen (advisory)",
        "tool": "OpenCC 1.4.0 (t2s/s2t)",
        "records": records,
        "flagged": flagged,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "leg-opencc.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    print(
        f"opencc screen: {len(records) - len(flagged)}/{len(records)} roundtrip; "
        f"flagged for review: {[r['word'] for r in flagged]}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
