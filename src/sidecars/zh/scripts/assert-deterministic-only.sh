#!/usr/bin/env bash
# The torch-free regression gate (issue #19 AC): torch, transformers, g2pW,
# g2pM/g2pC, HanLP, OpenCC and pkuseg must be ABSENT from the built zh
# sidecar image — their appearance is a regression BY CONSTRUCTION
# (dual-instance amendment, Decision 1: neural legs run at curation time
# only, in #20's curation-toolchain container, never deployed).
#
# Two belts: (1) importability inside the image; (2) the pip distribution
# list. Usage: assert-deterministic-only.sh <image>
set -euo pipefail

IMAGE="${1:?usage: assert-deterministic-only.sh <image>}"

# NB: `python -c`, not a stdin heredoc — `docker run` without -i reads EOF
# from stdin and would silently "pass" an empty script.
docker run --rm --entrypoint python "$IMAGE" -c '
import importlib.util
import sys

banned = [
    "torch", "transformers",
    "g2pw", "g2pW", "g2pM", "g2pm", "g2pc", "g2pC",
    "hanlp", "opencc", "OpenCC", "pkuseg",
]
found = sorted({m for m in banned if importlib.util.find_spec(m) is not None})
if found:
    print(f"REGRESSION: neural/conversion modules importable in the image: {found}")
    sys.exit(1)
print(f"import gate passed: none of {banned} importable")
'

if docker run --rm --entrypoint pip "$IMAGE" list --format=freeze \
  | grep -Ei '^(torch|torchvision|torchaudio|transformers|g2pw|g2pm|g2pc|hanlp|opencc|opencc-python-reimplemented|pkuseg)=='; then
  echo "REGRESSION: banned distribution present in the image's pip list"
  exit 1
fi
echo "pip-list gate passed: no banned distributions"
