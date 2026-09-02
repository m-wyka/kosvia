import {
  isDisplayablePopularQuery,
  normaliseSearchQuery,
  toPopularQueries,
} from './popular-queries';

describe('normaliseSearchQuery', () => {
  it('collapses case and whitespace so one query is counted once', () => {
    expect(normaliseSearchQuery('  Krem   NAWILŻAJĄCY ')).toBe('krem nawilżający');
    expect(normaliseSearchQuery('Retinol')).toBe('retinol');
  });
});

describe('isDisplayablePopularQuery', () => {
  it('rejects a single character and an essay, accepts a real query', () => {
    expect(isDisplayablePopularQuery('a')).toBe(false);
    expect(isDisplayablePopularQuery('x'.repeat(41))).toBe(false);
    expect(isDisplayablePopularQuery('spf 50')).toBe(true);
  });
});

describe('toPopularQueries', () => {
  it('keeps count order, merges spellings and caps the list', () => {
    const queries = toPopularQueries(
      [
        { query: 'Retinol', uses: 40 },
        { query: ' retinol ', uses: 12 },
        { query: 'SPF 50', uses: 9 },
        { query: 'a', uses: 8 },
        { query: 'niacynamid', uses: 5 },
      ],
      3,
    );

    expect(queries).toEqual(['retinol', 'spf 50', 'niacynamid']);
  });

  it('returns nothing when the log is empty', () => {
    expect(toPopularQueries([], 6)).toEqual([]);
  });
});
