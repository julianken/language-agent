/**
 * The Arabic pack container — direction is decided HERE, inside the pack,
 * never by the shared shell (dual-instance amendment: the shell sets no
 * global `dir` and owns no direction assumptions; RTL-vs-LTR is exclusively
 * a pack-container concern, the code mirror of the design ADR's
 * modes-vs-swapped-components split).
 *
 * BASE DIRECTION FOLLOWS BLEND MATURITY. The message's blend ratio picks the
 * spine's base direction: while the blend is English-dominant (ratio < 0.5,
 * the gentle-blend beginner state of canonical Figma frame `77:2`) the base
 * flows LTR, with each Arabic word an RTL island inside it (the per-word
 * `<bdi dir="auto">` in `ArWordToken` does the isolating). Once the blend is
 * Arabic-dominant (ratio ≥ 0.5, or when no blend is present) the base is RTL
 * — the mature conversation-spine state (DESIGN.md §App shell). Both states
 * are real; direction is not a fixed property of the ar instance.
 *
 * Type: `arabic-reading-lg` — the conversation-spine hero (DESIGN.md §0:
 * 27px / 1.95; Amiri primary, Scheherazade New / Noto Naskh Arabic
 * fallback-only per the spike verdict). Values bind through the tokens.json
 * custom-property bridge; the ≥1.85 leading rule is the system's single
 * most important typographic rule (ḥarakāt clearance).
 */

import type { ReactNode } from "react";
import "./fonts.js";

/** Read the blend ratio off the OPAQUE blend envelope the shell forwards
 * (`WireMessageMeta.blend`, structurally `{ ratio: number; … }`). Kept as a
 * narrowing guard rather than a hard cast so a missing/malformed envelope
 * degrades safely to `undefined` (→ RTL default, today's behavior). */
function blendRatio(blend: unknown): number | undefined {
  if (typeof blend === "object" && blend !== null && "ratio" in blend) {
    const ratio = (blend as { ratio?: unknown }).ratio;
    if (typeof ratio === "number") return ratio;
  }
  return undefined;
}

export function ArMessageContainer({
  children,
  blend,
}: {
  children?: ReactNode;
  blend?: unknown;
}) {
  // English-dominant → the base reads LTR (Figma 77:2 beginner state);
  // Arabic-dominant or blend-absent → RTL (the mature spine, DESIGN.md).
  const dir = (blendRatio(blend) ?? 1) < 0.5 ? "ltr" : "rtl";
  return (
    <div
      dir={dir}
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
