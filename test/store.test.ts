import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TranscriptStore } from '../src/transcript/store.ts';
import { toLine, parseJsonl, type TranscriptLineInput } from '../src/transcript/line.ts';
import { renderTranscript, type TranscriptEntry } from '../src/transcript/render.ts';

const input = (over: Partial<TranscriptLineInput>): TranscriptLineInput => ({
  sessionId: 's1',
  at: '2026-09-28T01:00:00.000Z',
  kind: 'user',
  text: 'hello',
  ...over,
});

test('appends split by month; markdown flush works and survives a torn line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'transcript-'));
  const store = new TranscriptStore(dir);
  store.append(toLine(input({})));
  store.append(toLine(input({ kind: 'assistant', at: '2026-09-28T01:05:00.000Z', text: 'reply' })));
  store.append(toLine(input({ at: '2026-10-01T00:00:00.000Z' })));
  const sep = join(dir, 'transcript-2026-09.jsonl');
  writeFileSync(sep, readFileSync(sep, 'utf8') + 'torn\n');
  const all = store.readAll();
  assert.equal(all.records.length, 3);
  assert.equal(all.skipped, 1);
  const entries: TranscriptEntry[] = all.records
    .filter((line) => line.sessionId === 's1')
    .map((line) => ({ kind: line.kind, at: line.at, turn: line.turn, who: line.who, text: line.text }));
  const file = store.writeMarkdown('s1.md', renderTranscript(entries, { sessionId: 's1' }));
  assert.ok(existsSync(file));
  assert.ok(readFileSync(file, 'utf8').includes('## 🤖 助手'));
  rmSync(dir, { recursive: true, force: true });
});

test('future schema versions and bad kinds are rejected', () => {
  assert.equal(parseJsonl('{"v":2,"sessionId":"s","at":"2026-09-28T01:00:00.000Z","kind":"user","text":"x"}').skipped, 1);
  assert.equal(parseJsonl('{"v":1,"sessionId":"s","at":"2026-09-28T01:00:00.000Z","kind":"alien","text":"x"}').skipped, 1);
  assert.equal(parseJsonl('{"v":1,"sessionId":"s","at":"2026-09-28T01:00:00.000Z","kind":"user"}').skipped, 1);
  assert.equal(parseJsonl('').records.length, 0);
});

test('~ expands to home', () => {
  const store = new TranscriptStore('~/.dsh/transcripts');
  assert.ok(!store.dataDir.startsWith('~'));
});
