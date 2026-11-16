# Hasil revisi frontend Vokasi UI · 2026-11-12

Desain direvisi mengikuti screenshot HAKA yang diberikan pengguna: kategori foto,
daftar menu ringkas, dialog detail, keranjang bawah HP. Logo asli Vokasi UI diambil
dari situs resmi dan disalin lokal tanpa perubahan gambar. Palet kuning UI/biru tinta,
body Arial/Helvetica; tidak mengklaim font/kode warna aplikasi sebagai standar resmi.

Admin berfokus pada konfirmasi pembayaran dan antrean; grafik ilustrasi dihapus.
Pada HP pesanan menjadi daftar berlabel, dengan nominal/status/aksi terlihat.

## Bukti browser

| Target | Lebar diuji | Hasil |
|---|---|---|
| Katalog user | 360, 390, 768, 1440 px | scrollWidth tidak melebihi viewport |
| Form daftar pelanggan | 360, 390, 768, 1440 px | tidak overflow; 2 password fields |
| Dashboard admin | 360, 390, 768, 1440 px | tidak overflow; nav scroll dalam region |
| Tracker/lokasi/akun user | 360 px | tidak overflow |
| Pesanan/menu/tenant/denah/akun/login admin | 360 px | tidak overflow |

Interaksi aktual: kategori Minuman menampilkan dua menu, detail foto terbuka,
tambah dari dialog memperbarui keranjang, sticky bottom berposisi fixed, checkout
anonymous menampilkan login gate, navigasi ke masuk mempertahankan satu item,
tab Buat akun menampilkan nama/email/password/konfirmasi, detail pesanan admin
bisa dibuka dari list HP. Dialog mengembalikan focus ke pemicu saat ditutup.
Tidak ada akun nyata dibuat atau email/Auth form valid dikirim selama QA.

Bukti:
[katalog desktop](design/previews/user-vokasi-desktop.png),
[katalog HP](design/previews/user-vokasi-mobile.png),
[admin desktop](design/previews/admin-vokasi-desktop.png),
[admin HP](design/previews/admin-vokasi-mobile.png),
[daftar HP](design/previews/customer-signup-mobile.png).

## Akun dan batas integrasi

Form pelanggan terhubung ke Supabase Auth SDK: signup, signin, session subscription,
signout. JWT/password tidak disimpan pada data demo. Logout mereset provider demo.
Ini implementasi client Auth, bukan bukti signup/login nyata sudah berhasil.
Operator perlu mengaktifkan signup pelanggan dan email confirmation, redirect allowlist.
[Spesifikasi akun](customer-accounts.md).

Katalog/checkout/order/admin tetap state demo; Express belum terhubung.
Migration customer ownership dan auth server checkout masih diperlukan sebelum
transaksi operasional. Baseline SQL tidak diubah atau di-reset.

## Pemeriksaan konfigurasi database

DATABASE_URL dan DIRECT_URL lokal memiliki password non-placeholder, user/host/
SSL/schema sesuai format. URL/JWKS dan publishable key kedua frontend konsisten.
Secret key tidak ditampilkan dan rotasinya belum diverifikasi.
IDEMPOTENCY_ENCRYPTION_KEY dan dua signing-key tracker belum ada pada file lokal
saat pengecekan. Ini kebutuhan service API berikutnya, bukan syarat render frontend.

Koneksi baca DB dicoba sebagai kantin_api dan postgres tanpa mutation, tetapi gagal
sebelum autentikasi pada resolusi DNS (ENOTFOUND/EAI_AGAIN), termasuk percobaan
di luar sandbox. Login password, tabel/RLS dan akun live belum terverifikasi.
Gunakan detail dari Supabase Connect, termasuk session pooler bila direct host
tidak terjangkau; jangan menebak host region atau mengirim password ke chat.

## Pemeriksaan kode

pnpm check terakhir lulus: 49 dokumen Markdown, 26 file guard desain,
11 task Turbo; 17 tes shared + 24 tes DB lokal, lint, typecheck,
guard desain, Prisma validate dan SQL bundle check.
Turbopack build Windows gagal pada worker CSS child process; Webpack bawaan Next
berhasil membangun kedua frontend. Script build kedua app memakai next build --webpack
agar perintah root konsisten. Dev tetap Turbopack. pnpm build root lulus: 3 task (shared dan dua Next.js frontend), tanpa deploy.

Pratinjau sementara dihentikan setelah QA. Jalankan pnpm dev dari root untuk
membuka kembali web-user port 3000 dan web-admin port 3001.
