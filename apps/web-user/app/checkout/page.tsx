'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NameSchema, PICKUP_NOTE_MAX, TABLE_NUMBER_MAX, TableNumberSchema } from '@kantin/shared';
import { ArrowRight, Badge, Button, ChevronLeft, EmptyState, Field, FoodPhoto, QrCode, ShoppingBag, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
import { useCustomerAuth } from '../../components/customer-auth';
import { Quantity } from '../../components/cart';
import {useCustomerOrders} from '../../components/customer-orders';
import { useCatalogStatus } from '../../components/live-catalog';
export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCustomerAuth();
  const { cart, menus, tenants, orderType, setOrderType, clearCart, changeQuantity } = useDemo();
  const catalog = useCatalogStatus();
  const {create}=useCustomerOrders();
  const [name, setName] = useState('');
  const [table, setTable] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lines = menus.filter((menu) => (cart[menu.id] ?? 0) > 0);
  const missing = Object.entries(cart).filter(([id]) => !lines.some(menu => menu.id === id));
  const invalid = lines.some(menu => !menu.is_available || (cart[menu.id] ?? 0) > (menu.stock ?? 99));
  const groups = tenants.map(tenant => ({ tenant, items: lines.filter(menu => menu.tenant_id === tenant.id) }))
    .filter(group => group.items.length > 0);
  const total = lines.reduce((sum, menu) => sum + menu.price * (cart[menu.id] ?? 0), 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || authLoading) { setError("Masuk ke akun pelanggan sebelum checkout."); return; }
    if (busy || missing.length || invalid || !lines.length) return;
    const parsed = NameSchema.safeParse(name);
    if (!parsed.success) { setError('Isi nama pemesan, minimal 2 dan maksimal 100 karakter.'); return; }
    const tableNumber = orderType === 'dine_in' ? table.trim() : '';
    if (tableNumber && !TableNumberSchema.safeParse(tableNumber).success) {
      setError('Nomor meja hanya boleh berisi huruf, angka, dan tanda hubung. Contoh A-12.');
      return;
    }
    const note = pickupNote.trim();
    setBusy(true);
    try {
      await create({
        customer_name:parsed.data, order_type:orderType,
        ...(tableNumber ? {table_number:tableNumber} : {}),
        ...(note ? {pickup_note:note} : {}),
        items:Object.entries(cart).map(([menu_id,qty])=>({menu_id,qty})),
      });
      clearCart();
      router.push('/pesanan');
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Pesanan belum dapat dibuat.'); setBusy(false); }
  }
  if (authLoading) return <p role="status">Memeriksa sesi pelanggan…</p>;
  if (!user) return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">CHECKOUT</p><h1>Masuk sebelum memesan</h1><p>Keranjang tetap tersedia saat Anda masuk atau membuat akun.</p></div><div className="auth-panel stack"><h2>Akun pelanggan</h2><p className="muted">Nama dan akun membantu mengidentifikasi pemesan. Pembayaran tetap menggunakan QRIS tenant.</p><Button asChild><Link href="/masuk">Masuk / buat akun<ArrowRight /></Link></Button><Button variant="outline" asChild><Link href="/">Kembali ke menu</Link></Button></div></section>;
  if (!lines.length && !missing.length) return <div className="panel"><EmptyState icon={<ShoppingBag />} title="Keranjangmu masih kosong" description="Pilih makanan atau minuman dulu, lalu lanjutkan ke checkout." action={<Button asChild><Link href="/">Pilih tenant<ArrowRight /></Link></Button>} /></div>;
  return <>
    <Link href="/" className="back-link"><ChevronLeft />Kembali ke menu</Link>
    <div className="page-intro"><div><div className="eyebrow">CHECKOUT</div><h1>Periksa pesananmu</h1><p>Lengkapi nama dan pilih cara menikmati pesanan.</p></div><Badge>QRIS tenant</Badge></div>
    <form onSubmit={submit} className="checkout-grid">
      <div className="stack"><section className="panel"><div className="panel-header"><h2 className="row"><span className="step-badge">1</span>Detail pemesan</h2></div>
        <Field label="Nama pemesan" hint="Nama ini digunakan tenant saat memanggil pesanan."><input className="input" placeholder="Nama kamu" autoComplete="given-name" maxLength={100} required minLength={2} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'checkout-error' : undefined} /></Field>
        <div className="form-grid" style={{ marginTop: 'var(--s5)' }}>
          <label className="order-type-choice"><input type="radio" name="order-type" checked={orderType === 'dine_in'} onChange={() => setOrderType('dine_in')} /><UtensilsCrossed /><span>Makan di tempat<small>Nikmati di area kantin</small></span></label>
          <label className="order-type-choice"><input type="radio" name="order-type" checked={orderType === 'take_away'} onChange={() => setOrderType('take_away')} /><ShoppingBag /><span>Bawa pulang<small>Dikemas untuk dibawa</small></span></label>
        </div>
        <div className="stack checkout-fulfillment">
          {orderType === 'dine_in' && <Field label="Nomor meja (opsional)">
            <input className="input" value={table} maxLength={TABLE_NUMBER_MAX} placeholder="Contoh A-12"
              disabled={busy} onChange={event => { setTable(event.target.value); setError(''); }} />
          </Field>}
          <Field label="Catatan untuk tenant (opsional)">
            <textarea className="textarea" rows={2} value={pickupNote} maxLength={PICKUP_NOTE_MAX}
              placeholder={orderType === 'dine_in' ? 'Contoh: meja dekat pintu' : 'Contoh: ambil di kasir'}
              disabled={busy} onChange={event => { setPickupNote(event.target.value); setError(''); }} />
          </Field>
        </div>
        </section>
        <section className="panel"><div className="panel-header"><h2 className="row"><span className="step-badge">2</span>Menu pilihanmu</h2><span className="small muted">{lines.length} menu</span></div>
          {missing.length > 0 && <div className="notice stack">
            <p>{missing.length} menu di keranjang sudah tidak ada di katalog.</p>
            <Button variant="outline" type="button" disabled={busy} onClick={() => {
              for (const [id, qty] of missing) changeQuantity(id, -qty);
              setError('');
            }}>Hapus menu yang tidak tersedia</Button>
          </div>}
          {groups.map(({ tenant, items }) => <section className="stack" key={tenant.id}>
            <h3>{tenant.name}</h3>
            {items.map(item => {
              const qty = cart[item.id] ?? 0;
              const available = item.is_available ? item.stock ?? 99 : 0;
              return <div className="checkout-line" key={item.id}>
                <FoodPhoto src={item.image} alt={item.name} />
                <div>
                  <h4>{item.name}</h4><p>{formatMoney(item.price)}</p>
                  <Quantity id={item.id} name={item.name} disabled={busy} />
                  {qty > available && <p className="form-error small">
                    {available ? 'Tersedia ' + available + ' porsi. Kurangi jumlah.' : 'Menu tidak tersedia. Kurangi hingga nol.'}
                  </p>}
                </div>
                <strong className="numeric">{formatMoney(item.price * qty)}</strong>
              </div>;
            })}
            <p className="row between"><span>Subtotal tenant</span><strong>{formatMoney(items.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0))}</strong></p>
          </section>)}
        </section>
      </div>
      <aside className="cart-panel"><h2 className="section-title">Ringkasan pembayaran</h2><div className="checkout-summary" style={{ marginTop: 'var(--s4)' }}><span className="muted">Subtotal</span><span>{formatMoney(total)}</span></div>
        <div className="checkout-summary"><span className="muted">Biaya tambahan</span><span>{formatMoney(0)}</span></div><div className="checkout-summary total"><span>Total</span><span>{formatMoney(total)}</span></div>
        <div className="notice" style={{ marginBlock: 'var(--s4)' }}><QrCode /><span className="small">Pembayaran melalui QRIS tenant. Konfirmasi dilakukan manual oleh pengelola.</span></div>
        {error ? <div className="stack"><p className="form-error" role="alert" id="checkout-error">{error}</p>
          {catalog && <Button variant="outline" type="button" onClick={catalog.retry}>Perbarui katalog dan stok</Button>}
        </div> : null}
        <Button type="submit" className="full" loading={busy} disabled={invalid || missing.length > 0 || !lines.length}>
          {groups.length > 1 ? 'Buat ' + groups.length + ' pesanan' : 'Buat pesanan'}<ArrowRight />
        </Button>
        {groups.length > 1 && <p className="payment-caption">Bayar setiap pesanan ke QRIS tenant yang bersangkutan.</p>}
      </aside>
    </form>
  </>;
}
