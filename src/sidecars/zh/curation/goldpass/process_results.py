#!/usr/bin/env python3
"""Process gold-pass rater responses (issue #20 AC7) — stdlib-only.

Input:  a CSV export with columns  rater_id, row_id, verdict, correction
        (one row per rater × item; 3 raters per item per the protocol).
Reads:  the gitignored answer key (tmp/docs/zh-goldpass-answer-key.json).
Writes: tmp/docs/zh-goldpass-report.md — per-item verdicts, the
        rater-quality report (planted-error hits, pairwise agreement), and
        the AC7 provenance-record TEMPLATE whose filled-in version is what
        gets committed (the report itself stays out of git until reviewed).

Usage:  python3 process_results.py responses.csv
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent.parent.parent.parent
KEY_PATH = REPO_ROOT / "tmp" / "docs" / "zh-goldpass-answer-key.json"
REPORT_PATH = REPO_ROOT / "tmp" / "docs" / "zh-goldpass-report.md"

PASS_VERDICTS = {"是", "yes", "correct", "pass"}
FAIL_VERDICTS = {"否", "no", "wrong", "fail"}


def kappa(pairs: list[tuple[bool, bool]]) -> float:
    """Cohen's kappa for two raters over shared boolean judgments."""
    if not pairs:
        return float("nan")
    n = len(pairs)
    po = sum(1 for a, b in pairs if a == b) / n
    pa_yes = sum(1 for a, _ in pairs if a) / n
    pb_yes = sum(1 for _, b in pairs if b) / n
    pe = pa_yes * pb_yes + (1 - pa_yes) * (1 - pb_yes)
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__)
        return 2
    key = json.loads(KEY_PATH.read_text("utf-8"))
    row_to_item = key["rowToItem"]
    planted = key["planted"]

    by_item: dict[str, list[dict]] = defaultdict(list)
    by_rater: dict[str, dict[str, bool]] = defaultdict(dict)
    with open(argv[0], newline="", encoding="utf-8") as f:
        for rec in csv.DictReader(f):
            rid = rec["row_id"].strip()
            verdict_raw = rec["verdict"].strip().lower()
            ok = rec["verdict"].strip() in PASS_VERDICTS or verdict_raw in PASS_VERDICTS
            item = row_to_item.get(rid, rid)
            by_item[item].append(
                {"rater": rec["rater_id"], "ok": ok, "correction": rec.get("correction", "").strip()}
            )
            by_rater[rec["rater_id"]][rid] = ok

    # --- rater quality: planted errors + pairwise kappa ---
    planted_rows = {rid for rid, item in row_to_item.items() if item in planted}
    rater_report = []
    excluded: set[str] = set()
    for rater, answers in sorted(by_rater.items()):
        missed = [rid for rid in planted_rows if answers.get(rid) is True]
        kappas = []
        for other, o_answers in by_rater.items():
            if other == rater:
                continue
            shared = [rid for rid in answers if rid in o_answers]
            if len(shared) >= 10:
                kappas.append(kappa([(answers[r], o_answers[r]) for r in shared]))
        mean_k = sum(kappas) / len(kappas) if kappas else float("nan")
        bad = bool(missed) or (kappas and mean_k < 0.6)
        if bad:
            excluded.add(rater)
        rater_report.append(
            f"| {rater} | {len(answers)} | {len(missed)} planted missed | κ̄={mean_k:.2f} | "
            f"{'EXCLUDE + re-collect' if bad else 'ok'} |"
        )

    # --- per-item verdicts (excluding bad raters) ---
    lines_fail, n_pass, n_flag = [], 0, 0
    for item, votes in sorted(by_item.items()):
        if item in planted:
            continue
        good = [v for v in votes if v["rater"] not in excluded]
        yes = sum(1 for v in good if v["ok"])
        if len(good) < 3:
            lines_fail.append(f"| {item} | INCOMPLETE ({len(good)}/3 usable) | re-collect |")
        elif yes == 3:
            n_pass += 1
        elif yes == 2:
            n_flag += 1
            notes = "; ".join(v["correction"] for v in good if not v["ok"] and v["correction"])
            lines_fail.append(f"| {item} | 2/3 — flagged | {notes} |")
        else:
            notes = "; ".join(v["correction"] for v in good if not v["ok"] and v["correction"])
            lines_fail.append(f"| {item} | FAIL ({yes}/3) — fix or drop, re-run machine gate | {notes} |")

    report = [
        "# Gold-pass results report (issue #20 AC7) — GENERATED, review before acting",
        "",
        f"Items unanimous-pass: {n_pass}; flagged 2/3: {n_flag}; failing/incomplete: {len(lines_fail) - n_flag}",
        "",
        "## Findings (act on every row: fix/drop + re-run the machine gate, or adjudicate)",
        "",
        "| item | verdict | rater notes |",
        "| --- | --- | --- |",
        *(lines_fail or ["| (none) | — | — |"]),
        "",
        "## Rater quality",
        "",
        "| rater | judgments | planted | agreement | action |",
        "| --- | --- | --- | --- | --- |",
        *rater_report,
        "",
        "## AC7 provenance-record TEMPLATE (fill + commit; see goldpass/README.md)",
        "",
        "```markdown",
        "### Native-checker gold pass — provenance record (#20 AC7)",
        "- Platform: Prolific (study id: <fill>; screener study id: <fill>)",
        "- Checker qualification: native Mandarin, Traditional-literate,",
        "  screener 5/5 (pass rate: <fill>%)",
        "- Raters: <N> (3 per item; <n> excluded by quality gate and re-collected)",
        "- Coverage: full sliver (58 tuples) + C9 enumeration (267 contexts) +",
        "  curation corpus (55 sentences); ≥3 planted-error controls",
        "- Dates: <fill>   Cost: <fill> (epic cost note: <link>)",
        "- Outcome: <n> unanimous, <n> flagged-reviewed, <n> corrected/dropped",
        "  (fixes recorded in <commit/PR>); machine gate re-run: <link/commit>",
        "```",
    ]
    REPORT_PATH.write_text("\n".join(report) + "\n", "utf-8")
    print(f"wrote {REPORT_PATH}")
    print(f"unanimous: {n_pass}, flagged: {n_flag}, other findings: {len(lines_fail) - n_flag}, excluded raters: {sorted(excluded)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
