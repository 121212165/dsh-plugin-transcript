# dsh-plugin-transcript

DeepSeek Harness (dsh) 插件：会话转录归档器。把每次会话的用户输入、助手输出、工具调用实时追加进按月 JSONL 边车，随时（或会话结束自动）渲染成 Markdown 存档——为"把 AI 会话变成可检索资产"的工作流（Obsidian 归档、写作素材库）服务。

同系列：[dsh-plugin-cost-ledger](https://github.com/121212165/dsh-plugin-cost-ledger)（钱的台账）、[dsh-plugin-session-insights](https://github.com/121212165/dsh-plugin-session-insights)（跨会话统计）、[dsh-plugin-price-aware](https://github.com/121212165/dsh-plugin-price-aware)（预算与报价）。

## 功能

- **实时捕获**：`user/message`、`assistant/message`（文本流帧，thinking 可选）、`tool/call`（工具名 + 参数预览）→ `~/.dsh/transcripts/transcript-YYYY-MM.jsonl`。
- **`/transcript`**：当前会话记录条数、中文字符/总字符数、JSONL 位置。
- **`/transcript-export`**：渲染当前会话为 Markdown（用户/助手二级标题、工具行内联、思考折叠块）。
- **自动归档**：`session/disposed` 时自动 flush Markdown 到 `dataDir/markdown/<sessionId>.md`。
- **容错**：崩溃半行跳过并计数；提取器对未知 payload 形状降级为"少文本"而非崩溃。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | |
| `dataDir` | `~/.dsh/transcripts` | 边车 + `markdown/` 渲染目录 |
| `captureTools` | `true` | 工具调用行 |
| `captureReasoning` | `false` | thinking 文本（作为引用块） |

## Markdown 输出形状

```markdown
# 会话标题（来自 session/title，缺省用 sessionId 前缀）
> N 条记录 · 导出于渲染时刻

## 👤 用户
…

- 🔧 `bash` — {"command":"ls"}

## 🤖 助手 · deepseek-v4-pro
…
```

## 查证状态（诚实清单）

- **已验证**：事件类型 `user/message` / `assistant/message` / `tool/call` / `session/title` 均来自官方仓库生成文件 `packages/core/session/src/known-event-types.ts`；`session/event`、`session/disposed`、`commands.register` 与 price-aware 的已验证事件面一致。
- **版本适配**：安装版 `@deepseek-ai/dsh-llm`（0.1.2-alpha.4）没有 master 文档里的 `expandAssistantStream`，因此流帧解析用自带的容错提取器（同时支持 grouped `text-chunks`/`reasoning-chunks` 帧与 flat chunk 帧，形状来自 dsh-token-telemetry 已验证的流处理）。**assistant/message 的 `data.stream` 具体序列化形状未在运行中的 dsh 里实测**——如果提取为空，请开一个 issue 附一行 JSONL 样本。
- **未验证**：未 live mount；`user/message` 的 content 块形状按 dsh 内容块通用结构（`{type:'text',text}`）容错提取。
- **已知局限**：会话中途 dsh 崩溃时 Markdown 不会自动 flush（JSONL 数据无损，可用 /transcript-export 重渲）；工具结果全文不捕获（只记调用），避免归档膨胀。
