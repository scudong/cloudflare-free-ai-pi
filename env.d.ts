/// <reference types="@cloudflare/workers-types" />

import type { PiAgent } from "./src/agent";

// Minimal AI Search binding types (not yet in workers-types for every version).
interface AiSearchInstance {
  search(q: {
    messages: { role: string; content: string }[];
    max_num_results?: number;
  }): Promise<{ chunks?: unknown[] }>;
  chatCompletions(q: {
    messages: { role: string; content: string }[];
    model?: string;
    stream?: boolean;
  }): Promise<unknown>;
  info(): Promise<Record<string, unknown>>;
  items: {
    upload(name: string, data: Blob | ArrayBuffer | string): Promise<unknown>;
    list(): Promise<{ items?: unknown[] }>;
  };
}

interface AiSearchNamespace {
  get(name: string): AiSearchInstance;
  create(config: {
    id: string;
    type?: "r2" | "web-crawler";
    source?: string;
  }): Promise<AiSearchInstance>;
  list(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ result?: Array<{ id: string; status?: string; type?: string }> }>;
}

declare global {
  interface Env {
    AI: Ai;
    AI_SEARCH: AiSearchNamespace;
    PI_AGENT: DurableObjectNamespace<PiAgent>;
    ASSETS: Fetcher;
    MODEL_ID: string;
    KB_INSTANCE: string;
  }
}
