/**
 * Resolves an `/api/*` request path against the document's base URI, so
 * every fetch/EventSource call carries whatever runtime path-prefix the
 * server injected via `<base href="/ar/">` / `<base href="/zh/">`
 * (language-router-gateway plan, Task 6, R-B) — or the plain page origin
 * in dev/e2e, where no `<base>` is injected (default base `/`, unchanged
 * behavior). The web bundle itself is built with Vite `base: "./"` (Task
 * 5) so it never hard-codes a prefix; this helper is the one seam every
 * `/api/*` call site resolves the prefix through at request time instead.
 *
 * `path` is the path WITHOUT a leading `/api/` segment — e.g.
 * `apiUrl("learning-events")` resolves to `.../api/learning-events` under
 * whatever base is currently in force.
 *
 * `base` defaults to `document.baseURI` and exists as a parameter only so
 * this is unit-testable under Vitest's Node environment (this workspace
 * has no jsdom/happy-dom dependency) without a full DOM. Product call
 * sites never pass it.
 */
export function apiUrl(path: string, base: string = document.baseURI): string {
  return new URL(`api/${path.replace(/^\/+/, "")}`, base).toString();
}
