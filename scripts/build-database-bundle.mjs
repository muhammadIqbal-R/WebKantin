import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(path.join(root,'apps/api/prisma/migrations/202611120001_initial/migration.sql'),'utf8');
const seed = await readFile(path.join(root,'apps/api/prisma/seed.sql'),'utf8');
assert.ok(/COMMIT;\s*$/.test(migration), 'Baseline must end with COMMIT');
const seedBody = seed.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
const bundle = '-- GENERATED: full Kantin database + one placeholder tenant. Run once as postgres.\n'
  + '-- Source: apps/api/prisma/migrations/202611120001_initial/migration.sql and prisma/seed.sql\n'
  + migration.replace(/COMMIT;\s*$/,seedBody + '\nCOMMIT;\n');
const target = path.join(root,'infra/supabase/setup.sql');
if (process.argv.includes('--check')) assert.equal(await readFile(target,'utf8'),bundle,'SQL bundle is stale; run pnpm db:bundle');
else { await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,bundle); }
console.log(process.argv.includes('--check') ? 'SQL bundle matches canonical migration and seed.' : 'Generated infra/supabase/setup.sql');

