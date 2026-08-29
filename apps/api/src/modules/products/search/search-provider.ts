import type { ProductSuggestionDto } from '@kosvia/shared';

export interface RankedCandidate {
  id: string;
  rank: number;
}

/**
 * Everything the catalogue needs from a search engine. Postgres implements it
 * today; a hosted engine could replace it without touching the products
 * service — see 05_WYSZUKIWARKA.md §8.
 */
export interface SearchProvider {
  /** Product ids that match the query, best first, capped at `limit`. */
  rankedCandidates(query: string, limit: number): Promise<RankedCandidate[]>;
  suggest(query: string, limit: number): Promise<ProductSuggestionDto[]>;
}

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');

const EAN_PATTERN = /^\d{8,14}$/;

export const isEanQuery = (query: string): boolean => EAN_PATTERN.test(query.trim());

/** Merges two ranked lists, keeping the best rank when an id appears in both. */
export const mergeCandidates = (
  primary: RankedCandidate[],
  secondary: RankedCandidate[],
): RankedCandidate[] => {
  const byId = new Map<string, number>();
  for (const candidate of [...primary, ...secondary]) {
    const current = byId.get(candidate.id);
    if (current === undefined || candidate.rank > current) {
      byId.set(candidate.id, candidate.rank);
    }
  }
  return [...byId.entries()]
    .map(([id, rank]) => ({ id, rank }))
    .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
};
