/**
 * The root/pattern breakdown panel — pack UI (ADR §1.3 port 6). The ONLY
 * floating element in the system (DESIGN.md §Elevation: the click-word
 * popover is the single soft-card shadow tier). Composed inside
 * `ArWordToken`; the shell never renders it directly.
 *
 * Every color/space/radius/shadow value binds to a tokens.json semantic
 * custom property (`--la-*`, set by the app's token bridge) — no raw hex
 * here (DESIGN.md §0 rule).
 */

import type { CSSProperties } from "react";
import type { ArMorphology } from "../annotations.js";

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

const arabicValueStyle: CSSProperties = {
  fontFamily: 'var(--la-font-subject-family), "Scheherazade New", "Noto Naskh Arabic", serif',
  fontSize: "var(--la-type-subject-token-size)",
  lineHeight: 1.9,
  color: "var(--la-color-ink)",
};

export interface ArBreakdownPanelProps {
  morphology: ArMorphology | undefined;
  surface: string;
  onClose: () => void;
}

export function ArBreakdownPanel({ morphology, surface, onClose }: ArBreakdownPanelProps) {
  return (
    <span role="dialog" aria-label="word breakdown" data-breakdown-panel="ar" dir="ltr" style={panelStyle}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <bdi dir="auto" style={arabicValueStyle}>
          {morphology?.lemma ?? surface}
        </bdi>
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
      {morphology ? (
        <span style={{ display: "block", marginTop: "var(--la-space-xxs)" }}>
          <span style={{ display: "block" }} data-breakdown-root>
            <span style={labelStyle}>root</span>
            <bdi dir="auto" style={arabicValueStyle}>{morphology.root}</bdi>
          </span>
          <span style={{ display: "block" }} data-breakdown-pattern>
            <span style={labelStyle}>pattern</span>
            <bdi dir="auto" style={arabicValueStyle}>{morphology.pattern}</bdi>
          </span>
          <span style={{ display: "block" }} data-breakdown-gloss>
            <span style={labelStyle}>gloss</span>
            <span style={{ color: "var(--la-color-body)" }}>{morphology.gloss}</span>
            <span
              style={{
                marginInlineStart: "var(--la-space-xs)",
                color: "var(--la-color-muted)",
                fontSize: "var(--la-type-ui-label-size)",
              }}
            >
              {morphology.pos}
            </span>
          </span>
        </span>
      ) : (
        <span style={{ display: "block", color: "var(--la-color-muted)" }} data-breakdown-gloss>
          no analysis available
        </span>
      )}
    </span>
  );
}
