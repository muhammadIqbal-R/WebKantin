# F-08 · Konfirmasi Pembayaran dan Status Order
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-12
**Terkait:** F-03, F-04, F-09, SEC-02

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Pratinjau /pesanan admin mendukung accept/reject contoh, validasi alasan dan perubahan status lokal; belum ada audit/transaksi server. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Mencatat keputusan pembayaran manual serta status pengerjaan dengan audit dan transaksi konsisten.

## 2. User Story

Sebagai tenant, saya melihat klaim pembayaran order sendiri, mencocokkan mutasi, lalu menerima/menolak dan memperbarui pengerjaan.

## 3. Alur (happy path + edge case)

Happy path: filter pending → cek merchant/nominal/mutasi eksternal → accept → order diproses/paid dan audit terisi → siap → selesai.
Reject: pending → menunggu_bayar/rejected, reason wajib; pemesan dapat lapor ulang. Batal hanya sebelum paid; pending yang dibatalkan menjadi dibatalkan/rejected dengan event alasan.

Audit 23 November: detail pesanan staf memuat nama merchant dari snapshot
pembayaran. Pemeriksaan mutasi masih bisa dilakukan saat gambar QRIS sementara
gagal dimuat. Panel memberi tahu staf bahwa alasan penolakan terlihat oleh pemesan.
Edge: dua operator klik bersamaan → satu commit, lainnya 409; pembayaran belum pending → 409; tenant lain → 404; terminal tidak dapat diubah; tidak ada paid→batal/refund di V1.

## 4. Kontrak API (endpoint, request, response)

Revisi 21 November: [vendor launch](../vendor-launch.md) menghubungkan konfirmasi/status dan notifikasi dengan order persisten; bukti bayar tetap diperiksa manual, audio hanya setelah opt-in.

`GET /api/admin/orders` AdminOrderQuerySchema (tenant_id/status/payment_status/cursor/limit) → 200 AdminOrderListResponseSchema; `GET /api/admin/orders/:id` IdParamsSchema → OrderDetailResponseSchema.
`PATCH /api/admin/orders/:id/confirm-payment` ConfirmPaymentRequestSchema `{expected_version:2,decision:"accept"}` atau `{expected_version:2,decision:"reject",reason:"Mutasi belum ditemukan"}` → 200 OrderSchema.
`PATCH /api/admin/orders/:id/status` UpdateOrderStatusRequestSchema `{expected_version:3,status:"siap"}`; status yang dapat diminta siap/selesai/dibatalkan → 200 OrderSchema. Semua admin path wajib tenant/admin JWT. 400 invalid, 401, 403 filter tenant lain, 404 resource scope, 409 state/version, 429.

## 5. Skema Data (rujukan ke packages/shared)

`ConfirmPaymentRequestSchema`, `UpdateOrderStatusRequestSchema`, `OrderSchema`, `ORDER_TRANSITIONS`, `AdminOrderQuerySchema`, `AdminOrderListResponseSchema`. Request tidak dapat menyetel payment_confirmed_by/at.

## 6. Aturan Bisnis

Accept hanya menunggu_konfirmasi/pending_confirmation; catat payment_confirmed_by dari actor JWT/users dan payment_confirmed_at dari server, updated_at, version+1 dalam transaksi sama. Reject wajib reason, audit event actor/waktu/reason; field confirmed untuk penerimaan bukan bukti penolakan. Audit semua perubahan status append-only. diproses→siap→selesai; menunggu_bayar/pending boleh batal, tidak paid. Listing tenant dipaksa scope server.

## 7. Kriteria Terima

Antrean tenant awal hanya memuat order miliknya. Setelah tenant baru ditambahkan, akun masing-masing tetap melihat antrean sendiri, sedangkan admin dapat meninjau semua tenant dengan scope yang jelas. Accept langsung menghasilkan diproses+paid, audit lengkap dan event realtime. Reject tidak ditampilkan Lunas. Transisi ilegal/stale tidak menulis data atau event. Tenant tidak dapat mengakses order tetangga.

## 8. Catatan Keamanan

API RBAC + RLS; compare-and-set version dalam transaksi. Audit dan status tidak boleh commit terpisah. Pino tanpa secret/PII. Accept/reject memerlukan konfirmasi UI agar operator meninjau merchant/nominal; UI bukan kontrol keamanan.

## 9. Catatan Desain (rujuk DESIGN.md)

[Admin](../design/pages/admin.md): antrean berdasarkan waktu, status bayar terpisah dari masak, dialog accept/reject menampilkan order/tenant/nominal; alasan penolakan wajib.

## 10. Test Plan

Integrasi: antrean satu tenant awal dan isolasi antrean setelah tenant kedua ditambahkan; accept/reject, audit actor/timestamp, 401/404, state/version conflict, dua request parallel, rollback audit gagal. UI: filter pending, confirm dialog, reason validation, no duplicate submit. E2E: accept→tracker berubah <5 detik.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.


Audit QA: Accept/reject/alasan/ready/complete lulus pada fixture UI; transaksi nyata dan sinkronisasi status ke pemesan belum tersedia. [Matriks/bukti](../qa/ACCEPTANCE-2026-11-12.md).
