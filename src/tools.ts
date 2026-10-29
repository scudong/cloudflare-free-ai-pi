import { Type } from "@earendil-works/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";

/**
 * The ai_search tool: queries the AI Search instance through the native
 * Workers binding (no API token, no fetch to api.cloudflare.com).
 */
export function buildAiSearchTool(env: Env): ToolRegistration<any> {
  const params = Type.Object({
    query: Type.String({ description: "Search query for the knowledge base." }),
  });

  return {
    name: "ai_search",
    description:
      "Search the project knowledge base (Cloudflare AI Search). Use for questions about " +
      "Cloudflare free quotas, this project's architecture, or any fact that may be in the indexed docs.",
    parameters: params,
    replay: "safe",
    async execute({ query }: { query: string }) {
      const instance = env.AI_SEARCH.get(env.KB_INSTANCE);
      try {
        const result = await instance.search({
          messages: [{ role: "user", content: query }],
        });
        const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
        if (chunks.length === 0) {
          return { output: [{ type: "text", text: "No matching chunks." }] };
        }
        const text = chunks
          .map((c: any, i: number) => {
            const content = c?.content ?? c?.text ?? JSON.stringify(c);
            const source = c?.metadata?.file ?? c?.file ?? c?.id ?? `chunk-${i}`;
            return `[${i + 1}] (${source})\n${content}`;
          })
          .join("\n\n---\n\n");
        return { output: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          output: [
            {
              type: "text",
              text:
                msg.includes("404") || /not found|not exist/i.test(msg)
                  ? `Knowledge base "${env.KB_INSTANCE}" does not exist yet — run POST /api/setup first.`
                  : `ai_search failed: ${msg}`,
            },
          ],
        };
      }
    },
  };
}
