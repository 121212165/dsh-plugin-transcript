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
export declare const name = "transcript";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    dataDir?: string;
    /** capture tool call lines (name + short argument preview) */
    captureTools: boolean;
    /** capture thinking/reasoning as collapsible blocks */
    captureReasoning: boolean;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    captureTools: Schema<boolean, boolean>;
    captureReasoning: Schema<boolean, boolean>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    captureTools: Schema<boolean, boolean>;
    captureReasoning: Schema<boolean, boolean>;
}>>;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=plugin.d.ts.map