import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CustomerSignInSchema, CustomerSignUpSchema,
  AdminOrderQuerySchema, CheckoutHeadersSchema, ConfirmPaymentRequestSchema,
  CreateOrdersRequestSchema, CreateOrdersResponseSchema, MenuSchema, MoneySchema,
  OrderAccessHeadersSchema, OrderDetailResponseSchema, OrderItemSchema, OrderSchema,
  PaginationQuerySchema, PaymentInstructionsResponseSchema, TenantSchema,
  UpdateMenuRequestSchema, UploadMetadataSchema, UserSchema,
} from '../src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const menuA = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const actorId = '55555555-5555-4555-8555-555555555555';
const now = '2026-11-12T06:00:00.000Z';
const token = 'a'.repeat(43);
const order = {
  id: orderId, order_code: 'KT-ABC123XYZ0', tenant_id: tenantA,
  customer_name: 'Rani', order_type: 'take_away', total: 20000,
  status: 'menunggu_bayar', payment_status: 'unpaid', payment_method: 'qris_static',
  payment_confirmed_by: null, payment_confirmed_at: null,
  version: 1, created_at: now, updated_at: now,
};
const item = {
  id: actorId, order_id: orderId, tenant_id: tenantA, menu_id: menuA,
  menu_name: 'Nasi ayam', qty: 2, unit_price: 10000, subtotal: 20000,
};
const cart = {
  customer_name: '  Rani  ', order_type: 'take_away', items: [{ menu_id: menuA, qty: 2 }],
};

test('checkout normalizes names and rejects client-owned prices and authority', () => {
  assert.equal(CreateOrdersRequestSchema.parse(cart).customer_name, 'Rani');
  for (const spoof of [{ total: 1 }, { status: 'selesai' }, { tenant_id: tenantB }, { payment_method: 'cash' }]) {
    assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, ...spoof }).success, false);
  }
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: [{ menu_id: menuA, qty: 2, unit_price: 1 }] }).success, false);
});

test('checkout accepts collection notes and a short table number only for dine-in', () => {
  const details = { table_number:' A-12 ', pickup_note:'  Meja dekat pintu  ' };
  const parsed = CreateOrdersRequestSchema.parse({...cart,...details,order_type:'dine_in'});
  assert.deepEqual([parsed.table_number,parsed.pickup_note],['A-12','Meja dekat pintu']);
  assert.equal(CreateOrdersRequestSchema.safeParse({...cart,...details}).success,false);
  assert.equal(CreateOrdersRequestSchema.safeParse({...cart,pickup_note:'Ambil di kasir'}).success,true);
  assert.equal(CreateOrdersRequestSchema.safeParse({...cart,pickup_note:'x'.repeat(201)}).success,false);
  assert.equal(CreateOrdersRequestSchema.safeParse({...cart,order_type:'dine_in',table_number:'A<12'}).success,false);
});

test('checkout rejects blank names, duplicate lines, empty/oversized carts and malformed IDs', () => {
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, customer_name: '   ' }).success, false);
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: [cart.items[0], cart.items[0]] }).success, false);
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: [] }).success, false);
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: Array.from({ length: 101 }, () => cart.items[0]) }).success, false);
  assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: [{ menu_id: 'not-a-uuid', qty: 1 }] }).success, false);
});

test('checkout rejects zero, negative, fractional, string, and excessive quantities', () => {
  for (const qty of [0, -1, 1.5, '2', 100]) {
    assert.equal(CreateOrdersRequestSchema.safeParse({ ...cart, items: [{ menu_id: menuA, qty }] }).success, false);
  }
});

test('money rejects fractions, negative, non-finite, strings, and excessive values', () => {
  assert.equal(MoneySchema.parse(15000), 15000);
  for (const value of [-1, 0.5, NaN, Infinity, '15000', 1_000_000_001]) {
    assert.equal(MoneySchema.safeParse(value).success, false);
  }
});

test('entity schemas preserve tenant and menu fields without permitting extra payload', () => {
  const tenant = {
    id: tenantA, outlet_id: tenantB, name: 'Dapur Satu', description: '',
    qris_image_url: null, qris_merchant_name: null, is_active: false, created_at: now, updated_at: now,
  };
  assert.equal(TenantSchema.safeParse(tenant).success, true);
  assert.equal(TenantSchema.safeParse({ ...tenant, service_role: 'leak' }).success, false);
  const menu = { id: menuA, tenant_id: tenantA, name: 'Nasi ayam', price: 10000,
    photo_url: null, is_available: true, is_active: true, created_at: now, updated_at: now };
  assert.equal(MenuSchema.safeParse(menu).success, true);
  assert.equal(MenuSchema.safeParse({ ...menu, price: 0 }).success, false);
});

test('menu patch cannot be empty or transfer tenant ownership', () => {
  assert.equal(UpdateMenuRequestSchema.safeParse({}).success, false);
  assert.equal(UpdateMenuRequestSchema.safeParse({ tenant_id: tenantB }).success, false);
  assert.equal(UpdateMenuRequestSchema.safeParse({ is_available: false }).success, true);
});

test('order snapshots require exact subtotal and ownership/total agreement', () => {
  assert.equal(OrderItemSchema.safeParse(item).success, true);
  assert.equal(OrderItemSchema.safeParse({ ...item, subtotal: 1 }).success, false);
  assert.equal(OrderDetailResponseSchema.safeParse({ data: order, items: [item] }).success, true);
  for (const wrong of [{ ...item, tenant_id: tenantB }, { ...item, order_id: tenantB }, { ...item, qty: 1, subtotal: 10000 }]) {
    assert.equal(OrderDetailResponseSchema.safeParse({ data: order, items: [wrong] }).success, false);
  }
  assert.equal(OrderDetailResponseSchema.safeParse({ data: { ...order, total: 40000 }, items: [item, item] }).success, false);
});

test('order state rejects false payment and missing or partial acceptance audit', () => {
  assert.equal(OrderSchema.safeParse(order).success, true);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'diproses' }).success, false);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'diproses', payment_status: 'paid' }).success, false);
  assert.equal(OrderSchema.safeParse({ ...order, payment_confirmed_by: actorId }).success, false);
  assert.equal(OrderSchema.safeParse({ ...order, payment_confirmed_by: actorId, payment_confirmed_at: now }).success, false);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'diproses', payment_status: 'paid',
    payment_confirmed_by: actorId, payment_confirmed_at: now }).success, true);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'menunggu_konfirmasi', payment_status: 'pending_confirmation' }).success, true);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'menunggu_bayar', payment_status: 'rejected' }).success, true);
  assert.equal(OrderSchema.safeParse({ ...order, status: 'dibatalkan', payment_status: 'paid',
    payment_confirmed_by: actorId, payment_confirmed_at: now }).success, false);
});

test('payment rejection requires a meaningful reason; audit cannot be client supplied', () => {
  assert.equal(ConfirmPaymentRequestSchema.safeParse({ expected_version: 1, decision: 'reject' }).success, false);
  assert.equal(ConfirmPaymentRequestSchema.safeParse({ expected_version: 1, decision: 'reject', reason: ' ' }).success, false);
  assert.equal(ConfirmPaymentRequestSchema.safeParse({ expected_version: 1, decision: 'reject', reason: 'Belum masuk' }).success, true);
  assert.equal(ConfirmPaymentRequestSchema.safeParse({ expected_version: 1, decision: 'accept', payment_confirmed_by: actorId }).success, false);
});

test('account role requires exact tenant scope', () => {
  const base = { id: actorId, email: 'admin@example.com', is_active: true, created_at: now, updated_at: now };
  assert.equal(UserSchema.safeParse({ ...base, role: 'tenant', tenant_id: null }).success, false);
  assert.equal(UserSchema.safeParse({ ...base, role: 'admin_pengelola', tenant_id: tenantA }).success, false);
  assert.equal(UserSchema.safeParse({ ...base, role: 'tenant', tenant_id: tenantA }).success, true);
  assert.equal(UserSchema.safeParse({ ...base, role: 'admin_pengelola', tenant_id: null }).success, true);
});

test('media metadata rejects SVG, oversized, empty, and fractional files', () => {
  assert.equal(UploadMetadataSchema.safeParse({ mime_type: 'image/png', size_bytes: 2 * 1024 * 1024 }).success, true);
  for (const bad of [
    { mime_type: 'image/svg+xml', size_bytes: 1 },
    { mime_type: 'image/png', size_bytes: 2 * 1024 * 1024 + 1 },
    { mime_type: 'image/png', size_bytes: 0 },
    { mime_type: 'image/png', size_bytes: 0.5 },
  ]) assert.equal(UploadMetadataSchema.safeParse(bad).success, false);
});

test('capability header and idempotency key cannot be replaced by display code', () => {
  assert.equal(OrderAccessHeadersSchema.safeParse({ order_access_token: token }).success, true);
  assert.equal(OrderAccessHeadersSchema.safeParse({ order_access_token: order.order_code }).success, false);
  assert.equal(CheckoutHeadersSchema.safeParse({ idempotency_key: actorId }).success, true);
  assert.equal(CheckoutHeadersSchema.safeParse({ idempotency_key: 'same' }).success, false);
});

test('pagination accepts only bounded integer strings and rejects unknown keys', () => {
  assert.equal(PaginationQuerySchema.parse({}).limit, 20);
  assert.equal(PaginationQuerySchema.parse({ limit: '100' }).limit, 100);
  for (const value of ['0', '101', '-1', '1.5', '1e2', '']) {
    assert.equal(PaginationQuerySchema.safeParse({ limit: value }).success, false);
  }
  assert.equal(PaginationQuerySchema.safeParse({ limit: 20 }).success, false);
  assert.equal(PaginationQuerySchema.safeParse({ role: 'admin_pengelola' }).success, false);
  assert.equal(AdminOrderQuerySchema.parse({ payment_status: 'pending_confirmation', limit: '5' }).limit, 5);
});

test('checkout response carries per-order access and merchant, with HTTPS media only', () => {
  const qris = { image_url: 'https://project.supabase.co/storage/v1/object/public/tenant-qris/a.png', merchant_name: 'Dapur Satu' };
  assert.equal(CreateOrdersResponseSchema.safeParse({ orders: [{ order, order_access_token: token, qris }] }).success, true);
  assert.equal(CreateOrdersResponseSchema.safeParse({ orders: [{ order, order_access_token: token, qris: { ...qris, image_url: 'javascript:alert(1)' } }] }).success, false);
  assert.equal(PaymentInstructionsResponseSchema.safeParse({ order_id: orderId, total: 20000, qris }).success, true);
});


test('customer signup normalizes identity without trimming passwords or accepting staff privileges', () => {
  const value = { display_name: '  Nadia Putri  ', email: ' NADIA@example.com ', password: ' correct horse ', password_confirmation: ' correct horse ' };
  const parsed = CustomerSignUpSchema.parse(value);
  assert.equal(parsed.display_name, 'Nadia Putri');
  assert.equal(parsed.email, 'nadia@example.com');
  assert.equal(parsed.password, ' correct horse ');
  assert.equal(CustomerSignUpSchema.safeParse({ ...value, role: 'admin_pengelola' }).success, false);
  assert.equal(CustomerSignUpSchema.safeParse({ ...value, tenant_id: tenantA }).success, false);
});
test('customer signup rejects mismatched confirmation, empty name and weak passwords', () => {
  const value = { display_name: 'Nadia', email: 'nadia@example.com', password: 'password123', password_confirmation: 'password123' };
  for (const change of [{ password_confirmation: 'different123' }, { display_name: ' ' }, { password: 'short', password_confirmation: 'short' }, { email: 'invalid' }]) {
    assert.equal(CustomerSignUpSchema.safeParse({ ...value, ...change }).success, false);
  }
});
test('customer signin rejects extra authority and accepts an existing nonempty password', () => {
  assert.equal(CustomerSignInSchema.parse({ email: ' NADIA@example.com ', password: 'old' }).email, 'nadia@example.com');
  assert.equal(CustomerSignInSchema.safeParse({ email: 'nadia@example.com', password: '' }).success, false);
  assert.equal(CustomerSignInSchema.safeParse({ email: 'nadia@example.com', password: 'password123', role: 'tenant' }).success, false);
});
