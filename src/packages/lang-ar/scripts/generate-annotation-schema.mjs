/**
 * Generates `ar-annotations.schema.json` from the pack's canonical zod
 * annotation schema (ADR §1.3 seam 3 / §3.4: "the pack build GENERATES its
 * JSON Schema artifact from it via z.toJSONSchema", freshness-gated with
 * `git diff --exit-code` in CI — same gate as the OpenAPI pipeline).
 *
 * Run AFTER `pnpm run build` (imports the built `dist/`):
 *   pnpm --filter @la/lang-ar run generate:annotation-schema
 * or via the root orchestrator: `pnpm run spec:generate:node`.
 *
 * Output is deterministic: stable zod key order, 2-space indent, trailing
 * newline — any diff means the zod schema and the artifact disagree.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  AR_ANNOTATIONS_SCHEMA_ID,
  ArAnnotationsSchema,
} from "../dist/annotations.js";

const outPath = fileURLToPath(
  new URL("../ar-annotations.schema.json", import.meta.url),
);

const jsonSchema = z.toJSONSchema(ArAnnotationsSchema, {
  target: "draft-2020-12",
});

const artifact = { $id: AR_ANNOTATIONS_SCHEMA_ID, ...jsonSchema };

writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`wrote ${outPath}`);
