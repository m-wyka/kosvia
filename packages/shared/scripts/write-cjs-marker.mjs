// The package is ESM by default ("type": "module"); Node needs an explicit
// marker so it treats the CommonJS build output as CJS.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../dist/cjs/package.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
