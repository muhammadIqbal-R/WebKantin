# Validasi implementasi database · 2026-11-12

SQL database tersedia untuk instalasi pertama pada project Supabase pengguna.
**Tidak ada SQL atau kredensial yang dijalankan terhadap Supabase live oleh agen.**
Kedua frontend masih memakai state demo; server Express belum tersedia.

## Pemeriksaan lokal

- Bundle setup.sql dibangun dari migration + seed dan diperiksa konsistensinya.
- Schema Prisma 7 lolos validate dan generate tanpa koneksi DB live.
- 24 tes database lulus menggunakan PostgreSQL embedded PGlite.
- pnpm check lulus: 11 task Turbo, 14 tes shared + 24 tes DB, lint/typecheck,
  validasi 44 dokumen Markdown, guard desain, bundle SQL, dan Prisma validate.
- Tes mengeksekusi juga file setup.sql persis yang diberikan kepada pengguna,
  verify.sql, serta template konfigurasi akun dengan identitas Auth fixture.

Cakupan tes: 12 tabel ENABLE/FORCE RLS, pembatasan role, no-context deny, scope
transaction-local, grant browser, Storage restrictive policy, seed idempotent,
snapshot harga/merchant, pemisahan order lintas tenant dan rollback atomik,
akses capability/order code, tenant A/B, penolakan dan pelaporan ulang pembayaran,
paid audit aktual, terminal state, stale version, profil nonaktif, scope/expiry/
revocation tracker, snapshot immutable, total/item/grant/replay wajib, idempotency
hash berbeda, tenant tanpa QRIS, hard-delete ditolak, first-install guard,
serta pemetaan akun Auth dan login runtime terbatas.

## Batas hasil

PGlite menjalankan SQL PostgreSQL dan PL/pgSQL. Schema auth/storage dan role bawaan
Supabase pada tes merupakan fixture minimal, bukan layanan Supabase sesungguhnya.
SQL signature JWT tidak diuji; tes memasang claims langsung untuk menguji policy.
Tidak ada klaim upload/signed URL, Auth login, SMTP, key import, subscription
postgres_changes, maupun deployment telah berhasil live.

Tes konteks bergantian memakai satu koneksi terisolasi; konkurensi multi-koneksi
Prisma/Supavisor, race idempotency/checkout, pool reuse, dan deadlock retry masih
perlu tes integrasi saat API tersedia. Kompatibilitas privilege operator managed
Supabase harus diverifikasi oleh operator saat memasang SQL.

## Menjalankan ulang

Dari root kantin-app:

```sh
pnpm db:bundle
pnpm check:database
pnpm --filter @kantin/shared build
pnpm --filter @kantin/api test
pnpm check
```

Prisma generate menghasilkan client yang diabaikan Git; bukan implementasi handler.
Sumber tes: [database.test.mjs](../apps/api/test/database.test.mjs).
Panduan pengguna: [instalasi Supabase](../infra/supabase/README.md).
