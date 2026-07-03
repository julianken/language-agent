/**
 * Vitest scope: unit/story tests under src/ only. e2e/*.spec.ts is
 * Playwright's (`pnpm run test:e2e`) — the two runners must not pick up
 * each other's files.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
