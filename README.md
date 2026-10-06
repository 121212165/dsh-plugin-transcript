# dsh-plugin-transcript

> 🧩 **dsh 插件家族**（22 件）：总目录 **[dsh-plugin-family](https://github.com/121212165/dsh-plugin-family)** ｜ 明星插件：**[ide-hub](https://github.com/121212165/dsh-plugin-ide-hub)** 跨 IDE 统一管理 · **[task-forge](https://github.com/121212165/dsh-plugin-task-forge)** 跨窗口无损交接 · **[quota](https://github.com/121212165/dsh-plugin-quota)** 实时用量仪表


**EN** · The data layer other plugins read: archives every session turn (`user/message`, `assistant/message`, `tool/call`, `session/title`) into monthly JSONL sidecars and renders Markdown on demand (`/transcript`, `/transcript-export`). dsh-plugin-transcript-search, dsh-plugin-obsidian-push and dsh-plugin-html-report all consume these files. · 10 `node --test` green · event types taken from the harness's own generated type files · not live-mounted · if dsh crashes mid-session the Markdown is not auto-flushed (JSONL stays intact and re-renderable).

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

## 安装

三步，实测于 `@deepseek-ai/dsh@0.1.7-alpha.1`（需 `pnpm` 在 PATH 上）：

```sh
# ① 装进 profile：dsh plugin 把参数原样转发给 pnpm，git 包会自动跑 prepare 构建 lib/
dsh plugin --profile web add github:121212165/dsh-plugin-transcript
```

② 把本仓库根目录 `cordis.patch.yml` 的内容**并进** `$DSH_HOME/profiles/web/cordis.patch.yml`。
该文件默认是 `[]`，所以要么整份替换，要么把 insert 条目并进同一个数组；**不要直接追加**——
追加会形成两个 YAML 文档，启动即报
`failed to parse overlay ... end of the stream or a document separator is expected`（本机实测踩过）。

③ 重启 dsh。配置层与 client 半都要重启才生效（客户端按 boot 时算出的内容 rev 下发，硬刷新浏览器没用）。

自检挂载：`dsh --profile web --dump-config | grep dsh-plugin-transcript`，应看到该条目。
## 验证状态

- **已验证**：事件类型 `user/message` / `assistant/message` / `tool/call` / `session/title` 均来自官方仓库生成文件 `packages/core/session/src/known-event-types.ts`；`session/event`、`session/disposed`、`commands.register` 与 price-aware 的已验证事件面一致。
- **版本适配**：安装版 `@deepseek-ai/dsh-llm`（0.1.2-alpha.4）没有 master 文档里的 `expandAssistantStream`，因此流帧解析用自带的容错提取器（同时支持 grouped `text-chunks`/`reasoning-chunks` 帧与 flat chunk 帧，形状来自 dsh-token-telemetry 已验证的流处理）。**assistant/message 的 `data.stream` 具体序列化形状未在运行中的 dsh 里实测**——如果提取为空，请开一个 issue 附一行 JSONL 样本。
- **未验证**：未 live mount；`user/message` 的 content 块形状按 dsh 内容块通用结构（`{type:'text',text}`）容错提取。
- **已知局限**：会话中途 dsh 崩溃时 Markdown 不会自动 flush（JSONL 数据无损，可用 /transcript-export 重渲）；工具结果全文不捕获（只记调用），避免归档膨胀。
