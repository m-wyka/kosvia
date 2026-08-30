import { parseCsv } from './cosing-csv';
import type { CosIngAnnex, CosIngAnnexEntry } from './cosing-types';

const NAME_COLUMNS = [
  'Name of Common Ingredients Glossary',
  'Colour index Number / Name of Common Ingredients Glossary',
  'Identified INGREDIENTS or substances e.g.',
];
const CHEMICAL_NAME_COLUMNS = ['Chemical name / INN', 'Chemical name'];
const REFERENCE_COLUMN = 'Reference Number';
const CONCENTRATION_COLUMN = 'Maximum concentration in ready for use preparation';
const CONDITIONS_COLUMN = 'Wording of conditions of use and warnings';
const OTHER_COLUMN = 'Other';
const REGULATION_COLUMN = 'Regulation';

const FRAGRANCE_ALLERGEN_REGULATION = '2023/1545';
const LABELLING_OBLIGATION = /presence of the substance.*(shall|must) be indicated/is;
const NAME_SEPARATOR = /\s*\/\s*(?![^(]*\))/;
const EMPTY_VALUES = new Set(['', '-', '<empty>']);

const cleanValue = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  return EMPTY_VALUES.has(trimmed) ? null : trimmed;
};

const splitNames = (value: string | null): string[] =>
  value
    ? value
        .split(NAME_SEPARATOR)
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

const findHeaderRow = (rows: string[][]): number =>
  rows.findIndex((row) => row.includes(REFERENCE_COLUMN));

/**
 * The CSV export opens with three banner lines and a group-header line before
 * the real column names; everything above the row holding "Reference Number"
 * is skipped so a change in the banner does not break the import.
 */
export const parseAnnexCsv = (text: string, annex: CosIngAnnex): CosIngAnnexEntry[] => {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    throw new Error(`Annex ${annex}: header row not found`);
  }
  const header = rows[headerIndex];
  const columnIndex = (name: string) => header.indexOf(name);
  const cell = (row: string[], name: string) => {
    const index = columnIndex(name);
    return index === -1 ? null : cleanValue(row[index]);
  };

  const entries: CosIngAnnexEntry[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const referenceNumber = cleanValue(row[columnIndex(REFERENCE_COLUMN)]);
    if (!referenceNumber) {
      continue;
    }
    const glossaryNames = NAME_COLUMNS.flatMap((column) => splitNames(cell(row, column)));
    const chemicalNames =
      annex === 'II'
        ? CHEMICAL_NAME_COLUMNS.flatMap((column) => splitNames(cell(row, column)))
        : [];
    const names = [...new Set([...glossaryNames, ...chemicalNames])];
    if (!names.length) {
      continue;
    }
    const other = cell(row, OTHER_COLUMN) ?? '';
    const regulation = cell(row, REGULATION_COLUMN) ?? '';
    entries.push({
      annex,
      referenceNumber,
      names,
      maximumConcentration: cell(row, CONCENTRATION_COLUMN),
      conditions: cell(row, CONDITIONS_COLUMN),
      isFragranceAllergen:
        annex === 'III' &&
        (regulation.includes(FRAGRANCE_ALLERGEN_REGULATION) || LABELLING_OBLIGATION.test(other)),
    });
  }
  return entries;
};
