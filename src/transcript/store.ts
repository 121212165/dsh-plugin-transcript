import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseJsonl, type TranscriptLine } from './line.ts';

/**
 * Transcript persistence mirrors the other two plugins: monthly JSONL sidecars
 * (tolerant reads, counted skips), plus on-demand markdown rendering into
 * transcripts/ so the durable record stays append-only and re-renderable.
 */
export class TranscriptStore {
  readonly dataDir: string;

  constructor(dataDir: string | undefined) {
    this.dataDir = dataDir ? expandHome(dataDir) : join(homedir(), '.dsh', 'transcripts');
  }

  fileFor(at: string): string {
    return join(this.dataDir, `transcript-${at.slice(0, 7)}.jsonl`);
  }

  append(line: TranscriptLine): void {
    mkdirSync(this.dataDir, { recursive: true });
    appendFileSync(this.fileFor(line.at), `${JSON.stringify(line)}\n`, 'utf8');
  }

  readAll(): { records: TranscriptLine[]; skipped: number } {
    const records: TranscriptLine[] = [];
    let skipped = 0;
    if (!existsSync(this.dataDir)) return { records, skipped };
    for (const name of readdirSync(this.dataDir).filter(validName).sort()) {
      const result = parseJsonl(readFileSync(join(this.dataDir, name), 'utf8'));
      records.push(...result.records);
      skipped += result.skipped;
    }
    return { records, skipped };
  }

  readSession(sessionId: string): TranscriptLine[] {
    return this.readAll().records.filter((record) => record.sessionId === sessionId);
  }

  writeMarkdown(name: string, content: string): string {
    const dir = join(this.dataDir, 'markdown');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, content, "utf8");
    return file;
  }
}


function validName(name: string): boolean {
  const match = /^transcript-(\d{4})-(\d{2})\.jsonl$/.exec(name);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function expandHome(dir: string): string {
  return dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
}
