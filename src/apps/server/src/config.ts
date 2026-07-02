/**
 * Instance config (ADR §2.2, layer 1 of 2) — parsed from env/file at boot,
 * BEFORE `composeApp`: all env/config reading happens OUTSIDE the
 * composition root, which takes a validated object only (the anti-pattern
 * this kills: "reading env deep inside modules kills the dual-CI test").
 *
 * No `featureFlags` field: no flag exists yet; the field is added with its
 * first named consumer, not before (ADR §2.2, §6).
 */

import { z } from "zod";

export const InstanceConfigSchema = z.object({
  language: z.enum(["fake", "ar", "zh"]),
  sidecar: z.object({
    baseUrl: z.url(),
    mode: z.enum(["real", "fixture", "mock"]).default("real"),
  }),
  assetsRoot: z.string().min(1),
  tts: z.object({ provider: z.string().min(1), voice: z.string().min(1) }),
});

export type InstanceConfig = z.infer<typeof InstanceConfigSchema>;

/** Boot-time parse helper. Every failure is a boot failure. */
export function parseInstanceConfig(raw: unknown): InstanceConfig {
  return InstanceConfigSchema.parse(raw);
}
