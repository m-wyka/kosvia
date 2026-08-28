import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderLocalised, toLocalisedReason, vocabTerm } from './phrases';
import { PHRASES } from './phrases.generated';

const root = resolve(__dirname, '../../..');

describe('server phrase table', () => {
  it('is in step with the web app locale files', () => {
    // The generator exits non-zero when the copy has drifted, which is the
    // whole point: the strings live in one place and are copied, not retyped.
    execFileSync('node', ['scripts/sync-phrases.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  });

  it('carries the same keys in both languages', () => {
    const flatten = (node: unknown, prefix = ''): string[] =>
      typeof node === 'object' && node !== null
        ? Object.entries(node).flatMap(([key, value]) => flatten(value, `${prefix}${key}.`))
        : [prefix];
    expect(flatten(PHRASES.pl)).toEqual(flatten(PHRASES.en));
  });
});

describe('renderLocalised', () => {
  it('translates a Personal Match reason and its vocabulary params', () => {
    const reason = toLocalisedReason({
      code: 'concerns',
      label: 'Targets dehydration, redness',
      impact: 12,
      params: { concerns: ['dehydration', 'redness'] },
    });

    expect(renderLocalised(reason, 'en')).toBe('Targets dehydration, redness');
    expect(renderLocalised(reason, 'pl')).toBe('Działa na: odwodnienie, zaczerwienienia');
  });

  it('formats money params in the locale currency style', () => {
    const entry = { code: 'ai-available-from', text: 'Available from 24 PLN', params: { price: 24 } };
    expect(renderLocalised(entry, 'pl')).toBe('Dostępny od 24,00 zł');
  });

  it('picks the Polish plural form by CLDR rules, not by count > 1', () => {
    const note = (count: number) => ({
      code: 'ingredient-many-actives',
      text: `${count} active ingredients`,
      params: { count },
    });
    // one / few / many — 3 takes "few", 5 and 12 take "many".
    expect(renderLocalised(note(3), 'pl')).toMatch(/^3 składniki aktywne/);
    expect(renderLocalised(note(5), 'pl')).toMatch(/^5 składników aktywnych/);
    expect(renderLocalised(note(12), 'pl')).toMatch(/^12 składników aktywnych/);
  });

  it('leaves INCI names alone', () => {
    const entry = toLocalisedReason({
      code: 'ingredient-excluded',
      label: 'Contains Parfum, which you avoid',
      impact: -20,
      params: { ingredients: ['Parfum'] },
    });
    expect(renderLocalised(entry, 'pl')).toBe('Zawiera Parfum, których unikasz');
  });

  it('falls back to the English text for a code it does not know', () => {
    const entry = { code: 'something-new', text: 'A sentence the client has never seen.' };
    expect(renderLocalised(entry, 'pl')).toBe('A sentence the client has never seen.');
  });

  it('reads vocabulary terms out of the same table', () => {
    expect(vocabTerm('ROUTINE_STEP', 'MOISTURIZER', 'pl')).not.toBe('MOISTURIZER');
  });
});

describe('the web app and the server agree on the phrase table', () => {
  it('copies the strings verbatim', () => {
    const web = JSON.parse(
      readFileSync(resolve(root, '../web/i18n/locales/pl.json'), 'utf8'),
    ) as Record<string, Record<string, string>>;
    expect(PHRASES.pl.MATCH).toEqual(web.MATCH);
    expect(PHRASES.pl.GENERATED).toEqual(web.GENERATED);
  });
});
