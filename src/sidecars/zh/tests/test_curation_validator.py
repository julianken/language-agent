"""The #20 curation validator, exercised from the sidecar test run (stdlib —
no neural deps; the validator itself must be runnable in this environment).

Covers issue #20 AC5: the validator hard-fails (a) a fixture case with a
second `reading_id` on one surface form and (b) a fixture case with an
inconsistent per-character reading inside a multi-char tuple — both with the
ADR-verbatim heteronym policy in the failure text — and passes on the real
committed assets + recorded gate results.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
VALIDATOR = SIDECAR_ROOT / "curation" / "tools" / "validate_assets.py"

# The ADR's normative heteronym policy (dual-instance amendment, Decision 1)
# — byte-exact; AC2 requires it verbatim in the validator's failure text.
HETERONYM_POLICY = (
    "no surface form carries two sliver `reading_id`s; every non-sliver "
    "alternate CC-CEDICT reading of a sliver word is confirmed "
    "closed-world-unreachable at curation (machine-checked injectivity + "
    "reviewed unreachability); head-set singles admitted per C3/C9."
)


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), *args], capture_output=True, text=True
    )


def test_validator_passes_on_committed_assets_and_gate_results():
    proc = _run()
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "curation validator: PASS" in proc.stdout
    assert "all GREEN under the legs run to date" in proc.stdout


def test_validator_selftest_hard_fails_both_ac5_fixture_classes():
    proc = _run("--selftest")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "second reading_id on one surface form → HARD FAIL" in proc.stdout
    assert "inconsistent per-character reading in multi-char tuple → HARD FAIL" in proc.stdout


def test_validator_module_carries_the_adr_verbatim_policy():
    # The committed policy constant and the shipped asset note both carry the
    # ADR's normative wording byte-exactly.
    sys.path.insert(0, str(SIDECAR_ROOT / "curation" / "tools"))
    import build_assets  # noqa: PLC0415

    assert build_assets.HETERONYM_POLICY == HETERONYM_POLICY
    import json

    tuples_doc = json.loads(
        (SIDECAR_ROOT.parent.parent / "packages" / "lang-zh" / "assets" / "seed-tuples.json")
        .read_text("utf-8")
    )
    assert HETERONYM_POLICY in tuples_doc["note"]
