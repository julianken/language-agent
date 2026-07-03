#!/usr/bin/env python3
"""Generate the gold-pass item sheet (issue #20 AC7) — stdlib-only.

Emits:
  item-sheet.csv                        (COMMITTED: one verdict row per sliver
                                         tuple + C9 context + corpus sentence,
                                         plus planted-error rows, opaque
                                         shuffled row ids)
  tmp/docs/zh-goldpass-answer-key.json  (GITIGNORED: row_id → itemId mapping +
                                         the planted-error answer key. Planted
                                         answers must not be publicly readable
                                         before the pass.)

Usage: python3 make_item_sheets.py --seed <SECRET>   (seed is never committed)
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CURATION_ROOT = HERE.parent
REPO_ROOT = CURATION_ROOT.parent.parent.parent.parent
sys.path.insert(0, str(CURATION_ROOT / "tools"))
from gate_lib import World  # noqa: E402

# Hand-authored planted errors (the quality controls). `truth` goes ONLY to
# the gitignored key file.
PLANTED = [
    {
        "pid": "plant-1",
        "item": "WORD: 買 — reading mài — gloss: to buy",
        "truth": "wrong tone: 買 is mǎi (mai3), not mài (mai4)",
    },
    {
        "pid": "plant-2",
        "item": "FUNCTION WORD: 他[不]是老師。 — claimed reading of 不 in this sentence: bù",
        "truth": "wrong sandhi surface: 不 before 是 (4th tone) is bú (bu2)",
    },
    {
        "pid": "plant-3",
        "item": "SENTENCE: 我喝了茶。 — segmentation 我|喝|了|茶 — readings: wǒ hē liǎo chá",
        "truth": "wrong particle reading: perfective 了 after 喝 is le, not liǎo",
    },
    {
        "pid": "plant-4",
        "item": "WORD: 老師 — reading lǎoshì — gloss: teacher",
        "truth": "wrong tone: 師 is shī (shi1), so 老師 is lǎoshī",
    },
]

_TONE = {"1": "̄", "2": "́", "3": "̌", "4": "̀", "5": ""}
_VOWELS = "aoeiuv"


def marks(tone3: str) -> str:
    """tone3 → tone-mark display (small stdlib version, v → ü)."""
    import unicodedata

    if not tone3:
        return tone3
    tone = tone3[-1] if tone3[-1].isdigit() else "5"
    base = tone3[:-1] if tone3[-1].isdigit() else tone3
    base = base.replace("v", "ü")
    # mark placement: a/o/e first; else last vowel
    for target in ("a", "o", "e"):
        if target in base:
            idx = base.index(target)
            break
    else:
        idx = max(base.rfind(v) for v in "iuü")
    if idx < 0:
        return base
    combined = base[: idx + 1] + _TONE[tone] + base[idx + 1 :]
    return unicodedata.normalize("NFC", combined)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed", required=True, help="SECRET shuffle seed — never commit it")
    args = ap.parse_args()

    world = World()
    rows: list[dict] = []

    for t in world.tuples_doc["tuples"]:
        reading = " ".join(marks(s) for s in t["citationPinyin"])
        surface = " ".join(marks(s) for s in t["surfacePinyin"])
        extra = f" (pronounced {surface} in context)" if surface != reading else ""
        rows.append(
            {
                "itemId": f"tuple:{t['readingId']}",
                "item": f"WORD: {t['word']} — reading {reading}{extra} — gloss: {t['gloss']}",
            }
        )

    carriers = {c["contextKey"]: c["text"] for c in world.carriers}
    for e in world.table_doc["entries"]:
        key = f"{e['char']}|{e['prev']}|{e['next']}"
        text = carriers.get(key, "")
        marked = text.replace(e["char"], f"[{e['char']}]", 1)
        rows.append(
            {
                "itemId": f"context:{key}",
                "item": (
                    f"FUNCTION WORD: {marked} — claimed reading of {e['char']} in this "
                    f"sentence: {marks(e['surface'])}"
                ),
            }
        )

    for s in world.corpus["sentences"]:
        expected = world.expected_readings(s["text"])
        if expected is None:
            reading = "nǐ hǎo (greeting; displayed ní hǎo)"
        else:
            # display_reading applies the sidecar's own cross-word pairwise
            # 3-3 -> 2-3 shift on top of the per-unit pinned surfaces (e.g.
            # 很+好 -> hen2 hao3), so raters see the same phonologically real
            # form a deployed turn actually renders — not a bare per-word
            # citation join that would read as a tone error to a native ear.
            # (The explanatory note display_reading also returns is an
            # LLM-jury-only crutch — human native raters need no gloss.)
            shifted_reading, _note = world.display_reading(expected)
            reading = " ".join(marks(syl) for syl in shifted_reading.split(" "))
        rows.append(
            {
                "itemId": f"sentence:{s['id']}",
                "item": f"SENTENCE: {s['text']} — segmentation {'|'.join(s['cut'])} — readings: {reading}",
            }
        )

    for p in PLANTED:
        rows.append({"itemId": p["pid"], "item": p["item"]})

    rng = random.Random(args.seed)
    rng.shuffle(rows)
    key_map = {}
    out_rows = []
    for i, r in enumerate(rows, 1):
        rid = f"row-{i:03d}"
        key_map[rid] = r["itemId"]
        out_rows.append({"row_id": rid, "item": r["item"], "verdict": "", "correction": ""})

    sheet = HERE / "item-sheet.csv"
    with sheet.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["row_id", "item", "verdict", "correction"])
        w.writeheader()
        w.writerows(out_rows)

    key_dir = REPO_ROOT / "tmp" / "docs"
    key_dir.mkdir(parents=True, exist_ok=True)
    key_path = key_dir / "zh-goldpass-answer-key.json"
    key_path.write_text(
        json.dumps(
            {
                "$doc": "GITIGNORED gold-pass answer key (issue #20 AC7) — row→item mapping + planted-error truths. Never commit.",
                "rowToItem": key_map,
                "planted": {p["pid"]: p["truth"] for p in PLANTED},
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        "utf-8",
    )
    print(f"wrote {sheet} ({len(out_rows)} rows, {len(PLANTED)} planted)")
    print(f"wrote {key_path} (gitignored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
