# Instalasi database Supabase

SQL lengkap siap salin: [setup.sql](setup.sql). File ini berisi schema, constraint,
RLS, role terbatas, trigger, bucket Storage, publication orders, dan seed awal.
Agen belum menjalankannya pada project Supabase Anda.

## 1. Salin SQL ke Supabase

1. Buka project Supabase yang sudah Anda buat.
2. Buka **SQL Editor → New query**, gunakan role operator postgres.
3. Buka [setup.sql](setup.sql), salin seluruh isinya, tempel ke editor, lalu **Run**.
   Tidak ada project ID atau password yang perlu diubah di file setup ini.
4. Setelah berhasil, jalankan seluruh [verify.sql](verify.sql) di query baru.
   Hasil menampilkan tabel, RLS, role, bucket, publication, dan jumlah data awal.

Hasil awal: 12 tabel aplikasi, 1 outlet Kantin Fakultas, 1 tenant placeholder,
8 menu. Tenant sengaja **nonaktif** karena merchant dan gambar QRIS belum diisi.
Tidak ada akun Auth, order palsu, atau pembayaran yang ditandai lunas.

Setup untuk instalasi pertama; bukan reset database. Jika schema aplikasi, role
atau bucket bernama sama sudah ada, skrip berhenti dan transaksi dibatalkan.
Jangan menghapus tabel untuk memaksanya berjalan. verify.sql boleh diulang;
seed terpisah juga idempotent. Seluruh setup+seed berada dalam satu transaksi.

## 2. Siapkan akun admin dan tenant

1. Pada **Authentication → Users**, buat dua akun nyata: pengelola dan tenant.
   Catat emailnya sendiri; tidak perlu mengirim password/kunci melalui chat.
2. Revisi kebutuhan terbaru: aktifkan Email signup pelanggan, email confirmation,
   dan redirect allowlist web-user. Akun staf tetap diprovisikan operator/admin;
   akun pelanggan tidak dibuat pada tabel users staf. Lihat [revisi akun](../../docs/customer-accounts.md).
3. Buka [configure-access.example.sql](configure-access.example.sql).
   Ganti tiga nilai placeholder: password acak role database API (minimal 24 karakter),
   email admin, dan email tenant yang sudah dibuat pada Auth.
4. Jalankan seluruh query tersebut sebagai postgres. Query memetakan ID Auth
   menjadi profil aplikasi dan mengaktifkan login database role kantin_api.
   Simpan password database tersebut pada secret lokal/deployment.

Jangan commit salinan yang sudah berisi password. Akun admin mendapat scope seluruh
kantin; akun tenant hanya tenant awal. API runtime bukan role postgres.
Pemesan tidak memiliki akun atau profil Auth.

## 3. Konfigurasi environment API

Salin [apps/api/.env.example](../../apps/api/.env.example) menjadi apps/api/.env.
Project ID saja tidak membuat tabel maupun koneksi database. Nilai yang diperlukan:

| Variabel | Sumber/pemakaian |
|---|---|
| DATABASE_URL | Koneksi PostgreSQL dengan user kantin_api dan password langkah 2; runtime API |
| DIRECT_URL | Koneksi owner dari Supabase Connect; hanya CLI/migrasi, schema=app_private |
| SUPABASE_URL | URL project pada dashboard |
| SUPABASE_JWKS_URL | URL verifikasi kunci Auth project |
| SUPABASE_SECRET_KEY | Kunci server untuk Auth admin/Storage; hanya backend |
| IDEMPOTENCY_ENCRYPTION_KEY | Random 32 byte base64 untuk enkripsi replay checkout |
| TRACKER_SIGNING_PRIVATE_JWK / KEY_ID | Kunci impor yang dikenali Supabase; integrasi Realtime masih perlu diuji |

Ambil host/port dari **Connect** pada dashboard. Untuk koneksi langsung, username
runtime kantin_api; untuk Supavisor session pooler gunakan kantin_api.PROJECT_REF
dan host/port yang ditampilkan project. Password pada connection URL harus
URL-encoded. Contoh template di .env memakai direct host; bila jaringan tidak
mendukung IPv6 gunakan opsi session pooler dari Connect. Aktifkan SSL.

Jangan pasang DIRECT_URL pada proses API Railway; jalankan pekerjaan migrasi
dengan environment terpisah. Frontend hanya menerima URL API, URL Supabase dan
publishable key. Kunci server, password DB, dan private JWK tidak memakai NEXT_PUBLIC_.

## 4. Setelah database terpasang

Frontend user/admin masih pratinjau data lokal; memasang SQL belum menghubungkannya.
Express handler, upload, login nyata, dan subscription Realtime belum diimplementasikan.
Mutasi bisnis berikutnya wajib melalui Express + Prisma, termasuk upload Storage.
Bucket menu-photos publik; tenant-qris dan floor-maps privat dan memerlukan signed
read URL dari API. Simpan URL canonical objek, bukan signed URL yang kedaluwarsa.

Lengkapi nama/QRIS tenant melalui API/admin setelah integrasi tersedia; constraint
menolak aktivasi tenant tanpa merchant dan URL QRIS HTTPS. Tenant tambahan memakai
tabel yang sama, bukan schema baru per penjual.

Pengembang: [kontrak transaksi API](../../docs/database-api-context.md),
[Prisma SQL-first/baseline](../../apps/api/prisma/README.md), dan
[hasil validasi lokal](../../docs/database-validation.md).

## Sumber SQL dan pengujian

Sumber canonical:
[migration.sql](../../apps/api/prisma/migrations/202611120001_initial/migration.sql)
dan [seed.sql](../../apps/api/prisma/seed.sql). Regenerasi bundle dari root:

```sh
pnpm db:bundle
pnpm check:database
pnpm --filter @kantin/api test
```

Tidak ada perintah ini yang menerapkan SQL ke Supabase. Tes memakai PostgreSQL
embedded lokal, dengan mock schema layanan Supabase; hasilnya bukan bukti
Auth/Storage/Realtime live sudah berfungsi.

Rujukan resmi:
[SQL dan RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[koneksi PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[Prisma config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).
