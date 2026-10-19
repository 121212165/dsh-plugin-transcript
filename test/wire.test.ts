/**
 * Wire-level (assembly layer) tests for transcript: mount the real apply()
 * against a scripted cordis context and drive real session events end to end,
 * asserting the JSONL sidecar lands and reads back, the plumbing filters hold,
 * the reasoning/capture flags behave, and dispose flushes a markdown archive.
 * Template: dsh-plugin-quota/test/harness.ts (style: dsh-plugin-tool-trace/test/wire.test.ts).
 * @module test/wire
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { parseJsonl } from '../src/transcript/line.ts';

interface Listener { event: string; callback: (...args: unknown[]) => unknown }

interface CapturedCommand { name: string; handler: (args: { agent?: unknown }) => { kind: string; text: string } }

type Apply = (ctx: unknown, config: Record<string, unknown>) => void;

const plugin = await import('../src/plugin.ts');
const apply = plugin.apply as unknown as Apply;

function cmdLogger() {
  return { info() {}, warn() {}, debug() {} };
}

function fire(listeners: Listener[], event: string, session: unknown, payload: unknown): void {
  const listener = listeners.find((candidate) => candidate.event === event);
  if (!listener) throw new Error(`${event} listener was never registered`);
  listener.callback(session, payload);
}

function mount(config: Record<string, unknown> = {}): { commands: CapturedCommand[]; listeners: Listener[]; dataDir: string } {
  const commands: CapturedCommand[] = [];
  const listeners: Listener[] = [];
  const dataDir = mkdtempSync(join(tmpdir(), 'transcript-wire-'));
  after(() => rmSync(dataDir, { recursive: true, force: true }));
  const ctx = {
    logger: cmdLogger,
    on(event: string, callback: (...args: unknown[]) => unknown) { listeners.push({ event, callback }); },
    commands: { register(definition: CapturedCommand) { commands.push(definition); } },
  };
  apply(ctx, { enabled: true, dataDir, captureTools: true, captureReasoning: false, ...config });
  return { commands, listeners, dataDir };
}

test('mount registers both commands and both listeners; disabled mounts nothing', () => {
  const { commands, listeners } = mount();
  assert.deepEqual(commands.map((command) => command.name).sort(), ['transcript', 'transcript-export']);
  assert.deepEqual(listeners.map((listener) => listener.event).sort(), ['session/disposed', 'session/event']);

  const disabled = {
    logger: cmdLogger,
    on() { assert.fail('listener registered while disabled'); },
    commands: { register() { assert.fail('command registered while disabled'); } },
  };
  apply(disabled, { enabled: false });
});

test('a user/assistant/tool exchange lands in the monthly JSONL and /transcript reports it', () => {
  const { commands, listeners, dataDir } = mount();
  const session = { id: 'session-wire-a' };
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '你好，帮我查台账' } });
  fire(listeners, 'session/event', session, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已查询到 3 条记录' }] } } });
  fire(listeners, 'session/event', session, { type: 'tool/call', data: { name: 'read_file', arguments: { q: '台账' }, turn: 2 } });

  const file = readdirSync(dataDir)[0]!;
  assert.match(file, /^transcript-\d{4}-\d{2}\.jsonl$/, `monthly sidecar name: ${file}`);
  const parsed = parseJsonl(readFileSync(join(dataDir, file), 'utf8'));
  assert.equal(parsed.skipped, 0, 'no line is torn on the write path');

  const records = parsed.records.filter((record) => record.sessionId === 'session-wire-a');
  assert.deepEqual(records.map((record) => record.kind), ['user', 'assistant', 'tool']);
  assert.ok(records.every((record) => record.v === 1), 'every record carries the schema version');
  const toolRecord = records[2]!;
  assert.equal(toolRecord.who, 'read_file');
  assert.ok(toolRecord.text.includes('台账'), `argument preview stored as text: ${toolRecord.text}`);
  assert.equal(toolRecord.turn, 2);

  const status = commands.find((candidate) => candidate.name === 'transcript')!.handler({ agent: session });
  assert.equal(status.kind, 'success');
  assert.ok(status.text.includes('已记录 3 条'), status.text);
  assert.ok(status.text.includes('.jsonl'), status.text);
});

test('system reminders, runtime snapshots, replays, empties, and titles stay out of the archive', () => {
  const { listeners, dataDir } = mount();
  const session = { id: 'session-wire-c' };
  fire(listeners, 'session/event', session, { type: 'session/title', data: { title: '台账盘点' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '<system-reminder>hidden plumbing</system-reminder>' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: 'Current runtime context: cheatsheet' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: { blocks: true } } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '盘点开始' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '盘点开始' } });
  fire(listeners, 'session/event', session, { type: 'assistant/message', data: {} });
  fire(listeners, 'session/event', session, { type: 'tool/call', data: { arguments: {} } });

  const file = readdirSync(dataDir)[0]!;
  const records = parseJsonl(readFileSync(join(dataDir, file), 'utf8')).records.filter((record) => record.sessionId === 'session-wire-c');
  assert.equal(records.length, 1, `exactly one real turn recorded: ${records.length}`);
  assert.equal(records[0]!.text, '盘点开始');
  assert.ok(!records.some((record) => record.text.includes('台账盘点')), 'the tracked title is never persisted as a line');

  // session/title is kept in memory so the later markdown flush can use it (see dispose test)
  fire(listeners, 'session/event', session, { type: 'session/title', data: { title: 42 } });
  fire(listeners, 'session/event', session, { type: 'session/title', data: {} });
  const after = parseJsonl(readFileSync(join(dataDir, file), 'utf8')).records.filter((record) => record.sessionId === 'session-wire-c');
  assert.equal(after.length, 1, 'malformed titles change nothing');
});

test('captureTools=false drops tool lines; stream frames reconstruct the assistant turn', () => {
  const { listeners, dataDir } = mount({ captureTools: false });
  const session = { id: 'session-wire-s' };
  fire(listeners, 'session/event', session, { type: 'tool/call', data: { name: 'read_file', arguments: {} } });
  fire(listeners, 'session/event', session, {
    type: 'assistant/message',
    data: { turn: 3, stream: [{ type: 'text-delta', text: '账本' }, { type: 'reasoning-delta', text: '心思' }, { type: 'chunk', chunk: { type: 'text-delta', text: '已合并' } }] },
  });

  const file = readdirSync(dataDir)[0]!;
  const records = parseJsonl(readFileSync(join(dataDir, file), 'utf8')).records.filter((record) => record.sessionId === 'session-wire-s');
  assert.equal(records.length, 1, `only the assistant turn is kept: ${records.length}`);
  assert.equal(records[0]!.kind, 'assistant');
  assert.equal(records[0]!.text, '账本已合并', 'flat and grouped stream shapes concatenate in order');
  assert.equal(records[0]!.turn, 3);
  assert.ok(!records[0]!.text.includes('心思'), 'reasoning stays out while captureReasoning is off');
});

test('captureReasoning=true records the reasoning stream as a system block', () => {
  const { listeners, dataDir } = mount({ captureReasoning: true });
  const session = { id: 'session-wire-r' };
  fire(listeners, 'session/event', session, {
    type: 'assistant/message',
    data: { turn: 4, stream: [{ type: 'text-delta', text: '缓存里还有 2 条' }, { type: 'reasoning-delta', text: '为估算先查缓存' }] },
  });

  const file = readdirSync(dataDir)[0]!;
  const records = parseJsonl(readFileSync(join(dataDir, file), 'utf8')).records.filter((record) => record.sessionId === 'session-wire-r');
  assert.deepEqual(records.map((record) => record.kind), ['system', 'assistant'], 'reasoning is stored before the settled body');
  const reasoning = records[0]!;
  assert.equal(reasoning.who, 'reasoning');
  assert.equal(reasoning.turn, 4);
  assert.equal(reasoning.text, '为估算先查缓存');
  assert.ok(!records[1]!.text.includes('为估算'), 'reasoning never bleeds into the assistant body');
});

test('session/disposed flushes a markdown archive; /transcript-export renders on demand and errors when empty', () => {
  const { commands, listeners, dataDir } = mount();
  const session = { id: 'session-wire-flush' };
  fire(listeners, 'session/event', session, { type: 'session/title', data: { title: '台账盘点' } });
  fire(listeners, 'session/event', session, { type: 'user/message', data: { content: '开始盘点' } });
  fire(listeners, 'session/event', session, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已核对 3 条' }] } } });
  fire(listeners, 'session/disposed', session, {});

  const markdown = join(dataDir, 'markdown', 'wire-flush.md');
  assert.ok(existsSync(markdown), 'dispose wrote the archive');
  const content = readFileSync(markdown, 'utf8');
  assert.ok(content.includes('# 台账盘点'), 'the tracked title heads the document');
  assert.ok(content.includes('## 👤 用户') && content.includes('开始盘点'), content);
  assert.ok(content.includes('> 2 条记录'), content);

  const exportCommand = commands.find((candidate) => candidate.name === 'transcript-export')!;
  const again = exportCommand.handler({ agent: session });
  assert.equal(again.kind, 'success');
  assert.ok(again.text.includes('已写出'), again.text);

  const empty = exportCommand.handler({ agent: { session: { id: 'session-never' } } });
  assert.equal(empty.kind, 'error');
  assert.ok(empty.text.includes('还没有可导出的转录'), empty.text);
});
