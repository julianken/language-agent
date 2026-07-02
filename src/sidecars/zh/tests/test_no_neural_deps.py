"""Torch-free regression AC (environment half).

Issue #19: torch, transformers, g2pW, g2pM/g2pC, HanLP, OpenCC and pkuseg
are excluded BY CONSTRUCTION — their appearance is a regression, not a
judgment call. This test pins the sidecar's dependency environment; the
built-image half is scripts/assert-deterministic-only.sh (run in CI against
the actual image).
"""

from __future__ import annotations

import importlib.util

import pytest

BANNED_MODULES = [
    "torch",
    "transformers",
    "g2pw",
    "g2pW",
    "g2pM",
    "g2pm",
    "g2pc",
    "g2pC",
    "hanlp",
    "opencc",
    "OpenCC",
    "pkuseg",
]


@pytest.mark.parametrize("module", BANNED_MODULES)
def test_neural_and_conversion_deps_absent(module):
    assert importlib.util.find_spec(module) is None, (
        f"{module} is importable in the zh sidecar environment — this is a "
        "REGRESSION by construction (dual-instance amendment, Decision 1): "
        "neural legs run at curation time only, in #20's curation-toolchain "
        "container, never deployed."
    )


def test_requirements_pin_only_deterministic_deps():
    from pathlib import Path

    requirement_lines = [
        line.strip().lower()
        for line in (Path(__file__).resolve().parent.parent / "requirements.txt")
        .read_text("utf-8")
        .splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    for banned in ("torch", "transformers", "g2p", "hanlp", "opencc", "pkuseg"):
        for line in requirement_lines:
            assert not line.startswith(banned), line
