/**
 * Instantiates the shared portable-stories suite for the `ar` leg and the
 * `fake` leg (ADR §4.2; the zh leg registers with #21 — zero edits here or
 * in the shell, by design). Asserts, per ADR §4.2:
 *   - every story state renders without error;
 *   - band/status colors bind to tokens.json semantics (every var(--la-…)
 *     a component renders is defined by the tokens.json bridge — no second,
 *     ad hoc color source — and the status/flag vars carry the DESIGN.md §0
 *     values);
 *   - text-direction + bidi isolation on the RTL leg;
 *   - ruby markup present in NO leg shipped here (zh-only, lands with #21);
 *   - the per-unit split-fade story and the discontinuous-span story.
 */

import { describe, expect, it } from "vitest";
import { arPortableStoryLeg } from "@la/lang-ar/react";
import { fakePortableStoryLeg } from "@la/lang-fake/react";
import { computeCssVars } from "../../tokens/applyTokens.js";
import { renderStories, type PortableStoryLeg } from "../portable-stories.js";

const LEGS: PortableStoryLeg[] = [arPortableStoryLeg, fakePortableStoryLeg];

const STATUS_VAR: Record<string, string> = {
  new: "--la-color-status-new-bg",
  learning: "--la-color-status-learning-bg",
};

describe.each(LEGS.map((leg) => [leg.lang, leg] as const))(
  "portable stories — %s leg",
  (_lang, leg) => {
    const stories = renderStories(leg);
    const vars = computeCssVars();

    it("renders every story state without error", () => {
      // 3 bands × 3 levels × statuses + split-fade + discontinuous-span
      expect(stories.length).toBe(3 * 3 * leg.statuses.length + 2);
      for (const story of stories) {
        expect(story.html.length, story.name).toBeGreaterThan(0);
      }
    });

    it("references ONLY custom properties the tokens.json bridge defines", () => {
      for (const story of stories) {
        const used = [...story.html.matchAll(/var\((--la-[a-z0-9-]+)\)/g)].map(
          (m) => m[1] as string,
        );
        for (const name of used) {
          expect(vars[name], `${story.name} uses undefined ${name}`).toBeDefined();
        }
      }
    });

    it("washes new/learning tokens with the DESIGN.md §0 status tints; known stays bare", () => {
      for (const story of stories.filter((s) => s.band === "GREEN")) {
        const wash = STATUS_VAR[story.status ?? ""];
        if (wash) {
          expect(story.html, story.name).toContain(`var(${wash})`);
        } else {
          expect(story.html, story.name).not.toContain("--la-color-status-new-bg");
          expect(story.html, story.name).not.toContain("--la-color-status-learning-bg");
        }
      }
      // The bridge maps the washes to the DESIGN.md §0 literals.
      expect(vars["--la-color-status-new-bg"]).toBe("#f6ecd2");
      expect(vars["--la-color-status-learning-bg"]).toBe("#dcebe8");
    });

    it("flags YELLOW with confidence-uncertain; RED renders withheld, never the content", () => {
      for (const story of stories.filter((s) => s.band === "YELLOW")) {
        expect(story.html, story.name).toContain("var(--la-color-confidence-uncertain)");
      }
      for (const story of stories.filter((s) => s.band === "RED")) {
        expect(story.html, story.name).toContain("var(--la-color-correction-remove)");
        for (const token of story.tokens) {
          expect(story.html, `${story.name} must withhold RED content`).not.toContain(
            token.text,
          );
        }
      }
      expect(vars["--la-color-confidence-uncertain"]).toBe("#c08a2e");
    });

    it("owns direction in the pack container; bidi isolation per declared leg", () => {
      for (const story of stories) {
        expect(story.html, story.name).toContain(`dir="${leg.expect.containerDir}"`);
        expect(story.html, story.name).toContain(`data-pack-container="${leg.lang}"`);
        if (leg.expect.bidiIsolatedTokens && story.band !== "RED") {
          expect(story.html, story.name).toContain("<bdi");
          expect(story.html, story.name).toContain('dir="auto"');
        }
      }
    });

    it("uses ruby markup only where declared (zh-only; no leg here)", () => {
      expect(leg.expect.usesRuby).toBe(false);
      for (const story of stories) {
        expect(story.html, story.name).not.toContain("<ruby");
      }
    });

    it("renders the per-unit split-fade state (two units, two levels, one token)", () => {
      const story = stories.find((s) => s.name.endsWith("/split-fade"));
      expect(story).toBeDefined();
      for (const needle of leg.splitFade.expectRendered) {
        expect(story?.html, `expected ${needle}`).toContain(needle);
      }
      for (const needle of leg.splitFade.forbidRendered) {
        expect(story?.html, `forbidden ${needle}`).not.toContain(needle);
      }
    });

    it("links the discontinuous span group across a gap (ADR §1.3 port 1)", () => {
      const story = stories.find((s) => s.name.endsWith("/discontinuous-span"));
      expect(story).toBeDefined();
      const attr = `data-span-group="${leg.discontinuousSpan.spanGroup}"`;
      const count = story?.html.split(attr).length ?? 0;
      expect(count - 1, "exactly the two grouped tokens carry the span group").toBe(2);
    });
  },
);
