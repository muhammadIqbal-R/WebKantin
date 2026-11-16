# Panel pengelola · Revisi 03

**Status:** draft · 2026-11-12 · F-06..F-09, ADR-013.

Arah A dipilih pengguna: Source Sans 3, putih/hijau, sidebar desktop, tabel antrean
dan metrik ringkas. HP memakai tombol navigasi dan dialog dengan focus trap,
bukan logo/nav bertumpuk. Login hanya email/password; tanpa pemilih admin/tenant.
Role berasal profil staf aktif yang diverifikasi API setelah Auth. Integrasi belum
tersedia; form tidak boleh masuk dengan memilih role atau submit tanpa verifikasi.
State existing CRUD demo tetap lokal. Tidak ada klaim bahwa UI adalah kontrol RBAC.

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
