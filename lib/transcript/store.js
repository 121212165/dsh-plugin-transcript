import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from '@dsh-family/kit';
import { parseJsonl } from './line.js';
/**
 * Transcript persistence mirrors the other two plugins: monthly JSONL sidecars
 * (tolerant reads, counted skips), plus on-demand markdown rendering into
 * transcripts/ so the durable record stays append-only and re-renderable.
 */
export class TranscriptStore {
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir ? expandHome(dataDir) : join(homedir(), '.dsh', 'transcripts');
    }
    fileFor(at) {
        return join(this.dataDir, `transcript-${at.slice(0, 7)}.jsonl`);
    }
    append(line) {
        mkdirSync(this.dataDir, { recursive: true });
        appendFileSync(this.fileFor(line.at), `${JSON.stringify(line)}\n`, 'utf8');
    }
    readAll() {
        const records = [];
        let skipped = 0;
        if (!existsSync(this.dataDir))
            return { records, skipped };
        for (const name of readdirSync(this.dataDir).filter(validName).sort()) {
            const result = parseJsonl(readFileSync(join(this.dataDir, name), 'utf8'));
            records.push(...result.records);
            skipped += result.skipped;
        }
        return { records, skipped };
    }
    readSession(sessionId) {
        return this.readAll().records.filter((record) => record.sessionId === sessionId);
    }
    writeMarkdown(name, content) {
        const dir = join(this.dataDir, 'markdown');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, name);
        writeFileAtomic(file, content);
        return file;
    }
}
function validName(name) {
    const match = /^transcript-(\d{4})-(\d{2})\.jsonl$/.exec(name);
    if (!match)
        return false;
    const month = Number(match[2]);
    return month >= 1 && month <= 12;
}
export function expandHome(dir) {
    return dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
}
//# sourceMappingURL=store.js.map