# Validasi Fase 0 · laporan historis

Cakupan terbaru desain frontend: [frontend-preview](frontend-preview.md).

**Status:** pemeriksaan fondasi lulus · **Tanggal:** 2026-11-12  
**Lingkungan:** Windows, Node 24.14.0, pnpm 11.25.0.

| Pemeriksaan aktual | Hasil |
|---|---|
| pnpm install --frozen-lockfile --offline | Lulus; lockfile sinkron, tidak perlu resolve baru |
| pnpm check:docs | Lulus; 9 fitur, masing-masing 10 seksi, status cocok MASTER; 37 MD dengan local link valid |
| pnpm lint (melalui pnpm check) | Lulus shared dan scaffold web-user |
| pnpm typecheck (melalui pnpm check) | Lulus shared dan next typegen + tsc web-user |
| pnpm test (melalui pnpm check) | 14 tes lulus, 0 gagal, 0 skip |
| pnpm peers check | Lulus; tanpa peer mismatch |
| pnpm build | Lulus shared dan produksi Next.js 16.4.6; route / dan /_not-found statis |
| SHA-256 migrasi scaffold | 13 berkas app/public/config/AGENTS identik dengan scaffold asal |
| Kontras token terhadap surface | ink 15.31, muted 6.64, action 7.05, hover 9.36, success 7.06, warning 6.39, danger 6.84, control-border 4.86 :1 |

Tes kontrak mencakup spoof harga/status/tenant, nilai uang/qty, input kosong/duplikat,
kecocokan order-item/tenant/total, audit paid, alasan reject, role/scope akun,
metadata upload, capability header, idempotency key, dan pagination.
Ini bukan tes implementasi checkout, RBAC API, MIME/magic bytes, atau RLS database.

## Kendala yang sudah ditangani

Build awal tidak dapat mengambil Google Fonts dalam sandbox. Build ulang dengan
akses jaringan sempat gagal internal Turbopack pada worker CSS. Build sukses setelah
cache hasil percobaan sebelumnya dipisahkan dan dibuat ulang; tidak ada perubahan
markup, konfigurasi Next, atau versi Next untuk melewati error.
Jangan menjalankan next typegen dan next build secara bersamaan pada output .next
yang sama; pemeriksaan dan build berikutnya dijalankan berurutan.

Pembanding pada scaffold asal memicu instalasi otomatis pnpm. Dependency folder
asal telah dipulihkan dengan npm ci dari package-lock.json asli, dan pnpm lockfile
tambahan di sana dibersihkan. Sumber app/public/config tetap identik.

ESLint 10 sempat dicoba untuk lifecycle support, tetapi plugin import/react/a11y
scaffold belum menyatakan peer compatibility. Versi akhir 9.39.5 sesuai semua peer.
Registry menandainya deprecated; dicatat sebagai utang toolchain di
[dependencies](dependencies.md). npm ci pada scaffold asal juga melaporkan 7 moderate;
belum diklaim sebagai audit monorepo atau telah diperbaiki.

## Cakupan yang belum diverifikasi

- Workflow CI sudah ditulis dan action dipin SHA resmi, belum dijalankan di GitHub.
- apps/api, apps/web-admin, packages/ui masih reserved; tidak mengklaim lulus tes runtime.
- Belum ada Prisma schema/migrasi/seed, tabel/bucket/RLS live, Supabase Auth,
  Realtime, rate limiter, CORS, Helmet, atau Pino runtime.
- Belum ada scanner anti-slop/UAT/desain fitur atau deploy. Contrast awal bukan audit UI.
- Audit advisory monorepo dan triase dependency harus dilakukan sebelum rilis.
- MASTER dan seluruh Feature MD tetap draft; pemeriksaan lulus tidak sama dengan
  persetujuan pemilik produk.
- [OWASP](security/owasp-checklist.md): 0/26 kontrol runtime lulus, seluruhnya belum.

