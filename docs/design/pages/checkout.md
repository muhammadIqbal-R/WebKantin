# Checkout dan QRIS · Arah halaman

**Status:** draft · 2026-11-12 · Terkait F-02/F-03. [DESIGN](../DESIGN.md), [tokens](../tokens.md).

- Hierarki: judul checkout → nama/order type → item per tenant → nominal per tenant
  → CTA buat pesanan. Setelah commit: kode/merchant/nominal → QRIS → Saya sudah bayar.
- Tipografi: body untuk input/item, emphasis numeric untuk nominal, heading untuk tenant.
- Warna: action untuk CTA, warning untuk menunggu verifikasi, success hanya ketika paid.
- Spacing/layout: satu kolom mobile; ringkasan di samping form desktop, space.6 antar tenant;
  tidak menjumlah pembayaran lintas merchant menjadi satu instruksi bayar.
- Motion: fast feedback, normal perpindahan ringkasan; reduced tanpa animasi.
- State: default/hover/focus; disabled submit invalid/pending; loading checkout;
  error inline dan ringkasan retry; empty cart; konflik harga/menu meminta review ulang;
  QRIS gagal load menampilkan retry; pending confirmation tidak berlabel lunas.
- Akses: label nama eksplisit, order type radio group, error terhubung aria-describedby,
  focus pindah ke error pertama; nilai nominal bisa disalin dengan feedback berlabel.


Pratinjau frontend: route /checkout untuk nama, dine-in/take-away, ringkasan dan
konfirmasi. Setelah membuat order contoh, route /pesanan menampilkan instruksi
QRIS placeholder (bukan QR pembayaran) dan tombol pelaporan simulasi. Field wajib
divalidasi dengan schema shared. Tidak menyebut transaksi sukses/terverifikasi
sebelum state contoh diubah secara eksplisit. Data tidak tersimpan setelah refresh.

Audit 23 November: keranjang aktif bertahan saat login atau reload tab. Checkout
menampilkan aksi hapus untuk item yang hilang dari katalog, serta pesan/kontrol
jumlah untuk stok berubah. Login dari menu/akun kembali ke beranda bila keranjang
kosong. Halaman pesanan menampilkan pesan khusus saat pembayaran ditolak dan
tombol retry jika gambar QRIS gagal.

Setelah pilihan cara pesan, tampilkan Nomor meja (opsional) hanya untuk makan
di tempat. Di bawahnya, tampilkan Catatan untuk tenant (opsional). Gunakan form
satu kolom di HP. Detail order menampilkan keterangan dengan label yang sama,
dan menyembunyikan bagian tersebut jika kosong.
