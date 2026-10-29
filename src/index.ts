export { PiAgent } from "./agent";
import type { PiAgent } from "./agent";

const DO_NAME = "main";

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

    // One-time setup: create the AI Search instance over the docs R2 bucket
    // and make sure it exists. Idempotent — safe to call again.
    // NOTE: the Items API (built-in storage) is documented but not yet exposed
    // by the binding runtime ("items is not a function" server-side), so this
    // project uses an R2 data source; docs are uploaded via scripts/upload-docs.sh.
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
      if (info && info.type === null) {
        // empty instance from an earlier create — replace with R2-backed one
        try {
          await (env.AI_SEARCH as unknown as { delete(id: string): Promise<unknown> }).delete(
            env.KB_INSTANCE,
          );
          steps.replace = "deleted-empty-instance";
        } catch (error) {
          steps.replace =
            "delete-failed: " + (error instanceof Error ? error.message : String(error));
        }
        info = null;
      }
      if (!info) {
        try {
          await env.AI_SEARCH.create({
            id: env.KB_INSTANCE,
            type: "r2",
            source: "cf-free-ai-pi-docs",
          });
          created = true;
          steps.create = "ok(r2)";
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
