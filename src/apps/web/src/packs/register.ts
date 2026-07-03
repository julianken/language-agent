/**
 * The web composition layer — the ONE place pack `/react` entrants are
 * imported and registered (mirror of the server's literal-import registry,
 * ADR §2.3: literal specifiers, compiler-checked, no computed imports).
 * The shell stays language-blind; adding a language here is one line plus
 * the pack's own entry — #21's zh entrant registers here with ZERO shell
 * edits (`git diff --stat -- src/apps/web/src/shell` is empty for this
 * PR).
 *
 * Imports use ONLY the packs' public `/react` subpaths (ADR §2.4
 * mechanism 3) — never a pack's internals.
 */

import { arRendererEntry } from "@la/lang-ar/react";
import { fakeRendererEntry } from "@la/lang-fake/react";
import { zhRendererEntry } from "@la/lang-zh/react";
import { RendererRegistry } from "../shell/index.js";
import { englishScaffoldEntry } from "./EnglishScaffoldToken.js";

export function buildRegistry(): RendererRegistry {
  const registry = new RendererRegistry();
  registry.register(arRendererEntry);
  registry.register(fakeRendererEntry);
  registry.register(zhRendererEntry);
  registry.register(englishScaffoldEntry);
  return registry;
}
