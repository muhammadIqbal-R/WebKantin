# F-06 · Manajemen Tenant dan Akun Tenant
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-26
**Terkait:** F-05, F-07, F-09, SEC-02

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres 20 November:** /tenant memakai Express untuk tambah/edit, undang akun dan arsip/pulihkan. Setelah tambah, admin masuk `/tenant/:id` untuk menu/foto/stok/QRIS/aktivasi; katalog pelanggan membaca API. Perlu migration dan konfigurasi operator; UAT live belum dilakukan. [Panduan](../staff-management.md).

## 1. Tujuan

Memberi Admin Pengelola kendali atas tenant, penempatan outlet, QRIS, dan akun tenant.

## 2. User Story

Sebagai admin, saya dapat menambah tenant dan merchant QRIS serta menetapkan akun dengan scope tenant yang benar.

## 3. Alur (happy path + edge case)

Revisi onboarding: setelah tambah tenant, langsung buka halaman `/tenant/:id` untuk menu di tenant tersebut (foto, harga, kategori, deskripsi, stok) dan QRIS/merchant. Draft tetap tersimpan bila setup belum selesai; aktivasi hanya setelah QRIS dan menu siap. [Detail](../staff-management.md).

Admin login → pilih Daftarkan tenant di sidebar → isi nama, deskripsi, lokasi, email akun, dan password awal → lanjut ke detail untuk mengisi foto QRIS, merchant, dan menu (nama, harga, deskripsi, foto, dan stok) → aktifkan tenant. Jika pembuatan akun gagal, draft tetap tersedia dan langkah akun dapat dicoba kembali.
Edge: tenant tanpa QRIS boleh disimpan sebagai persiapan namun checkout ditolak; email sudah terdaftar → 409/review akun; provisioning Auth gagal → retry/kompensasi tanpa akun scope setengah jadi; hapus tenant = nonaktifkan, sejarah order tetap ada; pindah outlet tidak mengubah history order.

## 4. Kontrak API (endpoint, request, response)

Revisi implementasi 2026-11-20: [pengelolaan operasional](../staff-management.md).
Tambah tenant melalui API menjadi draft; `archived` pada PATCH mengarsipkan atau memulihkan tanpa menghapus history. GET tenant diizinkan untuk tenant dengan hasil scope sendiri; mutasi tenant hanya admin. Undangan akun adalah aksi terpisah yang eksplisit.

Admin Pengelola JWT: `GET /api/admin/tenants` TenantListQuerySchema → TenantListResponseSchema; `GET /api/admin/tenants/:id` → TenantSchema; `POST /api/admin/tenants` CreateTenantRequestSchema → 201 TenantSchema; `PATCH /api/admin/tenants/:id` UpdateTenantRequestSchema → 200 TenantSchema; `DELETE /api/admin/tenants/:id` → 204 soft delete. IdParamsSchema pada resource path.
`POST /api/admin/tenant-accounts` menerima `{tenant_id,email,password}` melalui CreateTenantAccountRequestSchema → 201 MeResponseSchema. Express membuat akun Supabase Auth dan profil tenant. Akun yang sudah ada tidak diubah passwordnya. Kontrak undangan lama tetap menerima payload tanpa password.
QRIS melalui `POST /api/admin/uploads?purpose=tenant_qris&owner_id=<tenant-id>` sesuai F-07. Error 400/401/403/404/409/413/415/429.

## 5. Skema Data (rujukan ke packages/shared)

`TenantSchema`, `CreateTenantRequestSchema`, `UpdateTenantRequestSchema`, `CreateTenantAccountRequestSchema`, `UserSchema`, `MeResponseSchema`; relasi tenant-outlet pada [DATA-01](../data-model.md).

## 6. Aturan Bisnis

Jumlah tenant awal satu; tidak ada batas satu tenant pada kontrak atau database. Tenant tambahan dibuat melalui web-admin/API tanpa seed ulang, migrasi khusus tenant, perubahan kode, atau deploy. Hanya admin mengubah tenant/QRIS/akun. Tenant punya tepat satu outlet pada draft V1. QRIS image+merchant wajib sebelum menerima order. Nonaktif tenant menutup katalog/checkout baru tetapi order berjalan tetap dapat diselesaikan. Akun tenant harus users.role=tenant dan tenant_id bukan null. Tidak mengirim password/invite token dalam DTO.

## 7. Kriteria Terima

Dari kondisi satu tenant awal, admin dapat menambah tenant kedua beserta QRIS, akun, dan menu lewat web-admin tanpa deploy. Tenant kedua yang siap jual muncul pada katalog setelah invalidasi/refetch; order tenant pertama tetap utuh; tenant tidak mengakses CRUD tenant/account; nonaktif tidak menghilangkan order; audit mencatat pengubahan QRIS/scope akun.

## 8. Catatan Keamanan

API secret untuk Storage/Auth server-only. Scoped asset URL, signed URL hanya dipakai API internal. Akun tidak boleh memilih role sendiri; jangan percaya user_metadata. Email hanya di admin response terotorisasi.

## 9. Catatan Desain (rujuk DESIGN.md)

[Admin](../design/pages/admin.md): tabel tenant dengan kolom outlet, kelengkapan QRIS dan status aktif; form/error per field; dialog konfirmasi untuk nonaktif.

## 10. Test Plan

Integrasi: inisialisasi satu tenant lalu admin menambah tenant kedua pada outlet sama tanpa deploy; admin create/edit/nonaktif, tenant 403, outlet asing/invalid, QRIS ownership, Auth invite gagal/retry, duplicate email. DB: role/scope constraint. UI: form validation, status QRIS, file state, nonaktif confirmation.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Implementasi endpoint pengelolaan tersedia lokal; status spesifikasi tetap draft dan UAT live belum dilakukan.


Audit QA historis 12 November: Tenant baru bisa dibuat sebagai draft; hapus/arsip draft dan kelengkapan QRIS belum tersedia. Toggle tenant awal mengizinkan aktivasi meski gambar QRIS kosong (T-05). [Matriks/bukti](../qa/ACCEPTANCE-2026-11-12.md). Revisi 20 November menambah arsip dan menolak aktivasi bila QRIS belum lengkap; instalasi/UAT live masih diperlukan.

Penegasan operator 2026-11-14: pemakai akhir pengelola kantin memperoleh akun
Admin Pengelola. Ia dapat menambah tenant dan akun tenant melalui web-admin,
lalu memasukkan menu tenant melalui F-07, tanpa bantuan developer/deploy ulang.
Revisi 20 November menyediakan kode API penyimpanan dan undangan; agen tidak membuat akun atau memutasi database live saat pengujian.
