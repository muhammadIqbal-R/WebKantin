# Hasil uji penerimaan website · 12 November 2026

**Kesimpulan: belum siap operasional.** UI yang tersedia dapat diuji, tetapi
pemesanan dan pengelolaan belum terhubung melalui Express ke database.

72 skenario dicatat: **62 lulus dalam scope masing-masing**, **2 gagal**,
**6 belum tersedia**, **2 terhambat**. Lulus terdiri dari 46 UI demo, 14 dengan
Auth terisolasi, 1 probe Auth baca, dan 1 signup Supabase nyata.
Ini bukan 62 alur produksi yang sudah berfungsi.

## Temuan utama dan prioritas

| Prioritas | Temuan | Dampak / pekerjaan berikutnya |
|---|---|---|
| P0 sebelum deploy | R-02: admin langsung terbuka tanpa login staf; reload mereset role demo ke admin | Auth staf + verifikasi JWT/RBAC Express dan guard frontend belum ada; pilihan peran bukan keamanan |
| P0 | Tidak ada entry point/route Express; mutation hanya state React | Order, menu, tenant dan konfirmasi tidak tersimpan/sinkron antar-app/tab |
| P1 | T-05: tenant contoh dapat aktif kembali meski QRIS gambar kosong | Gate UI perlu cek QRIS lengkap; SQL baseline menolak tenant aktif tanpa QRIS, tetapi API belum terhubung |
| P1 | Daftar/hapus/provisioning user, arsip draft tenant belum ada pada UI/API | Manajemen user dan seluruh lifecycle tenant belum dapat diuji sebagai fitur aplikasi |
| P1 | Stok hanya flag Tersedia/Habis | Belum ada jumlah stok, reservasi, pengurangan/restock atau concurrency stok |
| P1 | Customer ownership migration, tracker realtime dan QRIS nyata belum ada | Checkout/status operasional lintas akun belum dapat dibuktikan |

## Auth, database dan data uji

Supabase Auth settings live mengembalikan HTTP 200: email provider dan signup aktif,
konfirmasi email wajib. Pengguna mengizinkan alias pelanggan, kemudian menjelaskan
alamat email itu fiktif. Signup dari halaman membuat QA Pelanggan Kantin; pembacaan
Auth Admin menemukan akun belum terkonfirmasi. Login sukses dan konfirmasi email
**live tetap terhambat**, bukan dinyatakan lulus.

Untuk menyelesaikan UI checkout/logout tanpa inbox, dijalankan Auth fixture loopback
terpisah. Signup/login/session/logout di port 3100 memakai SDK dan form aplikasi
yang sama, dengan banner simulasi, identitas @example.test, serta token yang hanya
berlaku pada mock lokal. Tidak ada bypass pada Supabase atau pengaturan email live.

Koneksi PostgreSQL DATABASE_URL dan DIRECT_URL dicoba read-only; keduanya gagal
resolusi DNS (EAI_AGAIN) sebelum autentikasi. Tabel, role dan RLS Supabase live belum
bisa diverifikasi. Tidak ada DDL atau mutation bisnis SQL dijalankan ke project live.

## Pemeriksaan otomatis

- pnpm check: lint, typecheck, dokumen, token desain, Prisma validate dan bundle SQL.
- pnpm exec turbo run test --force: **17 tes shared + 24 tes PostgreSQL lokal lulus**,
  dijalankan ulang tanpa Turbo cache. Ini 41 tes otomatis tambahan, terpisah matriks UI.
- Tes database menggunakan PGlite dengan schema Auth/Storage fixture; tidak membuktikan
  koneksi jaringan, JWT signature, email, Storage live, atau event Realtime Supabase.
- Tidak ada pembayaran QRIS sungguhan, transaksi kartu/tunai atau payment gateway.


## Matriks hasil lengkap

| ID | Skenario | Hasil | Bukti / batas |
|---|---|---|---|
| U-01 | Katalog awal | Lulus UI demo | 8 menu contoh terlihat |
| U-02 | Filter kategori minuman | Lulus UI demo | Kategori menampilkan 2 minuman |
| U-03 | Pencarian tidak peka kapital | Lulus UI demo | NASI menampilkan 2 menu |
| U-04 | Pencarian kosong hasil | Lulus UI demo | Empty state muncul |
| U-05 | Urutan harga naik | Lulus UI demo | Harga tampil berurutan |
| U-06 | Menu habis tidak dapat ditambah | Lulus UI demo | Tombol tambah pada dialog habis disabled |
| U-07 | Tambah dua produk dan total | Lulus UI demo | 1 ayam 18.000 + 1 teh 6.000 = 24.000 |
| U-08 | Tambah kuantitas | Lulus UI demo | 2 ayam + 1 teh = 42.000 |
| U-09 | Kurangi kuantitas | Lulus UI demo | Total kembali 24.000 |
| U-10 | Jumlah nol menghapus baris | Lulus UI demo | Keranjang kosong, tidak ada jumlah negatif |
| U-11 | Checkout kosong disabled | Lulus UI demo | Tombol checkout kosong disabled |
| U-12 | Batas 99 item | Lulus UI demo | Tambah disabled pada 99; total 1.782.000 |
| U-13 | Pilih take away | Lulus UI demo | Pilihan take away aktif |
| U-14 | Checkout wajib sesi | Lulus UI demo | Checkout anonymous diblokir oleh login gate frontend |
| U-15 | Keranjang bertahan saat menuju Auth | Lulus UI demo | 99 item tetap tersedia saat navigasi ke masuk |
| A-01 | Konfirmasi password berbeda ditolak | Lulus UI demo | Validasi lokal menolak; tidak mengirim signup |
| A-02 | Email salah format ditolak | Lulus UI demo | Input email memiliki validity false |
| A-03 | Password disamarkan | Lulus UI demo | Field memakai type=password |
| AD-01 | Login admin/tenant sungguhan | Belum tersedia | Halaman hanya memilih peran dan Masuk pratinjau; tanpa kredensial/JWT. |
| AD-02 | Dashboard pratinjau | Lulus UI demo | Dashboard menampilkan antrean perlu tindakan |
| M-01 | Harga nol ditolak | Lulus UI demo | Browser menolak harga kurang dari 1 |
| M-02 | Tambah menu tenant | Lulus UI demo | Menu QA muncul pada tenant pertama, harga 17.500 |
| M-03 | Ubah menu menjadi habis | Lulus UI demo | Ketersediaan false/Habis |
| M-04 | Filter menu habis | Lulus UI demo | Menu QA masuk filter Tidak tersedia |
| M-05 | Edit nama dan harga | Lulus UI demo | Nama berubah dan harga menjadi 19.000 |
| M-06 | Hapus lunak menu | Lulus UI demo | Menu nonaktif hilang dari daftar; tidak menghapus history |
| T-01 | Tambah tenant | Lulus UI demo | Tenant baru muncul sebagai Draft |
| T-02 | Aktivasi tenant belum lengkap diblokir | Lulus UI demo | Tenant tanpa QRIS/menu tidak bisa aktif |
| T-03 | Menu dipetakan ke tenant baru | Lulus UI demo | Menu baru masuk scope tenant baru |
| R-01 | Tenant tidak melihat menu tenant lain | Lulus UI demo | Menu tenant kedua tersembunyi saat scope tenant pertama |
| R-02 | Akses direct URL tanpa login staf | Gagal | Navigasi penuh mereset role demo ke admin; /tenant langsung terbuka tanpa JWT staf. |
| A-04 | Login salah menampilkan error generik | Lulus UI demo | UI menolak login; pesan tidak membocorkan akun |
| P-01 | Persistensi sesudah refresh/navigasi penuh | Belum tersedia | Tenant dan menu QA kembali hilang; state React belum disimpan ke API/database. |
| R-03 | Guard peran pada navigasi client | Lulus UI demo | Peran tenant diblokir pada halaman tenant selama state demo bertahan |
| T-04 | Nonaktifkan tenant awal | Lulus UI demo | Tenant awal bisa dinonaktifkan dalam state lokal |
| T-05 | Blokir aktivasi saat gambar QRIS belum ada | Gagal | Tenant awal masih dapat diaktifkan kembali meskipun QRIS placeholder. |
| AC-01 | Daftar dan hapus user pelanggan/staf | Belum tersedia | Halaman akun hanya menampilkan profil contoh; tidak ada daftar pengguna/aksi hapus/provisioning. |
| T-06 | Hapus tenant baru/draft | Belum tersedia | Tidak ada aksi hapus/arsip pada draft; hanya toggle aktif yang disabled sampai setup lengkap. |
| S-01 | Stok tenant berbasis jumlah | Belum tersedia | Menu hanya is_available boolean Tersedia/Habis; belum ada stok angka, reservasi atau pengurangan stok per order. |
| O-01 | Konfirmasi pembayaran contoh | Lulus UI demo | Pesanan pertama beralih pending ke Diproses |
| O-02 | Status diproses menjadi siap | Lulus UI demo | Status menjadi Siap diambil |
| O-03 | Status siap menjadi selesai | Lulus UI demo | Status menjadi Selesai |
| O-04 | Penolakan perlu alasan | Lulus UI demo | Alasan kosong menghasilkan validasi |
| O-05 | Tolak pembayaran contoh | Lulus UI demo | Pesanan keempat kembali menunggu bayar |
| O-06 | Antrean pending setelah keputusan | Lulus UI demo | Tidak ada tombol Periksa setelah dua pending diputuskan |
| O-07 | Pesan sampai QRIS nyata dari web-user | Terhambat | Belum ada sesi akun uji terkonfirmasi; checkout yang tersedia hanya membuat order demo, QRIS masih placeholder. |
| O-08 | Order customer muncul di admin dan status realtime kembali ke customer | Belum tersedia | Dua DemoProvider terpisah; tidak ada endpoint Express atau subscription Realtime operasional. |
| A-05 | Konfigurasi Auth live read-only | Lulus probe baca | GET auth/v1/settings HTTP 200; email provider aktif, signup aktif, email confirmation wajib. |
| A-06 | Daftar, konfirmasi email, login sukses, logout akun nyata | Terhambat | Email yang disetujui dinyatakan fiktif oleh pengguna; konfirmasi inbox tidak tersedia. Login sukses Supabase live belum terverifikasi. |
| F-01 | Upload SVG ditolak | Lulus UI demo | SVG tidak termasuk MIME yang diizinkan |
| F-02 | Upload lebih dari 2 MiB ditolak | Lulus UI demo | File 2.097.153 byte ditolak |
| F-03 | Preview JPG valid | Lulus UI demo | JPG valid dipreview lokal sebagai blob; belum upload ke Storage |
| A-07 | Submit signup pelanggan dari UI | Lulus signup live | Signup dari UI membuat akun QA di Supabase; pemeriksaan Auth Admin read-only menemukan akun belum terkonfirmasi. |
| I-01 | Signup pelanggan dengan Auth terisolasi | Lulus Auth terisolasi | Session mock dibuat melalui SDK dan UI checkout terbuka; bukan konfirmasi email live. |
| I-02 | Nama kosong/spasi ditolak | Lulus Auth terisolasi | Zod menolak nama hanya spasi |
| I-03 | Checkout take away membuat order contoh | Lulus Auth terisolasi | 2 produk, total 24.000, tipe Bawa pulang, status menunggu bayar. |
| I-04 | QRIS tidak menyamar sebagai pembayaran nyata | Lulus Auth terisolasi | QRIS ditandai placeholder dan melarang transfer pada preview. |
| I-05 | Klaim bayar masuk pending konfirmasi | Lulus Auth terisolasi | Klaim tidak langsung menandai lunas; menunggu konfirmasi. |
| I-06 | Cegah klaim bayar berulang pada UI | Lulus Auth terisolasi | Tombol klaim hilang setelah pending; idempotency server diuji terpisah SQL lokal. |
| I-07 | Profil akun pelanggan terisolasi | Lulus Auth terisolasi | Nama display dan email akun test ditampilkan; tidak ada peran staf. |
| I-08 | Logout mereset keranjang | Lulus Auth terisolasi | Session mock keluar dan keranjang kembali nol. |
| I-09 | Logout membersihkan order contoh | Lulus Auth terisolasi | Order dari sesi sebelumnya tidak terlihat sesudah logout. |
| I-10 | Login akun test yang sudah terdaftar | Lulus Auth terisolasi | Signin mock sukses, checkout terbuka tanpa memulihkan order lama. |
| I-11 | Session dipulihkan sesudah refresh | Lulus Auth terisolasi | SDK membaca session mock yang masih berlaku; data bisnis tetap hanya state lokal. |
| I-12 | Ubah jumlah pada checkout | Lulus Auth terisolasi | 2 camilan pada checkout dihitung 20.000. |
| I-13 | Checkout dine in | Lulus Auth terisolasi | Order dine in dibuat dengan total 10.000 dan status menunggu bayar. |
| UX-01 | Escape menutup dialog dan memulihkan fokus | Lulus UI demo | Dialog hilang dan fokus kembali ke tombol Tambah menu |
| UX-02 | Tracker pesanan pada HP | Lulus Auth terisolasi | Tracker order QA tidak overflow pada 360px. |
| UX-03 | Pesanan admin pada HP | Lulus UI demo | 360px tidak overflow; pesanan memakai daftar vertikal. |
| O-09 | Filter status admin | Lulus UI demo | Filter menampilkan 2 pending pada dataset baru |
| O-10 | Pencarian pesanan kosong | Lulus UI demo | Empty state pesanan tampil |
| R-04 | Tenant tidak dapat mengedit denah | Lulus UI demo | Guard denah menolak role tenant setelah navigasi selesai; pemeriksaan awal terlalu dini dan dikoreksi. |

## Bukti dan menjalankan ulang

- [Hasil JSON](acceptance-results.json).
- [Pesanan menunggu konfirmasi — Auth terisolasi](evidence/isolated-order-pending.png).
- [Tracker HP — Auth terisolasi](evidence/isolated-order-mobile.png).
- [Pesanan admin HP](evidence/admin-mobile-orders.png).
- [Rencana/scope pengujian](acceptance-plan.md).

Dari root kantin-app:

~~~sh
pnpm check
pnpm exec turbo run test --force
pnpm --filter @kantin/shared build
pnpm test:ui:auth
~~~

Harness menjalankan web-user localhost:3100 dan mock Auth loopback 127.0.0.1:4100;
gunakan identitas @example.test. Proses tidak mengubah .env asli, tidak mematikan
konfirmasi email live, tidak mengakses DB produksi, dan menampilkan banner QA
TERISOLASI. Data fixture hilang saat dihentikan. Config TypeScript/build QA terpisah
dan diabaikan Git. Mock ini bukan implementasi API bisnis Express.

Pengujian bisnis tidak melakukan transfer QRIS nyata. Hapus menu yang diuji adalah
nonaktif/soft-delete. Akun Supabase QA yang sempat didaftarkan sudah dihapus melalui
Auth Admin API setelah memverifikasi email/nama QA, umur, belum dikonfirmasi dan
belum login. Pengguna existing/akun tenant tidak diubah. Ini cleanup fixture, bukan
bukti fitur hapus user pada website sudah tersedia.


Verifikasi akhir: pnpm check lulus (11 task Turbo), 41 tes otomatis fresh lulus,
node --check harness lulus, pnpm build lulus (3 task). HTML produksi web-user
tidak memuat banner QA TERISOLASI. Server Auth simulasi dan port 3100/4100
sudah dihentikan; file upload sementara dibersihkan. Temuan R-02/T-05 tetap terbuka;
perubahan source pada pekerjaan ini hanya mendukung harness QA dan pemisahan build.
