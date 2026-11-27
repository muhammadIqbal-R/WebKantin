# Rilis portal tenant

Portal pelanggan dan admin memakai domain Vercel yang sudah ada. Buat satu
proyek Vercel untuk `apps/web-tenant` dengan repo yang sama. Ketiga frontend
memakai proyek Supabase dan API Railway yang sama.

## Sebelum push atau deploy otomatis

1. Pilih proyek Supabase yang akan dipakai oleh semua layanan. Jika pindah
   proyek dan data lama dibutuhkan, pindahkan data, pengguna Auth, dan objek
   Storage sebelum mengganti koneksi produksi.
2. Di proyek tujuan, jalankan
   [tenant-payment-proofs-upgrade.sql](../infra/supabase/tenant-payment-proofs-upgrade.sql)
   melalui SQL Editor setelah order fulfillment. Instalasi dari nol mengikuti
   urutan setup, management, orders, chat, order operations, order fulfillment,
   lalu tenant payment proofs. Skrip upgrade tidak menghapus pesanan lama.
3. Siapkan rilis Railway dan web berdekatan waktunya. Segera setelah upgrade
   SQL, pembayaran baru memerlukan aplikasi pelanggan dan API versi ini.
   Klaim yang sudah ada tetap bisa ditinjau oleh tenant.
4. Jika mengganti Supabase, perbarui `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan
   `DATABASE_URL` (role `kantin_api`) di Railway. Pertahankan
   `IDEMPOTENCY_ENCRYPTION_KEY` jika membawa riwayat checkout lama. Perbarui
   URL Supabase dan publishable key di kedua proyek Vercel yang sudah ada.

## Proyek Vercel tenant

Pilih **Add New → Project**, impor repo, dan isi **Root Directory**
`apps/web-tenant`. Pilih Next.js dan aktifkan akses source di luar Root
Directory agar paket workspace tersedia. Gunakan build command
`pnpm exec turbo run build --filter=@kantin/web-tenant`.

Pasang environment **Production** berikut di proyek tenant.

| Nama | Isi |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL publik API Railway |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase yang sama dengan web pelanggan |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key proyek Supabase itu |
| `NEXT_PUBLIC_USER_URL` | Domain web pelanggan |

Setelah domain tenant muncul, isi `WEB_TENANT_ORIGIN` di Railway dengan origin
HTTPS tenant tanpa garis miring di akhir, lalu deploy ulang API. Isi
`NEXT_PUBLIC_TENANT_URL` di Vercel admin dengan URL tenant dan deploy ulang
admin. Tambahkan URL `/login` dan `/lupa-password` pada domain tenant di
**Supabase → Authentication → URL Configuration → Redirect URLs**.

## Uji setelah rilis

1. Admin membuka **Daftarkan tenant**, membuat akun dengan password awal, lalu
   mengunggah QRIS dan menambah menu dengan harga, deskripsi, foto, dan stok.
2. Tenant masuk lewat domain baru dan melihat kode pesanan. Akun tenant lain
   hanya melihat antrean miliknya.
3. Pelanggan memesan, membuka QRIS, dan mengirim gambar bukti pembayaran.
   Tenant membuka gambar, mencocokkan mutasi, menerima pembayaran, lalu
   menandai siap dan selesai. Pelanggan melihat perubahan status.
4. Admin dapat membuka detail untuk pemantauan. API menolak percobaan admin
   untuk membuka bukti atau mengubah status pembayaran dan pesanan.

## Rilis harga dan kategori menu

1. Jalankan [menu-categories-upgrade.sql](../infra/supabase/menu-categories-upgrade.sql)
   di SQL Editor Supabase setelah upgrade management. Migrasi ini memperluas
   nama kategori tanpa menulis ulang nominal harga yang sudah tersimpan.
2. Deploy ulang Express di Railway dan ketiga frontend. Tunggu semuanya siap
   sebelum menyimpan kategori baru, lalu muat ulang tab yang sudah terbuka.
3. Di Menu & stok, edit harga yang sebelumnya tersimpan pendek sesuai daftar
   harga tenant. Coba masukkan `20.000` dan pastikan nominal tampil Rp 20.000
   sebelum simpan. Tambah kategori pada satu menu, lalu cek filter di katalog
   publik untuk tenant tersebut.

Panduan resmi [Vercel monorepo](https://vercel.com/docs/monorepos)
dan [pengaturan variabel Railway](https://docs.railway.com/variables).
