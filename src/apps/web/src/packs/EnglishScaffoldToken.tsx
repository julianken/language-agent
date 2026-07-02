/**
 * The English-scaffold entrant — instance-composition UI (NOT shell): in a
 * blended line, `lang: "en"` tokens are the receding English frame
 * (DESIGN.md: "English recedes" — `english-recede` grey, Inter). Lives in
 * `src/packs/` with the other registry entrants; the shell resolves it
 * through the same `(lang, kind)` lookup it uses for every language.
 *
 * Free-morpheme rule (DESIGN.md §Typography): the blend switches families
 * at whole-token boundaries — this token is wholly Latin/Inter; Arabic
 * tokens are wholly Amiri. Each token still gets its own `<bdi dir="auto">`
 * isolation so mixed-direction lines can't corrupt at token boundaries
 * (the spike's per-token isolation recipe applies to BOTH sides of the
 * blend).
 */

import type { RendererRegistryEntry, TokenRendererProps } from "../shell/index.js";

export function EnglishScaffoldToken({ token }: TokenRendererProps) {
  return (
    <bdi
      dir="auto"
      data-token-id={token.id}
      data-status={token.status}
      style={{
        fontFamily: "var(--la-font-ui)",
        fontSize: "var(--la-type-subject-reading-md-size)",
        color: "var(--la-color-english-recede)",
      }}
    >
      {token.text}
    </bdi>
  );
}

export const englishScaffoldEntry: RendererRegistryEntry = {
  lang: "en",
  manifest: {
    direction: "ltr",
    tokenRenderers: {
      text: "en-scaffold-token",
      word: "en-scaffold-token",
      punct: "en-scaffold-token",
    },
    breakdownPanel: "en-none",
  },
  components: {
    "en-scaffold-token": EnglishScaffoldToken,
  },
  Container: ({ children }) => <>{children}</>,
  FallbackToken: EnglishScaffoldToken,
};
