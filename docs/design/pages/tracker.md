# Tracker · Arah halaman

**Status:** draft · 2026-11-12 · Terkait F-04. [DESIGN](../DESIGN.md), [tokens](../tokens.md).

- Hierarki: status terbaru → kode order+tenant → timeline → item/nominal → petunjuk pengambilan.
- Tipografi: display untuk status utama, body untuk langkah, numeric untuk kode/nominal.
- Warna: ink utama; success hanya paid/selesai, warning pending, danger ditolak/dibatalkan;
  sertai label teks, jangan bergantung pada warna.
- Spacing: space.6 antar bagian, space.3 antar langkah; content-user dengan kolom sempit mobile.
- Motion: perubahan status normal singkat tanpa loop; prefers-reduced-motion diikuti.
- State: initial loading; koneksi realtime normal; reconnect/polling label terpisah;
  error retry; empty/akses tidak tersedia generik; terminal timeline tetap terbaca;
  hover/focus/disabled/loading pada tombol retry dan kembali katalog.
- Akses: aria-live polite untuk status baru, tidak mengambil focus setiap event.
  Jangan menampilkan JWT/access token di layar atau URL.


Pratinjau frontend: /pesanan berisi hanya order yang dibuat pada sesi web-user
ini. Tidak menampilkan order fixture admin kepada pemesan. Tanpa Realtime/API,
perubahan status berasal interaksi simulasi; label pratinjau selalu tersedia.
