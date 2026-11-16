# Katalog · Revisi 03

**Status:** draft · 2026-11-12 · F-01, ADR-013.

Arah B dipilih pengguna: nama tenant sebagai judul tunggal, pencarian, tab kategori,
grid dua kolom foto/nama/harga dan tambah/jumlah. Lora pada judul, Source Sans 3
pada kontrol. Kertas hangat dengan aksen oranye gelap. Keranjang kanan desktop,
ringkasan di atas navigasi bawah pada HP. Tanpa hero/slogan, pemilih A/B/peran,
catatan font/logo atau disclaimer berulang. Data tetap placeholder pada state lokal.
Logo utuh dengan height auto, tidak menyentuh nav. Minimal 360px tanpa body overflow.
State: empty pencarian/tenant, unavailable, detail modal, tambah/kurang, cart.

## Penyesuaian logo · 2026-11-14
Pengguna menyediakan emblem Vokasi UI transparan (PNG 564×592). Gunakan berkas
asli pada kedua frontend, tanpa recolor/crop/kotak latar. Susun emblem dan nama
layanan horizontal: 44px desktop, 36px HP, rasio asli dan jarak 12px. Nama layanan
dan identitas universitas berupa teks terpisah; sidebar tidak memakai logo besar
bertumpuk. Tidak menambah slogan atau kontrol pilihan peran/desain.

## Palet aktif · 2026-11-14
Olive #93913D dan cream #F4E7D3 menggantikan aksen oranye/hijau terdahulu.
Kedua frontend memakai token bersama. Tombol olive memakai teks gelap; link,
focus dan teks aksen memakai olive gelap, bukan olive muda sebagai teks kecil.
Susunan halaman, font dan logo kiriman pengguna dipertahankan. ADR-014.

## Penempatan palet vendor · 2026-11-14
ADR-015: canvas olive #93913D; section, kartu, header, sidebar dan dialog cream
#F4E7D3. Judul halaman, katalog, ringkasan dan form diberi surface cream serta
padding; gutter olive tetap terlihat pada HP. Hover/segmented/tabel di dalam
section memakai cream muted. Tidak mengubah font, logo, atau alur bisnis.

## Tipografi aktif · 2026-11-14
Permintaan pengguna ADR-016: Poppins untuk judul, isi, tombol, navigasi dan angka.
Gunakan berkas lokal weight 400/500/600/700, pertahankan palet olive/cream dan logo.
Periksa ulang label kategori, header HP dan tabel karena lebar huruf berubah.
