# Kontrak transaksi API terhadap database

**Status:** implementasi SQL lokal tersedia · 2026-11-12.
Dokumen ini panduan implementasi Express berikutnya; bukan endpoint yang sudah berjalan.
Rujukan: [MASTER ADR-005/011](MASTER.md), [setup](../infra/supabase/README.md).

## Identitas dan konteks transaksi

Prisma hanya berada di apps/api. Runtime login sebagai kantin_api, bukan postgres.
Setiap request membuka interactive transaction; seluruh query memakai tx yang sama.
Gunakan set_config(nama, nilai, true) terparameterisasi. Parameter true berarti
transaction-local; jangan memakai SET session atau koneksi global untuk konteks.
Middleware memverifikasi JWT Supabase staf (signature, issuer, audience, expiry).
Jangan mempercayai role/tenant dari body atau user_metadata.

| Jenis operasi | Settings yang dipasang oleh API |
|---|---|
| Semua mutasi | kantin.request_id = UUID request |
| Katalog publik | kantin.actor_kind = public |
| Staf | actor_kind = staff; kantin.actor_id = sub JWT terverifikasi |
| Checkout | actor_kind = checkout; kantin.checkout_id = UUID idempotency; kantin.request_hash = SHA-256 payload canonical |
| Pemesan | actor_kind = customer; kantin.order_id dan kantin.grant_id hasil helper |
| Mutasi status | kantin.expected_version = versi dari request tervalidasi |
| Penolakan pembayaran | kantin.rejection_reason = alasan 2–300 karakter |

Seluruh nama setting selain actor_kind pada tabel memakai awalan kantin.
SQL mengambil role dan scope tenant staf dari app_private.users yang aktif.
Tidak ada setting role/tenant dari client. Konteks maintenance hanya operator
owner; runtime kantin_api tidak memperoleh bypass melalui setting tersebut.

No-context query gagal tertutup. Kredensial API tetap merupakan trust boundary:
siapa pun yang memiliki password API dapat memasang konteks; RLS tidak menggantikan
validasi JWT, rate limit, otorisasi service, dan perlindungan secret di Express.

## Checkout atomik dan idempotency

1. Parse kontrak Zod shared, normalisasi item, reject duplikasi sesuai F-02, buat
   hash payload canonical. Rate-limit sebelum akses DB.
2. Buka transaksi, pasang konteks checkout/request_id. Klaim idempotency_key
   dengan INSERT checkout_requests. Jangan memakai upsert yang mengubah hash.
   Konflik key: ulangi pembacaan dalam transaksi baru dan hash yang sama;
   hash berbeda menghasilkan HTTP 409. Key acak UUID dari client bukan password.
3. Jika response_ciphertext sudah tersedia dan belum expired, dekripsi response
   asli; jangan membuat order/token baru. Replay harus sama.
4. Untuk request baru, baca/lock menu dan tenant pada transaksi yang sama, hitung
   nominal integer IDR, lalu buat satu orders per tenant beserta order_items.
   Harga/nama item ditimpa trigger dari menu DB; trigger mengambil snapshot QRIS.
   FK komposit dan deferred aggregate trigger menolak tenant silang/total berbeda.
5. Buat token CSPRNG 32 byte per order; simpan SHA-256 hex digest pada
   order_access_grants, bukan token plaintext. QRIS/merchant berasal snapshot privat.
6. Enkripsi response replay (termasuk token) dengan AES-256-GCM dan nonce unik,
   memakai key server terpisah. Simpan envelope berversi v1:... dalam
   response_ciphertext. SQL memeriksa bentuk/panjang; kriptografi dilakukan API.
   Trigger mengisi completed_at; commit ditolak bila item/grant/replay belum lengkap.
7. Commit, lalu kirim DTO tervalidasi. Jangan kirim response sebelum commit berhasil.
   Deferred trigger dapat menggagalkan commit walaupun INSERT awal sudah berhasil.

checkout_requests berlaku 24 jam; purge_expired_checkouts() hanya untuk konteks
admin aktif + request_id. Purge menghapus replay/mapping yang kedaluwarsa, bukan
order/audit. Jangan merotasi encryption key tanpa strategi untuk replay yang masih hidup.

## Akses pemesan dan mutasi status

API menerima X-Order-Access-Token, memvalidasi bentuk lalu menghitung digest.
Di transaksi API yang sama, panggil resolve_order_access(order_code,digest) atau
resolve_order_grant(order_id,digest), keduanya pada schema app_private.
Jika tidak cocok/kedaluwarsa/revoked, balas error akses generik dan jangan membocorkan
keberadaan kode order. Helper hanya bisa dieksekusi role API.

Pasang konteks customer menggunakan hasil helper; baca order/item/payment snapshot.
Order code saja tidak mengizinkan akses. Jangan menerima grant_id dari browser
sebagai otoritas. Semua hasil query diproyeksikan ke DTO shared; tabel privat bukan DTO.

Untuk update status, pasang expected_version dari input dan gunakan filter id/version.
SQLSTATE 40001 dari stale version dipetakan ke HTTP 409. Trigger mengisi versi dan
audit server; customer hanya dapat melaporkan pembayaran, staf berwenang mengonfirmasi.
Alur state lengkap tetap di F-03/F-08. Kesalahan CHECK/FK tidak dikirim mentah ke client.

## Realtime dan media

API menerbitkan JWT tracker hanya setelah capability diverifikasi. Claims minimal:
role=order_tracker, purpose=order_tracking, order_id, jti=grant_id, iat, exp
(maximum umur 300 detik), issuer/audience sesuai konfigurasi integrasi.
Jangan menggunakan JWT tracker sebagai sesi staf. SQL memeriksa scope/umur/revokasi;
signature diverifikasi layanan Supabase. Impor/rotasi key dan delivery Realtime live
masih gate integrasi. Filter subscription bukan otorisasi.

API memproksikan upload ke Storage; validasi isi/MIME/ukuran dan path tenant.
Private QRIS/map memakai signed read URL singkat dari backend. Jangan mengoverwrite
objek QRIS yang sudah direferensikan snapshot pembayaran.
