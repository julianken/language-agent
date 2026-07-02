"""Gate leg 2 — calima-msa-r13 analyzer membership (data-dependent).

Wraps the CAMeL Tools morphology analyzer over the calima-msa-r13 database
baked into the image at build time (`camel_data -i morphology-db-msa-r13`,
CAMELTOOLS_DATA set → fully offline at runtime). Backoff is explicitly
NONE: an empty analysis set is the load-bearing NO_ANALYSIS signal (bands
the token RED — never a silent pass), not something to paper over with
guessed analyses.

Analyses are cached per bare skeleton (research §6: deterministic hot-path
checks are cheap and cached; the verified tuples amortize as vocabulary
stabilizes).
"""

from __future__ import annotations

import time
from functools import lru_cache

from camel_tools.morphology.analyzer import Analyzer
from camel_tools.morphology.database import MorphologyDB

from app.contractmeta import MORPHOLOGY_DB

# The ADR's cold-load probe word (hosting ADR measured 8 analyses for it —
# the byte-identical-gate-results check the prune list was validated with).
_WARMUP_WORD = "كتب"


class MorphAnalyzer:
    """Loads the DB eagerly; construction time IS the analyzer cold load."""

    def __init__(self) -> None:
        t0 = time.monotonic()
        db = MorphologyDB.builtin_db(MORPHOLOGY_DB)
        self._analyzer = Analyzer(db, "NONE")
        # Include the first analyze() in the measured load, mirroring the
        # hosting ADR's probe (import + builtin_db + Analyzer + first
        # analyze).
        self.warmup_analysis_count = len(self._analyzer.analyze(_WARMUP_WORD))
        self.load_seconds = time.monotonic() - t0
        self._cached = lru_cache(maxsize=8192)(self._analyze)

    def _analyze(self, skeleton: str) -> tuple[dict, ...]:
        return tuple(self._analyzer.analyze(skeleton))

    def analyze(self, skeleton: str) -> tuple[dict, ...]:
        """All legal (diac, lex, gloss, pos, …) tuples for a bare skeleton.

        Returned dicts are shared via the cache — treat them as read-only.
        """
        return self._cached(skeleton)
