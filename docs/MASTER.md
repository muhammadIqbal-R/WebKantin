# MASTER · Kantin Multi-Tenant

**Status:** draft  
**Pemilik:** Lead Full-Stack Engineer / Software Architect; persetujuan oleh pemilik produk  
**Terakhir diperbarui:** 2026-11-12  
**Milestone aktif:** revisi frontend Vokasi UI + akun pelanggan minimal; implementasi database M1 — SQL Supabase siap salin, Prisma, seed dan tes lokal. Frontend tetap pratinjau; project live tidak diubah agen.

## 1. Otoritas dan ruang lingkup

[Sumber PRD yang disetujui](reference/PRD-approved.md) dan
[aturan engineering](reference/engineering-rules.md) disalin dari workspace pengguna.
Permintaan langsung pengguna mengatasi pedoman lokal. MASTER menguasai glossary,
indeks/status fitur, dan keputusan lintas fitur. Feature MD menguasai alur, state,
edge case, kontrak API, dan aturan internalnya. Konflik dicatat pada changelog,
direview, lalu dokumen dan kontrak diperbarui bersama; tidak boleh diselesaikan diam-diam.
Dokumen turunan masih draft, bukan persetujuan produk baru.

M0 telah menghasilkan struktur, dokumentasi, kontrak Zod, tooling, dan CI.
Arahan pengguna berikutnya mengizinkan desain frontend kedua aplikasi terlebih dahulu
dengan placeholder. Arahan berikutnya meminta SQL database lengkap siap salin;
Prisma mapping, migration, seed dan tes DB lokal kini tersedia. Express handler,
koneksi database live dan deploy belum dibuat/dijalankan.
Supabase project sudah tersedia menurut pengguna; belum ada tabel aplikasi.
Tidak ada kredensial dibaca atau database live diubah.

Klarifikasi pengguna 2026-11-12: produk digunakan untuk satu kantin fakultas.
Peluncuran dimulai dengan satu tenant; tenant berikutnya ditambahkan melalui
web-admin. Seluruh PRD fitur disusun sebelum kode fitur dimulai.

## 2. Glossary

| Istilah | Arti resmi |
|---|---|
| Pemesan | Pelanggan web-user; katalog publik, login wajib sebelum checkout (revisi terbaru). |
| Tenant | Penjual yang memiliki menu, QRIS, dan order sendiri. |
| Admin Pengelola | Role `admin_pengelola`; mengelola seluruh kantin. |
| Outlet | Lokasi kantin dengan denah; pada rilis awal mewakili satu kantin fakultas dan dapat menampung banyak tenant. |
| Order | Pesanan untuk tepat satu tenant. |
| Checkout | Satu pengiriman keranjang; dapat menghasilkan banyak order. |
| Order code | Kode tampilan/rujukan, bukan bukti identitas pemesan. |
| Order access token | Rahasia pemegang order untuk akses API tracker; bukan akun Supabase. |
| QRIS statis | Gambar pembayaran tenant; nominal diisi pemesan pada aplikasi pembayaran. |
| RLS | Row Level Security PostgreSQL sebagai pembatas terakhir tiap baris. |
| Capability Realtime | Usulan JWT singkat dengan izin baca untuk satu order, tanpa login pemesan. |
| Soft delete | Menonaktifkan data tanpa memutus sejarah order. |

## 3. Indeks fitur dan status

| ID | Dokumen | Status | Milestone |
|---|---|---|---|
| F-01 | [Katalog tenant dan menu](features/F-01-katalog-menu.md) | draft | M1–M2 |
| F-02 | [Keranjang dan checkout](features/F-02-checkout.md) | draft | M1–M2 |
| F-03 | [QRIS statis](features/F-03-qris-static.md) | draft | M2 |
| F-04 | [Tracker pesanan](features/F-04-order-tracker.md) | draft | M4 |
| F-05 | [Denah dan outlet](features/F-05-denah-kantin.md) | draft | M5 |
| F-06 | [Manajemen tenant](features/F-06-admin-tenant.md) | draft | M3 |
| F-07 | [Manajemen menu](features/F-07-admin-menu.md) | draft | M3 |
| F-08 | [Konfirmasi pembayaran dan status](features/F-08-konfirmasi-pembayaran.md) | draft | M3 |
| F-09 | [Auth dan RBAC](features/F-09-auth-rbac.md) | draft | M1–M3 |

Pemilik seluruh draft: Lead Full-Stack Engineer; reviewer produk belum ditetapkan.
Siklus status: draft → in-review → approved; deprecated untuk spesifikasi yang diganti.
Status MASTER dan Feature harus sama pada setiap PR.

## 4. Stack dan batas sistem

| Lapisan | Stack terkunci |
|---|---|
| Workspace | Turborepo + pnpm |
| Kedua frontend | Next.js App Router + TypeScript + Tailwind + shadcn/ui |
| API | Express.js + TypeScript + Zod |
| Data | PostgreSQL Supabase + Prisma hanya di API |
| Identitas | Supabase Auth JWT untuk staf dan pelanggan |
| Media | Supabase Storage |
| Realtime | Supabase postgres_changes pada orders |
| Deploy | Vercel untuk dua frontend, Railway untuk API, Supabase untuk data |

Semua pembacaan data aplikasi melalui API; client Supabase frontend hanya Auth
session dan Realtime. Semua mutasi bisnis, termasuk upload media dan provisioning akun staf,
melalui Express. Tidak ada Next Server Action/Route Handler yang menulis data aplikasi.
Auth session adalah pengecualian identitas; revisi ADR-012 mencakup signup pelanggan
melalui Supabase Auth. Profil/role staf dan mutation data bisnis tetap melalui Express.
Tidak ada gateway, pembayaran tunai/kartu, chat, atau aplikasi native di V1.
Instruksi terbaru mengizinkan akun pelanggan minimal; login wajib sebelum checkout.

## 5. Architecture Decisions

### ADR-001 · Workspace dan migrasi scaffold — decided
Konteks: scaffold npm Next.js sudah ada di webkantin; struktur target kantin-app diminta.
Keputusan: salin scaffold ke apps/web-user, pertahankan sumber awal; gunakan satu pnpm
lockfile di kantin-app. Tidak menyalin node_modules, .next, secret, atau package-lock npm.
Konsekuensi: kantin-app adalah root repository yang akan dipublikasikan; folder lama
hanya referensi. apps/web-admin dan apps/api reserved sampai fase masing-masing.

### ADR-002 · API sebagai batas mutasi — decided
Express satu-satunya penulis data aplikasi; Prisma hanya apps/api.
Storage upload juga diproksikan melalui API. Signed upload URL dibuat/dipakai server,
bukan diberikan untuk browser mengunggah langsung. Ini menyelesaikan perbedaan PRD
signed URL dengan larangan mutasi langsung frontend. Detail upload di F-06/F-07.
Frontend tidak memakai Supabase Data API.

### ADR-003 · Kontrak — decided
packages/shared menyediakan strict Zod schemas, tipe z.infer, enum/status, dan batas.
JSON menggunakan snake_case; ID UUID; timestamp ISO-8601 dengan zona waktu;
penyimpanan UTC, tampilan Asia/Jakarta. Error standar ApiErrorSchema.
Semua input HTTP berasal dari unknown; parse params/query/body/header yang dinormalisasi
sebelum service dipanggil. Unknown key ditolak. Raw header tidak diparse sebagai strict object;
hanya header kontrak yang diekstrak. Tidak ada any di boundary.
Database row dipetakan ke DTO; decimal/bigint/Date Prisma tidak dikirim mentah.

### ADR-004 · Scope dan integritas — decided
Order tepat satu tenant. Keranjang lintas tenant dipisah API dalam satu transaksi atomik.
Nominal integer Rupiah, tanpa floating point. Harga dan snapshot item diambil server.
FK komposit memastikan order_items.tenant_id cocok dengan orders dan menus.
outlets adalah data global, users scope nullable menurut role; keduanya tetap RLS.
Detail model dan constraint: [data-model](data-model.md).

### ADR-005 · RLS dengan Prisma — decided; implementasi M1
Runtime menggunakan role kantin_api NOBYPASSRLS, bukan owner/superuser/postgres.
RLS ENABLE + FORCE pada semua tabel aplikasi. Kredensial migrasi terpisah dari runtime.
Konteks actor/role/tenant terpercaya dipasang transaction-local dengan set_config
terparameterisasi di transaksi Prisma yang sama; query di luar konteks harus gagal tertutup.
Konteks pemesan ditentukan API setelah token diverifikasi, bukan tenant_id kiriman client.
Tambahkan tes lintas tenant dan koneksi pool untuk membuktikan konteks tidak bocor.
Supabase Auth JWT tidak otomatis diteruskan Prisma ke PostgreSQL.
Lihat [SEC-01](security/rls-and-realtime.md). RLS belum terpasang di M0.

### ADR-006 · Tracker tanpa login — proposed; gate sebelum F-04
Kode order yang mudah dibaca bukan rahasia. API memerlukan access token acak
256 bit per order, disimpan sebagai digest pada tabel privat terpisah.
Usulan Realtime: API menukar token itu menjadi JWT 5 menit ber-role order_tracker,
purpose order_tracking, order_id tunggal, dan exp, ditandatangani key yang dikenali Supabase.
Role tersebut hanya SELECT order ber-RLS dan tidak punya hak tulis.
Tidak membuat auth.users atau anonymous sign-in untuk pemesan.
Channel filter hanya optimasi; RLS melakukan otorisasi.
Validasi impor/rotasi signing key dan custom role melalui spike integrasi sebelum F-04;
jangan mengaktifkan SELECT publik orders sebagai jalan pintas. Polling API 15 detik
menjadi fallback, bukan pengganti target Realtime V1. Detail SEC-01 dan F-04.

### ADR-007 · Asumsi bisnis draft — proposed
Pajak/biaya tambahan 0 di V1 sampai aturan disetujui; tidak ada expiry otomatis;
qty 1–99, maksimal 100 baris unik per checkout, nominal per order ≤ Rp1 miliar.
Usulan penolakan, pelaporan ulang, dan pembatalan dirinci hanya di F-03/F-08;
V1 belum memiliki alur refund.
Tenant/outlet/menu dinonaktifkan melalui soft delete; harga/menu_name/QRIS checkout
disnapshot agar perubahan berikutnya tidak mengubah transaksi yang sudah dibuat.
Rincian state dan otorisasi aksi hanya di Feature MD, bukan MASTER.

### ADR-008 · Tooling dan CI — decided
Node 24, pnpm 11; versi exact dependency dan lockfile committed.
Workflow aktif harus berada di .github/workflows pada root GitHub repository.
infra/.github/workflows dipertahankan sesuai struktur permintaan sebagai dokumentasi,
bukan workflow kedua. Tidak ada deploy otomatis pada M0.
Alasan dependency ada di [dependencies](dependencies.md).

### ADR-009 · Satu kantin fakultas, mulai satu tenant — decided
Konteks: pengguna mengonfirmasi satu kantin fakultas dengan beberapa penjual,
namun peluncuran dimulai dengan satu tenant dahulu.
Keputusan: inisialisasi satu outlet kantin fakultas dan satu tenant awal. Penambahan
tenant dilakukan Admin Pengelola lewat web-admin menggunakan API yang sama, tanpa
perubahan kode, migrasi per tenant, atau deploy ulang. Schema dan authorization
multi-tenant tetap dipertahankan; tidak ada tenant ID/merchant yang di-hardcode.
Konsekuensi: data awal operasional hanya satu tenant; aktivasi menunggu kelengkapan
menu dan QRIS. Fixture tenant kedua khusus tes isolasi/checkout lintas tenant,
bukan tenant riil yang wajib ada saat peluncuran. Perilaku katalog satu tenant ada
pada F-01 dan alur penambahan berikutnya pada F-06. Mendukung beberapa fakultas
atau meminta pemesan memilih kantin lain bukan kebutuhan rilis awal.

### ADR-010 · Frontend lebih dahulu dengan placeholder — decided
Pengguna meminta desain frontend web-user dan web-admin sebelum backend/database.
Implementasikan pratinjau lokal Next.js dua aplikasi pada port 3000/3001, dengan
komponen/token bersama. Data contoh sesuai kontrak; interaksi hanya state React
per aplikasi, tidak tersimpan dan belum sinkron antaraplikasi. Tidak ada request
mutasi DB/Supabase, login sungguhan, pembayaran, atau status realtime nyata.
Tandai pratinjau agar placeholder tidak dikira operasional. Admin dapat mencoba
menambah tenant contoh tanpa deploy; koneksi ke katalog pengguna menunggu API.
Rencana database tetap DATA-01; project ID/env bukan schema tabel.

### ADR-011 · Implementasi database siap salin — decided
Pengguna meminta kode database penuh untuk dijalankan sendiri pada Supabase.
SQL baseline di apps/api/prisma/migrations menjadi sumber tunggal dan dibundel
ke infra/supabase/setup.sql. Seluruh tabel aplikasi ENABLE+FORCE RLS, role API
NOBYPASSRLS dan tidak menjadi anggota authenticator; role tracker read-only.
Profile, checkout, capability, payment snapshot dan audit berada di app_private
yang tidak diekspos Data API. Storage foto menu publik, QRIS/denah privat dengan
signed read URL yang dibuat API; URL canonical disimpan, signed URL tidak disimpan.
Audit dan integritas status/nominal ditegakkan trigger. ctx staf mengambil role
dari profil aktif DB; ctx checkout/customer dipasang API setelah verifikasi.
Seed idempotent satu outlet/tenant nonaktif sampai QRIS siap. SQL akun awal dan
password runtime merupakan langkah operator tersendiri, tidak membuat akun Auth
melalui raw SQL. Schema Prisma adalah mapping, bukan pengganti RLS/triggers.
Pemilik proyek menjalankan SQL; agen hanya menguji PostgreSQL lokal terisolasi.

### ADR-012 · Akun pelanggan minimal dan identitas Vokasi UI — decided
Pengguna merevisi kebutuhan: pelanggan mendaftar/masuk dengan nama, email/password;
katalog publik, checkout wajib Auth. Ini mengganti non-goal tanpa login dan asumsi
anonymous pada ADR-006. Tabel users/app_role baseline tetap khusus staf; customer
ownership memerlukan migration tambahan sebelum checkout operasional. Jangan
menjalankan reset atau mengubah baseline yang sudah diberikan pengguna.
Lihat [akun pelanggan](customer-accounts.md). Desain mengikuti screenshot HAKA yang
diberikan pengguna dan logo resmi Vokasi UI; [arah revisi](design/revision-vokasi-ui.md).

### ADR-013 · Revisi tampilan dan pemisahan halaman review — decided
Pengguna memilih katalog B dan panel pengelola A. Halaman aplikasi tidak memuat
kontrol A/B, pemilih role atau ukuran perangkat. Role staf berasal profil API
setelah Auth, bukan pilihan form. Hapus slogan dan catatan proses desain dari UI.
Arsip proposal disimpan hanya untuk dokumentasi, bukan landing aplikasi.
Login staf belum terhubung API: jangan menjadikan submit form sebagai bypass.

### ADR-014 · Palet olive/cream dan operator kantin — decided
Pengguna menetapkan olive #93913D dan cream #F4E7D3 untuk kedua frontend.
Olive menjadi aksen/tombol, cream menjadi canvas; teks dan focus memakai olive
lebih gelap agar terbaca. Logo kiriman pengguna dipertahankan warna aslinya.
Pengguna akhir pengelola kantin memakai admin untuk menambah tenant dan menu
milik tenant yang dipilih tanpa perubahan kode. Tenant mengelola menu/pesanan
miliknya sendiri; pemesan tidak mempunyai akses pengelolaan. Provisioning staf,
Auth, RBAC dan persistensi tetap harus diimplementasikan melalui Express.

### ADR-015 · Latar olive, section cream — decided
Permintaan vendor yang diteruskan pengguna membalik penempatan palet ADR-014:
canvas/latar luar kedua aplikasi #93913D (olive), surface/section/kartu/header/
sidebar/dialog #F4E7D3 (cream). Area teks dan form berada di surface cream dengan
padding yang konsisten; olive terlihat pada gutter antarseksi juga di HP.
Komponen dalam panel memakai surface-muted/cream, bukan mewarisi canvas olive.
Susunan fitur, kontrak data, font dan warna asli logo tetap.

### ADR-016 · Tipografi Poppins — decided
Pengguna mengganti tipografi kedua frontend menjadi Poppins untuk judul, isi,
kontrol, navigasi dan angka. Muat lokal melalui next/font/local dengan weight
400/500/600/700 dan display swap. Ini mengganti Lora/Source Sans 3 pada ADR-013.
Palet olive/cream dan komposisi logo mengikuti ADR-015. Font resmi Google Fonts
dan lisensi OFL disimpan di packages/ui/fonts; tidak ada dependency runtime baru.

## 6. Indeks kontrak, desain, dan keamanan

- [Kontrak shared](../packages/shared/README.md): entities, request/response, tipe, status.
- [Model data dan ERD](data-model.md): tabel, constraint, dan mapping Prisma.
- [Instalasi Supabase](../infra/supabase/README.md), [SQL siap salin](../infra/supabase/setup.sql),
  [konteks API](database-api-context.md), [validasi database](database-validation.md).
- [Template fitur](features/_TEMPLATE.md).
- [DESIGN](design/DESIGN.md), [tokens](design/tokens.md),
  [anti-slop checklist](design/anti-slop-checklist.md).
- [Threat model](security/threat-model.md), [RBAC](security/rbac-matrix.md),
  [RLS dan Realtime](security/rls-and-realtime.md), [OWASP](security/owasp-checklist.md).
- [Validasi M0](foundation-validation.md): cakupan dan batas hasil pemeriksaan.

## 7. Gate milestone

M0: semua sembilan draft fitur ada; shared lolos lint/typecheck/test; tooling dan
dokumentasi dapat dijalankan ulang. Draft tidak otomatis disetujui oleh lulus CI.
M1: review fondasi, Prisma/migrasi/RLS/seed di lingkungan pengembangan, API terverifikasi.
M2: web-user katalog, checkout, QRIS sesuai arah desain. M3: admin + Auth + RBAC.
M4: Realtime terisolasi pemesan terbukti. M5: denah dan hardening.
M6: UAT/deploy; semua MD approved, OWASP ≥90% dan tidak ada kontrol kritis gagal/belum.
Estimasi PRD ±10 minggu untuk satu developer; bukan janji jadwal baru.

## 8. Pertanyaan terbuka (maksimal lima)

1. Siapa pemilik produk/reviewer yang memberi persetujuan dokumen fondasi?
2. Apakah V1 tanpa pajak/biaya layanan dan tanpa expiry otomatis sesuai operasional kantin?
3. Apakah usulan batas qty 99, 100 baris checkout, dan pembatalan hanya sebelum paid dapat diterima?
4. Apakah pengguna menyetujui capability JWT khusus tracker setelah spike Supabase membuktikan isolasinya?

## 9. Changelog dan konflik

| Tanggal | Perubahan/konflik | Penyelesaian |
|---|---|---|
| 2026-11-14 | Pengguna meminta Poppins | ADR-016 mengganti Lora/Source Sans 3 di kedua frontend. |
| 2026-11-14 | Vendor meminta latar olive dan section cream | ADR-015 mengganti penempatan canvas/surface ADR-014 pada kedua frontend. |
| 2026-11-14 | Pengguna menetapkan olive/cream dan pengelolaan oleh operator | ADR-014: admin menambah tenant/menu, tenant hanya miliknya; palet bersama. |
| 2026-11-12 | M0 disusun dari PRD; sembilan Feature MD draft | Tidak ada fitur diimplementasikan. |
| 2026-11-12 | Npm scaffold vs pnpm terkunci | ADR-001; sumber asal tetap utuh. |
| 2026-11-12 | Signed upload client vs seluruh mutasi via Express | ADR-002; server melakukan upload. |
| 2026-11-12 | Tracker code/filter saja tidak membuktikan kepemilikan RLS | ADR-006 proposed; spike wajib sebelum F-04. |
| 2026-11-12 | Prisma owner dapat melewati RLS | ADR-005; role runtime dibatasi, tes DB pada M1. |
| 2026-11-12 | infra/.github bukan lokasi penemuan workflow GitHub | Tambahan root .github/workflows sesuai ADR-008. |
| 2026-11-12 | Pengguna menetapkan satu kantin fakultas, mulai satu tenant | ADR-009; rencana data awal satu tenant, berikutnya lewat admin; fixture dua tenant tetap untuk tes. |
| 2026-11-12 | Pengguna meminta PRD per fitur sebelum coding | Sembilan Feature MD diperbarui sebelum desain frontend. |
| 2026-11-12 | Pengguna meminta frontend user/admin dahulu dengan placeholder | ADR-010; pratinjau lokal kedua aplikasi, backend/DB live ditunda. |
| 2026-11-12 | Pengguna meminta implementasi database penuh siap salin ke Supabase | ADR-011; SQL/Prisma/seed/tes lokal, tanpa eksekusi live. |
| 2026-11-12 | Pelanggan wajib mempunyai akun minimal, mengganti non-goal awal | ADR-012/F-09; katalog publik, checkout Auth; ownership DB/API masih gate integrasi. |
| 2026-11-13 | Kontrol pembanding masuk ke alur aplikasi; logo bertumpuk | ADR-013: katalog B/panel A, tanpa A/B atau pemilih role; logo utuh dan navigasi responsif. |

Hasil implementasi revisi: [validasi frontend Vokasi UI](frontend-vokasi-validation.md).

Audit permintaan pengguna 2026-11-12: [hasil 72 skenario](qa/ACCEPTANCE-2026-11-12.md).
Hasil bukan persetujuan milestone: login staf/Express/persistensi/Realtime/management
user/stok angka belum operasional. Scope Auth simulasi dipisahkan dari signup live.

Validasi revisi 03: [laporan frontend](qa/revision-03-validation.md).

Penyesuaian identitas 2026-11-14: pengguna memberikan emblem PNG transparan untuk
mengganti logo horizontal berlatar putih pada kedua aplikasi. Detail komposisi
ada di arah halaman katalog/pengelola. Alur dan kontrak fitur tetap.
