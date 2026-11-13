(()=>{
const C=window.ADMIN_CFG,$=(s,r=document)=>r.querySelector(s),root=$('#root');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RP=n=>'Rp '+Math.round(+n||0).toLocaleString('id-ID');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2600)};
if(!C.url||!C.anonKey){root.innerHTML='<div class="auth"><div class="card"><h1>Belum dikonfigurasi</h1><p>Isi <b>url</b> dan <b>anonKey</b> di <code>assets/config.js</code>, lalu unggah ulang.</p></div></div>';return}
const sb=supabase.createClient(C.url,C.anonKey);
const STAGES={
 fisik:[['diterima','Pesanan diterima'],['draf','Draf'],['revisi','Revisi'],['cetak','Cetak'],['dikirim','Dikirim'],['selesai','Selesai']],
 umkm:[['diterima','Pesanan diterima'],['draf','Draf'],['revisi','Revisi'],['cetak','Cetak'],['dikirim','Dikirim'],['selesai','Selesai']],
 web:[['diterima','Pesanan diterima'],['draf','Draf'],['revisi','Revisi'],['pembuatan','Pembuatan'],['aktif','Link aktif'],['selesai','Selesai']],
 video:[['diterima','Pesanan diterima'],['draf','Storyboard/draf'],['revisi','Revisi'],['render','Rendering'],['siap','Siap diunduh'],['selesai','Selesai']]};
const TYPES={fisik:'Undangan fisik / cetak',umkm:'Paket UMKM',web:'Undangan web',video:'Video reels'};
const stageName=(t,s)=>(STAGES[t]||[]).find(x=>x[0]===s)?.[1]||s;
const rcode=()=>{const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='RC-';const r=crypto.getRandomValues(new Uint8Array(6));r.forEach(v=>s+=a[v%a.length]);return s};
let S={view:'dashboard',orders:[],products:[],cats:[],reviews:[],expenses:[],settings:{},payments:[],clicks:[],bill:null,gallery:[],versions:[]};

/* ---------- AUTH ---------- */
function authShell(inner){root.innerHTML=`<div class="auth"><div class="card"><div class="brand"><img src="assets/logo.svg" alt="">Rumah Cetak</div>${inner}</div></div>`}
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return loginView();
  const {data:a}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.nextLevel==='aal2'&&a.currentLevel!=='aal2')return mfaVerifyView();
  if(a.nextLevel==='aal1')return mfaEnrollView();
  const {data:adm}=await sb.from('admins').select('user_id').maybeSingle();
  if(!adm){authShell(`<h1>Akses ditolak</h1><p>Akun <b>${esc(session.user.email)}</b> belum terdaftar sebagai admin, atau aturan akses tabel admins belum dipasang. Lihat bagian Troubleshooting di PANDUAN-ADMIN.md.</p><button class="btn sec" id="lo">Keluar</button>`);$('#lo').onclick=logout;return}
  await loadAll();shell();
}
function loginView(){
  authShell(`<h1>Panel Admin</h1><p>Masuk untuk mengelola pesanan dan produk.</p>
  <form id="f"><label for="e">Email</label><input id="e" type="email" autocomplete="username" required>
  <label for="p">Kata sandi</label><input id="p" type="password" autocomplete="current-password" required>
  <div class="err" id="er"></div><button class="btn" style="width:100%;justify-content:center;margin-top:.5rem">Masuk</button></form>`);
  $('#f').onsubmit=async e=>{e.preventDefault();$('#er').textContent='';
    const {error}=await sb.auth.signInWithPassword({email:$('#e').value.trim(),password:$('#p').value});
    if(error)$('#er').textContent='Email atau kata sandi salah.';else boot()}
}
async function mfaEnrollView(){
  const lf=await sb.auth.mfa.listFactors();for(const x of (lf.data?.all||[]))if(x.factor_type==='totp'&&x.status==='unverified')await sb.auth.mfa.unenroll({factorId:x.id});
  const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Admin '+Date.now()});
  if(error){authShell(`<h1>Gagal</h1><div class="err">${esc(error.message)}</div>`);return}
  authShell(`<h1>Aktifkan verifikasi 2 langkah</h1><p>Pindai kode ini dengan Google Authenticator, Authy, atau aplikasi sejenis, lalu masukkan 6 angka.</p>
  <div class="qr"><img alt="Kode QR" src="${esc(data.totp.qr_code)}"></div>
  <p style="font-size:12px;word-break:break-all">Atau ketik manual: <b>${esc(data.totp.secret)}</b></p>
  <form id="f"><label for="c">Kode 6 angka</label><input id="c" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required>
  <div class="err" id="er"></div><button class="btn" style="width:100%;justify-content:center;margin-top:.5rem">Aktifkan</button></form>`);
  $('#f').onsubmit=async e=>{e.preventDefault();
    const ch=await sb.auth.mfa.challenge({factorId:data.id});
    const v=await sb.auth.mfa.verify({factorId:data.id,challengeId:ch.data.id,code:$('#c').value.trim()});
    if(v.error)$('#er').textContent='Kode salah, coba lagi.';else boot()}
}
async function mfaVerifyView(){
  const {data:f}=await sb.auth.mfa.listFactors();const fac=f.totp.find(x=>x.status==='verified');
  if(!fac){return mfaEnrollView()}
  authShell(`<h1>Verifikasi 2 langkah</h1><p>Masukkan kode 6 angka dari aplikasi authenticator Anda.</p>
  <form id="f"><label for="c">Kode</label><input id="c" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required autofocus>
  <div class="err" id="er"></div><button class="btn" style="width:100%;justify-content:center;margin-top:.5rem">Verifikasi</button></form>
  <p style="margin-top:.8rem"><a href="#" id="lo">Keluar</a></p>`);
  $('#lo').onclick=e=>{e.preventDefault();logout()};
  $('#f').onsubmit=async e=>{e.preventDefault();
    const ch=await sb.auth.mfa.challenge({factorId:fac.id});
    const v=await sb.auth.mfa.verify({factorId:fac.id,challengeId:ch.data.id,code:$('#c').value.trim()});
    if(v.error)$('#er').textContent='Kode salah, coba lagi.';else boot()}
}
async function logout(){await sb.auth.signOut();location.hash='';boot()}

/* ---------- DATA ---------- */
const DEFB={name:'Rumah Cetak',tagline:'Cetak rapi, undangan berkesan.',address:'',wa:'',email:'',ig:'',banks:[],note:'Terima kasih telah mempercayakan pesanan Anda kepada Rumah Cetak.'};
const biz=()=>({...DEFB,...(S.settings.biz||{})});
async function loadAll(){
  const q=(t,o)=>{let r=sb.from(t).select('*');if(o)r=r.order(o[0],{ascending:!!o[1]});return r};
  const [o,p,c,r,ex,st,pay,ck,gl,vr]=await Promise.all([q('orders',['created_at',0]),
    sb.from('products').select('*').order('cat').order('sort').order('id'),q('categories',['sort',1]),q('reviews',['created_at',0]),
    q('expenses',['date',0]),q('settings'),q('payments',['date',1]),sb.from('product_clicks').select('product,day').gte('day',iso(addD(new Date(),-30))),q('gallery_items',['sort',1]),sb.from('site_versions').select('id,label,value,created_at').order('created_at',{ascending:false}).limit(20)]);
  const bad=[o,p,c,r].find(x=>x.error);if(bad)toast('Gagal memuat: '+bad.error.message);
  S.orders=o.data||[];S.products=p.data||[];S.cats=c.data||[];S.reviews=r.data||[];
  S.expenses=ex.error?[]:(ex.data||[]);S.settings={};(st.data||[]).forEach(x=>S.settings[x.key]=x.value);S.t2=!ex.error&&!st.error;
  S.payments=pay.error?[]:(pay.data||[]);S.t3=!pay.error;S.clicks=ck.error?[]:(ck.data||[]);S.gallery=gl.error?[]:(gl.data||[]);S.t4=!gl.error&&!vr.error;S.versions=vr.error?[]:(vr.data||[]);
}
const paidOf=o=>S.t3?S.payments.filter(p=>p.order_id===o.id).reduce((s,p)=>s+(+p.amount||0),0):(+o.dp||0);
const sisaOf=o=>Math.max(0,(+o.price||0)-paidOf(o));
const payState=o=>{const pd=paidOf(o),pr=+o.price||0;if(pr<=0)return['nol','Harga belum diisi',''];if(pd>=pr)return['lunas','Lunas','ok'];if(pd>0)return['sebagian','Belum lunas','w'];return['belum','Belum bayar','bad']};
const umur=o=>Math.max(0,Math.floor((Date.now()-new Date(o.stage==='selesai'?(o.done_at||o.updated_at||o.created_at):o.created_at))/864e5));
function prodStats(){
  const sold={},views={};
  S.orders.filter(o=>o.stage==='selesai'&&o.product).forEach(o=>{const k=o.product.toLowerCase();sold[k]=(sold[k]||0)+1});
  S.clicks.forEach(c=>{const k=String(c.product).toLowerCase();views[k]=(views[k]||0)+1});
  const top=(m,ex)=>new Set(Object.entries(m).filter(x=>x[1]>0&&!(ex&&ex.has(x[0]))).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]));
  const best=top(sold),pop=top(views,best),lim=addD(new Date(),-30).toISOString();
  return {sold,views,best,pop,isNew:p=>!!p.created_at&&p.created_at>=lim}}

/* ---------- SHELL ---------- */
const IC={dash:'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',orders:'M9 4h6l1 2h3v14H5V6h3zM9 11h6M9 15h6',chev:'M6 9l6 6 6-6',box:'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',money:'M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.6 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3',tag:'M4 4h9l7 7-9 9-7-7zM8.5 8.5h.01',star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',editor:'M4 5h16v11H4zM8 20h8M12 16v4',gallery:'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M9 9.5h.01',gear:'M15 12a3 3 0 11-6 0 3 3 0 016 0zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',logout:'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',bell:'M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',ext:'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',menu:'M4 6h16M4 12h16M4 18h16'};
const ic=(n,c)=>`<svg class="ic${c?' '+c:''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]}"/></svg>`;
const NAV=[{k:'dashboard',t:'Dashboard',i:'dash'},{k:'orders',t:'Pesanan',i:'orders',sub:[['orders','Semua Pesanan'],['billing','Tagihan & Invoice']]},{k:'products',t:'Katalog Produk',i:'box'},{k:'finance',t:'Rekap Keuangan',i:'money'},{k:'promo',t:'Promo & Paket',i:'tag'},{k:'reviews',t:'Ulasan',i:'star'},{k:'editor',t:'Editor Website',i:'editor'},{k:'gallery',t:'Galeri Portofolio',i:'gallery'},{k:'settings',t:'Pengaturan',i:'gear'}];
const TITLES={dashboard:'Dashboard',orders:'Semua Pesanan',billing:'Tagihan & Invoice',products:'Katalog Produk',finance:'Rekap Keuangan',promo:'Promo & Paket',reviews:'Ulasan',editor:'Editor Website',gallery:'Galeri Portofolio',settings:'Pengaturan'};
const VIEWS={dashboard:()=>vDash(),orders:()=>vOrders(),billing:()=>vBilling(),products:()=>vProducts(),finance:()=>vFinance(),promo:()=>vPromo(),reviews:()=>vReviews(),editor:()=>vEditor(),gallery:()=>vGallery(),settings:()=>vSettings()};
const pending=()=>S.reviews.filter(r=>r.status==='menunggu').length;
function notes(){const t=iso(new Date()),n=[],act=S.orders.filter(o=>o.stage!=='selesai');
  const late=act.filter(o=>o.deadline&&o.deadline<t),soon=act.filter(o=>o.deadline&&o.deadline>=t&&o.deadline<=iso(addD(new Date(),2)));
  if(late.length)n.push(['bad',late.length+' pesanan lewat tenggat','#orders']);
  if(soon.length)n.push(['w',soon.length+' pesanan jatuh tempo dalam 2 hari','#orders']);
  const bills=S.orders.filter(o=>o.stage==='selesai'&&sisaOf(o)>0);if(bills.length)n.push(['bad',bills.length+' pesanan selesai belum lunas','#billing']);
  if(pending())n.push(['w',pending()+' ulasan menunggu persetujuan','#reviews']);return n}
function refreshNotes(){const n=notes();$('#bdot').textContent=n.length;$('#bdot').classList.toggle('hide',!n.length);
  $('#bmenu').innerHTML=n.length?n.map(x=>`<a href="${x[2]}"><i class="${x[0]}"></i>${esc(x[1])}</a>`).join(''):'<p>Tidak ada notifikasi.</p>'}
function shell(){
  let host='web utama';try{host=new URL(C.siteUrl).host}catch(e){}
  root.innerHTML=`<div class="app"><aside class="side" id="side"><div class="sbrand"><img src="assets/logo.svg" alt=""><div><b>Rumah Cetak</b><small>Seller Center</small></div></div>
  ${NAV.map(n=>n.sub?`<button class="nv" data-g="${n.k}">${ic(n.i)}<span>${n.t}</span>${ic('chev','ch')}</button><div class="subn" id="sub-${n.k}">${n.sub.map(s=>`<a href="#${s[0]}" data-v="${s[0]}">${s[1]}</a>`).join('')}</div>`:n.soon?`<span class="nv soon" aria-disabled="true">${ic(n.i)}<span>${n.t}</span><span class="soonp">Segera</span></span>`:`<a class="nv" href="#${n.k}" data-v="${n.k}">${ic(n.i)}<span>${n.t}</span>${n.k==='reviews'&&pending()?`<span class="badge">${pending()}</span>`:''}</a>`).join('')}
  <div class="sp"></div><button class="nv" id="out">${ic('logout')}<span>Log Out</span></button></aside>
  <div class="col"><header class="topbar"><button class="burger" id="bg" aria-label="Menu">${ic('menu')}</button><div class="tt">Seller Center</div><span class="sp"></span>
  <div class="adm"><span class="av">A</span><span><b>Admin</b><small>Aktif</small></span></div>
  <div class="bellw"><button class="iconbtn" id="bell" aria-label="Notifikasi">${ic('bell')}<span class="dot" id="bdot"></span></button><div class="bmenu hide" id="bmenu"></div></div>
  <a class="btn y vw" href="${esc(C.siteUrl)}" target="_blank" rel="noopener">${ic('ext')}<span class="vt">Lihat Web Utama <small>(${esc(host)})</small></span></a></header>
  <main class="main"><div class="top"><h2 id="ttl"></h2><span id="topact"></span></div><div id="view"></div></main></div></div>`;
  $('#out').onclick=logout;$('#bg').onclick=()=>$('#side').classList.toggle('open');
  $('#side').addEventListener('click',e=>{if(e.target.closest('a[data-v]'))$('#side').classList.remove('open');const g=e.target.closest('[data-g]');if(g){g.classList.toggle('open');$('#sub-'+g.dataset.g).classList.toggle('open')}});
  $('#bell').onclick=e=>{e.stopPropagation();$('#bmenu').classList.toggle('hide')};
  document.addEventListener('click',e=>{const b=$('#bmenu');if(b&&!e.target.closest('.bellw'))b.classList.add('hide')});
  route();
}
window.addEventListener('hashchange',()=>{if($('#view'))route()});
function route(){
  const v=(location.hash||'#dashboard').slice(1);S.view=VIEWS[v]?v:'dashboard';
  document.querySelectorAll('[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===S.view));
  const og=['orders','billing'].includes(S.view);document.querySelectorAll('[data-g]').forEach(b=>{b.classList.toggle('open',og);b.classList.toggle('on',og)});$('#sub-orders').classList.toggle('open',og);
  $('#ttl').textContent=TITLES[S.view];$('#topact').innerHTML='';$('#bmenu').classList.add('hide');refreshNotes();VIEWS[S.view]();
}
function modal(html){const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="box" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('mousedown',e=>{if(e.target===m)m.remove()});document.body.append(m);return m}

/* ---------- DASHBOARD ---------- */
function vDash(){
  const now=new Date(),y=now.getFullYear(),ym=iso(now).slice(0,7),pm=iso(new Date(y,now.getMonth()-1,1)).slice(0,7);
  const mon=s=>{const [yy,mm]=s.split('-').map(Number);return calcFin({a:s+'-01',b:iso(new Date(yy,mm,0)),label:s})};
  const F=mon(ym),P=mon(pm),Y=calcFin({a:y+'-01-01',b:y+'-12-31',label:'Tahun '+y});
  const chg=(c,p)=>p?`<span class="${c>=p?'up':'dn'}">${c>=p?'▲':'▼'} ${Math.abs((c-p)/Math.abs(p)*100).toFixed(0)}%</span> vs bulan lalu`:'belum ada pembanding';
  const baru=S.orders.filter(o=>(o.created_at||'').slice(0,7)===ym).length,act=S.orders.filter(o=>o.stage!=='selesai');
  const piut=S.orders.reduce((s,o)=>s+sisaOf(o),0),np=S.orders.filter(o=>sisaOf(o)>0).length;
  const q=[...act].sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999')).slice(0,6),ps=S.products.slice(0,6);
  $('#topact').innerHTML='<button class="btn" id="addo">+ Pesanan</button>';$('#addo').onclick=()=>orderForm();
  $('#view').innerHTML=`<div class="grid5">
   <div class="card stat dk"><small>Total omzet bulan ini</small><b>${RP(F.omzet)}</b><em>${chg(F.omzet,P.omzet)}</em></div>
   <div class="card stat dk"><small>Laba bersih</small><b style="color:${F.bersih<0?'#ff9d98':'inherit'}">${RP(F.bersih)}</b><em>margin ${F.margin.toFixed(0)}%</em></div>
   <div class="card stat dk"><small>Pesanan baru</small><b>${baru}</b><em>dibuat bulan ini</em></div>
   <div class="card stat dk"><small>Pesanan berjalan</small><b>${act.length}</b><em>belum selesai</em></div>
   <div class="card stat"><small>Tagihan belum lunas</small><b>${RP(piut)}</b><em>${np} pesanan · <a href="#billing">lihat</a></em></div></div>
  <div class="gridm"><div class="card"><h3 style="margin-bottom:.5rem">Grafik Keuangan ${y} (Cash Flow)</h3>${chartSVG(Y)}</div>
   <div class="card"><h3 style="margin-bottom:.5rem">Antrean Pesanan Aktif</h3>${q.length?`<div class="wrap"><table class="tbl"><thead><tr><th>Pesanan</th><th>Status</th><th>Tenggat</th></tr></thead><tbody>${q.map(o=>`<tr><td><b>${esc(o.client_name)||esc(o.code)}</b><br><small>${esc(o.product)||'-'}</small></td><td><span class="pill">${esc(stageName(o.type,o.stage))}</span></td><td>${dl(o)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pesanan berjalan.</div>'}</div></div>
  <div class="gridm"><div class="card"><div class="top" style="margin:0 0 .4rem"><h3 style="flex:1">Katalog Produk</h3><a class="btn sm sec" href="#products">Kelola katalog</a></div>${ps.length?ps.map(p=>`<div class="plist">${p.img?`<img class="thumb" src="${esc(p.img)}" alt="">`:'<span class="thumb"></span>'}<div class="nm"><b>${esc(p.name)}</b><br><small>${esc((S.cats.find(c=>c.id===p.cat)||{}).name||p.cat)}</small></div><label class="sw"><input type="checkbox" data-t="${p.id}" ${p.active?'checked':''} style="width:auto;min-height:0"> Aktif</label></div>`).join(''):'<div class="empty">Belum ada produk.</div>'}</div>
   <div class="card"><h3 style="margin-bottom:.6rem">Sekilas Tampilan Web</h3><div class="peek" id="peek"><iframe src="${esc(C.siteUrl)}" title="Pratinjau web utama" loading="lazy" tabindex="-1"></iframe></div>
   <div class="tools" style="margin:.7rem 0 0"><a class="btn sm sec" href="#promo">Banner Promo</a><a class="btn sm sec" href="#settings">Nomor WhatsApp</a><a class="btn sm sec" href="#editor">Editor Website</a><a class="btn sm sec" href="#gallery">Galeri</a></div></div></div>`;
  $('#view').querySelectorAll('[data-t]').forEach(b=>b.onchange=async()=>{const {error}=await sb.from('products').update({active:b.checked}).eq('id',b.dataset.t);error?toast(error.message):(await loadAll(),toast('Tersimpan'))});
  const pk=$('#peek'),fit=()=>{const f=pk&&pk.querySelector('iframe');if(f)f.style.transform='scale('+(pk.clientWidth/1280)+')'};fit();addEventListener('resize',fit);
}
function dl(o){if(!o.deadline)return '-';const d=Math.ceil((new Date(o.deadline)-new Date(new Date().toDateString()))/864e5);
  const c=d<0?'bad':d<=2?'w':'';return `<span class="pill ${c}">${o.deadline}${d<0?' (lewat)':d===0?' (hari ini)':''}</span>`}

/* ---------- ORDERS ---------- */
function vOrders(){
  $('#topact').innerHTML='<button class="btn" id="add">+ Pesanan</button>';$('#add').onclick=()=>orderForm();
  $('#view').innerHTML=`<div class="tools"><input id="q" placeholder="Cari kode, nama, produk…" aria-label="Cari"><select id="fs" aria-label="Filter"><option value="">Semua tahap</option><option value="aktif">Berjalan</option><option value="selesai">Selesai</option></select></div><div class="card"><div class="wrap" id="tb"></div></div>`;
  const draw=()=>{const q=$('#q').value.toLowerCase(),f=$('#fs').value;
    const rows=S.orders.filter(o=>(!f||(f==='selesai'?o.stage==='selesai':o.stage!=='selesai'))&&(o.code+o.client_name+o.product).toLowerCase().includes(q));
    $('#tb').innerHTML=rows.length?`<table class="tbl cards"><thead><tr><th>Kode</th><th>Klien</th><th>Produk</th><th>Total</th><th>Pembayaran</th><th>Tahap</th><th>Tenggat</th><th></th></tr></thead><tbody>${rows.map(o=>{const st=payState(o);return `<tr><td data-l="Kode"><b>${esc(o.code)}</b></td><td data-l="Klien">${esc(o.client_name)||'-'}</td><td data-l="Produk">${esc(o.product)||'-'} ${o.qty?`<small>×${o.qty}</small>`:''}</td><td data-l="Total">${RP(o.price)}</td><td data-l="Pembayaran"><span class="pill ${st[2]}">${st[1]}</span>${st[0]==='sebagian'?`<br><small>sisa ${RP(sisaOf(o))}</small>`:''}</td><td data-l="Tahap"><span class="pill ${o.stage==='selesai'?'ok':''}">${esc(stageName(o.type,o.stage))}</span></td><td data-l="Tenggat">${dl(o)}</td><td style="white-space:nowrap"><button class="btn sm sec" data-e="${o.id}">Ubah</button> <button class="btn sm sec" data-i="${o.id}">Invoice</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">Tidak ada pesanan.</div>';
    $('#tb').querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>orderForm(S.orders.find(o=>o.id==b.dataset.e)));
    $('#tb').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>invModal(+b.dataset.i))};
  $('#q').oninput=draw;$('#fs').onchange=draw;draw();
}
const PAYM=['Transfer','Tunai','QRIS','E-wallet','Lainnya'];
const CAT2TYPE={'undangan-web':'web','undangan-video':'video','undangan-fisik':'fisik','umkm':'umkm'};
function orderForm(o){
  const n=!o;o=o||{code:rcode(),type:'fisik',stage:'diterima',qty:1,price:0,cost:0};
  const act=S.products.filter(p=>p.active||p.id===o.product_id);
  const matched=act.find(p=>p.id===o.product_id)||act.find(p=>o.product&&p.name.toLowerCase()===o.product.toLowerCase()),other=!!o.product&&!matched;
  const opts=S.cats.map(c=>{const ps=act.filter(p=>p.cat===c.id);return ps.length?`<optgroup label="${esc(c.name)}">${ps.map(p=>`<option value="${p.id}" ${matched&&matched.id===p.id?'selected':''}>${esc(p.name)}${p.title&&p.title!==p.name?' – '+esc(p.title):''}</option>`).join('')}</optgroup>`:''}).join('');
  const st=payState(o);
  const m=modal(`<h3>${n?'Pesanan baru':'Ubah pesanan'}</h3><form id="f">
  <div class="row2"><div><label for="code">Kode lacak (acak, bisa diganti)</label><input id="code" value="${esc(o.code)}" required pattern="[A-Za-z0-9\\-]{6,20}"></div>
  <div><label for="type">Jenis</label><select id="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${o.type===k?'selected':''}>${v}</option>`).join('')}</select></div></div>
  <div class="row2"><div><label for="nm">Nama klien (tampil di ulasan)</label><input id="nm" value="${esc(o.client_name)}"></div><div><label for="wa">No. WhatsApp klien (privat)</label><input id="wa" inputmode="tel" value="${esc(o.client_wa)}" placeholder="62812…"></div></div>
  <div class="row2"><div><label for="ps">Produk</label><select id="ps"><option value="">— Pilih produk —</option>${opts}<option value="__o" ${other?'selected':''}>Lainnya (ketik sendiri)</option></select></div><div><label for="qty">Jumlah</label><input id="qty" type="number" min="1" value="${o.qty||1}"></div></div>
  <div id="pxw" class="${other?'':'hide'}"><label for="pname">Nama produk</label><input id="pname" value="${esc(other?o.product:'')}"></div>
  <div class="row3"><div><label for="price">Harga total (Rp)</label><input id="price" type="number" min="0" value="${o.price||0}"></div><div><label for="cost">Modal (Rp)</label><input id="cost" type="number" min="0" value="${o.cost||0}"></div>
  ${n?`<div><label for="dpa">DP dibayar (Rp)</label><input id="dpa" type="number" min="0" value="0"></div>`:`<div><label>Pembayaran</label><button type="button" class="btn sec" id="mp" style="width:100%;justify-content:center">${st[1]} · sisa ${RP(sisaOf(o))}</button></div>`}</div>
  ${n?`<div id="dpm-w" class="hide"><label for="dpm">Metode DP</label><select id="dpm">${PAYM.map(x=>`<option>${x}</option>`).join('')}</select></div>`:''}
  <div class="row2"><div><label for="stage">Tahap</label><select id="stage"></select></div><div><label for="dead">Tenggat</label><input id="dead" type="date" value="${o.deadline||''}"></div></div>
  <div id="ext"></div>
  <label for="note">Catatan untuk klien (tampil di halaman lacak)</label><textarea id="note" rows="2" maxlength="300">${esc(o.note)}</textarea>
  <label for="su">Tampil di halaman lacak sampai (kosong = selalu)</label><input id="su" type="date" value="${o.show_until||''}">
  <div class="err" id="er"></div>
  <div class="acts">${n?'':'<button type="button" class="btn sec" id="cp">Salin pesan WhatsApp</button><button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  const fillStage=()=>{const t=$('#type',m).value;$('#stage',m).innerHTML=STAGES[t].map(s=>`<option value="${s[0]}" ${o.stage===s[0]?'selected':''}>${s[1]}</option>`).join('');ext()};
  const ext=()=>{const t=$('#type',m).value,s=$('#stage',m).value;let h='';
    if((t==='fisik'||t==='umkm')&&(s==='dikirim'||s==='selesai'))h=`<div class="row2"><div><label for="cr">Kurir</label><input id="cr" list="cl" value="${esc(o.courier)}"><datalist id="cl"><option>JNE<option>J&T<option>SiCepat<option>AnterAja<option>Pos Indonesia</datalist></div><div><label for="rs">No. resi</label><input id="rs" value="${esc(o.resi)}"></div></div>`;
    if((t==='web'&&['aktif','selesai'].includes(s))||(t==='video'&&['siap','selesai'].includes(s)))h=`<label for="lk">${t==='web'?'Link undangan':'Link unduhan'}</label><input id="lk" type="url" value="${esc(o.link)}" placeholder="https://…">`;
    $('#ext',m).innerHTML=h};
  fillStage();$('#type',m).onchange=()=>{o.stage=STAGES[$('#type',m).value][0][0];fillStage()};$('#stage',m).onchange=ext;
  $('#ps',m).onchange=()=>{const v=$('#ps',m).value;$('#pxw',m).classList.toggle('hide',v!=='__o');
    const p=S.products.find(x=>String(x.id)===v);if(n&&p&&CAT2TYPE[p.cat]){$('#type',m).value=CAT2TYPE[p.cat];o.stage='diterima';fillStage()}};
  if(n)$('#dpa',m).oninput=()=>$('#dpm-w',m).classList.toggle('hide',!(+$('#dpa',m).value>0));
  $('#x',m).onclick=()=>m.remove();
  if(!n){$('#mp',m).onclick=()=>{m.remove();payModal(o.id)};
    $('#cp',m).onclick=()=>{const t=`Halo ${o.client_name||'Kak'}, kode pesanan Anda: ${o.code}\nPantau status di: ${C.siteUrl}/lacak/?kode=${o.code}`;navigator.clipboard.writeText(t).then(()=>toast('Pesan disalin'),()=>toast('Gagal menyalin'))};
    $('#del',m).onclick=async()=>{if(!confirm('Hapus pesanan '+o.code+'? Pembayarannya ikut terhapus. Tidak bisa dibatalkan.'))return;const {error}=await sb.from('orders').delete().eq('id',o.id);if(error)return toast(error.message);m.remove();await loadAll();route();toast('Dihapus')}}
  $('#f',m).onsubmit=async e=>{e.preventDefault();const er=t=>$('#er',m).textContent=t;
    const g=id=>$('#'+id,m)?$('#'+id,m).value.trim():undefined;
    const sel=g('ps'),prod=S.products.find(p=>String(p.id)===sel),name=sel==='__o'?g('pname'):(prod?prod.name:'');
    if(!name)return er('Pilih produk, atau pilih "Lainnya" lalu ketik nama produknya.');
    const dpa=n?(+g('dpa')||0):0;
    const row={code:g('code').toUpperCase(),type:g('type'),client_name:g('nm'),client_wa:g('wa'),product:name,qty:+g('qty')||1,price:+g('price')||0,cost:+g('cost')||0,stage:g('stage'),done_at:(g('stage')==='selesai'?(o.done_at||new Date().toISOString()):null),deadline:g('dead')||null,note:g('note'),show_until:g('su')||null,updated_at:new Date().toISOString()};
    if(S.t3)row.product_id=prod?prod.id:null;
    if(g('cr')!==undefined)row.courier=g('cr');if(g('rs')!==undefined)row.resi=g('rs');if(g('lk')!==undefined)row.link=g('lk');
    if(n&&!S.t3)row.dp=dpa;
    let r;if(n){r=await sb.from('orders').insert(row).select('id').single()}else r=await sb.from('orders').update(row).eq('id',o.id);
    if(r.error)return er(r.error.code==='23505'?'Kode sudah dipakai.':r.error.message);
    if(n&&S.t3&&dpa>0&&r.data){const pr=await sb.from('payments').insert({order_id:r.data.id,amount:dpa,method:g('dpm')||'Transfer',note:'DP'});if(pr.error)toast('Pesanan tersimpan, tapi DP gagal dicatat: '+pr.error.message)}
    m.remove();await loadAll();route();toast('Tersimpan')};
}

/* ---------- PEMBAYARAN ---------- */
function payModal(oid){
  const m=modal(''),box=$('.box',m);
  m.addEventListener('mousedown',e=>{if(e.target===m)route()});
  const draw=()=>{const o=S.orders.find(x=>x.id===oid);if(!o){m.remove();return}
    const pays=S.payments.filter(p=>p.order_id===oid).sort((a,b)=>a.date.localeCompare(b.date)),pd=paidOf(o),si=sisaOf(o),st=payState(o);
    box.innerHTML=`<h3>Pembayaran · ${esc(o.code)}</h3><p style="color:var(--mut);margin:.1rem 0 .6rem">${esc(o.client_name)||'-'} · ${esc(o.product)||'-'}</p>
    <div class="sumline"><span>Total tagihan</span><b>${RP(o.price)}</b></div><div class="sumline"><span>Sudah dibayar</span><b>${RP(pd)}</b></div><div class="sumline b"><span>Sisa <span class="pill ${st[2]}">${st[1]}</span></span><span>${RP(si)}</span></div>
    <h3 style="font-size:1.05rem;margin:.9rem 0 .2rem">Riwayat pembayaran</h3>
    ${pays.length?pays.map(p=>`<div class="plist"><div class="nm"><b>${RP(p.amount)}</b><br><small>${p.date} · ${esc(p.method)}${p.note?' · '+esc(p.note):''}</small></div><button class="btn sm d" data-del="${p.id}">Hapus</button></div>`).join(''):'<div class="empty" style="padding:.8rem">Belum ada pembayaran.</div>'}
    ${S.t3?`<h3 style="font-size:1.05rem;margin:.9rem 0 0">Catat pembayaran</h3><div class="row3"><div><label for="pd">Tanggal</label><input id="pd" type="date" value="${iso(new Date())}"></div><div><label for="pa">Jumlah (Rp)</label><input id="pa" type="number" min="1" value="${si||''}"></div><div><label for="pm">Metode</label><select id="pm">${PAYM.map(x=>`<option>${x}</option>`).join('')}</select></div></div><label for="pn">Catatan</label><input id="pn" placeholder="mis. DP 50%, pelunasan">`:'<p class="err">Jalankan sql/schema-tahap3.sql di Supabase untuk mengaktifkan pencatatan pembayaran.</p>'}
    <div class="err" id="er"></div><div class="acts"><button class="btn sec" id="inv">Buat invoice</button><button class="btn sec" id="x">Tutup</button>${S.t3?'<button class="btn" id="add">Catat pembayaran</button>':''}</div>`;
    $('#x',box).onclick=()=>{m.remove();route()};$('#inv',box).onclick=()=>{m.remove();invModal(oid)};
    box.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus catatan pembayaran ini?'))return;const {error}=await sb.from('payments').delete().eq('id',b.dataset.del);if(error)return toast(error.message);await loadAll();draw()});
    if(S.t3)$('#add',box).onclick=async()=>{const amt=+$('#pa',box).value;if(!(amt>0))return $('#er',box).textContent='Isi jumlah pembayaran.';
      const {error}=await sb.from('payments').insert({order_id:oid,date:$('#pd',box).value||iso(new Date()),amount:amt,method:$('#pm',box).value,note:$('#pn',box).value.trim()});
      if(error)return $('#er',box).textContent=error.message;await loadAll();draw();toast('Pembayaran dicatat')}};
  draw();
}

/* ---------- TAGIHAN ---------- */
function vBilling(){
  const B=S.bill=S.bill||{all:false,f:''};
  const rows0=S.orders.filter(o=>B.all||sisaOf(o)>0).filter(o=>!B.f||(B.f==='selesai'?o.stage==='selesai':o.stage!=='selesai')).sort((a,b)=>umur(b)-umur(a));
  const tot=rows0.reduce((s,o)=>s+sisaOf(o),0),old=rows0.filter(o=>sisaOf(o)>0).sort((a,b)=>umur(b)-umur(a))[0];
  $('#view').innerHTML=`<div class="grid3"><div class="card stat"><small>Total belum dibayar</small><b>${RP(tot)}</b><em>${rows0.filter(o=>sisaOf(o)>0).length} pesanan</em></div>
   <div class="card stat"><small>Pesanan selesai belum lunas</small><b>${S.orders.filter(o=>o.stage==='selesai'&&sisaOf(o)>0).length}</b><em>perlu ditagih</em></div>
   <div class="card stat"><small>Tagihan tertua</small><b>${old?umur(old)+' hari':'-'}</b><em>${old?esc(old.code):'tidak ada'}</em></div></div>
  <div class="tools" style="margin-top:.8rem"><select id="bf" aria-label="Filter"><option value="">Semua pesanan</option><option value="selesai" ${B.f==='selesai'?'selected':''}>Sudah selesai</option><option value="aktif" ${B.f==='aktif'?'selected':''}>Masih berjalan</option></select><label class="sw" style="margin:0"><input id="ba" type="checkbox" ${B.all?'checked':''} style="width:auto;min-height:0"> Tampilkan yang sudah lunas</label></div>
  <div class="card">${rows0.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th>Kode</th><th>Klien</th><th>Produk</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Umur</th><th></th></tr></thead><tbody>${rows0.map(o=>{const st=payState(o);return `<tr><td data-l="Kode"><b>${esc(o.code)}</b><br><span class="pill ${st[2]}">${st[1]}</span></td><td data-l="Klien">${esc(o.client_name)||'-'}</td><td data-l="Produk">${esc(o.product)||'-'}<br><small>${esc(stageName(o.type,o.stage))}</small></td><td data-l="Total">${RP(o.price)}</td><td data-l="Dibayar">${RP(paidOf(o))}</td><td data-l="Sisa"><b>${RP(sisaOf(o))}</b></td><td data-l="Umur">${umur(o)} hari</td><td style="white-space:nowrap"><button class="btn sm" data-i="${o.id}">Invoice</button> <button class="btn sm sec" data-p="${o.id}">Bayar</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Tidak ada tagihan. Semua pesanan sudah lunas.</div>'}</div>
  <p style="color:var(--mut);font-size:13px">Umur dihitung sejak pesanan dibuat, atau sejak pesanan selesai bila sudah selesai.</p>`;
  $('#bf').onchange=e=>{B.f=e.target.value;vBilling()};$('#ba').onchange=e=>{B.all=e.target.checked;vBilling()};
  $('#view').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>invModal(+b.dataset.i));$('#view').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>payModal(+b.dataset.p));
}

/* ---------- PRODUCTS ---------- */
function vProducts(){
  $('#topact').innerHTML='<button class="btn sec" id="ac">+ Kategori</button> <button class="btn" id="ap">+ Produk</button>';
  $('#ac').onclick=()=>catForm();$('#ap').onclick=()=>prodForm();
  const PS=prodStats(),eff=p=>{const k=p.name.toLowerCase();return p.tag?[p.tag,'']:PS.best.has(k)?['Terlaris','otomatis']:PS.pop.has(k)?['Populer','otomatis']:PS.isNew(p)?['Baru','otomatis']:['','']};
  $('#view').innerHTML=S.cats.map(c=>{const ps=S.products.filter(p=>p.cat===c.id);return `<div class="card" style="margin-bottom:.8rem"><div class="top" style="margin:0 0 .5rem"><h3 style="flex:1;font-size:1.15rem">${esc(c.name)} ${c.active?'':'<span class="pill">disembunyikan</span>'}</h3><button class="btn sm sec" data-c="${esc(c.id)}">Ubah kategori</button></div>
   ${ps.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th></th><th>Produk</th><th>Harga</th><th>Terjual</th><th>Klik 30 hari</th><th>Label di web</th><th>Aktif</th><th></th></tr></thead><tbody>${ps.map(p=>{const k=p.name.toLowerCase(),e=eff(p);return `<tr><td data-l="Foto">${p.img?`<img class="thumb" src="${esc(p.img)}" alt="">`:'<span class="thumb"></span>'}</td><td data-l="Nama"><b>${esc(p.name)}</b><br><small>${esc(p.title)}</small></td><td data-l="Harga">${esc(p.price_label)||'-'}</td><td data-l="Terjual">${PS.sold[k]||0}</td><td data-l="Klik">${PS.views[k]||0}</td><td data-l="Label">${e[0]?`<span class="pill ${e[1]?'ok':'w'}">${esc(e[0])}</span>${e[1]?' <small>otomatis</small>':''}`:'-'}</td><td data-l="Aktif"><label class="sw"><input type="checkbox" data-t="${p.id}" ${p.active?'checked':''} style="width:auto;min-height:0"> Aktif</label></td><td><button class="btn sm sec" data-p="${p.id}">Ubah</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Belum ada produk.</div>'}</div>`}).join('')||'<div class="card empty">Belum ada kategori. Klik “+ Kategori”, atau impor dari data.js lewat panduan.</div>';
  $('#view').insertAdjacentHTML('beforeend','<p style="color:var(--mut);font-size:13px">Label otomatis: <b>Terlaris</b> = 3 produk dengan pesanan selesai terbanyak, <b>Populer</b> = 3 produk paling sering diklik 30 hari terakhir, <b>Baru</b> = ditambahkan dalam 30 hari. Label manual (kolom Label di form produk) selalu menang.</p>');
  $('#view').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>catForm(S.cats.find(c=>c.id===b.dataset.c)));
  $('#view').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>prodForm(S.products.find(p=>p.id==b.dataset.p)));
  $('#view').querySelectorAll('[data-t]').forEach(b=>b.onchange=async()=>{const {error}=await sb.from('products').update({active:b.checked}).eq('id',b.dataset.t);error?toast(error.message):(await loadAll(),toast('Tersimpan'))});
}
function catForm(c){
  const n=!c;c=c||{id:'',name:'',descr:'',sort:S.cats.length,active:true};
  const m=modal(`<h3>${n?'Kategori baru':'Ubah kategori'}</h3><form id="f"><label>ID (huruf kecil, tanpa spasi; sama dengan nama folder web)</label><input id="id" value="${esc(c.id)}" ${n?'':'readonly'} required pattern="[a-z0-9\\-]+">
  <label>Nama</label><input id="nm" value="${esc(c.name)}" required><label>Deskripsi</label><textarea id="ds" rows="2">${esc(c.descr)}</textarea>
  <div class="row2"><div><label>Urutan</label><input id="so" type="number" value="${c.sort||0}"></div><div><label>&nbsp;</label><label class="sw"><input id="ac" type="checkbox" ${c.active?'checked':''} style="width:auto;min-height:0"> Tampil</label></div></div>
  <div class="err" id="er"></div><div class="acts"><button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  $('#f',m).onsubmit=async e=>{e.preventDefault();const row={id:$('#id',m).value.trim(),name:$('#nm',m).value.trim(),descr:$('#ds',m).value.trim(),sort:+$('#so',m).value||0,active:$('#ac',m).checked};
    const {error}=await sb.from('categories').upsert(row);if(error)return $('#er',m).textContent=error.message;m.remove();await loadAll();route();toast('Tersimpan')};
}
function prodForm(p){
  const n=!p;p=p||{cat:S.cats[0]?.id||'',name:'',title:'',price_label:'',descr:'',demo:'',video:'',img:'',tag:'',home:false,sort:0,active:true};
  const m=modal(`<h3>${n?'Produk baru':'Ubah produk'}</h3><form id="f">
  <div class="row2"><div><label>Kategori</label><select id="cat">${S.cats.map(c=>`<option value="${esc(c.id)}" ${p.cat===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div><label>Nama pendek</label><input id="nm" value="${esc(p.name)}" required></div></div>
  <label>Judul</label><input id="ti" value="${esc(p.title)}"><label>Harga (teks, mis. Rp 75.000 / link)</label><input id="pl" value="${esc(p.price_label)}">
  <label>Deskripsi</label><textarea id="ds" rows="3">${esc(p.descr)}</textarea>
  <div class="row2"><div><label>Link demo</label><input id="dm" value="${esc(p.demo)}"></div><div><label>Link video (YouTube/IG/Drive)</label><input id="vd" type="url" value="${esc(p.video)}"></div></div>
  <label>Foto</label><div style="display:flex;gap:.6rem;align-items:center"><img id="pv" class="thumb" style="width:72px;height:54px" ${p.img?`src="${esc(p.img)}"`:''} alt=""><input id="file" type="file" accept="image/*"></div><input id="img" type="hidden" value="${esc(p.img)}">
  <div class="row3"><div><label>Label (Baru/Terlaris)</label><input id="tg" value="${esc(p.tag)}"></div><div><label>Urutan</label><input id="so" type="number" value="${p.sort||0}"></div><div><label>Opsi</label><label class="sw"><input id="hm" type="checkbox" ${p.home?'checked':''} style="width:auto;min-height:0"> Beranda</label> <label class="sw"><input id="ac" type="checkbox" ${p.active?'checked':''} style="width:auto;min-height:0"> Aktif</label></div></div>
  <div class="err" id="er"></div><div class="acts">${n?'':'<button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  $('#file',m).onchange=async e=>{const f=e.target.files[0];if(!f)return;$('#er',m).textContent='Mengompres & mengunggah…';
    try{const blob=await shrink(f,1280,.82),path=`produk/${Date.now()}-${Math.random().toString(36).slice(2,7)}.jpg`;
      const {error}=await sb.storage.from('media').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});if(error)throw error;
      const url=sb.storage.from('media').getPublicUrl(path).data.publicUrl;$('#img',m).value=url;$('#pv',m).src=url;$('#er',m).textContent='';toast('Foto terunggah ('+Math.round(blob.size/1024)+' KB)')}
    catch(x){$('#er',m).textContent='Gagal unggah: '+(x.message||x)}};
  if(!n)$('#del',m).onclick=async()=>{if(!confirm('Hapus produk '+p.name+'?'))return;const {error}=await sb.from('products').delete().eq('id',p.id);if(error)return toast(error.message);m.remove();await loadAll();route();toast('Dihapus')};
  $('#f',m).onsubmit=async e=>{e.preventDefault();const g=id=>$('#'+id,m).value.trim();
    const row={cat:g('cat'),name:g('nm'),title:g('ti'),price_label:g('pl'),descr:g('ds'),demo:g('dm'),video:g('vd'),img:g('img'),tag:g('tg'),sort:+g('so')||0,home:$('#hm',m).checked,active:$('#ac',m).checked};
    if(!row.cat)return $('#er',m).textContent='Buat kategori dulu.';
    const r=n?await sb.from('products').insert(row):await sb.from('products').update(row).eq('id',p.id);
    if(r.error)return $('#er',m).textContent=r.error.message;m.remove();await loadAll();route();toast('Tersimpan')};
}
function shrink(file,max,q){return new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(file);im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>b?res(b):rej(new Error('Gagal kompres')),'image/jpeg',q)};im.onerror=()=>rej(new Error('File bukan gambar'));im.src=u})}

/* ---------- REVIEWS ---------- */
function vReviews(){
  const pl={menunggu:['w','Menunggu'],tampil:['ok','Tampil'],ditolak:['bad','Ditolak']};
  $('#view').innerHTML=`<div class="card">${S.reviews.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th>Nama</th><th>Bintang</th><th>Ulasan</th><th>Status</th><th></th></tr></thead><tbody>${S.reviews.map(r=>`<tr><td data-l="Nama">${esc(r.name)}<br><small>${esc(r.product)} · ${esc(r.order_code)}</small></td><td data-l="Bintang">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</td><td data-l="Ulasan" style="max-width:340px">${esc(r.body)}</td><td data-l="Status"><span class="pill ${pl[r.status][0]}">${pl[r.status][1]}</span></td><td style="white-space:nowrap"><button class="btn sm" data-a="tampil" data-i="${r.id}">Tampilkan</button> <button class="btn sm d" data-a="ditolak" data-i="${r.id}">Tolak</button> <button class="btn sm sec" data-n="${r.id}">Nama</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada ulasan.</div>'}</div>`;
  $('#view').querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('reviews').update({status:b.dataset.a}).eq('id',b.dataset.i);if(error)return toast(error.message);await loadAll();shell();toast('Tersimpan')});
  $('#view').querySelectorAll('[data-n]').forEach(b=>b.onclick=async()=>{const r=S.reviews.find(x=>x.id==b.dataset.n),v=prompt('Nama yang ditampilkan:',r.name);if(v===null)return;const {error}=await sb.from('reviews').update({name:v.trim()}).eq('id',r.id);if(error)return toast(error.message);await loadAll();route();toast('Tersimpan')});
}

/* ---------- KEUANGAN ---------- */
const CATS_EX=['Bahan','Listrik & air','Iklan','Ongkir','Gaji / bantuan','Peralatan','Lainnya'];
const iso=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4);return z.toISOString().slice(0,10)};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
let FR={mode:'30',month:new Date().toISOString().slice(0,7),year:String(new Date().getFullYear())};
function range(){const t=new Date(),m=FR.mode;let a,b=iso(t),label;
  if(['7','15','30'].includes(m)){a=iso(addD(t,-(+m-1)));label=m+' hari terakhir'}
  else if(m==='6m'){const d=new Date(t);d.setMonth(d.getMonth()-6);d.setDate(d.getDate()+1);a=iso(d);label='6 bulan terakhir'}
  else if(m==='1y'){const d=new Date(t);d.setFullYear(d.getFullYear()-1);d.setDate(d.getDate()+1);a=iso(d);label='1 tahun terakhir'}
  else if(m==='month'){const [y,mo]=FR.month.split('-').map(Number);a=FR.month+'-01';b=iso(new Date(y,mo,0));label='Bulan '+FR.month}
  else{a=FR.year+'-01-01';b=FR.year+'-12-31';label='Tahun '+FR.year}
  return {a,b,label}}
function calcFin(R0){
  const R=R0||range(),inR=d=>d>=R.a&&d<=R.b;
  const od=o=>(o.done_at||o.updated_at||o.created_at||'').slice(0,10);
  const os=S.orders.filter(o=>o.stage==='selesai'&&inR(od(o))),ex=S.expenses.filter(e=>inR(e.date));
  const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
  const omzet=sum(os,'price'),modal=sum(os,'cost'),biaya=sum(ex,'amount'),kotor=omzet-modal,bersih=kotor-biaya;
  const act=S.orders.filter(o=>o.stage!=='selesai'),sisa=S.orders.reduce((s,o)=>s+sisaOf(o),0),np=S.orders.filter(o=>sisaOf(o)>0).length,pin=S.payments.filter(p=>inR(p.date)),kas=pin.reduce((s,p)=>s+(+p.amount||0),0);
  const daily=(new Date(R.b)-new Date(R.a))/864e5<=31,key=d=>daily?d:d.slice(0,7),B={};
  os.forEach(o=>{const k=key(od(o));(B[k]=B[k]||{o:0,c:0,e:0,k:0}).o+=+o.price||0;B[k].c+=+o.cost||0});
  ex.forEach(e=>{const k=key(e.date);(B[k]=B[k]||{o:0,c:0,e:0,k:0}).e+=+e.amount||0});
  pin.forEach(p=>{const k=key(p.date);(B[k]=B[k]||{o:0,c:0,e:0,k:0}).k+=+p.amount||0});
  return {kas,np,R,os,ex,omzet,modal,biaya,kotor,bersih,margin:omzet?bersih/omzet*100:0,sisa,aktif:act.length,B,daily}}
const pdate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const MN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function chartSVG(F){
  const R=F.R,ks=[];
  if(F.daily){for(let d=pdate(R.a);iso(d)<=R.b;d=addD(d,1))ks.push(iso(d))}else{let d=pdate(R.a.slice(0,7)+'-01');while(iso(d).slice(0,7)<=R.b.slice(0,7)){ks.push(iso(d).slice(0,7));d=new Date(d.getFullYear(),d.getMonth()+1,1)}}
  if(!ks.length||!Object.keys(F.B).length)return '<div class="empty">Belum ada data di periode ini.</div>';
  const V=ks.map(k=>{const b=F.B[k]||{o:0,c:0,e:0,k:0};return {k,o:b.o,l:b.o-b.c-b.e,kas:b.k||0}});
  const mx=Math.max(1,...V.map(v=>Math.max(v.o,v.l,v.kas))),W=Math.max(560,ks.length*(F.daily?26:54)),H=230,L=46,Bt=28,T=14,ch=H-Bt-T,step=(W-L)/ks.length,bw=Math.min(18,step/2.6);
  const fm=v=>v>=1e6?(v/1e6).toFixed(v%1e6?1:0)+'jt':v>=1e3?Math.round(v/1e3)+'rb':String(Math.round(v));
  const grid=[0,.25,.5,.75,1].map(t=>{const y=T+ch-ch*t;return `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="#e3e8df"/><text x="${L-6}" y="${y+3}" font-size="10" text-anchor="end" fill="#5a6b61">${fm(mx*t)}</text>`}).join('');
  const every=Math.ceil(ks.length/16),cy=v=>T+ch-ch*v/mx;
  const bars=V.map((v,i)=>{const cx=L+i*step+step/2,h1=Math.max(0,v.o)/mx*ch,h2=Math.max(0,v.l)/mx*ch,lb=F.daily?v.k.slice(8):MN[+v.k.slice(5,7)-1]+(R.a.slice(0,4)!==R.b.slice(0,4)?' '+v.k.slice(2,4):'');
    return `<rect x="${cx-bw-1}" y="${T+ch-h1}" width="${bw}" height="${h1}" rx="3" fill="#1a7a2e"><title>${v.k}: omzet ${RP(v.o)}</title></rect><rect x="${cx+1}" y="${T+ch-h2}" width="${bw}" height="${h2}" rx="3" fill="#f2c230"><title>${v.k}: laba bersih ${RP(v.l)}</title></rect>${i%every?'':`<text x="${cx}" y="${H-9}" font-size="10" text-anchor="middle" fill="#5a6b61">${lb}</text>`}`}).join('');
  const pts=V.map((v,i)=>[L+i*step+step/2,cy(v.kas)]),line=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="#0b3a22" stroke-width="2" stroke-linejoin="round"/>`+pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#0b3a22"><title>${V[i].k}: kas masuk ${RP(V[i].kas)}</title></circle>`).join('');
  return `<div class="wrap"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${Math.min(W,560)}px;height:auto" role="img" aria-label="Grafik omzet, laba bersih, dan kas masuk">${grid}${bars}${line}</svg></div><small style="color:var(--mut)"><span style="color:#1a7a2e">■</span> Omzet &nbsp; <span style="color:#d9a800">■</span> Laba bersih &nbsp; <span style="color:#0b3a22">●</span> Kas masuk (pembayaran diterima)</small>`}
function vFinance(){
  if(!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 2</h3><p>Tabel keuangan belum ada. Jalankan <code>sql/schema-tahap2.sql</code> di Supabase SQL Editor, lalu muat ulang halaman ini.</p></div>';return}
  const F=calcFin(),m=FR.mode;
  $('#topact').innerHTML='<button class="btn" id="adx">+ Biaya</button>';$('#adx').onclick=()=>expForm();
  $('#view').innerHTML=`<div class="tools"><select id="fm" aria-label="Rentang">${[['7','7 hari'],['15','15 hari'],['30','30 hari'],['6m','6 bulan'],['1y','1 tahun'],['month','Per bulan'],['year','Per tahun']].map(x=>`<option value="${x[0]}" ${m===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>
   ${m==='month'?`<input id="fmo" type="month" value="${FR.month}" style="max-width:180px">`:''}${m==='year'?`<input id="fyr" type="number" min="2020" max="2100" value="${FR.year}" style="max-width:120px">`:''}
   <span style="flex:1"></span><button class="btn sm sec" id="dcsv">CSV</button><button class="btn sm sec" id="dxls">Excel</button><button class="btn sm sec" id="dpdf">PDF / Cetak</button></div>
   <p style="color:var(--mut);margin:.2rem 0 .8rem">${esc(F.R.label)} (${F.R.a} s/d ${F.R.b}). Omzet dan modal dihitung dari pesanan Selesai; kas masuk dari pembayaran yang dicatat.</p>
   <div class="grid4"><div class="card stat"><small>Omzet</small><b>${RP(F.omzet)}</b><em>${F.os.length} pesanan selesai</em></div>
   <div class="card stat"><small>Modal</small><b>${RP(F.modal)}</b><em>biaya produksi pesanan</em></div>
   <div class="card stat"><small>Laba kotor</small><b>${RP(F.kotor)}</b><em>omzet − modal</em></div>
   <div class="card stat"><small>Biaya operasional</small><b>${RP(F.biaya)}</b><em>${F.ex.length} catatan</em></div></div>
   <div class="grid3" style="margin-top:.8rem"><div class="card stat"><small>Laba bersih</small><b style="color:${F.bersih<0?'var(--red)':'inherit'}">${RP(F.bersih)}</b><em>margin ${F.margin.toFixed(1)}% dari omzet</em></div>
   <div class="card stat"><small>Kas masuk</small><b>${RP(F.kas)}</b><em>pembayaran diterima di periode ini</em></div>
   <div class="card stat"><small>Piutang (belum lunas)</small><b>${RP(F.sisa)}</b><em>${F.np} pesanan · <a href="#billing">Tagihan &amp; Invoice</a></em></div></div>
   <div class="card" style="margin-top:.8rem"><h3 style="margin-bottom:.5rem">Grafik</h3>${chartSVG(F)}</div>
   <div class="card" style="margin-top:.8rem"><h3 style="margin-bottom:.5rem">Biaya operasional</h3>${F.ex.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Catatan</th><th>Jumlah</th><th></th></tr></thead><tbody>${F.ex.map(e=>`<tr><td data-l="Tanggal">${e.date}</td><td data-l="Kategori">${esc(e.category)}</td><td data-l="Catatan">${esc(e.note)||'-'}</td><td data-l="Jumlah">${RP(e.amount)}</td><td><button class="btn sm sec" data-x="${e.id}">Ubah</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada biaya di periode ini.</div>'}</div>
   <div class="card" style="margin-top:.8rem"><h3 style="margin-bottom:.5rem">Pesanan selesai di periode ini</h3>${F.os.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th>Kode</th><th>Klien</th><th>Produk</th><th>Harga</th><th>Modal</th><th>Laba</th></tr></thead><tbody>${F.os.map(o=>`<tr><td data-l="Kode">${esc(o.code)}</td><td data-l="Klien">${esc(o.client_name)||'-'}</td><td data-l="Produk">${esc(o.product)||'-'}</td><td data-l="Harga">${RP(o.price)}</td><td data-l="Modal">${RP(o.cost)}</td><td data-l="Laba">${RP((+o.price||0)-(+o.cost||0))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pesanan selesai.</div>'}</div>`;
  $('#fm').onchange=e=>{FR.mode=e.target.value;vFinance()};
  if($('#fmo'))$('#fmo').onchange=e=>{if(e.target.value){FR.month=e.target.value;vFinance()}};
  if($('#fyr'))$('#fyr').onchange=e=>{FR.year=String(+e.target.value||new Date().getFullYear());vFinance()};
  $('#view').querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>expForm(S.expenses.find(e=>e.id==b.dataset.x)));
  $('#dcsv').onclick=()=>exportCSV(F);$('#dxls').onclick=()=>exportXLS(F);$('#dpdf').onclick=()=>exportPDF(F);
}
function expForm(e){
  const n=!e;e=e||{date:iso(new Date()),category:'Bahan',note:'',amount:0};
  const m=modal(`<h3>${n?'Biaya baru':'Ubah biaya'}</h3><form id="f"><div class="row2"><div><label>Tanggal</label><input id="dt" type="date" value="${e.date}" required></div><div><label>Kategori</label><select id="ct">${CATS_EX.map(c=>`<option ${c===e.category?'selected':''}>${c}</option>`).join('')}</select></div></div>
  <label>Catatan</label><input id="nt" value="${esc(e.note)}"><label>Jumlah (Rp)</label><input id="am" type="number" min="0" value="${e.amount||''}" required><div class="err" id="er"></div>
  <div class="acts">${n?'':'<button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  if(!n)$('#del',m).onclick=async()=>{if(!confirm('Hapus catatan biaya ini?'))return;const {error}=await sb.from('expenses').delete().eq('id',e.id);if(error)return toast(error.message);m.remove();await loadAll();route();toast('Dihapus')};
  $('#f',m).onsubmit=async ev=>{ev.preventDefault();const row={date:$('#dt',m).value,category:$('#ct',m).value,note:$('#nt',m).value.trim(),amount:+$('#am',m).value||0};
    const r=n?await sb.from('expenses').insert(row):await sb.from('expenses').update(row).eq('id',e.id);if(r.error)return $('#er',m).textContent=r.error.message;m.remove();await loadAll();route();toast('Tersimpan')};
}
function finRows(F){const sum=[['Rekap Keuangan Rumah Cetak'],['Periode',F.R.label,F.R.a+' s/d '+F.R.b],[],['Omzet',F.omzet],['Modal',F.modal],['Laba kotor',F.kotor],['Biaya operasional',F.biaya],['Laba bersih',F.bersih],['Margin (%)',+F.margin.toFixed(1)],['Kas masuk',F.kas],['Piutang saat ini',F.sisa]];
  const ord=[['Kode','Klien','Produk','Jumlah','Harga','Modal','Laba','Tanggal selesai']].concat(F.os.map(o=>[o.code,o.client_name,o.product,o.qty,+o.price||0,+o.cost||0,(+o.price||0)-(+o.cost||0),(o.done_at||o.updated_at||o.created_at||'').slice(0,10)]));
  const exp=[['Tanggal','Kategori','Catatan','Jumlah']].concat(F.ex.map(e=>[e.date,e.category,e.note,+e.amount||0]));return {sum,ord,exp}}
function fname(F,ext){return `rekap-rumahcetak-${F.R.a}_${F.R.b}.${ext}`}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function exportCSV(F){const {sum,ord,exp}=finRows(F);const cell=v=>{v=String(v??'');return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const t=a=>a.map(r=>r.map(cell).join(',')).join('\n');saveBlob(new Blob(['\ufeff'+t(sum)+'\n\nPESANAN SELESAI\n'+t(ord)+'\n\nBIAYA OPERASIONAL\n'+t(exp)],{type:'text/csv;charset=utf-8'}),fname(F,'csv'))}
function loadScript(src){return new Promise((ok,no)=>{if(window.XLSX)return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('gagal memuat'));document.head.append(s)})}
async function exportXLS(F){try{await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')}catch(e){return toast('Pustaka Excel gagal dimuat. Pakai CSV (bisa dibuka di Excel).')}
  const {sum,ord,exp}=finRows(F),wb=XLSX.utils.book_new();[['Ringkasan',sum],['Pesanan',ord],['Biaya',exp]].forEach(([n,a])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(a),n));
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});saveBlob(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),fname(F,'xlsx'))}
function exportPDF(F){const {ord,exp}=finRows(F);const d=document.createElement('div');d.id='printarea';
  const tb=a=>`<table class="tbl"><thead><tr>${a[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${a.slice(1).map(r=>`<tr>${r.map(c=>`<td>${typeof c==='number'?RP(c):esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  d.innerHTML=`<h2>Rekap Keuangan Rumah Cetak</h2><p>${esc(F.R.label)}: ${F.R.a} s/d ${F.R.b}</p><table class="tbl"><tbody><tr><td>Omzet</td><td>${RP(F.omzet)}</td></tr><tr><td>Modal</td><td>${RP(F.modal)}</td></tr><tr><td>Laba kotor</td><td>${RP(F.kotor)}</td></tr><tr><td>Biaya operasional</td><td>${RP(F.biaya)}</td></tr><tr><td><b>Laba bersih</b></td><td><b>${RP(F.bersih)}</b></td></tr><tr><td>Margin</td><td>${F.margin.toFixed(1)}%</td></tr></tbody></table><h3>Pesanan selesai</h3>${tb(ord).replace(/<td>Rp (\d)/g,'<td>Rp $1')}<h3>Biaya operasional</h3>${tb(exp)}`;
  document.body.append(d);document.body.classList.add('printing');const done=()=>{d.remove();document.body.classList.remove('printing');removeEventListener('afterprint',done)};addEventListener('afterprint',done);print()}

/* ---------- PROMO & PAKET ---------- */
const fmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
const DEF_PROMO={active:false,label:'Promo',long:'',short:'',href:'#paket',link:'Lihat',start:'',end:''};
function vPromo(){
  if(!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 2</h3><p>Jalankan <code>sql/schema-tahap2.sql</code> lalu <code>sql/import-tahap2.sql</code> di Supabase SQL Editor, lalu muat ulang.</p></div>';return}
  const P={...DEF_PROMO,...(S.settings.promo||{})},K={min:100,hemat:1650,biasa:2000,...(S.settings.fisik||{})},BD=S.settings.bundles||[],CA=calcState();
  $('#view').innerHTML=`<div class="card"><h3>Bar promo di atas web</h3><form id="pf">
   <label class="sw"><input id="pa" type="checkbox" ${P.active?'checked':''} style="width:auto;min-height:0"> Tampilkan bar promo</label>
   <div class="row2"><div><label>Label</label><input id="pl" value="${esc(P.label)}"></div><div><label>Teks tombol</label><input id="pk" value="${esc(P.link)}"></div></div>
   <label>Teks panjang (desktop). Tebalkan dengan **kata**</label><input id="pg" value="${esc(P.long)}"><label>Teks pendek (HP)</label><input id="ps" value="${esc(P.short)}">
   <div class="row3"><div><label>Tujuan tombol</label><input id="ph" value="${esc(P.href)}"></div><div><label>Mulai (opsional)</label><input id="p1" type="date" value="${esc(P.start)}"></div><div><label>Selesai (opsional)</label><input id="p2" type="date" value="${esc(P.end)}"></div></div>
   <div class="acts"><button class="btn">Simpan promo</button></div></form></div>
   ${priceCard(K,CA)}
   <div class="card" style="margin-top:.8rem"><div class="top" style="margin:0 0 .5rem"><h3 style="flex:1">Paket bundling</h3><button class="btn sm" id="ab">+ Paket</button></div>${BD.length?`<div class="wrap"><table class="tbl cards"><tbody>${BD.map((b,i)=>`<tr><td data-l="Urut"><button class="btn sm sec" data-u="${i}" ${i?'':'disabled'} aria-label="Naik">↑</button> <button class="btn sm sec" data-dn="${i}" ${i<BD.length-1?'':'disabled'} aria-label="Turun">↓</button></td><td data-l="Paket"><b>${esc(b.name)}</b> ${b.hot?'<span class="pill w">Rekomendasi</span>':''}<br><small>${esc(b.kicker)}</small></td><td data-l="Harga">${esc(b.price)} <small>${esc(b.unit)}</small></td><td><button class="btn sm sec" data-b="${i}">Ubah</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada paket. Jalankan <code>sql/import-tahap2.sql</code> untuk mengisi dari web, atau klik + Paket.</div>'}</div>`;
  $('#pf').onsubmit=async e=>{e.preventDefault();await saveSet('promo',{active:$('#pa').checked,label:$('#pl').value.trim(),long:$('#pg').value.trim(),short:$('#ps').value.trim(),href:$('#ph').value.trim()||'#paket',link:$('#pk').value.trim()||'Lihat',start:$('#p1').value,end:$('#p2').value})};
  priceWire(K,CA);
  $('#ab').onclick=()=>bundleForm();
  $('#view').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>bundleForm(+b.dataset.b));
  $('#view').querySelectorAll('[data-u],[data-dn]').forEach(b=>b.onclick=async()=>{const i=+(b.dataset.u??b.dataset.dn),j=b.dataset.u!==undefined?i-1:i+1,a=[...BD];[a[i],a[j]]=[a[j],a[i]];await saveSet('bundles',a)});
}
async function saveSet(key,value,quiet){const {error}=await sb.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)return toast('Gagal: '+error.message);S.settings[key]=value;if(!quiet){toast('Tersimpan. Web utama menampilkan versi baru pada kunjungan berikutnya.');route()}}
function bundleForm(i){
  const BD=[...(S.settings.bundles||[])],n=i===undefined,b=n?{lb:'Starter',kicker:'',chip:'',name:'',desc:'',price:'',unit:'',cta:'Pesan Paket',items:[],hot:false}:BD[i];
  const m=modal(`<h3>${n?'Paket baru':'Ubah paket'}</h3><form id="f"><div class="row2"><div><label>Nama paket</label><input id="nm" value="${esc(b.name)}" required></div><div><label>Label kecil (mis. Starter, Populer)</label><input id="lb" value="${esc(b.lb)}"></div></div>
  <div class="row2"><div><label>Subjudul</label><input id="kc" value="${esc(b.kicker)}"></div><div><label>Chip</label><input id="ch" value="${esc(b.chip)}"></div></div><label>Deskripsi singkat</label><input id="ds" value="${esc(b.desc)}">
  <div class="row2"><div><label>Harga (teks)</label><input id="pname" value="${esc(b.price)}" required></div><div><label>Satuan / keterangan</label><input id="un" value="${esc(b.unit)}"></div></div><label>Teks tombol</label><input id="ct" value="${esc(b.cta)}">
  <label>Isi paket (satu baris satu poin; **tebal**)</label><textarea id="it" rows="6">${esc((b.items||[]).join('\n'))}</textarea><label class="sw"><input id="ht" type="checkbox" ${b.hot?'checked':''} style="width:auto;min-height:0"> Paket rekomendasi (kartu tengah, hanya satu)</label>
  <div class="err" id="er"></div><div class="acts">${n?'':'<button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  if(!n)$('#del',m).onclick=async()=>{if(!confirm('Hapus paket ini?'))return;BD.splice(i,1);m.remove();await saveSet('bundles',BD)};
  $('#f',m).onsubmit=async e=>{e.preventDefault();const g=id=>$('#'+id,m).value.trim();
    const nb={lb:g('lb'),kicker:g('kc'),chip:g('ch'),name:g('nm'),desc:g('ds'),price:g('pname'),unit:g('un'),cta:g('ct')||'Pesan Paket',items:g('it').split('\n').map(x=>x.trim()).filter(Boolean),hot:$('#ht',m).checked};
    if(nb.hot)BD.forEach(x=>x.hot=false);if(n)BD.push(nb);else BD[i]=nb;m.remove();await saveSet('bundles',BD)};
}

/* ---------- INVOICE PDF ---------- */
const HW=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W1252={'–':0x96,'—':0x97,'’':0x92,'‘':0x91,'“':0x93,'”':0x94,'•':0x95,'…':0x85,'€':0x80};
const pdfEnc=s=>{let o='';for(const ch of String(s??'')){let c=ch.charCodeAt(0);if(W1252[ch])c=W1252[ch];else if(c>255)c=63;if(c<32)o+=' ';else if(c===40||c===41||c===92)o+='\\'+ch;else o+=String.fromCharCode(c)}return o};
const strW=(s,sz,bold)=>{let w=0;for(const ch of String(s??'')){const c=ch.charCodeAt(0);w+=(c>=32&&c<=126?HW[c-32]:556)}return w/1000*sz*(bold?1.07:1)};
function wrapT(s,sz,maxW,bold){const out=[];String(s??'').split('\n').forEach(par=>{let line='';par.split(/\s+/).filter(Boolean).forEach(w=>{const t=line?line+' '+w:w;if(strW(t,sz,bold)>maxW&&line){out.push(line);line=w}else line=t});out.push(line)});return out}
const hexc=h=>{h=h.replace('#','');return [0,2,4].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(3)).join(' ')};
function PDFPage(){
  const c=[],Hh=842,f=n=>(+n).toFixed(2),Y=y=>f(Hh-y);
  const api={
    rect(x,y,w,h,fill){c.push(`${hexc(fill)} rg ${f(x)} ${Y(y+h)} ${f(w)} ${f(h)} re f`)},
    rrect(x,y,w,h,r,fill){const k=.5523*r,X=x,y2=Hh-y,Yb=Hh-y-h;c.push(`${hexc(fill)} rg ${f(X+r)} ${f(y2)} m ${f(X+w-r)} ${f(y2)} l ${f(X+w-r+k)} ${f(y2)} ${f(X+w)} ${f(y2-r+k)} ${f(X+w)} ${f(y2-r)} c ${f(X+w)} ${f(Yb+r)} l ${f(X+w)} ${f(Yb+r-k)} ${f(X+w-r+k)} ${f(Yb)} ${f(X+w-r)} ${f(Yb)} c ${f(X+r)} ${f(Yb)} l ${f(X+r-k)} ${f(Yb)} ${f(X)} ${f(Yb+r-k)} ${f(X)} ${f(Yb+r)} c ${f(X)} ${f(y2-r)} l ${f(X)} ${f(y2-r+k)} ${f(X+r-k)} ${f(y2)} ${f(X+r)} ${f(y2)} c f`)},
    poly(pts,fill){c.push(`${hexc(fill)} rg `+pts.map((p,i)=>`${f(p[0])} ${Y(p[1])} ${i?'l':'m'}`).join(' ')+' f')},
    line(x1,y1,x2,y2,col,w){c.push(`${hexc(col)} RG ${f(w||.7)} w ${f(x1)} ${Y(y1)} m ${f(x2)} ${Y(y2)} l S`)},
    text(s,x,y,sz,font,col,al){const bold=font==='F2';let w=strW(s,sz,bold);if(al==='r')x-=w;else if(al==='c')x-=w/2;c.push(`BT /${font} ${f(sz)} Tf ${hexc(col)} rg ${f(x)} ${Y(y)} Td (${pdfEnc(s)}) Tj ET`)},
    logo(x,y,sz){const s=sz/48,P=(a,b)=>[x+a*s,y+b*s];api.rrect(x,y,sz,sz,12*s,'#16662a');api.poly([P(11,24),P(24,12.5),P(37,24),P(37,37.5),P(11,37.5)],'#ffffff');api.poly([P(30,12.5),P(35.5,12.5),P(35.5,24)],'#f2c230');api.rect(x+18*s,y+26*s,12*s,2.4*s,'#1a7a2e');api.rect(x+18*s,y+31*s,8*s,2.4*s,'#f2c230')},
    build(){
      const content=c.join('\n'),o=[];o[1]='<</Type/Catalog/Pages 2 0 R>>';o[2]='<</Type/Pages/Kids[3 0 R]/Count 1>>';
      o[3]='<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R/F2 5 0 R/F3 6 0 R>>>>/Contents 7 0 R>>';
      o[4]='<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>';o[5]='<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>';o[6]='<</Type/Font/Subtype/Type1/BaseFont/Times-Bold/Encoding/WinAnsiEncoding>>';
      o[7]=`<</Length ${content.length}>>\nstream\n${content}\nendstream`;
      let out='%PDF-1.4\n';const off=[];for(let i=1;i<=7;i++){off[i]=out.length;out+=`${i} 0 obj\n${o[i]}\nendobj\n`}
      const x=out.length;out+='xref\n0 8\n0000000000 65535 f \n'+off.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<</Size 8/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
      const u=new Uint8Array(out.length);for(let i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;return new Blob([u],{type:'application/pdf'})}};
  return api}
const tglID=d=>new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
function invData(o){const B=biz(),pays=S.t3?S.payments.filter(p=>p.order_id===o.id).sort((a,b)=>a.date.localeCompare(b.date)):((+o.dp||0)>0?[{date:(o.created_at||'').slice(0,10)||iso(new Date()),amount:+o.dp,method:'DP',note:''}]:[]);
  return {B,o,pays,paid:paidOf(o),sisa:sisaOf(o),st:payState(o),no:'INV-'+o.code,date:iso(new Date())}}
function makeInvoice(d){
  const {B,o}=d,p=PDFPage(),G='#0b3a22',Y='#f2c230',GR='#5a6b61',INK='#10241a';
  p.rect(0,0,595,104,G);p.logo(36,28,44);p.text(B.name||'Rumah Cetak',92,56,22,'F3','#ffffff');p.text(B.tagline||'',92,74,9.5,'F1','#bfe3c6');
  p.text('INVOICE',559,52,24,'F2',Y,'r');p.text(d.no,559,70,10,'F1','#ffffff','r');p.text('Tanggal: '+tglID(d.date),559,85,9.5,'F1','#bfe3c6','r');
  p.rect(0,104,595,5,Y);
  const lunas=d.st[0]==='lunas',sc=lunas?'#dff5d8':'#fde1df',tc=lunas?'#0d5a22':'#b3261e',stx=lunas?'LUNAS':(d.paid>0?'BELUM LUNAS':'BELUM DIBAYAR');
  const sw=strW(stx,13,true)+30;p.rrect(559-sw,124,sw,28,7,sc);p.text(stx,559-sw/2,143,13,'F2',tc,'c');
  p.text('DITAGIHKAN KEPADA',36,134,8.5,'F2',GR);p.text(o.client_name||'Pelanggan',36,153,13,'F2',INK);
  let ly=169;if(o.client_wa){p.text('WhatsApp: '+o.client_wa,36,ly,10,'F1',GR);ly+=14}p.text('Kode pesanan: '+o.code,36,ly,10,'F1',GR);
  p.rect(36,200,523,24,G);p.text('DESKRIPSI',46,216,9,'F2','#ffffff');p.text('JML',380,216,9,'F2','#ffffff','r');p.text('HARGA SATUAN',470,216,9,'F2','#ffffff','r');p.text('TOTAL',549,216,9,'F2','#ffffff','r');
  const qty=+o.qty||1,unit=(+o.price||0)/qty;
  p.text(o.product||'Pesanan',46,243,11,'F2',INK);p.text(TYPES[o.type]||'',46,257,9,'F1',GR);
  p.text(String(qty),380,243,10.5,'F1',INK,'r');p.text(RP(unit),470,243,10.5,'F1',INK,'r');p.text(RP(o.price),549,243,10.5,'F2',INK,'r');
  p.line(36,270,559,270,'#e3e8df',.8);
  const ty=290;p.text('Total tagihan',380,ty+10,10.5,'F1',INK);p.text(RP(o.price),549,ty+10,10.5,'F2',INK,'r');
  p.text('Sudah dibayar',380,ty+30,10.5,'F1',INK);p.text(RP(d.paid),549,ty+30,10.5,'F1',INK,'r');
  p.rrect(366,ty+40,193,30,6,lunas?'#dff5d8':'#fff1c2');p.text('Sisa tagihan',376,ty+60,11,'F2',INK);p.text(RP(d.sisa),549,ty+60,12,'F2',INK,'r');
  p.text('RIWAYAT PEMBAYARAN',36,ty+8,8.5,'F2',GR);let py=ty+26;
  if(!d.pays.length){p.text('Belum ada pembayaran.',36,py,9.5,'F1',GR)}else{d.pays.slice(0,6).forEach(x=>{p.text(`${tglID(x.date)} · ${x.method}${x.note?' · '+x.note:''}`.slice(0,52),36,py,9.5,'F1',INK);p.text(RP(x.amount),330,py,9.5,'F2',INK,'r');py+=15});if(d.pays.length>6){p.text(`dan ${d.pays.length-6} pembayaran lainnya`,36,py,9,'F1',GR);py+=14}}
  let y=Math.max(py,ty+90)+22;p.line(36,y-12,559,y-12,'#e3e8df',.8);
  p.text(lunas?'KETERANGAN':'PETUNJUK PEMBAYARAN',36,y,8.5,'F2',GR);y+=18;
  if(lunas){p.text('Pembayaran telah kami terima penuh. Terima kasih.',36,y,10.5,'F1',INK);y+=16}
  else{if(B.banks.length)B.banks.slice(0,5).forEach(b=>{p.text(`${b.bank}  ${b.no}`,36,y,11,'F2',INK);p.text(`a.n. ${b.an}`,36+strW(`${b.bank}  ${b.no}`,11,true)+12,y,10,'F1',GR);y+=16});else{p.text('Hubungi kami untuk informasi pembayaran.',36,y,10.5,'F1',INK);y+=16}
    y+=4;if(o.deadline){p.text(`Estimasi / tenggat pesanan: ${tglID(o.deadline)}`,36,y,10,'F1',INK);y+=15}
    p.text('Mohon konfirmasi pembayaran dengan mengirim bukti transfer.',36,y,10,'F1',INK);y+=16}
  if(B.note){y+=8;wrapT(B.note,9.5,480).slice(0,4).forEach(l=>{p.text(l,36,y,9.5,'F1',GR);y+=13})}
  let trk=C.siteUrl+'/lacak/?kode='+o.code;p.text('Pantau status pesanan: '+trk.replace(/^https?:\/\//,''),297,774,9,'F1',GR,'c');
  p.rect(0,792,595,50,G);const ct=[B.address,B.wa?'WA '+B.wa:'',B.email,B.ig?'@'+String(B.ig).replace(/^@/,''):''].filter(Boolean).join('  ·  ')||C.siteUrl.replace(/^https?:\/\//,'');
  wrapT(ct,9,520).slice(0,2).forEach((l,i)=>p.text(l,297,813+i*12,9,'F1','#ffffff','c'));
  return p.build()}
function capFor(d){
  const o=d.o,B=d.B,nama=o.client_name?'Kak '+o.client_name:'Kak',pr=o.product||'pesanan',trk=`${C.siteUrl}/lacak/?kode=${o.code}`;
  const head=`Halo ${nama}, salam dari ${B.name||'Rumah Cetak'}.`,foot=`\n\nKode lacak pesanan: ${o.code}\nPantau status di: ${trk}\n\nTerima kasih.`;
  const banks=B.banks.length?'\n\nPembayaran dapat ditransfer ke:\n'+B.banks.map(b=>`• ${b.bank} ${b.no} a.n. ${b.an}`).join('\n'):'';
  if(d.st[0]==='lunas')return `${head}\n\nTerima kasih, pembayaran untuk ${pr} sebesar ${RP(o.price)} sudah kami terima (LUNAS). Invoice terlampir sebagai bukti pembayaran.${foot}`;
  if(d.paid===0)return `${head}\n\nTerima kasih sudah memesan ${pr}. Berikut kami kirimkan invoice ${d.no} dengan total ${RP(o.price)}. Agar pesanan dapat segera kami proses, mohon melakukan pembayaran sesuai invoice terlampir.${banks}${foot}`;
  if(o.stage==='selesai')return `${head}\n\nPesanan ${pr} Anda sudah selesai. Kami mengingatkan dengan hormat bahwa masih ada sisa pembayaran sebesar ${RP(d.sisa)} (total ${RP(o.price)}, sudah dibayar ${RP(d.paid)}). Mohon berkenan melunasinya sesuai invoice terlampir. Jika sudah membayar, mohon abaikan pesan ini dan kirimkan bukti transfernya kepada kami.${banks}${foot}`;
  return `${head}\n\nTerima kasih atas pembayaran ${RP(d.paid)} untuk ${pr}. Berikut invoice ${d.no} terbaru: sisa pembayaran ${RP(d.sisa)} dari total ${RP(o.price)}, mohon dilunasi sebelum pesanan selesai atau diambil.${banks}${foot}`}
function waNum(s){let n=String(s||'').replace(/\D/g,'');if(n.startsWith('0'))n='62'+n.slice(1);return n}
function invModal(oid){
  const o=S.orders.find(x=>x.id===oid);if(!o)return;const d=invData(o),name=`invoice-${o.code}.pdf`;
  const m=modal(`<h3>Invoice ${esc(d.no)}</h3><p style="color:var(--mut);margin:.1rem 0 .6rem">${esc(o.client_name)||'-'} · ${esc(o.product)||'-'}</p>
  <div class="sumline"><span>Total</span><b>${RP(o.price)}</b></div><div class="sumline"><span>Sudah dibayar</span><b>${RP(d.paid)}</b></div><div class="sumline b"><span>Sisa <span class="pill ${d.st[2]}">${d.st[1]}</span></span><span>${RP(d.sisa)}</span></div>
  ${(+o.price||0)<=0?'<p class="err">Harga pesanan masih Rp 0. Isi harga di pesanan sebelum mengirim invoice.</p>':''}${!d.B.banks.length&&d.sisa>0?'<p class="err">Rekening pembayaran belum diisi. Isi di Pengaturan agar tercetak di invoice.</p>':''}
  <label for="cap">Caption WhatsApp (bisa diedit)</label><textarea id="cap" rows="9">${esc(capFor(d))}</textarea>
  <div class="acts"><button class="btn sec" id="pay">Catat pembayaran</button><button class="btn sec" id="cpc">Salin caption</button><button class="btn sec" id="wa">Buka WhatsApp</button><button class="btn sec" id="dlp">Unduh PDF</button><button class="btn" id="sh">Bagikan PDF + caption</button></div><div class="err" id="er"></div><div class="acts" style="margin-top:.2rem"><button class="btn sec" id="x">Tutup</button></div>`);
  const cap=()=>$('#cap',m).value;
  $('#x',m).onclick=()=>m.remove();$('#pay',m).onclick=()=>{m.remove();payModal(oid)};
  $('#cpc',m).onclick=()=>navigator.clipboard.writeText(cap()).then(()=>toast('Caption disalin'),()=>toast('Gagal menyalin'));
  $('#dlp',m).onclick=()=>saveBlob(makeInvoice(d),name);
  $('#wa',m).onclick=()=>window.open(`https://wa.me/${waNum(o.client_wa)}?text=${encodeURIComponent(cap())}`,'_blank','noopener');
  $('#sh',m).onclick=async()=>{const blob=makeInvoice(d),file=new File([blob],name,{type:'application/pdf'});
    try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:cap(),title:'Invoice '+d.no});return}}catch(e){if(e&&e.name==='AbortError')return}
    saveBlob(blob,name);$('#er',m).textContent='Perangkat ini belum bisa melampirkan file otomatis. PDF sudah diunduh; WhatsApp dibuka dengan caption, lalu lampirkan PDF-nya.';
    window.open(`https://wa.me/${waNum(o.client_wa)}?text=${encodeURIComponent(cap())}`,'_blank','noopener')};
}


/* ---------- ATURAN HARGA (semua layanan) ---------- */
const DEFCALC={"addWeb":75000,"fisik":{"min":100,"hemat":1650,"biasa":2000},"types":[{"label":"Undangan Fisik Jasmine Glitter (Softcover)","k":"fisik"},{"label":"Undangan Fisik Art Carton 260gsm","k":"fisik"},{"label":"Undangan Vintage Kraft + Tali Rami","k":"fisik"},{"label":"Undangan Fisik Linen","k":"fisik"},{"label":"Stiker Label Kemasan Kiss-Cut (min. 100 pcs)","k":"umkm","price":600,"min":100},{"label":"Kartu Ucapan / Thank You Card (min. 100 pcs)","k":"umkm","price":1500,"min":100},{"label":"Undangan Web Interaktif (1 tema)","k":"flat","price":75000,"web":1},{"label":"Video Undangan Reels (1 video)","k":"flat","price":50000}]};
const KIND={fisik:'Undangan fisik (aturan bertingkat di atas)',umkm:'Per pcs dengan minimal pesan',flat:'Harga tetap per paket'};
function calcState(){const c=S.settings.calc||{};return {addWeb:c.addWeb!=null?c.addWeb:DEFCALC.addWeb,types:(c.types&&c.types.length?c.types:DEFCALC.types).map(t=>({...t}))}}
function priceCard(K,CA){return `<div class="card" style="margin-top:.8rem"><h3>Aturan harga</h3><p style="color:var(--mut);margin:.2rem 0">Dipakai kalkulator “Simulasi Biaya” di web utama. Atur harga semua layanan di sini.</p>
  <form id="kf"><h3 style="font-size:1.05rem;margin:.8rem 0 0">Undangan fisik (bertingkat)</h3><p style="color:var(--mut);margin:.2rem 0">1 sampai (batas−1) lembar = jumlah × harga biasa. Batas ke atas = jumlah × harga hemat.</p>
  <div class="row3"><div><label for="k1">Batas minimal hemat (lembar)</label><input id="k1" type="number" min="2" value="${K.min}"></div><div><label for="k2">Harga hemat / lembar</label><input id="k2" type="number" min="0" value="${K.hemat}"></div><div><label for="k3">Harga biasa / lembar</label><input id="k3" type="number" min="0" value="${K.biasa}"></div></div>
  <h3 style="font-size:1.05rem;margin:1rem 0 0">Daftar layanan di kalkulator</h3><p style="color:var(--mut);margin:.2rem 0">Urutan di sini = urutan pilihan di web. Jenis “Undangan fisik” memakai aturan bertingkat di atas.</p>
  <div id="tl">${CA.types.map(trow).join('')}</div><button type="button" class="btn sm sec" id="atl">+ Layanan</button>
  <label for="kw">Tambahan undangan web (Rp), untuk kotak centang di kalkulator</label><input id="kw" type="number" min="0" value="${CA.addWeb}" style="max-width:260px">
  <div class="err" id="ker"></div><div class="acts"><button class="btn">Simpan aturan harga</button></div></form></div>`}
const trow=(t,i)=>`<div class="card" style="padding:.7rem;margin:.5rem 0" data-r="${i}"><div class="row2"><div><label>Nama layanan</label><input class="tn" value="${esc(t.label)}"></div><div><label>Jenis</label><select class="tk">${Object.entries(KIND).map(([k,v])=>`<option value="${k}" ${t.k===k?'selected':''}>${v}</option>`).join('')}</select></div></div>
  <div class="row3"><div><label>Harga (Rp)</label><input class="tp" type="number" min="0" value="${t.price??''}" ${t.k==='fisik'?'disabled':''}></div><div><label>Minimal pesan (pcs)</label><input class="tm" type="number" min="1" value="${t.min??''}" ${t.k==='umkm'?'':'disabled'}></div>
  <div style="display:flex;gap:.4rem;align-items:end;flex-wrap:wrap"><label class="sw" style="margin:0 0 .65rem"><input class="tw" type="checkbox" ${t.web?'checked':''} style="width:auto;min-height:0"> Undangan web</label><span class="sp"></span><button type="button" class="btn sm sec" data-tu="${i}" aria-label="Naik">↑</button><button type="button" class="btn sm sec" data-td="${i}" aria-label="Turun">↓</button><button type="button" class="btn sm d" data-tr="${i}" aria-label="Hapus">×</button></div></div></div>`;
function priceWire(K,CA){
  const rows=()=>[...document.querySelectorAll('#tl [data-r]')].map(r=>({label:$('.tn',r).value.trim(),k:$('.tk',r).value,price:+$('.tp',r).value||0,min:+$('.tm',r).value||0,web:$('.tw',r).checked}));
  const draw=a=>{$('#tl').innerHTML=a.map(trow).join('');wire()};
  const wire=()=>{document.querySelectorAll('#tl .tk').forEach(el=>el.onchange=()=>draw(rows()));
    document.querySelectorAll('#tl [data-tr]').forEach(b=>b.onclick=()=>{const a=rows();a.splice(+b.dataset.tr,1);draw(a)});
    const mv=(i,j)=>{const a=rows();if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];draw(a)};
    document.querySelectorAll('#tl [data-tu]').forEach(b=>b.onclick=()=>mv(+b.dataset.tu,+b.dataset.tu-1));document.querySelectorAll('#tl [data-td]').forEach(b=>b.onclick=()=>mv(+b.dataset.td,+b.dataset.td+1))};
  wire();$('#atl').onclick=()=>draw([...rows(),{label:'',k:'flat',price:0,min:0,web:false}]);
  $('#kf').onsubmit=async e=>{e.preventDefault();const er=t=>$('#ker').textContent=t;
    const n={min:Math.max(2,+$('#k1').value||100),hemat:+$('#k2').value||0,biasa:+$('#k3').value||0};
    const types=rows().filter(t=>t.label).map(t=>{const o={label:t.label,k:t.k};if(t.k!=='fisik')o.price=t.price;if(t.k==='umkm'&&t.min)o.min=t.min;if(t.web)o.web=1;return o});
    if(!types.length)return er('Tambahkan minimal satu layanan.');
    if(types.some(t=>t.k!=='fisik'&&!(t.price>0)))return er('Isi harga untuk semua layanan (kecuali jenis undangan fisik).');
    if(n.hemat>n.biasa&&!confirm('Harga hemat lebih mahal dari harga biasa. Lanjutkan?'))return;
    if(S.settings.bundles){const tok=o=>[[RP(o.hemat),'§H'],[RP(o.biasa),'§B'],['min. '+o.min,'§m'],['Min. '+o.min,'§M']];let js=JSON.stringify(S.settings.bundles);
      tok(K).forEach(([a,b])=>js=js.split(a).join(b));tok(n).forEach(([a,b])=>js=js.split(b).join(a));await saveSet('bundles',JSON.parse(js),true)}
    await saveSet('fisik',n,true);await saveSet('calc',{addWeb:+$('#kw').value||0,fisik:n,types});toast('Aturan harga tersimpan. Web menampilkan versi baru pada kunjungan berikutnya.')}}

/* ---------- GALERI ---------- */
const sx=t=>String(t??'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function uploadImg(file,folder,max){const blob=await shrink(file,max||1600,.82),path=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.jpg`;
  const {error}=await sb.storage.from('media').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});if(error)throw error;
  return {url:sb.storage.from('media').getPublicUrl(path).data.publicUrl,kb:Math.round(blob.size/1024)}}
const storagePath=u=>{const m=String(u).match(/\/object\/public\/media\/(.+)$/);return m?m[1]:null};
function vGallery(){
  if(!S.t4){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 4</h3><p>Jalankan <code>sql/schema-tahap4.sql</code> di Supabase SQL Editor, lalu muat ulang halaman ini.</p></div>';return}
  const G=[...S.gallery].sort((a,b)=>(a.sort-b.sort)||(a.id-b.id));
  $('#topact').innerHTML='<label class="btn" style="cursor:pointer">+ Unggah foto<input id="gf" type="file" accept="image/*" multiple hidden></label>';
  $('#view').innerHTML=`<p style="color:var(--mut);margin:0 0 .8rem">Foto tampil di halaman <b>Galeri</b> web utama. Foto dikompres otomatis (maks. 1600 px). Isi keterangan agar mudah dilihat pengunjung.</p><div id="up" class="err" style="color:var(--mut)"></div>
  ${G.length?`<div class="grid4" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${G.map((g,i)=>`<div class="card" style="padding:.6rem"><img src="${esc(g.img)}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block;background:var(--cr2)"><div style="margin:.5rem 0;min-height:2.6em">${g.cap?esc(g.cap):'<small style="color:var(--mut)">tanpa keterangan</small>'}</div>
   <div class="tools" style="margin:0"><label class="sw"><input type="checkbox" data-a="${g.id}" ${g.active?'checked':''} style="width:auto;min-height:0"> Tampil</label><span class="sp"></span><button class="btn sm sec" data-gu="${i}" ${i?'':'disabled'} aria-label="Naik">↑</button><button class="btn sm sec" data-gd="${i}" ${i<G.length-1?'':'disabled'} aria-label="Turun">↓</button><button class="btn sm sec" data-ge="${g.id}">Ubah</button></div></div>`).join('')}</div>`:'<div class="card empty">Belum ada foto. Klik “+ Unggah foto”.</div>'}`;
  $('#gf').onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;let ok=0,max=Math.max(0,...S.gallery.map(g=>g.sort||0));
    for(const [i,f] of fs.entries()){$('#up').textContent=`Mengunggah ${i+1} dari ${fs.length}…`;
      try{const u=await uploadImg(f,'galeri');const {error}=await sb.from('gallery_items').insert({img:u.url,cap:'',sort:++max});if(error)throw error;ok++}catch(x){toast('Gagal: '+(x.message||x))}}
    await loadAll();route();toast(ok+' foto terunggah')};
  $('#view').querySelectorAll('[data-a]').forEach(b=>b.onchange=async()=>{const {error}=await sb.from('gallery_items').update({active:b.checked}).eq('id',b.dataset.a);error?toast(error.message):(await loadAll(),toast('Tersimpan'))});
  const move=async(i,j)=>{const a=G[i],b=G[j];if(!a||!b)return;let sa=a.sort||0,sb2=b.sort||0;if(sa===sb2)sb2=sa+(j>i?1:-1);
    const r1=await sb.from('gallery_items').update({sort:sb2}).eq('id',a.id),r2=await sb.from('gallery_items').update({sort:sa}).eq('id',b.id);if(r1.error||r2.error)return toast('Gagal mengubah urutan');await loadAll();route()};
  $('#view').querySelectorAll('[data-gu]').forEach(b=>b.onclick=()=>move(+b.dataset.gu,+b.dataset.gu-1));$('#view').querySelectorAll('[data-gd]').forEach(b=>b.onclick=()=>move(+b.dataset.gd,+b.dataset.gd+1));
  $('#view').querySelectorAll('[data-ge]').forEach(b=>b.onclick=()=>galForm(S.gallery.find(g=>g.id==b.dataset.ge)));
}
function galForm(g){
  const m=modal(`<h3>Ubah foto</h3><img src="${esc(g.img)}" alt="" style="width:100%;max-height:260px;object-fit:contain;border-radius:12px;background:var(--cr2)"><form id="f"><label for="cp">Keterangan</label><input id="cp" value="${esc(g.cap)}" maxlength="140" placeholder="mis. Undangan Jasmine Glitter, pernikahan Anisa & Dimas"><div class="err" id="er"></div>
  <div class="acts"><button type="button" class="btn d" id="del">Hapus</button><button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  $('#del',m).onclick=async()=>{if(!confirm('Hapus foto ini dari galeri?'))return;const {error}=await sb.from('gallery_items').delete().eq('id',g.id);if(error)return toast(error.message);const p=storagePath(g.img);if(p)await sb.storage.from('media').remove([p]);m.remove();await loadAll();route();toast('Dihapus')};
  $('#f',m).onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('gallery_items').update({cap:$('#cp',m).value.trim()}).eq('id',g.id);if(error)return $('#er',m).textContent=error.message;m.remove();await loadAll();route();toast('Tersimpan')};
}

/* ---------- EDITOR WEBSITE ---------- */
const SECS=[['hero','Hero (judul dan gambar utama)'],['lacak','Kolom lacak pesanan'],['paket','Paket bundling'],['portofolio','Portofolio'],['etalase','Etalase kategori'],['kalkulator','Kalkulator harga'],['tentang','Tentang dan ulasan'],['faq','Pertanyaan umum']];
const TH=[['g','Hijau utama','#1a7a2e'],['dk','Hijau tua','#0b3a22'],['y','Kuning aksen','#f2c230'],['cr','Latar halaman','#fbfaf3'],['cr2','Latar bagian selang-seling','#f4f2e4'],['ink','Warna teks','#10241a']];
const PRESETS=[['Bawaan',{}],['Hijau pekat',{g:'#136b27',dk:'#08301b',y:'#f2c230',cr:'#fbfaf3',cr2:'#eef3e6',ink:'#0e2216'}],['Krem hangat',{g:'#1a7a2e',dk:'#0b3a22',y:'#e8b923',cr:'#fdf8ec',cr2:'#f6edd6',ink:'#1b2a1f'}]];
const FONTS=[['','Bawaan (Playfair Display)'],['Cormorant Garamond','Cormorant Garamond (elegan)'],['Lora','Lora (serif hangat)'],['Poppins','Poppins (modern, tanpa serif)']];
const HD={badge:'Percetakan & Studio Kreatif Rumahan',title:'Dari Momen Bahagia hingga Kemasan Usaha,',em:'Rumah Cetak Solusinya.',lead:'Satu Tempat, Cetak Komplet.',text:'Kami hadir memadukan keanggunan undangan cetak fisik bertekstur, kepraktisan undangan web digital interaktif & video reels, hingga stiker label kemasan UMKM siap tempel.',b1:'Pilih Paket Bundling',b2:'Coba Demo Undangan HP'};
const hexL=h=>{const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a,b)=>{const x=hexL(a),y=hexL(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const getp=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setp=(o,p,v)=>{const ks=p.split('.');let a=o;ks.slice(0,-1).forEach(k=>a=a[k]=a[k]||{});if(v===''||v==null||v===false)delete a[ks[ks.length-1]];else a[ks[ks.length-1]]=v};
function vEditor(){
  if(!S.t4||!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL</h3><p>Editor memerlukan <code>sql/schema-tahap2.sql</code> dan <code>sql/schema-tahap4.sql</code> di Supabase. Jalankan keduanya, lalu muat ulang.</p></div>';return}
  let E=JSON.parse(JSON.stringify(S.settings.site_draft||S.settings.site||{})),dirty=false,device='d';
  const order=()=>{const o=(E.sections&&E.sections.order)||[],ids=SECS.map(s=>s[0]);return [...o.filter(x=>ids.includes(x)),...ids.filter(x=>!o.includes(x))]};
  let origin='';try{origin=new URL(C.siteUrl).origin}catch(e){}
  $('#topact').innerHTML='<button class="btn sec" id="hist">Riwayat versi</button> <button class="btn sec" id="rs">Kembalikan bawaan</button> <button class="btn sec" id="sd">Simpan draf</button> <button class="btn y" id="pb">Terbitkan</button>';
  const fld=(k,l,ph,rows)=>`<label for="e_${k}">${l}</label>${rows?`<textarea id="e_${k}" data-k="${k}" rows="${rows}" placeholder="${esc(ph||'')}">${esc(getp(E,k)||'')}</textarea>`:`<input id="e_${k}" data-k="${k}" value="${esc(getp(E,k)||'')}" placeholder="${esc(ph||'')}">`}`;
  const draw=()=>{const th=E.theme||{},hr=E.hero||{},bg=hr.bg||'default';
    $('#view').innerHTML=`<div class="edwrap"><div class="edform">
    <div class="card"><h3>Warna</h3><div class="tools" style="margin:.4rem 0">${PRESETS.map((p,i)=>`<button class="btn sm sec" data-ps="${i}">${p[0]}</button>`).join('')}</div>
     ${TH.map(t=>`<div class="clr"><label for="c_${t[0]}" style="margin:0;flex:1">${t[1]}</label><input id="c_${t[0]}" type="color" data-c="${t[0]}" value="${th[t[0]]||t[2]}"><button class="btn sm sec" data-cr="${t[0]}" ${th[t[0]]?'':'disabled'}>Bawaan</button></div>`).join('')}<div id="warn"></div></div>
    <div class="card" style="margin-top:.8rem"><h3>Hero (bagian paling atas)</h3>
     ${fld('hero.badge','Lencana kecil',HD.badge)}${fld('hero.title','Judul',HD.title)}${fld('hero.em','Judul — bagian miring berwarna',HD.em)}${fld('hero.lead','Kalimat tebal',HD.lead)}${fld('hero.text','Deskripsi',HD.text,3)}
     <div class="row2"><div>${fld('hero.b1','Tombol 1',HD.b1)}</div><div>${fld('hero.b2','Tombol 2',HD.b2)}</div></div>
     <label>Gambar hero (menggantikan ilustrasi)</label><div style="display:flex;gap:.6rem;align-items:center">${hr.img?`<img class="thumb" style="width:72px;height:54px" src="${esc(hr.img)}" alt="">`:''}<input type="file" id="hf" accept="image/*"><button class="btn sm d ${hr.img?'':'hide'}" data-ci="img">Hapus</button></div>
     <label for="hbg">Latar hero</label><select id="hbg" data-k="hero.bg"><option value="">Bawaan (titik-titik putih)</option><option value="solid" ${bg==='solid'?'selected':''}>Warna polos</option><option value="gradient" ${bg==='gradient'?'selected':''}>Gradasi</option><option value="image" ${bg==='image'?'selected':''}>Gambar</option></select>
     ${bg==='solid'||bg==='gradient'?`<div class="row2"><div><label>Warna 1</label><input type="color" data-k="hero.c1" value="${hr.c1||'#ffffff'}"></div>${bg==='gradient'?`<div><label>Warna 2</label><input type="color" data-k="hero.c2" value="${hr.c2||'#e9f6e6'}"></div>`:'<div></div>'}</div>`:''}
     ${bg==='image'?`<label>Gambar latar</label><div style="display:flex;gap:.6rem;align-items:center">${hr.bgImg?`<img class="thumb" style="width:72px;height:54px" src="${esc(hr.bgImg)}" alt="">`:''}<input type="file" id="hbf" accept="image/*"><button class="btn sm d ${hr.bgImg?'':'hide'}" data-ci="bgImg">Hapus</button></div><label>Kegelapan lapisan (${hr.shade??35}%)</label><input type="range" min="0" max="80" data-k="hero.shade" value="${hr.shade??35}">`:''}
     <label for="htc">Warna teks hero</label><select id="htc" data-k="hero.light"><option value="">Gelap (bawaan)</option><option value="1" ${hr.light?'selected':''}>Terang (untuk latar gelap)</option></select></div>
    <div class="card" style="margin-top:.8rem"><h3>Bagian beranda</h3><p style="color:var(--mut);margin:.2rem 0">Atur urutan dan tampilkan atau sembunyikan.</p>${order().map((id,i,a)=>`<div class="plist"><label class="sw nm"><input type="checkbox" data-sh="${id}" ${(E.sections&&E.sections.hidden||[]).includes(id)?'':'checked'} style="width:auto;min-height:0"> ${esc(SECS.find(s=>s[0]===id)[1])}</label><button class="btn sm sec" data-su="${i}" ${i?'':'disabled'} aria-label="Naik">↑</button><button class="btn sm sec" data-sd="${i}" ${i<a.length-1?'':'disabled'} aria-label="Turun">↓</button></div>`).join('')}
     <div class="row2"><div><label for="lw">Lebar halaman</label><select id="lw" data-k="layout.width"><option value="">Standar (1240 px)</option><option value="1100" ${getp(E,'layout.width')==='1100'?'selected':''}>Ramping (1100 px)</option><option value="1400" ${getp(E,'layout.width')==='1400'?'selected':''}>Lebar (1400 px)</option></select></div>
     <div><label for="lf">Posisi gambar hero (desktop)</label><select id="lf" data-k="layout.flip"><option value="">Di kanan (bawaan)</option><option value="1" ${getp(E,'layout.flip')?'selected':''}>Di kiri</option></select></div></div>
     <label for="ft">Font judul</label><select id="ft" data-k="font">${FONTS.map(f=>`<option value="${f[0]}" ${(E.font||'')===f[0]?'selected':''}>${f[1]}</option>`).join('')}</select></div>
    <div class="card" style="margin-top:.8rem"><h3>Profil usaha (halaman Galeri dan Tentang)</h3>${fld('aboutText','Satu paragraf per baris. Kosong = teks bawaan','',5)}</div></div>
    <div class="edprev"><div class="tools" style="margin:0 0 .5rem"><button class="btn sm ${device==='d'?'':'sec'}" data-dv="d">Desktop</button><button class="btn sm ${device==='m'?'':'sec'}" data-dv="m">HP</button><span class="sp"></span><small id="dst" style="color:var(--mut)"></small></div>
     <div class="pvf ${device==='m'?'mob':''}"><iframe id="pv" title="Pratinjau web utama" src="${esc(C.siteUrl)}/?preview=1"></iframe></div><p style="color:var(--mut);font-size:12px;margin:.4rem 0 0">Pratinjau memakai web utama yang sedang tayang. Jika perubahan tidak muncul, pastikan web v12 sudah diunggah.</p></div></div>`;
    wire();warn();status()};
  const send=()=>{const f=$('#pv');if(f&&f.contentWindow&&origin)f.contentWindow.postMessage({type:'rc-preview',site:E},origin)};
  const status=()=>{const s=$('#dst');if(s)s.textContent=dirty?'Ada perubahan yang belum disimpan':'Tersimpan'};
  const touch=()=>{dirty=true;status();send();warn()};
  const warn=()=>{const th={...Object.fromEntries(TH.map(t=>[t[0],t[2]])),...(E.theme||{})},w=[];
    if(contrast('#ffffff',th.g)<4.5)w.push('Teks putih di atas hijau utama kurang terbaca');if(contrast('#ffffff',th.dk)<4.5)w.push('Teks putih di atas hijau tua kurang terbaca');
    if(contrast(th.ink,th.cr)<4.5)w.push('Warna teks kurang kontras dengan latar halaman');if(contrast(th.ink,th.cr2)<4.5)w.push('Warna teks kurang kontras dengan latar selang-seling');
    const e=$('#warn');if(e)e.innerHTML=w.map(x=>`<p class="err">⚠ ${esc(x)}</p>`).join('')};
  const wire=()=>{const v=$('#view');
    v.querySelectorAll('[data-k]').forEach(el=>{const h=()=>{const k=el.dataset.k;let val=el.value;if(k==='hero.light'||k==='layout.flip')val=val?1:'';if(k==='hero.shade')val=+val;
        if(k==='aboutText'){setp(E,'about',val.split('\n').map(x=>x.trim()).filter(Boolean))}else setp(E,k,val);touch();if(k==='hero.bg'){draw()}};el.addEventListener(el.tagName==='SELECT'?'change':'input',h)});
    v.querySelectorAll('[data-c]').forEach(el=>el.addEventListener('input',()=>{setp(E,'theme.'+el.dataset.c,el.value);const b=v.querySelector(`[data-cr="${el.dataset.c}"]`);if(b)b.disabled=false;touch()}));
    v.querySelectorAll('[data-cr]').forEach(b=>b.onclick=()=>{setp(E,'theme.'+b.dataset.cr,'');touch();draw()});
    v.querySelectorAll('[data-ps]').forEach(b=>b.onclick=()=>{E.theme={...PRESETS[+b.dataset.ps][1]};touch();draw()});
    v.querySelectorAll('[data-sh]').forEach(b=>b.onchange=()=>{const h=new Set((E.sections&&E.sections.hidden)||[]);b.checked?h.delete(b.dataset.sh):h.add(b.dataset.sh);setp(E,'sections.order',order());E.sections.hidden=[...h];touch()});
    const mv=(i,j)=>{const o=order();[o[i],o[j]]=[o[j],o[i]];setp(E,'sections.order',o);E.sections.hidden=E.sections.hidden||[];touch();draw()};
    v.querySelectorAll('[data-su]').forEach(b=>b.onclick=()=>mv(+b.dataset.su,+b.dataset.su-1));v.querySelectorAll('[data-sd]').forEach(b=>b.onclick=()=>mv(+b.dataset.sd,+b.dataset.sd+1));
    v.querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{device=b.dataset.dv;v.querySelector('.pvf').classList.toggle('mob',device==='m');v.querySelectorAll('[data-dv]').forEach(x=>x.classList.toggle('sec',x.dataset.dv!==device))});
    v.querySelectorAll('[data-ci]').forEach(b=>b.onclick=()=>{setp(E,'hero.'+b.dataset.ci,'');touch();draw()});
    const up=(id,key)=>{const el=$('#'+id);if(el)el.onchange=async e=>{const f=e.target.files[0];if(!f)return;$('#dst').textContent='Mengunggah…';try{const u=await uploadImg(f,'hero',1800);setp(E,'hero.'+key,u.url);touch();draw();toast('Gambar terunggah ('+u.kb+' KB)')}catch(x){toast('Gagal unggah: '+(x.message||x));status()}}};
    up('hf','img');up('hbf','bgImg');
    const ab=$('#e_aboutText');if(ab)ab.value=(E.about||[]).join('\n');
    const f=$('#pv');if(f)f.addEventListener('load',send)};
  draw();
  const clean=()=>{const o=JSON.parse(JSON.stringify(E));if(o.sections&&!(o.sections.hidden||[]).length&&JSON.stringify(o.sections.order)===JSON.stringify(SECS.map(s=>s[0])))delete o.sections;return o};
  $('#sd').onclick=async()=>{const {error}=await sb.from('settings').upsert({key:'site_draft',value:clean(),updated_at:new Date().toISOString()});if(error)return toast('Gagal: '+error.message);S.settings.site_draft=clean();dirty=false;status();toast('Draf tersimpan')};
  $('#pb').onclick=async()=>{if(!confirm('Terbitkan tampilan ini ke web utama? Pengunjung akan melihatnya pada kunjungan berikutnya.'))return;
    const v=clean(),now=new Date().toISOString(),label=(prompt('Nama versi (opsional):','')||'').trim();
    const r1=await sb.from('settings').upsert([{key:'site',value:v,updated_at:now},{key:'site_draft',value:v,updated_at:now}]);if(r1.error)return toast('Gagal: '+r1.error.message);
    const r2=await sb.from('site_versions').insert({label,value:v});await loadAll();dirty=false;status();toast(r2.error?'Terbit, tetapi riwayat gagal dicatat':'Diterbitkan')};
  $('#rs').onclick=()=>{if(!confirm('Kembalikan semua pengaturan tampilan ke bawaan? (belum diterbitkan sampai Anda menekan Terbitkan)'))return;E={};touch();draw()};
  $('#hist').onclick=()=>{const m=modal(`<h3>Riwayat versi</h3><p style="color:var(--mut);margin:.1rem 0 .6rem">Versi yang pernah diterbitkan. “Pakai di draf” memuat ke editor; tekan Terbitkan untuk menayangkannya.</p>${S.versions.length?S.versions.map(x=>`<div class="plist"><div class="nm"><b>${esc(x.label)||'Tanpa nama'}</b><br><small>${new Date(x.created_at).toLocaleString('id-ID')}</small></div><button class="btn sm sec" data-pv="${x.id}">Pakai di draf</button></div>`).join(''):'<div class="empty">Belum ada versi diterbitkan.</div>'}<div class="acts"><button class="btn sec" id="x">Tutup</button></div>`);
    $('#x',m).onclick=()=>m.remove();m.querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>{const x=S.versions.find(v=>v.id==b.dataset.pv);E=JSON.parse(JSON.stringify(x.value||{}));m.remove();touch();draw()})};
}

/* ---------- PENGATURAN ---------- */
function vSettings(){
  if(!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 2</h3><p>Pengaturan disimpan di tabel settings. Jalankan <code>sql/schema-tahap2.sql</code> di Supabase, lalu muat ulang.</p></div>';return}
  const B=biz(),banks=(B.banks&&B.banks.length?B.banks:[]).map(x=>({...x}));
  const bankRow=(b,i)=>`<div class="row3" data-bk="${i}" style="align-items:end"><div><label>Bank / e-wallet</label><input class="bb" value="${esc(b.bank)}" placeholder="BCA, DANA, …"></div><div><label>Nomor</label><input class="bn" value="${esc(b.no)}" inputmode="numeric"></div><div style="display:flex;gap:.4rem"><div style="flex:1"><label>Atas nama</label><input class="ba" value="${esc(b.an)}"></div><button type="button" class="btn sm d" data-rm="${i}" aria-label="Hapus">×</button></div></div>`;
  $('#view').innerHTML=`<form id="sf"><div class="card"><h3>Data usaha</h3><p style="color:var(--mut);margin:.2rem 0">Dipakai di invoice dan pesan WhatsApp.</p>
   <div class="row2"><div><label for="bname">Nama usaha</label><input id="bname" value="${esc(B.name)}"></div><div><label for="btag">Tagline</label><input id="btag" value="${esc(B.tagline)}"></div></div>
   <label for="badr">Alamat</label><input id="badr" value="${esc(B.address)}" placeholder="Jalan, kota">
   <div class="row3"><div><label for="bwa">Nomor WhatsApp usaha</label><input id="bwa" inputmode="tel" value="${esc(B.wa)}" placeholder="62812…"></div><div><label for="bem">Email</label><input id="bem" type="email" value="${esc(B.email)}"></div><div><label for="big">Instagram</label><input id="big" value="${esc(B.ig)}" placeholder="rumahcetak"></div></div></div>
   <div class="card" style="margin-top:.8rem"><h3>Rekening pembayaran</h3><p style="color:var(--mut);margin:.2rem 0">Tercetak di invoice dan caption WhatsApp.</p><div id="bks">${banks.map(bankRow).join('')}</div><button type="button" class="btn sm sec" id="abk" style="margin-top:.6rem">+ Rekening / e-wallet</button>
   <label for="bnote">Catatan di bagian bawah invoice</label><textarea id="bnote" rows="3">${esc(B.note)}</textarea></div>
   <div class="acts"><button class="btn">Simpan pengaturan</button></div></form>
   <div class="card" style="margin-top:.8rem"><h3>Backup data</h3><p style="color:var(--mut)">Paket gratis Supabase tidak punya backup otomatis. Unduh minimal seminggu sekali dan simpan di Google Drive Anda. File berisi data pelanggan, jadi jangan dibagikan.</p><button class="btn" id="bk">Unduh semua data (.json)</button></div>`;
  const rows=()=>[...document.querySelectorAll('#bks [data-bk]')].map(r=>({bank:$('.bb',r).value.trim(),no:$('.bn',r).value.trim(),an:$('.ba',r).value.trim()}));
  const redraw=a=>{$('#bks').innerHTML=a.map(bankRow).join('');wire()};
  const wire=()=>document.querySelectorAll('#bks [data-rm]').forEach(b=>b.onclick=()=>{const a=rows();a.splice(+b.dataset.rm,1);redraw(a)});
  wire();$('#abk').onclick=()=>redraw([...rows(),{bank:'',no:'',an:''}]);
  $('#sf').onsubmit=async e=>{e.preventDefault();const v=id=>$('#'+id).value.trim();
    await saveSet('biz',{name:v('bname'),tagline:v('btag'),address:v('badr'),wa:v('bwa'),email:v('bem'),ig:v('big'),banks:rows().filter(b=>b.bank&&b.no),note:v('bnote')})};
  $('#bk').onclick=()=>{saveBlob(new Blob([JSON.stringify({dibuat:new Date().toISOString(),categories:S.cats,products:S.products,orders:S.orders,payments:S.payments,reviews:S.reviews,expenses:S.expenses,settings:S.settings},null,1)],{type:'application/json'}),'rumahcetak-backup-'+iso(new Date())+'.json')};
}

sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')loginView()});
boot();
})();