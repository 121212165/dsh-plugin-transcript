/**
 * dsh wiring for the transcript plugin.
 *
 * Event vocabulary verified against packages/core/session/src/known-event-types.ts
 * (generated in the official repo): user/message, assistant/message, tool/call,
 * session/title. Text extraction is tolerant — a payload shape change degrades
 * to less text, never a crash.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-session';

import { TranscriptStore } from './transcript/store.ts';
import { toLine } from './transcript/line.ts';
import { textFromContent, textFromStream, renderTranscript, countWords, type TranscriptEntry } from './transcript/render.ts';

export const name = 'transcript';
export const inject = ['commands', 'llm', 'sessions'];

export interface Config {
  enabled: boolean;
  dataDir?: string;
  /** capture tool call lines (name + short argument preview) */
  captureTools: boolean;
  /** capture thinking/reasoning as collapsible blocks */
  captureReasoning: boolean;
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  dataDir: Schema.string().default(''),
  captureTools: Schema.boolean().default(true),
  captureReasoning: Schema.boolean().default(false),
});

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('transcript');
  if (!config.enabled) return void log.info('disabled by config');

  const store = new TranscriptStore(config.dataDir);
  const titleBySession = new Map<string, string>();
  const seenUserTexts = new Set<string>();

  const sessionIdOf = (agent: unknown): string => {
    const value = agent as { id?: string; session?: { id?: string } } | undefined;
    return String(value?.session?.id ?? value?.id ?? 'session');
  };

  const append = (sessionId: string, entry: Omit<TranscriptEntry, 'sessionId'>): void => {
    try {
      store.append(toLine({ sessionId, ...entry }));
    } catch (error) {
      log.warn(`transcript append failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  ctx.on('session/event', (session, event) => {
    const sessionId = String((session as { id?: unknown }).id ?? 'session');
    const at = new Date().toISOString();

    const loose = event as { type: string; data?: { title?: unknown } | undefined };
    if (loose.type === 'session/title') {
      const title = loose.data?.title;
      if (typeof title === 'string') titleBySession.set(sessionId, title);
      return;
    }
    if (event.type === 'user/message') {
      const text = textFromContent((event.data as { content?: unknown } | undefined)?.content);
      // per-turn runtime snapshots and system reminders are context plumbing,
      // not user intent; identical replays of the same prompt are dropped too
      if (!text) return;
      if (text.startsWith('<system-reminder>') || text.startsWith('Current runtime context')) return;
      const dedupeKey = `${sessionId}\x00${text}`;
      if (seenUserTexts.has(dedupeKey)) return;
      seenUserTexts.add(dedupeKey);
      if (seenUserTexts.size > 500) seenUserTexts.clear();
      append(sessionId, { kind: 'user', at, text });
      return;
    }
    if (event.type === 'assistant/message') {
      const data = event.data as { message?: { content?: unknown }; stream?: unknown; turn?: unknown } | undefined;
      // the settled message's content blocks are authoritative (verified against
      // the installed agent-loop: createAssistantMessage({content})); stream
      // frames stay as fallback for adapters that omit message
      let body = '';
      let reasoning = '';
      if (data?.message?.content) {
        body = textFromContent(data.message.content);
      } else {
        const extracted = textFromStream(data?.stream);
        body = extracted.body;
        reasoning = extracted.reasoning;
      }
      const turn = typeof data?.turn === 'number' ? data.turn : undefined;
      if (config.captureReasoning && reasoning) append(sessionId, { kind: 'system', at, turn, who: 'reasoning', text: reasoning });
      if (body) append(sessionId, { kind: 'assistant', at, turn, text: body });
      return;
    }
    if (event.type === 'tool/call' && config.captureTools) {
      const data = event.data as { name?: unknown; arguments?: unknown; turn?: unknown } | undefined;
      if (typeof data?.name === 'string') {
        const preview = data.arguments === undefined ? '' : JSON.stringify(data.arguments).slice(0, 500);
        append(sessionId, { kind: 'tool', at, who: data.name, text: preview, turn: typeof data.turn === 'number' ? data.turn : undefined });
      }
    }
  });

  // flush a markdown render when a session goes away, so archives exist without a manual command
  ctx.on('session/disposed', (session) => {
    const sessionId = String((session as { id?: unknown }).id ?? '');
    try {
      const lines = store.readSession(sessionId);
      if (!lines.length) return;
      const entries: TranscriptEntry[] = lines.map((line) => ({ kind: line.kind, at: line.at, turn: line.turn, who: line.who, text: line.text }));
      const file = store.writeMarkdown(`${sessionId.replace(/^session-/, "").slice(0, 12)}.md`, renderTranscript(entries, { sessionId, title: titleBySession.get(sessionId) }));
      log.info(`transcript flushed -> ${file}`);
    } catch (error) {
      log.warn(`transcript flush failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ctx.commands.register({
    name: 'transcript',
    description: '当前会话的转录状态（条数、字数、文件位置）',
    handler: ({ agent }) => {
      const sessionId = sessionIdOf(agent);
      const lines = store.readSession(sessionId);
      const text = lines.map((line) => line.text).join('\n');
      const words = countWords(text);
      return {
        kind: 'success',
        text: `会话 ${sessionId.slice(0, 8)}… 已记录 ${lines.length} 条（${words.cjk} 中文字符 / ${words.chars} 总字符）。JSONL: ${store.fileFor(lines[0]?.at ?? new Date().toISOString())}。/transcript-export 渲染为 Markdown。`,
      };
    },
  });

  ctx.commands.register({
    name: 'transcript-export',
    description: '把当前会话转录渲染为 Markdown 并写出',
    handler: ({ agent }) => {
      const sessionId = sessionIdOf(agent);
      const lines = store.readSession(sessionId);
      if (!lines.length) return { kind: 'error', text: '当前会话还没有可导出的转录。' };
      const entries: TranscriptEntry[] = lines.map((line) => ({ kind: line.kind, at: line.at, turn: line.turn, who: line.who, text: line.text }));
      const file = store.writeMarkdown(`${sessionId.replace(/^session-/, "").slice(0, 12)}.md`, renderTranscript(entries, { sessionId, title: titleBySession.get(sessionId) }));
      return { kind: 'success', text: `已写出 -> ${file}` };
    },
  });

  log.info(`mounted · dataDir=${store.dataDir}`);
}
