# Pratinjau frontend awal · 2026-11-12

**Laporan historis:** revisi visual Vokasi UI dan Auth pelanggan berikutnya ada di
[hasil terbaru](frontend-vokasi-validation.md).

**Status:** pratinjau kedua frontend terverifikasi lokal. Feature MD tetap draft.
Arahan pengguna: desain frontend user/admin terlebih dahulu, data placeholder,
backend dan database live ditunda. Otoritas: [MASTER ADR-010](MASTER.md).

| Aplikasi | Route |
|---|---|
| web-user — port 3000 | /, /checkout, /pesanan, /lokasi |
| web-admin — port 3001 | /, /pesanan, /menu, /tenant, /denah, /akun, /login |

Satu dataset contoh di packages/ui/src/demo-data.ts; satu kantin fakultas dan satu
tenant Warung Bu Sari. Identitas, jam, estimasi, harga, order, dan foto hanya contoh.
Order contoh admin tidak dimasukkan pada daftar pesanan pemesan.
State React per app; tidak ada persistence, API/DB/Storage mutation, Auth session,
pembayaran sungguhan, atau realtime. Refresh mengembalikan dataset awal.
Penambahan tenant admin disimulasikan sebagai draft; sinkronisasi ke web-user
menunggu backend. Jangan menganggap pemilih role sebagai authorization.

Komponen Button mengikuti pola shadcn/ui cva/Slot; modal memakai Radix Dialog
dengan focus trap dan Escape. Seluruh source dimiliki repo, tanpa CLI generator
atau dependency shadcn runtime. [Dokumentasi Radix shadcn](https://ui.shadcn.com/docs/components/radix/dialog).
Token implementasi packages/ui/src/tokens.css, spesifikasi [tokens](design/tokens.md).

Jalankan dari root: pnpm install --frozen-lockfile, lalu pnpm dev.
Link lintas app memakai NEXT_PUBLIC_USER_URL / NEXT_PUBLIC_ADMIN_URL (opsional,
default localhost:3000 / localhost:3001). Supabase env tidak diperlukan untuk preview.

## Verifikasi

Jangan menjalankan next typegen dan next build bersamaan pada app yang sama.
Tidak ada deployment atau migrasi database pada pekerjaan ini.


### Hasil aktual

- pnpm check: dokumen/link/status, design guard, lint, typecheck, 14 tes kontrak shared.
- pnpm build --concurrency=2: kedua frontend dibuild setelah pemeriksaan akhir.
- pnpm peers check: tanpa peer mismatch.
- HTTP preview lokal user/admin: 200.
- Browser desktop 1280 px: katalog, empty search, tambah dua menu, total Rp24.000,
  checkout nama+take-away, order contoh, klaim pembayaran pending.
- Browser admin: accept pembayaran contoh; reject kosong ditolak; reject beralasan
  berhasil; tambah tenant Kedai Rasa sebagai draft; tambah menu Rp19.000 pada tenant
  itu; mode tenant awal tidak menampilkan menu tenant contoh lain.
- Browser ponsel 390×844: katalog dan checkout tidak melebar horizontal; viewport
  390 px, lebar dokumen 375 px (sisa scrollbar). Tabel admin menggulir di area sendiri.
- Dialog Escape menutup modal dan fokus kembali ke tombol Tambah tenant.
- Tidak ada console error pada tab yang diperiksa. Tidak diklaim sebagai audit WCAG lengkap.

Bukti: [web-user](design/previews/web-user.jpg),
[web-admin](design/previews/web-admin.jpg),
[checkout mobile](design/previews/user-mobile.jpg).

Perbaikan dari QA: Slot button hanya menerima satu child; grid mobile diberi
min-width:0 agar tidak overflow; tombol mobile diperbesar; fokus dialog dikembalikan
ke pemicu; smooth-scroll global dihapus agar transisi route tidak mengganggu posisi.
Preview server milik agen dihentikan setelah QA; jalankan pnpm dev untuk membuka
kembali kedua frontend.
