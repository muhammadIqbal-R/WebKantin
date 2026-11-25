# F-11 · Pengembalian dana
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-25
**Terkait:** F-03, F-04, F-08, F-09

## 1. Tujuan

Mencatat pengajuan dan hasil refund dari detail pesanan untuk QRIS statis.

## 2. User Story

Pelanggan dapat mengajukan refund dan melihat hasilnya. Tenant yang menerima
pembayaran dapat memeriksa transaksi dan mencatat pengembalian yang benar-benar terjadi.

## 3. Alur (happy path + edge case)

Pelanggan memilih Ajukan refund dan mengisi alasan. Tenant/admin memeriksa
mutasi, lalu menolak dengan alasan atau mengambil penanganan. Petugas yang
mengambil penanganan menyelesaikan pengembalian dari sisi merchant dan
mencatat referensi transaksi di web. Pengajuan yang sedang diproses tidak
dapat diambil ganda. Pelanggan melihat status permintaan dan hasilnya.

## 4. Kontrak API (endpoint, request, response)

Pelanggan mengajukan melalui `POST /api/orders/:id/refund`. Tenant/admin
memperbarui melalui `PATCH /api/admin/orders/:id/refund` dengan versi dan
aksi ambil, tolak, atau selesai. Detail order menampilkan status refund.

## 5. Skema Data (rujukan ke packages/shared)

`OrderRefundSchema`, `RequestRefundSchema`, dan `UpdateRefundSchema`.
Data permintaan, petugas, tanggal, dan hasil berada di `app_private.order_refunds`.

## 6. Aturan Bisnis

Satu permintaan per order, dengan jumlah penuh yang ditetapkan server. Order
yang sudah lunas dan order yang kedaluwarsa setelah pelanggan mengaku sudah
transfer dapat diajukan. Untuk kedaluwarsa, merchant wajib memeriksa transfer
terlebih dahulu. Status pembayaran asli dipertahankan sebagai histori.
Alur ini tidak mengirim uang, mengubah status bayar, atau mengembalikan stok
pesanan lunas. Aksi penyiapan pesanan diblokir saat refund diproses atau selesai.

## 7. Kriteria Terima

Pemilik order dapat mengajukan dan membaca status, tenant lain ditolak, hanya
satu petugas mengambil pengajuan, dan selesai membutuhkan referensi.

## 8. Catatan Keamanan

FORCE RLS dan scope dari konteks transaksi. Permintaan dan resolusi terminal
tidak dapat ditulis ulang. Referensi bersifat internal dan tidak tampil ke
pelanggan. Form tidak meminta rekening, PIN, atau foto bukti.

## 9. Catatan Desain (rujuk DESIGN.md)

[Pemulihan dan operasional pesanan](../design/pages/order-operations.md).

## 10. Test Plan

Scope pemilik dan tenant, jumlah server, percobaan ganda, versi basi, pengajuan
terlambat bayar, proses dan resolusi, deadline dan pemulihan stok setepat sekali.
