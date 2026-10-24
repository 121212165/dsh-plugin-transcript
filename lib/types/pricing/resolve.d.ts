import type { PriceCatalog, PriceEntry } from './catalog.ts';
export type MatchVia = 'exact' | 'provider-scoped' | 'alias' | 'normalized' | 'contains';
export type ResolveResult = {
    kind: 'known';
    entry: PriceEntry;
    via: MatchVia;
    confidence: number;
} | {
    kind: 'unknown';
    modelId: string;
    candidates: {
        entry: PriceEntry;
        score: number;
    }[];
};
/** lowercases, unifies separators, and drops a trailing date/digest segment */
export declare function normalizeModelId(id: string): string;
export declare function resolveModel(modelId: string, catalog: PriceCatalog, options?: {
    provider?: string;
}): ResolveResult;
export declare function describeResolution(result: ResolveResult): string;
//# sourceMappingURL=resolve.d.ts.map