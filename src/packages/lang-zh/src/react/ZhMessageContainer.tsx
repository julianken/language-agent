/**
 * The Chinese pack container — direction is decided HERE, inside the pack,
 * never by the shared shell (dual-instance amendment: the shell sets no
 * global `dir` and owns no direction assumptions). zh is LTR — the RTL
 * subsystem does not exist on this path at all (design §8.1: "removed,
 * not disabled"); no `<bdi>` bidi isolation anywhere in this entrant,
 * structurally, because there is no bidi hazard to isolate against.
 *
 * Type: `subject-reading-lg` — the conversation-spine hero (DESIGN.md §0 /
 * `tokens.json`: 27px, LOCALE leading — 1.6 for zh, the ruby-band
 * clearance, vs 1.95 for ar's ḥarakāt clearance — exercising the Tier-3
 * locale delta). `--la-font-subject-family` and `--la-locale-subject-leading`
 * are LOCALE-generic custom properties that already resolve to "Noto Serif TC"
 * / 1.6 under the zh Locale mode (`tokens.json` confirmed).
 */

import type { ReactNode } from "react";
import "./fonts.js";

export function ZhMessageContainer({ children }: { children?: ReactNode }) {
  return (
    <div
      dir="ltr"
      lang="zh-Hant"
      data-pack-container="zh"
      style={{
        fontFamily: 'var(--la-font-subject-family), "Noto Serif TC", serif',
        fontSize: "var(--la-type-subject-reading-lg-size)",
        lineHeight: "var(--la-locale-subject-leading)",
        fontWeight: 400,
        color: "var(--la-color-ink)",
        textAlign: "start",
      }}
    >
      {children}
    </div>
  );
}
