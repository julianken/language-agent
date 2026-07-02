/**
 * The tree's contract version. Every in-tree pack's `meta.contractVersion`
 * must EQUAL this value — asserted at boot by `composeApp` (ADR §2.3).
 *
 * Exact equality, not a semver range: all packs are in-tree,
 * `workspace:*`-pinned, and deployed lockstep, so a range has nothing to
 * flex against. Ranges return only if a pack ever leaves the tree
 * (documented escape hatch, not built — ADR §1.2, §6).
 *
 * v0.x: breaking changes are explicitly allowed until the zh pack lands
 * (the churn window closes at epic #3's end — dual-instance amendment);
 * every break migrates fake+ar+zh in one PR.
 */
export const CONTRACT_VERSION = "0.1.0";
