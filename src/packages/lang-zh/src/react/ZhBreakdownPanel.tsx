/**
 * The click-breakdown panel — pack UI (ADR §1.3 port 6). The ONLY floating
 * element in the system (DESIGN.md §Elevation: the click-word popover is
 * the single soft-card shadow tier). Composed inside `ZhWordToken`; the
 * shell never renders it directly. Mirrors `@la/lang-ar/src/react/
 * ArBreakdownPanel.tsx` structurally; LTR (no `<bdi>` — zh carries no bidi
 * hazard, design §8.1).
 *
 * Per-CHARACTER breakdown rows (design §7.1/§8.2: the click-breakdown
 * shows citation-pinyin per word AND per character): each `perCharacter[]`
 * entry gets its own row with the CITATION reading (never surface — the
 * breakdown/accounting path is always citation, design §3.2/§3.3), with
 * the per-character gloss suppressed when `compositionalBoundFlag` is set
 * (design §6.8: transliteration/bound morphemes like 葡萄/沙發 — a
 * standalone per-character gloss would teach a fake meaning).
 */

import type { CSSProperties } from "react";
import type { ZhAnnotations } from "../annotations.js";

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  insetInlineStart: 0,
  zIndex: 10,
  minWidth: "240px",
  background: "var(--la-color-surface-card)",
  border: "1px solid var(--la-color-hairline)",
  borderRadius: "var(--la-radius-md)",
  boxShadow: "var(--la-shadow-soft-card)",
  padding: "var(--la-space-sm) var(--la-space-base)",
  fontFamily: "var(--la-font-ui)",
  fontSize: "var(--la-type-ui-body-size)",
  lineHeight: 1.55,
  color: "var(--la-color-body)",
  textAlign: "start",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--la-font-ui)",
  fontSize: "var(--la-type-ui-label-size)",
  fontWeight: 600,
  letterSpacing: "0.4px",
  textTransform: "uppercase",
  color: "var(--la-color-muted)",
  marginInlineEnd: "var(--la-space-xs)",
};

const hanValueStyle: CSSProperties = {
  fontFamily: 'var(--la-font-subject-family), "Noto Serif TC", serif',
  fontSize: "var(--la-type-subject-token-size)",
  lineHeight: 1.6,
  color: "var(--la-color-ink)",
};

export interface ZhBreakdownPanelProps {
  annotations: ZhAnnotations | undefined;
  surface: string;
  onClose: () => void;
}

export function ZhBreakdownPanel({ annotations, surface, onClose }: ZhBreakdownPanelProps) {
  return (
    <span role="dialog" aria-label="word breakdown" data-breakdown-panel="zh" dir="ltr" style={panelStyle}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={hanValueStyle}>{surface}</span>
        <button
          type="button"
          aria-label="close breakdown"
          onClick={onClose}
          style={{
            border: "none",
            background: "var(--la-color-surface-strong)",
            borderRadius: "var(--la-radius-pill)",
            color: "var(--la-color-muted)",
            cursor: "pointer",
            fontFamily: "var(--la-font-ui)",
            fontSize: "var(--la-type-ui-label-size)",
            padding: "0 var(--la-space-xs)",
          }}
        >
          ×
        </button>
      </span>
      {annotations && annotations.perCharacter.length > 0 ? (
        <span style={{ display: "block", marginTop: "var(--la-space-xxs)" }}>
          {annotations.perCharacter.map((c, i) => (
            <span key={`${c.char}-${i}`} style={{ display: "block" }} data-breakdown-character={c.char}>
              <span style={labelStyle}>{c.char}</span>
              <span style={hanValueStyle}>{c.citationPinyinChar}</span>
              {!c.compositionalBoundFlag && annotations.gloss !== undefined && annotations.perCharacter.length === 1 ? (
                <span style={{ marginInlineStart: "var(--la-space-xs)", color: "var(--la-color-body)" }}>
                  {annotations.gloss}
                </span>
              ) : null}
            </span>
          ))}
          {annotations.gloss !== undefined && annotations.perCharacter.length > 1 ? (
            <span style={{ display: "block" }} data-breakdown-gloss>
              <span style={labelStyle}>gloss</span>
              <span style={{ color: "var(--la-color-body)" }}>{annotations.gloss}</span>
              {annotations.pos !== undefined ? (
                <span
                  style={{
                    marginInlineStart: "var(--la-space-xs)",
                    color: "var(--la-color-muted)",
                    fontSize: "var(--la-type-ui-label-size)",
                  }}
                >
                  {annotations.pos}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : (
        <span style={{ display: "block", color: "var(--la-color-muted)" }} data-breakdown-gloss>
          no analysis available
        </span>
      )}
    </span>
  );
}
