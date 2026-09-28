import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textFromContent, textFromStream, textFromStreamChunks, renderTranscript, countWords, type TranscriptEntry } from '../src/transcript/render.ts';

test('stream frames are read in both grouped and flat shapes', () => {
  const grouped = textFromStream([
    { type: 'reasoning-chunks', texts: ['想', '法'], dt: [1, 1] },
    { type: 'text-chunks', texts: ['答', '案'], dt: [2, 2] },
  ]);
  assert.equal(grouped.body, '答案');
  assert.equal(grouped.reasoning, '想法');
  const flat = textFromStream([{ type: 'chunk', chunk: { type: 'text-delta', text: 'hi' } }]);
  assert.equal(flat.body, 'hi');
  assert.equal(textFromStream(undefined).body, '');
  assert.equal(textFromStream([{ type: 'unknown-frame' }]).body, '');
});

test('content extraction handles strings and block arrays, skips unknown blocks', () => {
  assert.equal(textFromContent('plain'), 'plain');
  assert.equal(textFromContent([{ type: 'text', text: 'a' }, { type: 'image', url: 'x' }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(textFromContent(undefined), '');
  assert.equal(textFromContent({ nope: true }), '');
});

test('stream chunks split body from reasoning', () => {
  const { body, reasoning } = textFromStreamChunks([
    { type: 'reasoning-delta', text: '想' },
    { type: 'text-delta', text: '答' },
    { type: 'text-delta', text: '案' },
    { type: 'tool-call', name: 'bash' },
  ]);
  assert.equal(body, '答案');
  assert.equal(reasoning, '想');
});

test('markdown rendering separates user, assistant, tool and system kinds', () => {
  const entries: TranscriptEntry[] = [
    { kind: 'user', at: '2026-09-28T01:00:00.000Z', text: '帮我写个大纲' },
    { kind: 'tool', at: '2026-09-28T01:01:00.000Z', who: 'bash', text: '{"command":"ls"}' },
    { kind: 'assistant', at: '2026-09-28T01:02:00.000Z', who: 'deepseek-v4-pro', text: '大纲如下' },
    { kind: 'system', at: '2026-09-28T01:02:30.000Z', who: 'reasoning', text: '内部思考' },
  ];
  const md = renderTranscript(entries, { sessionId: 'abcdef1234567890', title: '写作' });
  assert.ok(md.startsWith('# 写作'));
  assert.ok(md.includes('## 👤 用户'));
  assert.ok(md.includes('## 🤖 助手 · deepseek-v4-pro'));
  assert.ok(md.includes('`bash`'));
  assert.ok(md.includes('> ℹ️ 内部思考'));
  assert.ok(!md.includes('abcdef12')); // title wins over raw id in the heading
});

test('long tool previews are clipped to keep archives readable', () => {
  const md = renderTranscript([{ kind: 'tool', at: 'x', who: 't', text: 'a'.repeat(500) }], { sessionId: 's' });
  assert.ok(md.includes('…'));
  assert.ok(md.length < 500);
});

test('an empty transcript still renders a valid document', () => {
  const md = renderTranscript([], { sessionId: 'abcdef1234567890' });
  assert.ok(md.startsWith('# Session abcdef12'));
});

test('cjk counting distinguishes characters from total length', () => {
  assert.deepEqual(countWords('中文abc'), { chars: 5, cjk: 2 });
});
