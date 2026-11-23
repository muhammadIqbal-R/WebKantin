# Audit ulang alur Kantin Vokasi · 23 November 2026

Audit mencakup web pelanggan, panel tenant dan admin, Express, dan kebijakan
database. Pengujian dilakukan dengan browser lokal, database PostgreSQL
embedded, dan pengganti klien Auth serta Storage.

| Alur | Hasil audit dan perbaikan | Bukti |
|---|---|---|
| Pilih tenant → buka menu → tambah/kurangi | Tautan tenant dan kontrol jumlah berfungsi. Keranjang yang belum login berada di luar komponen yang berganti saat sesi berubah. | Browser lokal dengan katalog uji. |
| Daftar/masuk/keluar | Akun pelanggan baru kembali ke checkout bila ada isi. Login tanpa isi membuka pilihan tenant. Logout membersihkan keranjang. Tab menyimpan ID menu, jumlah, dan cara pesan untuk reload. | Browser lokal menunjukkan isi dan pilihan Bawa pulang bertahan setelah daftar. Email konfirmasi dan pemulihan cart setelah reload masih perlu uji browser. |
| Checkout dan stok | Item yang hilang dapat dihapus. Qty melebihi stok diberi pesan dan CTA diblokir. Ringkasan dikelompokkan per tenant. Checkout server tetap membuat satu order per tenant dan menolak seluruh checkout bila stok kurang. | Browser untuk ringkasan satu tenant. Tes transaksi untuk checkout lintas tenant, stok, rollback, dan replay. |
| Bayar dan lacak status | Gambar QRIS gagal dapat dimuat ulang. Pemesan melihat alasan penolakan dari pesanan sendiri. Klaim berulang saat pending mengambil status terkini. Respons versi lama tidak menimpa status baru. | Tes HTTP untuk penolakan dan retry klaim. Tes SQL untuk batas kepemilikan dan transisi status. |
| Pesanan tenant/admin | Staf membaca nama merchant dari snapshot untuk mencocokkan mutasi. Gambar QRIS tidak menjadi syarat menampilkan nama. Penyegaran token untuk akun yang sama tidak mereset panel. | Tes HTTP dan RLS. Suara dan desktop notification belum diverifikasi di browser. |
| Kelola pengguna, tenant dan menu | Admin mengelola akun dan tenant, tenant hanya mengelola miliknya. Nonaktif pengguna, arsip tenant, dan hapus menu memakai perubahan status. Import 9 menu tetap menghasilkan stok awal 0 dan stok diisi manual. | Tes JWT, role, vendor import, menu, stok, aktivasi, dan audit SQL. |
| Kelola denah dan lihat lokasi | Admin dapat menambah outlet, mengganti lokasi teks, mengunggah/menghapus gambar dari denah, serta mengatur status publik. Outlet dengan tenant aktif tidak dapat disembunyikan. Pelanggan melihat lokasi aktif, daftar tenant per outlet, dan gambar yang dapat dibuka penuh. | Tes HTTP untuk alur unggah/publikasi dan tes SQL untuk scope/aktif. Bucket privat lama dipakai kembali tanpa migrasi baru. |

`pnpm check` lulus dengan 79 tes (22 kontrak, 39 SQL, 18 HTTP/service).
`pnpm build` berhasil untuk API dan kedua frontend.

Catatan: pemilik sistem perlu menyediakan gambar denah dan lokasi sebenarnya.
Rute publik meminta URL baca berumur 5 menit saat gambar dibutuhkan.
File gambar lama tersimpan di Storage setelah referensinya dilepas.
Rujukan konfigurasi bucket: [dokumentasi Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Verifikasi operasional yang masih terbuka: pemasangan kode di Vercel/Railway dan
konfigurasi Supabase, pendaftaran dengan email nyata, checkout sampai verifikasi
QRIS di lingkungan uji, tampilan denah pada ponsel, serta koneksi Realtime dan
bunyi tenant. Tidak ada perubahan pada database produksi atau deployment.
Gunakan [panduan pengaktifan](../vendor-launch.md) untuk setup infrastruktur.
