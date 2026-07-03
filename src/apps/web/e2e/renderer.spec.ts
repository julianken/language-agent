/**
 * Real-browser e2e for the walking-skeleton renderer (issue #10):
 *   1. the SSE stream renders PROGRESSIVELY (tokens paint as they arrive);
 *   2. anti-buffering headers on the streaming response;
 *   3. every token individually addressable/clickable; the breakdown-panel
 *      click emits a LearningEvent whose renderedScaffold echo matches the
 *      directive actually rendered;
 *   4. RTL rendering sane — visual right-to-left order, <bdi dir="auto">
 *      isolation, Amiri actually loaded (pinned @fontsource build), the
 *      free-morpheme rule at token boundaries, and the spike's ḥarakāt
 *      clipping probe re-run at arabic-reading-lg against the pinned font;
 *   5. the fake leg: per-unit split fade, discontinuous span group,
 *      YELLOW flag, RED withheld;
 *   6. screenshots at mobile (390×844) + desktop (1440×900) viewports.
 */

import { expect, test } from "@playwright/test";

const AR_URL = "/?fixture=ar-mixed-line&delayMs=120";
const AR_URL_FAST = "/?fixture=ar-mixed-line&delayMs=10";
const FAKE_URL = "/?fixture=fake-topology&delayMs=10";
const DONE = '[data-message-bubble][data-stream-done="true"]';

test("streams progressively — tokens paint before the stream completes", async ({ page }) => {
  await page.goto(AR_URL);
  await page.waitForSelector('[data-token-id="t0"]');
  const early = await page.locator("[data-token-id]").count();
  await page.waitForSelector(DONE);
  const final = await page.locator("[data-token-id]").count();
  expect(final).toBe(8);
  expect(early).toBeLessThan(final);

  // Replay-path first-token latency (plumbing-only, non-AC — the TTFT AC
  // is deferred to a real streamed response; see GAPS.md).
  const ttft = await page.locator("[data-first-token-ms]").getAttribute("data-first-token-ms");
  console.log(`replay first-token latency (plumbing-only): ${ttft}ms`);
  expect(Number(ttft)).toBeGreaterThan(0);
});

test("SSE response carries the hosting ADR's anti-buffering headers", async ({ request }) => {
  const res = await request.get("/api/stream?fixture=ar-mixed-line&delayMs=0");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/event-stream");
  expect(res.headers()["cache-control"]).toBe("no-cache, no-transform");
  expect(res.headers()["x-accel-buffering"]).toBe("no");
});

test("tokens are clickable; the breakdown click emits the renderedScaffold echo", async ({ page, request }) => {
  await page.goto(AR_URL_FAST);
  await page.waitForSelector(DONE);

  // Every token in the line is individually addressable.
  for (const id of ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"]) {
    await expect(page.locator(`[data-token-id="${id}"]`)).toHaveCount(1);
  }

  // t4 (كَبِيرَةٌ): lexical FADED × case-ending FULL — the split directive.
  await page.locator('[data-token-id="t4"]').click();
  await expect(page.locator('[data-breakdown-panel="ar"]')).toBeVisible();
  await expect(page.locator("[data-breakdown-root]")).toContainText("ك ب ر");
  await expect(page.locator("[data-breakdown-gloss]")).toContainText("big");

  // The event lands on the shared route with the echo of what was SEEN:
  // lexical marks hidden, case-ending tanwīn shown.
  await expect
    .poll(async () => {
      const res = await request.get("/api/learning-events");
      const body = (await res.json()) as {
        events: Array<{
          tokenRef: string;
          renderedScaffold: Record<string, string>;
          payload: { schemaId: string };
        }>;
      };
      return body.events.find((e) => e.tokenRef === "t4");
    })
    .toMatchObject({
      tokenRef: "t4",
      renderedScaffold: {
        vowelFadeLexical: "hidden",
        vowelFadeCaseEnding: "shown",
      },
      payload: { schemaId: "ar-events/v1" },
    });
});

test("RTL sane: visual order, bdi isolation, pinned Amiri, free-morpheme rule", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(AR_URL_FAST);
  await page.waitForSelector(DONE);
  await page.evaluate(() => document.fonts.ready);

  // The pinned/vendored Amiri build actually loaded.
  expect(await page.evaluate(() => document.fonts.check("27px Amiri"))).toBe(true);

  // The pack container (not the shell, not the page) owns direction.
  await expect(page.locator('[data-pack-container="ar"]')).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.getAttribute("dir"))).toBeNull();

  // Every Arabic word token is a <bdi dir="auto"> (the spike recipe).
  for (const id of ["t0", "t2", "t3", "t4"]) {
    const tag = await page
      .locator(`[data-token-id="${id}"]`)
      .evaluate((el) => `${el.tagName}:${el.getAttribute("dir")}`);
    expect(tag).toBe("BDI:auto");
  }

  // Visual right-to-left order: سَلَام (t0) sits right of هٰذِهِ (t2),
  // which sits right of مَكْتَبَةٌ (t3) — same line at this width.
  const box = async (id: string) => (await page.locator(`[data-token-id="${id}"]`).boundingBox())!;
  const [b0, b2, b3] = [await box("t0"), await box("t2"), await box("t3")];
  expect(Math.abs(b0.y - b2.y)).toBeLessThan(5);
  expect(b0.x).toBeGreaterThan(b2.x);
  expect(b2.x).toBeGreaterThan(b3.x);

  // Free-morpheme rule: ar tokens render Amiri; en tokens render Inter —
  // families switch ONLY at whole-token boundaries.
  const family = (id: string) =>
    page
      .locator(`[data-token-id="${id}"]`)
      .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family("t3")).toContain("Amiri");
  expect(await family("t7")).toContain("Inter");
  expect(await family("t7")).not.toContain("Amiri");

  // Ḥarakāt clipping probe (spike technique, re-run against the PINNED
  // Amiri build per PR #24's review): every combining mark's cluster rect
  // must sit inside the message line container — zero flags expected.
  const marks = await page.evaluate(() => {
    const container = document.querySelector('[data-pack-container="ar"]');
    if (!container) return null;
    const box = container.getBoundingClientRect();
    const MARK = /[\u064B-\u0652\u0670]/;
    const out: Array<{ ch: string; overTop: number; overBottom: number }> = [];
    for (const tokenEl of container.querySelectorAll("[data-token-id]")) {
      const walker = document.createTreeWalker(tokenEl, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? "";
        for (let i = 0; i < text.length; i++) {
          if (!MARK.test(text.charAt(i))) continue;
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          out.push({
            ch: text.charAt(i),
            overTop: Math.max(0, box.top - r.top),
            overBottom: Math.max(0, r.bottom - box.bottom),
          });
        }
      }
    }
    return out;
  });
  expect(marks).not.toBeNull();
  expect(marks!.length).toBeGreaterThan(0); // the probe saw real ḥarakāt
  const worst = Math.max(...marks!.map((m) => Math.max(m.overTop, m.overBottom)));
  console.log(
    `ḥarakāt clipping probe: ${marks!.length} marks measured, max overhang ${worst.toFixed(2)}px`,
  );
  expect(worst).toBeLessThanOrEqual(0.5);
});

test("fake leg: split fade, discontinuous span, YELLOW flag, RED withheld", async ({ page }) => {
  await page.goto(FAKE_URL);
  await page.waitForSelector(DONE);

  // Container is the fake pack's (LTR) — swapped structurally, zero shell edits.
  await expect(page.locator('[data-pack-container="fake"]')).toHaveAttribute("dir", "ltr");

  // Per-unit split fade INSIDE one token (blick): b's hint faded/hidden,
  // l's hint full/visible — two units, two levels, one token.
  const bHint = page.locator('[data-token-id="f1"] [data-glyph-unit="b"] [data-glyph-hint]');
  const lHint = page.locator('[data-token-id="f1"] [data-glyph-unit="l"] [data-glyph-hint]');
  await expect(bHint).toBeHidden();
  await expect(lHint).toBeVisible();
  await expect(page.locator('[data-token-id="f1"] [data-glyph-unit="b"]')).toHaveAttribute(
    "data-hint-level",
    "faded",
  );
  await expect(page.locator('[data-token-id="f1"] [data-glyph-unit="l"]')).toHaveAttribute(
    "data-hint-level",
    "full",
  );

  // Discontinuous span group: mip … tok linked across zorp.
  const grouped = page.locator('[data-span-group="sg:miptok:0"]');
  await expect(grouped).toHaveCount(2);
  await expect(grouped.nth(0)).toHaveAttribute("data-token-id", "f2");
  await expect(grouped.nth(1)).toHaveAttribute("data-token-id", "f4");
  await expect(page.locator('[data-token-id="f3"]')).not.toHaveAttribute("data-span-group");

  // Deterministic YELLOW and RED states.
  await expect(page.locator('[data-token-id="f3"]')).toHaveAttribute("data-band", "YELLOW");
  const red = page.locator('[data-token-id="f5"]');
  await expect(red).toHaveAttribute("data-band", "RED");
  await expect(red).toHaveText("•••"); // withheld — never the content
  expect(await page.locator("body").innerText()).not.toContain("gronk");
});

test("screenshots at mobile + desktop viewports", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(AR_URL_FAST);
  await page.waitForSelector(DONE);
  await page.evaluate(() => document.fonts.ready);
  await testInfo.attach("ar-desktop-1440x900", {
    body: await page.screenshot({ path: "test-results/pr-screenshots/ar-desktop-1440x900.png", fullPage: true }),
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(AR_URL_FAST);
  await page.waitForSelector(DONE);
  await page.evaluate(() => document.fonts.ready);
  await testInfo.attach("ar-mobile-390x844", {
    body: await page.screenshot({ path: "test-results/pr-screenshots/ar-mobile-390x844.png", fullPage: true }),
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(FAKE_URL);
  await page.waitForSelector(DONE);
  await testInfo.attach("fake-desktop-1440x900", {
    body: await page.screenshot({ path: "test-results/pr-screenshots/fake-desktop-1440x900.png", fullPage: true }),
    contentType: "image/png",
  });

  // The click-word popover — the system's single floating element.
  await page.goto(AR_URL_FAST);
  await page.waitForSelector(DONE);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-token-id="t3"]').click();
  await page.waitForSelector('[data-breakdown-panel="ar"]');
  await testInfo.attach("ar-breakdown-panel-1440x900", {
    body: await page.screenshot({ path: "test-results/pr-screenshots/ar-breakdown-panel-1440x900.png", fullPage: true }),
    contentType: "image/png",
  });
});
