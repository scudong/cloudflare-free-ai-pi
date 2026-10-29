import { DurableObject } from "cloudflare:workers";
import { createModels } from "@earendil-works/pi-ai/models";
import { Type } from "@earendil-works/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import type { ToolRegistration } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { createAI } from "agents/models/pi-ai";
import { buildAiSearchTool } from "./tools";

const PREAMBLE = `You are a free-tier cloud agent running on Cloudflare Durable Objects.
You answer in the language of the user's message (default: Chinese).

You have a knowledge base (Cloudflare AI Search) with documents indexed from
this project. When a question might be answered by those documents — quotas,
project facts, canary strings — call the ai_search tool first, then answer
from the retrieved chunks and say that the answer came from the knowledge base.
If you don't know and the knowledge base doesn't know, say so plainly.`;

/** One Durable Object = one always-resumable pi agent session. */
export class PiAgent extends DurableObject<Env> {
  // Workers AI (optionally via AI Gateway) exposed as a pi-ai provider.
  readonly ai = createAI({ binding: this.env.AI });
  readonly registry = createRegistry();

  readonly harness = new PiHarness({
    harness: async ({ storage, context, onWake }) => {
      // Installations must happen before Harness.open; the factory may run
      // more than once (restart / storage-error recovery), so keep it idempotent.
      this.registry.install({
        name: "free-stack",
        sections: [{ key: "preamble", render: () => PREAMBLE, tag: false }],
        tools: this.buildTools(),
      });
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(
        storage,
        {
          models,
          registry: this.registry,
          onWake,
          settings: {
            // pi doubles each delay: 1, 2, 4 …s — gives rate-limited free
            // models ~30s to recover instead of failing the run.
            retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 },
          },
          onReport: (error) => console.warn("pi report", error),
        },
        context,
      );
    },
    defaults: {
      model: this.ai(this.env.MODEL_ID),
      thinkingLevel: "low",
    },
  });

  readonly lifecycle = Lifecycle.install(this).use(this.harness);

  private buildTools(): ToolRegistration<any>[] {
    const tools: ToolRegistration<any>[] = [
      buildAiSearchTool(this.env),
      {
        name: "now",
        description: "Current UTC time.",
        parameters: Type.Object({}),
        replay: "safe",
        async execute() {
          return { output: [{ type: "text", text: new Date().toISOString() }] };
        },
      },
    ];
    return tools;
  }

  /** Submit a prompt to the root session and wait for the final answer. */
  async ask(prompt: string): Promise<{ text: string }> {
    const { text } = await this.harness.prompt(prompt);
    return { text: text ?? "(no answer)" };
  }

  /** Transcript of the root session (entries since the latest reset). */
  async messages(): Promise<unknown> {
    return this.harness.session().messages();
  }

  async reset(): Promise<void> {
    return this.harness.session().reset();
  }
}
