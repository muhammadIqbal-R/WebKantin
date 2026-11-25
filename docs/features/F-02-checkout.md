# F-02 · Keranjang dan Checkout
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-12
**Terkait:** F-01, F-03, F-04, SEC-01

**Revisi terbaru:** akun pelanggan minimal wajib untuk checkout; [rincian](../customer-accounts.md)
mengatasi ketentuan tanpa login di draft sebelumnya. Baseline DB tidak di-reset.

Audit 23 November: keranjang menyimpan ID menu, jumlah, dan cara pesan pada tab
yang sama agar bertahan saat login atau reload. Logout mengosongkan keranjang.
Checkout menampilkan item hilang atau stok berubah dan memberi aksi koreksi
sebelum mencoba ulang. Harga dan stok final tetap divalidasi API.

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Pratinjau /checkout memvalidasi nama/cara pesan dan membuat order contoh pada state lokal; belum ada checkout API atau transaksi database. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Membuat order per tenant dari satu keranjang dengan harga dan total yang dihitung server.

## 2. User Story

Sebagai pemesan, saya mengisi nama, memilih dine in/take away, lalu memperoleh order dan QRIS untuk setiap tenant.

## 3. Alur (happy path + edge case)

Happy path: edit qty → isi nama dan order_type → POST checkout dengan idempotency key → API membaca menu/tenant/harga → transaksi membuat order per tenant dan snapshot → simpan token per order → tampilkan ringkasan pembayaran.
Edge: item tidak aktif/tidak tersedia atau QRIS belum siap → 409 tanpa order parsial; retry jaringan memakai key sama; payload berbeda/key sama → 409; nama kosong/item duplikat → 400; tab ganda ditangani idempotency. Harga final adalah harga DB saat checkout, selalu ditampilkan sebelum pembayaran manual.

## 4. Kontrak API (endpoint, request, response)

Revisi 21 November: [vendor launch](../vendor-launch.md) menetapkan ownership JWT, checkout persisten, replay terenkripsi dan pengurangan stok atomik. Mengatasi keterangan demo/checkout anonim historis di bawah.

Revisi terbaru: checkout operasional wajib Authorization Bearer JWT pelanggan.
Sub diverifikasi API dan menjadi owner order; linkage DB perlu migration tambahan.
Implementasi saat ini guard frontend + order demo, bukan endpoint checkout operasional.

`POST /api/orders` publik dan rate-limited. Header Idempotency-Key: UUID (normalisasi menjadi CheckoutHeadersSchema). Body CreateOrdersRequestSchema:
```json
{"customer_name":"Rani","order_type":"take_away","items":[{"menu_id":"11111111-1111-4111-8111-111111111111","qty":2}]}
```
201 CreateOrdersResponseSchema: `{orders:[{order,order_access_token,qris:{image_url,merchant_name}}]}`. Retry identik mengembalikan hasil semula. No-store untuk respons rahasia.
400 validasi; 409 keranjang/konflik idempotency; 429; 503 dependency tidak tersedia (envelope INTERNAL_ERROR). Tidak menerima tenant_id, unit_price, total, status, atau payment_method dari client.

## 5. Skema Data (rujukan ke packages/shared)

`CreateOrdersRequestSchema`, `CheckoutHeadersSchema`, `CreateOrdersResponseSchema`, `OrderSchema`, `OrderItemSchema`. Tabel pendukung dan constraints di [DATA-01](../data-model.md).

## 6. Aturan Bisnis

Nama 2–100 setelah trim; qty 1–99; maksimal 100 menu_id unik. Server mengelompokkan tenant; semua order satu checkout atomik. V1 tanpa biaya/pajak sampai review. Kode order unik KT- + 10 alfanumerik uppercase, bukan rahasia. Token per order 256 bit; digest private. Snapshot harga, nama menu, QRIS. Retensi replay 24 jam; API memakai AES-256-GCM dengan key terpisah dan nonce unik. Format/penggunaan ada di [kontrak transaksi](../database-api-context.md).

## 7. Kriteria Terima

Pada peluncuran satu tenant, keranjang menghasilkan satu order, satu token, dan satu nominal/QRIS tenant tersebut. Setelah tenant lain ditambahkan, keranjang dua tenant menghasilkan dua order, dua token, dua nominal/QRIS yang cocok; tidak memerlukan perubahan kontrak atau deploy. Total sama dengan jumlah snapshot subtotal. Tidak ada order tercipta bila satu tenant gagal. Replay tidak menggandakan order; token tidak muncul di URL/log.

## 8. Catatan Keamanan

Strict schema menolak spoof harga/status dan item duplikat. Validasi ketersediaan di transaksi, retry konflik terbatas. Rate limit awal checkout 10/min/IP, limit body, token redaction, no-store. Tidak menerima SQL/tenant scope dari client.

## 9. Catatan Desain (rujuk DESIGN.md)

[Checkout](../design/pages/checkout.md): kelompok per tenant, nominal tegas, CTA menyebut jumlah order; loading mencegah double submit namun idempotency tetap server-side.

## 10. Test Plan

Kontrak: harga/status/tenant injection, qty pecahan/0, nama spasi, duplikat. Integrasi: satu tenant awal; fixture dua tenant setelah penambahan lewat admin; unavailable race, rollback transaksi, collision order code, replay dan payload beda, timeout setelah commit. DB: FK komposit menolak item lintas tenant.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.
Revisi 25 November: order baru mempunyai tenggat pembayaran 15 menit. Order yang
masih belum pernah diklaim saat tenggat lewat dibatalkan oleh worker API dan
stoknya dipulihkan dalam transaksi yang sama. Klaim yang sedang diverifikasi,
klaim ditolak, dan pembayaran yang diterima tidak kedaluwarsa otomatis.
