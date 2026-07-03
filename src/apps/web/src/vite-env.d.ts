/// <reference types="vite/client" />

// Side-effect CSS imports (global styles + vendored @fontsource files):
// bundler/vitest inline or no-op them; tsc only needs the declaration.
declare module "*.css";
