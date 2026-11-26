# Alasan dependency · M0

`@kantin/staff` adalah paket workspace internal untuk memakai ulang sesi staf,
navigasi, katalog, dan antrean pada web-admin dan web-tenant. Portal tenant
menggunakan versi Next.js, React, dan Tailwind yang sama dengan portal admin.

**Status:** draft · 2026-11-12. Versi exact dikunci package.json dan pnpm-lock.yaml.

| Dependency | Alasan |
|---|---|
| turbo | Task graph monorepo, urutan build shared, cache lint/typecheck/test. |
| typescript 5.9.3 | Strict type checking; kompatibel dengan peer range typescript-eslint (<6.1). |
| zod 4.6.7 | Validasi runtime dan tipe inferensi bersama, sesuai stack terkunci. |
| eslint 9.39.5 + @eslint/js + typescript-eslint | Lint TypeScript dan larangan explicit any; Versi 9.39.5 memenuhi peer plugin bawaan Next. Percobaan ESLint 10 menimbulkan peer mismatch import/react/a11y, sehingga tidak dipakai. Lifecycle lint toolchain harus direview sebelum produksi. |
| tsx | Menjalankan tes kontrak TypeScript dengan node:test tanpa framework tes tambahan. |
| @types/node 24 | Tipe runtime Node dan node:test. |
| Next/React/React DOM dan tipe React | Versi scaffold pengguna dipertahankan; hanya web-user. |
| tailwindcss + @tailwindcss/turbopack | Konfigurasi scaffold pengguna dipertahankan. |
| eslint-config-next | Aturan lint App Router scaffold pengguna. |

Tidak ada Express/Prisma/Supabase SDK/shadcn yang dipasang sebelum fasenya.
Tidak mengganti versi Next pengguna untuk mengejar versi terbaru.
Dependencies diverifikasi melalui registry pada 2026-11-12; ini bukan audit kerentanan.

Referensi tooling: [Turborepo tasks](https://turborepo.com/docs/crafting-your-repository/configuring-tasks)
dan [Zod strict object](https://zod.dev/api#objects). Tidak ada logic fitur dalam shared.


Pada M0 build script yang diizinkan hanya esbuild@0.28.2 (runner tsx).
Pada fase DB ditambahkan prisma@7.10.1 dan @prisma/engines@7.10.1 untuk engine/generate;
versi lain tidak otomatis dipercaya.
Pnpm menambahkan minimumReleaseAgeExclude exact untuk turbo@2.11.11 dan binary platformnya
karena versi terpilih masih baru; pengecualian ini terbatas versi yang tercatat, bukan wildcard.

CI actions dipin commit yang diverifikasi dari release resmi pada 2026-11-12:
[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
[pnpm action v6.1.1](https://github.com/pnpm/action-setup/releases/tag/v6.1.1).
[Dokumentasi allowBuilds pnpm 11](https://github.com/pnpm/pnpm/blob/main/pnpm11/docs/cli/approve-builds.md).

Catatan lifecycle: registry menandai eslint@9.39.5 deprecated/tidak didukung.
Versi ini dipertahankan untuk peer compatibility scaffold; upgrade lint toolchain
bersama eslint-config-next/plugin wajib direview sebelum produksi. Tidak menekan
peer warnings dengan override. pnpm peers check saat ini lulus.

Saat pemulihan scaffold asli dengan npm ci, npm melaporkan 7 temuan moderate
pada dependency scaffold tersebut. Ini bukan hasil pnpm audit untuk monorepo;
audit root dan triase advisory tetap gate A03 sebelum rilis. Tidak menjalankan
audit fix atau mengubah versi Next/React pengguna secara otomatis.

## Pratinjau frontend (diizinkan pengguna)

- Next/React/Tailwind web-admin mengikuti versi web-user agar stack dua frontend seragam.
- @radix-ui/react-dialog: modal form/konfirmasi dengan focus trap dan keyboard.
- @radix-ui/react-slot + class-variance-authority + clsx + tailwind-merge: komponen
  Button dan utilitas pola shadcn/ui yang dimiliki repo, disesuaikan semantic token.
- lucide-react: ikon aksi/navigation bermakna; tidak dipakai sebagai dekorasi acak.
Pada tahap pratinjau tersebut belum ada Supabase SDK atau Prisma; penambahan DB berikutnya di bawah.

## Implementasi database siap salin

Prisma CLI dan @prisma/client 7.10.1 digunakan sebagai ORM API yang terkunci;
versi RC 8 tidak dipakai. @electric-sql/pglite 0.5.16 hanya dependency dev/test
untuk menjalankan SQL PostgreSQL/PLpgSQL/RLS tanpa kredensial atau akses Supabase.
Ini bukan pengganti PostgreSQL Supabase runtime dan tidak menguji layanan Auth,
Storage, jaringan atau pengiriman event Realtime Supabase secara live.


Revisi akun pelanggan: @supabase/supabase-js 2.119.0 hanya web-user untuk Auth
session/daftar/masuk/logout. Tidak dipakai untuk Data API atau Storage mutation.
# Tambahan runtime pengelolaan · 2026-11-20

Media onboarding memakai busboy (parser multipart streaming dengan batas file/field) dan sharp (validasi decode/pixel, re-encode untuk JPEG/PNG/WebP). Signed upload Storage berjalan di server; tidak menambah client Storage frontend. Versi exact dan binary sharp dikunci pnpm. [Batas sharp](https://sharp.pixelplumbing.com/api-constructor/).

Express 5 untuk satu pintu mutasi; jose untuk verifikasi JWT JWKS; @prisma/adapter-pg untuk Prisma 7 PostgreSQL; @supabase/supabase-js server untuk undangan/ban akun dan client admin hanya Auth. @types/express untuk boundary TypeScript. Seluruh versi dikunci oleh pnpm. Tidak menambah ORM atau mengganti stack. Rujukan: [driver Prisma](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers), [Express errors](https://expressjs.com/en/5x/guide/error-handling/), [Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
