import type { Currency } from '../money.ts';
export interface PricePerMillion {
    /** input tokens served from prompt cache */
    cacheRead: number;
    /** input tokens not served from cache */
    uncachedInput: number;
    output: number;
    /** undefined/0 = cache writes are billed as plain input (DeepSeek behaves this way) */
    cacheWrite?: number;
}
export interface PriceEntry {
    id: string;
    currency: Currency;
    /** off-peak prices; `peakMultiplier` scales them during billable peak hours */
    perMillion: PricePerMillion;
    peakMultiplier?: number;
    contextTokens: number;
    maxOutputTokens: number;
    aliases?: string[];
    /** a relay/reseller endpoint whose price we guessed at rather than read from a price sheet */
    lowConfidence?: boolean;
    note?: string;
}
export interface PriceCatalog {
    asOf: string;
    source: string;
    entries: PriceEntry[];
}
export declare const CATALOG_STALE_AFTER_DAYS = 45;
/**
 * Snapshot of https://api-docs.deepseek.com/quick_start/pricing taken 2026-09-21.
 * Peak = off-peak x2; peak hours are Beijing workday 09:00-12:00 and 14:00-18:00.
 * Keep this fresh: `dsh-price refresh` prints what the live page says.
 */
export declare const DEEPSEEK_CATALOG: PriceCatalog;
export declare function mergeCatalog(base: PriceCatalog, overrides?: PriceEntry[]): PriceCatalog;
export declare function catalogAgeDays(asOf: string, now?: Date): number;
export declare function isCatalogStale(catalog: PriceCatalog, now?: Date): boolean;
//# sourceMappingURL=catalog.d.ts.map