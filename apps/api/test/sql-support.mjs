import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export async function makeDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE authenticator NOLOGIN NOINHERIT;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, banned_until timestamptz);
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL);
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,authenticated,service_role;
    CREATE POLICY existing_permissive_buckets ON storage.buckets FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    CREATE POLICY existing_permissive_objects ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
  `);
  return db;
}
export const baselineUrl = new URL('../prisma/migrations/202611120001_initial/migration.sql',import.meta.url);
export const seedUrl = new URL('../prisma/seed.sql',import.meta.url);
export const readSql = (url) => readFile(url,'utf8');
export async function transact(db, role, context, callback) {
  await db.exec('BEGIN');
  try {
    if (role) await db.exec('SET LOCAL ROLE ' + ({api:'kantin_api',tracker:'order_tracker',anon:'anon',authenticated:'authenticated',owner:'postgres'}[role]));
    for (const [key,value] of Object.entries(context)) await db.query('SELECT set_config($1,$2,true)',[key,String(value)]);
    const result = await callback(db);
    await db.exec('COMMIT');
    return result;
  } catch (error) { await db.exec('ROLLBACK'); throw error; }
}

