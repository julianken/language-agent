#!/usr/bin/env python3
"""Build the baked sliver lexicon from `@la/lang-zh/assets` (stdlib-only).

The zh sidecar's runtime tables are BUILD-GENERATED from the language
module's assets — never hand-edited — so that when #20 replaces the curation
stub wholesale, the committed artifact goes stale and CI's freshness gate
(`python3 src/sidecars/zh/scripts/build_lexicon.py && git diff --exit-code --
src/sidecars/zh/data/lexicon.json`) forces a rebuild against the real asset
(issue #19 AC; mirrors the shared-spec codegen freshness gates).

Deterministic on purpose: stable key order, sorted words, no timestamps.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SIDECAR_ROOT.parent.parent.parent
ASSETS_DIR = REPO_ROOT / "src" / "packages" / "lang-zh" / "assets"
OUT_PATH = SIDECAR_ROOT / "data" / "lexicon.json"


def build() -> dict:
    tuples_doc = json.loads((ASSETS_DIR / "seed-tuples.json").read_text("utf-8"))
    table_doc = json.loads((ASSETS_DIR / "c9-context-table.json").read_text("utf-8"))
    norm_doc = json.loads((ASSETS_DIR / "segmenter-normalization.json").read_text("utf-8"))

    words: dict[str, dict] = {}
    for t in sorted(tuples_doc["tuples"], key=lambda t: t["word"]):
        word = t["word"]
        if word in words:
            raise SystemExit(
                f"heteronym-policy violation: surface form {word!r} carries two sliver reading_ids"
            )
        words[word] = {
            "readingId": t["readingId"],
            "citationPinyin": t["citationPinyin"],
            "surfacePinyin": t["surfacePinyin"],
            "pos": t["pos"],
            "senseId": t["senseId"],
            "gloss": t["gloss"],
            "intentBearing": t["intentBearing"],
        }

    entries = sorted(
        (
            {
                "char": e["char"],
                "prev": e["prev"],
                "next": e["next"],
                "base": e["base"],
                "surface": e["surface"],
                **({"rule": e["rule"]} if "rule" in e else {}),
            }
            for e in table_doc["entries"]
        ),
        key=lambda e: (e["char"], e["prev"], e["next"]),
    )

    singles = list(table_doc["singles"])
    overlap = sorted(set(singles) & set(words))
    if overlap:
        raise SystemExit(
            f"C3 singles must not also be sliver words (one unit, one admission path): {overlap}"
        )

    return {
        "generatedBy": "src/sidecars/zh/scripts/build_lexicon.py — DO NOT EDIT; edit src/packages/lang-zh/assets/ and rebuild",
        "provenance": tuples_doc["provenance"],
        "words": words,
        "singles": singles,
        "contextEntries": entries,
        "segmenterNormalization": {
            k: norm_doc["mappings"][k] for k in sorted(norm_doc["mappings"])
        },
        "variantMap": {
            k: tuples_doc["variantMap"][k] for k in sorted(tuples_doc["variantMap"])
        },
    }


def main() -> int:
    payload = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
