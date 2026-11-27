import { OrderDetailResponseSchema, type ManagedMenu, type Menu, type Order, type OrderItem, type Tenant } from '@kantin/shared';

export type Category = ManagedMenu['category'];
export type DemoMenu = Menu & { category: Category; description: string; image: string; popular: boolean; spicy: boolean; stock?:number };
export type DemoTenant = Tenant & { email: string; tagline: string };
export type DemoOrder = { order: Order; items: OrderItem[]; rejectionReason?: string };
export const OUTLET_ID = '10000000-0000-4000-8000-000000000001';
export const TENANT_ID = '20000000-0000-4000-8000-000000000001';
export const ACTOR_ID = '30000000-0000-4000-8000-000000000001';
const timestamp = '2026-11-12T03:00:00.000Z';
export const DEMO_TENANTS: DemoTenant[] = [{
  id: TENANT_ID, outlet_id: OUTLET_ID, name: 'Warung Bu Sari', description: 'Masakan rumahan, teman setiap jam istirahat.',
  qris_image_url: null, qris_merchant_name: 'Warung Bu Sari', is_active: true,
  created_at: timestamp, updated_at: timestamp, email: 'busari@example.com', tagline: 'Masakan rumahan',
}];
const menu = (index: number, name: string, price: number, category: Category, image: string, description: string, popular = false, spicy = false, available = true): DemoMenu => ({
  id: '40000000-0000-4000-8000-' + String(index).padStart(12, '0'),
  tenant_id: TENANT_ID, name, price, category, photo_url: null, image: '/food/' + image + '.jpg',
  description, popular, spicy, is_available: available, is_active: true, created_at: timestamp, updated_at: timestamp,
});
export const DEMO_MENUS = [
  menu(1, 'Nasi Ayam Geprek', 18000, 'Makanan', 'ayam', 'Ayam renyah, sambal bawang, nasi hangat, dan lalapan.', true, true),
  menu(2, 'Nasi Goreng Kampung', 16000, 'Makanan', 'nasi', 'Nasi goreng bumbu rumahan dengan telur dan kerupuk.', true),
  menu(3, 'Mie Goreng Spesial', 15000, 'Makanan', 'mie', 'Mie berbumbu, sayuran segar, dan telur favoritmu.'),
  menu(4, 'Ayam Crispy', 14000, 'Makanan', 'crispy', 'Ayam goreng keemasan, gurih sampai gigitan terakhir.'),
  menu(5, 'Es Teh Lemon', 6000, 'Minuman', 'teh', 'Teh segar dengan sentuhan lemon untuk sela kuliah.'),
  menu(6, 'Es Kopi Susu', 12000, 'Minuman', 'kopi', 'Kopi susu creamy, manisnya pas.', true),
  menu(7, 'Pangsit Goreng', 10000, 'Camilan', 'camilan', 'Camilan renyah untuk berbagi dengan teman.'),
  menu(8, 'Mie Kuah Hangat', 14000, 'Makanan', 'mie', 'Semangkuk mie hangat dengan kuah gurih.', false, false, false),
];
const states: Order['status'][] = ['menunggu_konfirmasi', 'diproses', 'siap', 'menunggu_konfirmasi', 'selesai'];
export const DEMO_ADMIN_ORDERS: DemoOrder[] = states.map((status, index) => {
  const product = DEMO_MENUS[index % 4]!;
  const id = '50000000-0000-4000-8000-' + String(index + 1).padStart(12, '0');
  const paid = ['diproses', 'siap', 'selesai'].includes(status);
  const order: Order = {
    id, tenant_id: TENANT_ID, order_code: 'KT-DEMO' + String(index + 1).padStart(6, '0'),
    customer_name: ['Nadia Putri', 'Rizky Pratama', 'Dimas Arya', 'Aulia Rahma', 'Farhan Akbar'][index]!,
    order_type: index % 2 ? 'take_away' : 'dine_in', total: product.price * (index === 1 ? 2 : 1),
    status, payment_status: paid ? 'paid' : 'pending_confirmation', payment_method: 'qris_static',
    payment_confirmed_by: paid ? ACTOR_ID : null, payment_confirmed_at: paid ? timestamp : null,
    version: 1, created_at: '2026-11-12T03:' + String(45 - index * 6).padStart(2, '0') + ':00.000Z', updated_at: timestamp,
  };
  const items: OrderItem[] = [{ id: '60000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    order_id: id, tenant_id: TENANT_ID, menu_id: product.id, menu_name: product.name,
    qty: index === 1 ? 2 : 1, unit_price: product.price, subtotal: order.total }];
  OrderDetailResponseSchema.parse({ data: order, items });
  return { order, items };
});
export const STATUS_LABELS: Record<Order['status'], string> = {
  menunggu_bayar: 'Menunggu bayar', menunggu_konfirmasi: 'Perlu konfirmasi', diproses: 'Diproses',
  siap: 'Siap diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
};
export const STATUS_TONES: Record<Order['status'], 'neutral' | 'success' | 'warning' | 'danger' | 'brand'> = {
  menunggu_bayar: 'neutral', menunggu_konfirmasi: 'warning', diproses: 'brand', siap: 'success', selesai: 'success', dibatalkan: 'danger',
};

