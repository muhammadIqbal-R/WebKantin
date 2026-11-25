# Chat pesanan

**Status:** draft · 2026-11-24 · Terkait F-10. [DESIGN](../DESIGN.md)

- Pelanggan membuka chat dari kartu pesanan. Tenant membuka chat dari detail
  pesanan. Kode pesanan tetap terlihat. Kedua peran menggunakan komponen bersama.
- Tampilkan pengirim, waktu, isi pesan, riwayat lebih lama, dan kolom balasan.
  Teks panjang terbungkus pada layar kecil. Warna berasal dari token aplikasi.
- Loading, pesan kosong, retry pengiriman, gagal sinkron, dan pesanan selesai
  punya pesan yang menjelaskan tindakan yang tersedia. Pesanan ditutup
  tetap menampilkan riwayat dan menonaktifkan formulir.
- Kotak pesan menampilkan pesan belum dibaca di seluruh web setelah login,
  termasuk saat dialog chat ditutup. Posisi baca diperbarui saat riwayat
  ditampilkan di tab aktif.
