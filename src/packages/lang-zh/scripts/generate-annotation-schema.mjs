/**
 * Generates `zh-annotations.schema.json` from the pack's canonical zod
 * annotation schema (ADR §1.3 seam 3 / §3.4), mirroring
 * `@la/lang-ar/scripts/generate-annotation-schema.mjs` exactly.
 *
 * Run AFTER `pnpm run build` (imports the built `dist/`):
 *   pnpm --filter @la/lang-zh run generate:annotation-schema
 *
 * Output is deterministic: stable zod key order, 2-space indent, trailing
 * newline — any diff means the zod schema and the artifact disagree.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ZH_ANNOTATIONS_SCHEMA_ID,
  ZhAnnotationsSchema,
} from "../dist/annotations.js";

const outPath = fileURLToPath(
  new URL("../zh-annotations.schema.json", import.meta.url),
);

const jsonSchema = z.toJSONSchema(ZhAnnotationsSchema, {
  target: "draft-2020-12",
});

const artifact = { $id: ZH_ANNOTATIONS_SCHEMA_ID, ...jsonSchema };

writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`wrote ${outPath}`);
