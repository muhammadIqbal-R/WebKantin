# API dan implementasi database

Schema PostgreSQL, RLS, trigger, seed dan mapping Prisma tersedia.
Express server/endpoint, JWT middleware, upload, dan wiring frontend belum dibuat.
Port API yang direncanakan: 4000.

- [SQL lengkap siap paste](../../infra/supabase/setup.sql).
- [Panduan instalasi Supabase](../../infra/supabase/README.md).
- [Schema Prisma dan baseline SQL-first](prisma/README.md).
- [Environment API](.env.example).
- [Kontrak konteks transaksi](../../docs/database-api-context.md).
- [Tes dan batas verifikasi](../../docs/database-validation.md).

Dari root kantin-app:

```sh
pnpm --filter @kantin/api db:validate
pnpm --filter @kantin/api db:generate
pnpm --filter @kantin/api test
```

Perintah di atas tidak menghubungi Supabase. Runtime harus memakai DATABASE_URL
role kantin_api NOBYPASSRLS; kredensial owner DIRECT_URL hanya untuk CLI/migrasi.
Jangan memakai Prisma db push untuk menggantikan baseline SQL.
