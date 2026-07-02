/**
 * The pack-manifest zod schema (ADR §1.2, §2.2 second layer): validates a
 * `LanguagePack` object when the pack loads at boot. Every failure is a
 * BOOT failure with a named-seam error, never a runtime undefined three
 * layers into the gate (ADR §2.3).
 *
 * Top-level and `meta` objects are STRICT: unknown keys are rejected —
 * which is exactly what makes "no declared `capabilities` block"
 * mechanical rather than a convention (ADR §1.2, §6).
 */

import { z } from "zod";
import type { LanguagePack } from "./language-pack.js";

/** Accepts any function value (behavior is typed at compile time; the
 * runtime schema can only check callability). */
const fn = (seam: string) =>
  z.custom<(...args: never[]) => unknown>(
    (v) => typeof v === "function",
    { message: `${seam}: expected a function` },
  );

/** Accepts a zod schema instance. */
const zodType = (where: string) =>
  z.custom<z.ZodType>((v) => v instanceof z.ZodType, {
    message: `${where}: expected a zod schema (z.ZodType)`,
  });

const UnitIndexDeclSchema = z.strictObject({
  id: z.string().min(1),
  extract: fn("masteryModel.declarations.unitKinds[].indexes[].extract"),
});

const UnitKindDeclSchema = z.strictObject({
  kind: z.string().min(1),
  stateSchema: zodType("masteryModel.declarations.unitKinds[].stateSchema"),
  stateVersion: z.number().int().nonnegative(),
  migrateState: fn("masteryModel.declarations.unitKinds[].migrateState").optional(),
  indexes: z.array(UnitIndexDeclSchema).optional(),
});

const GatingEdgeSchema = z.strictObject({
  gatingUnitKind: z.string().min(1),
  gatedDimension: z.string().min(1),
});

const CreditLeakEdgeSchema = z.strictObject({
  evidenceDimension: z.string().min(1),
  leakingDimension: z.string().min(1),
});

/**
 * The declaration half of seam 4, with the referential-integrity checks
 * boot can make statically:
 * - every edge references DECLARED fade dimensions / unit kinds;
 * - fade dimensions are unique;
 * - a credit-leak SELF-edge is rejected: same-dimensional leak protection
 *   is the UNIVERSAL half of the leak law (it runs for every fade
 *   dimension of every pack, undeclared); declared edges exist only to
 *   ADD cross-dimensional protection (see `CreditLeakEdge` TSDoc).
 */
const MasteryDeclarationsSchema = z
  .strictObject({
    unitKinds: z.array(UnitKindDeclSchema).min(1),
    fadeDimensions: z.array(z.string().min(1)).min(1),
    gatingEdges: z.array(GatingEdgeSchema),
    creditLeakEdges: z.array(CreditLeakEdgeSchema),
  })
  .superRefine((decl, ctx) => {
    const dims = new Set(decl.fadeDimensions);
    const kinds = new Set(decl.unitKinds.map((k) => k.kind));
    if (dims.size !== decl.fadeDimensions.length) {
      ctx.addIssue({
        code: "custom",
        path: ["fadeDimensions"],
        message: "masteryModel: fadeDimensions must be unique",
      });
    }
    if (kinds.size !== decl.unitKinds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["unitKinds"],
        message: "masteryModel: unitKinds[].kind must be unique",
      });
    }
    decl.gatingEdges.forEach((e, i) => {
      if (!kinds.has(e.gatingUnitKind)) {
        ctx.addIssue({
          code: "custom",
          path: ["gatingEdges", i, "gatingUnitKind"],
          message: `masteryModel: gating edge references undeclared unit kind '${e.gatingUnitKind}'`,
        });
      }
      if (!dims.has(e.gatedDimension)) {
        ctx.addIssue({
          code: "custom",
          path: ["gatingEdges", i, "gatedDimension"],
          message: `masteryModel: gating edge references undeclared fade dimension '${e.gatedDimension}'`,
        });
      }
    });
    decl.creditLeakEdges.forEach((e, i) => {
      for (const side of ["evidenceDimension", "leakingDimension"] as const) {
        if (!dims.has(e[side])) {
          ctx.addIssue({
            code: "custom",
            path: ["creditLeakEdges", i, side],
            message: `masteryModel: credit-leak edge references undeclared fade dimension '${e[side]}'`,
          });
        }
      }
      if (e.evidenceDimension === e.leakingDimension) {
        ctx.addIssue({
          code: "custom",
          path: ["creditLeakEdges", i],
          message:
            "masteryModel: credit-leak self-edge rejected — same-dimensional " +
            "leak protection is the UNIVERSAL half of the leak law (no " +
            "declaration needed); declared edges only ADD cross-dimensional " +
            "protection",
        });
      }
    });
  });

export const PackManifestSchema = z.strictObject({
  meta: z.strictObject({
    lang: z.enum(["fake", "ar", "zh"]),
    packageVersion: z.string().min(1),
    contractVersion: z.string().min(1),
  }),
  verificationGate: fn("verificationGate"),
  steeringPolicy: fn("steeringPolicy"),
  annotationCodec: z.strictObject({
    schema: zodType("annotationCodec.schema"),
    schemaId: z.string().min(1),
    encode: fn("annotationCodec.encode"),
    decode: fn("annotationCodec.decode"),
  }),
  masteryModel: z.strictObject({
    declarations: MasteryDeclarationsSchema,
    make: fn("masteryModel.make"),
  }),
  curriculumPolicy: z.strictObject({
    floors: z.array(
      z.strictObject({
        id: z.string().min(1),
        satisfied: fn("curriculumPolicy.floors[].satisfied"),
      }),
    ),
    make: fn("curriculumPolicy.make"),
  }),
  rendererManifest: z.strictObject({
    direction: z.enum(["rtl", "ltr"]),
    tokenRenderers: z.record(z.string(), z.string().min(1)),
    breakdownPanel: z.string().min(1),
  }),
  ttsDriver: fn("ttsDriver"),
  sidecarDescriptor: z.strictObject({
    imageRef: z.string().min(1),
    contractVersion: z.string().min(1),
    expectedLegs: z.array(z.string().min(1)),
  }),
  assetManifest: z.strictObject({
    assets: z.record(
      z.string(),
      z.strictObject({
        path: z.string().min(1),
        spineSchema: zodType("assetManifest.assets[].spineSchema"),
      }),
    ),
  }),
});

/**
 * Parse helper with the compile-time association to `LanguagePack`.
 * (The zod schema validates runtime SHAPE — callability, strict keys,
 * referential integrity; the TS interface remains the compile-time truth
 * for signatures, which runtime validation cannot see.)
 */
export function parsePackManifest(pack: LanguagePack): LanguagePack {
  PackManifestSchema.parse(pack);
  return pack;
}
