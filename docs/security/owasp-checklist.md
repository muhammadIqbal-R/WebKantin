# SEC-04 · OWASP Top 10:2025

**Status:** draft · **Terakhir diperbarui:** 2026-11-12  
**Skala:** belum | lulus | gagal | tidak-berlaku (dengan alasan).  
**Cakupan:** kontrol produk yang harus diverifikasi sebelum deploy, bukan hasil tes M0.

Kategori mengacu [daftar resmi OWASP Top 10:2025](https://top10.owasp.org/2025/).
Tidak memakai penomoran kategori 2021. Semua kontrol runtime saat ini **belum**.

| ID | Kategori | Kontrol dan bukti wajib | Kritis | Status |
|---|---|---|---|---|
| A01-01 | Broken Access Control | Tenant A/B isolation melalui API; resource asing 404 | Ya | belum |
| A01-02 | Broken Access Control | RLS ENABLE/FORCE semua tabel, role runtime non-owner, tanpa BYPASSRLS | Ya | belum |
| A01-03 | Broken Access Control | Tracker token A tidak membaca/mutasi order B, subscription RLS tanpa filter | Ya | belum |
| A01-04 | Broken Access Control | Frontend tanpa DB/Storage write; anon/tracker tidak punya grants mutasi | Ya | belum |
| A02-01 | Security Misconfiguration | Helmet CSP/HSTS/frame restrictions, TLS, error tanpa stack | Ya | belum |
| A02-02 | Security Misconfiguration | CORS hanya dua origin terkonfigurasi; body/upload limit; proxy trust tepat | Ya | belum |
| A02-03 | Security Misconfiguration | Secret env server-only, contoh tanpa secret, bucket/grants direview | Ya | belum |
| A03-01 | Software Supply Chain Failures | Frozen lockfile, dependency review, audit sebelum rilis | Tidak | belum |
| A03-02 | Software Supply Chain Failures | CI permissions minimum, action SHA pin, tanpa menjalankan PR tak tepercaya dengan secret | Tidak | belum |
| A04-01 | Cryptographic Failures | HTTPS, token CSPRNG 256 bit, digest private, response token no-store | Ya | belum |
| A04-02 | Cryptographic Failures | Rotasi signing key, secret, dan kredensial; backup/recovery diuji | Tidak | belum |
| A05-01 | Injection | Zod strict params/query/body/header untuk semua endpoint, invalid → 400 | Ya | belum |
| A05-02 | Injection | Prisma parameter binding; tidak ada unsafe SQL atau concat set_config | Ya | belum |
| A05-03 | Injection | Teks di-escape, URL asset dibatasi, tanpa raw HTML dari pengguna | Tidak | belum |
| A06-01 | Insecure Design | Threat model direview; nominal server-owned, atomic checkout, satu tenant/order | Ya | belum |
| A06-02 | Insecure Design | State guard + version + idempotency; accept/reject hanya dari pending | Ya | belum |
| A06-03 | Insecure Design | Rate limit publik (awal 60/min/IP, checkout 10/min/IP), Retry-After, multi-instance | Tidak | belum |
| A07-01 | Authentication Failures | JWT signature/issuer/audience/exp valid di endpoint non-publik | Ya | belum |
| A07-02 | Authentication Failures | Login tenant/admin saja, provisioning terkontrol, users aktif/role DB, tanpa sign-up publik | Ya | belum |
| A07-03 | Authentication Failures | Brute-force protection, logout/session expiry, disabled account denial | Tidak | belum |
| A08-01 | Software or Data Integrity Failures | Snapshot item/QRIS, constraints FK tenant, audit pembayaran dalam transaksi | Ya | belum |
| A08-02 | Software or Data Integrity Failures | Magic bytes+decode/reencode gambar ≤2 MiB, Storage proxy API, owner scope | Ya | belum |
| A09-01 | Security Logging and Alerting Failures | Pino redaction, request ID, actor/order/tenant ID, accept/reject/status audit | Ya | belum |
| A09-02 | Security Logging and Alerting Failures | Alert kegagalan auth/konfirmasi dan akses audit dibatasi | Tidak | belum |
| A10-01 | Mishandling of Exceptional Conditions | Timeout, rollback, konflik konkuren, dependency failure tanpa paid palsu | Ya | belum |
| A10-02 | Mishandling of Exceptional Conditions | Error contract aman, fallback polling, reconnection/version stale | Tidak | belum |

**Hasil awal:** 0/26 lulus; 26 belum; 0 gagal; 0 tidak-berlaku. Persentase 0%.
Rumus: lulus / (semua kontrol − tidak-berlaku) × 100.
Gate produksi: minimal 90% serta semua kontrol kritis lulus dan tanpa temuan high/critical
terbuka. Setiap status lulus harus menunjuk artefak tes/review bertanggal, tidak cukup
karena dokumen atau package tersedia. [Validasi M0](../foundation-validation.md)
tidak membuktikan RLS/Auth/CORS/Storage runtime sudah aktif.



Bukti tambahan fase DB: [24 tes lokal](../database-validation.md) menguji RLS,
state, isolasi dan integritas SQL. Ini tidak mengubah status kontrol runtime/live
menjadi lulus; integrasi Express dan Supabase belum tersedia.
