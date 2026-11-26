# Pemulihan dan operasional pesanan

**Status:** draft · 2026-11-25 · Terkait F-02, F-09, F-10, F-11.

Revisi 26 November untuk pelanggan, tenant, dan admin

- Di kartu pembayaran, input gambar wajib di atas tombol Kirim bukti pembayaran.
  Form menampilkan format dan ukuran, alasan penolakan, dan error pengiriman.
  Pengiriman berhasil mengubah kartu ke menunggu pemeriksaan tenant.
- Akun tenant langsung membuka antrean di halaman utama portal tenant. Sidebar tetap memberi
  akses ke menu dan stok. Antrean menonjolkan kode order, status, dan total.
  Dialog membuka gambar saat tenant memilih Lihat bukti pembayaran. Pratinjau
  dapat dimuat ulang. Jika klaim lama tidak punya gambar, tenant melihat kondisi
  tersebut di dialog dan tetap mencocokkan mutasi merchant.
- Admin melihat pesanan untuk pemantauan dan dapat menangani refund sesuai
  peran, dengan aksi konfirmasi bayar dan status tersedia di ruang tenant.
- Sidebar admin memiliki Daftarkan tenant. Form memasangkan identitas tenant
  dengan email dan password awal, lalu membuka detail untuk QRIS dan menu.
  Error akun mempertahankan draft dan memberi cara untuk menyelesaikan tahap
  akun. Semua form mengikuti kolom tunggal di layar sempit.

- Login pelanggan/staf menautkan Lupa password. Dua langkah terpisah untuk
  meminta tautan dan mengisi password baru. Form memuat error, loading, dan
  konfirmasi sukses dengan aksi kembali ke halaman masuk.
- Kartu order unpaid menampilkan tenggat dan aksi klaim. Order kedaluwarsa
  menjelaskan stok sudah dilepas serta pilihan refund bila transfer sudah terjadi.
- Widget Pesan menampilkan jumlah chat belum dibaca dan membuka tiap percakapan
  sesuai kode pesanan. Widget tetap tampil di luar dialog chat.
- Bagian refund memakai nominal, status, alasan, dan aksi yang sesuai peran.
  Sebelum mengambil penanganan, staf harus memeriksa mutasi. Konfirmasi refund
  memerlukan referensi transaksi. Seluruh form mengikuti layout responsif aplikasi.
