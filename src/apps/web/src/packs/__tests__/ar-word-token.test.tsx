/**
 * Unit test for the reading-pedagogy binding law (DESIGN.md §Components →
 * "Reading pedagogy — the binding law"): the conversation is a conversation,
 * NOT a lesson. The reading line teaches nothing inline — a token renders as
 * SCRIPT ONLY (its wash + its own fading ḥarakāt), with NO inline
 * romanization and NO inline gloss. A word's romanized pronunciation and
 * meaning surface only on click, in the `ArBreakdownPanel` popover.
 *
 * These tests pin both halves: (1) `ArWordToken` never emits an inline
 * romanization sub-label for any status; (2) `ArBreakdownPanel` is the one
 * place the romanization appears — its click-revealed pronunciation row.
 *
 * Rendered through `renderToStaticMarkup` (same server-render path the
 * portable-stories suite uses), importing the real components from the
 * pack's public `/react` subpath — never a pack internal.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArBreakdownPanel, ArWordToken, type RenderedToken } from "@la/lang-ar/react";
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

const renderToken = (tok: RenderedToken): string =>
  renderToStaticMarkup(<ArWordToken token={tok} emitLearningEvent={() => undefined} />);

/** Every romanization/gloss trace the reading line must NOT contain. */
function expectNoInlineTranslation(html: string): void {
  // No romanization sub-label box (either its data hook or its Latin lang tag).
  expect(html).not.toContain("data-translit");
  expect(html).not.toContain('lang="ar-Latn"');
  // No romanization or gloss text bled into the line.
  expect(html).not.toContain("sūq");
  expect(html).not.toContain("market");
}

describe("ArWordToken — reading line is script only (no inline romanization/gloss)", () => {
  it("renders a NEW word as script only — no inline romanization even when annotated", () => {
    const html = renderToken(arWord({ status: "new" }, "sūq"));
    // The word itself keeps its <bdi dir="auto"> isolation and native script.
    expect(html).toContain('<bdi dir="auto"');
    expect(html).toContain(DIAC.charAt(0)); // the Arabic script is present
    expectNoInlineTranslation(html);
  });

  it("renders a LEARNING word as script only — no inline romanization", () => {
    const html = renderToken(arWord({ status: "learning" }, "sūq"));
    expect(html).toContain('<bdi dir="auto"');
    expectNoInlineTranslation(html);
  });

  it("renders a KNOWN word bare — no romanization", () => {
    const html = renderToken(arWord({ status: "known" }, "sūq"));
    expectNoInlineTranslation(html);
  });

  it("still withholds RED content, showing no romanization", () => {
    const html = renderToken(arWord({ status: "new", band: "RED" }, "sūq"));
    expect(html).toContain("•••");
    expectNoInlineTranslation(html);
  });
});

const morphology = {
  lemma: DIAC,
  root: "س و ق",
  pattern: "فُعْل",
  pos: "NOUN",
  gloss: "market",
};

const renderPanel = (translit?: string): string =>
  renderToStaticMarkup(
    <ArBreakdownPanel
      morphology={morphology}
      surface={DIAC}
      {...(translit !== undefined ? { translit } : {})}
      onClose={() => undefined}
    />,
  );

describe("ArBreakdownPanel — the click card is the only place romanization appears", () => {
  const vars = computeCssVars();

  it("shows a pronunciation row carrying the romanization when opened", () => {
    const html = renderPanel("sūq");
    expect(html).toContain("data-breakdown-pronunciation");
    expect(html).toContain("sūq");
    // The romanization rides in its own LTR / ar-Latn box inside the card.
    expect(html).toContain('lang="ar-Latn"');
    // Styled with the DESIGN.md `transliteration` type tokens.
    expect(html).toContain("var(--la-font-mono)");
    expect(html).toContain("var(--la-type-annotation-size)");
    expect(html).toContain("var(--la-color-muted-soft)");
  });

  it("omits the pronunciation row when no translit is present", () => {
    const html = renderPanel(undefined);
    expect(html).not.toContain("data-breakdown-pronunciation");
    expect(html).not.toContain("sūq");
    // The gloss row still renders (the panel remains useful without a romanization).
    expect(html).toContain("data-breakdown-gloss");
  });

  it("binds every value to tokens.json custom properties — no raw hex", () => {
    const html = renderPanel("sūq");
    const used = [...html.matchAll(/var\((--la-[a-z0-9-]+)\)/g)].map((m) => m[1] as string);
    for (const name of used) {
      expect(vars[name], `undefined custom property ${name}`).toBeDefined();
    }
    expect(html).not.toContain("#");
  });
});
