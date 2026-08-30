import { segmentByDictionary, segmentCandidates } from './inci-segmenter';

const DICTIONARY = new Set([
  'cetearyl alcohol',
  'caprylic capric triglyceride',
  'glyceryl stearate',
  'aqua',
  'glycerin',
  'zinc',
  'zinc oxide',
]);
const has = (candidate: string) => DICTIONARY.has(candidate);

describe('segmentByDictionary', () => {
  it('cuts a scan-mangled run into dictionary names', () => {
    const words = 'cetearyl alcohol caprylic capric triglyceride glyceryl stearate'.split(' ');
    expect(segmentByDictionary(words, has)).toEqual([
      'cetearyl alcohol',
      'caprylic capric triglyceride',
      'glyceryl stearate',
    ]);
  });

  it('prefers the longest name at each step', () => {
    expect(segmentByDictionary('zinc oxide glycerin'.split(' '), has)).toEqual([
      'zinc oxide',
      'glycerin',
    ]);
  });

  it('refuses when any word stays uncovered', () => {
    expect(segmentByDictionary('aqua unbekannt glycerin'.split(' '), has)).toBeNull();
  });

  it('refuses a run that is one name already', () => {
    expect(segmentByDictionary('caprylic capric triglyceride'.split(' '), has)).toBeNull();
  });
});

describe('segmentCandidates', () => {
  it('lists every window up to the segment limit', () => {
    const candidates = segmentCandidates(['aqua', 'zinc', 'oxide']);
    expect(candidates).toEqual(
      expect.arrayContaining([
        'aqua',
        'zinc',
        'oxide',
        'aqua zinc',
        'zinc oxide',
        'aqua zinc oxide',
      ]),
    );
  });
});
