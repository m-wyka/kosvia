/**
 * Turns the text printed on a cosmetic label into ordered tokens.
 *
 * Pure functions, no I/O: the whole pipeline can be exercised against real
 * labels in a unit test. Matching tokens to the dictionary lives in
 * InciMatcherService.
 */

export interface ParsedToken {
  /** The token exactly as it appeared on the label, trimmed. */
  rawText: string;
  /** Lowercase, ASCII-folded, parentheticals removed. */
  normalized: string;
  /** Normalised `Water\Aqua\Eau` fragments; a single entry when no slash. */
  fragments: string[];
  /** Common names found in brackets — alias candidates ("Shea", "Vitamin E"). */
  parentheticals: string[];
  isAfterMayContain: boolean;
  position: number;
}

export interface ParsedLabel {
  tokens: ParsedToken[];
  hasMayContainSection: boolean;
}

const LABEL_PREFIX = /^\s*(ingredients|ingrédients|inhaltsstoffe|składniki|inci|skład)\s*[:.]?\s*/i;
const MAY_CONTAIN =
  /(\[?\s*(\+\/-|±)\s*)?(may\s+contain|peut\s+contenir|może\s+zawierać|kann\s+enthalten)\s*[:.]?/i;
const TRAILING_FOOTNOTE = /\*+\s*[^,;]*$/;
const CI_NUMBER = /^ci\s*(\d{5})$/;
const SLASH_SEPARATOR = /\s*[\\/]\s*/;
const OPENING_BRACKETS = new Set(['(', '[']);
const CLOSING_BRACKETS = new Set([')', ']']);
const TOKEN_SEPARATORS = new Set([',', ';']);

export const cleanLabel = (raw: string): string =>
  raw
    .replace(/ /g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(LABEL_PREFIX, '')
    .replace(TRAILING_FOOTNOTE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.;,]\s*$/, '')
    .trim();

export const splitMayContain = (label: string): { main: string; mayContain: string } => {
  const match = MAY_CONTAIN.exec(label);
  if (!match) {
    return { main: label, mayContain: '' };
  }
  const main = label.slice(0, match.index).replace(/[\s,;.[]+$/, '');
  const mayContain = label
    .slice(match.index + match[0].length)
    .replace(/^[\s:.]+/, '')
    .replace(/\]\s*$/, '');
  return { main, mayContain };
};

export const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  let buffer = '';
  let depth = 0;
  for (const character of text) {
    if (OPENING_BRACKETS.has(character)) {
      depth += 1;
    } else if (CLOSING_BRACKETS.has(character)) {
      depth = Math.max(0, depth - 1);
    }
    if (TOKEN_SEPARATORS.has(character) && depth === 0) {
      tokens.push(buffer);
      buffer = '';
    } else {
      buffer += character;
    }
  }
  tokens.push(buffer);
  return tokens.map((token) => token.replace(/^[\s*]+|[\s*]+$/g, '')).filter(Boolean);
};

export const foldToAscii = (value: string): string =>
  value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

export const normalizeToken = (token: string): string => {
  const folded = foldToAscii(token)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ciNumber = CI_NUMBER.exec(folded);
  return ciNumber ? `ci ${ciNumber[1]}` : folded;
};

export const extractParentheticals = (token: string): string[] =>
  Array.from(token.matchAll(/\(([^)]*)\)/g), (match) => match[1].trim()).filter(Boolean);

export const splitFragments = (token: string): string[] => {
  const withoutParentheticals = token.replace(/\([^)]*\)/g, ' ');
  if (!/[\\/]/.test(withoutParentheticals)) {
    return [normalizeToken(token)].filter(Boolean);
  }
  return withoutParentheticals
    .split(SLASH_SEPARATOR)
    .map((fragment) => normalizeToken(fragment))
    .filter(Boolean);
};

export const isCiNumber = (normalized: string): boolean => /^ci \d{5}$/.test(normalized);

const toParsedToken = (
  rawText: string,
  position: number,
  isAfterMayContain: boolean,
): ParsedToken => ({
  rawText,
  normalized: normalizeToken(rawText),
  fragments: splitFragments(rawText),
  parentheticals: extractParentheticals(rawText),
  isAfterMayContain,
  position,
});

export const parseLabel = (raw: string): ParsedLabel => {
  const cleaned = cleanLabel(raw);
  if (!cleaned) {
    return { tokens: [], hasMayContainSection: false };
  }
  const { main, mayContain } = splitMayContain(cleaned);
  const mainTokens = tokenize(main);
  const mayContainTokens = tokenize(mayContain);
  const tokens = [
    ...mainTokens.map((token, index) => toParsedToken(token, index + 1, false)),
    ...mayContainTokens.map((token, index) =>
      toParsedToken(token, mainTokens.length + index + 1, true),
    ),
  ].filter((token) => token.normalized.length > 0);
  return { tokens, hasMayContainSection: mayContainTokens.length > 0 };
};
