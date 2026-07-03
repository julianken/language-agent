/**
 * Amiri 400 — the DESIGN.md §0 primary Arabic reading face — PINNED and
 * VENDORED via `@fontsource/amiri@5.2.8` (exact pin, no range). Rationale:
 * PR #24's review noted the spike's measured ḥarakāt-clipping deltas are
 * font-version-dependent (the spike page loaded unpinned webfonts), so this
 * pack ships its own font version and the e2e suite re-checks clipping at
 * `arabic-reading-lg` against exactly this build. The Scheherazade New /
 * Noto Naskh Arabic fallbacks stay declarative in the font stack (spike
 * verdict: fallback-only, not primary, at line-height 1.95).
 */
import "@fontsource/amiri/400.css";
