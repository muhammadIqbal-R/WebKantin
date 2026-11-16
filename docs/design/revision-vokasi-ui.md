# Revisi visual Kantin Vokasi UI · 2026-11-12

**Status:** draft · diminta pengguna setelah menilai pratinjau terlalu generik.
Pengguna menunjuk HAKA Dimsum sebagai referensi suasana menu, serta identitas Vokasi UI.
Website hakadimsum.com gagal dibuka (TLS); belum ada klaim telah mengaudit layoutnya.
Screenshot kemudian diberikan pengguna: kategori foto, list menu ringkas, dialog foto dan keranjang bawah menjadi acuan utama.

## Keputusan sebelum markup

Identitas layanan: Kantin Vokasi UI, dengan logo asli dari situs Vokasi UI, bukan
ikon alat makan pengganti. Gunakan logo asli berlatar putih utuh pada surface putih tanpa recolor,
distorsi, atau crop. Nama layanan menjadi teks terpisah, bukan modifikasi wordmark.
Sumber [Vokasi UI](https://vokasi.ui.ac.id/web/) dan
[panduan Humas](https://vokasi.ui.ac.id/web/layanan-humas-vokasi-ui/).

Palet aplikasi: putih gading netral, tinta biru gelap, kuning UI untuk kategori/CTA
dengan teks gelap. Biru untuk link/focus; hijau/merah hanya status bermakna.
Nilai digital palet aplikasi adalah interpretasi untuk UI, bukan klaim kode brand resmi.
Font Arial/Helvetica untuk body dan judul menu; font
tidak diklaim sebagai font resmi Vokasi. Foto makanan tetap contoh yang sudah ada.

Katalog menyerupai lembar menu: judul “Pilih & pesan menu”, kategori foto 2×2 pada HP,
daftar menu horizontal ringkas, foto landscape tanpa chip dekoratif, harga jelas, tombol
tambah berlabel. Satu identitas tenant ringkas; hapus slogan dan estimasi rekaan.
Keranjang desktop menyerupai bon, pada HP ringkasan bawah menuju checkout.
Admin: antrean butuh tindakan lebih dahulu, metrik datar dipisahkan garis, daftar
pesanan + menu tersedia. Hapus grafik penjualan ilustrasi yang tidak membantu aksi.
Navigasi admin gelap dengan logo resmi; nav HP dapat digulir pada area sendiri.

Breakpoint CSS: 1200, 1024, 768, 480px ditambah compact 360px bila diperlukan.
HP: satu kolom konten, menu dua kolom atau baris bila ruang sempit, navigasi
tidak bertumpuk logo; body tidak horizontal overflow. Tabel boleh scroll dalam
region berlabel; tombol/field minimal 44px. Font input 16px untuk iOS.
Reduced motion, focus visible, target sentuh dan dialog keyboard dipertahankan.
Tes browser wajib 390px dan 360px, tablet 768px dan desktop 1440px untuk kedua app.

## Batas implementasi

Data tetap demo lokal. Revisi visual tidak mengaktifkan Auth/pembayaran/Realtimenya.
Schema kontrak dan arsitektur Express-only tidak diubah.
Hasil aktual dicatat setelah verifikasi browser, bukan disimpulkan dari jumlah media query.

Revisi akun pelanggan: form masuk/daftar sebelum checkout, sesuai [akun pelanggan](../customer-accounts.md).
