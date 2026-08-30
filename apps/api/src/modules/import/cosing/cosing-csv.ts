/**
 * Minimal RFC 4180 reader — CosIng exports quote every field that contains a
 * comma, a quote or a line break, and the annexes have multi-line cells.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (isQuoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        isQuoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      isQuoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};
