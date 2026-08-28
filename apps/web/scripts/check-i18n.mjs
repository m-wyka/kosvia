#!/usr/bin/env node
/**
 * Translation health check.
 *
 * Three failure modes this catches, none of which surface at build time:
 *   1. a key used in a component but missing from a locale file
 *   2. a key defined in one locale but not the other
 *   3. a key nobody uses any more
 *
 * Dynamic keys — `$t(\`VOCAB.TAG.${x}\`)` — are matched by prefix, so a whole
 * namespace counts as used once any template builds a key inside it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'i18n/locales');
const scanDirs = ['app', 'layers'].map((dir) => join(root, dir));

const flatten = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const locales = Object.fromEntries(
  readdirSync(localesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      file.replace('.json', ''),
      JSON.parse(readFileSync(join(localesDir, file), 'utf8')),
    ]),
);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = scanDirs
  .flatMap(walk)
  .filter((file) => /\.(vue|ts)$/.test(file) && !file.endsWith('.d.ts'));

const staticKeys = new Set();
const dynamicPrefixes = new Set();

for (const file of sources) {
  const text = readFileSync(file, 'utf8');
  // $t('A.B'), t("A.B") and bare 'A.B' passed as a label prop.
  for (const [, key] of text.matchAll(/['"`]([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)+)['"`]/g)) {
    staticKeys.add(key);
  }
  // Template literals with an interpolation, whether the variable is a whole
  // segment (`VOCAB.TAG.${x}`) or only part of one (`LANDING.FAQ.Q_${n}`).
  for (const [, prefix] of text.matchAll(
    /`([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*)\.[A-Z0-9_]*\$\{/g,
  )) {
    dynamicPrefixes.add(prefix);
  }
}

const [reference, ...others] = Object.keys(locales);
const referenceKeys = new Set(flatten(locales[reference]));
const problems = [];

for (const other of others) {
  const otherKeys = new Set(flatten(locales[other]));
  for (const key of referenceKeys) {
    if (!otherKeys.has(key)) problems.push(`missing in ${other}.json: ${key}`);
  }
  for (const key of otherKeys) {
    if (!referenceKeys.has(key)) problems.push(`missing in ${reference}.json: ${key}`);
  }
}

const isCovered = (key) =>
  staticKeys.has(key) || [...dynamicPrefixes].some((prefix) => key.startsWith(`${prefix}.`));

for (const key of staticKeys) {
  if (!referenceKeys.has(key) && ![...referenceKeys].some((k) => k.startsWith(`${key}.`))) {
    problems.push(`used but not defined: ${key}`);
  }
}

const unused = [...referenceKeys].filter((key) => !isCovered(key));

console.log(`locales: ${Object.keys(locales).join(', ')}`);
console.log(`keys: ${referenceKeys.size} · used statically: ${staticKeys.size} · dynamic namespaces: ${dynamicPrefixes.size}`);

if (unused.length) {
  console.log(`\nunused keys (${unused.length}):`);
  for (const key of unused.slice(0, 40)) console.log(`  ${key}`);
  if (unused.length > 40) console.log(`  … and ${unused.length - 40} more`);
}

if (problems.length) {
  console.error(`\n✖ ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('\n✔ every used key is defined, and both locales carry the same keys');
