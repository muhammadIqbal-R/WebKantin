# Konvensi kontrak API · API-01

**Status:** draft · 2026-11-12. Otoritas keputusan lintas fitur: [MASTER](MASTER.md).
Endpoint fitur tetap ditetapkan pada Feature MD masing-masing.

- Base path /api; JSON snake_case, application/json untuk body JSON. Empty GET/DELETE
  tidak memiliki body. Multipart hanya endpoint upload melalui API.
- Validasi params/query/body dan subset header yang dinormalisasi dengan Zod strict.
  Raw req.body/request data selalu unknown; error input 400. Unknown keys ditolak.
- Idempotency-Key dipetakan ke idempotency_key; X-Order-Access-Token menjadi
  order_access_token; Authorization diverifikasi sebagai Bearer JWT, bukan dipercaya
  hanya karena bentuk string. Tolak duplicate security-sensitive headers.
- Sukses mengikuti schema respons endpoint: entity langsung, list {data,next_cursor},
  order detail {data,items}, checkout {orders}, me {data}, upload {asset_url}.
  201 untuk create, 200 untuk read/update/replay report paid, 204 tanpa body untuk delete.
  Endpoint tidak boleh membuat wrapper alternatif yang tidak tercantum kontrak.
- Koleksi diurutkan id ASC, keyset UUID cursor + limit default 20 maksimal 100.
  Scope/filter wajib diterapkan sebelum pagination. Cursor asing tidak boleh membuka scope.
- Semua error memakai ApiErrorSchema:
  `{error:{code,message,request_id,issues?}}`. issues hanya path/pesan aman;
  tidak menyertakan nilai rahasia atau detail SQL.
- Mapping: 400/413/415 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN;
  404 NOT_FOUND; 409 CONFLICT; 429 RATE_LIMITED; 500/503 INTERNAL_ERROR.
  429 menyertakan Retry-After. Status HTTP tetap membedakan dependency unavailable.
- Public endpoint tanpa JWT tetap menerapkan input validation, rate limit dan
  capability order bila dinyatakan. Tidak menjadikan /api/admin/* publik.
- Order/token/admin responses: Cache-Control no-store. Katalog boleh cache terkontrol
  dengan invalidasi setelah mutasi; jangan cache profil/status/token secara shared.
- Optimistic locking order melalui expected_version; API melakukan compare-and-set
  dalam transaksi. Conflict → refetch, bukan retry mutation buta.
- Header CORS mengizinkan Idempotency-Key, X-Order-Access-Token, Authorization,
  Content-Type hanya untuk origin web-user/web-admin terdaftar.
- Asset URL input hanya syntactic validation di shared. API tetap memvalidasi bahwa
  URL berasal bucket/path yang benar dan dimiliki scope yang sah; jangan remote fetch URL.

