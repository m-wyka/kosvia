import {
  compositionHash,
  revisionKey,
  type FormulaRevisionRowInput,
} from './formula-revision.service';

const row = (overrides: Partial<FormulaRevisionRowInput> = {}): FormulaRevisionRowInput => ({
  ingredientId: 'aqua',
  rawText: 'Aqua',
  isAfterMayContain: false,
  matchConfidence: 1,
  ...overrides,
});

describe('revisionKey', () => {
  it('keys confident matches by ingredient id', () => {
    expect(revisionKey(row())).toBe('id:aqua');
  });

  it('falls back to normalised raw text for low-confidence matches', () => {
    const key = revisionKey(row({ matchConfidence: 0.5, rawText: 'Aqua / Water' }));
    expect(key.startsWith('raw:')).toBe(true);
  });

  it('falls back to normalised raw text for unmatched tokens', () => {
    expect(
      revisionKey(row({ ingredientId: null, rawText: 'Parfum Mystère' })).startsWith('raw:'),
    ).toBe(true);
  });
});

describe('compositionHash', () => {
  const baseRows = [row(), row({ ingredientId: 'glycerin', rawText: 'Glycerin' })];

  it('is stable for an identical composition', () => {
    expect(compositionHash(baseRows)).toBe(compositionHash([...baseRows]));
  });

  it('changes when an ingredient is added', () => {
    const extended = [...baseRows, row({ ingredientId: 'retinol', rawText: 'Retinol' })];
    expect(compositionHash(extended)).not.toBe(compositionHash(baseRows));
  });

  it('changes when an ingredient is removed', () => {
    expect(compositionHash(baseRows.slice(0, 1))).not.toBe(compositionHash(baseRows));
  });

  it('changes when the order changes', () => {
    expect(compositionHash([...baseRows].reverse())).not.toBe(compositionHash(baseRows));
  });

  it('ignores may-contain rows', () => {
    const withMayContain = [
      ...baseRows,
      row({ ingredientId: 'ci-77491', rawText: 'CI 77491', isAfterMayContain: true }),
    ];
    expect(compositionHash(withMayContain)).toBe(compositionHash(baseRows));
  });

  it('does not change when only the raw spelling of a confident match changes', () => {
    const respelled = [row({ rawText: 'AQUA (WATER)' }), baseRows[1]!];
    expect(compositionHash(respelled)).toBe(compositionHash(baseRows));
  });
});
