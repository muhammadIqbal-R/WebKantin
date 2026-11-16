import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';
// Validation/generation work offline; migrations require the operator's DIRECT_URL.
try { loadEnvFile('.env'); } catch (error: unknown) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? 'postgresql://postgres:placeholder@localhost:5432/postgres?schema=app_private' },
});
