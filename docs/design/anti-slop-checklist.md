# DESIGN-03 · Anti-slop checklist

**Status:** draft · **Terakhir diperbarui:** 2026-11-12  
**Status implementasi desain:** pratinjau frontend dengan data contoh; verifikasi desain berjalan.
Static guard token/pola tersedia melalui pnpm check:design. Hasil akhir dicatat di
[frontend-preview](../frontend-preview.md); item belum terbukti tetap belum.

| Pemeriksaan sebelum PR desain merge | Status | Bukti |
|---|---|---|
| Arah halaman tertulis sebelum markup: hierarki, tipografi, warna, spacing, motion, state | belum | Draft pages tersedia; belum direview |
| Hierarki mengikuti tugas pengguna; tanpa hero marketing template | belum | — |
| Tidak ada gradient indigo–pink, ikon dekoratif generik, susunan kartu tanpa alasan | belum | — |
| Pemakaian Geist dijelaskan; tidak mengganti ke Inter tanpa alasan | belum | tokens.md |
| Warna/font/radius/shadow/spacing berasal semantic tokens | lulus | Implementasi tokens.css dan pnpm check:design; cek statis warna/font/radius/shadow |
| Default/hover/focus/disabled/loading/error/empty sesuai relevansi | belum | — |
| Kontras, heading semantik, keyboard, focus, touch target diverifikasi | belum | — |
| Foto produk berlabel, lazy-load, placeholder error dan dimensi stabil | belum | — |
| Desain mobile/desktop tidak overflow; CTA tidak menutup konten | belum | — |
| Reduced motion, status aria-live, informasi bukan warna saja | belum | — |
| Scanner anti-slop dijalankan dan hasil sebenarnya dilampirkan di PR | lulus | Guard lokal check-design.mjs, 23 TSX/CSS; scope statis terbatas, bukan gmira/tastemaker |
| Review manusia memeriksa konteks kantin dan bukti visual | belum | — |

Catatan historis M0: apps/web-user sebelumnya berisi salinan create-next-app asli, termasuk
literal warna, font, dan layout bawaan. Ini bukan desain fitur yang disetujui.
Scaffold telah diganti setelah pengguna meminta desain frontend dan arah halaman
tertulis; jangan menyatakan implementasi pratinjau sebagai persetujuan produk. Tidak ada tool tastemaker/gmira/hyperstack yang dipasang
atau hasil scan yang diklaim. Pada PR desain, tentukan scanner yang tersedia,
jalankan, catat versi/perintah/hasil; bila tool tidak tersedia, laporkan gate belum lulus.

Review manual tidak boleh dilabeli hasil scanner otomatis. Referensi wajib:
[DESIGN](DESIGN.md), [tokens](tokens.md), dan [engineering rules](../reference/engineering-rules.md).


Review browser oleh agen tercatat di frontend-preview.md. Persetujuan desain manusia
dan audit aksesibilitas lengkap tetap belum. Tidak ada PR dibuat atau di-merge.


Revisi terbaru mengikuti feedback pengguna dan screenshot HAKA, memakai logo Vokasi UI.
[Hasil/bukti browser](../frontend-vokasi-validation.md) mengganti preview awal.
Slogan generik pada tracker/lokasi/admin diganti label tugas. Tidak ada klaim
review manusia atau audit aksesibilitas lengkap sudah disetujui.
