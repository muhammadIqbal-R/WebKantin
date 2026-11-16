# Revisi desain 03 · pilihan arah visual

**Status:** draft · 2026-11-12. Pengguna meminta revisi kedua frontend karena desain
sebelumnya tetap terasa generik. Preview ini bukan persetujuan produk atau fitur baru.

## Temuan dan tujuan

Source memakai Arial/Helvetica dan beberapa lapisan override desain lama.
Dokumen DESIGN/tokens awal masih memuat Geist/merah bata, sedangkan implementasi
sudah memakai biru/kuning. Sebelum perubahan produksi berikutnya, satukan kembali
spesifikasi dan token ke satu arah yang dipilih pengguna.

Referensi screenshot HAKA sudah diberikan: hierarki menu, foto makanan, daftar
ringkas dan keranjang yang mudah dijangkau. Logo Vokasi UI resmi sudah tersedia.
Tidak perlu meminta pengguna mengirim ulang logo atau secret Supabase.

## Dua arah yang dibuat untuk review

A — Menu praktis: Source Sans 3, surface putih, hijau Vokasi untuk tindakan, kuning
UI untuk identitas kecil. Menu berupa baris foto/nama/harga; navigasi sederhana.
Admin memakai antrean berbentuk tabel dan angka ringkas, tanpa kartu statistik besar.

B — Buku menu kedai: Lora pada judul + Source Sans 3 body, warna kertas, aksen
oranye Vokasi. Foto landscape dan nomor menu memberi ritme; admin memakai heading
lebih editorial tetapi isi tetap daftar/tabel transaksi.

Keduanya mempertahankan logo utuh, tidak mengklaim font/palet aplikasi sebagai
standar resmi brand. Demo interaktif memisahkan Pelanggan/Admin/Tenant, A/B dan
HP/Desktop; tidak terhubung Auth, database atau pembayaran.

## Masukan pengguna yang paling membantu

1. Pilih A/B atau sebutkan bagian mana yang ingin digabung.
2. 1–2 contoh tambahan/screenshot yang disukai beserta alasan spesifik.
3. Foto menu asli, nama tenant, nama menu/harga dan kategori.
4. Panduan font/warna resmi jika memang ada; logo asli sudah tersedia.
5. Untuk pekerjaan backend berikutnya: email uji aktif dan detail koneksi dari
   Supabase Connect disimpan lokal, bukan password/secret dalam chat.
6. Putuskan model stok (jumlah atau tersedia/habis), serta hak intervensi admin.

## Urutan kerja sesudah arah visual dipilih

Satukan design tokens dan dokumen → implementasikan dua frontend dengan state
existing → cek HP/desktop → lanjut koneksi DB, customer ownership dan Express API.
Temuan audit 72 skenario tetap terbuka; preview ini tidak mengubah status audit.

Font proposal diperoleh dari repositori resmi Google Fonts:
[Source Sans 3](https://github.com/google/fonts/tree/main/ofl/sourcesans3),
[Lora](https://github.com/google/fonts/tree/main/ofl/lora). Lisensi OFL disertakan.

## Keputusan pengguna
Katalog B (Lora + Source Sans 3, kertas/oranye) dan panel A (Source Sans 3,
putih/hijau). Kontrol review A/B, pelanggan/admin/tenant, HP/desktop dan seluruh
kalimat proses desain dihapus dari entry yang dilihat pengguna. Login tidak
memiliki pilihan role. Implementasi ini belum menyelesaikan integrasi Auth staf.

## Palet aktif · 2026-11-14
Olive #93913D dan cream #F4E7D3 menggantikan aksen oranye/hijau terdahulu.
Kedua frontend memakai token bersama. Tombol olive memakai teks gelap; link,
focus dan teks aksen memakai olive gelap, bukan olive muda sebagai teks kecil.
Susunan halaman, font dan logo kiriman pengguna dipertahankan. ADR-014.
