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
let S={view:'dashboard',orders:[],products:[],cats:[],reviews:[]};

/* ---------- AUTH ---------- */
function authShell(inner){root.innerHTML=`<div class="auth"><div class="card"><div class="brand"><img src="assets/logo.svg" alt="">Rumah Cetak</div>${inner}</div></div>`}
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return loginView();
  const {data:a}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.nextLevel==='aal2'&&a.currentLevel!=='aal2')return mfaVerifyView();
  if(a.nextLevel==='aal1')return mfaEnrollView();
  const {data:adm}=await sb.from('admins').select('user_id').maybeSingle();
  if(!adm){authShell('<h1>Akses ditolak</h1><p>Akun ini bukan admin.</p><button class="btn sec" id="lo">Keluar</button>');$('#lo').onclick=logout;return}
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
  const [o,p,c,r]=await Promise.all([
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('products').select('*').order('cat').order('sort').order('id'),
    sb.from('categories').select('*').order('sort'),
    sb.from('reviews').select('*').order('created_at',{ascending:false})]);
  const bad=[o,p,c,r].find(x=>x.error);if(bad)toast('Gagal memuat: '+bad.error.message);
  S.orders=o.data||[];S.products=p.data||[];S.cats=c.data||[];S.reviews=r.data||[];
}

/* ---------- SHELL ---------- */
const NAV=[['dashboard','Dashboard'],['orders','Pesanan'],['products','Produk'],['reviews','Ulasan'],['backup','Backup']];
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
  ({dashboard:vDash,orders:vOrders,products:vProducts,reviews:vReviews,backup:vBackup})[S.view]();
}
function modal(html){const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="box" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('mousedown',e=>{if(e.target===m)m.remove()});document.body.append(m);return m}

/* ---------- DASHBOARD ---------- */
function vDash(){
  const now=new Date(),ym=now.toISOString().slice(0,7);
  const done=S.orders.filter(o=>o.stage==='selesai'),mo=done.filter(o=>(o.updated_at||o.created_at).slice(0,7)===ym);
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
   <p style="color:var(--mut);font-size:13px;margin-top:.8rem">Grafik dan rekap keuangan lengkap hadir di Tahap 2.</p>`;
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
    const row={code:g('code').toUpperCase(),type:g('type'),client_name:g('nm'),client_wa:g('wa'),product:g('pr'),qty:+g('qty')||1,price:+g('price')||0,cost:+g('cost')||0,dp:+g('dp')||0,stage:g('stage'),deadline:g('dead')||null,note:g('note'),show_until:g('su')||null,updated_at:new Date().toISOString()};
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
  $('#bk').onclick=()=>{const blob=new Blob([JSON.stringify({dibuat:new Date().toISOString(),categories:S.cats,products:S.products,orders:S.orders,reviews:S.reviews},null,1)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rumahcetak-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')loginView()});
boot();
})();
