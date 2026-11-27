# F-07 · Manajemen Menu dan Media
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-27
**Terkait:** F-01, F-06, SEC-02

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres 20 November:** /menu dan `/tenant/:id` memakai Express untuk tambah/edit/nonaktif, stok angka dan foto Storage. Upload file divalidasi server; QRIS privat hanya admin. Perlu migration dan konfigurasi operator; UAT live belum dilakukan. [Panduan](../staff-management.md).

## 1. Tujuan

Memungkinkan tenant mengelola menu dan foto miliknya serta admin mengelola menu semua tenant.

## 2. User Story

Sebagai tenant, saya dapat mengubah nama, harga, foto, dan ketersediaan menu tanpa menyentuh menu penjual lain.

## 3. Alur (happy path + edge case)

Revisi onboarding: form menu berada di dalam halaman tenant yang dipilih, dengan preview foto, upload melalui Express, simpan URL aset terverifikasi, dan jumlah porsi manual. QRIS hanya admin. Katalog pelanggan membaca tenant/menu aktif dari Express. [Detail media](../staff-management.md).

Happy path: login → list scope tenant → buat/edit menu → upload foto lewat API jika ada → simpan URL asset → invalidate katalog.
Edge: upload gagal tidak menimpa foto lama; menu nonaktif tidak menerima order baru; perubahan harga tidak mengubah order_items snapshot; percobaan tenant_id asing ditolak; foto kosong menggunakan placeholder.

Revisi 27 November: saat menambah atau mengedit menu, pilih kategori bawaan
atau kategori yang sudah dipakai tenant tersebut. Pilih Tambah kategori untuk
menyimpan nama baru bersama menu. Harga dapat diketik sebagai `20000` atau
`20.000`. Form menampilkan nominal Rupiah sebelum simpan dan menolak format
yang tidak valid sebelum upload foto atau mutasi.

## 4. Kontrak API (endpoint, request, response)

Revisi implementasi 2026-11-20: ManagedMenuCreateSchema/ManagedMenuPatchSchema/ManagedMenuSchema serta StockUpdateSchema sesuai [pengelolaan operasional](../staff-management.md). Stok integer per menu, pembaruan versi optimistis, stok nol otomatis Habis. Kategori/deskripsi disimpan DB; upload media dan checkout otomatis masih lingkup lanjutan.

`GET /api/admin/menus` AdminMenuQuerySchema → MenuListResponseSchema; `GET /api/admin/menus/:id` → MenuSchema; `POST /api/admin/menus` CreateMenuRequestSchema → 201 MenuSchema; `PATCH /api/admin/menus/:id` UpdateMenuRequestSchema → 200 MenuSchema; `DELETE /api/admin/menus/:id` → 204 soft delete. IdParamsSchema pada resource path. Tenant/admin JWT wajib.
`POST /api/admin/uploads?purpose=menu_photo|tenant_qris|floor_map&owner_id=<uuid>`: UploadQuerySchema; multipart satu field file. API memvalidasi metadata turunan file dengan UploadMetadataSchema, magic bytes/decode/reencode, lalu memakai signed upload URL internal ke Storage. 201 UploadResponseSchema `{asset_url}`; tidak mengembalikan signed upload URL ke browser. menu_photo owner_id=tenant_id, tenant_qris owner_id=tenant_id, floor_map owner_id=outlet_id.
400 invalid, 401/403, 404 scope, 409 konflik, 413 >2 MiB, 415 MIME/bytes salah, 429. File stream dibatasi sebelum buffer penuh.

## 5. Skema Data (rujukan ke packages/shared)

`MenuSchema`, `CreateMenuRequestSchema`, `UpdateMenuRequestSchema`, `AdminMenuQuerySchema`, `UploadQuerySchema`, `UploadMetadataSchema`, `UploadResponseSchema`.

## 6. Aturan Bisnis

Keputusan pengguna 20 November 2026: pengisian ulang stok dilakukan manual, tanpa reset harian. Admin mengisi stok menu seluruh tenant, tenant hanya menunya sendiri. Input adalah jumlah porsi tersedia saat disimpan (menggantikan jumlah lama), bukan tambahan porsi. Stok 0 berarti Habis. Pengurangan stok saat checkout tetap pekerjaan integrasi pemesanan yang terpisah.

Harga integer Rupiah >0. Tenant_id tidak dapat dipindah lewat PATCH. Create menyertakan tenant_id tetapi API mencocokkan users scope; admin memilih tenant secara eksplisit. DELETE menonaktifkan, bukan menghapus history. Foto JPEG/PNG/WebP ≤2 MiB. QRIS dan denah hanya admin; foto menu tenant sendiri/admin. API hanya mengaitkan asset sesuai purpose/owner bucket, tidak menerima arbitrary HTTPS sebagai bukti ownership.

Kategori adalah label per menu sepanjang 1–40 karakter. Input harga
berformat dibaca di form. Kontrak API tetap menerima angka Rupiah bulat
melalui `ManagedMenuCreateSchema` dan `ManagedMenuPatchSchema`. Harga yang
sudah tersimpan perlu dikoreksi per menu setelah konfirmasi nominal.

## 7. Kriteria Terima

Menu tenant awal dapat dikelola sebelum tenant lain ada. Setelah admin menambah tenant berikutnya, menu baru mempunyai scope tenant baru dan tidak bercampur dengan menu tenant awal. CRUD menu terisolasi; foto invalid ditolak; status unavailable membuat tombol katalog disabled; perubahan terlihat setelah invalidasi tanpa refresh manual penuh; harga order lama tetap.

## 8. Catatan Keamanan

Zod strict, API filters + RLS, asset path dibuat server acak dan tenant-scoped, tidak percaya filename/MIME client, limit pixels saat decode untuk decompression bomb. Bucket grants tidak mengizinkan browser upload. Objek baru immutable; cleanup orphan oleh job API setelah retensi disetujui.

## 9. Catatan Desain (rujuk DESIGN.md)

[Admin](../design/pages/admin.md): list menu padat terbaca, availability toggle berlabel, preview file+ukuran, loading/error/retry.

## 10. Test Plan

Kontrak: harga negatif/pecahan, unknown key, patch kosong. Integrasi: CRUD menu tenant awal, penambahan menu tenant baru via admin, fixture tenant A/B IDOR, spoof tenant_id/URL, soft delete dengan order lama, cache invalidation. Upload: MIME palsu, SVG/polyglot, >2 MiB, banyak file, path traversal, image pixel bomb.

Regresi harga: `20000` dan `20.000` dikirim sebagai 20000. Tolak angka
desimal, pemisah ribuan yang salah, dan nilai di luar batas. Periksa
penambahan serta pengeditan kategori di menu tenant dan penolakan mutasi
kategori menu tenant lain.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint menu/stok/foto/QRIS tersedia lokal; upload denah dan UAT live tetap belum selesai. Status spesifikasi tetap draft.


Audit QA: CRUD lokal dan is_available lulus; hapus menu adalah soft-delete. Stok angka/reservasi stok belum diimplementasikan. [Matriks/bukti](../qa/ACCEPTANCE-2026-11-12.md).

Penegasan operator 2026-11-14: Admin Pengelola dapat menambah/edit/nonaktif menu
untuk tenant yang dipilih; akun tenant melakukan aksi yang sama hanya pada miliknya.
Pemesan tidak dapat menambah tenant/menu. API harus mengambil scope dari profil
staf aktif, bukan pilihan tenant/peran di browser. Scope UI belum otorisasi runtime.
