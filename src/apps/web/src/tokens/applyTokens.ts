/**
 * The tokens.json → CSS custom-property bridge. Repo-root `tokens.json`
 * (the machine mirror of DESIGN.md §0 — W3C DTCG, three tiers) is the ONLY
 * color/size/motion source: components bind to the `--la-*` custom
 * properties emitted here and never carry a raw hex (DESIGN.md §0 rule;
 * spot-checked by the portable-stories suite, which cross-references every
 * `var(--la-…)` a component renders against this bridge).
 *
 * Deliberately NOT emitted: `locale.direction`. tokens.json marks it
 * "structural — NOT a Figma variable; handled by components" (ADR §1.4):
 * text direction is a pack-container concern, and surfacing it as a global
 * CSS variable would invite exactly the shell-level direction coupling the
 * dual-instance amendment forbids.
 */

import tokens from "../../../../../tokens.json" with { type: "json" };

type TokenTree = Record<string, unknown>;

const doc = tokens as unknown as TokenTree;

function nodeAt(path: string): TokenTree {
  let cur: unknown = doc;
  for (const part of path.split(".")) {
    if (typeof cur !== "object" || cur === null) {
      throw new Error(`tokens.json: path '${path}' does not resolve`);
    }
    cur = (cur as TokenTree)[part];
  }
  if (typeof cur !== "object" || cur === null) {
    throw new Error(`tokens.json: path '${path}' is not a token node`);
  }
  return cur as TokenTree;
}

/** Resolve a token leaf: follow `{a.b.c}` alias references to a literal. */
function resolve(value: unknown): unknown {
  if (typeof value === "string") {
    const ref = /^\{(.+)\}$/.exec(value);
    if (ref?.[1] !== undefined) {
      return resolve(nodeAt(ref[1])["$value"]);
    }
  }
  return value;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function groupEntries(path: string): Array<[string, TokenTree]> {
  return Object.entries(nodeAt(path)).filter(
    (e): e is [string, TokenTree] =>
      !e[0].startsWith("$") && typeof e[1] === "object" && e[1] !== null,
  );
}

/** Pure: the full custom-property map (testable without a DOM). */
export function computeCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [name, node] of groupEntries("semantic.color")) {
    vars[`--la-color-${name}`] = String(resolve(node["$value"]));
  }
  for (const [name, node] of groupEntries("primitive.space")) {
    vars[`--la-space-${name}`] = String(resolve(node["$value"]));
  }
  for (const [name, node] of groupEntries("primitive.radius")) {
    vars[`--la-radius-${name}`] = String(resolve(node["$value"]));
  }
  for (const [name, node] of groupEntries("primitive.duration")) {
    vars[`--la-duration-${name}`] = String(resolve(node["$value"]));
  }
  for (const [name, node] of groupEntries("primitive.easing")) {
    const bezier = resolve(node["$value"]) as number[];
    vars[`--la-ease-${name}`] = `cubic-bezier(${bezier.join(", ")})`;
  }

  const shadow = resolve(nodeAt("primitive.shadow.soft-card")["$value"]) as {
    color: string;
    alpha: number;
    offsetX: string;
    offsetY: string;
    blur: string;
    spread: string;
  };
  const [r, g, b] = hexToRgb(shadow.color);
  vars["--la-shadow-soft-card"] =
    `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ` +
    `rgba(${r}, ${g}, ${b}, ${shadow.alpha})`;

  const ui = String(resolve(nodeAt("primitive.font-family.ui")["$value"]));
  const mono = String(resolve(nodeAt("primitive.font-family.mono")["$value"]));
  const subject = String(resolve(nodeAt("locale.font.subject-family")["$value"]));
  const annotation = String(
    resolve(nodeAt("locale.font.annotation-family")["$value"]),
  );
  vars["--la-font-ui"] = `"${ui}", system-ui, sans-serif`;
  vars["--la-font-mono"] = `"${mono}", monospace`;
  vars["--la-font-subject-family"] = `"${subject}"`;
  vars["--la-font-annotation-family"] = `"${annotation}", monospace`;

  vars["--la-locale-subject-leading"] = String(
    resolve(nodeAt("locale.subject-leading")["$value"]),
  );

  for (const [name, node] of groupEntries("semantic.typography")) {
    const style = node["$value"] as TokenTree;
    vars[`--la-type-${name}-size`] = String(resolve(style["fontSize"]));
    vars[`--la-type-${name}-weight`] = String(resolve(style["fontWeight"]));
    vars[`--la-type-${name}-line-height`] = String(resolve(style["lineHeight"]));
  }

  return vars;
}

/** Apply the bridge to an element (the app calls this on `:root` before
 * the first render). */
export function applyDesignTokens(el: HTMLElement): void {
  for (const [name, value] of Object.entries(computeCssVars())) {
    el.style.setProperty(name, value);
  }
}
