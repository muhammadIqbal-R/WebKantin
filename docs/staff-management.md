# Pengelolaan operasional · 20 November 2026

**Lingkup diizinkan pengguna:** login admin/tenant dan pembatasan akses; kelola/nonaktifkan pengguna; tambah/arsip tenant; input stok angka pada menu tenant. Implementasi lokal diizinkan. SQL live dan deploy tetap dilakukan operator. Temuan audit lain tidak otomatis disetujui.

## Kontrak dan keputusan

### Perluasan onboarding tenant · 20 November

Pengguna menegaskan tambah tenant mencakup menu di dalamnya beserta gambar dan detail. Setelah simpan tenant draft, admin diarahkan ke `/tenant/:id` yang berisi menu/foto/harga/kategori/deskripsi/stok tenant itu serta pengaturan QRIS dan aktivasi. Foto menu opsional; foto QRIS dan nama merchant wajib sebelum aktivasi. Akun tenant tetap diundang secara eksplisit. Admin bisa mengelola semua tenant; akun tenant hanya miliknya.

Upload `POST /api/admin/uploads?purpose=menu_photo|tenant_qris&owner_id=<tenant-id>` memakai multipart tepat satu field `file`; metadata Zod, JPEG/PNG/WebP maksimal 2 MiB, pemeriksaan signature/decode, batas 16 juta pixel, satu frame, re-encode WebP lossless sebelum Storage. QRIS tidak di-resize agar kualitas kode tetap; nama objek acak immutable dalam prefix tenant. Signed upload hanya dipakai server. URL aset harus project/bucket/prefix tenant yang sesuai dan objek benar-benar ada; arbitrary URL ditolak. Foto menu publik, QRIS privat dengan signed read URL satu jam pada DTO admin, canonical URL disimpan DB. Bucket tetap dari baseline; tidak menambah tabel/grants browser.

GET publik tenant aktif dan menu aktif disediakan melalui Express dan digunakan katalog pelanggan dengan pagination. Loading/error tidak fallback ke fixture. Detail foto/stock berasal API; checkout, pemotongan stok per order, konfirmasi pembayaran dan Realtime masih tahap terpisah, tidak dibuat operasional oleh perubahan ini. Draft tidak tampil di katalog sampai aktif.

Simpan draft/menu adalah aksi terpisah yang persisten; kegagalan foto tidak membuat menu baru atau menimpa foto lama. Upload yang sudah sukses tetapi penyimpanan menu gagal dapat menjadi orphan; tidak menghapus file yang mungkin sudah dipakai snapshot. Cleanup memerlukan kebijakan retensi berikutnya.

- Supabase Auth email/password untuk staf. Express memverifikasi JWT dengan JWKS project, issuer, audience, expiry dan algoritma asimetris; membaca profil aktif pada setiap transaksi. Role/scope tidak berasal dari metadata atau pilihan UI.
- Admin membuat tenant draft pada outlet yang tersedia, memperbarui identitas, mengarsipkan/memulihkan tenant dan mengundang akun tenant. Tenant mengelola menu/stok miliknya. Arsip menutup penjualan baru, tidak menghapus order atau menghalangi penyelesaian order lama.
- Hapus pengguna berarti **nonaktifkan akses**, dapat dipulihkan; tidak menghapus identitas Auth atau histori permanen. Admin tidak dapat menonaktifkan dirinya. Akun staf aktif ditentukan DB; pelanggan diblokir masuk melalui Auth Admin ban. Tidak mengklaim JWT pelanggan lama langsung hilang; endpoint pelanggan berikutnya wajib memeriksa status blokir.
- Stok per menu berupa integer 0..1.000.000 porsi, **diisi ulang manual sesuai konfirmasi pengguna 20 November 2026**. Input menetapkan jumlah porsi yang tersedia sekarang, bukan menambahkan selisih ke jumlah lama. Admin dapat mengisi stok seluruh tenant; tenant hanya miliknya. Stok 0 memaksa Habis. Pembaruan memakai `expected_version` untuk menolak form lama. Tidak ada reset atau penambahan stok otomatis setiap hari. Pengurangan otomatis saat order dibuat dan pemulihan pembatalan belum termasuk alur checkout operasional pada tahap ini; tetap dicatat sebagai pekerjaan checkout lanjutan.
- Tenant/menu/kategori/deskripsi/stok tersimpan melalui API/Prisma. Data demo pengelola diganti dengan data API. Halaman pesanan dan denah belum diintegrasikan pada lingkup ini; tampilkan status belum tersedia, bukan tindakan demo pada data nyata.

## Endpoint (Zod strict di packages/shared)

| Endpoint | Otoritas dan hasil |
|---|---|
| GET /api/tenants | Publik; TenantListQuerySchema, tenant/outlet aktif saja, QRIS privat tidak disertakan |
| GET /api/tenants/:tenant_id/menus | Publik; TenantParamsSchema + PaginationQuerySchema → ManagedMenusResponseSchema |
| GET /api/admin/tenants/:id | Staf sesuai scope; ManagedTenantResponseSchema dengan preview QRIS bertempo |
| POST /api/admin/uploads | Staf sesuai tujuan/scope; multipart file tunggal → UploadResponseSchema; denah belum tersedia |
| GET /health | Liveness, tanpa data bisnis |
| GET /api/me | Staf aktif → MeResponseSchema |
| GET /api/admin/outlets | Staf aktif, daftar outlet |
| GET /api/admin/tenants | Admin semua tenant; tenant hanya identitas tenant sendiri |
| POST /api/admin/tenants | Admin, CreateTenantRequestSchema → tenant draft |
| PATCH /api/admin/tenants/:id | Admin, ManagedTenantPatchSchema; arsip memakai archived=true, pemulihan tidak otomatis aktif |
| GET /api/admin/menus | Admin semua menu; tenant hanya scope DB; pagination cursor UUID |
| POST /api/admin/menus | ManagedMenuCreateSchema, tenant_id diverifikasi |
| PATCH /api/admin/menus/:id | ManagedMenuPatchSchema, tenant_id tidak dapat dipindah |
| PATCH /api/admin/menus/:id/stock | StockUpdateSchema {stock,expected_version} → ManagedMenuSchema |
| DELETE /api/admin/menus/:id | Nonaktifkan menu; body {} |
| GET /api/admin/users?page=1 | Admin, halaman Auth users dengan role staf dari DB atau pelanggan |
| POST /api/admin/tenant-accounts | Admin, undangan email; profil tenant aktif baru disimpan setelah Auth berhasil |
| PATCH /api/admin/users/:id | Admin, {is_active:boolean}; nonaktifkan/pulihkan, larang self-deactivation |

Semua respons data diparse schema shared. POST/PATCH/DELETE JSON ≤16 KiB, error standar tanpa isi SQL/token/email. CORS allowlist dua origin, Bearer header (tanpa cookie), rate limit per IP dan batas pagination. Akses resource tenant lain 404; endpoint khusus admin 403.

## Migrasi, operasi dan kegagalan

Baseline tidak ditulis ulang. Migration lanjutan menambah archived_at, stok/version dan metadata menu, termasuk constraint dan trigger audit yang sudah ada. Semua tabel tetap FORCE RLS. Runtime menolak owner/BYPASSRLS; transaksi memasang actor/request context lokal. Archival tenant dan pengubahan menu tenant asing diuji di SQL lokal.

Undangan Auth dan transaksi DB bukan transaksi terdistribusi. Bila pemetaan profil gagal, akun Auth yang terundang tidak memperoleh hak staf. Retry pemetaan akun existing memakai ID hasil Auth, tidak mengambil user_metadata sebagai role. API tidak mengirim undangan otomatis saat hanya menyimpan tenant. UI menampilkan kegagalan dan mencegah submit berulang selama pending.

## Desain dan state

Poppins, latar olive, panel cream tetap. Login satu form; role tampil setelah login. Tabel tenant berisi status draft/aktif/arsip dan aksi jelas; form menu berisi jumlah stok, label porsi, error angka, pending dan konflik versi. Halaman akun memiliki daftar pengguna khusus admin dengan konfirmasi nonaktifkan. Loading, konfigurasi API kosong, sesi habis, akses ditolak, data kosong dan gagal jaringan memiliki pesan/retry, tanpa fallback data demo.

## Verifikasi wajib

JWT palsu/expired, sesi tanpa profil staf, tenant A/B, akun nonaktif, self-deactivation, body unknown/stock negatif/pecahan, race stock version, arsip draft tanpa QRIS, restore nonaktif, kegagalan Auth/DB, CRUD persisten, logout membersihkan data, lint/typecheck/build dan tes SQL/API. Live belum dapat dinyatakan lulus tanpa migrasi dan konfigurasi operator.

## Menjalankan pada project Anda

1. Bila baseline telah dipasang, salin hanya [management-upgrade.sql](../infra/supabase/management-upgrade.sql) ke Supabase SQL Editor dan jalankan sekali. Untuk instalasi baru, jalankan [setup.sql](../infra/supabase/setup.sql) lalu upgrade tersebut. Jangan menjalankan ulang baseline pada database existing. Upgrade mengatur stok menu existing menjadi 0/Habis; isi jumlah sebenarnya melalui panel.
2. Siapkan admin Auth dengan email yang benar-benar dapat diakses, kemudian petakan profil staf melalui [configure-access.example.sql](../infra/supabase/configure-access.example.sql) sesuai petunjuk di dalamnya. Tidak perlu membagikan password lewat chat. Admin pertama belum dapat dibuat oleh akun pelanggan biasa.
3. Isi `apps/api/.env` dari [template API](../apps/api/.env.example): DATABASE_URL role `kantin_api`, SUPABASE_URL, SUPABASE_SECRET_KEY server-only, WEB_ADMIN_ORIGIN dan WEB_USER_ORIGIN. Jangan menyediakan DIRECT_URL/owner credential pada proses Railway API. JWKS diturunkan dari SUPABASE_URL untuk mencegah project mismatch; project perlu signing key asimetris yang dipublikasikan JWKS.
4. Isi `apps/web-admin/.env.local` dari [template admin](../apps/web-admin/.env.example). NEXT_PUBLIC_API_URL mengarah API, Supabase URL/publishable key mengarah project yang sama. Secret server tidak boleh menggunakan prefix NEXT_PUBLIC.
5. Pada Supabase Auth, allowlist origin admin dengan path `/login` untuk undangan; Site URL pelanggan tetap sesuai web-user. Undangan tenant dikirim hanya saat admin menekan **Kirim undangan**. Penerima membuka email dan menetapkan password pada halaman akun pengelola.
6. Dari root: `pnpm install --frozen-lockfile`, `pnpm check`, lalu `pnpm dev`. Untuk perintah API langsung, jalankan `pnpm --filter @kantin/shared build` dan `pnpm --filter @kantin/api db:generate` terlebih dahulu. Jalur Turbo menjadwalkan satu task generate sebelum build/typecheck/test/dev API agar generator tidak berjalan bersamaan. API berhenti dengan pesan generik bila DB tidak terjangkau atau role bukan kantin_api; tidak fallback menjadi owner/demo.
7. Untuk Railway: root repo, build `pnpm exec turbo run build --filter=@kantin/api`, start `pnpm --filter @kantin/api start`, isi PORT dari platform. Vercel web-admin tetap root apps/web-admin dan build melalui Turbo dari root; isi env publik lalu redeploy. Domain admin/API harus dimasukkan ke origin/redirect yang sesuai.

Verifikasi operator: login admin; buat tenant draft dan ikuti halaman tenant;
tambahkan menu beserta foto dengan stok 10; ubah stok 0 lalu 8; reload memastikan
tersimpan; unggah QRIS/nama merchant dan aktifkan; muat ulang katalog pelanggan;
undang akun tenant nyata; periksa hanya menunya; arsip/pulihkan draft; nonaktifkan
akun uji dan periksa akses ditolak. Jangan memakai pelanggan/tenant riil sebagai
target penghapusan uji. Checkout, pengurangan stok per pesanan, konfirmasi
pembayaran dan realtime belum terintegrasi tahap ini.

## Storage dan pindah project Supabase

Bucket baseline yang diperlukan: menu-photos publik dan tenant-qris privat.
SUPABASE_SECRET_KEY hanya API untuk signed upload internal, pemeriksaan objek
dan signed read QRIS. Tidak ada signed upload token dikirim ke browser.
NEXT_PUBLIC_API_URL pada kedua frontend harus URL API yang dapat dijangkau;
origin API harus mengizinkan kedua domain Vercel. Bila API belum aktif, katalog
produksi menampilkan error/retry, tanpa fallback menu contoh.

Mengganti project Supabase: migrasikan schema/data/Auth/Storage atau lakukan
setup baru secara terkontrol; URL aset yang disimpan harus sesuai project baru.
Ubah DATABASE_URL, SUPABASE_URL dan SUPABASE_SECRET_KEY pada API serta URL/key
publik Supabase pada kedua frontend. Verifikasi akun/profil staf dan redirect
Auth project baru. Redeploy frontend karena NEXT_PUBLIC dibundel saat build;
restart/redeploy API untuk membaca env baru. Mengubah data/tabel pada project
yang sama tidak otomatis memerlukan frontend redeploy, kecuali kode/kontrak
berubah. Jangan mengulang baseline pada database existing.
