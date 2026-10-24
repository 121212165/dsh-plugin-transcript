import { microsForTokens, sumMicros } from '../money.js';
import { isPeakAt } from './window.js';
export function emptyBuckets() {
    return { uncachedInput: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}
export function mergeBuckets(...buckets) {
    return buckets.reduce((acc, b) => ({
        uncachedInput: acc.uncachedInput + (b.uncachedInput ?? 0),
        output: acc.output + (b.output ?? 0),
        cacheRead: acc.cacheRead + (b.cacheRead ?? 0),
        cacheWrite: (acc.cacheWrite ?? 0) + (b.cacheWrite ?? 0),
    }), emptyBuckets());
}
export function totalTokens(buckets) {
    return (buckets.uncachedInput ?? 0) + (buckets.output ?? 0) + (buckets.cacheRead ?? 0) + (buckets.cacheWrite ?? 0);
}
export function cacheHitRate(buckets) {
    const input = (buckets.uncachedInput ?? 0) + (buckets.cacheRead ?? 0);
    return input > 0 ? (buckets.cacheRead ?? 0) / input : 0;
}
export function effectivePrices(entry, regime) {
    const m = regime === 'peak' ? (entry.peakMultiplier ?? 1) : 1;
    // a row that forgot cacheRead must not make cached tokens free, and one that forgot
    // output must not silently bill the most expensive bucket at zero
    const uncachedInput = entry.perMillion.uncachedInput ?? NaN;
    return {
        cacheRead: (entry.perMillion.cacheRead ?? uncachedInput) * m,
        uncachedInput: uncachedInput * m,
        output: (entry.perMillion.output ?? NaN) * m,
        cacheWrite: (entry.perMillion.cacheWrite ?? uncachedInput) * m,
    };
}
export function regimeFor(entry, at, rules) {
    if (entry.peakMultiplier === undefined || entry.peakMultiplier === 1)
        return 'offpeak';
    return isPeakAt(at, rules) ? 'peak' : 'offpeak';
}
export function costOf(buckets, entry, options = {}) {
    const at = options.at ?? new Date();
    const regime = regimeFor(entry, at, options.rules ?? {});
    const prices = effectivePrices(entry, regime);
    const kinds = ['uncachedInput', 'cacheRead', 'cacheWrite', 'output'];
    const lines = [];
    for (const kind of kinds) {
        const tokens = buckets[kind] ?? 0;
        if (tokens <= 0)
            continue;
        const pricePerMillion = prices[kind];
        lines.push({ kind, tokens, pricePerMillion, micros: microsForTokens(tokens, pricePerMillion) });
    }
    return {
        currency: entry.currency,
        regime,
        lines,
        micros: sumMicros(...lines.map((l) => l.micros)),
        cacheHitRate: cacheHitRate(buckets),
    };
}
/** One blended number per 1M tokens, for "这个模型现在大约多少钱一百万 token". */
export function blendedPricePerMillion(entry, share, regime) {
    const prices = effectivePrices(entry, regime);
    const total = share.input + share.output + share.cacheRead;
    if (total <= 0)
        return prices.uncachedInput;
    const weighted = share.input * prices.uncachedInput + share.output * prices.output + share.cacheRead * prices.cacheRead;
    return weighted / total;
}
/**
 * "你还剩 ¥1.16，够再说多少 token？" — splits a budget by the session's historic in/out ratio.
 */
export function tokensWithinBudget(budgetMicros, entry, ratio, options = {}) {
    const total = ratio.uncachedInput + ratio.output + ratio.cacheRead;
    const shares = total > 0
        ? ratio
        : { uncachedInput: 0.8, output: 0.15, cacheRead: 0.05 };
    const regime = regimeFor(entry, options.at ?? new Date(), options.rules ?? {});
    const prices = effectivePrices(entry, regime);
    const costPerTokenUnit = shares.uncachedInput * prices.uncachedInput +
        shares.output * prices.output +
        shares.cacheRead * prices.cacheRead;
    if (costPerTokenUnit <= 0) {
        return { uncachedInput: 0, output: 0, cacheRead: 0, micros: budgetMicros };
    }
    const tokenUnits = budgetMicros / costPerTokenUnit;
    return {
        uncachedInput: Math.floor(tokenUnits * shares.uncachedInput),
        output: Math.floor(tokenUnits * shares.output),
        cacheRead: Math.floor(tokenUnits * shares.cacheRead),
        micros: budgetMicros,
    };
}
//# sourceMappingURL=cost.js.map