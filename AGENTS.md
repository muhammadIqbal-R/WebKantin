# Aturan proyek

Baca docs/MASTER.md, feature MD terkait, dan docs/security sebelum implementasi.
Arahan pengguna terbaru: buat implementasi database penuh sebagai SQL siap salin
ke Supabase SQL Editor, schema Prisma, seed placeholder dan panduan env. Jangan
menjalankan SQL pada project live dari sini. Frontend tetap pratinjau sampai API
diimplementasikan dan dihubungkan. Izin ini menggantikan penundaan database sebelumnya.
MASTER menguasai keputusan lintas fitur; Feature MD menguasai detail internal.
Status draft tidak boleh dianggap approved. Catat konflik di changelog MASTER.

Stack dikunci sesuai MASTER. Semua mutasi melalui Express; Prisma hanya apps/api.
Supabase client frontend hanya Auth session dan Realtime. Upload juga melalui API.
Input jaringan bertipe unknown lalu diparse schema strict dari @kantin/shared.
Tidak ada explicit any. Komentar kode menggunakan bahasa Inggris secara konsisten.
Sebelum markup baru: tulis arah desain di docs/design/pages, gunakan token dan
semua state relevan. Terapkan checklist anti-slop. Jangan menambah dependency
tanpa alasan di docs/dependencies.md dan PR. PR menyertakan pembaruan MD dan
hasil lint/typecheck/test. Jangan mencetak token, secret, atau nama pemesan di log.

Sebelum mengubah Next.js, baca panduan yang relevan di node_modules/next/dist/docs
yang di-resolve dari masing-masing aplikasi. Hormati AGENTS.md lokal scaffold.
