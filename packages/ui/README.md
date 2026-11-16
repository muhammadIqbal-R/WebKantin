# @kantin/ui

Token CSS, komponen Button/Badge/Modal/Field/EmptyState, ikon lucide, dan formatter
digunakan kedua frontend. Modal memakai Radix, Button mengikuti pola shadcn/ui.
Entry ./demo menyimpan provider dan dataset placeholder untuk pratinjau; tidak
dipakai sebagai kontrak HTTP atau sebagai sumber data produksi.

Token: src/tokens.css. Styling responsif: src/styles.css.
Arah desain: [DESIGN](../../docs/design/DESIGN.md).
Batas pratinjau: [frontend-preview](../../docs/frontend-preview.md).

Tidak ada Prisma, Supabase SDK, secret, atau mutasi data server dalam package ini.
Sebelum menghubungkan API nanti, ganti provider demo dengan adapter API terverifikasi.

