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
# Revisi pengelolaan 2026-11-20

Vendor 21 November: login menjelaskan akun dari admin/undangan, daftar tenant menyediakan import katalog vendor; antrean order nyata dengan badge, status koneksi, Aktifkan bunyi/Tes/Matikan serta notifikasi desktop opt-in. Dialog konfirmasi nominal/merchant/alasan sebelum accept/reject. Tidak meminta izin audio/notifikasi otomatis saat halaman dibuka.

Onboarding tambahan: setelah simpan tenant, buka ruang tenant yang dipilih; tampilkan nama tenant, daftar menu dengan foto/harga/stok, tombol Tambah menu, dan kelengkapan QRIS/aktivasi khusus admin. Form foto memakai preview, validasi dan pending/error. Tidak menambah pemilih peran, slogan atau kontrol demo. Palet dan font tetap.

Sebelum markup baru: ikuti state dan tata letak [pengelolaan operasional](../../staff-management.md). Satu login; navigasi dari profil API; tenant/stok/user memakai data tersimpan, tanpa demo fallback. Pertahankan Poppins dan panel cream pada latar olive. Stok angka di form menu, arsip dan nonaktif user memakai konfirmasi, serta loading/error/empty/retry.

Pada tiap halaman panel selain Ringkasan, tampilkan tombol kembali di atas
konten pada desktop dan HP. Halaman utama modul kembali ke Ringkasan. Dari
detail tenant, admin kembali ke daftar tenant dan akun tenant ke Menu & stok.
Tujuan mengikuti struktur panel dan tetap jelas saat tautan dibuka langsung.

Detail pesanan menampilkan nomor meja dan catatan untuk tenant di dekat jenis
pesanan, sebelum daftar item. Bagian muncul saat ada keterangan.

Form Tambah menu dan Edit menu memakai input harga dengan papan ketik angka.
Di bawah harga, tampilkan contoh saat kosong dan nominal Rupiah saat format
valid. Pilihan kategori berisi kategori bawaan serta kategori dari menu tenant
yang dipilih. Opsi Tambah kategori menampilkan input nama. Form dan dialog
menggunakan kontrol, jarak, dan state kesalahan yang sudah ada.
