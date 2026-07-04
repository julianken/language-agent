/**
 * Unit test for BASE-DIRECTION-FOLLOWS-BLEND on the Arabic pack container
 * (canonical Figma frame `77:2`): the message's blend maturity picks the
 * conversation-spine's base direction — LTR while the blend is
 * English-dominant (ratio < 0.5, the gentle-blend beginner state), RTL once
 * Arabic-dominant, or when no blend is present (the mature spine, DESIGN.md
 * §App shell). Direction is exclusively a pack-container concern; the shell
 * only forwards the OPAQUE blend and never names a direction.
 *
 * Rendered through `renderToStaticMarkup`, importing the real
 * `ArMessageContainer` from the pack's public `/react` subpath. The final
 * case additionally routes through the REAL shell (`RendererRegistry` +
 * `TokenStream`) to prove the shell threads the opaque `blend` to the
 * container untouched.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArMessageContainer, arRendererEntry } from "@la/lang-ar/react";
import { RendererRegistry, TokenStream } from "../../shell/index.js";
import type { WireToken } from "../../shell/index.js";

const child = <span data-token-id="c0">سُوق</span>;

const renderContainer = (blend?: unknown): string =>
  renderToStaticMarkup(<ArMessageContainer blend={blend}>{child}</ArMessageContainer>);

describe("ArMessageContainer — base direction follows blend maturity", () => {
  it("reads LTR when the blend is English-dominant (ratio < 0.5) — Figma 77:2 beginner state", () => {
    const html = renderContainer({ ratio: 0.2 });
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('data-pack-container="ar"');
  });

  it("reads RTL when the blend is Arabic-dominant (ratio ≥ 0.5) — the mature spine", () => {
    expect(renderContainer({ ratio: 0.67 })).toContain('dir="rtl"');
  });

  it("holds the 0.5 boundary as RTL (English-dominant is strictly < 0.5)", () => {
    expect(renderContainer({ ratio: 0.5 })).toContain('dir="rtl"');
  });

  it("defaults to RTL when NO blend is present (unchanged behavior for ar-mixed-line and blend-less messages)", () => {
    expect(renderContainer(undefined)).toContain('dir="rtl"');
  });

  it("degrades safely to RTL on a malformed / ratio-less blend envelope", () => {
    expect(renderContainer({})).toContain('dir="rtl"');
    expect(renderContainer("nope")).toContain('dir="rtl"');
    // A non-numeric ratio is ignored (guard requires a real number).
    expect(renderContainer({ ratio: "0.2" })).toContain('dir="rtl"');
  });

  it("keeps lang=ar in both directions", () => {
    expect(renderContainer({ ratio: 0.2 })).toContain('lang="ar"');
    expect(renderContainer({ ratio: 0.9 })).toContain('lang="ar"');
  });

  it("threads through the real shell: TokenStream forwards the opaque blend so the ar container flips to LTR", () => {
    const registry = new RendererRegistry();
    registry.register(arRendererEntry);
    const tokens: WireToken[] = [
      { id: "t0", text: "Let's ease in —", lang: "en", kind: "text", status: "scaffold" },
      { id: "t1", text: "سُوق", lang: "ar", kind: "word", status: "new", band: "GREEN" },
    ];
    const html = renderToStaticMarkup(
      <TokenStream
        messageLang="ar"
        tokens={tokens}
        registry={registry}
        emitLearningEvent={() => undefined}
        blend={{ ratio: 0.2 }}
      />,
    );
    expect(html).toContain('data-pack-container="ar"');
    expect(html).toContain('dir="ltr"');
    // The Arabic word is still its own RTL island (per-word <bdi dir="auto">).
    expect(html).toContain('<bdi dir="auto"');
  });
});
