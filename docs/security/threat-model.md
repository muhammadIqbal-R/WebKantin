# SEC-03 · Threat model

**Status:** draft · 2026-11-12. Belum ada bukti mitigasi runtime. Istilah mengikuti [MASTER](../MASTER.md).

Aset: integritas nominal/status pembayaran, data pemesan, scope tenant, kredensial
admin, media tenant, dan audit. Batas kepercayaan: browser → API → DB/Storage;
Supabase Auth → API; orders → Realtime → browser. Browser selalu tidak dipercaya.

| Ancaman | Mitigasi yang direncanakan | Pembuktian |
|---|---|---|
| Pemesan menandai sendiri paid | Report paid hanya pending; accept/reject JWT tenant/admin | Tes F-03/F-08 |
| IDOR lintas tenant/order | API scope + RLS + capability rahasia | Tes tenant A/B dan pemesan A/B |
| Harga/total palsu | Strict input; harga DB dan snapshot transaksi | Tes kontrak + integrasi checkout |
| Replay checkout / klik bayar bersamaan | Idempotency key+request hash, optimistic version, transaksi | Tes parallel/retry |
| Bocor lewat Realtime filter | SELECT RLS per capability, role read-only, expiry | Spike SEC-01 |
| Bocor melalui Prisma owner/pool | NOBYPASSRLS + FORCE + scope transaction-local | Tes DB runtime |
| Spam order/menu/token endpoint | Rate limit terdistribusi, body limit, Retry-After | Load/rate-limit test |
| QRIS diganti pihak lain | Admin-only upload, audit, object immutable snapshot | Tes otorisasi + observasi audit |
| Upload polyglot/SVG/oversized | MIME whitelist, magic bytes, decode/reencode, 2 MiB, API proxy | Fixture berbahaya |
| Arbitrary URL/SSRF | API menerima hanya asset bucket/path milik scope; tidak fetch URL pengguna | Tes asset asing |
| XSS mencuri token tracker | Escape React, tanpa raw HTML, CSP, tanpa token URL/log | Tes rendering dan redaction |
| JWT palsu / role metadata | Verifikasi signature/iss/aud/exp dan users aktif | Tes auth negatif |
| CORS/CSRF salah asumsi | Origin allowlist, JSON headers, token Authorization eksplisit | Tes origin asing |
| Secret masuk bundle/log | env server-only, redaction Pino, review bundle | Secret scan dan log test |
| Provisioning akun gagal sebagian | Pending state/kompensasi; API retry idempotent | Tes Auth API gagal |
| Gangguan Supabase/Railway | Error aman, timeout, rollback, polling fallback | Fault injection |

Retention nama pemesan, token, dan audit perlu kebijakan sebelum produksi.
Jangan mencatat nama pemesan, access token, Authorization, secret key, atau image
payload pada log; catat actor ID, tenant ID, order ID, request ID, aksi, dan waktu.



Revisi identitas 2026-11-12: pelanggan kini mendaftar/login Supabase Auth sebelum
checkout. [Spesifikasi](../customer-accounts.md). Ancaman baru: signup spam, konfirmasi
email, account enumeration, dan ownership order lintas akun; perlu verifikasi API
serta migration ownership sebelum produksi. Akun pelanggan bukan profil staf.
