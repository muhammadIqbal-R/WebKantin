# Denah · Arah halaman

**Status:** draft · 2026-11-12 · Terkait F-05. [DESIGN](../DESIGN.md), [tokens](../tokens.md).

- Hierarki: nama kantin fakultas → lokasi teks → gambar denah → daftar lokasi tenant → kembali menu.
- Rilis awal satu outlet dan satu tenant; tidak menampilkan selector fakultas/kantin.
  Tenant berikutnya ditambahkan pada konteks denah kantin yang sama melalui admin.
- Tipografi: heading outlet, body lokasi, caption keterangan gambar.
- Warna: canvas/surface/ink, action untuk kontrol zoom/kembali; tidak membuat marker tanpa data.
- Spacing/layout: space.4 mobile, space.6 antarseksi; denah menjaga aspect ratio dan dapat
  diperbesar tanpa menghalangi lokasi teks.
- Motion: fast feedback kontrol, tanpa animasi peta; reduced motion didukung.
- State: loading gambar, error retry, empty denah (lokasi teks tetap), default/hover/focus
  kontrol, disabled zoom batas, loading upload hanya pada admin.
- Akses: alt menggambarkan konteks, lokasi penting juga teks, zoom keyboard dan focus terlihat.

# Revisi vendor 21 November

Tanpa denah asli, halaman pelanggan tetap menampilkan lokasi teks dan tenant aktif.
Pada 23 November, arah panel ditetapkan sebagai daftar outlet dengan form lokasi,
pratinjau, unggah, dan status publik. Gunakan tombol untuk meminta ulang gambar
yang gagal dan tautan untuk membuka denah ukuran penuh. Jangan mengarang jam,
posisi tenant, atau gambar denah operasional.

