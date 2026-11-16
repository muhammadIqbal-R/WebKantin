# Pengujian alur pemesanan dan pengelolaan · 2026-11-12

Permintaan pengguna: uji login/daftar, keranjang/pesan/bayar, menu, status,
user management, tenant/menu tenant, stok dan alur terkait.

## Tingkat bukti

- UI_DEMO: klik/form aktual di Next, data bisnis state React.
- LIVE_AUTH: hanya akun pelanggan pada Supabase Auth; signup alias disetujui pengguna.
- READ_ONLY: probe settings Auth dan metadata DB, tanpa mutation bisnis.
- ISOLATED_AUTH: UI web-user yang sama dijalankan pada port 3100 dengan layanan
  Auth simulasi loopback 4100. Untuk menuntaskan checkout tanpa inbox nyata.
- SQL_LOCAL: 24 tes PostgreSQL embedded; bukan bukti koneksi database live.

Tidak membuat pembayaran uang nyata. Hapus menu di UI = nonaktif/soft delete
sesuai PRD. Jangan menghapus user/tenant existing di project live.

## Auth terisolasi

Pengguna menyatakan alamat tenant yang diberikan adalah fiktif; konfirmasi email
akun pelanggan QA tidak bisa diselesaikan. Konfirmasi email Supabase live tetap aktif.
Harness tests/manual/isolated-auth.mjs hanya mock Auth untuk proses QA lokal,
bukan Express API produksi dan bukan bypass pada aplikasi normal.

Harness menjalankan frontend dengan env proses test (tanpa mengubah .env pengguna),
build directory .next-qa-auth, dummy publishable key, serta banner eksplisit.
Mock JWT hanya berlaku pada mock loopback dan tidak dapat mengakses Supabase asli.
Data/password test di RAM; password disimpan hash. Tidak mengirim email.

Konfigurasi Next tambahan hanya pemilihan distDir untuk proses QA. Alur Auth
produksi tetap sama dan tidak memperoleh tombol bypass/login dummy.
Hasil harus menyebut simulasi, tidak boleh dilabeli signup/login live.

## Cakupan

Katalog/filter/pencarian/sorting/unavailable; qty min/max/total, type dine-in/take-away;
signup/negative login/password confirmation; checkout state; report-paid idempotence;
admin accept/reject/reason/progress; tenant create/readiness/deactivate; menu create/
edit/availability/soft-delete/upload; role scope/reload/persistence; no overflow mobile.
Endpoint, stok angka, manajemen user dan Realtime yang belum ada dicatat sebagai gap.
