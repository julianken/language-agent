// ADR §2.4 mechanism 4: no language conditionals in language-blind core
// code. Scoped to exactly the three paths the ADR names — packages/engine,
// apps/server/src (composition-root file excepted), apps/web/src/shell —
// plus a literal-text grep backstop (scripts/check-no-lang-conditional.sh)
// that CI also runs, since an AST selector and a grep pattern can disagree
// at the margins and the ADR's own citation (spaCy #1816) is a warning
// against relying on a single mechanism.
//
// .mjs on purpose: explicit ESM regardless of any package.json "type" field
// elsewhere in the tree.
import tseslint from "typescript-eslint";

// The composition root file is the ONE sanctioned place a language
// conditional (technically a literal-specifier registry lookup, not a
// `lang === ` conditional, but keeping the exception list in one spot next
// to the grep script's) is expected once issue #16 adds it.
const COMPOSITION_ROOT_FILE = "apps/server/src/composeApp.ts";

const noLangConditionalRule = {
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "BinaryExpression[operator=/^[!=]==$/] > Identifier[name=/^lang(uage)?$/]",
      message:
        "No `lang === ` / `language === ` conditionals in language-blind " +
        "core code (ADR §2.4 mechanism 4). Use a derived-capability field " +
        "or an opaque leg id instead.",
    },
    {
      selector:
        "BinaryExpression[operator=/^[!=]==$/] > MemberExpression > Identifier[name=/^lang(uage)?$/]",
      message:
        "No `lang === ` / `language === ` conditionals in language-blind " +
        "core code (ADR §2.4 mechanism 4). Use a derived-capability field " +
        "or an opaque leg id instead.",
    },
  ],
};

export default tseslint.config(
  {
    files: ["packages/engine/**/*.{ts,tsx}", "apps/web/src/shell/**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    rules: noLangConditionalRule,
  },
  {
    files: ["apps/server/src/**/*.{ts,tsx}"],
    ignores: [COMPOSITION_ROOT_FILE],
    extends: [tseslint.configs.base],
    rules: noLangConditionalRule,
  },
);
