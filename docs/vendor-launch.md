# Revisi vendor · 21 November 2026

**Lingkup:** masukan vendor disampaikan pengguna untuk diterapkan pada web pelanggan/pengelola. Dokumentasi dan kontrak diperbarui sebelum kode. Instalasi SQL live, akun/email nyata, push dan deploy tetap langkah operator.

## Alur dan akun

Beranda pelanggan menampilkan pilihan tenant, termasuk bila baru satu tenant. Pilih tenant → menu → keranjang → login pelanggan → checkout → QRIS tenant → klaim bayar → konfirmasi manual tenant → diproses/siap/selesai. Satu order satu tenant.

Admin pertama dibuat sebagai akun Auth oleh operator dan dipetakan ke role admin melalui SQL konfigurasi operator. Tidak ada pendaftaran admin publik/pemilih role. Tenant dibuat admin, pengelolanya diundang lewat email; penerima menetapkan password dan memakai login staf yang sama. Admin dapat menghubungkan akun pelanggan existing secara eksplisit; tidak boleh mengambil profil staf/tenant lain. Signup pelanggan tidak memberi hak staf. Logout membersihkan data/subscription.

## Katalog vendor

| Tenant | Menu | Harga (Rp) |
|---|---|---:|
| Tens | Americano | 12000 |
| Tens | Karambol | 23000 |
| Tens | Matcha Latte | 18000 |
| Mie Ayam | Mie Yamin | 12000 |
| Mie Ayam | Pangsit Rebus | 5000 |
| Mie Ayam | Bakso Keju | 10000 |
| Bento | Paket A | 23000 |
| Bento | Paket B | 25000 |
| Bento | Paket C | 28000 |

Import melalui tombol admin/Express, idempotent/atomik; tidak mengulang baseline. Tenant draft, foto/QRIS kosong sampai diisi. Pengguna mengonfirmasi stok awal 0/Habis pada 21 November; jumlah sebenarnya diisi manual. Menu existing dengan nama sama tidak ditimpa saat import ulang. Data lama tidak dihapus.

## Pesanan dan stok

JWT pelanggan diverifikasi dan kondisi Auth aktif diperiksa. Order baru terikat sub tersebut. Checkout atomik mengambil harga/snapshot DB, mengelompokkan order per tenant; input hanya ID/qty/nama/cara pesan. UUID idempotency dan hash payload termasuk owner mencegah replay lintas akun. Respons replay dienkripsi AES-256-GCM, kunci server 32 byte/nonce unik; token legacy tetap digest di DB, bukan identitas utama akun.

Stok berkurang atomik saat order dibuat. Stok kurang menggagalkan seluruh checkout. Pembatalan sebelum paid mengembalikan stok sekali; penolakan pembayaran tidak memulihkan stok. Revisi 25 November menambah tenggat 15 menit hanya untuk order baru yang belum diklaim dan refund manual tercatat terpisah. QRIS dari snapshot, signed read melalui API. Saya sudah bayar hanya klaim; tenant mencocokkan mutasi sebelum terima. Semua transisi memakai version/audit server.

## Kontrak HTTP (Zod strict shared)

| Endpoint | Input / respons |
|---|---|
| POST /api/admin/catalog-import | VendorImportRequestSchema → VendorImportResponseSchema |
| POST /api/admin/tenant-accounts/link | ExistingTenantAccountSchema → MeResponseSchema |
| POST /api/orders | Customer JWT, CheckoutHeadersSchema, CreateOrdersRequestSchema → CreateOrdersResponseSchema |
| GET /api/orders | Customer JWT, PaginationQuerySchema → OwnedOrdersResponseSchema |
| GET /api/orders/:id/payment | Pemilik → PaymentInstructionsResponseSchema |
| PATCH /api/orders/:id/paid | Pemilik, ReportPaidRequestSchema → Order response |
| GET /api/admin/orders | AdminOrderQuerySchema → AdminOrderListResponseSchema |
| GET /api/admin/orders/:id | Staf sesuai tenant → OrderDetailResponseSchema |
| GET /api/admin/orders/:id/payment | Staf sesuai tenant → PaymentInstructionsResponseSchema |
| PATCH /api/admin/orders/:id/confirm-payment | ConfirmPaymentRequestSchema → Order response |
| PATCH /api/admin/orders/:id/status | UpdateOrderStatusRequestSchema → Order response |
| GET /api/admin/order-notifications | Cursor opaque tervalidasi → OrderNotificationFeedSchema |

## Realtime dan notifikasi

Akun baru memakai JWT Supabase Auth untuk SELECT orders dengan RLS pemilik/staf aktif DB. Semua mutasi tetap API. Policy restrictive membatasi authenticated meski ada policy permissive lain. Auth banned ditolak API/Realtime; order lama tanpa owner tidak terlihat pelanggan. Publication menambahkan INSERT/UPDATE sambil mempertahankan delete/truncate yang sudah aktif; operator meninjau dampaknya pada tabel lain di publication tersebut.

Panel terbuka menampilkan indikator dan bunyi untuk order/claim baru. Audio perlu tombol aktifkan (user gesture), tes/matikan tersedia. Notifikasi desktop opsional atas izin; tanpa jaminan saat browser ditutup karena tidak memakai Web Push. Jangan memasukkan nama/email/nominal/token pada notifikasi desktop.

Feed awal tidak membunyikan histori. Dedupe id/version menangani polling dan Realtime; polling 5 detik dengan cursor updated_at/id menjadi fallback. Reconnect refetch API. Subscription/audio dibersihkan saat logout/pergantian akun.

## Migration dan penerimaan

Migration append-only menambah customer_id orders/checkout_requests, guard ownership/inventory, helper Auth dan RLS. Tidak menebak ownership order lama berdasarkan nama. Prisma dan FORCE RLS tetap; operator menjalankan upgrade berurutan.

Tes: harga/import idempotent, tenant-first, linking staf, checkout retry/rollback/stok, owner A/B dan tenant A/B, claim vs paid, reject/accept/version/cancel-restock, JWT/banned, RLS tanpa filter, feed cursor/dedupe, polling cleanup, audio opt-in. Bedakan tes lokal/doubles dan UAT Supabase/browser live.

## Langkah operator: admin, tenant dan katalog

1. Database baru: jalankan [setup.sql](../infra/supabase/setup.sql), [management-upgrade.sql](../infra/supabase/management-upgrade.sql), lalu [orders-upgrade.sql](../infra/supabase/orders-upgrade.sql). Database existing yang sudah dipasang sampai management hanya memerlukan orders-upgrade sekali; jangan mengulang baseline. Tidak ada SQL live dijalankan agen.

   Untuk versi dengan chat pesanan, lanjutkan dengan
   [chat-upgrade.sql](../infra/supabase/chat-upgrade.sql) sekali setelah upgrade orders.
   Paket terbaru memerlukan [order-operations-upgrade.sql](../infra/supabase/order-operations-upgrade.sql)
   setelah upgrade chat. Lihat [konfigurasi recovery dan worker](order-operations.md).
2. Admin pertama: di Supabase Authentication buat akun aplikasi dengan email Anda yang dapat dibuka dan password sendiri (atau gunakan akun aplikasi yang sudah terdaftar). Akun dashboard Supabase dan password database berbeda dari akun aplikasi ini. Jalankan [bootstrap-admin.example.sql](../infra/supabase/bootstrap-admin.example.sql) sebagai operator setelah mengganti admin_email. Bila role kantin_api belum LOGIN, isi password database runtime acak minimal 24 karakter pada template. Script tidak membuat Auth user, tidak membutuhkan akun tenant awal, tidak menimpa role existing dan tidak mencetak password.
3. API: isi DATABASE_URL kantin_api, SUPABASE_URL, SUPABASE_SECRET_KEY dan dua WEB_*_ORIGIN. Jalankan `pnpm --filter @kantin/api key:setup` untuk mengisi kunci enkripsi checkout lokal jika masih kosong/placeholder. Kunci tidak dicetak. Untuk Railway, pindahkan nilai kunci tersebut secara privat ke IDEMPOTENCY_ENCRYPTION_KEY; pertahankan nilai yang sama antar-replica/deploy agar replay lama tetap terbaca. DIRECT_URL/owner credential tidak diberikan ke runtime API.
4. Kedua frontend: NEXT_PUBLIC_API_URL adalah URL API yang aktif, NEXT_PUBLIC_SUPABASE_URL/publishable key project yang sama. Isi NEXT_PUBLIC_ADMIN_URL pada web-user dengan domain login admin; isi NEXT_PUBLIC_USER_URL pada web-admin dengan domain pelanggan. Build produksi tidak memakai fallback localhost untuk tautan antarportal yang belum diisi. Konfigurasikan redirect Auth untuk domain user `/masuk` dan domain admin `/login`; restart API/redeploy frontend setelah env berubah.
5. Login web-admin dengan akun admin. Buka Tenant → Tambahkan katalog vendor → tinjau 3 tenant/9 menu → konfirmasi. Buka Kelola tenant untuk mengisi foto, QRIS merchant dan stok manual; aktifkan setelah siap. Import ulang tidak menggandakan/menimpa menu existing, data placeholder lama tidak dihapus otomatis.
6. Tenant baru: admin menekan Undang akun pada tenant, memasukkan email pengelola yang benar; penerima membuka tautan dan menetapkan password pada login pengelola. Bila email sudah menjadi akun pelanggan, gunakan Akun & akses → Jadikan akun tenant → pilih tenant. Tidak perlu mendaftar sebagai tenant dari web pelanggan.
7. Buka panel Pesanan tenant dan tekan Aktifkan bunyi, lalu Tes bunyi. Izin desktop opsional. Pesanan baru/klaim bayar memberi indikator dan suara; jangan menerima pembayaran sebelum memeriksa mutasi merchant. Panel/browser harus tetap terbuka; tidak ada Web Push saat browser ditutup.

UAT operator: pelanggan pilih tenant dahulu, daftar/login, pesan lintas dua tenant,
cek stok dan order terpisah, scan QRIS/konfirmasi manual dengan nominal terkontrol,
uji reject/ulang claim, siap/selesai, batal unpaid/restock, bunyi satu kali,
permission denied, reconnect dan logout lintas akun. Gunakan akun/data uji,
bukan transaksi riil untuk membuktikan mekanisme tanpa otorisasi pembayaran.
