(() => {
'use strict';
const root=document.getElementById('design-review');
const app=root.querySelector('#application');
const device=root.querySelector('#device');
const money=n=>'Rp '+new Intl.NumberFormat('id-ID').format(n);
const svgPath={
 bag:'<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 menu:'<path d="M5 6h14M5 12h14M5 18h14"/>',
 order:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
 location:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
 user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
 grid:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
 store:'<path d="m3 8 2-5h14l2 5M4 8v13h16V8M3 8a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7"/>'
};
function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+svgPath[name]+'</svg>';}
const menus=[
 {id:1,name:'Nasi Ayam Geprek',price:18000,category:'Makanan',image:'crispy',description:'Nasi, ayam renyah & sambal bawang',available:true},
 {id:2,name:'Nasi Goreng Kampung',price:16000,category:'Makanan',image:'nasi',description:'Telur, sayuran & kerupuk',available:true},
 {id:3,name:'Mie Goreng Spesial',price:15000,category:'Makanan',image:'mie',description:'Mie goreng, sayuran & telur',available:true},
 {id:4,name:'Es Teh Lemon',price:6000,category:'Minuman',image:'teh',description:'Teh seduh & irisan lemon',available:true},
 {id:5,name:'Es Kopi Susu',price:12000,category:'Minuman',image:'kopi',description:'Kopi, susu & gula aren',available:true},
 {id:6,name:'Pangsit Goreng',price:10000,category:'Camilan',image:'camilan',description:'Pangsit renyah untuk camilan',available:false}
];
const orders=[
 {code:'001',name:'Nadia P.',menu:'Nasi Ayam Geprek',qty:1,total:18000,type:'Makan di tempat',time:'10.45',status:'pending'},
 {code:'004',name:'Aulia R.',menu:'Nasi Goreng Kampung',qty:1,total:16000,type:'Bawa pulang',time:'10.27',status:'pending'},
 {code:'002',name:'Rizky P.',menu:'Nasi Goreng Kampung',qty:2,total:32000,type:'Bawa pulang',time:'10.39',status:'cooking'},
 {code:'003',name:'Dimas A.',menu:'Mie Goreng Spesial',qty:1,total:15000,type:'Makan di tempat',time:'10.33',status:'ready'}
];
let direction='a',role='customer',size='desktop',category='Semua',query='',orderType='Makan di tempat';
const cart=new Map();
const stateNames={pending:'Perlu konfirmasi',cooking:'Diproses',ready:'Siap diambil',complete:'Selesai'};
function sum(){let total=0,count=0;for(const[id,qty]of cart){total+=menus.find(m=>m.id===id).price*qty;count+=qty;}return {total,count};}
function brand(){return '<div class="app-brand"><img src="/assets/brand/vokasi-ui-white.webp" width="400" height="168" alt="Universitas Indonesia — Sekolah Vokasi"><div class="service-name">Kantin Vokasi<small>Pesan di kantin kampus</small></div></div>';}
function nav(){return '<nav class="app-nav" aria-label="Navigasi contoh"><button class="active" data-app-nav="menu">Menu</button><button data-app-nav="order">Pesanan</button><button data-app-nav="location">Lokasi</button></nav>';}
function quantity(id,qty){return '<div class="qty" aria-label="Jumlah '+menus.find(m=>m.id===id).name+'"><button data-qty="'+id+'" data-delta="-1" aria-label="Kurangi '+menus.find(m=>m.id===id).name+'">−</button><span>'+qty+'</span><button data-qty="'+id+'" data-delta="1" aria-label="Tambah '+menus.find(m=>m.id===id).name+'">+</button></div>';}
function product(m,index){
 const qty=cart.get(m.id)||0;
 return '<article class="food-row '+(!m.available?'unavailable':'')+'"><span class="food-number">'+String(index+1).padStart(2,'0')+'</span><img src="/assets/food/'+m.image+'.jpg" alt="Ilustrasi '+m.name+'" width="160" height="180"><div class="food-info"><h3>'+m.name+'</h3><p>'+m.description+'</p><div class="food-footer"><strong class="food-price">'+money(m.price)+'</strong>'+(!m.available?'<span class="sold">Habis hari ini</span>':qty?quantity(m.id,qty):'<button class="small-add" data-qty="'+m.id+'" data-delta="1">+ Tambah</button>')+'</div></div></article>';
}
function renderProducts(){
 const filtered=menus.filter(m=>(category==='Semua'||m.category===category)&&m.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
 app.querySelector('#menu-products').innerHTML=filtered.length?filtered.map(product).join(''):'<p class="empty-result">Menu tidak ditemukan. Coba kata lain.</p>';
 app.querySelector('#menu-section-title').textContent=category==='Semua'?'Pilihan menu':category;
 app.querySelector('#menu-count').textContent=filtered.length+' menu';
 app.querySelectorAll('[data-category]').forEach(button=>{const active=button.dataset.category===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function renderCart(){
 const {total,count}=sum();
 app.querySelector('#bag-count').textContent=count;
 let content='<h2>Pesanan Anda</h2><p class="cart-sub">Warung Bu Sari</p><div class="order-mode" aria-label="Tipe pesanan">'+['Makan di tempat','Bawa pulang'].map(t=>'<button class="'+(orderType===t?'active':'')+'" data-order-type="'+t+'" aria-pressed="'+(orderType===t)+'">'+t+'</button>').join('')+'</div>';
 if(count){
  content+='<div>'+[...cart].map(([id,qty])=>{const m=menus.find(m=>m.id===id);return '<div class="cart-line"><strong>'+m.name+'</strong><span>'+money(m.price*qty)+'</span><small>'+qty+' × '+money(m.price)+'</small>'+quantity(id,qty)+'</div>';}).join('')+'</div>';
 }else content+='<div class="cart-empty"><strong>Belum ada menu dipilih</strong>Tambahkan makanan atau minuman dari daftar di sebelah.</div>';
 content+='<div class="cart-total"><span>Total</span><strong>'+money(total)+'</strong></div><button class="primary" data-checkout '+(!count?'disabled':'')+'>Periksa pesanan →</button><p class="cart-foot">Pembayaran QRIS sesuai tenant</p><div id="checkout-message"></div>';
 app.querySelector('#cart-content').innerHTML=content;
 const phone=app.querySelector('#phone-cart');phone.hidden=!count;
 phone.innerHTML='<span><b>'+count+' item</b> · '+money(total)+'</span><button data-checkout>Lihat pesanan →</button>';
}
function customer(){
 const cats=['Semua','Makanan','Minuman','Camilan'];
 return '<header class="app-header">'+brand()+nav()+'<button class="header-cart" data-bag aria-label="Lihat keranjang">'+icon('bag')+'<span id="bag-count">0</span></button></header><div class="customer-wrap"><section class="catalog"><div class="tenant-title"><img class="tenant-image" src="/assets/food/nasi.jpg" alt="" width="80" height="80"><div><p class="overline">Kantin Vokasi UI</p><h1>Warung Bu Sari</h1><p class="tenant-meta"><span class="dot"></span>Menu contoh <span>·</span> Masakan rumahan</p></div></div><div class="menu-tools"><label class="search">'+icon('search')+'<input type="search" id="menu-query" placeholder="Cari makanan atau minuman" aria-label="Cari menu"></label></div><nav class="menu-categories" aria-label="Kategori menu">'+cats.map(c=>'<button data-category="'+c+'" class="'+(category===c?'active':'')+'" aria-pressed="'+(category===c)+'">'+c+' <small>'+(c==='Semua'?menus.length:menus.filter(m=>m.category===c).length)+'</small></button>').join('')+'</nav><div class="menu-section-head"><h2 id="menu-section-title">Pilihan menu</h2><span id="menu-count">6 menu</span></div><div class="menu-products" id="menu-products"></div></section><aside class="cart" id="cart-content" aria-label="Pesanan Anda"></aside></div><div id="phone-cart" class="phone-cart" hidden></div><nav class="bottom-nav" aria-label="Navigasi HP">'+[['menu','Menu','menu'],['order','Pesanan','order'],['location','Lokasi','location'],['user','Akun','user']].map(([n,l,k])=>'<button data-app-nav="'+k+'" class="'+(k==='menu'?'active':'')+'">'+icon(n)+l+'</button>').join('')+'</nav><footer class="app-footer"><span>Kantin Vokasi UI</span><span>Foto dan data contoh untuk peninjauan desain</span></footer>';
}
function sideNav(){return [['grid','Ringkasan'],['order','Pesanan'],['menu','Menu'],['store','Tenant'],['location','Denah'],['user','Akun']].filter(([,n])=>role==='admin'||!['Tenant','Denah'].includes(n)).map(([i,n])=>'<button class="'+(n==='Pesanan'?'active':'')+'" data-workspace="'+n+'">'+icon(i)+n+'</button>').join('');}
function action(o){return o.status==='complete'?'<span class="sold">Selesai</span>':'<button class="row-action" data-order-action="'+o.code+'">'+(o.status==='pending'?'Periksa':o.status==='cooking'?'Tandai siap':'Selesai')+'</button>';}
function adminRows(){
 app.querySelector('#order-table-body').innerHTML=orders.map(o=>'<tr><td><strong>#'+o.code+'</strong><small>'+o.time+'</small></td><td><strong>'+o.name+'</strong><small>'+o.type+'</small></td><td>'+o.qty+' × '+o.menu+'</td><td><strong>'+money(o.total)+'</strong></td><td><span class="status '+o.status+'">'+stateNames[o.status]+'</span></td><td>'+action(o)+'</td></tr>').join('');
 app.querySelector('#mobile-orders').innerHTML=orders.map(o=>'<article class="mobile-order"><div class="top"><strong>#'+o.code+' · '+o.time+'</strong><span class="status '+o.status+'">'+stateNames[o.status]+'</span></div><h3>'+o.name+'</h3><p>'+o.qty+' × '+o.menu+' · '+o.type+'</p><div class="bottom"><strong>'+money(o.total)+'</strong>'+action(o)+'</div></article>').join('');
 app.querySelector('#pending-count').textContent=String(orders.filter(o=>o.status==='pending').length).padStart(2,'0');
 app.querySelector('#cooking-count').textContent=String(orders.filter(o=>o.status==='cooking').length).padStart(2,'0');
 app.querySelector('#ready-count').textContent=String(orders.filter(o=>o.status==='ready').length).padStart(2,'0');
}
function admin(){
 const tenant=role==='tenant';
 return '<div class="admin-shell"><aside class="admin-side"><img src="/assets/brand/vokasi-ui-white.webp" alt="Universitas Indonesia — Sekolah Vokasi" width="400" height="168"><p class="workspace-name">Kantin Vokasi<small>'+(tenant?'Warung Bu Sari':'Pengelolaan kantin')+'</small></p><nav class="side-nav" aria-label="Menu pengelola">'+sideNav()+'</nav><p class="side-bottom">Ruang kerja<b>'+(tenant?'Warung Bu Sari':'Admin pengelola')+'</b>Data ilustrasi</p></aside><div class="admin-content"><header class="admin-top"><span class="admin-crumb">Kantin Vokasi UI <span> / </span><strong>Pesanan</strong></span><div class="admin-mobile-brand"><img src="/assets/brand/vokasi-ui-white.webp" alt="Vokasi UI" width="400" height="168"><span>Kantin Vokasi</span></div><span class="role-badge">'+(tenant?'Tenant · Bu Sari':'Admin pengelola')+'</span></header><nav class="admin-paper-nav"><span>Ringkasan</span><span class="active">Pesanan</span><span>Menu</span><span>'+(tenant?'Pembayaran':'Tenant')+'</span><span>Akun</span></nav><main class="admin-main"><div class="admin-heading"><div><h1>'+(tenant?'Pesanan tenant':'Pesanan hari ini')+'</h1><p>'+(tenant?'Warung Bu Sari · Data contoh':'Seluruh tenant · Kantin Vokasi UI')+'</p></div><button class="outline" data-workspace="Laporan">Lihat riwayat →</button></div><div class="stats-line"><div><strong id="pending-count">02</strong><span>Perlu konfirmasi</span></div><div><strong id="cooking-count">01</strong><span>Sedang diproses</span></div><div><strong id="ready-count">01</strong><span>Siap diambil</span></div></div><section class="work-panel"><div class="work-title"><h2>Antrean pesanan</h2><small>QRIS · konfirmasi manual</small></div><div class="table-scroller"><table><thead><tr><th>Pesanan</th><th>Pemesan</th><th>Menu</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="order-table-body"></tbody></table></div><div class="admin-mobile-orders" id="mobile-orders"></div><div class="queue-foot"><span>4 pesanan contoh</span><span>Perubahan hanya pada contoh desain</span></div></section><div class="secondary-line"><section class="note-panel"><h3>'+(tenant?'Ketersediaan menu':'Tenant yang beroperasi')+'</h3><p>'+(tenant?'5 tersedia · 1 habis. Perbarui sebelum menerima pesanan baru.':'Warung Bu Sari · 6 menu pada contoh tampilan ini.')+'</p><a href="#" data-workspace="Menu">'+(tenant?'Kelola menu':'Lihat tenant')+' →</a></section><section class="note-panel"><h3>Konfirmasi pembayaran</h3><p>Periksa nominal dan merchant QRIS sebelum melanjutkan pesanan.</p></section></div><p id="workspace-message" class="prototype-message" hidden></p></main></div></div>';
}
function render(){
 app.className='application '+direction;app.innerHTML=role==='customer'?customer():admin();
 if(role==='customer'){renderProducts();renderCart();app.querySelector('#menu-query').value=query;}else adminRows();
}
root.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>{
 direction=button.dataset.direction;root.querySelectorAll('[data-direction]').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button));});
 root.querySelector('#direction-caption').textContent=direction==='a'?'A / Menu praktis':'B / Menu kedai';render();
}));
root.querySelectorAll('[data-role]').forEach(button=>button.addEventListener('click',()=>{
 role=button.dataset.role;root.querySelectorAll('[data-role]').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button));});render();
}));
root.querySelectorAll('[data-device]').forEach(button=>button.addEventListener('click',()=>{
 size=button.dataset.device;device.className='device '+size;root.querySelectorAll('[data-device]').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button));});
 root.querySelector('#device-caption').textContent=size==='phone'?'HP · lebar contoh 390 px':'Desktop · responsif saat layar diperkecil';
}));
app.addEventListener('input',event=>{if(event.target.id==='menu-query'){query=event.target.value;renderProducts();}});
app.addEventListener('click',event=>{
 const button=event.target.closest('button,a');if(!button)return;
 if(button.dataset.category){category=button.dataset.category;renderProducts();}
 if(button.dataset.qty){
  const id=Number(button.dataset.qty),m=menus.find(m=>m.id===id);if(!m?.available)return;
  const qty=Math.min(99,Math.max(0,(cart.get(id)||0)+Number(button.dataset.delta)));
  if(qty)cart.set(id,qty);else cart.delete(id);renderProducts();renderCart();
 }
 if(button.dataset.orderType){orderType=button.dataset.orderType;renderCart();}
 if(button.hasAttribute('data-checkout')){
  const msg=app.querySelector('#checkout-message');
  if(msg)msg.innerHTML='<p class="prototype-message">Contoh checkout · '+sum().count+' item · '+money(sum().total)+'.</p>';
  button.textContent='Contoh checkout ✓';
 }
 if(button.dataset.orderAction){
  const o=orders.find(o=>o.code===button.dataset.orderAction);if(!o)return;
  o.status=o.status==='pending'?'cooking':o.status==='cooking'?'ready':'complete';adminRows();
 }
 if(button.dataset.workspace){
  event.preventDefault();const msg=app.querySelector('#workspace-message');if(msg){msg.hidden=false;msg.textContent='Contoh ruang '+button.dataset.workspace.toLowerCase()+'. Detail akan mengikuti arah desain yang dipilih.';}
 }
 if(button.dataset.appNav&&button.dataset.appNav!=='menu'){button.textContent='Contoh '+button.textContent.trim();button.disabled=true;}
});
render();
})();
