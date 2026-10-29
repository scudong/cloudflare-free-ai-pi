export { PiAgent } from "./agent";
import type { PiAgent } from "./agent";

// Bump the suffix when defaults change: active DO instances keep running old
// code until evicted (minutes), a new name picks up new code immediately.
const DO_NAME = "main-v3";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function stub(env: Env): DurableObjectStub<PiAgent> {
  return env.PI_AGENT.getByName(DO_NAME);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return json({
        ok: true,
        model: env.MODEL_ID,
        kb_instance: env.KB_INSTANCE,
      });
    }

    // One-time setup: create the EMPTY AI Search instance (built-in storage).
    // Idempotent. Docs are uploaded separately via scripts/kb-sync.sh
    // (Items REST API) — the binding's items.upload() is documented but not
    // yet implemented in the runtime, and web-crawler/r2 sources need extra
    // prerequisites (owned zone / card), so empty + REST upload is the
    // zero-card, zero-token path.
    if (pathname === "/api/setup" && request.method === "POST") {
      const instance = env.AI_SEARCH.get(env.KB_INSTANCE);
      let created = false;
      const steps: Record<string, string> = {};
      let info: { type?: string | null } | null = null;
      try {
        info = (await instance.info()) as { type?: string | null };
        steps.info = "exists";
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        steps.info = `absent (${msg.slice(0, 120)})`;
      }
      if (info && info.type !== null) {
        steps.info += ` (type=${info.type})`;
      }
      if (!info) {
        try {
          await env.AI_SEARCH.create({ id: env.KB_INSTANCE });
          created = true;
          steps.create = "ok(empty)";
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (/exist|409/i.test(msg)) {
            steps.create = "already-exists";
          } else {
            steps.create = "error: " + msg;
            return json({ ok: false, steps }, 500);
          }
        }
      }
      return json({ ok: true, created, steps });
    }

    if (pathname === "/api/status") {
      const instance = env.AI_SEARCH.get(env.KB_INSTANCE);
      const anyInst = instance as unknown as Record<string, unknown>;
      let kb: unknown;
      try {
        kb = await instance.info();
      } catch (error) {
        kb = { error: error instanceof Error ? error.message : String(error) };
      }
      const shape = {
        ownKeys: Object.keys(anyInst),
        protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(anyInst) ?? {}),
        typeofItems: typeof anyInst.items,
        itemsKeys:
          anyInst.items instanceof Object
            ? Object.keys(anyInst.items as Record<string, unknown>)
            : null,
      };
      return json({ model: env.MODEL_ID, kb, shape });
    }

    // Diagnostic: which chat models can this plan actually run?
    // GET /api/probe-models — tries each candidate with a 5-token "hi".
    if (pathname === "/api/probe-models") {
      const candidates = [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3.1-8b-instruct-fast",
        "@cf/meta/llama-4-scout-17b-16e-instruct",
        "@cf/openai/gpt-oss-120b",
        "@cf/openai/gpt-oss-20b",
        "@cf/qwen/qwen3-30b-a3b-fp8",
        "@cf/qwen/qwq-32b",
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        "@cf/google/gemma-4-26b-a4b-it",
        "@cf/nvidia/nemotron-3-120b-a12b",
        "@cf/zai-org/glm-5.3-flash",
        "@cf/moonshotai/kimi-k2.7-code",
      ];
      const results: Record<string, string> = {};
      for (const model of candidates) {
        try {
          await env.AI.run(model, {
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          });
          results[model] = "OK";
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          results[model] = /free plan/i.test(msg)
            ? "paid-only"
            : msg.slice(0, 100);
        }
      }
      return json(results);
    }

    if (pathname === "/api/chat" && request.method === "POST") {
      const { message } = await readJson<{ message?: string }>(request);
      if (!message?.trim()) return json({ error: "message is required" }, 400);
      const { text } = await stub(env).ask(message.trim());
      return json({ text });
    }

    if (pathname === "/api/messages") {
      return json(await stub(env).messages());
    }

    if (pathname === "/api/reset" && request.method === "POST") {
      await stub(env).reset();
      return json({ ok: true });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
