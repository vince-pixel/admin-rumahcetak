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
let S={view:'dashboard',orders:[],products:[],cats:[],reviews:[],expenses:[],settings:{}};

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
async function loadAll(){
  const [o,p,c,r,ex,st]=await Promise.all([
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('products').select('*').order('cat').order('sort').order('id'),
    sb.from('categories').select('*').order('sort'),
    sb.from('reviews').select('*').order('created_at',{ascending:false}),
    sb.from('expenses').select('*').order('date',{ascending:false}),
    sb.from('settings').select('*')]);
  const bad=[o,p,c,r].find(x=>x.error);
  S.expenses=ex.error?[]:(ex.data||[]);S.settings={};(st.data||[]).forEach(x=>S.settings[x.key]=x.value);S.t2=!ex.error&&!st.error;if(bad)toast('Gagal memuat: '+bad.error.message);
  S.orders=o.data||[];S.products=p.data||[];S.cats=c.data||[];S.reviews=r.data||[];
}

/* ---------- SHELL ---------- */
const NAV=[['dashboard','Dashboard'],['orders','Pesanan'],['products','Produk'],['finance','Keuangan'],['promo','Promo & Paket'],['reviews','Ulasan'],['backup','Backup']];
function shell(){
  root.innerHTML=`<div class="shell"><aside class="side" id="side"><div class="brand"><img src="assets/logo.svg" alt="">Rumah Cetak</div>
  ${NAV.map(n=>`<a class="nav" href="#${n[0]}" data-v="${n[0]}">${n[1]}${n[0]==='reviews'&&pending()?` <span class="pill w">${pending()}</span>`:''}</a>`).join('')}
  <div class="sp"></div><a class="nav" href="${esc(C.siteUrl)}" target="_blank" rel="noopener">Lihat web utama ↗</a><button class="out" id="out">Keluar</button></aside>
  <main class="main"><div class="top"><button class="btn sec burger" id="bg" aria-label="Menu">☰</button><h2 id="ttl"></h2><span id="topact"></span></div><div id="view"></div></main></div>`;
  $('#out').onclick=logout;$('#bg').onclick=()=>$('#side').classList.toggle('open');
  $('#side').addEventListener('click',e=>{if(e.target.closest('a.nav'))$('#side').classList.remove('open')});
  route();
}
const pending=()=>S.reviews.filter(r=>r.status==='menunggu').length;
window.addEventListener('hashchange',()=>{if($('#view'))route()});
function route(){
  const v=(location.hash||'#dashboard').slice(1);S.view=NAV.some(n=>n[0]===v)?v:'dashboard';
  document.querySelectorAll('a.nav[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===S.view));
  $('#ttl').textContent=NAV.find(n=>n[0]===S.view)[1];$('#topact').innerHTML='';
  ({dashboard:vDash,orders:vOrders,products:vProducts,finance:vFinance,promo:vPromo,reviews:vReviews,backup:vBackup})[S.view]();
}
function modal(html){const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="box" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('mousedown',e=>{if(e.target===m)m.remove()});document.body.append(m);return m}

/* ---------- DASHBOARD ---------- */
function vDash(){
  const now=new Date(),ym=now.toISOString().slice(0,7);
  const done=S.orders.filter(o=>o.stage==='selesai'),mo=done.filter(o=>(o.done_at||o.updated_at||o.created_at).slice(0,7)===ym);
  const sum=(a,k)=>a.reduce((s,o)=>s+(+o[k]||0),0);
  const omzet=sum(mo,'price'),laba=omzet-sum(mo,'cost');
  const act=S.orders.filter(o=>o.stage!=='selesai');
  const q=[...act].sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999')).slice(0,8);
  const sisa=act.reduce((s,o)=>s+Math.max(0,(+o.price||0)-(+o.dp||0)),0);
  $('#view').innerHTML=`<div class="grid4">
   <div class="card stat"><small>Omzet bulan ini</small><b>${RP(omzet)}</b><em>${mo.length} pesanan selesai</em></div>
   <div class="card stat"><small>Laba kotor bulan ini</small><b>${RP(laba)}</b><em>omzet − modal</em></div>
   <div class="card stat"><small>Pesanan berjalan</small><b>${act.length}</b><em>sisa tagihan ${RP(sisa)}</em></div>
   <div class="card stat"><small>Ulasan menunggu</small><b>${pending()}</b><em><a href="#reviews">Tinjau</a></em></div></div>
   <div class="card" style="margin-top:.8rem"><h3 style="margin-bottom:.6rem">Antrean pesanan</h3>${q.length?`<div class="wrap"><table class="tbl cards"><thead><tr><th>Kode</th><th>Klien</th><th>Produk</th><th>Tahap</th><th>Tenggat</th></tr></thead><tbody>
   ${q.map(o=>`<tr><td data-l="Kode"><b>${esc(o.code)}</b></td><td data-l="Klien">${esc(o.client_name)||'-'}</td><td data-l="Produk">${esc(o.product)||'-'}</td><td data-l="Tahap"><span class="pill">${esc(stageName(o.type,o.stage))}</span></td><td data-l="Tenggat">${dl(o)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pesanan berjalan.</div>'}</div>
   <p style="color:var(--mut);font-size:13px;margin-top:.8rem">Rekap lengkap, profit, dan unduhan ada di menu <a href="#finance">Keuangan</a>.</p>`;
}
function dl(o){if(!o.deadline)return '-';const d=Math.ceil((new Date(o.deadline)-new Date(new Date().toDateString()))/864e5);
  const c=d<0?'bad':d<=2?'w':'';return `<span class="pill ${c}">${o.deadline}${d<0?' (lewat)':d===0?' (hari ini)':''}</span>`}

/* ---------- ORDERS ---------- */
function vOrders(){
  $('#topact').innerHTML='<button class="btn" id="add">+ Pesanan</button>';$('#add').onclick=()=>orderForm();
  $('#view').innerHTML=`<div class="tools"><input id="q" placeholder="Cari kode, nama, produk…" aria-label="Cari"><select id="fs" aria-label="Filter"><option value="">Semua tahap</option><option value="aktif">Berjalan</option><option value="selesai">Selesai</option></select></div><div class="card"><div class="wrap" id="tb"></div></div>`;
  const draw=()=>{const q=$('#q').value.toLowerCase(),f=$('#fs').value;
    const rows=S.orders.filter(o=>(!f||(f==='selesai'?o.stage==='selesai':o.stage!=='selesai'))&&(o.code+o.client_name+o.product).toLowerCase().includes(q));
    $('#tb').innerHTML=rows.length?`<table class="tbl cards"><thead><tr><th>Kode</th><th>Klien</th><th>Produk</th><th>Total</th><th>Tahap</th><th>Tenggat</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr><td data-l="Kode"><b>${esc(o.code)}</b></td><td data-l="Klien">${esc(o.client_name)||'-'}</td><td data-l="Produk">${esc(o.product)||'-'} ${o.qty?`<small>×${o.qty}</small>`:''}</td><td data-l="Total">${RP(o.price)}</td><td data-l="Tahap"><span class="pill ${o.stage==='selesai'?'ok':''}">${esc(stageName(o.type,o.stage))}</span></td><td data-l="Tenggat">${dl(o)}</td><td><button class="btn sm sec" data-e="${o.id}">Ubah</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Tidak ada pesanan.</div>';
    $('#tb').querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>orderForm(S.orders.find(o=>o.id==b.dataset.e)))};
  $('#q').oninput=draw;$('#fs').onchange=draw;draw();
}
function orderForm(o){
  const n=!o;o=o||{code:rcode(),type:'fisik',stage:'diterima',qty:1,price:0,cost:0,dp:0};
  const m=modal(`<h3>${n?'Pesanan baru':'Ubah pesanan'}</h3><form id="f">
  <div class="row2"><div><label>Kode lacak (acak, bisa diganti)</label><input id="code" value="${esc(o.code)}" required pattern="[A-Za-z0-9\\-]{6,20}"></div>
  <div><label>Jenis</label><select id="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${o.type===k?'selected':''}>${v}</option>`).join('')}</select></div></div>
  <div class="row2"><div><label>Nama klien (tampil di ulasan)</label><input id="nm" value="${esc(o.client_name)}"></div><div><label>No. WhatsApp klien (privat)</label><input id="wa" inputmode="tel" value="${esc(o.client_wa)}" placeholder="62812…"></div></div>
  <div class="row2"><div><label>Produk (sama dengan nama di katalog)</label><input id="pr" list="pl" value="${esc(o.product)}"><datalist id="pl">${S.products.map(p=>`<option value="${esc(p.name)}">`).join('')}</datalist></div><div><label>Jumlah</label><input id="qty" type="number" min="1" value="${o.qty||1}"></div></div>
  <div class="row3"><div><label>Harga total (Rp)</label><input id="price" type="number" min="0" value="${o.price||0}"></div><div><label>Modal (Rp)</label><input id="cost" type="number" min="0" value="${o.cost||0}"></div><div><label>DP dibayar (Rp)</label><input id="dp" type="number" min="0" value="${o.dp||0}"></div></div>
  <div class="row2"><div><label>Tahap</label><select id="stage"></select></div><div><label>Tenggat</label><input id="dead" type="date" value="${o.deadline||''}"></div></div>
  <div id="ext"></div>
  <label>Catatan untuk klien (tampil di halaman lacak)</label><textarea id="note" rows="2" maxlength="300">${esc(o.note)}</textarea>
  <label>Tampil di halaman lacak sampai (kosong = selalu)</label><input id="su" type="date" value="${o.show_until||''}">
  <div class="err" id="er"></div>
  <div class="acts">${n?'':'<button type="button" class="btn sec" id="cp">Salin pesan WhatsApp</button><button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  const fillStage=()=>{const t=$('#type',m).value;$('#stage',m).innerHTML=STAGES[t].map(s=>`<option value="${s[0]}" ${o.stage===s[0]?'selected':''}>${s[1]}</option>`).join('');ext()};
  const ext=()=>{const t=$('#type',m).value,s=$('#stage',m).value;let h='';
    if((t==='fisik'||t==='umkm')&&(s==='dikirim'||s==='selesai'))h=`<div class="row2"><div><label>Kurir</label><input id="cr" list="cl" value="${esc(o.courier)}"><datalist id="cl"><option>JNE<option>J&T<option>SiCepat<option>AnterAja<option>Pos Indonesia</datalist></div><div><label>No. resi</label><input id="rs" value="${esc(o.resi)}"></div></div>`;
    if((t==='web'&&['aktif','selesai'].includes(s))||(t==='video'&&['siap','selesai'].includes(s)))h=`<label>${t==='web'?'Link undangan':'Link unduhan'}</label><input id="lk" type="url" value="${esc(o.link)}" placeholder="https://…">`;
    $('#ext',m).innerHTML=h};
  fillStage();$('#type',m).onchange=()=>{o.stage=STAGES[$('#type',m).value][0][0];fillStage()};$('#stage',m).onchange=ext;
  $('#x',m).onclick=()=>m.remove();
  if(!n){$('#cp',m).onclick=()=>{const t=`Halo ${o.client_name||'Kak'}, kode pesanan Anda: ${o.code}\nPantau status di: ${C.siteUrl}/lacak/?kode=${o.code}`;navigator.clipboard.writeText(t).then(()=>toast('Pesan disalin'),()=>toast('Gagal menyalin'))};
    $('#del',m).onclick=async()=>{if(!confirm('Hapus pesanan '+o.code+'? Tidak bisa dibatalkan.'))return;const {error}=await sb.from('orders').delete().eq('id',o.id);if(error)return toast(error.message);m.remove();await loadAll();route();toast('Dihapus')}}
  $('#f',m).onsubmit=async e=>{e.preventDefault();
    const g=id=>$('#'+id,m)?$('#'+id,m).value.trim():undefined;
    const row={code:g('code').toUpperCase(),type:g('type'),client_name:g('nm'),client_wa:g('wa'),product:g('pr'),qty:+g('qty')||1,price:+g('price')||0,cost:+g('cost')||0,dp:+g('dp')||0,stage:g('stage'),done_at:(g('stage')==='selesai'?(o.done_at||new Date().toISOString()):null),deadline:g('dead')||null,note:g('note'),show_until:g('su')||null,updated_at:new Date().toISOString()};
    if(g('cr')!==undefined)row.courier=g('cr');if(g('rs')!==undefined)row.resi=g('rs');if(g('lk')!==undefined)row.link=g('lk');
    const r=n?await sb.from('orders').insert(row):await sb.from('orders').update(row).eq('id',o.id);
    if(r.error)return $('#er',m).textContent=r.error.code==='23505'?'Kode sudah dipakai.':r.error.message;
    m.remove();await loadAll();route();toast('Tersimpan')};
}

/* ---------- PRODUCTS ---------- */
function vProducts(){
  $('#topact').innerHTML='<button class="btn sec" id="ac">+ Kategori</button> <button class="btn" id="ap">+ Produk</button>';
  $('#ac').onclick=()=>catForm();$('#ap').onclick=()=>prodForm();
  $('#view').innerHTML=S.cats.map(c=>{const ps=S.products.filter(p=>p.cat===c.id);return `<div class="card" style="margin-bottom:.8rem"><div class="top" style="margin:0 0 .5rem"><h3 style="flex:1;font-size:1.15rem">${esc(c.name)} ${c.active?'':'<span class="pill">disembunyikan</span>'}</h3><button class="btn sm sec" data-c="${esc(c.id)}">Ubah kategori</button></div>
   ${ps.length?`<div class="wrap"><table class="tbl cards"><tbody>${ps.map(p=>`<tr><td data-l="Foto">${p.img?`<img class="thumb" src="${esc(p.img)}" alt="">`:'<span class="thumb"></span>'}</td><td data-l="Nama"><b>${esc(p.name)}</b><br><small>${esc(p.title)}</small></td><td data-l="Harga">${esc(p.price_label)||'-'}</td><td data-l="Aktif"><label class="sw"><input type="checkbox" data-t="${p.id}" ${p.active?'checked':''} style="width:auto;min-height:0"> Aktif</label></td><td><button class="btn sm sec" data-p="${p.id}">Ubah</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada produk.</div>'}</div>`}).join('')||'<div class="card empty">Belum ada kategori. Klik “+ Kategori”, atau impor dari data.js lewat panduan.</div>';
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

/* ---------- BACKUP ---------- */
function vBackup(){
  $('#view').innerHTML=`<div class="card"><h3>Unduh cadangan</h3><p style="color:var(--mut)">Paket gratis Supabase tidak punya backup otomatis. Unduh cadangan minimal seminggu sekali dan simpan di Google Drive Anda. File berisi data pelanggan, jadi jangan dibagikan.</p><button class="btn" id="bk">Unduh semua data (.json)</button></div>`;
  $('#bk').onclick=()=>{const blob=new Blob([JSON.stringify({dibuat:new Date().toISOString(),categories:S.cats,products:S.products,orders:S.orders,reviews:S.reviews,expenses:S.expenses,settings:S.settings},null,1)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rumahcetak-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
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
function calcFin(){
  const R=range(),inR=d=>d>=R.a&&d<=R.b;
  const od=o=>(o.done_at||o.updated_at||o.created_at||'').slice(0,10);
  const os=S.orders.filter(o=>o.stage==='selesai'&&inR(od(o))),ex=S.expenses.filter(e=>inR(e.date));
  const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
  const omzet=sum(os,'price'),modal=sum(os,'cost'),biaya=sum(ex,'amount'),kotor=omzet-modal,bersih=kotor-biaya;
  const act=S.orders.filter(o=>o.stage!=='selesai'),sisa=act.reduce((s,o)=>s+Math.max(0,(+o.price||0)-(+o.dp||0)),0);
  const daily=(new Date(R.b)-new Date(R.a))/864e5<=31,key=d=>daily?d:d.slice(0,7),B={};
  os.forEach(o=>{const k=key(od(o));(B[k]=B[k]||{o:0,c:0,e:0}).o+=+o.price||0;B[k].c+=+o.cost||0});
  ex.forEach(e=>{const k=key(e.date);(B[k]=B[k]||{o:0,c:0,e:0}).e+=+e.amount||0});
  return {R,os,ex,omzet,modal,biaya,kotor,bersih,margin:omzet?bersih/omzet*100:0,sisa,aktif:act.length,B,daily}}
function chartSVG(F){
  const ks=Object.keys(F.B).sort();if(!ks.length)return '<div class="empty">Belum ada data di periode ini.</div>';
  const vals=ks.map(k=>({k,o:F.B[k].o,l:F.B[k].o-F.B[k].c-F.B[k].e}));
  const mx=Math.max(1,...vals.map(v=>Math.max(v.o,v.l))),W=Math.max(520,ks.length*44),H=190,pad=26,bw=Math.min(16,(W-pad)/ks.length/2.6);
  const bars=vals.map((v,i)=>{const x=pad+i*((W-pad)/ks.length)+6,h1=v.o/mx*(H-40),h2=Math.max(0,v.l)/mx*(H-40);
    return `<rect x="${x}" y="${H-24-h1}" width="${bw}" height="${h1}" rx="3" fill="#1a7a2e"><title>${v.k}: omzet ${RP(v.o)}</title></rect><rect x="${x+bw+2}" y="${H-24-h2}" width="${bw}" height="${h2}" rx="3" fill="#f2c230"><title>${v.k}: laba bersih ${RP(v.l)}</title></rect><text x="${x+bw}" y="${H-8}" font-size="10" text-anchor="middle" fill="#5a6b61">${esc(F.daily?v.k.slice(5):v.k)}</text>`}).join('');
  return `<div class="wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Grafik omzet dan laba bersih">${bars}</svg></div><small style="color:var(--mut)"><span style="color:#1a7a2e">■</span> Omzet &nbsp; <span style="color:#d9a800">■</span> Laba bersih (nol jika rugi)</small>`}
function vFinance(){
  if(!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 2</h3><p>Tabel keuangan belum ada. Jalankan <code>sql/schema-tahap2.sql</code> di Supabase SQL Editor, lalu muat ulang halaman ini.</p></div>';return}
  const F=calcFin(),m=FR.mode;
  $('#topact').innerHTML='<button class="btn" id="adx">+ Biaya</button>';$('#adx').onclick=()=>expForm();
  $('#view').innerHTML=`<div class="tools"><select id="fm" aria-label="Rentang">${[['7','7 hari'],['15','15 hari'],['30','30 hari'],['6m','6 bulan'],['1y','1 tahun'],['month','Per bulan'],['year','Per tahun']].map(x=>`<option value="${x[0]}" ${m===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>
   ${m==='month'?`<input id="fmo" type="month" value="${FR.month}" style="max-width:180px">`:''}${m==='year'?`<input id="fyr" type="number" min="2020" max="2100" value="${FR.year}" style="max-width:120px">`:''}
   <span style="flex:1"></span><button class="btn sm sec" id="dcsv">CSV</button><button class="btn sm sec" id="dxls">Excel</button><button class="btn sm sec" id="dpdf">PDF / Cetak</button></div>
   <p style="color:var(--mut);margin:.2rem 0 .8rem">${esc(F.R.label)} (${F.R.a} s/d ${F.R.b}). Pesanan berstatus Selesai dianggap lunas pada tanggal selesai.</p>
   <div class="grid4"><div class="card stat"><small>Omzet</small><b>${RP(F.omzet)}</b><em>${F.os.length} pesanan selesai</em></div>
   <div class="card stat"><small>Modal</small><b>${RP(F.modal)}</b><em>biaya produksi pesanan</em></div>
   <div class="card stat"><small>Laba kotor</small><b>${RP(F.kotor)}</b><em>omzet − modal</em></div>
   <div class="card stat"><small>Biaya operasional</small><b>${RP(F.biaya)}</b><em>${F.ex.length} catatan</em></div></div>
   <div class="grid2" style="margin-top:.8rem"><div class="card stat"><small>Laba bersih</small><b style="color:${F.bersih<0?'var(--red)':'inherit'}">${RP(F.bersih)}</b><em>margin ${F.margin.toFixed(1)}% dari omzet</em></div>
   <div class="card stat"><small>Piutang (pesanan berjalan)</small><b>${RP(F.sisa)}</b><em>${F.aktif} pesanan, harga dikurangi DP</em></div></div>
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
function finRows(F){const sum=[['Rekap Keuangan Rumah Cetak'],['Periode',F.R.label,F.R.a+' s/d '+F.R.b],[],['Omzet',F.omzet],['Modal',F.modal],['Laba kotor',F.kotor],['Biaya operasional',F.biaya],['Laba bersih',F.bersih],['Margin (%)',+F.margin.toFixed(1)]];
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
function exportPDF(F){const {ord,exp}=finRows(F);const d=document.createElement('div');d.id='pr';
  const tb=a=>`<table class="tbl"><thead><tr>${a[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${a.slice(1).map(r=>`<tr>${r.map(c=>`<td>${typeof c==='number'?RP(c):esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  d.innerHTML=`<h2>Rekap Keuangan Rumah Cetak</h2><p>${esc(F.R.label)}: ${F.R.a} s/d ${F.R.b}</p><table class="tbl"><tbody><tr><td>Omzet</td><td>${RP(F.omzet)}</td></tr><tr><td>Modal</td><td>${RP(F.modal)}</td></tr><tr><td>Laba kotor</td><td>${RP(F.kotor)}</td></tr><tr><td>Biaya operasional</td><td>${RP(F.biaya)}</td></tr><tr><td><b>Laba bersih</b></td><td><b>${RP(F.bersih)}</b></td></tr><tr><td>Margin</td><td>${F.margin.toFixed(1)}%</td></tr></tbody></table><h3>Pesanan selesai</h3>${tb(ord).replace(/<td>Rp (\d)/g,'<td>Rp $1')}<h3>Biaya operasional</h3>${tb(exp)}`;
  document.body.append(d);document.body.classList.add('printing');const done=()=>{d.remove();document.body.classList.remove('printing');removeEventListener('afterprint',done)};addEventListener('afterprint',done);print()}

/* ---------- PROMO & PAKET ---------- */
const fmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
const DEF_PROMO={active:false,label:'Promo',long:'',short:'',href:'#paket',link:'Lihat',start:'',end:''};
function vPromo(){
  if(!S.t2){$('#view').innerHTML='<div class="card"><h3>Jalankan SQL Tahap 2</h3><p>Jalankan <code>sql/schema-tahap2.sql</code> lalu <code>sql/import-tahap2.sql</code> di Supabase SQL Editor, lalu muat ulang.</p></div>';return}
  const P={...DEF_PROMO,...(S.settings.promo||{})},K={min:100,hemat:1650,biasa:2000,...(S.settings.fisik||{})},BD=S.settings.bundles||[];
  $('#view').innerHTML=`<div class="card"><h3>Bar promo di atas web</h3><form id="pf">
   <label class="sw"><input id="pa" type="checkbox" ${P.active?'checked':''} style="width:auto;min-height:0"> Tampilkan bar promo</label>
   <div class="row2"><div><label>Label</label><input id="pl" value="${esc(P.label)}"></div><div><label>Teks tombol</label><input id="pk" value="${esc(P.link)}"></div></div>
   <label>Teks panjang (desktop). Tebalkan dengan **kata**</label><input id="pg" value="${esc(P.long)}"><label>Teks pendek (HP)</label><input id="ps" value="${esc(P.short)}">
   <div class="row3"><div><label>Tujuan tombol</label><input id="ph" value="${esc(P.href)}"></div><div><label>Mulai (opsional)</label><input id="p1" type="date" value="${esc(P.start)}"></div><div><label>Selesai (opsional)</label><input id="p2" type="date" value="${esc(P.end)}"></div></div>
   <div class="acts"><button class="btn">Simpan promo</button></div></form></div>
   <div class="card" style="margin-top:.8rem"><h3>Aturan harga undangan fisik</h3><p style="color:var(--mut);margin:.2rem 0">1 sampai (batas−1) lembar = jumlah × harga biasa. Batas ke atas = jumlah × harga hemat.</p><form id="kf"><div class="row3"><div><label>Batas minimal hemat (lembar)</label><input id="k1" type="number" min="2" value="${K.min}"></div><div><label>Harga hemat / lembar</label><input id="k2" type="number" min="0" value="${K.hemat}"></div><div><label>Harga biasa / lembar</label><input id="k3" type="number" min="0" value="${K.biasa}"></div></div><div class="acts"><button class="btn">Simpan aturan harga</button></div></form></div>
   <div class="card" style="margin-top:.8rem"><div class="top" style="margin:0 0 .5rem"><h3 style="flex:1">Paket bundling</h3><button class="btn sm" id="ab">+ Paket</button></div>${BD.length?`<div class="wrap"><table class="tbl cards"><tbody>${BD.map((b,i)=>`<tr><td data-l="Urut"><button class="btn sm sec" data-u="${i}" ${i?'':'disabled'} aria-label="Naik">↑</button> <button class="btn sm sec" data-dn="${i}" ${i<BD.length-1?'':'disabled'} aria-label="Turun">↓</button></td><td data-l="Paket"><b>${esc(b.name)}</b> ${b.hot?'<span class="pill w">Rekomendasi</span>':''}<br><small>${esc(b.kicker)}</small></td><td data-l="Harga">${esc(b.price)} <small>${esc(b.unit)}</small></td><td><button class="btn sm sec" data-b="${i}">Ubah</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada paket. Jalankan <code>sql/import-tahap2.sql</code> untuk mengisi dari web, atau klik + Paket.</div>'}</div>`;
  $('#pf').onsubmit=async e=>{e.preventDefault();await saveSet('promo',{active:$('#pa').checked,label:$('#pl').value.trim(),long:$('#pg').value.trim(),short:$('#ps').value.trim(),href:$('#ph').value.trim()||'#paket',link:$('#pk').value.trim()||'Lihat',start:$('#p1').value,end:$('#p2').value})};
  $('#kf').onsubmit=async e=>{e.preventDefault();const n={min:Math.max(2,+$('#k1').value||100),hemat:+$('#k2').value||0,biasa:+$('#k3').value||0};
    if(n.hemat>n.biasa&&!confirm('Harga hemat lebih mahal dari harga biasa. Lanjutkan?'))return;
    if(S.settings.bundles){const tok=(o)=>[[RP(o.hemat),'§H'],[RP(o.biasa),'§B'],['min. '+o.min,'§m'],['Min. '+o.min,'§M']];let js=JSON.stringify(S.settings.bundles);
      tok(K).forEach(([a,b])=>js=js.split(a).join(b));[[RP(n.hemat),'§H'],[RP(n.biasa),'§B'],['min. '+n.min,'§m'],['Min. '+n.min,'§M']].forEach(([a,b])=>js=js.split(b).join(a));
      await saveSet('bundles',JSON.parse(js),true)}
    await saveSet('fisik',n)};
  $('#ab').onclick=()=>bundleForm();
  $('#view').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>bundleForm(+b.dataset.b));
  $('#view').querySelectorAll('[data-u],[data-dn]').forEach(b=>b.onclick=async()=>{const i=+(b.dataset.u??b.dataset.dn),j=b.dataset.u!==undefined?i-1:i+1,a=[...BD];[a[i],a[j]]=[a[j],a[i]];await saveSet('bundles',a)});
}
async function saveSet(key,value,quiet){const {error}=await sb.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)return toast('Gagal: '+error.message);S.settings[key]=value;if(!quiet){toast('Tersimpan. Web utama menampilkan versi baru pada kunjungan berikutnya.');route()}}
function bundleForm(i){
  const BD=[...(S.settings.bundles||[])],n=i===undefined,b=n?{lb:'Starter',kicker:'',chip:'',name:'',desc:'',price:'',unit:'',cta:'Pesan Paket',items:[],hot:false}:BD[i];
  const m=modal(`<h3>${n?'Paket baru':'Ubah paket'}</h3><form id="f"><div class="row2"><div><label>Nama paket</label><input id="nm" value="${esc(b.name)}" required></div><div><label>Label kecil (mis. Starter, Populer)</label><input id="lb" value="${esc(b.lb)}"></div></div>
  <div class="row2"><div><label>Subjudul</label><input id="kc" value="${esc(b.kicker)}"></div><div><label>Chip</label><input id="ch" value="${esc(b.chip)}"></div></div><label>Deskripsi singkat</label><input id="ds" value="${esc(b.desc)}">
  <div class="row2"><div><label>Harga (teks)</label><input id="pr" value="${esc(b.price)}" required></div><div><label>Satuan / keterangan</label><input id="un" value="${esc(b.unit)}"></div></div><label>Teks tombol</label><input id="ct" value="${esc(b.cta)}">
  <label>Isi paket (satu baris satu poin; **tebal**)</label><textarea id="it" rows="6">${esc((b.items||[]).join('\n'))}</textarea><label class="sw"><input id="ht" type="checkbox" ${b.hot?'checked':''} style="width:auto;min-height:0"> Paket rekomendasi (kartu tengah, hanya satu)</label>
  <div class="err" id="er"></div><div class="acts">${n?'':'<button type="button" class="btn d" id="del">Hapus</button>'}<button type="button" class="btn sec" id="x">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#x',m).onclick=()=>m.remove();
  if(!n)$('#del',m).onclick=async()=>{if(!confirm('Hapus paket ini?'))return;BD.splice(i,1);m.remove();await saveSet('bundles',BD)};
  $('#f',m).onsubmit=async e=>{e.preventDefault();const g=id=>$('#'+id,m).value.trim();
    const nb={lb:g('lb'),kicker:g('kc'),chip:g('ch'),name:g('nm'),desc:g('ds'),price:g('pr'),unit:g('un'),cta:g('ct')||'Pesan Paket',items:g('it').split('\n').map(x=>x.trim()).filter(Boolean),hot:$('#ht',m).checked};
    if(nb.hot)BD.forEach(x=>x.hot=false);if(n)BD.push(nb);else BD[i]=nb;m.remove();await saveSet('bundles',BD)};
}

sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')loginView()});
boot();
})();
