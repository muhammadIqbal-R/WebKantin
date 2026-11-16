'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { CreateOrdersRequestSchema, OrderDetailResponseSchema, ORDER_TRANSITIONS, type Order, type Role } from '@kantin/shared';
import { ACTOR_ID, DEMO_ADMIN_ORDERS, DEMO_MENUS, DEMO_TENANTS, OUTLET_ID, type DemoMenu, type DemoOrder, type DemoTenant } from './demo-data';
export * from './demo-data';

type DemoContextValue = {
  menus: DemoMenu[]; tenants: DemoTenant[]; orders: DemoOrder[]; role: Role; setRole: (role: Role) => void;
  cart: Record<string, number>; orderType: Order['order_type']; notice: string;
  setOrderType: (type: Order['order_type']) => void;
  changeQuantity: (menuId: string, delta: number) => void;
  placeOrders: (name: string) => DemoOrder[];
  reportPaid: (id: string) => void;
  updateOrder: (id: string, action: 'accept' | 'reject' | 'ready' | 'complete', reason?: string) => void;
  saveMenu: (menu: DemoMenu) => void; addTenant: (name: string, description: string, email: string) => void;
  toggleTenant: (id: string) => void; notify: (message: string) => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({ children, surface }: { children: ReactNode; surface: 'user' | 'admin' }) {
  const [menus, setMenus] = useState(DEMO_MENUS);
  const [tenants, setTenants] = useState(DEMO_TENANTS);
  const [orders, setOrders] = useState<DemoOrder[]>(surface === 'admin' ? DEMO_ADMIN_ORDERS : []);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderType, setOrderType] = useState<Order['order_type']>('dine_in');
  const [notice, setNotice] = useState('');
  const [role, setRole] = useState<Role>('admin_pengelola');
  function notify(message: string) { setNotice(message); }
  function changeQuantity(menuId: string, delta: number) {
    const item = menus.find((entry) => entry.id === menuId);
    if (!item?.is_active || !item.is_available) return;
    setCart((current) => {
      const next = { ...current, [menuId]: Math.min(99, Math.max(0, (current[menuId] ?? 0) + delta)) };
      if (next[menuId] === 0) delete next[menuId];
      return next;
    });
  }
  function placeOrders(name: string) {
    const request = CreateOrdersRequestSchema.parse({ customer_name: name, order_type: orderType,
      items: Object.entries(cart).map(([menu_id, qty]) => ({ menu_id, qty })) });
    const products = request.items.map((line) => {
      const product = menus.find((entry) => entry.id === line.menu_id && entry.is_active && entry.is_available);
      if (!product) throw new Error('Menu berubah. Periksa kembali keranjangmu.');
      return { product, qty: line.qty };
    });
    const tenantIds = [...new Set(products.map((line) => line.product.tenant_id))];
    const created = tenantIds.map((tenantId, groupIndex): DemoOrder => {
      const tenant = tenants.find((entry) => entry.id === tenantId && entry.is_active);
      if (!tenant) throw new Error('Tenant belum dapat menerima pesanan.');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const items = products.filter((line) => line.product.tenant_id === tenantId).map(({ product, qty }) => ({
        id: crypto.randomUUID(), order_id: id, tenant_id: tenantId, menu_id: product.id,
        menu_name: product.name, qty, unit_price: product.price, subtotal: qty * product.price,
      }));
      const order: Order = {
        id, order_code: 'KT-DEMO' + String(orders.length + groupIndex + 1).padStart(6, '0'),
        tenant_id: tenantId, customer_name: request.customer_name, order_type: orderType,
        total: items.reduce((sum, item) => sum + item.subtotal, 0),
        status: 'menunggu_bayar', payment_status: 'unpaid', payment_method: 'qris_static',
        payment_confirmed_by: null, payment_confirmed_at: null, version: 1, created_at: now, updated_at: now,
      };
      OrderDetailResponseSchema.parse({ data: order, items });
      return { order, items };
    });
    setOrders((current) => [...created, ...current]); setCart({}); return created;
  }
  function reportPaid(id: string) {
    setOrders((current) => current.map((entry) => entry.order.id !== id || entry.order.status !== 'menunggu_bayar'
      ? entry : { ...entry, order: { ...entry.order, status: 'menunggu_konfirmasi', payment_status: 'pending_confirmation',
        version: entry.order.version + 1, updated_at: new Date().toISOString() } }));
    notify('Klaim pembayaran contoh dikirim. Belum ada transaksi sungguhan.');
  }
  function updateOrder(id: string, action: 'accept' | 'reject' | 'ready' | 'complete', reason?: string) {
    setOrders((current) => current.map((entry) => {
      if (entry.order.id !== id) return entry;
      const order = entry.order;
      let next: Order['status'];
      if (action === 'accept') { if (order.status !== 'menunggu_konfirmasi') return entry; next = 'diproses'; }
      else if (action === 'reject') { if (order.status !== 'menunggu_konfirmasi' || !reason?.trim()) return entry; next = 'menunggu_bayar'; }
      else if (action === 'ready') next = 'siap';
      else next = 'selesai';
      if (!(ORDER_TRANSITIONS[order.status] as readonly Order['status'][]).includes(next)) return entry;
      const now = new Date().toISOString();
      const updated: DemoOrder = { ...entry, ...(action === 'reject' ? { rejectionReason: reason ?? '' } : {}),
        order: { ...order, status: next, version: order.version + 1, updated_at: now,
          ...(action === 'accept' ? { payment_status: 'paid', payment_confirmed_by: ACTOR_ID, payment_confirmed_at: now } : {}),
          ...(action === 'reject' ? { payment_status: 'rejected', payment_confirmed_by: null, payment_confirmed_at: null } : {}),
        } };
      OrderDetailResponseSchema.parse({ data: updated.order, items: updated.items });
      return updated;
    }));
    notify(action === 'reject' ? 'Pembayaran contoh ditolak.' : action === 'accept' ? 'Pembayaran contoh diterima.' : 'Status pesanan contoh diperbarui.');
  }
  function saveMenu(menu: DemoMenu) {
    setMenus((current) => current.some((entry) => entry.id === menu.id) ? current.map((entry) => entry.id === menu.id ? menu : entry) : [...current, menu]);
    notify('Menu contoh berhasil disimpan.');
  }
  function addTenant(name: string, description: string, email: string) {
    const now = new Date().toISOString();
    setTenants((current) => [...current, { id: crypto.randomUUID(), outlet_id: OUTLET_ID, name, description, email,
      tagline: 'Tenant baru', qris_image_url: null, qris_merchant_name: null, is_active: false, created_at: now, updated_at: now }]);
    notify('Tenant contoh ditambahkan sebagai draft. QRIS dan menu perlu dilengkapi.');
  }
  function toggleTenant(id: string) {
    setTenants((current) => current.map((entry) => entry.id === id ? { ...entry, is_active: !entry.is_active } : entry));
    notify('Status tenant contoh diperbarui.');
  }
  return <DemoContext.Provider value={{ menus, tenants, orders, role, setRole, cart, orderType, notice, setOrderType, changeQuantity,
    placeOrders, reportPaid, updateOrder, saveMenu, addTenant, toggleTenant, notify }}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is required');
  return value;
}

