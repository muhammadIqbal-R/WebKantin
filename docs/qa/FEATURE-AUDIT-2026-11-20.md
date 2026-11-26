# Audit fitur · 20 November 2026

**Status:** audit selesai untuk kode dan tes lokal; verifikasi deployment belum dilakukan.  
**Keputusan perbaikan:** seluruh temuan menunggu ACC pemilik produk.  
**Referensi kode:** commit `b15460e`, working tree bersih saat audit dimulai.  
**Cakupan:** web-user, web-admin/tenant, kontrak bersama, SQL/Prisma dan pengujian yang tersedia.

**Pembaruan setelah audit:** pengguna mengizinkan implementasi login/RBAC,
pengguna, tambah/arsip tenant dan stok. Hasil tahap tersebut dicatat terpisah di
[validasi pengelolaan](MANAGEMENT-2026-11-20.md). Isi audit di bawah dipertahankan
sebagai kondisi sebelum perubahan; bukan status terbaru seluruh modul.

## 1. Kesimpulan

Proyek memiliki dua frontend dengan alur demo, integrasi Supabase Auth pelanggan,
kontrak Zod, dan fondasi database yang lulus pengujian lokal. Proyek **belum siap
untuk operasional pemesanan nyata**: Express API belum diimplementasikan, data
bisnis frontend masih disimpan dalam React state, autentikasi staf belum berjalan,
QRIS masih placeholder, dan perubahan antaraplikasi belum tersinkron.

Login pelanggan yang terhubung ke Supabase tidak otomatis membuat checkout,
riwayat akun, atau pengelolaan tenant tersambung ke database.

Tidak ada perbaikan kode fitur, perubahan konfigurasi layanan, pemasangan SQL live,
pendaftaran akun nyata, pembayaran, commit, push, atau deploy dalam audit ini.
Perubahan yang dibuat hanya dokumen audit ini. Perintah pemeriksaan dapat
menghasilkan cache/berkas tooling lokal yang diabaikan Git.

## 2. Dasar pemeriksaan dan batas bukti

- Pemeriksaan kode saat ini dan perbandingan terhadap [MASTER](../MASTER.md),
  sembilan [feature MD](../features/F-01-katalog-menu.md),
  [revisi akun pelanggan](../customer-accounts.md), serta [RBAC](../security/rbac-matrix.md).
- Pengujian kontrak dan database dijalankan ulang langsung tanpa cache Turbo;
  hasilnya tercatat di bagian 5.
- [QA 12 November](ACCEPTANCE-2026-11-12.md) merupakan bukti historis interaksi
  browser, termasuk simulasi Auth terisolasi. Hasil tersebut bukan pengujian ulang
  deployment pada 20 November. Deskripsi pemilih peran pada login staf dalam
  laporan lama sudah tidak menggambarkan kode saat ini; sekarang berupa form
  email/password yang selalu menampilkan layanan belum tersedia.
- Akses browser ke situs Vercel ditolak oleh gerbang izin karena akses origin tidak
  disetujui. Tidak dicoba melalui jalur lain. URL deployment, environment Vercel,
  redirect Auth, jumlah pengunjung, kondisi layar HP, dan alur browser live saat
  ini **belum terverifikasi**.
- Database Supabase live tidak diperiksa/diubah. Keberadaan tabel, akun, Storage,
  publication Realtime, dan konfigurasi RLS live tidak dapat disimpulkan dari
  migration lokal. Tes PGlite bukan tes layanan Supabase produksi.

Istilah status di bawah menjelaskan implementasi kode, bukan kelulusan UAT live:
**demo** = tersedia dalam state lokal; **parsial** = sebagian implementasi tersedia;
**belum** = alur operasional belum diimplementasikan; **belum terverifikasi** = perlu
bukti runtime/layanan. Tidak digunakan persentase penyelesaian.

## 3. Matriks fitur

| Fitur | Yang sudah tersedia di kode | Yang belum bisa / batas saat ini | Status |
|---|---|---|---|
| F-01 · Katalog | Daftar menu/foto, detail, pencarian, kategori, pengurutan harga/favorit, penanda habis, pilihan tenant jika lebih dari satu aktif. | Data bukan hasil API; perubahan pengelola tidak diterima web-user. | Demo |
| F-02 · Keranjang | Tambah/kurang, hapus pada qty nol, batas 99, hitung subtotal/total, dine in/take away. | Tidak persisten setelah reload; belum memeriksa harga/ketersediaan dari server. | Demo |
| F-02 · Checkout | Guard sesi pelanggan, validasi nama, pembuatan order demo terpisah per tenant. | Tidak ada endpoint checkout, transaksi database, idempotency HTTP, atau ownership akun. Label tenant ringkasan selalu tenant pertama. | Demo |
| F-03 · Pembayaran QRIS | Placeholder dan tombol klaim pembayaran simulasi. | Tidak menampilkan QRIS merchant asli; tidak mengirim klaim pembayaran ke API. QRIS statis + konfirmasi manual tetap arah V1. | Belum operasional |
| F-04 · Tracker/riwayat | Detail item, nominal, label status, timeline untuk order sesi lokal. | Tidak mengambil order akun dari server, tidak bertahan setelah reload, tidak berlangganan `postgres_changes`, tidak menerima update tenant. | Demo |
| F-05 · Denah/outlet | Denah ilustrasi, daftar tenant, pemilih gambar denah dengan validasi metadata. | Gambar hanya preview lokal; belum ada upload Storage, simpan posisi tenant, atau CRUD outlet operasional. | Demo |
| F-06 · Tambah tenant | Form nama/deskripsi/email, tenant baru menjadi draft, toggle aktif pada contoh yang memenuhi sebagian syarat. | Tidak menyimpan tenant atau membuat/mengundang akun staf. Tidak ada form melengkapi QRIS sehingga onboarding tenant baru belum dapat diselesaikan. | Demo |
| F-06 · Hapus/nonaktif tenant | Toggle aktif untuk tenant yang memenuhi syarat UI. | Tidak ada aksi arsip/hapus draft. Toggle bukan penghapusan dan tidak persisten. Validasi aktivasi belum memeriksa gambar QRIS. | Parsial demo |
| F-07 · Menu tenant | Tambah, edit nama/harga/kategori/deskripsi, pilih tenant oleh admin, pencarian/filter, ubah Tersedia/Habis, nonaktifkan menu. | Semua lokal; nonaktifkan adalah soft delete demo. Belum ada API, penyimpanan foto, atau scope tenant berdasarkan identitas terverifikasi. | Demo |
| F-07 · Foto menu | Pilih JPEG/PNG/WebP maksimal 2 MiB dan preview. | Tidak upload ke Storage; URL foto hasil preview bukan URL aset tersimpan. | Demo |
| Stok menu | `is_available` untuk Tersedia/Habis. | Tidak ada stok angka, reservasi atau pengurangan jumlah stok ketika checkout. Perlu detail aturan sebelum implementasi. | Belum |
| F-08 · Konfirmasi pembayaran | Terima/tolak contoh, alasan penolakan, status kembali menunggu bayar atau menjadi diproses. | Tidak membaca pembayaran nyata; tidak menyimpan keputusan/audit staf ke server. | Demo |
| F-08 · Status pesanan | Aksi diproses → siap → selesai pada pesanan contoh. | Tidak memperbarui order pelanggan sebenarnya; belum ada otorisasi tenant pada server. | Demo |
| F-09 · Daftar/login pelanggan | Form pada `/masuk`, Zod, SDK Supabase `signUp`/`signInWithPassword`, pesan konfirmasi email. | Keberhasilan konfirmasi email dan login live belum diverifikasi dalam audit ini; memerlukan email uji yang benar-benar dapat diakses. | Parsial, terintegrasi Auth |
| F-09 · Sesi/logout pelanggan | `getSession`, listener sesi, logout lokal dan reset data demo saat event sign-out. | Belum membuktikan skenario sesi/redirect di deployment; tidak menyediakan riwayat order akun. | Parsial, terintegrasi Auth |
| F-09 · Login admin/tenant | Form email/password tersedia. | Submit selalu menampilkan layanan belum tersedia; tidak memverifikasi akun/JWT/profil staf. | Belum |
| F-09 · Otorisasi staf | Ada kondisi UI berdasarkan variabel role demo. | Role awal selalu admin; shell tidak mewajibkan login. Scope tenant di menu memakai tenant pertama, bukan identitas akun. | Belum aman untuk data nyata |
| Pengelolaan pengguna | Halaman akun pelanggan dan identitas staf contoh. | Tidak ada daftar pengguna, provisioning akun tenant nyata, penonaktifan/hapus akun, atau perubahan role operasional. | Belum |
| Dashboard pengelola | Ringkasan antrean, nominal diterima, daftar pesanan dan menu. | Berasal dari fixture/state; bukan laporan transaksi atau pendapatan nyata. | Demo |
| Database | SQL siap salin, Prisma, seed satu tenant, RLS, trigger integritas/audit dan tes lokal. | Status pemasangan/config live belum diperiksa; ownership pelanggan Auth memerlukan migration lanjutan. | Fondasi teruji lokal |
| Express API | Kontrak Zod dan spesifikasi endpoint tersedia. | Tidak ada server Express, routes, middleware JWT/RBAC atau koneksi runtime bisnis frontend → API. | Belum |
| Desain responsif | Token olive/cream, Poppins lokal, aset logo, breakpoint CSS untuk HP/tablet/desktop. | CSS responsif ada; overflow, keyboard, dialog dan tampilan perangkat aktual belum diuji ulang pada audit ini. | Ada di kode; visual belum diverifikasi |
| Statistik pengunjung | `@vercel/analytics` dan `<Analytics />` terpasang di root web-user. | Aktivasi dashboard, pengiriman event produksi dan jumlah visitor belum diverifikasi. Root admin belum memasang Analytics. | Parsial |

## 4. Daftar temuan yang menunggu ACC

P0 = penghalang keamanan sebelum data nyata; P1 = alur inti belum operasional;
P2 = kelengkapan fitur/kontrak/validasi. Prioritas bukan izin mengerjakan.

**Status setiap temuan AUD-01 sampai AUD-16: MENUNGGU ACC.**

| ID | Prioritas | Temuan dan dampak | Syarat penutupan setelah di-ACC |
|---|---|---|---|
| AUD-01 | P0 | Panel staf tidak memerlukan autentikasi; role default admin. Scope menu tenant memakai tenant pertama, dan daftar pesanan/dashboard tidak difilter berdasarkan akun tenant. Saat ini memuat fixture; ini tidak membuktikan kebocoran database live. | Login staf nyata, guard halaman, verifikasi JWT/profil aktif di API, tes tenant A/B dan penolakan direct URL tanpa izin. |
| AUD-02 | P1 | Runtime Express belum ada. Kontrak endpoint tidak sama dengan endpoint yang berjalan. | Server Express dengan validasi Zod pada boundary, error standar, autentikasi, otorisasi, transaksi Prisma dan deployment API terverifikasi. |
| AUD-03 | P1 | Semua data bisnis React state; hilang saat reload dan tidak tersinkron antara web-user/admin. | Kedua aplikasi membaca/mutasi melalui API; tenant/menu/order bertahan setelah reload dan terlihat dari aplikasi lain sesuai izin. |
| AUD-04 | P1 | Akun pelanggan belum menjadi owner order di database; riwayat per akun belum tersedia. | Migration ownership yang kompatibel dengan data existing, verifikasi `sub` oleh API, RLS dan tes akun A tidak dapat membaca/mengubah order B. |
| AUD-05 | P1 | Checkout mengambil harga/total dari fixture, tanpa transaksi server atau idempotency runtime. | Server menghitung ulang snapshot harga, memisahkan order per tenant secara atomik, menolak menu tidak tersedia dan mencegah order duplikat pada retry. |
| AUD-06 | P1 | QRIS asli, upload, instruksi merchant, dan klaim pembayaran operasional belum ada. | Aset QRIS valid melalui API/Storage, snapshot merchant per order, serta klaim manual tercatat di server; tidak menambahkan gateway otomatis. |
| AUD-07 | P1 | Konfirmasi/status hanya memperbarui order contoh; tidak ada alur dua aplikasi atau Realtime. | Order pelanggan terlihat oleh tenant yang tepat; konfirmasi dicatat dengan actor/version; update tampil di pelanggan melalui Realtime yang terotorisasi dan pulih setelah reconnect. |
| AUD-08 | P1 | Onboarding tenant berhenti di draft. Email form tidak membuat akun; tidak ada editor QRIS. | Admin dapat membuat tenant, provisioning akun tenant dan melengkapi QRIS/menu hingga tenant dapat menerima pesanan. Tenant hanya mengelola miliknya. |
| AUD-09 | P2 | Aktivasi tenant demo memeriksa nama merchant dan jumlah menu, tetapi tidak `qris_image_url`. Seed contoh berbeda dari baseline SQL yang menolak aktivasi tanpa QRIS. | UI dan API menolak aktivasi sebelum QRIS dan menu valid tersedia; tes regresi mencakup gambar QRIS kosong. |
| AUD-10 | P2 | Tidak ada arsip/hapus draft tenant atau manajemen pengguna. | Alur penonaktifan/arsip sesuai izin dan audit, riwayat transaksi tetap utuh; kebijakan penghapusan akun ditetapkan sebelum implementasi. |
| AUD-11 | P2 | Stok hanya boolean; tidak memenuhi permintaan cek stok berbasis jumlah. | ACC aturan stok angka, pengurangan/reservasi, pemulihan saat batal/kedaluwarsa dan penanganan pembelian bersamaan; lalu tes sesuai aturan tersebut. |
| AUD-12 | P2 | Foto menu dan denah hanya object URL lokal, tidak tersimpan. | Upload lewat API dengan validasi file server dan scope aset, simpan referensi Storage, lalu verifikasi perubahan pada web-user setelah reload. |
| AUD-13 | P2 | Kategori/deskripsi/favorit menu hanya field `DemoMenu`, belum ada di Menu Zod/Prisma. Preview foto memakai `image`, sedangkan DTO memakai `photo_url`. | Sepakati field produk yang diperlukan, selaraskan shared/DB/DTO dan mapping UI; filter/detail/foto tetap benar dengan data API tanpa fixture. |
| AUD-14 | P2 | Label tenant checkout memakai `tenants[0]` meski order demo dapat dikelompokkan per tenant. | Ringkasan dan instruksi pembayaran menampilkan tenant yang sesuai untuk setiap kelompok/order; tes minimal dua tenant. |
| AUD-15 | P2 | Dokumentasi belum seragam: MASTER memuat klaim deploy/tabel lama, matriks RBAC masih menyebut checkout tanpa token sementara revisi pelanggan mewajibkan login. QA lama menyebut pemilih peran yang sudah dihapus. | Selaraskan dokumen dan catat konflik pada changelog MASTER sesuai aturan proyek; pertahankan laporan QA lama sebagai bukti bertanggal. |
| AUD-16 | P2 | Bukti UAT produksi belum tersedia untuk Auth, navigasi dua domain, responsif, Analytics dan integrasi Supabase live. | Uji pada deployment yang diizinkan, dengan akun admin/dua tenant/dua pelanggan yang sah serta lingkungan uji; catat hasil, viewport, waktu dan bukti. |

Urutan usulan bila disetujui: selaraskan kebutuhan/kontrak dan ownership pelanggan;
bangun API serta autentikasi/otorisasi staf; hubungkan penyimpanan data; selesaikan
onboarding tenant/media/checkout/pembayaran; sambungkan tracker; jalankan UAT dua
tenant dan dua pelanggan. ACC dapat diberikan untuk ID tertentu terlebih dahulu.

## 5. Hasil pemeriksaan lokal saat audit

| Perintah | Hasil | Batas bukti |
|---|---|---|
| `pnpm check` | Exit 0. Dokumentasi, guard desain, kesesuaian SQL bundle dan `prisma validate` lulus. Turbo melaporkan 11/11 tugas sukses, seluruh tugas Turbo cache hit. | Hasil lint/typecheck/test bagian Turbo berasal dari cache; bukan eksekusi ulang seluruh pemeriksaan. |
| `pnpm --filter @kantin/shared test` | Eksekusi baru: 17 lulus, 0 gagal. | Memeriksa kontrak dan validasi; bukan HTTP API atau browser. |
| `pnpm --filter @kantin/api test` | Eksekusi baru: 24 lulus, 0 gagal. | PGlite lokal dengan schema/role pendukung Supabase tiruan; tidak mengakses database Supabase live. |

Tes SQL mencakup 12 tabel aplikasi dengan RLS, isolasi tenant/order capability,
integritas total dan snapshot, status pembayaran, version conflict, idempotency
data, akun nonaktif, kebijakan Storage dan eksekusi bundle. Lulusnya tes tersebut
tidak membuktikan verifikasi signature JWT, server HTTP, Storage/Realtime live,
atau transaksi browser lintas aplikasi sudah bekerja.

Tidak menjalankan build produksi atau pengujian browser/E2E baru dalam audit ini.
Tidak ada tes live yang diklaim lulus berdasarkan hasil historis.

## 6. Rujukan bukti kode

Nomor baris berikut merujuk commit saat audit dan dapat berubah pada revisi berikutnya.

- [DemoProvider](../../packages/ui/src/demo.tsx): baris 20–27 inisialisasi state/role,
  38–66 checkout demo, 68–93 pembayaran/status, 95–108 menu/tenant lokal.
- [Shell pengelola saat audit](https://github.com/muhammadIqbal-R/WebKantin/blob/cbbe116/apps/web-admin/components/admin-shell.tsx): baris 16 dan
  28–30 provider dan render panel tanpa pemeriksaan sesi staf.
- [Login staf](../../apps/web-admin/app/login/page.tsx): baris 6–9 submit hanya
  menampilkan error layanan belum tersedia.
- [Menu pengelola](../../apps/web-admin/app/menu/page.tsx): baris 12–13 scope tenant
  pertama, 42–45 simpan lokal, 52–55 preview foto, 60 nonaktifkan lokal.
- [Tenant pengelola](../../apps/web-admin/app/tenant/page.tsx): baris 14–18 validasi
  dan pembuatan demo, 31 syarat toggle tanpa pemeriksaan gambar QRIS.
- [Akun pengelola](../../apps/web-admin/app/akun/page.tsx): profil contoh tanpa
  daftar/aksi pengelolaan user.
- [Checkout](../../apps/web-user/app/checkout/page.tsx): baris 21 guard pelanggan,
  25 pemanggilan order demo, 42 label tenant pertama.
- [Pembayaran/tracker](../../apps/web-user/app/pesanan/page.tsx): baris 17–18 QRIS
  placeholder dan status simulasi tanpa backend/realtime.
- [Auth pelanggan](../../apps/web-user/app/masuk/page.tsx): baris 31 signup SDK,
  38 login SDK; [provider sesi](../../apps/web-user/components/customer-auth.tsx)
  baris 17–27 pemulihan sesi dan logout.
- [Denah pengelola](../../apps/web-admin/app/denah/page.tsx) dan
  [lokasi pelanggan](../../apps/web-user/app/lokasi/page.tsx): preview/ilustrasi.
- [Kontrak menu](../../packages/shared/src/catalog.ts),
  [field demo](../../packages/ui/src/demo-data.ts),
  [Prisma](../../apps/api/prisma/schema.prisma): perbedaan field menu/ownership.
- [Package API](../../apps/api/package.json): hanya Prisma/shared dan tes; tidak
  memiliki dependency Express, entrypoint server atau script menjalankan API.
- [Fondasi SQL](../../apps/api/prisma/migrations/202611120001_initial/migration.sql),
  [tes DB](../../apps/api/test/database.test.mjs),
  [harness PGlite](../../apps/api/test/sql-support.mjs).
- [Root web-user](../../apps/web-user/app/layout.tsx): baris 7 dan 27 Analytics;
  [token desain](../../packages/ui/src/tokens.css) dan
  [CSS bersama](../../packages/ui/src/styles.css): font/warna/media query.

## 7. Gerbang persetujuan

Dokumen ini mencatat kebutuhan perbaikan, bukan persetujuan untuk mengerjakannya.
Setelah ACC, catat ID yang disetujui, batas lingkup dan tanggal persetujuan sebelum
mulai mengubah implementasi. Temuan yang belum disetujui tetap berstatus menunggu ACC.
