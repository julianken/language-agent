/**
 * Unit test for the Arabic word token's romanized-reading sub-label (the
 * `translit` training wheel, DESIGN.md §Components → Tokens): a mono LTR
 * romanization stacked UNDER a new/learning word, receding to bare on a
 * known word — mirroring the gentle blend of canonical Figma frame `77:2`.
 *
 * Rendered through `renderToStaticMarkup` (same server-render path the
 * portable-stories suite uses), importing the real `ArWordToken` from the
 * pack's public `/react` subpath — never a pack internal.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArWordToken, type RenderedToken } from "@la/lang-ar/react";
import { computeCssVars } from "../../tokens/applyTokens.js";

const DIAC = "سُوق";

function arWord(
  patch: Partial<RenderedToken> & { status: string },
  translit?: string,
): RenderedToken {
  return {
    id: "w",
    text: DIAC,
    lang: "ar",
    kind: "word",
    band: "GREEN",
    annotations: {
      diac: DIAC,
      skeleton: "سوق",
      vowelState: "full",
      morphology: {
        lemma: DIAC,
        root: "س و ق",
        pattern: "فُعْل",
        pos: "NOUN",
        gloss: "market",
      },
      ...(translit !== undefined ? { translit } : {}),
    },
    directive: {
      fadeLevels: [
        { dim: "vowelFadeLexical", unit: { kind: "lemma", id: "سُوق#market" }, level: "full" },
        { dim: "vowelFadeCaseEnding", unit: { kind: "lemma", id: "سُوق#market" }, level: "full" },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    },
    ...patch,
  };
}

const render = (tok: RenderedToken): string =>
  renderToStaticMarkup(<ArWordToken token={tok} emitLearningEvent={() => undefined} />);

describe("ArWordToken — transliteration sub-label", () => {
  const vars = computeCssVars();

  it("stacks a mono LTR romanization under a NEW word, as a sibling of the bidi isolate", () => {
    const html = render(arWord({ status: "new" }, "sūq"));
    expect(html).toContain("sūq");
    // The romanization is its OWN dir="ltr" box, immediately AFTER the word's
    // <bdi> closes — never a child of the Arabic bidi isolate.
    expect(html).toMatch(/<\/bdi><span dir="ltr"[^>]*data-translit="w"/);
    expect(html.indexOf("sūq")).toBeGreaterThan(html.indexOf("</bdi>"));
    // The word itself keeps its <bdi dir="auto"> isolation.
    expect(html).toContain('<bdi dir="auto"');
  });

  it("shows the romanization for a LEARNING word too", () => {
    const html = render(arWord({ status: "learning" }, "sūq"));
    expect(html).toContain('data-translit="w"');
    expect(html).toContain("sūq");
  });

  it("renders a KNOWN word bare — no romanization even when annotated", () => {
    const html = render(arWord({ status: "known" }, "sūq"));
    expect(html).not.toContain("data-translit");
    expect(html).not.toContain("sūq");
  });

  it("omits the sub-label when the annotation carries no translit", () => {
    const html = render(arWord({ status: "new" }));
    expect(html).not.toContain("data-translit");
  });

  it("still withholds RED content, showing no romanization", () => {
    const html = render(arWord({ status: "new", band: "RED" }, "sūq"));
    expect(html).toContain("•••");
    expect(html).not.toContain("sūq");
    expect(html).not.toContain("data-translit");
  });

  it("binds the sub-label to tokens.json custom properties — no raw hex", () => {
    const html = render(arWord({ status: "new" }, "sūq"));
    expect(html).toContain("var(--la-color-muted-soft)");
    expect(html).toContain("var(--la-font-mono)");
    expect(html).toContain("var(--la-type-annotation-size)");
    // Every --la-* the markup references is defined by the tokens.json bridge.
    const used = [...html.matchAll(/var\((--la-[a-z0-9-]+)\)/g)].map((m) => m[1] as string);
    for (const name of used) {
      expect(vars[name], `undefined custom property ${name}`).toBeDefined();
    }
    // No raw hex anywhere in the rendered token (DESIGN.md §0).
    expect(html).not.toContain("#");
  });
});
