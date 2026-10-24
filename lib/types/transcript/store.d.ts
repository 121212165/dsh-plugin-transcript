import { type TranscriptLine } from './line.ts';
/**
 * Transcript persistence mirrors the other two plugins: monthly JSONL sidecars
 * (tolerant reads, counted skips), plus on-demand markdown rendering into
 * transcripts/ so the durable record stays append-only and re-renderable.
 */
export declare class TranscriptStore {
    readonly dataDir: string;
    constructor(dataDir: string | undefined);
    fileFor(at: string): string;
    append(line: TranscriptLine): void;
    readAll(): {
        records: TranscriptLine[];
        skipped: number;
    };
    readSession(sessionId: string): TranscriptLine[];
    writeMarkdown(name: string, content: string): string;
}
export declare function expandHome(dir: string): string;
//# sourceMappingURL=store.d.ts.map