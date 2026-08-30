import { parseAnnexCsv } from './cosing-annex-parser';
import { parseCsv } from './cosing-csv';

const ANNEX_III = [
  '"File creation date: 29/08/2026"',
  '"ANNEX III","Last update: 28/08/2026"',
  '"LIST OF SUBSTANCES WHICH COSMETIC PRODUCTS MUST NOT CONTAIN EXCEPT SUBJECT TO THE RESTRICTIONS LAID DOWN"',
  '"Substance identification",Restrictions',
  '"Reference Number","Chemical name / INN","Name of Common Ingredients Glossary","CAS Number","EC Number","Product Type, body parts","Maximum concentration in ready for use preparation",Other,"Wording of conditions of use and warnings",Regulation,"Other Directives/Regulations","SCCS opinions","Chemical/IUPAC Name","Identified INGREDIENTS or substances e.g.",CMR,"Update Date"',
  '76,"Cinnamal","Cinnamal",104-55-2,203-213-9,,,"The presence of the substance must be indicated in the list of ingredients referred to in Article 6(1)g when its concentration exceeds:',
  '- 0.001% in leave-on products",,"(EC) 2009/1223",,,,,,22/12/2009',
  '86,Citronellol,Citronellol,106-22-9,203-375-0,,,"The presence of the substance shall be indicated in the list of ingredients referred to in Article 19(1), point (g), when its concentration exceeds 0,001 %",,"(EU) 2023/1545",,,,,,26/07/2023',
  '12,"Hydrogen peroxide","HYDROGEN PEROXIDE",7722-84-1,231-765-0,"(a) Hair products","(a) 12 % of H2O2",,"(a) Wear suitable gloves","(EC) 2009/1223",,,,"HYDROGEN PEROXIDE",,17/10/2010',
  '1a,"Salts of benzoic acid","AMMONIUM BENZOATE / BUTYL BENZOATE","1863-63-4 / 2090-05-3",,,,,,"(EC) 2009/1223",,,,,,17/10/2010',
].join('\n');

describe('parseCsv', () => {
  it('keeps quoted commas, escaped quotes and line breaks inside a field', () => {
    expect(parseCsv('a,"b, c","say ""hi""","line\nbreak"\n1,2,3,4')).toEqual([
      ['a', 'b, c', 'say "hi"', 'line\nbreak'],
      ['1', '2', '3', '4'],
    ]);
  });
});

describe('parseAnnexCsv', () => {
  const entries = parseAnnexCsv(ANNEX_III, 'III');

  it('skips the banner lines and reads one entry per row', () => {
    expect(entries.map((entry) => entry.referenceNumber)).toEqual(['76', '86', '12', '1a']);
  });

  it('flags fragrance allergens by the labelling obligation or the 2023/1545 regulation', () => {
    expect(entries.map((entry) => entry.isFragranceAllergen)).toEqual([true, true, false, false]);
  });

  it('splits several glossary names on one row', () => {
    expect(entries[3].names).toEqual(['AMMONIUM BENZOATE', 'BUTYL BENZOATE']);
  });

  it('collapses duplicate names from the identified-ingredients column', () => {
    expect(entries[2].names).toEqual(['HYDROGEN PEROXIDE']);
    expect(entries[2].maximumConcentration).toBe('(a) 12 % of H2O2');
    expect(entries[2].conditions).toBe('(a) Wear suitable gloves');
  });

  it('never flags allergens outside Annex III', () => {
    const annexV = ANNEX_III.replace('"ANNEX III"', '"ANNEX V"');
    expect(parseAnnexCsv(annexV, 'V').every((entry) => !entry.isFragranceAllergen)).toBe(true);
  });
});
