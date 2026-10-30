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
./scripts/kb-sync.sh        # 把 public/docs/*.md 经 Items REST API 传入知识库（用 wrangler 本地 OAuth，零 token 零绑卡）
```

`/api/setup` 幂等：创建空实例 `cf-free-ai-pi-kb`（内置存储）。索引约 1–3 分钟（`GET /api/status` 看 status 变为 indexed/ready）。打开站点首页点「初始化知识库」也可以。

## 实测踩坑（2026-10-29）

1. **官方示例的默认模型不在免费计划**：`@cf/zai-org/glm-5.3-flash` 和 `@cf/deepseek-ai/deepseek-v4-flash-0731` 都报 403 "not available on the Workers Free plan"（官方文档的 free 过滤器不可信）。已换 `@cf/openai/gpt-oss-120b`。**实测免费可用的 chat 模型**（`GET /api/probe-models` 可复跑）：llama-3.3-70b-fast、llama-3.1-8b-fast、llama-4-scout、gpt-oss-120b/20b、qwen3-30b-a3b、qwq-32b、deepseek-r1-distill-qwen-32b、gemma-4-26b、nemotron-3-120b；付费档：glm-5.3-flash、kimi-k2.7-code。
2. **AI Search 数据源三选一的真实可用性**：① Items API（内置存储）——binding 运行时未实现（`items.upload()` 报 "items is not a function"，compat date 2026-10-23 仍如此），但 **REST API 可用**（`POST .../instances/{id}/items` multipart），且 wrangler 本地 OAuth token 就有权限（`scripts/kb-sync.sh`）；② web-crawler——要求 source 是账号自有 zone（`sitemap_requires_owned_zone`），没自有域名用不了；③ R2——免费开通现在要绑卡。故最终方案 = 空实例 + REST 传文档。
3. **Workers AI binding 自动走 AI Gateway**：模型报错 diagnostics 里 `gateway: "default"`——AI Gateway 免费档白送挂上了。
4. **workers.dev 大陆 DNS 污染**：新域名解析到假 IP 导致"请求黑洞"（无响应、tail 无事件）。临时解法 `/etc/hosts` 钉真实 CF IP（见下），正式解法套 pages.dev 反代。
5. **DO 换模型后 5–10 分钟内仍跑旧代码**：Durable Object 驱逐延迟，属平台行为。

## 验收清单（2026-10-29 全部通过 ✅）

| # | 验证点 | 方法 | 结果 |
|---|---|---|---|
| 1 | pi agent 在 DO 上运行 | 任意消息 | ✅ PiHarness（beta）+ pi-durable 1.4 |
| 2 | Workers AI 免费模型 | 对话直答 + 工具调用 | ✅ gpt-oss-120b（自动经 AI Gateway） |
| 3 | ai_search 工具 | 问「知识库里的暗号是什么？」 | ✅ 答「紫电青霜-2026」（该事实只在知识库里） |
| 4 | AI Search 实例与索引 | `GET /api/status` | ✅ 空实例 + Items REST 上传 3 份文档 |
| 5 | DO 持久化 | `GET /api/messages` | ✅ 转录跨请求保留 |

线上：
- 大陆直连（推荐）：https://cloudflare-free-ai-pi-mirror.pages.dev （Pages 反代镜像，CI 同步部署）
- 原始入口：https://cloudflare-free-ai-pi.dongchangyang.workers.dev （workers.dev 大陆被污染，见踩坑 4）

## 公用知识库（任意 agent 均可调用）

同一个 AI Search 实例 `cf-free-ai-pi-kb` 是「云端公用知识库」，实测两类调用方都能取到同一份检索结果（2026-10-30）：

1. **任意本地/CLI agent**（零 token：wrangler 本地 OAuth）：
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACC/ai-search/namespaces/default/instances/cf-free-ai-pi-kb/search" \
     -H "Authorization: Bearer $(grep oauth_token ~/Library/Preferences/.wrangler/config/default.toml | cut -d'"' -f2)" \
     -H "content-type: application/json" \
     -d '{"messages":[{"role":"user","content":"你的问题"}]}'
   ```
   返回 `result.chunks[]`（含 score / 来源文件 key）。
2. **云端 Pi agent**（本项目 DO）：`POST /api/chat {"message":...}`，agent 自主调 `ai_search` 工具。

## 免费额度边界（2026-10 核实）

- Workers AI：10,000 Neurons/天
- AI Search：500 万 token 索引/月、10GB 存储、1000 语义 + 1000 全文搜索/月；**2026-11-01 起超额计费**
- Workers：100,000 请求/天；Durable Objects 有独立免费额度
- 本项目一次 ai_search 调用 ≈ 2 次语义查询额度内的消耗（检索 + 可选重排）

## License

MIT
