/**
 * The Arabic pack container — direction is decided HERE, inside the pack,
 * never by the shared shell (dual-instance amendment: the shell sets no
 * global `dir` and owns no direction assumptions; RTL-vs-LTR is exclusively
 * a pack-container concern, the code mirror of the design ADR's
 * modes-vs-swapped-components split).
 *
 * Type: `arabic-reading-lg` — the conversation-spine hero (DESIGN.md §0:
 * 27px / 1.95; Amiri primary, Scheherazade New / Noto Naskh Arabic
 * fallback-only per the spike verdict). Values bind through the tokens.json
 * custom-property bridge; the ≥1.85 leading rule is the system's single
 * most important typographic rule (ḥarakāt clearance).
 */

import type { ReactNode } from "react";
import "./fonts.js";

export function ArMessageContainer({ children }: { children?: ReactNode }) {
  return (
    <div
      dir="rtl"
      lang="ar"
      data-pack-container="ar"
      style={{
        fontFamily:
          'var(--la-font-subject-family), "Scheherazade New", "Noto Naskh Arabic", serif',
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
