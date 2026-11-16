# Arah aktif · Revisi 03

Tipografi aktif sesuai ADR-016: Poppins pada judul, isi, navigasi, kontrol dan angka
kedua frontend (400/500/600/700, dimuat lokal). Komposisi katalog B/panel A
mengikuti pilihan sebelumnya. Palet aktif kedua web
sesuai permintaan vendor ADR-015 (2026-11-14): latar olive #93913D,
section/header/kartu cream #F4E7D3. Ini mengganti penempatan palet ADR-014.
Token aktif adalah packages/ui/src/tokens.css. Logo memakai rasio asli (height auto).
Tanpa kontrol A/B/peran/ukuran atau catatan proses desain di aplikasi.
Rujuk revision-03-brief.md dan pages/landing.md serta pages/admin.md.

## Catatan rancangan terdahulu (historis)

# DESIGN-02 · Design tokens awal

**Status:** draft · **Terakhir diperbarui:** 2026-11-12.
Token ini spesifikasi awal, belum dihubungkan ke Tailwind/shadcn.
Saat implementasi, definisikan sekali pada packages/ui lalu konsumsi semantic token;
tidak menyalin literal ke komponen. Istilah mengikuti [MASTER](../MASTER.md).

## Warna

| Token semantik | Nilai awal | Kegunaan |
|---|---|---|
| color.canvas | #F7F5F0 | Latar aplikasi |
| color.surface | #FFFFFF | Permukaan konten/form |
| color.ink | #20271F | Teks utama |
| color.muted | #536052 | Teks pendukung |
| color.border | #E1E2D9 | Garis pemisah dekoratif; bukan satu-satunya batas input |
| color.control-border | #687564 | Batas input dengan kontras terhadap surface |
| color.action | #9D361B | CTA utama |
| color.action-hover | #7E2B16 | Hover CTA |
| color.on-action | #FFFFFF | Teks CTA |
| color.success | #246442 | Lunas/selesai |
| color.warning | #8A5200 | Menunggu/perlu perhatian |
| color.danger | #AD2525 | Error/ditolak |
| color.focus | #9D361B | Outline focus |
| color.disabled-surface | #E8E9E2 | Latar disabled |
| color.disabled-ink | #777E72 | Teks disabled |

Pasangan teks utama/action/success/warning/danger pada surface ditargetkan WCAG AA
4.5:1; focus/batas input 3:1. Jangan memakai border dekoratif sebagai indikator
interaktif tunggal. Verifikasi contrast nyata semua state sebelum approval desain.
Tidak ada gradient, neon status, atau dark mode V1 yang belum dirancang.

## Tipografi

| Token | Nilai |
|---|---|
| font.body / font.heading | Geist, system-ui, sans-serif |
| font.code | Geist Mono, ui-monospace, monospace |
| font.size.caption / body / lead | 12px / 16px / 18px |
| font.size.heading / display | 24px / 32px |
| font.weight.body / emphasis / heading | 400 / 600 / 700 |
| font.line.body / heading | 1.5 / 1.2 |
| font.numeric | tabular-nums untuk nominal dan antrean |

Geist berasal scaffold pengguna; dipilih karena angka dan hierarki ringkas terbaca.
Display hanya untuk judul halaman/status utama, bukan semua elemen. Nominal selalu
diformat IDR tanpa desimal melalui formatter bersama pada implementasi.

## Spacing, ukuran, radius, shadow, motion

| Token | Nilai |
|---|---|
| space.0 / 1 / 2 / 3 / 4 / 6 / 8 / 12 | 0 / 4 / 8 / 12 / 16 / 24 / 32 / 48px |
| size.control-height / content-user / content-admin | 44px / 1120px / 1440px |
| size.border / focus-ring / focus-offset | 1px / 2px / 2px |
| radius.control / panel / pill | 6px / 12px / 999px |
| shadow.none | none |
| shadow.raised | 0 4px 16px rgb(32 39 31 / 0.08) |
| motion.fast / normal | 120ms / 180ms |
| motion.easing | cubic-bezier(0.2, 0, 0, 1) |
| motion.reduced | 0ms |
| breakpoint.compact / medium / wide | 640px / 768px / 1024px |

Nilai layout/responsif juga token; tidak menambahkan magic number pada komponen.
State hover/focus/disabled/loading/error didefinisikan arah halaman dan diuji visual.


## Implementasi pratinjau

Sumber literal tunggal: packages/ui/src/tokens.css. Semantic Tailwind theme dan
CSS layout mengonsumsi variabel tersebut. Tambahan token: action-soft, success-soft,
warning-soft, danger-soft, canvas-deep, sidebar, ukuran sidebar/cart/image/avatar,
font mikro/kecil, skala spacing hingga 96px, serta transition/elevation.
Foto placeholder merupakan asset fotografi; warna pixel foto bukan token UI.
Tidak ada gradient dekoratif. CSS chart menerima nilai data persentase, bukan
magic number presentasi. Seluruh nilai radius/font/shadow/warna UI memakai token.


Revisi terbaru mengganti palet/font/radius awal di atas: sumber aktual tetap
packages/ui/src/tokens.css; [arah Vokasi UI](revision-vokasi-ui.md). Body Arial/Helvetica,
kuning UI untuk aksi dengan teks gelap, biru tinta, radius panel 4px; Geist dihapus.
