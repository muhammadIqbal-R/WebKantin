# SEC-01 · RLS, Prisma, dan tracker tanpa login

**Status:** draft · 2026-11-12. Keputusan lintas fitur: [MASTER ADR-005/006](../MASTER.md).
SQL/RLS sudah diimplementasikan dan diuji pada PostgreSQL embedded lokal; belum dipasang/diuji pada Supabase live. Lihat [validasi database](../database-validation.md).

## RLS untuk semua tabel

Revisi 21 November: [vendor launch](../vendor-launch.md) menambah SELECT authenticated khusus owner order/staf aktif, restrictive policy dan cek Auth banned; tidak menambah izin mutasi. Custom tracker lama tidak menjadi syarat akun baru.

ENABLE ROW LEVEL SECURITY dan FORCE ROW LEVEL SECURITY di tabel inti dan tabel
pendukung. Deny by default. Bedakan role DDL, role runtime API, role Auth Supabase,
dan role order_tracker. Jangan memberi browser mutation grants/RPC bypass.

Runtime Prisma menggunakan role kantin_api non-owner NOBYPASSRLS. API memasang
actor user ID atau scope order yang telah diverifikasi sebagai
transaction-local settings melalui SQL terparameterisasi; seluruh query request
menggunakan transaction client yang sama. Tidak ada set_config persisten di koneksi
pool dan tidak ada concat SQL dari header/body. Tanpa konteks, policy menolak akses.
Role migrasi terpisah dan tidak diinjeksikan ke environment proses API.
Role/tenant staf diturunkan dari profil aktif DB, bukan body atau setting tenant client.
Nama setting/helper tepat ada di [kontrak transaksi API](../database-api-context.md).
RLS adalah defense tambahan atas filter tenant di setiap service API.

| Tabel | Baca pemesan via API | Tenant melalui API | Admin melalui API | Realtime langsung |
|---|---|---|---|---|
| tenants, menus, outlets | Hanya aktif | Scope sendiri + katalog publik | Semua | Tidak dibutuhkan |
| orders | Capability order cocok | tenant_id cocok | Semua | order_tracker: satu order dengan purpose/expiry valid |
| order_items | Capability order cocok | tenant_id cocok | Semua | Tidak |
| users | Tidak | Diri sendiri | Semua untuk manajemen akun | Tidak |
| order_access_grants, checkout_requests | Hanya helper API terbatas | Tidak | Tidak lewat endpoint umum | Tidak |
| order_events, order_payment_snapshots | Projection relevan via API | Scope sendiri | Semua | Tidak |
| order_messages | JWT pemilik order | JWT staf aktif dan tenant sesuai | Tidak | Tidak |
| order_fulfillment_details | JWT pemilik order | Tenant order saja | Semua | Tidak |

users, grants, checkout_requests, checkout_orders, events, audit_events dan payment snapshots berada di skema privat
yang tidak diekspos Data API; semua tetap RLS. orders tidak mengandung token digest,
rahasia idempotency, atau catatan internal sensitif. Bundle menambahkan orders pada publication supabase_realtime tanpa mengubah opsi
publication project yang sudah ada. Frontend hanya subscribe UPDATE orders. Jangan hard DELETE orders pada V1.

## Usulan capability tracker (harus dibuktikan spike)

1. Checkout membuat access token per order menggunakan CSPRNG 32 byte (base64url 43
   karakter). Simpan digest pada order_access_grants; balas secret hanya melalui API HTTPS.
2. Pemesan mengirim X-Order-Access-Token saat mengambil detail/report paid/meminta
   Realtime token. Jangan taruh token di URL, telemetry, query string, atau log.
   Penyimpanan client sessionStorage dengan risiko XSS terdokumentasi; hilang saat
   sesi berakhir. Tidak ada pemulihan token tanpa desain operasional baru.
3. API memverifikasi digest dan grant, lalu mengeluarkan JWT 5 menit ber-role
   order_tracker, purpose order_tracking, order_id tunggal, jti=grant_id, exp, iat, iss, aud.
   Token tracker tidak boleh diterima middleware JWT admin.
4. JWT ditandatangani key yang diimpor/dikenali Supabase (private JWK hanya API).
   Role order_tracker harus dibuat lebih dahulu dengan SELECT sangat terbatas.
   Policy memeriksa claims serta grant belum dicabut; pemilik token tidak dapat
   memilih tenant/order lain. Tidak membuat user atau memanggil anonymous sign-in.
5. Frontend menggunakan realtime.setAuth(token), subscribe UPDATE orders dengan
   filter id=eq.<id>. Periksa event payload memakai OrderSchema, lalu refresh detail
   via API; event hanya pemicu sinkronisasi. Jangan percaya event stale/version lebih kecil.
6. Refresh JWT sebelum expiry; revoke/rotasi key didokumentasikan. Pada disconnect
   gunakan GET API setiap 15 detik, resync saat reconnect, hentikan setelah terminal.

Filter channel bukan kontrol akses; anonymous SELECT true pada orders dilarang.
Tes harus mencoba filter kosong, filter order lain, JWT palsu/expired/wrong purpose,
token grant dicabut, dan token A vs order B. Klaim JWT tidak boleh berasal body mentah.
Event UPDATE dapat berisi row orders; jangan menyimpan rahasia/internal audit di row itu.

## Gate M1/M4

| Bukti integrasi yang diwajibkan | Status |
|---|---|
| Runtime bukan owner/bypassrls dan gagal tanpa konteks | lulus lokal; API/live belum |
| ENABLE/FORCE untuk setiap tabel hasil migrasi | lulus lokal 12 tabel; live belum |
| Koneksi pool tidak membawa scope tenant request sebelumnya | lulus scope bergantian satu koneksi lokal; multi-koneksi API belum |
| Imported key + custom role diterima Realtime staging | belum |
| Subscription tanpa filter tetap hanya menerima order terotorisasi | SELECT policy tanpa filter lulus lokal; delivery subscription live belum |
| orders projection tidak membocorkan secret atau catatan privat | lulus struktur lokal; respons API/live belum |
| Expiry, refresh, revoke, reconnect, polling aman | belum |

Jika spike gagal, revisi ADR-006 melalui review. Jangan mengganti transport Realtime
atau mengaktifkan Auth pemesan secara diam-diam.

Dasar dokumentasi: [Supabase Postgres Changes — custom tokens](https://supabase.com/docs/guides/realtime/postgres-changes#custom-tokens),
[signing keys](https://supabase.com/docs/guides/auth/signing-keys),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
Dokumen resmi mendukung custom token dan RLS; desain capability spesifik proyek
di atas merupakan usulan arsitektur, bukan contoh teruji dari Supabase.

