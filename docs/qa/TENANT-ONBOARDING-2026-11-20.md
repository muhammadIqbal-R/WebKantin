# Validasi onboarding tenant · 20 November 2026

**Status:** kode lokal, belum deploy/UAT Supabase live. Melanjutkan [tahap pengelolaan](MANAGEMENT-2026-11-20.md).

Perluasan checkout/notifikasi/tenant-first berikutnya dicatat di [validasi vendor 21 November](VENDOR-2026-11-21.md); batas checkout simulasi di laporan historis ini tidak menggambarkan kode terbaru.

## Perubahan

Admin membuat tenant draft lalu diarahkan ke `/tenant/:id`. Halaman tersebut
menampung menu milik tenant itu, foto, harga, kategori, deskripsi, stok porsi,
QRIS/merchant dan aktivasi. Admin juga dapat kembali lewat Kelola tenant pada
daftar. Tenant login hanya dapat mengelola menu/foto/stok miliknya; QRIS/aktivasi
khusus admin. Stok diisi ulang manual, tanpa reset harian.

Foto/QRIS dikirim sebagai satu file multipart ke Express. Server memvalidasi
ukuran, tipe, signature, decode dan batas pixel sebelum re-encode WebP lossless.
QRIS tidak di-resize. Signed upload dipakai hanya API, path immutable dalam
prefix tenant; URL yang disimpan harus milik project/bucket/tenant yang sesuai
dan ada di Storage. Foto menu publik, QRIS privat dengan signed preview DTO.
Tidak menambah schema/table: memakai kolom/bucket baseline dan upgrade stok.

Katalog pelanggan kini mengambil tenant dan menu aktif melalui endpoint publik
Express dengan pagination, tanpa fixture produksi. Harga/deskripsi/foto/stok
berasal dari API. Halaman Auth tetap dapat dibuka bila katalog gagal; error/retry
katalog tidak menghilangkan navigasi. Harness Auth terisolasi mempertahankan
fixture dengan banner QA. Checkout/QRIS pembayaran pelanggan masih simulasi;
belum ada pengurangan stok otomatis, ownership order atau status realtime nyata.

## Verifikasi

- 20 tes kontrak shared, 29 tes SQL PGlite dan 10 tes HTTP/JWT/media/onboarding.
- `pnpm check` lulus: dokumentasi/link lokal, guard desain, bundle SQL, Prisma validate, lint/typecheck, dan 14 task Turbo sukses. Sebagian tugas yang tidak berubah menggunakan cache; tes HTTP/media/onboarding sebelumnya dijalankan langsung.
- `pnpm build` lulus untuk API dan kedua frontend; route `/tenant/[id]` berhasil dibuat sebagai partial prerender. Shell pengelola memakai Suspense di sekitar pembacaan pathname agar route dinamis kompatibel dengan Cache Components.
- Tes HTTP onboarding menjalankan Express dengan DB/Storage doubles: draft
  belum publik, aktivasi tanpa setup ditolak, upload foto, simpan menu/stok,
  pemalsuan prefix URL ditolak, simpan QRIS, aktivasi dan baca katalog publik.
- Tes media menggunakan byte gambar sungguhan dan sharp: MIME palsu, SVG,
  dimensi besar, file >2 MiB, nama field salah dan file berlebih ditolak.
- Tes tidak mengirim gambar/email ke Supabase live atau membuat transaksi nyata.
- Generate Prisma dipisahkan sebagai dependency task Turbo agar test/typecheck
  tidak saling mengubah file generator bersamaan.
- Pemeriksaan browser live/visual tidak dilakukan pada tahap ini: izin origin
  pada percobaan sebelumnya ditolak, dan tidak dicoba lewat jalur lain.

## Aktivasi oleh operator dan sisa pekerjaan

Ikuti [panduan](../staff-management.md). Pastikan API berjalan dengan role
kantin_api, akun admin dipetakan, upgrade stok terpasang, bucket baseline ada,
dan secret Storage hanya di API. Isi NEXT_PUBLIC_API_URL serta URL/key Supabase
pada kedua frontend lalu deploy API dan redeploy kedua frontend. Source lokal
tidak memperbarui deployment Vercel secara otomatis sebelum push/deploy.

UAT wajib: email undangan/password, login admin/dua tenant, upload foto dan QRIS
nyata, merchant terbaca, tenant aktif muncul setelah refresh katalog, stok 0
tidak dapat ditambah, arsip hilang dari katalog, dan isolasi lintas tenant.
Retensi/cleanup orphan upload tetap terbuka; tidak menghapus aset yang mungkin
menjadi snapshot order. Denah, checkout/stock reservation, konfirmasi pembayaran
nyata dan Realtime masih pekerjaan terpisah.
