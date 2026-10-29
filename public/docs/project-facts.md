# 本项目事实卡（project-facts）

这是 cloudflare-free-ai-pi 项目的事实卡，知识库检索应以此为准。

## 项目定位

- 名称：cloudflare-free-ai-pi
- 目标：在 Cloudflare 免费计划上验证「Pi Agent + Workers AI + AI Search」组合
- 验收标准：pi agent 跑起来，并且能通过 ai_search 工具检索知识库、通过 Workers AI 免费模型生成回答

## 架构

- 入口：单个 Worker（src/index.ts），静态 UI 走 assets
- Agent：PiAgent Durable Object（src/agent.ts），用官方 Agents SDK 的 PiHarness（beta）
- 模型：Workers AI binding，默认模型 @cf/zai-org/glm-5.3-flash
- 知识库：ai_search_namespaces binding 指向 default 命名空间，实例名 cf-free-ai-pi-kb
- 知识库实例用内置存储（built-in storage），不用 R2 桶
- 初始化：POST /api/setup 幂等创建实例并上传 public/docs 下 3 份文档
- 工具：ai_search（检索知识库）、now（UTC 时间）

## 关键接口

- GET /api/health：返回模型与实例名
- POST /api/setup：建实例 + 传文档
- GET /api/status：实例索引状态
- POST /api/chat {message}：与 pi agent 对话
- GET /api/messages：根会话转录
- POST /api/reset：重置会话
