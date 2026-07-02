/**
 * @la/web — the package surface is the language-neutral shell ONLY. The
 * site composition layer (src/app, src/packs, src/tokens, src/main.tsx) is
 * Vite-built (`build:site`) and deliberately NOT exported: importing pack
 * registrations through the package would smuggle language components into
 * consumers of the neutral shell.
 */

export * from "./shell/index.js";
