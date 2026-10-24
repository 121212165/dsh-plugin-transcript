import { type Currency, type Micros } from '../money.ts';
import type { PriceEntry, PricePerMillion } from './catalog.ts';
import { type Regime, type RegimeRules } from './window.ts';
export interface TokenBuckets {
    uncachedInput: number;
    output: number;
    cacheRead: number;
    cacheWrite?: number;
}
export interface CostLine {
    kind: keyof TokenBuckets;
    tokens: number;
    pricePerMillion: number;
    micros: Micros;
}
export interface CostBreakdown {
    currency: Currency;
    regime: Regime;
    lines: CostLine[];
    micros: Micros;
    /** 0..1 — how much of the prompt was reused from cache, the cheapest money saved */
    cacheHitRate: number;
}
export declare function emptyBuckets(): TokenBuckets;
export declare function mergeBuckets(...buckets: TokenBuckets[]): TokenBuckets;
export declare function totalTokens(buckets: TokenBuckets): number;
export declare function cacheHitRate(buckets: TokenBuckets): number;
export declare function effectivePrices(entry: PriceEntry, regime: Regime): PricePerMillion;
export declare function regimeFor(entry: PriceEntry, at: Date, rules: RegimeRules): Regime;
export declare function costOf(buckets: TokenBuckets, entry: PriceEntry, options?: {
    at?: Date;
    rules?: RegimeRules;
}): CostBreakdown;
/** One blended number per 1M tokens, for "这个模型现在大约多少钱一百万 token". */
export declare function blendedPricePerMillion(entry: PriceEntry, share: {
    input: number;
    output: number;
    cacheRead: number;
}, regime: Regime): number;
/**
 * "你还剩 ¥1.16，够再说多少 token？" — splits a budget by the session's historic in/out ratio.
 */
export declare function tokensWithinBudget(budgetMicros: Micros, entry: PriceEntry, ratio: {
    uncachedInput: number;
    output: number;
    cacheRead: number;
}, options?: {
    at?: Date;
    rules?: RegimeRules;
}): {
    uncachedInput: number;
    output: number;
    cacheRead: number;
    micros: Micros;
};
//# sourceMappingURL=cost.d.ts.map