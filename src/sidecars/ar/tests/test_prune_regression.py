"""The hosting-ADR prune list is a regression gate, not a one-time diet.

docs/decisions/hosting-walking-skeleton.md: the deterministic gate needs
none of the ~4.9 GB ML stack camel-tools pulls transitively; the pruned
image passes identical gate probes. "Treat a torch reappearance in the
image as a regression." CI runs this inside the built image; the separate
CI prune step re-asserts it against the runtime target too.
"""

from __future__ import annotations

import importlib.metadata
import importlib.util

import pytest

_PRUNED_IMPORTS = ["torch", "triton", "transformers", "sympy", "sklearn", "pandas"]


@pytest.mark.parametrize("module_name", _PRUNED_IMPORTS)
def test_pruned_module_not_importable(module_name: str) -> None:
    assert importlib.util.find_spec(module_name) is None, (
        f"{module_name} reappeared in the image — hosting-ADR prune regression"
    )


def test_no_nvidia_distributions_installed() -> None:
    nvidia = sorted(
        name
        for dist in importlib.metadata.distributions()
        if (name := (dist.metadata["Name"] or "").lower()).startswith("nvidia")
    )
    assert nvidia == [], f"nvidia distributions reappeared: {nvidia}"
