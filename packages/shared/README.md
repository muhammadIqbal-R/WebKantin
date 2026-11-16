# @kantin/shared · Kontrak awal

**Status:** draft · 2026-11-12. Sumber keputusan: [MASTER](../../docs/MASTER.md).
Belum ada handler/service/database. Kontrak tidak menggantikan authorization API.

| File | Isi |
|---|---|
| [constants.ts](src/constants.ts) | Status order/payment, order type, role, qris_static, limits, transisi draft. |
| [common.ts](src/common.ts) | UUID, timestamp, money, quantity, params, pagination, errors, capability headers. |
| [catalog.ts](src/catalog.ts) | Tenant, menu, outlet, create/update/list dan query. |
| [orders.ts](src/orders.ts) | Order/item, checkout, report paid, accept/reject, tracker token dan respons. |
| [auth.ts](src/auth.ts) | Role/user RBAC dan akun tenant. |
| [uploads.ts](src/uploads.ts) | Query purpose/owner, batas metadata gambar, response asset. |
| [index.ts](src/index.ts) | Satu entry point import frontend/API. |

Tipe berasal z.infer, bukan deklarasi manual yang menyimpang.
Object schema strict; unknown keys gagal. Input jaringan diparse sebelum service.
Entity tidak dipakai sebagai create request: total/status/audit adalah milik server.
Kontrak order detail memeriksa tenant/order pada item, total agregat, serta pasangan
status/payment dan audit paid. State machine authorization/concurrency tetap tanggung
jawab service/transaction, belum diimplementasikan.

```ts
import { CreateOrdersRequestSchema, type CreateOrdersRequest } from '@kantin/shared';

const rawBody: unknown = /* input HTTP */ {};
const input: CreateOrdersRequest = CreateOrdersRequestSchema.parse(rawBody);
```

`pnpm --filter @kantin/shared build` menghasilkan ESM + declaration dist/.
Imports publik resolve dist; Turbo membangun dependency sebelum dev/typecheck app.
Jalankan `pnpm --filter @kantin/shared test` untuk tes perilaku boundary.
Schema hanya memvalidasi bentuk/invarian; kepemilikan Storage/tenant, JWT signature,
keberadaan menu dan perhitungan harga DB perlu validasi API pada fase berikutnya.

