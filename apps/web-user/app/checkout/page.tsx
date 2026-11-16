'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NameSchema } from '@kantin/shared';
import { ArrowRight, Badge, Button, ChevronLeft, EmptyState, Field, FoodPhoto, QrCode, ShoppingBag, Store, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
import { useCustomerAuth } from '../../components/customer-auth';
import { Quantity } from '../../components/cart';
export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCustomerAuth();
  const { cart, menus, tenants, orderType, setOrderType, placeOrders } = useDemo();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lines = menus.filter((menu) => (cart[menu.id] ?? 0) > 0);
  const total = lines.reduce((sum, menu) => sum + menu.price * (cart[menu.id] ?? 0), 0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || authLoading) { setError("Masuk ke akun pelanggan sebelum checkout."); return; }
    const parsed = NameSchema.safeParse(name);
    if (!parsed.success) { setError('Isi nama pemesan, minimal 2 dan maksimal 100 karakter.'); return; }
    setBusy(true);
    try { placeOrders(parsed.data); router.push('/pesanan'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Pesanan belum dapat dibuat.'); setBusy(false); }
  }
  if (authLoading) return <p role="status">Memeriksa sesi pelanggan…</p>;
  if (!user) return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">CHECKOUT</p><h1>Masuk sebelum memesan</h1><p>Keranjang tetap tersedia saat Anda masuk atau membuat akun.</p></div><div className="auth-panel stack"><h2>Akun pelanggan</h2><p className="muted">Nama dan akun membantu mengidentifikasi pemesan. Pembayaran tetap menggunakan QRIS tenant.</p><Button asChild><Link href="/masuk">Masuk / buat akun<ArrowRight /></Link></Button><Button variant="outline" asChild><Link href="/">Kembali ke menu</Link></Button></div></section>;
  if (!lines.length) return <div className="panel"><EmptyState icon={<ShoppingBag />} title="Keranjangmu masih kosong" description="Pilih makanan atau minuman dulu, lalu lanjutkan ke checkout." action={<Button asChild><Link href="/">Lihat menu<ArrowRight /></Link></Button>} /></div>;
  return <>
    <Link href="/" className="back-link"><ChevronLeft />Kembali ke menu</Link>
    <div className="page-intro"><div><div className="eyebrow">CHECKOUT</div><h1>Periksa pesananmu</h1><p>Lengkapi nama dan pilih cara menikmati pesanan.</p></div><Badge>Checkout contoh</Badge></div>
    <form onSubmit={submit} className="checkout-grid">
      <div className="stack"><section className="panel"><div className="panel-header"><h2 className="row"><span className="step-badge">1</span>Detail pemesan</h2></div>
        <Field label="Nama pemesan" hint="Nama ini digunakan tenant saat memanggil pesanan."><input className="input" placeholder="Nama kamu" autoComplete="given-name" maxLength={100} required minLength={2} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'checkout-error' : undefined} /></Field>
        <div className="form-grid" style={{ marginTop: 'var(--s5)' }}>
          <label className="order-type-choice"><input type="radio" name="order-type" checked={orderType === 'dine_in'} onChange={() => setOrderType('dine_in')} /><UtensilsCrossed /><span>Makan di tempat<small>Nikmati di area kantin</small></span></label>
          <label className="order-type-choice"><input type="radio" name="order-type" checked={orderType === 'take_away'} onChange={() => setOrderType('take_away')} /><ShoppingBag /><span>Bawa pulang<small>Dikemas untuk dibawa</small></span></label>
        </div></section>
        <section className="panel"><div className="panel-header"><h2 className="row"><span className="step-badge">2</span>Menu pilihanmu</h2><span className="small muted">{lines.length} menu</span></div>
          <p className="row small text-action"><Store />{tenants[0]?.name}</p>
          {lines.map((item) => <div className="checkout-line" key={item.id}><FoodPhoto src={item.image} alt={item.name} /><div><h3>{item.name}</h3><p>{formatMoney(item.price)}</p><Quantity id={item.id} name={item.name} /></div><strong className="numeric">{formatMoney(item.price * (cart[item.id] ?? 0))}</strong></div>)}
        </section>
      </div>
      <aside className="cart-panel"><h2 className="section-title">Ringkasan pembayaran</h2><div className="checkout-summary" style={{ marginTop: 'var(--s4)' }}><span className="muted">Subtotal</span><span>{formatMoney(total)}</span></div>
        <div className="checkout-summary"><span className="muted">Biaya tambahan</span><span>{formatMoney(0)}</span></div><div className="checkout-summary total"><span>Total</span><span>{formatMoney(total)}</span></div>
        <div className="notice" style={{ marginBlock: 'var(--s4)' }}><QrCode /><span className="small">Pembayaran melalui QRIS tenant. Konfirmasi dilakukan manual oleh pengelola.</span></div>
        {error ? <p className="form-error" role="alert" id="checkout-error">{error}</p> : null}
        <Button type="submit" className="full" loading={busy}>Buat pesanan contoh<ArrowRight /></Button><p className="payment-caption">Pratinjau ini tidak melakukan transaksi.</p>
      </aside>
    </form>
  </>;
}
