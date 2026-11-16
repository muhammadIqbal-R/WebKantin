# F-05 · Denah Kantin dan Outlet
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-12
**Terkait:** F-01, F-06, DESIGN-01, SEC-02

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Denah ilustrasi tersedia pada /lokasi (user) dan /denah (admin); gambar lokal dapat dipreview admin, belum tersimpan di Storage. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Menampilkan lokasi tenant melalui denah statis yang dapat diperbarui admin tanpa deploy.

## 2. User Story

Sebagai pemesan, saya dapat melihat outlet dan denah agar menemukan tenant; sebagai admin saya dapat mengganti gambar denah.

## 3. Alur (happy path + edge case)

Happy path: buka denah kantin fakultas yang digunakan → API mengembalikan nama/lokasi/gambar outlet tunggal → tampilkan gambar responsif dan lokasi tekstual. Pemesan tidak perlu memilih fakultas/kantin lain.
Admin unggah lewat endpoint media API → ganti floor_map_url → invalidasi cache.
Edge: denah belum ada → lokasi teks+empty state; gambar gagal → retry; outlet nonaktif tidak tersedia publik; outlet berisi tenant aktif tidak boleh dinonaktifkan tanpa memindahkan/menonaktifkan tenant terlebih dahulu.

## 4. Kontrak API (endpoint, request, response)

`GET /api/outlets` query PaginationQuerySchema → 200 OutletListResponseSchema; `GET /api/outlets/:id` IdParamsSchema → 200 OutletSchema; keduanya publik.
Admin: `GET /api/admin/outlets` (PaginationQuerySchema → OutletListResponseSchema); `GET /api/admin/outlets/:id` → OutletSchema; `POST /api/admin/outlets` CreateOutletRequestSchema → 201 OutletSchema; `PATCH /api/admin/outlets/:id` UpdateOutletRequestSchema → 200 OutletSchema; `DELETE /api/admin/outlets/:id` → 204 (soft delete, tanpa body).
Upload `POST /api/admin/uploads?purpose=floor_map&owner_id=<outlet-id>` sesuai F-07. Admin JWT wajib untuk semua admin path. 400/401/403/404/409/413/415/429 sesuai [konvensi](../api-conventions.md).

## 5. Skema Data (rujukan ke packages/shared)

`OutletSchema`, `CreateOutletRequestSchema`, `UpdateOutletRequestSchema`, `UploadQuerySchema`, `UploadMetadataSchema`, `UploadResponseSchema`.

## 6. Aturan Bisnis

Rilis awal memakai satu denah outlet kantin fakultas, dimulai dari lokasi satu tenant. Tenant baru nantinya berada pada kantin yang sama dan dapat dicantumkan pada pembaruan denah oleh admin. Denah gambar statis, tanpa editor peta/interaktif. Marker tenant opsional; tidak dimasukkan kontrak V1 awal. Update memakai URL objek baru; hanya bucket/path yang diotorisasi diterima. Tidak ada geolokasi pemesan.

## 7. Kriteria Terima

Admin dapat mengganti denah tanpa build/deploy; web-user menerima versi terbaru setelah invalidasi; teks lokasi tetap tersedia jika gambar tidak ada; tenant biasa tidak dapat mengubah outlet.

## 8. Catatan Keamanan

Admin-only mutasi/unggah. Outlet tabel global tetap RLS. Gambar whitelist, 2 MiB batas awal konsisten kontrak (dapat direview khusus denah), magic bytes; tidak menerima SVG. URL bukan arbitrary remote fetch.

## 9. Catatan Desain (rujuk DESIGN.md)

[Denah](../design/pages/denah.md) dan [DESIGN](../design/DESIGN.md). Gambar dapat diperbesar dengan keyboard, alt menjelaskan lokasi; teks bukan hanya informasi yang tertanam gambar.

## 10. Test Plan

Integrasi: admin update dan cache invalidate, tenant 403, delete outlet berisi tenant 409. UI: satu outlet tanpa selector, lokasi tenant awal dan tenant baru, null image, broken image, mobile zoom, alt text dan lokasi; upload oversize/wrong type.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.
