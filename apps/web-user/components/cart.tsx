'use client';
import Link from 'next/link';
import { ArrowRight, Badge, Button, EmptyState, FoodPhoto, Minus, Plus, QrCode, ShoppingBag, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
export function Quantity({ id, name }: { id: string; name: string }) {
  const { cart, changeQuantity } = useDemo();
  return <div className="quantity-control" aria-label={'Jumlah ' + name}>
    <button type="button" onClick={() => changeQuantity(id, -1)} aria-label={'Kurangi ' + name}><Minus /></button>
    <span className="numeric" aria-live="polite">{cart[id] ?? 0}</span>
    <button type="button" onClick={() => changeQuantity(id, 1)} disabled={(cart[id] ?? 0) >= 99} aria-label={'Tambah ' + name}><Plus /></button>
  </div>;
}
export function Cart() {
  const { cart, menus, tenants, orderType, setOrderType } = useDemo();
  const lines = menus.filter((menu) => (cart[menu.id] ?? 0) > 0);
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = lines.reduce((sum, menu) => sum + menu.price * (cart[menu.id] ?? 0), 0);
  return <aside className="cart-panel" aria-label="Ringkasan keranjang">
    <div className="cart-heading"><h2 className="row"><ShoppingBag />Pesananmu</h2><Badge>{count} item</Badge></div>
    <p className="cart-tenant">{tenants[0]?.name ?? 'Kantin Fakultas'}</p>
    <div className="segmented" aria-label="Cara menikmati pesanan">
      <button className={orderType === 'dine_in' ? 'active' : ''} aria-pressed={orderType === 'dine_in'} onClick={() => setOrderType('dine_in')}><UtensilsCrossed />Makan di tempat</button>
      <button className={orderType === 'take_away' ? 'active' : ''} aria-pressed={orderType === 'take_away'} onClick={() => setOrderType('take_away')}><ShoppingBag />Bawa pulang</button>
    </div>
    {lines.length ? <div className="cart-lines">{lines.map((menu) => <div className="cart-line" key={menu.id}>
      <FoodPhoto src={menu.image} alt={menu.name} /><div><h3>{menu.name}</h3><p>{formatMoney(menu.price)}</p><Quantity id={menu.id} name={menu.name} /></div>
    </div>)}</div> : <EmptyState icon={<ShoppingBag />} title="Keranjang kosong" description="Tambahkan menu dari daftar. Pesanan akan ditampilkan di sini." />}
    <div className="cart-total"><div className="row"><span className="muted small">Subtotal</span><span className="numeric small">{formatMoney(total)}</span></div>
      <div className="row"><span>Total pesanan</span><strong className="numeric">{formatMoney(total)}</strong></div></div>
    {count ? <Button asChild className="full"><Link href="/checkout">Lanjut checkout<ArrowRight /></Link></Button> : <Button className="full" disabled>Lanjut checkout<ArrowRight /></Button>}
    <p className="payment-caption"><QrCode />QRIS · konfirmasi pembayaran manual</p>
  </aside>;
}
