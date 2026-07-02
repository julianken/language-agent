/**
 * The Arabic word token — `<bdi dir="auto">` per token, the merged spike's
 * recommended recipe (docs/research/rtl-rendering-spike.md → "Recommended
 * markup recipe for #10"): native HTML bidi isolation with NO invisible
 * control characters injected into `textContent`, so copy/round-trip
 * consumers see the canonical form. Explicit isolates (U+2067 RLI / U+2068
 * FSI closed by U+2069 PDI — never U+2066 LRI) are reserved for the
 * ambiguous-first-character fallback the spike names; see
 * `ambiguousFirstIsolate` below.
 *
 * Interprets the two Arabic vowel fade dimensions per unit (`harakat.ts`);
 * clicking opens the root/pattern breakdown panel — pack UI producing a
 * pack payload on the shared learning-event spine, with the
 * `renderedScaffold` echo of what the learner actually saw (ADR §1.4).
 *
 * Styling: status washes + flags bind to tokens.json semantic tokens via
 * `--la-*` custom properties — never raw hex (DESIGN.md §0).
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ArAnnotationsSchema, type ArAnnotations } from "../annotations.js";
import { ArBreakdownPanel } from "./ArBreakdownPanel.js";
import {
  renderVowels,
  renderedScaffoldEcho,
  unitRefsFrom,
  vowelLevelsFrom,
} from "./harakat.js";
import type { TokenRendererProps } from "./renderer-types.js";

/** U+2067 RIGHT-TO-LEFT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE — the
 * spike's fallback for a token whose FIRST STRONG CHARACTER is ambiguous or
 * LTR (leading Latin fragment, Eastern Arabic-Indic numerals). NEVER
 * U+2066 (LRI, the LTR isolate — wrong for an Arabic token). */
export function ambiguousFirstIsolate(text: string): string {
  return `\u2067${text}\u2069`;
}

/** First-strong-character probe: does `dir="auto"` resolve this token RTL
 * on its own? Arabic letters + Arabic marks are strong/combining RTL;
 * anything else leading (Latin, digits, neutrals) steers the heuristic
 * wrong and needs the explicit isolate. */
const LEADS_RTL = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

const STATUS_WASH: Record<string, string> = {
  new: "var(--la-color-status-new-bg)",
  learning: "var(--la-color-status-learning-bg)",
};

function tokenStyle(status: string | undefined, band: string | undefined): CSSProperties {
  const style: CSSProperties = {
    color: "var(--la-color-ink)",
    borderRadius: "var(--la-radius-xs)",
    padding: "0 2px",
    cursor: "pointer",
  };
  const wash = status ? STATUS_WASH[status] : undefined;
  if (wash) style.backgroundColor = wash;
  if (band === "YELLOW") {
    // The verifier "uncertain" flag (DESIGN.md §0 `confidence-uncertain`).
    style.textDecorationLine = "underline";
    style.textDecorationStyle = "dotted";
    style.textDecorationColor = "var(--la-color-confidence-uncertain)";
    style.textDecorationThickness = "2px";
    style.textUnderlineOffset = "6px";
  }
  return style;
}

export function ArWordToken({ token, emitLearningEvent }: TokenRendererProps) {
  const [open, setOpen] = useState(false);

  const parsed = ArAnnotationsSchema.safeParse(token.annotations);
  const ann: ArAnnotations | undefined = parsed.success ? parsed.data : undefined;
  const levels = vowelLevelsFrom(token.directive);

  // RED = refused by the gate — the content is withheld, never displayed
  // (ADR §1.5's scoped RED law); the token stays addressable.
  if (token.band === "RED") {
    return (
      <bdi
        dir="auto"
        data-token-id={token.id}
        data-band="RED"
        title="withheld by the verification gate"
        style={{
          color: "var(--la-color-correction-remove)",
          border: "1px dashed var(--la-color-correction-remove)",
          borderRadius: "var(--la-radius-xs)",
          padding: "0 6px",
        }}
      >
        •••
      </bdi>
    );
  }

  const display = ann ? renderVowels(ann.diac, levels) : token.text;
  const isolated = LEADS_RTL.test(display) ? display : ambiguousFirstIsolate(display);

  const onActivate = () => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      emitLearningEvent({
        tokenRef: token.id,
        unitRefs: unitRefsFrom(token.directive),
        renderedScaffold: renderedScaffoldEcho(token.directive),
        payload: {
          schemaId: "ar-events/v1",
          action: "breakdown-open",
          lemma: ann?.morphology.lemma ?? token.text,
        },
      });
    }
  };

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <bdi
        dir="auto"
        data-token-id={token.id}
        data-band={token.band}
        data-status={token.status}
        {...(token.spanGroup !== undefined ? { "data-span-group": token.spanGroup } : {})}
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
        style={tokenStyle(token.status, token.band)}
      >
        {isolated}
      </bdi>
      {open && (
        <ArBreakdownPanel
          morphology={ann?.morphology}
          surface={token.text}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/** Punctuation / non-interactive token: same bidi isolation, no wash, no
 * panel — still individually addressable by id. */
export function ArPunctToken({ token }: TokenRendererProps) {
  return (
    <bdi dir="auto" data-token-id={token.id} style={{ color: "var(--la-color-ink)" }}>
      {token.text}
    </bdi>
  );
}
