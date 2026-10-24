import type { PriceEntry } from './catalog.ts';
export type Regime = 'peak' | 'offpeak';
export interface RegimeRules {
    /** Beijing calendar dates (YYYY-MM-DD) treated as public holidays -> always off-peak */
    holidays?: string[];
    /** minutes-of-day boundaries [startInclusive, endExclusive), Asia/Shanghai wall clock */
    peakMinutes?: ReadonlyArray<readonly [number, number]>;
}
export declare function isHoliday(at: Date | number, rules: RegimeRules): boolean;
export declare function isPeakAt(at: Date | number, rules?: RegimeRules): boolean;
export declare function regimeAt(at?: Date, rules?: RegimeRules): Regime;
/** Next instant at which the billing regime flips, so the agent can say "等 40 分钟省一半". */
export declare function nextRegimeChange(at?: Date, rules?: RegimeRules): {
    at: Date;
    regime: Regime;
} | null;
export declare function minutesUntil(at: Date, now?: Date): number;
export declare function formatDuration(minutes: number): string;
/** What a model actually costs right now, as a multiplier of its sheet price. */
export declare function priceMultiplier(entry: PriceEntry, at?: Date, rules?: RegimeRules): number;
/**
 * Would deferring this spend to the next cheap window save anything?
 * Returns null when there is no peak premium to dodge (flat-priced model).
 */
export declare function deferralAdvice(micros: number, entry: PriceEntry, rules?: RegimeRules, now?: Date): {
    waitMinutes: number;
    savingMicros: number;
} | null;
//# sourceMappingURL=window.d.ts.map