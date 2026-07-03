/**
 * The real `claude-sonnet-5` structured-output candidate generator (turn-
 * loop step 1). Implements `@la/engine`'s `CandidateGenerator` boundary.
 *
 * NEVER exercised by the PR-blocking E2E (ADR §3.6, epic AC: "zero live LLM
 * calls") — `ReplayCandidateGenerator` stands in there. This class requires
 * a live Anthropic credential at CALL time (`ANTHROPIC_API_KEY` or an
 * `ant auth login` profile); none is used, needed, or present to build or
 * test this repository — constructing this class does not itself make any
 * network call.
 *
 * Structured output via `output_config.format` + `messages.parse()`
 * (verified against the live Anthropic docs at implementation time — see
 * the PR body's step-10 citation): the candidate schema constrains the
 * model to emit exactly the shape the turn loop consumes, never a
 * free-text response the loop would have to re-parse.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CandidateGenerator, GenerateCandidatesArgs, GeneratedCandidate } from "@la/engine";
import { modelParamsFor, SONNET_MODEL } from "./model-params.js";

const CandidatesSchema = z.object({
  candidates: z
    .array(z.object({ text: z.string().min(1) }))
    .min(1)
    .describe("Full vocalized MSA candidate sentence(s), fully diacritized."),
});

export interface AnthropicCandidateGeneratorOptions {
  /** Injectable for tests; defaults to a bare `new Anthropic()` (credential
   * resolution per the SDK's standard precedence chain). */
  client?: Anthropic;
  maxTokens?: number;
}

export class AnthropicCandidateGenerator implements CandidateGenerator {
  private readonly client: Anthropic;
  private readonly maxTokens: number;

  constructor(options: AnthropicCandidateGeneratorOptions = {}) {
    this.client = options.client ?? new Anthropic();
    this.maxTokens = options.maxTokens ?? 2048;
  }

  async generate(args: GenerateCandidatesArgs): Promise<GeneratedCandidate[]> {
    const branch = modelParamsFor(SONNET_MODEL);
    const system = args.constraints.instructions.join("\n");

    const response = await this.client.messages.parse({
      model: SONNET_MODEL,
      max_tokens: this.maxTokens,
      ...(branch.thinking !== undefined ? { thinking: branch.thinking } : {}),
      system,
      messages: [
        {
          role: "user",
          content:
            `The learner wrote (in English): ${JSON.stringify(args.learnerMessage)}\n\n` +
            `Produce exactly ${args.n} candidate reply sentence(s) following the ` +
            "instructions above.",
        },
      ],
      output_config: {
        format: zodOutputFormat(CandidatesSchema),
      },
    });

    if (response.parsed_output === null) {
      throw new Error("claude-sonnet-5 candidate generation: structured output failed to parse");
    }
    return response.parsed_output.candidates.map((c) => ({ text: c.text }));
  }
}
