# F-10 · Chat pesanan
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-24
**Terkait:** F-04, F-08, F-09, SEC-01

## 1. Tujuan

Tenant dan pelanggan bisa saling mengirim pesan untuk mengonfirmasi detail pesanan.

## 2. User Story

Sebagai tenant, saya dapat menanyakan pilihan atau lokasi pengambilan. Sebagai
pelanggan, saya dapat membalas dari halaman pesanan yang sama.

## 3. Alur (happy path + edge case)

Pelanggan membuka **Chat tenant** dari salah satu pesanan. Tenant membuka **Chat
pelanggan** di detail pesanan. Pesan tersimpan dan panel terbuka mengambil pesan
baru tiap 5 detik. Riwayat tetap bisa dibaca setelah pesanan selesai atau dibatalkan.
Jika pengiriman gagal, teks tetap ada dan percobaan ulang memakai ID yang sama.
Pesanan lama tanpa akun tertaut tidak memiliki peserta pelanggan.

## 4. Kontrak API (endpoint, request, response)

- Pelanggan `GET/POST /api/orders/:id/messages` dengan JWT pelanggan.
- Tenant `GET/POST /api/admin/orders/:id/messages` dengan JWT staf role tenant.
- GET memakai `OrderMessagesQuerySchema` dan membalas
  `OrderMessagesResponseSchema` berisi 30 pesan terbaru (atau 30 sebelum cursor),
  cursor, dan status chat. POST memakai `SendOrderMessageSchema` dan membalas
  `OrderMessageResponseSchema`. Pengulangan payload yang sama memakai pesan lama.
- Tanpa sesi 401, scope salah 404, pesan baru di order tertutup 409,
  body/query invalid 400, terlalu banyak pesan 429.

## 5. Skema Data (rujukan ke packages/shared)

`OrderMessageSchema`, `OrderMessagesQuerySchema`,
`SendOrderMessageSchema`, `OrderMessagesResponseSchema`.
Database memakai tabel privat `order_messages` dengan ID per order dan urutan
server untuk pagination.

## 6. Aturan Bisnis

Teks 1–1.000 karakter setelah trim. Maksimal 12 pesan per pihak per pesanan per
menit. Pesan tidak mengubah pembayaran, stok, atau status. Riwayat mengikuti
pesanan. Tanpa lampiran, edit, hapus, atau notifikasi saat panel chat tertutup.

## 7. Kriteria Terima

Kedua pihak bisa mengirim dan membaca balasan pada order yang sama. Pesanan dan
tenant lain tidak memiliki akses. Pesan ganda akibat percobaan ulang tersimpan
sekali. Setelah pesanan ditutup kedua pihak masih bisa membaca riwayat.

## 8. Catatan Keamanan

Role dan identitas pengirim didapat dari sesi server. Isi pesan dirender sebagai
teks dan tidak dimasukkan ke log. FORCE RLS membatasi peserta aktif. Admin
pengelola tetap mengelola status pesanan dan tidak ikut dalam percakapan.

## 9. Catatan Desain (rujuk DESIGN.md)

[Arah chat pesanan](../design/pages/chat-pesanan.md).

## 10. Test Plan

Tes API/SQL untuk tenant A/B, pelanggan A/B, admin, akses langsung Auth,
balasan, pagination, idempotensi, order ditutup, dan akun nonaktif. Uji browser
pada dua sesi di layar kecil dan besar, termasuk teks panjang serta retry.
