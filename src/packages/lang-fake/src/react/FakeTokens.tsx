/**
 * The fake pack's renderer components — the SECOND, real registry entrant
 * (not a passthrough; issue #10 / ADR §5.2 #10): it renders the MAX
 * topology the contract claims to support, which is exactly what proves
 * the structural swap the `(lang, kind)` registry exists for:
 *
 *   - per-glyph hint scaffolds driven by PER-UNIT `glyphHint` fade levels
 *     (the zh segmental-pinyin analog): one token can show a hint over one
 *     glyph and none over its mastered neighbor — the split-fade state;
 *   - a `meaning` gloss scaffold on the word unit;
 *   - discontinuous span-group linking (`spanGroup` — ADR §1.3 port 1);
 *   - deterministic YELLOW (confidence flag) and RED (withheld) states.
 *
 * NOT `<ruby>`: ruby annotation markup is zh-only (ADR §4.2 — "ruby present
 * only in zh"); the fake's hints are plain stacked spans. Direction (LTR)
 * is decided here, in the pack container — never by the shared shell.
 *
 * All colors bind to tokens.json semantic custom properties (`--la-*`).
 */

import type { CSSProperties, ReactNode } from "react";
import type { FadeLevel } from "@la/contract";
import { FakeAnnSchema, type FakeAnn } from "../annotations.js";
import type { TokenRendererProps } from "./renderer-types.js";

export function FakeMessageContainer({ children }: { children?: ReactNode }) {
  return (
    <div
      dir="ltr"
      lang="und"
      data-pack-container="fake"
      style={{
        fontFamily: "var(--la-font-ui)",
        fontSize: "var(--la-type-subject-reading-md-size)",
        lineHeight: "var(--la-type-subject-reading-md-line-height)",
        color: "var(--la-color-ink)",
        textAlign: "start",
      }}
    >
      {children}
    </div>
  );
}

const STATUS_WASH: Record<string, string> = {
  new: "var(--la-color-status-new-bg)",
  learning: "var(--la-color-status-learning-bg)",
};

function levelFor(
  token: TokenRendererProps["token"],
  dim: string,
  unitId: string,
): FadeLevel {
  return (
    token.directive?.fadeLevels.find(
      (f) => f.dim === dim && f.unit.id === unitId,
    )?.level ?? "full"
  );
}

function echoFrom(token: TokenRendererProps["token"]): Record<string, "shown" | "hidden"> {
  const echo: Record<string, "shown" | "hidden"> = {};
  for (const f of token.directive?.fadeLevels ?? []) {
    const visible = f.level !== "faded";
    echo[f.dim] = visible || echo[f.dim] === "shown" ? "shown" : "hidden";
  }
  return echo;
}

const hintStyle = (level: FadeLevel): CSSProperties => ({
  fontFamily: "var(--la-font-mono)",
  fontSize: "var(--la-type-annotation-size)",
  lineHeight: 1.1,
  color:
    level === "partial" ? "var(--la-color-muted-soft)" : "var(--la-color-muted)",
  visibility: level === "faded" ? "hidden" : "visible",
});

export function FakeWordToken({ token, emitLearningEvent }: TokenRendererProps) {
  // RED = withheld (ADR §1.5's scoped RED law): addressable, content hidden.
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

  const parsed = FakeAnnSchema.safeParse(token.annotations);
  const ann: FakeAnn | undefined = parsed.success ? parsed.data : undefined;
  const meaningLevel = ann ? levelFor(token, "meaning", ann.lexemeId) : "faded";

  const onActivate = () => {
    emitLearningEvent({
      tokenRef: token.id,
      unitRefs: (token.directive?.fadeLevels ?? []).map((f) => f.unit),
      renderedScaffold: echoFrom(token),
      payload: { schemaId: "fake-events/v1", dimension: "meaning" },
    });
  };

  const wrapStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "flex-end",
    gap: "1px",
    borderRadius: "var(--la-radius-xs)",
    padding: "0 2px",
    cursor: "pointer",
    color: "var(--la-color-ink)",
  };
  const wash = token.status ? STATUS_WASH[token.status] : undefined;
  if (wash) wrapStyle.backgroundColor = wash;
  if (token.spanGroup !== undefined) {
    // Discontinuous learnable unit: linked halves share a gold underline.
    wrapStyle.boxShadow = "inset 0 -2px var(--la-color-accent-gold)";
  }
  if (token.band === "YELLOW") {
    wrapStyle.outline = "2px dotted var(--la-color-confidence-uncertain)";
    wrapStyle.outlineOffset = "1px";
  }

  return (
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
      style={wrapStyle}
    >
      {(ann?.glyphs ?? [...token.text].map((g) => ({ glyph: g, hint: "" }))).map(
        (g, i) => {
          const level = ann ? levelFor(token, "glyphHint", g.glyph) : "faded";
          return (
            <span
              key={`${token.id}-g${i}`}
              data-glyph-unit={g.glyph}
              data-hint-level={level}
              style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}
            >
              <span data-glyph-hint style={hintStyle(level)}>
                {g.hint || "·"}
              </span>
              <span>{g.glyph}</span>
            </span>
          );
        },
      )}
      {meaningLevel !== "faded" && ann?.gloss ? (
        <span
          data-meaning-gloss
          style={{
            fontFamily: "var(--la-font-ui)",
            fontSize: "var(--la-type-ui-label-size)",
            color:
              meaningLevel === "partial"
                ? "var(--la-color-muted-soft)"
                : "var(--la-color-muted)",
            marginInlineStart: "var(--la-space-xxs)",
            alignSelf: "flex-start",
          }}
        >
          {ann.gloss}
        </span>
      ) : null}
    </span>
  );
}
