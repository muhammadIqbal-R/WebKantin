# Lupa password, pesan baru, dan pengembalian dana

## Supabase

1. Jalankan [order-operations-upgrade.sql](../infra/supabase/order-operations-upgrade.sql)
   satu kali setelah [chat-upgrade.sql](../infra/supabase/chat-upgrade.sql). Script
   menambah tabel privat tanpa mengubah deadline pesanan yang sudah ada.
   Lanjutkan dengan [order-fulfillment-upgrade.sql](../infra/supabase/order-fulfillment-upgrade.sql)
   untuk nomor meja dan catatan pesanan. Jalankan sebelum deploy API terbaru.
2. Buka **Authentication → URL Configuration**. Tambahkan URL
   `https://web-kantin-swart.vercel.app/lupa-password` dan URL
   `/lupa-password` pada domain web admin ke **Redirect URLs**.
3. Di **Authentication → Email Templates → Reset password**, ganti tautan
   pada bagian reset password dengan:

   ```html
   <p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery">Atur ulang password</a></p>
   ```

   Formulir memakai verifikasi token Supabase setelah pengguna mengirim password baru.
   Pastikan SMTP produksi berfungsi untuk alamat pelanggan dan tenant. Jika memakai
   provider email yang melacak klik, nonaktifkan pelacakan pada tautan Auth.
   [Panduan template Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).

## Deploy

Deploy API dan kedua frontend setelah migrasi. Setel
`UNPAID_ORDER_TTL_MINUTES=15` pada Railway atau gunakan nilai bawaan.
Biarkan proses API berjalan agar pemeriksaan tenggat berjalan setiap 15 detik,
termasuk saat tidak ada pengunjung. Jika proses berhenti, pemeriksaan lanjut saat
API hidup lagi. Tenggat klaim dilindungi database dan stok dilepas saat worker
berjalan. Versi ini tidak menerapkan tenggat baru pada pesanan yang telah dibuat.

## Uji sebelum vendor memakai fitur

- Buka Lupa password di kedua web, minta tautan dengan akun uji, lalu masukkan
  password baru. Uji tautan kedaluwarsa dan login kembali.
- Tenant kirim pesan saat pelanggan berada di halaman Menu. Periksa badge
  Pesan dan balas lewat kotak pesan, lalu cek badge tenant. Membuka chat dari
  tab aktif menyimpan posisi baca untuk akun tersebut.
- Buat pesanan tanpa mengirim klaim. Setelah tenggat 15 menit, periksa status
  dibatalkan dan stok pulih sekali. Ulangi dengan klaim sebelum tenggat untuk
  memastikan pesanan tersebut masih menunggu konfirmasi.
- Untuk refund uji, gunakan order uji dan referensi uji. Buka Pesanan → Refund
  perlu ditangani, periksa nominal, ambil penanganan dan catat hasil. Refund
  operasional dikembalikan oleh merchant sebelum status disimpan sebagai dana
  dikembalikan. Petugas yang mengambil penanganan bertanggung jawab menutupnya.
