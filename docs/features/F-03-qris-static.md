# F-03 · Pembayaran QRIS Statis
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-12
**Terkait:** F-02, F-04, F-08, SEC-01

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Pratinjau /pesanan menampilkan tempat QRIS berlabel dan pelaporan pembayaran simulasi; tidak memakai QRIS atau pembayaran nyata. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Menampilkan QRIS tenant serta nominal yang harus dibayar dan mencatat klaim pemesan untuk diverifikasi manual.

## 2. User Story

Sebagai pemesan, saya melihat merchant dan nominal setiap order lalu melaporkan bahwa saya telah membayar.

## 3. Alur (happy path + edge case)

Happy path: tampilkan snapshot QRIS/merchant/total → pemesan membayar lewat aplikasi pembayaran → klik Saya sudah bayar → API mengubah menunggu_bayar/unpaid atau rejected menjadi menunggu_konfirmasi/pending_confirmation.
Edge: klaim ulang saat pending → respons state saat ini bila idempotent; sudah paid/terminal → 409; versi stale → 409 lalu refresh; gambar gagal → tampilkan retry dan jangan mengklaim pembayaran sukses; ditolak → alasan aman dari API dan kesempatan bayar/lapor ulang sesuai F-08.

## 4. Kontrak API (endpoint, request, response)

`GET /api/orders/:code` (F-04) menyediakan order/items; QRIS snapshot dibaca melalui `GET /api/orders/:id/payment` dengan IdParamsSchema + X-Order-Access-Token → 200 PaymentInstructionsResponseSchema `{order_id,total,qris:{image_url,merchant_name}}`.
`PATCH /api/orders/:id/paid` publik berbasis capability. IdParamsSchema + OrderAccessHeadersSchema; body ReportPaidRequestSchema `{expected_version:1}` → 200 OrderSchema dengan version baru. 400 invalid; 404 order/token mismatch; 409 state/version; 429. No-store.

## 5. Skema Data (rujukan ke packages/shared)

`PaymentInstructionsResponseSchema`, `ReportPaidRequestSchema`, `OrderAccessHeadersSchema`, `OrderSchema`, `PAYMENT_STATUSES`, `PAYMENT_METHODS`. payment_method hanya qris_static. Tidak ada field card/cash/gateway.

## 6. Aturan Bisnis

Tombol hanya melaporkan klaim, tidak dapat menjadikan paid. QRIS statis tidak memverifikasi jumlah otomatis. Satu tenant satu pembayaran order; jangan menggabungkan nominal antar merchant. QRIS snapshot immutable untuk order yang sudah tercipta. Tenant awal harus mempunyai QRIS/merchant sendiri sebelum checkout diaktifkan; penambahan tenant baru memerlukan QRIS tenant baru, bukan memakai QRIS tenant awal sebagai default.

## 7. Kriteria Terima

Nominal/merchant cocok snapshot checkout. Klik klaim menghasilkan pending_confirmation dan menunggu_konfirmasi secara atomik. Tenant/admin yang berwenang menjadi satu-satunya pihak accept/reject.

## 8. Catatan Keamanan

Token wajib cocok ID, bukan hanya order_code. Verifikasi secret secara aman, rate limit, redaction, no-store. Cegah akses asset/path merchant lain; gambar QRIS publik bukan kredensial merchant.

## 9. Catatan Desain (rujuk DESIGN.md)

[Checkout](../design/pages/checkout.md) bagian pembayaran: nominal dan merchant terbaca jelas; tombol memakai teks Saya sudah bayar; status pending dibedakan dari Lunas.

## 10. Test Plan

Integrasi: unpaid→pending, rejected→pending, token silang, stale version, klik ulang, paid tidak bisa mundur. UI: pembayaran satu tenant awal, gambar gagal, ringkasan dua tenant menggunakan fixture ekspansi, disabled/loading, pesan klaim bukan verifikasi.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.
