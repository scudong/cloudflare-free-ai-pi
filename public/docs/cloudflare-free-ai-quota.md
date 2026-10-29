# Cloudflare 免费 AI 额度速查（2026-10 核实版）

本页内容由人工对照 Cloudflare 官方文档核实（2026-10-29），数字以官方文档为准。

## 1. Browser Run（云端浏览器）

- Workers 免费计划：每天 10 分钟浏览器运行时间，最多 3 个并发浏览器
- 单次浏览器 60 秒超时（keep_alive 可延长到 10 分钟）
- /crawl 免费档每天 5 个任务，每次最多 100 页
- 超限返回 HTTP 429「Browser time limit exceeded for today」，UTC 日界重置

## 2. AI Search（知识库，前身 AutoRAG）

- 每月免费额度：500 万 token 文档索引、10 GB 存储、1000 次语义搜索、1000 次全文搜索
- 2026-11-01 起超额计费：索引 $0.75/百万 token，存储 $2/GB-月，语义查询 $0.75/千次，全文查询 $0.10/千次
- 单文件限制：OCR PDF 与文本 ≤ 10 MiB，其他 ≤ 4 MiB
- 每实例可存 10 万个文件（免费计划 100 实例）

## 3. Workers AI

- 免费计划每天 10,000 Neurons，UTC 00:00 重置
- 超额后调用报错，需升级付费计划
- 不是所有模型都在免费计划内，部分新模型需要付费权限

## 4. AI Gateway

- 核心功能免费：调用分析、缓存、限流
- 注意：Gateway 免费不代表背后的 GPT、Claude 等模型调用免费
- Guardrails 按 Workers AI token 计费；Unified Billing 对充值加收 5%

## 5. Pi Agent（PiHarness）

- 2026-10-02 进入 Agents SDK：PiHarness（beta）= Pi 1.0 + Pi Durable + Earendil
- 状态存 Durable Object 的 SQLite，崩溃/驱逐后自动恢复
- Workers 免费计划每天 100,000 次请求；Durable Objects 与 Workers AI 各有免费额度
- 官方示例：cloudflare/agents 仓库 examples/next/harnesses/pi
