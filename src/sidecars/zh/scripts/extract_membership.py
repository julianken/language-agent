#!/usr/bin/env python3
"""Regenerate the baked CC-CEDICT / Unihan membership extracts.

The zh sidecar bakes REAL dictionary data (issue #19: "CC-CEDICT (Traditional)
+ Unihan kMandarin extracts baked in"), kept as small as the closed world
allows: only the entries the sliver lexicon + C3 singles can reach. This
script derives those extracts from the full upstream dumps; the outputs are
COMMITTED (`src/sidecars/zh/data/cedict-extract.json`,
`src/sidecars/zh/data/unihan-kmandarin.json`) so CI and the image build never
fetch anything.

This is a MANUAL, network-adjacent tool (the dumps are downloaded by the
operator; ~10 MB, not committed) — it is NOT wired into CI. Re-run it whenever
the closed world grows (i.e. when `src/packages/lang-zh/assets/` changes the
reachable word/char set — #20's seed sliver will):

    curl -sL -o /tmp/cedict.txt.gz \
      'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
    gunzip -f /tmp/cedict.txt.gz
    curl -sL -o /tmp/Unihan.zip \
      'https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip'
    unzip -o -d /tmp /tmp/Unihan.zip Unihan_Readings.txt
    python3 src/sidecars/zh/scripts/extract_membership.py \
      --cedict /tmp/cedict.txt --unihan /tmp/Unihan_Readings.txt

Licenses (see src/sidecars/zh/data/NOTICE.md, shipped alongside the data):
CC-CEDICT is CC BY-SA 4.0 (published by MDBG); Unihan is © Unicode, Inc.,
under the Unicode Terms of Use.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SIDECAR_ROOT.parent.parent.parent
ASSETS_DIR = REPO_ROOT / "src" / "packages" / "lang-zh" / "assets"
DATA_DIR = SIDECAR_ROOT / "data"

CEDICT_LINE = re.compile(r"^(\S+) (\S+) \[([^\]]+)\] /(.+)/$")


def closed_world_units() -> tuple[list[str], list[str]]:
    """The reachable word units and characters, straight from the assets."""
    tuples = json.loads((ASSETS_DIR / "seed-tuples.json").read_text("utf-8"))
    table = json.loads((ASSETS_DIR / "c9-context-table.json").read_text("utf-8"))
    words = [t["word"] for t in tuples["tuples"]]
    singles = list(table["singles"])
    chars = sorted({c for w in words for c in w} | set(singles))
    # Word units to look up in CC-CEDICT: every sliver word, every C3 single,
    # and every individual character (per-character candidate syllables).
    units = sorted(set(words) | set(singles) | set(chars))
    return units, chars


def extract_cedict(cedict_path: Path, units: list[str]) -> dict:
    wanted = set(units)
    header_meta: dict[str, str] = {}
    entries: list[dict] = []
    for raw in cedict_path.read_text("utf-8").splitlines():
        if raw.startswith("#"):
            if raw.startswith("#!"):
                key, _, value = raw[2:].strip().partition("=")
                header_meta[key.strip()] = value.strip()
            continue
        m = CEDICT_LINE.match(raw)
        if not m:
            continue
        traditional, _simplified, pinyin, _gloss = m.groups()
        if traditional in wanted:
            entries.append(
                {
                    "traditional": traditional,
                    "pinyin": pinyin.split(" "),
                    "line": raw,
                }
            )
    return {
        "source": "CC-CEDICT (community-maintained free Chinese-English dictionary), published by MDBG",
        "sourceUrl": "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
        "license": "CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ (see NOTICE.md)",
        "modification": "subset extract: only entries whose Traditional field is a closed-world unit (sliver word, C3 single, or closed-world character); regenerate with scripts/extract_membership.py",
        "sourceMeta": header_meta,
        "entries": entries,
    }


def extract_unihan(unihan_path: Path, chars: list[str]) -> dict:
    cps = {f"U+{ord(c):04X}": c for c in chars}
    readings: dict[str, dict] = {}
    source_header: list[str] = []
    for raw in unihan_path.read_text("utf-8").splitlines():
        if raw.startswith("#"):
            if len(source_header) < 8:
                source_header.append(raw.lstrip("# ").rstrip())
            continue
        parts = raw.split("\t")
        if len(parts) != 3 or parts[1] != "kMandarin":
            continue
        cp, _, value = parts
        if cp in cps:
            # kMandarin: one or two space-separated readings (zh-Hans, zh-Hant).
            readings[cps[cp]] = {"codepoint": cp, "kMandarin": value.split(" ")}
    return {
        "source": "Unihan database (Unihan_Readings.txt, kMandarin field), Unicode Character Database",
        "sourceUrl": "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
        "license": "© Unicode, Inc. — Unicode Terms of Use, https://www.unicode.org/terms_of_use.html (see NOTICE.md)",
        "modification": "subset extract: kMandarin for the closed-world character set only; regenerate with scripts/extract_membership.py",
        "sourceHeader": source_header,
        "characters": readings,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cedict", type=Path, required=True, help="path to the full cedict_1_0_ts_utf-8_mdbg.txt dump")
    ap.add_argument("--unihan", type=Path, required=True, help="path to the full Unihan_Readings.txt")
    args = ap.parse_args()

    units, chars = closed_world_units()
    cedict = extract_cedict(args.cedict, units)
    unihan = extract_unihan(args.unihan, chars)

    missing_chars = [c for c in chars if c not in unihan["characters"]]
    if missing_chars:
        print(f"ERROR: no kMandarin for closed-world chars: {missing_chars}", file=sys.stderr)
        return 1
    covered = {e["traditional"] for e in cedict["entries"]}
    missing_words = [u for u in units if len(u) > 1 and u not in covered]
    if missing_words:
        print(f"ERROR: no CC-CEDICT entry for closed-world words: {missing_words}", file=sys.stderr)
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name, payload in (("cedict-extract.json", cedict), ("unihan-kmandarin.json", unihan)):
        out = DATA_DIR / name
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False) + "\n", "utf-8")
        print(f"wrote {out.relative_to(REPO_ROOT)} ({len(json.dumps(payload))} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
