/**
 * Recovers labels whose commas were lost in a scan: a run like
 * "cetearyl alcohol caprylic capric triglyceride glyceryl stearate" is cut
 * into dictionary names by greedy longest-match. The cut is accepted only
 * when EVERY word ends up inside a known name — anything less and the token
 * is left untouched, so a partly-foreign or partly-garbled run never turns
 * into a half-guessed ingredient list.
 */
export const MAX_SEGMENT_WORDS = 7;
export const MIN_WORDS_TO_SEGMENT = 3;

export const segmentCandidates = (words: string[]): string[] => {
  const candidates = new Set<string>();
  for (let start = 0; start < words.length; start += 1) {
    for (
      let length = 1;
      length <= MAX_SEGMENT_WORDS && start + length <= words.length;
      length += 1
    ) {
      candidates.add(words.slice(start, start + length).join(' '));
    }
  }
  return [...candidates];
};

/** Greedy left-to-right, longest name first; null unless the words are fully covered. */
export const segmentByDictionary = (
  words: string[],
  isKnownName: (candidate: string) => boolean,
): string[] | null => {
  const segments: string[] = [];
  let start = 0;
  while (start < words.length) {
    let matched: string | null = null;
    const longest = Math.min(MAX_SEGMENT_WORDS, words.length - start);
    for (let length = longest; length >= 1; length -= 1) {
      const candidate = words.slice(start, start + length).join(' ');
      if (isKnownName(candidate)) {
        matched = candidate;
        start += length;
        break;
      }
    }
    if (!matched) {
      return null;
    }
    segments.push(matched);
  }
  return segments.length >= 2 ? segments : null;
};
