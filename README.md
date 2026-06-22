# language-agent

**An AI agent that teaches you to read Modern Standard Arabic (MSA) — from zero — through a conversation that blends English and Arabic.**

You talk to a capable conversational agent (it can search the web and read documents) about whatever you like. Its replies come back in a progressive **English↔Arabic blend** that starts almost entirely in English and, word by word, becomes Arabic as you learn — so you are always reading slightly above your level but never lost. Every Arabic word is clickable, tinted by how well you know it, and sheds its short-vowel marks (ḥarakāt) as you master it. You watch the training wheels come off, in the text itself.

> **Status: in design — pre-code.** There is no application build, run, or test yet. The design system, screens, and the vocabulary engine are fully specified (see `DESIGN.md`, the Figma file in `INSTANCE.md`, and `docs/plans/`); implementation hasn't started. The repo's own scaffolding checks (CI + `scripts/` guards) are live from the first commit.

## The idea

- **Two decoupled axes.** A reply's difficulty moves along *vocabulary* (which words are Arabic) and *grammar* (sentence structure) independently, so the blend can advance one without overwhelming the other.
- **A verified-blend engine.** The learner must **never** see incorrect Arabic. Replies are generated as verified MSA and then *anglicized down* by substitution — never generated in English and machine-translated up. LLM judges and a verification stack guard correctness end-to-end (neither the maintainer nor the operator reads Arabic, so verification is load-bearing, not a nicety).
- **The vocabulary system** decides which words a learner sees, when. The blend ratio is the emergent sum of per-word state, capped by a coverage policy, aimed by a frequency curriculum, sequenced by the conversation topic, and advanced over spaced encounters (FSRS). The full locked design is in [`docs/plans/vocabulary-system.md`](docs/plans/vocabulary-system.md).
- **Progress-as-typography.** The reading surface *is* the progress display — word-status tints and the vowel-fade are the core semantic system, rendered in running text rather than chrome.

## How this repo is built

Most code here is written by AI coding agents under human review, then squash-merged. The process — conventions, the review-before-merge rule, agent guardrails, and the Update-Triggers table that keeps docs from drifting — is the source of truth in [`AGENTS.md`](AGENTS.md). It was stood up from the [`agentic-seed`](https://github.com/julianken/agentic-seed) template.

## Map of the repo

Read these in the order `START_HERE.md` gives:

| File / dir | What it's the source of truth for |
|---|---|
| [`START_HERE.md`](START_HERE.md) | Entry card — read first to orient. |
| [`INSTANCE.md`](INSTANCE.md) | Instance facts: the product, the `gh` slug, the Figma file + node map, the merge/review infra, lifecycle status. |
| [`AGENTS.md`](AGENTS.md) | Process — how agents work here. (`CLAUDE.md` / `GEMINI.md` are thin shims that import it.) |
| [`DESIGN.md`](DESIGN.md) | The design system — tokens, color, type, motion, components, accessibility. Wins on any design conflict. |
| [`docs/plans/`](docs/plans/) | Committed specs & plans — the product brief, the v1/v2 design specs, the motion spec, the user stories, and the vocabulary system. |
| [`docs/decisions/`](docs/decisions/) | The decision log. |
| [`docs/research/`](docs/research/) | Durable research — the Arabic-NLP validation and the competitive teardown. |

## Security

See [`SECURITY.md`](SECURITY.md) for how to report a vulnerability and what to expect. The repo is public to support the maintainer's writing and to keep an open agentic-development trail; public status implies no compliance or audit obligation. There are no secrets or personal data in this repository.

## License

MIT — see [`LICENSE`](LICENSE).
