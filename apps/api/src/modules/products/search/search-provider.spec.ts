import { isEanQuery, mergeCandidates } from './search-provider';

describe('isEanQuery', () => {
  it('accepts 8–14 digit barcodes only', () => {
    expect(isEanQuery('5901234567890')).toBe(true);
    expect(isEanQuery(' 12345678 ')).toBe(true);
    expect(isEanQuery('1234567')).toBe(false);
    expect(isEanQuery('590123456789x')).toBe(false);
    expect(isEanQuery('niacinamide 10')).toBe(false);
  });
});

describe('mergeCandidates', () => {
  it('keeps the best rank per id and sorts descending', () => {
    const merged = mergeCandidates(
      [
        { id: 'a', rank: 0.9 },
        { id: 'b', rank: 0.4 },
      ],
      [
        { id: 'b', rank: 0.7 },
        { id: 'c', rank: 0.5 },
      ],
    );
    expect(merged).toEqual([
      { id: 'a', rank: 0.9 },
      { id: 'b', rank: 0.7 },
      { id: 'c', rank: 0.5 },
    ]);
  });

  it('breaks ties deterministically', () => {
    expect(mergeCandidates([{ id: 'z', rank: 1 }], [{ id: 'a', rank: 1 }])).toEqual([
      { id: 'a', rank: 1 },
      { id: 'z', rank: 1 },
    ]);
  });
});
