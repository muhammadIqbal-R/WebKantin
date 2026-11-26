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
const upgrade = await readFile(path.join(root,'apps/api/prisma/migrations/202611200001_management/migration.sql'),'utf8');
const upgradeTarget = path.join(root,'infra/supabase/management-upgrade.sql');
if(process.argv.includes('--check')) assert.equal(await readFile(upgradeTarget,'utf8'),upgrade,'Management upgrade is stale; run pnpm db:bundle');
else await writeFile(upgradeTarget,upgrade);
const ordersUpgrade=await readFile(path.join(root,'apps/api/prisma/migrations/202611210001_orders/migration.sql'),'utf8');
const ordersTarget=path.join(root,'infra/supabase/orders-upgrade.sql');
if(process.argv.includes('--check'))assert.equal(await readFile(ordersTarget,'utf8'),ordersUpgrade,'Orders upgrade is stale; run pnpm db:bundle');
else await writeFile(ordersTarget,ordersUpgrade);
const chatUpgrade = await readFile(path.join(root,'apps/api/prisma/migrations/202611240001_order_chat/migration.sql'),'utf8');
const chatTarget = path.join(root,'infra/supabase/chat-upgrade.sql');
if (process.argv.includes('--check')) assert.equal(await readFile(chatTarget,'utf8'),chatUpgrade,'Chat upgrade is stale; run pnpm db:bundle');
else await writeFile(chatTarget,chatUpgrade);
const operationsUpgrade = await readFile(path.join(root,'apps/api/prisma/migrations/202611250001_order_operations/migration.sql'),'utf8');
const operationsTarget = path.join(root,'infra/supabase/order-operations-upgrade.sql');
if (process.argv.includes('--check')) assert.equal(await readFile(operationsTarget,'utf8'),operationsUpgrade,'Order operations upgrade is stale; run pnpm db:bundle');
else await writeFile(operationsTarget,operationsUpgrade);
const fulfillmentUpgrade = await readFile(path.join(root,'apps/api/prisma/migrations/202611250002_order_fulfillment/migration.sql'),'utf8');
const fulfillmentTarget = path.join(root,'infra/supabase/order-fulfillment-upgrade.sql');
if (process.argv.includes('--check')) assert.equal(await readFile(fulfillmentTarget,'utf8'),fulfillmentUpgrade,'Fulfillment upgrade is stale; run pnpm db:bundle');
else await writeFile(fulfillmentTarget,fulfillmentUpgrade);
const proofUpgrade = await readFile(path.join(root,'apps/api/prisma/migrations/202611260001_tenant_payment_proofs/migration.sql'),'utf8');
const proofTarget = path.join(root,'infra/supabase/tenant-payment-proofs-upgrade.sql');
if (process.argv.includes('--check')) assert.equal(await readFile(proofTarget,'utf8'),proofUpgrade,'Tenant payment proof upgrade is stale; run pnpm db:bundle');
else await writeFile(proofTarget,proofUpgrade);

