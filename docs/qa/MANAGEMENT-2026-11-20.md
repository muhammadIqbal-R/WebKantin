# Validasi pengelolaan · 20 November 2026

**Status:** implementasi lokal dan pemeriksaan otomatis selesai; pemasangan/UAT live belum dilakukan.

Laporan tahap ini bersifat historis. Perluasan foto/QRIS, ruang tenant dan katalog
API dicatat di [validasi onboarding](TENANT-ONBOARDING-2026-11-20.md).

Pengguna melanjutkan temuan audit terkait login/RBAC, pengguna, tambah/arsip
tenant dan input stok angka. [Spesifikasi](../staff-management.md) ditulis sebelum
implementasi, dengan status PRD tetap draft sampai review produk. Tidak ada
SQL live, akun nyata, email undangan nyata, commit, push atau deploy dijalankan.

## Perubahan yang tersedia

| Modul | Implementasi | Batas verifikasi |
|---|---|---|
| Login staf | Supabase Auth email/password, sesi, logout dan pengaturan password penerima undangan. Tidak ada pemilih peran. | SDK wiring/build; login nyata dan redirect undangan belum diuji. |
| Pembatasan akses | Guard UI dan verifikasi JWT ES256/RS256 pada API, issuer/audience/expiry, profil aktif DB setiap transaksi, scope tenant server serta RLS. | JWT lokal dengan key uji, HTTP dependency doubles dan SQL embedded; bukan Supabase live. |
| Tenant | Tambah draft dari outlet DB, edit nama/deskripsi, arsip/pulihkan, undang akun, aktivasi menolak QRIS/menu yang belum lengkap. | Kode API/Prisma dan tes SQL lokal. Penyelesaian QRIS/aktivasi tenant baru belum operasional karena upload belum termasuk tahap ini. |
| Menu/stok | Tambah/edit/nonaktif menu, kategori/deskripsi, jumlah porsi, pembaruan versi, stok 0 otomatis Habis; admin seluruh tenant, tenant miliknya. | SQL lokal menguji isolasi tenant, angka invalid, versi lama dan audit. Tidak menguji koneksi Prisma PostgreSQL live. |
| Pengguna | Daftar halaman pengguna Auth + role staf DB; nonaktif/pulihkan; larang menonaktifkan diri sendiri. Hapus bersifat soft deactivation. | Auth Admin di-mock pada tes HTTP; tidak ada akun riil diubah. JWT pelanggan lama masih perlu pemeriksaan blokir pada endpoint pelanggan berikutnya. |
| Pengelola | Dashboard berisi tenant/menu/stok aktual dari API; tanpa fallback demo. Halaman pesanan/denah diberi state belum terintegrasi. | Build produksi sukses; tampilan browser belum diverifikasi. |

## Hasil pemeriksaan

- `pnpm check`: lulus, 13 tugas Turbo sukses; 2 cache hit (lint UI dan web-user), sisanya dijalankan ulang. Termasuk dokumentasi, guard desain, bundle SQL, Prisma validate, lint dan typecheck.
- Tes shared: 20 lulus (17 existing + 3 kontrak pengelolaan).
- Tes SQL: 29 lulus (24 baseline + 5 upgrade/pengelolaan) dengan PGlite dan schema Auth/Storage pendukung tiruan.
- Tes HTTP/JWT: 6 lulus. Express benar-benar dilayani pada port lokal sementara; dependency DB/Auth Admin diganti doubles. Verifier JWT diuji dengan signature key lokal, bukan JWKS project live.
- Total 55 tes otomatis lulus. Tes versi stok membuktikan penolakan penulis dengan versi lama; tidak mengklaim uji beban transaksi konkuren produksi.
- `pnpm build`: lulus untuk API, web-admin dan web-user; shared dibangun melalui dependency graph.
- Percobaan browser ke `http://localhost:3101/login` ditolak gerbang izin origin. Tidak dicoba melalui browser/jalur lain. Server frontend sementara dihentikan setelah pemeriksaan tidak dapat dilanjutkan. Login visual, overflow HP, dialog dan UAT peran tetap belum terverifikasi.

## Migrasi dan aktivasi

SQL baru: [management-upgrade.sql](../../infra/supabase/management-upgrade.sql),
bersumber dari [migration append-only](../../apps/api/prisma/migrations/202611200001_management/migration.sql).
Baseline existing tidak diubah. Migration menambah kolom arsip dan inventori,
mempertahankan FORCE RLS/audit, menginisialisasi stok existing 0 dan menandai
menu existing Habis agar jumlah sebenarnya diisi operator. Eksekusi hanya oleh
operator setelah membaca dampaknya; jangan mengulang setup pada database existing.

API menolak runtime role selain kantin_api/non-BYPASSRLS. Secret Auth Admin hanya
di API; browser memakai publishable key untuk sesi. Panduan env, akun awal dan
perintah jalan/deploy ada di [spesifikasi operasional](../staff-management.md).

## Sisa pekerjaan yang tidak dinyatakan selesai

- Menjalankan migration/config pada layanan Anda dan menguji login/peran nyata.
- Mengunggah QRIS/foto/denah melalui API/Storage, melengkapi aktivasi tenant baru.
- Menghubungkan katalog pelanggan ke data API. Web-user masih memakai fixture.
- Ownership pelanggan, checkout persisten, pengurangan/reservasi/pemulihan stok
  per order, pembayaran manual nyata, status dan Realtime lintas aplikasi.
- Pemulihan provisioning bila undangan Auth sukses namun pembuatan profil DB
  gagal: akun tersebut tidak memperoleh izin staf, tetapi mungkin memerlukan
  pemetaan ulang oleh operator. Retry profil yang sudah ada untuk tenant sama
  tidak mengirim undangan kedua.
- Hard delete pengguna tidak dibuat; nonaktifkan/pulihkan menjaga histori.

Pemetaan audit: AUD-01/02 tersedia untuk modul pengelolaan lokal, belum UAT live;
AUD-03 hanya web-admin; AUD-08 parsial (draft/akun, QRIS belum); AUD-09 guard
aktivasi ditambahkan; AUD-10 soft deactivation/arsip tersedia; AUD-11 input stok
manual tersedia, otomatis per pesanan belum; AUD-13 field kategori/deskripsi
ditambahkan. Temuan checkout/media/realtime dan integrasi pelanggan tetap terbuka.
