/**
 * Vite entry: vendor the shared Latin UI face (Inter — pinned via
 * @fontsource, DESIGN.md §0), apply the tokens.json custom-property bridge
 * to :root BEFORE first paint, then mount the app. No global `dir` is set
 * anywhere (index.html carries none either) — direction is decided inside
 * pack containers only.
 */

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./styles/global.css";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { applyDesignTokens } from "./tokens/applyTokens.js";

applyDesignTokens(document.documentElement);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root element");
createRoot(rootEl).render(<App />);
