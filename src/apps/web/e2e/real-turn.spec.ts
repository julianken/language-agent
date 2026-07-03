/**
 * Real-turn browser e2e (issue #10's real-#9-integration follow-up):
 * `POST /api/turns` → `?turn=<id>` renders through the SAME `<TokenStream>`
 * shell `renderer.spec.ts` already proves against `?fixture=<id>` — zero
 * renderer changes were needed (the wire contract is identical; see
 * `App.tsx`'s header comment).
 *
 * Runs against the `fake` leg only (the server this config boots via
 * `LANGUAGE=fake` — see `playwright.config.ts`'s header for why): the fake
 * pack's verification gate is REAL and deterministic but fully in-process
 * (no sidecar/Docker needed), so this proves the whole real pipeline —
 * `ReplayCandidateGenerator` → the pack's real gate → `anglicizeDown` →
 * the SSE transport → the renderer — without adding Docker to this
 * browser-e2e job. The `ar` leg's REAL-SIDECAR proof runs server-side
 * instead: `@la/server`'s `test:e2e-sse` suite, in CI's `conformance (ar)`
 * job (which already boots the ar sidecar for the TCK + the existing
 * in-process `e2e-turn.test.ts`).
 *
 * Reuses #9's replay corpora (`src/apps/server/fixtures/llm-replay/fake/`)
 * and #10's renderer (`<TokenStream>`, `useTokenStream`, the registry) —
 * no product code under test here is new; only the transport wiring is.
 */

import { expect, test } from "@playwright/test";

const DONE = '[data-message-bubble][data-stream-done="true"]';

interface CreateTurnResponse {
  turnId: string;
  fellBackToEnglish: boolean;
  attempts: number;
}

test("a real turn streams progressively and renders through the SSE transport (fake leg)", async ({
  page,
  request,
}) => {
  const create = await request.post("/api/turns", {
    data: { learnerMessage: "Tell me about zip zap zorg." },
  });
  expect(create.status()).toBe(201);
  const created = (await create.json()) as CreateTurnResponse;
  expect(created.fellBackToEnglish).toBe(false);
  expect(created.attempts).toBe(1);

  await page.goto(`/?turn=${created.turnId}&delayMs=80`);
  await page.waitForSelector("[data-token-id]");
  const early = await page.locator("[data-token-id]").count();
  await page.waitForSelector(DONE);
  const final = await page.locator("[data-token-id]").count();
  expect(final).toBeGreaterThan(0);
  expect(early).toBeLessThan(final); // painted progressively, not in one flush

  // The turn loop's always-empty learner state anglicizes every word on
  // this fixture (documented in e2e-turn.test.ts) — the rendered content is
  // the REAL verified candidate's English glosses (lexicon.json: zip→"one",
  // zap→"two", zorg→"three"), never a RED band, never the cross-check
  // always-RED word ("qux" — asserted in the RED-fallback test below).
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain("one");
  expect(await page.locator('[data-band="RED"]').count()).toBe(0);
});

test("RED-fallback: a message that gates all-RED streams the whole-message English fallback — never an unverified byte", async ({
  page,
  request,
}) => {
  const create = await request.post("/api/turns", {
    data: { learnerMessage: "This one always fails verification." },
  });
  expect(create.status()).toBe(201);
  const created = (await create.json()) as CreateTurnResponse;
  expect(created.fellBackToEnglish).toBe(true);

  await page.goto(`/?turn=${created.turnId}&delayMs=10`);
  await page.waitForSelector(DONE);

  // One whole-message English fallback token — never any target-language
  // bytes, never the always-RED word that triggered the fallback.
  expect(await page.locator("[data-token-id]").count()).toBe(1);
  expect(await page.locator("[data-band]").count()).toBe(0); // the fallback token carries no band at all

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain("couldn't verify that safely");
  expect(bodyText).not.toContain("qux");
});

test("an unknown ?turn id surfaces as a stream error, never a silent blank render", async ({ page }) => {
  await page.goto("/?turn=does-not-exist&delayMs=10");
  await expect(page.locator("[data-stream-error]")).toBeVisible();
  expect(await page.locator("[data-token-id]").count()).toBe(0);
});
