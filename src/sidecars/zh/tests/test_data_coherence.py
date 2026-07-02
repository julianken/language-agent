"""Baked-data coherence: the committed lexicon matches the assets (the
same invariant CI's freshness gate enforces), the stub provenance marker is
present, and the heteronym policy holds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SIDECAR_ROOT.parent.parent.parent


def test_lexicon_is_fresh_against_assets():
    sys.path.insert(0, str(SIDECAR_ROOT / "scripts"))
    import build_lexicon

    built = build_lexicon.build()
    committed = json.loads((SIDECAR_ROOT / "data" / "lexicon.json").read_text("utf-8"))
    assert built == committed, (
        "src/sidecars/zh/data/lexicon.json is stale — run "
        "`python3 src/sidecars/zh/scripts/build_lexicon.py` (CI enforces this "
        "with git diff --exit-code; #20's asset replacement must rebuild)"
    )


def test_stub_provenance_is_declared():
    lexicon = json.loads((SIDECAR_ROOT / "data" / "lexicon.json").read_text("utf-8"))
    assert lexicon["provenance"] == "stub — replaced wholesale by #20"
    for asset in ("seed-tuples.json", "c9-context-table.json", "segmenter-normalization.json"):
        doc = json.loads(
            (REPO_ROOT / "src" / "packages" / "lang-zh" / "assets" / asset).read_text("utf-8")
        )
        assert doc["provenance"] == "stub — replaced wholesale by #20", asset


def test_heteronym_policy_no_double_reading_ids(tables):
    # No surface form carries two sliver reading_ids (normative wording,
    # dual-instance amendment Decision 1). The lexicon is word-keyed, so the
    # invariant is structural for words; ensure singles don't alias words.
    assert not (set(tables.singles) & set(tables.words))


def test_membership_extracts_cover_the_closed_world(tables):
    # Every closed-world char has a candidate set (the extract-time
    # completeness the extraction script also enforces).
    for char in tables.closed_chars:
        assert tables.char_candidates.get(char), f"no membership candidates for {char}"
    # Every sliver word's pinned citation is CC-CEDICT-contained — the stub
    # ships nothing the deterministic floor would refuse.
    for word, lex in tables.words.items():
        assert lex["citationPinyin"] in tables.cedict.get(word, []), word
