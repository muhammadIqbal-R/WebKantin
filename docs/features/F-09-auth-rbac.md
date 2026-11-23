# F-09 · Autentikasi dan Otorisasi
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-20
**Terkait:** F-02, F-04, F-06, F-07, F-08, SEC-01, SEC-02

Istilah mengikuti [MASTER](../MASTER.md). Revisi kebutuhan terbaru:
[akun pelanggan minimal](../customer-accounts.md) mengganti non-goal awal tanpa login.

## 1. Tujuan

Memverifikasi pelanggan sebelum checkout, serta membatasi akses staf sesuai profil
aktif dan scope tenant. Katalog tetap dapat dilihat tanpa login.

## 2. User Story

Pelanggan dapat membuat akun dengan nama/email/password, masuk, dan keluar.
Admin/tenant memakai akun yang diprovisikan pengelola dan hanya mengakses scope sah.

## 3. Alur (happy path + edge case)

Pelanggan: katalog → tambah menu → checkout → masuk/daftar → session → checkout.
Signup tanpa session meminta konfirmasi email, bukan menganggap pelanggan sudah masuk.
Refresh session dipulihkan Supabase SDK; logout membersihkan state order/keranjang demo.
Email/password invalid menghasilkan pesan generik. Password tidak dicetak/disimpan
pada data aplikasi. Nama metadata hanya display, bukan otoritas role.

Staf: undangan/provisioning → Supabase Auth → JWT → API verifikasi → profil users
aktif → RBAC/tenant. Invalid/expired token ditolak; staf nonaktif tidak mendapat
akses walaupun sesi Auth belum habis. Tidak ada self-signup role pengelola.

## 4. Kontrak API (endpoint, request, response)

Revisi implementasi 2026-11-20: [pengelolaan operasional](../staff-management.md) menetapkan GET /api/me, daftar pengguna dan PATCH status aktif. Hapus berarti nonaktifkan yang dapat dipulihkan, bukan hard delete Auth/history. Admin tidak dapat menonaktifkan dirinya. Role tenant berasal profil DB aktif pada setiap request; login tidak mempunyai pemilih role.

Auth session/signup/signin/signout melalui Supabase Auth SDK, pengecualian identitas
sesuai MASTER; seluruh mutation bisnis tetap Express-only.
Kontrak input pelanggan CustomerSignInSchema/CustomerSignUpSchema dari shared.

GET /api/admin/me: Bearer JWT staf → MeResponseSchema. 401 invalid, 403 profil
staf tidak aktif/tidak ada. Customer Auth tanpa profil staf tidak memperoleh akses admin.
Checkout operasional berikutnya wajib Bearer JWT pelanggan dan ownership berbasis
sub terverifikasi. Endpoint/customer ownership dan migration belum diimplementasikan;
UI guard bukan otorisasi backend. 503 bila verifikasi Auth tidak dapat dilakukan aman.

## 5. Skema Data (rujukan ke packages/shared)

CustomerSignInSchema, CustomerSignUpSchema, RoleSchema, UserSchema, MeResponseSchema,
CreateTenantAccountRequestSchema. RoleSchema/UserSchema tetap profil staf;
jangan menambah role admin dari metadata signup. Profil/ownership pelanggan memerlukan
migration terpisah dari baseline 12 tabel yang sudah diberikan kepada pengguna.

## 6. Aturan Bisnis

Pelanggan mendaftar nama 2–100, email valid, password 8–128 dan konfirmasi sama.
Login menerima password akun existing yang nonempty. Tidak ada telepon wajib/poin/SMS.
Katalog publik; checkout wajib login. Email confirmation dan redirect allowlist
diatur operator. Tenant tambahan diprovisikan lewat admin, bukan signup pelanggan.

API memverifikasi signature/alg/iss/aud/exp dan membaca profil staf aktif pada setiap
request staf. JWT tracker tidak dipakai sebagai sesi staf. API ownership pelanggan
tidak mengambil user_id/tenant scope kiriman browser.

## 7. Kriteria Terima

Anonymous dapat melihat/menu keranjang tetapi tidak checkout. Form signup menolak
nama kosong, password pendek/mismatch, dan privilege injection. Signup tanpa session
menampilkan pesan cek email. Logout tidak membawa pesanan akun ke akun lain.
JWT staf invalid/nonaktif dan tenant silang ditolak oleh API ketika integrasi tersedia.

## 8. Catatan Keamanan

[Matriks RBAC](../security/rbac-matrix.md), [SEC-01](../security/rls-and-realtime.md).
Public signup diizinkan untuk pelanggan dengan konfirmasi email/rate limit provider.
Hanya provisioning admin menulis profil staf. Secret key hanya API; browser memakai
publishable key. Error provider tidak ditampilkan mentah. Token/password tidak dilog.
RLS/ownership pelanggan perlu tes DB tambahan; baseline staf tidak otomatis mencakupnya.

## 9. Catatan Desain (rujuk DESIGN.md)

[Arah Vokasi UI](../design/revision-vokasi-ui.md): form masuk/daftar di web-user,
nama/email/password + konfirmasi, loading/error/success, navigasi kembali ke menu.
Login staf web-admin memakai form email/password tanpa pilihan peran. Auth staf dan
verifikasi profil API belum tersedia; submit menampilkan layanan belum tersedia.

## 10. Test Plan

Kontrak: normalisasi nama/email tanpa memangkas password, weak/mismatch/empty,
extra role/tenant injection, login akun existing. Browser: checkout guard,
daftar/masuk tab, password masked, keranjang tetap saat navigasi ke Auth, breakpoint
360/390/768/1440. Signup/login/logout/confirmation live belum diuji dengan akun nyata.
Integrasi berikutnya: JWT invalid/expiry/issuer, staff RBAC, customer ownership A/B,
account-switch cache cleanup, refresh/logout, provider failure dan revoke.


Audit QA: Signup live tercatat tanpa konfirmasi karena email fiktif, lalu akun QA dibersihkan. Auth sukses di harness terisolasi bukan bukti Auth live. Login staf masih preview dan direct URL admin terbuka tanpa JWT. [Matriks/bukti](../qa/ACCEPTANCE-2026-11-12.md).

Revisi UI ADR-013: pemilih peran preview dihapus dari login dan toolbar. Form staf
email/password tidak membuka dashboard dengan submit tanpa verifikasi. API /me
masih belum tersedia; implementasi Auth/RBAC staf tetap pekerjaan integrasi.
