#!/usr/bin/env node
/**
 * Distributes the root .env to the two apps.
 *
 * There is one source of truth — `/.env` — but the Prisma CLI reads `.env`
 * next to the schema, and Nuxt reads `.env` from its own root. Rather than ask
 * anyone to keep three files in sync, this copies the root file into both apps
 * whenever it changes. Re-run it after editing .env.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log('› Created .env from .env.example');
}

const contents = readFileSync(envPath, 'utf8');
const header =
  '# Generated from the repository root .env — edit that file, then run `npm run env`.\n\n';

/** The web app has no business holding database credentials or JWT secrets. */
const WEB_KEYS = ['API_URL', 'API_INTERNAL_URL', 'FRONTEND_URL', 'NODE_ENV'];

const webLines = contents
  .split('\n')
  .filter((line) => WEB_KEYS.some((key) => line.startsWith(`${key}=`)));

writeFileSync(resolve(root, 'apps/api/.env'), header + contents);
writeFileSync(resolve(root, 'apps/web/.env'), header + webLines.join('\n') + '\n');

console.log('› Wrote apps/api/.env and apps/web/.env');
