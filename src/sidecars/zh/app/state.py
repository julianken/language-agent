"""Data tables + readiness state.

Everything the gate consults hot is loaded from the baked data directory at
startup — CC-CEDICT extract, Unihan kMandarin extract, the build-generated
sliver lexicon (words + C3 singles + C9-style context entries + segmenter
normalization + variant map) — plus the jieba voter's prefix dictionary.
`/readyz` reports 200 only once every table below is loaded (honest
readiness, ADR §3.3); the warmup is seconds-scale (no model load).

Fully offline: nothing here touches the network. The data directory is baked
into the image; jieba's dictionary ships inside its PyPI package.
"""

from __future__ import annotations

import json
import threading
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from .pinyin import norm_syllable

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Readiness check ids — opaque implementation-owned strings (spec: same
# discipline as legId; the engine may log them, never branch on them).
READINESS_CHECKS = (
    "sliver-lexicon",
    "cedict-extract",
    "unihan-kmandarin",
    "c9-context-table",
    "segmenter-voter",
)

START = "<START>"
END = "<END>"


@dataclass
class Tables:
    """The loaded closed-world tables."""

    words: dict[str, dict]  # word -> lexicon tuple (citation/surface tone3, pos, sense…)
    singles: frozenset[str]  # C3: the v0 sliver function-word subset
    context: dict[tuple[str, str, str], dict]  # (char, prev, next) -> entry
    normalization: dict[str, list[str]]  # jieba segment -> AS-standard units
    variant_map: dict[str, str]  # variant glyph -> MOE-canonical glyph
    cedict: dict[str, list[list[str]]]  # traditional -> list of readings (tone3 seqs)
    char_candidates: dict[str, set[str]]  # char -> candidate citation syllables (tone3)
    closed_chars: frozenset[str] = field(default_factory=frozenset)
    max_unit_len: int = 1

    @property
    def units(self) -> set[str]:
        return set(self.words) | set(self.singles)


def _load_lexicon(data_dir: Path) -> tuple[dict, frozenset, dict, dict, dict]:
    doc = json.loads((data_dir / "lexicon.json").read_text("utf-8"))
    words = {}
    for word, t in doc["words"].items():
        words[unicodedata.normalize("NFC", word)] = {
            **t,
            "citationPinyin": [norm_syllable(s) for s in t["citationPinyin"]],
            "surfacePinyin": [norm_syllable(s) for s in t["surfacePinyin"]],
        }
    singles = frozenset(unicodedata.normalize("NFC", s) for s in doc["singles"])
    context = {}
    for e in doc["contextEntries"]:
        key = (e["char"], e["prev"], e["next"])
        context[key] = {
            **e,
            "base": norm_syllable(e["base"]),
            "surface": norm_syllable(e["surface"]),
        }
    normalization = {k: list(v) for k, v in doc["segmenterNormalization"].items()}
    variant_map = dict(doc["variantMap"])
    return words, singles, context, normalization, variant_map


def load_tables(data_dir: Path | None = None) -> Tables:
    data_dir = data_dir or DEFAULT_DATA_DIR

    words, singles, context, normalization, variant_map = _load_lexicon(data_dir)

    cedict_doc = json.loads((data_dir / "cedict-extract.json").read_text("utf-8"))
    cedict: dict[str, list[list[str]]] = {}
    for entry in cedict_doc["entries"]:
        trad = unicodedata.normalize("NFC", entry["traditional"])
        cedict.setdefault(trad, []).append([norm_syllable(s) for s in entry["pinyin"]])

    unihan_doc = json.loads((data_dir / "unihan-kmandarin.json").read_text("utf-8"))
    char_candidates: dict[str, set[str]] = {}
    for char, info in unihan_doc["characters"].items():
        char = unicodedata.normalize("NFC", char)
        char_candidates.setdefault(char, set()).update(
            norm_syllable(r) for r in info["kMandarin"]
        )
    # Per-position CC-CEDICT syllables widen the per-character candidate set
    # (kMandarin lists one predominant reading; CEDICT carries the rest —
    # e.g. 的 de5/di1/di2/di4).
    for trad, readings in cedict.items():
        for reading in readings:
            if len(reading) != len(trad):
                continue  # non 1:1 (erhua-fused etc.) — not candidate data
            for char, syl in zip(trad, reading):
                char_candidates.setdefault(char, set()).add(syl)

    closed_chars = frozenset(c for u in (set(words) | set(singles)) for c in u)
    max_unit_len = max((len(u) for u in (set(words) | set(singles))), default=1)

    return Tables(
        words=words,
        singles=singles,
        context=context,
        normalization=normalization,
        variant_map=variant_map,
        cedict=cedict,
        char_candidates=char_candidates,
        closed_chars=closed_chars,
        max_unit_len=max_unit_len,
    )


class SidecarState:
    """Warmup + readiness. `/readyz` is the honest conjunction of the checks."""

    def __init__(self, data_dir: Path | None = None, voter=None) -> None:
        self.data_dir = data_dir or DEFAULT_DATA_DIR
        self.checks: dict[str, bool] = {c: False for c in READINESS_CHECKS}
        self.detail: dict[str, str] = {}
        self.ready_event = threading.Event()
        self.tables: Tables | None = None
        self.voter = voter  # injectable for tests; default jieba built in warmup
        self.gate = None

    def warmup(self) -> None:
        """Load every table; mark readiness only when ALL are servable."""
        try:
            tables = load_tables(self.data_dir)
            # The loader reads all four table files together; the per-check
            # flags flip as each structure is verified non-empty.
            self.checks["sliver-lexicon"] = bool(tables.words)
            self.checks["cedict-extract"] = bool(tables.cedict)
            self.checks["unihan-kmandarin"] = bool(tables.char_candidates)
            self.checks["c9-context-table"] = bool(tables.singles)
            self.tables = tables

            if self.voter is None:
                self.voter = _build_jieba_voter(tables)
            self.checks["segmenter-voter"] = True

            from .gate import VerifyGate  # late import: gate needs tables

            self.gate = VerifyGate(tables, self.voter)
            self.ready_event.set()
        except Exception as exc:  # pragma: no cover - defensive
            # Fail closed: never report ready; record the failure detail.
            for check, ok in self.checks.items():
                if not ok:
                    self.detail[check] = f"load failed: {exc}"
            raise

    @property
    def ready(self) -> bool:
        return self.ready_event.is_set() and all(self.checks.values())


def _build_jieba_voter(tables: Tables):
    """The jieba voter: deterministic dictionary cut (HMM disabled), sliver
    words registered so the voter can see the closed world's units."""
    import jieba

    tokenizer = jieba.Tokenizer()
    tokenizer.initialize()
    for word in sorted(tables.units):
        tokenizer.add_word(word)

    def cut(text: str) -> list[str]:
        return list(tokenizer.cut(text, HMM=False))

    return cut
