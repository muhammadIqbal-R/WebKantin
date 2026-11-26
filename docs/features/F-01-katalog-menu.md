# F-01 · Katalog Tenant dan Menu
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-25
**Terkait:** F-02, F-05, F-07, DESIGN-01, SEC-02

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Pratinjau katalog, pencarian, kategori, urutan harga, ketersediaan dan keranjang pada web-user tersedia; belum membaca API. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Menampilkan tenant dan menu aktif agar pemesan dapat memilih makanan tanpa login.

## 2. User Story

Sebagai pemesan, saya dapat memilih tenant, melihat foto/harga/menu tersedia, dan menambahkan item ke keranjang.

## 3. Alur (happy path + edge case)

Vendor 21 November: beranda memilih tenant dahulu; menu ada di `/tenant/:id`, tanpa auto memilih tenant pertama. Harga/menu awal sesuai [vendor launch](../vendor-launch.md).

Revisi 25 November: katalog dan checkout yang terlihat memeriksa stok kira-kira
setiap 15 detik dan saat tab kembali aktif. Refresh ringan hanya membawa data
stok dari menu aktif. Label Habis dan tombol tambah mengikuti stok terbaru.
Jika gagal, pertahankan tampilan dan keranjang serta tawarkan muat ulang.

Revisi onboarding 20 November: katalog pelanggan membaca tenant/menu aktif melalui Express, termasuk foto, kategori, deskripsi dan stok. Request gagal menampilkan error/retry tanpa fixture produksi. Tenant draft/arsip tidak tampil. Checkout masih simulasi terpisah sampai integrasi pemesanan disetujui/selesai.

Happy path awal: buka katalog kantin fakultas → muat tenant aktif dari API → pilih otomatis satu tenant yang tersedia → tampilkan menu → tambah item. Tidak ada langkah memilih fakultas/outlet pada rilis awal.
Setelah admin menambah tenant aktif: daftar/tab tenant muncul dari data API → pemesan memilih tenant → menu berganti tanpa full reload. Jika hanya satu tenant, pemilih tenant disembunyikan; nama tenant tetap terlihat.
Edge: belum ada tenant/menu → empty state; menu tidak tersedia tetap tampil disabled; tenant nonaktif tidak ditampilkan; request tab lama tidak boleh menimpa tab baru; foto gagal memakai placeholder berlabel.

## 4. Kontrak API (endpoint, request, response)

`GET /api/tenants?outlet_id=<uuid>&limit=20&cursor=<uuid>` publik. Query TenantListQuerySchema → 200 TenantListResponseSchema.
`GET /api/tenants/:tenant_id/menus?limit=20&cursor=<uuid>` publik. Params TenantParamsSchema + query PaginationQuerySchema → 200 MenuListResponseSchema.
`GET /api/catalog/stock?limit=100&cursor=<uuid>` menggunakan PaginationQuerySchema
dan mengembalikan CatalogStockResponseSchema (ID, stok, dan ketersediaan).
400 input salah; 404 tenant tidak aktif/tidak ada; 429 rate limit; 500 error aman. Format error mengikuti [konvensi API](../api-conventions.md).

## 5. Skema Data (rujukan ke packages/shared)

`TenantSchema`, `MenuSchema`, `TenantListQuerySchema`, `TenantParamsSchema`, `PaginationQuerySchema`, dan list response dari [shared](../../packages/shared/src/index.ts). DTO berbeda dari row Prisma; tidak ada users/email dalam respons.

## 6. Aturan Bisnis

Tidak ada ID/nama tenant atau daftar tenant statis dalam frontend. Satu tenant adalah jumlah awal, bukan batas jumlah tenant aplikasi. Hanya is_active=true untuk katalog; is_available=false tidak bisa ditambahkan. Harga Rupiah tanpa desimal. Foto dari URL Storage tervalidasi. Mutasi admin meng-invalidasi tag/cache katalog; client refresh saat focus atau setelah API revalidate. Mekanisme cache dikunci saat M2, tidak direct Supabase table read.

## 7. Kriteria Terima

Katalog dapat dipakai dengan satu tenant tanpa pemilih yang tidak diperlukan. Tenant kedua yang ditambahkan dan diaktifkan melalui admin muncul setelah invalidasi/refetch, tanpa deploy; tab berganti tanpa full reload; respons stale dibuang; tombol disabled pada stok tidak tersedia; foto lazy-load; empty/error/retry berfungsi; data tidak mencampur tenant.

## 8. Catatan Keamanan

Endpoint publik dibatasi awal 60 req/menit/IP (ditinjau saat load test). Query/params strict Zod, API projection field eksplisit. Tidak ada token DB pada web-user.

## 9. Catatan Desain (rujuk DESIGN.md)

[DESIGN-01](../design/DESIGN.md) dan [landing](../design/pages/landing.md). Harga dan nama menu lebih dominan daripada dekorasi; tab dapat diakses keyboard.

## 10. Test Plan

Kontrak: UUID/query invalid → 400. Integrasi: nol/satu/beberapa tenant, tenant aktif/nonaktif, tenant baru dari admin, isolasi tenant, pagination stabil. UI: pindah tab cepat, lazy image, empty/error/disabled; tes akses keyboard.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.
