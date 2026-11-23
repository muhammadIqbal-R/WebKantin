# F-04 · Tracker Pesanan Realtime
**Status:** draft
**Pemilik:** Lead Full-Stack Engineer
**Terakhir diperbarui:** 2026-11-12
**Terkait:** F-02, F-03, F-08, SEC-01

**Revisi terbaru:** akun pelanggan minimal wajib untuk checkout; [rincian](../customer-accounts.md)
mengatasi ketentuan tanpa login di draft sebelumnya. Baseline DB tidak di-reset.

Istilah mengikuti [MASTER](../MASTER.md); detail ini merupakan kontrak rencana, belum endpoint aktif.

**Progres frontend:** Timeline order contoh tersedia pada /pesanan; Supabase Realtime, polling API dan target latensi belum diimplementasikan. Rujuk [hasil pratinjau](../frontend-preview.md).

## 1. Tujuan

Menampilkan perkembangan order milik pemesan dengan target perubahan normal kurang dari 5 detik.

## 2. User Story

Sebagai pelanggan yang telah login, saya dapat melacak setiap order terpisah dan mengetahui bila pesanan siap diambil.

## 3. Alur (happy path + edge case)

Happy path: ambil detail via API+token → minta capability Realtime → subscribe UPDATE orders berfilter id → validasi event/version → resync detail API → tampilkan timeline.
Edge: disconnect/JWT expiry → status koneksi + polling API setiap 15 detik; reconnect → refetch sebelum melanjutkan; event lama diabaikan; token hilang → akses tidak dipulihkan lewat kode saja; terminal selesai/dibatalkan → hentikan polling dan subscription; empty/404 tidak mengungkap apakah kode milik orang lain.

## 4. Kontrak API (endpoint, request, response)

Revisi 21 November: [vendor launch](../vendor-launch.md) memakai JWT akun pemilik/staf dan RLS untuk postgres_changes orders; tidak memerlukan custom capability signing key untuk akun baru. Polling fallback dan feed staff dideduplikasi. Detail anonim/capability berikut merupakan rancangan historis.

`GET /api/orders/:code` publik berbasis capability; OrderCodeParamsSchema + OrderAccessHeadersSchema → 200 OrderDetailResponseSchema.
`POST /api/orders/:id/realtime-token`; IdParamsSchema + OrderAccessHeadersSchema + EmptyBodySchema `{}` → 200 TrackerTokenResponseSchema `{access_token,expires_at,order_id}`. Endpoint token ini proposed dan gated oleh spike SEC-01.
400 invalid; 404 token/order tidak cocok; 429; 503 ketidaktersediaan token → tetap polling aman. Semua respons no-store, bukan public cache.
Subscription memakai Supabase client postgres_changes UPDATE public.orders, filter id=eq.<id>. Channel tidak memutasi data.

## 5. Skema Data (rujukan ke packages/shared)

`OrderSchema`, `OrderDetailResponseSchema`, `OrderCodeParamsSchema`, `OrderAccessHeadersSchema`, `TrackerTokenResponseSchema`, `ORDER_STATUSES`. RLS/JWT/grants: [SEC-01](../security/rls-and-realtime.md).

## 6. Aturan Bisnis

Target <5 detik diukur dari commit status ke tampilan normal; fallback 15 detik tidak memenuhi target normal. Tidak membuat auth.users pemesan. Capabilities read-only satu order dengan TTL awal 300 detik. Tidak hard delete order atau subscribe DELETE. Susunan timeline mengikuti state F-03/F-08.

## 7. Kriteria Terima

Pemesan A tidak melihat event/order B meskipun keduanya memesan pada tenant awal yang sama dan filter dihilangkan/diganti. Penambahan tenant dari admin tidak mengubah akses tracker order yang sudah ada. Perubahan tenant tampil otomatis; putus koneksi terlihat; status tidak mundur karena event out-of-order; cleanup channel saat navigasi.

## 8. Catatan Keamanan

Filter tidak menggantikan RLS. JWT wrong purpose/expired ditolak; jangan mengirim service_role ke browser. Key import/custom role harus lolos spike sebelum F-04. Token bukan URL shareable publik.

## 9. Catatan Desain (rujuk DESIGN.md)

[Tracker](../design/pages/tracker.md): status utama dominan, timeline ringkas, koneksi terpisah dari status bisnis, aria-live untuk perubahan.

## 10. Test Plan

Staging integrasi: dua pemesan dengan order berbeda pada satu tenant awal; fixture dua tenant untuk tes ekspansi; tanpa filter, filter asing, token expired/palsu/revoked, key rotation, resubscribe. Ukur latensi <5 detik; uji polling 15 detik, duplicate/stale events, tab cleanup, terminal cleanup.

Implementasi database: [SQL dan panduan pemasangan](../../infra/supabase/README.md),
[mapping data](../data-model.md), dan [24 tes lokal](../database-validation.md).
Endpoint/layanan fitur belum dihubungkan; status spesifikasi tetap draft.
