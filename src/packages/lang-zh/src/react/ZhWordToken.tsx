/**
 * The Chinese word/single-kind token — mono-ruby PER CHARACTER (the
 * Latent-C gating unit, design §3.1/§3.2), LTR, no bidi isolation (design
 * §8.1: the RTL subsystem is deleted, not disabled — zh carries no bidi
 * hazard, so unlike `@la/lang-ar`'s `<bdi>` wrapper this component uses a
 * plain `<span>`).
 *
 * Hard rendering requirements this component implements (design §3.1–3.6,
 * §8, amended-issue §7):
 *  - **Ruby is per CHARACTER, not per token** — each `<ruby>` unit wraps
 *    one base character (or, for the one sanctioned erhua-fusion case,
 *    two) with the SURFACE-layer syllable in `<rt>` (never citation —
 *    display always uses the sandhi-resolved surface layer, §3.2/§3.3).
 *  - **Erhua fuses into the preceding syllable's ruby** — handled by
 *    `ruby.ts`'s `buildRubySlots`, which folds a fused slot into its base
 *    character's `<rb>` rather than giving 兒 its own `<rt>`.
 *  - **The meaning-blend base-text swap is NOT this component's job** —
 *    `anglicizeDown` (seam 2) already produces a separate `{kind:
 *    "english", text: gloss}` stream segment for an anglicized word BEFORE
 *    this component ever renders; the shared `EnglishScaffoldToken`
 *    (`src/apps/web/src/packs/EnglishScaffoldToken.tsx`) renders that
 *    segment. This component only ever renders the TARGET (non-anglicized)
 *    Traditional-Chinese case, matching `@la/lang-ar/src/react/
 *    ArWordToken.tsx`'s ANGLICIZED-vs-target split at the stream level.
 *  - **Fade is opacity, never `display:none`** (§8.3) — a faded ruby's
 *    `<rt>` stays in the DOM at `opacity: 0`, reserving its layout height.
 *  - **The tone cue** — early state = diacritic-on-letter surface pinyin
 *    in the ruby (the default `<rt>` rendering, since `surfacePinyin`
 *    already carries tone marks); late state (segmental pinyin faded,
 *    tone retained) = a character-borne cue painted on the base glyph
 *    itself (color + a redundant contour/underline-style distinction —
 *    never color alone), structurally distinct from the ruby, per §3.5.
 *
 * Styling: status washes + flags bind to tokens.json semantic tokens via
 * `--la-*` custom properties — never raw hex (DESIGN.md §0), mirrors
 * `@la/lang-ar/src/react/ArWordToken.tsx`.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ZhAnnotationsSchema, type ZhAnnotations } from "../annotations.js";
import { ZhBreakdownPanel } from "./ZhBreakdownPanel.js";
import { buildRubySlots, renderRubyText, renderedScaffoldEcho, unitRefsFrom, withSegmentalLevels, type RubySlot } from "./ruby.js";
import type { TokenRendererProps } from "./renderer-types.js";

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

/**
 * The late-state character-borne tone cue (design §3.5/§8.6): a dual
 * encoding of color + a redundant contour (underline STYLE, never color
 * alone) so it survives colorblind simulation without a dedicated
 * five-color palette — bound entirely through existing `--la-*` semantic
 * custom properties (no raw hex, no new design-token surface added by
 * this pack). Tone 5 (neutral) gets the lightest, no-underline treatment.
 */
const TONE_CUE: Record<number, CSSProperties> = {
  1: { textDecorationLine: "underline", textDecorationStyle: "solid", textDecorationColor: "var(--la-color-ink)" },
  2: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: "var(--la-color-confidence-uncertain)",
  },
  3: {
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    textDecorationColor: "var(--la-color-correction-remove)",
  },
  4: { textDecorationLine: "underline", textDecorationStyle: "double", textDecorationColor: "var(--la-color-muted)" },
  5: { textDecorationLine: "none" },
};

function toneCueStyle(slot: RubySlot): CSSProperties {
  // The tone cue is a LATE state: it only paints once the segmental ruby
  // has faded (design §3.5 — "the late tone-kept-longest state cannot
  // live on the <rt>… that state migrates to a character-borne cue").
  if (slot.segmentalLevel !== "faded" || slot.tone === undefined) return {};
  return TONE_CUE[slot.tone] ?? {};
}

function RubyUnit({ slot }: { slot: RubySlot }) {
  const rt = renderRubyText(slot);
  return (
    <ruby>
      <span style={toneCueStyle(slot)}>{slot.baseChars}</span>
      {/* Reserved-band, opacity-only fade (§8.3) — the <rt> box stays in
       * the DOM at every fade level so breathing causes zero reflow. */}
      <rt style={{ opacity: rt === undefined ? 0 : 1 }}>{rt ?? slot.surfaceSyllable ?? ""}</rt>
    </ruby>
  );
}

export function ZhWordToken({ token, emitLearningEvent }: TokenRendererProps) {
  const [open, setOpen] = useState(false);

  const parsed = ZhAnnotationsSchema.safeParse(token.annotations);
  const ann: ZhAnnotations | undefined = parsed.success ? parsed.data : undefined;

  // RED = refused by the gate — the content is withheld, never displayed
  // (ADR §1.5's scoped RED law); the token stays addressable.
  if (token.band === "RED") {
    return (
      <span
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
      </span>
    );
  }

  const slots = ann ? withSegmentalLevels(buildRubySlots(ann), token.directive) : [];

  const onActivate = () => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      emitLearningEvent({
        tokenRef: token.id,
        unitRefs: unitRefsFrom(token.directive),
        renderedScaffold: renderedScaffoldEcho(token.directive),
        payload: {
          schemaId: "zh-events/v1",
          action: "breakdown-open",
          readingId: ann?.readingId ?? token.text,
        },
      });
    }
  };

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
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
        {slots.length > 0 ? slots.map((slot, i) => <RubyUnit key={`${slot.baseChars}-${i}`} slot={slot} />) : token.text}
      </span>
      {open && <ZhBreakdownPanel annotations={ann} surface={token.text} onClose={() => setOpen(false)} />}
    </span>
  );
}

/** Non-linguistic passthrough: punctuation, digits, RED-collapsed
 * candidate spans, and any unrecognized kind. Full-width punctuation
 * renders VERBATIM and is non-clickable (design §8.7); Western digits
 * pass through untouched, also non-clickable, no ruby. */
export function ZhPunctToken({ token }: TokenRendererProps) {
  if (token.band === "RED") {
    return (
      <span data-token-id={token.id} data-band="RED" style={{ color: "var(--la-color-correction-remove)" }}>
        {token.text}
      </span>
    );
  }
  return (
    <span data-token-id={token.id} style={{ color: "var(--la-color-ink)" }}>
      {token.text}
    </span>
  );
}
