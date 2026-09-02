const MIN_POPULAR_QUERY_LENGTH = 2;
const MAX_POPULAR_QUERY_LENGTH = 40;

export interface PopularQueryRow {
  query: string;
  uses: number;
}

/** Search logs keep whatever the visitor typed, so two spellings of one query
 * must collapse before anything is counted or shown. */
export const normaliseSearchQuery = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toLowerCase();

export const isDisplayablePopularQuery = (query: string): boolean =>
  query.length >= MIN_POPULAR_QUERY_LENGTH && query.length <= MAX_POPULAR_QUERY_LENGTH;

/**
 * Turns raw grouped log rows into the list the search panel shows: normalised,
 * deduplicated, length-bounded and capped, keeping the order the counts gave.
 */
export const toPopularQueries = (rows: PopularQueryRow[], limit: number): string[] => {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const row of rows) {
    const query = normaliseSearchQuery(row.query);
    if (!isDisplayablePopularQuery(query) || seen.has(query)) {
      continue;
    }
    seen.add(query);
    queries.push(query);
    if (queries.length === limit) {
      break;
    }
  }

  return queries;
};
