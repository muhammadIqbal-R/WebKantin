# Arah aktif · Revisi 03

Tipografi aktif sesuai ADR-016: Poppins pada judul, isi, navigasi, kontrol dan angka
kedua frontend (400/500/600/700, dimuat lokal). Komposisi katalog B/panel A
mengikuti pilihan sebelumnya. Palet aktif kedua web
sesuai permintaan vendor ADR-015 (2026-11-14): latar olive #93913D,
section/header/kartu cream #F4E7D3. Ini mengganti penempatan palet ADR-014.
Token aktif adalah packages/ui/src/tokens.css. Logo memakai rasio asli (height auto).
Tanpa kontrol A/B/peran/ukuran atau catatan proses desain di aplikasi.
Rujuk revision-03-brief.md dan pages/landing.md serta pages/admin.md.

## Catatan rancangan terdahulu (historis)

# DESIGN-01 · Arah desain produk

**Status:** draft · 2026-11-12. Istilah mengikuti [MASTER](../MASTER.md).
Sumber spesifikasi: [tokens](tokens.md); implementasi tunggal packages/ui/src/tokens.css.
UI pada tahap ini pratinjau interaktif dengan placeholder, bukan produk tersambung API.

Karakter visual: kantin yang sibuk namun mudah dibaca. Fokus makanan, harga,
nama tenant, dan langkah pemesanan berikutnya. Kertas hangat, teks tinta gelap,
aksen merah bata untuk aksi utama. Foto menu asli menjadi identitas, bukan hero dekoratif.
Font Geist dipertahankan dari scaffold karena angka jelas dan konsisten dua frontend.

web-user mobile-first: tenant → menu → keranjang → checkout → bayar → tracker.
web-admin: antrean order sebagai konteks kerja; tabel/form terbaca dan scope tenant
selalu terlihat. Hindari marketing hero pada aplikasi transaksi.

| Halaman | Rujukan arah desain |
|---|---|
| Katalog | [landing](pages/landing.md) |
| Checkout dan bayar | [checkout](pages/checkout.md) |
| Tracker | [tracker](pages/tracker.md) |
| Admin/login | [admin](pages/admin.md) |
| Denah | [denah](pages/denah.md) |

Setiap implementasi memakai default/hover/focus/disabled/loading/error/empty sesuai
relevansi. Focus keyboard terlihat, target sentuh minimum token control-height,
heading semantik, status bukan warna saja. Hormati prefers-reduced-motion.
Sebelum PR desain merge, jalankan scanner anti-slop yang tersedia dan lampirkan
hasil aktual. M0 tidak melakukan perubahan markup UI; scanner belum dijalankan.

