"""zh verification sidecar v0 — deterministic legs only (issue #19).

Implements the shared OpenAPI verification-sidecar contract
(src/packages/contract/sidecar/openapi.yaml) for Traditional Chinese, per
docs/decisions/language-module-architecture.md → "Amendment — dual-instance
walking skeleton" Decision 1: closed-world exact-cover segmentation,
CC-CEDICT/Unihan citation-membership, the C3 context-pinned head-set lookup,
the rule-based sandhi resolver, the normalized jieba vote, the 兩/二 numeral
rule, and the intent cross-check. Every failure path is FAIL-CLOSED
(regenerate / RED — never display a doubtful byte). No neural inference:
torch/transformers/g2pW/HanLP/OpenCC/pkuseg are excluded by construction and
their appearance is a regression (CI image gate).
"""
