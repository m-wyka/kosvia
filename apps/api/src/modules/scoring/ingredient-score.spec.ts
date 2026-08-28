import { computeIngredientScore } from './ingredient-score';
import { AQUA, GLYCERIN, NIACINAMIDE, PARFUM, ingredient } from './__fixtures__';

const list = (...ingredients: Array<ReturnType<typeof ingredient>>) =>
  ingredients.map((entry, index) => ({ position: index + 1, ingredient: entry }));

describe('computeIngredientScore', () => {
  it('returns a neutral score and a note when there is no ingredient list', () => {
    const result = computeIngredientScore([]);
    expect(result.score).toBe(50);
    expect(result.notes[0]?.code).toBe('ingredient-no-list');
  });

  it('rewards actives and supportive ingredients', () => {
    const plain = computeIngredientScore(list(AQUA, AQUA, AQUA));
    const rich = computeIngredientScore(list(AQUA, GLYCERIN, NIACINAMIDE));
    expect(rich.score).toBeGreaterThan(plain.score);
    expect(rich.activeCount).toBe(1);
    expect(rich.supportiveCount).toBe(2);
  });

  it('penalises fragrance more heavily the higher it sits in the list', () => {
    const early = computeIngredientScore(list(AQUA, PARFUM, GLYCERIN, NIACINAMIDE));
    const late = computeIngredientScore(list(AQUA, GLYCERIN, NIACINAMIDE, PARFUM));
    expect(early.score).toBeLessThan(late.score);
    expect(early.notes.some((note) => note.code === 'ingredient-fragrance-high')).toBe(true);
  });

  it('counts fragrance as a potential irritant without calling it harmful', () => {
    const result = computeIngredientScore(list(AQUA, PARFUM));
    expect(result.potentialIrritantCount).toBe(1);
    expect(result.notes.map((note) => note.text).join(' ')).not.toMatch(
      /toxic|dangerous|harmful|bad/i,
    );
  });

  it('flags a high comedogenic rating only when it appears high in the list', () => {
    const heavy = ingredient({ id: 'coconut', inciName: 'Coconut Oil', tags: ['occlusive'], comedogenicRating: 4 });
    const early = computeIngredientScore(list(AQUA, heavy, GLYCERIN));
    const buried = computeIngredientScore(
      list(AQUA, GLYCERIN, GLYCERIN, GLYCERIN, GLYCERIN, GLYCERIN, GLYCERIN, GLYCERIN, heavy),
    );
    expect(early.notes.some((n) => n.code === 'ingredient-comedogenic')).toBe(true);
    expect(buried.notes.some((n) => n.code === 'ingredient-comedogenic')).toBe(false);
  });

  it('never leaves the 0-100 range', () => {
    const allFragrance = computeIngredientScore(list(PARFUM, PARFUM, PARFUM, PARFUM, PARFUM));
    const allActives = computeIngredientScore(list(NIACINAMIDE, NIACINAMIDE, NIACINAMIDE, NIACINAMIDE));
    for (const result of [allFragrance, allActives]) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic', () => {
    const input = list(AQUA, GLYCERIN, NIACINAMIDE, PARFUM);
    expect(computeIngredientScore(input)).toEqual(computeIngredientScore(input));
  });

  it('does not reward padding a formula with filler', () => {
    const focused = computeIngredientScore(list(AQUA, GLYCERIN, NIACINAMIDE));
    const padded = computeIngredientScore(
      list(AQUA, GLYCERIN, NIACINAMIDE, AQUA, AQUA, AQUA, AQUA, AQUA, AQUA, AQUA),
    );
    expect(padded.score).toBeLessThanOrEqual(focused.score);
  });
});
