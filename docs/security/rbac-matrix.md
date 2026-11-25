# SEC-02 · Matriks RBAC

Revisi pengelolaan 2026-11-20: [kontrak operasional](../staff-management.md). Admin mengelola tenant/pengguna dan semua stok, tenant hanya menu/stok miliknya. Pengguna dinonaktifkan, bukan dihapus permanen. Checkout pelanggan wajib JWT sesuai revisi akun, bukan checkout anonim yang masih tercantum pada matriks historis berikut. Pengujian produksi tetap terpisah dari SQL lokal.

**Status:** draft · **Verifikasi seluruh izin:** belum · 2026-11-12. Istilah: [MASTER](../MASTER.md).

| Aksi | Pemesan + token order | Tenant | Admin Pengelola |
|---|---|---|---|
| Lihat katalog/outlet aktif via API | Ya, tanpa token | Ya | Ya |
| Checkout publik | Ya, tanpa token | Menggunakan alur publik, bukan identitas admin | Menggunakan alur publik, bukan identitas admin |
| Detail/report paid/tracker | Order milik token | Tidak memakai endpoint pemesan | Tidak memakai endpoint pemesan |
| Daftar/detail order admin | Tidak | Tenant sendiri | Semua tenant |
| Terima/tolak pembayaran | Tidak | Tenant sendiri | Semua tenant |
| Status siap/selesai/batal sebelum paid | Tidak | Tenant sendiri | Semua tenant |
| Baca/kirim chat pesanan | Akun pemilik order saja | Tenant order saja | Tidak |
| Ajukan refund | Akun pemilik order | Tidak | Tidak |
| Tinjau refund dan catat hasil | Lihat status sendiri | Tenant order saja | Semua tenant, sesuai petugas penanganan |
| CRUD menu | Tidak | Tenant sendiri | Semua tenant |
| CRUD tenant, QRIS, akun tenant | Tidak | Tidak | Ya |
| CRUD outlet/denah | Tidak | Tidak | Ya |
| Upload foto menu via API | Tidak | Tenant sendiri | Semua tenant |
| Ubah role/scope akun | Tidak | Tidak | Ya |
| Mutasi langsung Supabase dari frontend | Tidak | Tidak | Tidak |

RBAC dicek API setelah signature/issuer/audience/expiry JWT diverifikasi dan users
aktif dibaca. Scope tenant berasal users di DB, bukan body/query/user_metadata.
Tenant_id yang berbeda harus 403 pada filter koleksi; resource individual milik
tenant lain dibalas 404 untuk menghindari enumerasi. UI menyembunyikan tombol
tidak menggantikan authorization backend. Public checkout tetap rate-limited.

Semua grants/policy RLS wajib diuji mandiri; pemeriksaan API saja belum cukup.
Account provisioning memakai Auth Admin API dari Express dengan secret server-only,
tidak memprovisikan staf melalui public sign-up; signup pelanggan kini diizinkan sesuai revisi akun. Perubahan role/scope menolak request berikutnya meski
JWT lama masih berlaku, karena users aktif dicek ulang oleh API.
Referensi kontrak: UserSchema, CreateTenantAccountRequestSchema, MeResponseSchema.

| Skenario tes wajib | Status | Bukti |
|---|---|---|
| Tenant A tidak dapat membaca/mengubah menu dan order B | belum | — |
| Tenant A tidak dapat CRUD tenant/outlet/akun | belum | — |
| Admin aktif dapat mengelola dua tenant | belum | — |
| JWT palsu/expired/wrong issuer/audience → 401 | belum | — |
| Akun dinonaktifkan/role diganti → akses lama ditolak | belum | — |
| Token order A gagal untuk tracker/report paid B | belum | — |
| anon dan order_tracker tidak punya INSERT/UPDATE/DELETE | belum | — |
| Role runtime tidak melewati RLS; pool tidak bocor konteks | belum | — |



Revisi akun pelanggan: [spesifikasi](../customer-accounts.md). Bearer pelanggan tidak
memberi izin staf; customer ownership DB/API masih perlu migration/integrasi.

Penegasan 2026-11-14 (ADR-014): operator pemilik/pengelola kantin mendapat akun
admin, sehingga bisa menambah tenant dan menu milik tenant yang dipilih. Akun
tenant tidak dapat menambah tenant lain dan hanya mengelola menu/pesanan sendiri.
