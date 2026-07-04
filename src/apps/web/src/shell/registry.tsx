/**
 * The client-side component registry, keyed `(lang, token.kind)` — seam 6
 * (ADR §1.3 port 6). The shell imports ZERO language components: packs
 * register whole entrants (manifest + components + container) from the
 * app's composition layer (`src/packs/`), and lookups here are pure data —
 * `Record` reads keyed by opaque strings, never a language-equality
 * branch and never a script-structural assumption (dual-instance amendment). Structural
 * deltas between languages are SWAPPED COMPONENTS registered here; value
 * deltas are design tokens — the code mirror of the design-system
 * inheritance ADR.
 */

import type { ComponentType, ReactNode } from "react";
import type { RendererManifest } from "@la/contract";
import type { TokenRendererProps } from "./stream-types.js";

export interface RendererRegistryEntry {
  lang: string;
  manifest: RendererManifest;
  /** ComponentKey → component, for every key in `manifest.tokenRenderers`. */
  components: Record<string, ComponentType<TokenRendererProps>>;
  /** The pack container — every script-structural concern (including text
   * direction) is decided INSIDE it, never by the shell. The optional
   * `blend` is the message's OPAQUE blend envelope, forwarded verbatim from
   * `message-start`: the shell never inspects it, but a pack may derive a
   * script-structural decision (e.g. base direction following blend
   * maturity) from it. */
  Container: ComponentType<{ children?: ReactNode; blend?: unknown }>;
  FallbackToken?: ComponentType<TokenRendererProps>;
}

/** Neutral last-resort token: addressable, unstyled, assumption-free. */
function NeutralToken({ token }: TokenRendererProps) {
  return <span data-token-id={token.id}>{token.text}</span>;
}

/** Neutral passthrough container for an unregistered message language. It
 * accepts (and ignores) the opaque `blend` prop the shell forwards to every
 * container. */
function NeutralContainer({ children }: { children?: ReactNode; blend?: unknown }) {
  return <div data-pack-container="none">{children}</div>;
}

export class RendererRegistry {
  private readonly entries = new Map<string, RendererRegistryEntry>();

  /** Entrants are additive and exclusive per language — a duplicate
   * registration is a composition bug, failed loudly at startup. */
  register(entry: RendererRegistryEntry): void {
    if (this.entries.has(entry.lang)) {
      throw new Error(
        `renderer registry: an entrant for '${entry.lang}' is already registered`,
      );
    }
    this.entries.set(entry.lang, entry);
  }

  languages(): string[] {
    return [...this.entries.keys()];
  }

  containerFor(lang: string): ComponentType<{ children?: ReactNode; blend?: unknown }> {
    return this.entries.get(lang)?.Container ?? NeutralContainer;
  }

  tokenComponentFor(lang: string, kind: string): ComponentType<TokenRendererProps> {
    const entry = this.entries.get(lang);
    if (!entry) return NeutralToken;
    const key = entry.manifest.tokenRenderers[kind];
    const component = key === undefined ? undefined : entry.components[key];
    return component ?? entry.FallbackToken ?? NeutralToken;
  }
}
