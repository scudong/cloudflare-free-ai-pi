# cloudflare-free-ai-pi

**Free-tier Pi agent on Cloudflare — PiHarness on Durable Objects + Workers AI + AI Search. No paid plan, no API tokens.**

免费计划上的 Pi Agent 验证项目：官方 Agents SDK 的 `PiHarness`（beta）跑在 Durable Object 上，模型走 Workers AI 免费额度，知识库走 AI Search 免费额度，全部通过 Workers 原生 binding 调用——不需要任何 API token。

**English** | 部署与验收见下文（中文为主）

## 架构

```
┌─ Worker (src/index.ts) ── static UI (public/) + /api/*
│
├─ PiAgent (Durable Object, SQLite)        src/agent.ts
│   ├─ PiHarness (agents/harness/pi, beta)  ← @earendil-works/pi-durable 1.4
│   ├─ createAI({ binding: AI })            ← Workers AI as pi-ai provider
│   └─ tools: ai_search / now
│
├─ AI binding            → Workers AI (@cf/zai-org/glm-5.3-flash)
└─ ai_search_namespaces  → AI Search instance (built-in storage, no R2)
```

## 部署（3 步）

```bash
npm install
npx wrangler deploy
curl -X POST https://cloudflare-free-ai-pi.<your-subdomain>.workers.dev/api/setup
```

`/api/setup` 幂等：创建 AI Search 实例 `cf-free-ai-pi-kb`（内置存储），上传 `public/docs/` 的 3 份文档，索引约 1–3 分钟。打开站点首页点「初始化知识库」也可以。

## 验收清单

| # | 验证点 | 方法 | 预期 |
|---|---|---|---|
| 1 | pi agent 在 DO 上运行 | 任意消息 | 正常回复 |
| 2 | Workers AI 免费模型 | `GET /api/health` | model 字段为 `@cf/zai-org/glm-5.3-flash` |
| 3 | ai_search 工具被调用 | 问「知识库里的暗号是什么？」 | 答「紫电青霜-2026」且注明来自知识库 |
| 4 | AI Search 实例与索引 | `GET /api/status` | status 为 indexed/ready |
| 5 | DO 持久化 | 重启后 `GET /api/messages` | 转录还在 |

## 免费额度边界（2026-10 核实）

- Workers AI：10,000 Neurons/天
- AI Search：500 万 token 索引/月、10GB 存储、1000 语义 + 1000 全文搜索/月；**2026-11-01 起超额计费**
- Workers：100,000 请求/天；Durable Objects 有独立免费额度
- 本项目一次 ai_search 调用 ≈ 2 次语义查询额度内的消耗（检索 + 可选重排）

## License

MIT
