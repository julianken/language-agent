"""The hosting-ADR cold-load probe, shipped in the image.

Replicates docs/decisions/hosting-walking-skeleton.md's measurement
(import + `builtin_db()` + `Analyzer` + first `analyze()`) so the ADR
consistency check — and #11's probe sizing — can be re-run against any
built image with:

    docker run --rm --network none language-agent/sidecar-ar:dev python -m app.probe

Reference numbers (the ADR's pruned single-layer image): 553 MB image,
~1.1 s analyzer-inclusive cold load, RSS ≈ 399 MB, 8 analyses for كتب.
A >2× deviation is an ADR-amendment finding, never silently accepted.
"""

from __future__ import annotations

import resource
import sys
import time


def main() -> int:
    t0 = time.monotonic()
    from camel_tools.morphology.analyzer import Analyzer
    from camel_tools.morphology.database import MorphologyDB

    from app.contractmeta import MORPHOLOGY_DB

    db = MorphologyDB.builtin_db(MORPHOLOGY_DB)
    analyzer = Analyzer(db, "NONE")
    analyses = analyzer.analyze("كتب")
    elapsed = time.monotonic() - t0

    # ru_maxrss is KiB on Linux (the deploy platform; on macOS it is bytes).
    rss_kib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    rss_mib = rss_kib / 1024 if sys.platform == "linux" else rss_kib / (1024 * 1024)

    print(f"analyzer-inclusive cold load: {elapsed:.2f}s")
    print(f"analyses for كتب: {len(analyses)} (ADR probe expects 8)")
    print(f"peak RSS: {rss_mib:.0f} MiB")
    return 0 if analyses else 1


if __name__ == "__main__":
    raise SystemExit(main())
