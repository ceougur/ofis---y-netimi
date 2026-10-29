// DestekOfis Mobil (2.4.7 M1): kullanıcının DestekOfis Mobil v0.3 ekranları, programın içinde (aynı kurulum ve güncelleme).
// Telefon yalnız /api/mobil/… uçlarını çağırır (server/lib/mobile.mjs): yetki, şirket erişimi ve oturum programın kendi uçlarında denetlenir.
// SALT OKUNUR: kayıt girişi (tahsilat, ödeme, stok hareketi) bu sürümde yok; sunucu da /api/mobil/ altında yazma isteğini reddeder.
// 2.4.7 M2 (docs/mobil/M2-TASARIM.md): uzaktan bağlantıda cihaz karekodla eşlenir — tarayıcı dışa aktarılamaz ECDSA P-256 anahtarı üretir (IndexedDB), girişte
// sunucunun tek kullanımlık meydan okumasını imzalar. Ofis ağında (yerel adres) olağan giriş sürer.
import * as ozet from './ozet.js'; // 2.4.7 M3: sunucu kapalıyken şifreli son özet (client/mobil/ozet.js)
const $=id=>document.getElementById(id);
const API='/api/mobil';
const state={user:null,companies:[],company:'',page:'home',selected:null,list:[],listTotal:0,stock:[],stockTotal:0,listQuery:'',reportCatalog:[],reportSelected:null,reportQuery:null,reportResult:null,reportAccounts:[],reportChosenAccount:null,requestGeneration:0,searchTimer:0};
const money=n=>typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n):'—';
const qty=n=>typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('tr-TR',{maximumFractionDigits:3}).format(n):'—';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(obj,...names)=>names.map(n=>obj?.[n]).find(v=>v!==undefined&&v!==null&&v!=='');
const toast=(message,error=false)=>{const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),5000)};
// Sunucu bağlantısının gerçek durumu (üst çubuk ve yan panel): son istek sunucuya ulaştı mı.
function serverState(reached){$('top-server-status').textContent=reached?'Sunucu Bağlı':'Bağlantı Yok';$('side-server-status').textContent=reached?'Bağlı':'Sunucuya ulaşılamıyor';document.querySelectorAll('.status-dot').forEach(dot=>dot.classList.toggle('off',!reached))}
class SessionEnded extends Error{}
async function api(path,body){
  if(ozet.aktif())return ozet.api(path,body);
  const headers={'x-requested-with':'DestekOfisMobile'};
  if(body!==undefined)headers['content-type']='application/json';
  let resp;
  try{resp=await fetch(API+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}
  catch{serverState(false);const o=await ozet.tryOffline(path,body);if(o!==ozet.NO_OFFLINE)return o;throw Object.assign(Error('Ofis sunucusuyla bağlantı kurulamadı. Sunucunun açık olduğunu denetleyin.'),{unreachable:true})}
  serverState(true);
  let data;try{data=await resp.json()}catch{throw Error('Sunucudan beklenmeyen yanıt geldi.')}
  if(resp.status===503&&data.code==='kapi-ofis-kapali'){serverState(false);const o=await ozet.tryOffline(path,body);if(o!==ozet.NO_OFFLINE)return o;throw Object.assign(Error(data.error||'Ofis sunucusuna ulaşılamıyor.'),{status:503,code:data.code,unreachable:true})}
  if(resp.status===401&&(data.code==='remote-device'||data.code==='kapi-cihaz')){loggedOut();showUnpaired(data.error);throw new SessionEnded(data.error||'Bu cihaz eşli değil.')}
  if(resp.status===401&&state.user&&!path.startsWith('/session')){loggedOut();throw new SessionEnded(data.error||'Oturum sona erdi.')}
  if(!resp.ok||data.ok===false)throw Object.assign(Error(data.error||'İşlem başarısız.'),{status:resp.status,code:data.code});
  return data.data;
}
const path=(p)=>p+(p.includes('?')?'&':'?')+'company='+encodeURIComponent(state.company);
function setAuth(auth){state.user=auth.user;state.companies=auth.companies||[];state.company=state.companies.some(c=>c.id===state.company)?state.company:(auth.company||state.companies[0]?.id||'');$('login').classList.add('hidden');$('app').classList.remove('hidden');$('company').innerHTML=state.companies.map(c=>`<option value="${safe(c.id)}">${safe(c.name||c.code||c.id)}</option>`).join('');$('company').value=state.company;const name=field(state.user,'name','username')||'Kullanıcı';$('side-username').textContent=name;$('side-avatar').textContent=String(name).slice(0,1).toLocaleUpperCase('tr-TR');$('side-role').textContent=field(state.user,'roleLabel')||'Kullanıcı'}
function loggedOut(){ozet.leave();showPanel('login-form');state.user=null;state.requestGeneration++;state.selected=null;state.list=[];state.stock=[];state.reportCatalog=[];state.reportSelected=null;state.reportResult=null;state.reportChosenAccount=null;$('content').innerHTML='';$('app').classList.add('hidden');$('login').classList.remove('hidden')}
function heading(title,desc,actions=''){return `<div class="section-heading"><div><span class="eyebrow">DESTEKOFİS MOBİL</span><h1>${safe(title)}</h1><p>${safe(desc)}</p></div>${actions}</div>`}
function blank(msg){return `<div class="card empty"><span class="empty-icon">◎</span>${safe(msg)}</div>`}
function err(e){if(e instanceof SessionEnded)return;$('content').innerHTML=`<div class="error-box">${safe(e.message)}</div>`;toast(e.message,true)}
const TITLES={home:'Genel Bakış',accounts:'Cari Hesaplar',money:'Kasa ve Banka',stock:'Stok Yönetimi',reports:'Müşteri Raporları'};
function setPage(p){state.page=p;state.selected=null;state.listQuery='';clearTimeout(state.searchTimer);if(p==='reports'){state.reportSelected=null;state.reportQuery=null;state.reportResult=null;state.reportChosenAccount=null;state.reportAccounts=[];}document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===p));$('crumb').textContent=TITLES[p]||p;load()}
function listOf(obj,k){return Array.isArray(obj)?obj:Array.isArray(obj?.[k])?obj[k]:Array.isArray(obj?.items)?obj.items:[]}
async function load(){
 if(!state.user)return;
 const generation=++state.requestGeneration,company=state.company,page=state.page;
 const stillCurrent=()=>generation===state.requestGeneration&&company===state.company&&page===state.page&&!!state.user;
 $('content').innerHTML='<div class="center muted" style="padding:85px"><span class="spinning">◌</span>&nbsp; Bilgiler yükleniyor…</div>';
 try{
  if(page==='accounts'){const d=await api(path('/accounts?limit=50'));if(!stillCurrent())return;state.list=listOf(d,'accounts');state.listTotal=d?.total??state.list.length;renderAccounts()}
  else if(page==='stock'){const d=await api(path('/stock?limit=50'));if(!stillCurrent())return;state.stock=listOf(d,'items');state.stockTotal=d?.total??state.stock.length;renderStock()}
  else if(page==='reports'){const d=await api(path('/reports'));if(!stillCurrent())return;state.reportCatalog=Array.isArray(d?.reports)?d.reports:[];renderReportCatalog()}
  else if(page==='money'){const [c,b,ba]=await Promise.allSettled([api(path('/cash')),api(path('/bank')),api(path('/bank/accounts'))]);if(stillCurrent())renderMoney(c,b,ba)}
  else{const parts=await Promise.allSettled([api(path('/cash')),api(path('/bank')),api(path('/accounts?limit=20')),api(path('/stock?limit=20'))]);if(stillCurrent())renderHome(parts)}
 }catch(e){if(stillCurrent())err(e)}
}
const cashBalance=c=>typeof c?.totals?.balance==='number'?c.totals.balance:undefined;
const bankBalance=b=>typeof b?.realBank?.minor==='number'?b.realBank.minor/100:undefined;
// Tutar tek satırda kalır; metnin gerçek genişliği (kesirli piksel) kutusunu aşarsa yazı boyutu adım adım küçülür (en az 12 px). Her çizimden sonra ve ekran döndürülünce.
const AMOUNTS='.metric-value,.big-balance,[data-detail-balance],.stat-line strong';
const textWidth=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width};
function fitAmounts(){document.querySelectorAll(AMOUNTS).forEach(el=>{el.style.fontSize='';let size=parseFloat(getComputedStyle(el).fontSize)||16;while(textWidth(el)>el.clientWidth&&size>12){size-=1;el.style.fontSize=size+'px'}})}
window.addEventListener('resize',()=>requestAnimationFrame(fitAmounts));
function stat(label,value,icon,id){return `<div class="card" data-stat="${id}"><div class="metric-icon">${icon}</div><div class="metric-label">${safe(label)}</div><div class="metric-value">${safe(value)}</div><div class="metric-footer">Ofis Sunucusundan</div></div>`}
function renderHome(parts){const [c,b,a,s]=parts.map(x=>x.status==='fulfilled'?x.value:null);const ac=listOf(a,'accounts'),st=listOf(s,'items');const why=i=>parts[i].reason?.status===403?'Yetki Yok':'—';$('content').innerHTML=heading('Genel Bakış','Ofis sunucunuzdaki güncel bilgiler.')+`<div class="summary-grid">${stat('Nakit Kasa',c?money(cashBalance(c)):why(0),'₺','cash')}${stat('Banka',b?money(bankBalance(b)):why(1),'▤','bank')}${stat('Cari Kayıtları',a?(a.total??ac.length):why(2),'◎','accounts')}${stat('Stok Ürünleri',s?(s.total??st.length):why(3),'◫','stock')}</div><div class="content-row"><div class="card"><h2>Hızlı Erişim</h2><div class="actions-grid">${[['accounts','◎','Cari Hesaplar'],['money','▤','Kasa ve Banka'],['stock','◫','Stok Yönetimi'],['reports','▤','Müşteri Raporları']].map(([p,i,n])=>`<button class="action-tile" data-nav="${p}"><span>${i}</span><div><strong>${n}</strong><small>Detayları Görüntüle</small></div></button>`).join('')}</div></div><div class="card"><h2>Mobil Görünüm</h2><div class="notice">${state.writesEnabled?'Tahsilat, ödeme ve stok girişi cari ve stok kartından yapılır; kayıt ofis sunucusuna yazılır. Sunucu kapalıyken kayıt girilmez.':'Mobil görünüm salt okunurdur; tahsilat, ödeme ve stok hareketi masaüstü programdan girilir.'}</div><div class="notice">Bilgiler ofisinizdeki sunucudan okunur. Sunucu kapalıyken yalnız bu cihazda açılabilen şifreli son özet görünür.</div></div></div>`;fitAmounts()}
function rows(items,kind){return items.map(o=>{const id=field(o,'id'),name=field(o,'name','title','code')||'İsimsiz';const detail=kind==='accounts'?field(o,'refNo','typeLabel'):[field(o,'code'),field(o,'category')].filter(Boolean).join(' · ');const amount=kind==='accounts'?money(field(o,'balance')):`${qty(field(o,'qty'))} ${safe(field(o,'unit')||'')}`;return `<button class="list-item" data-detail="${safe(kind)}:${safe(id)}"><span class="list-avatar">${safe(String(name).slice(0,1).toLocaleUpperCase('tr-TR'))}</span><span class="list-copy"><strong>${safe(name)}</strong><small>${safe(detail||'')}</small></span><span class="list-amount">${amount}<small>${kind==='accounts'?'Bakiye':'Miktar'}</small></span><span class="right-chev">›</span></button>`}).join('')}
const matches=(o,q,...names)=>!q||names.some(n=>String(o?.[n]??'').toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')));
function renderAccounts(q=state.listQuery){const items=state.list.filter(o=>matches(o,q,'name','refNo','code'));$('content').innerHTML=heading('Cari Hesaplar','Müşteri ve tedarikçi hesaplarını inceleyin.')+`<div class="card list-card"><div class="list-bar"><input id="list-search" class="search-input" placeholder="Cari adı veya numarası" value="${safe(q)}" aria-label="Cari ara"/><span class="muted" data-count>${items.length} kayıt</span></div><div class="list-items">${items.length?rows(items,'accounts'):blank('Kayıt bulunamadı.')}</div></div>`}
function renderStock(q=state.listQuery){const items=state.stock.filter(o=>matches(o,q,'name','code','category'));$('content').innerHTML=heading('Stok Yönetimi','Ürün, miktar ve hareket bilgilerini inceleyin.')+`<div class="card list-card"><div class="list-bar"><input id="list-search" class="search-input" placeholder="Ürün adı veya stok kodu" value="${safe(q)}" aria-label="Stok ara"/><span class="muted" data-count>${items.length} ürün</span></div><div class="list-items">${items.length?rows(items,'stock'):blank('Ürün bulunamadı.')}</div></div>`}
// Liste araması: ekrandaki ilk 50 kayıtta hemen süzer; liste kırpılmışsa (toplam > 50) sunucuda da arar (v0.3 yalnız ilk 50'de arıyordu).
function keepFocus(sel){const input=$('list-search');if(input){input.focus();input.setSelectionRange(sel,sel)}}
function listSearch(value,sel){state.listQuery=value;const page=state.page;page==='accounts'?renderAccounts(value):renderStock(value);keepFocus(sel);clearTimeout(state.searchTimer);const total=page==='accounts'?state.listTotal:state.stockTotal,shown=page==='accounts'?state.list.length:state.stock.length;if(total<=shown)return;state.searchTimer=setTimeout(async()=>{const generation=++state.requestGeneration,company=state.company;try{const q=state.listQuery.trim();const d=await api(path(`/${page==='accounts'?'accounts':'stock'}?limit=50${q?'&q='+encodeURIComponent(q):''}`));if(generation!==state.requestGeneration||company!==state.company||page!==state.page||state.selected)return;const input=$('list-search');const caret=input?input.selectionStart:state.listQuery.length;if(page==='accounts')state.list=listOf(d,'accounts');else state.stock=listOf(d,'items');page==='accounts'?renderAccounts():renderStock();keepFocus(caret)}catch(e){toast(e.message,true)}},350)}
function renderMoney(c,b,bankAccounts){const cash=c.status==='fulfilled'?c.value:null,bank=b.status==='fulfilled'?b.value:null;const banks=bankAccounts?.status==='fulfilled'?listOf(bankAccounts.value,'accounts'):[];$('content').innerHTML=heading('Kasa ve Banka','Bakiyeler ve hesapların salt okunur görünümü.')+`<div class="money-cols"><div class="card" data-money="cash"><h2>Nakit Kasa</h2><div class="big-balance">${money(cashBalance(cash))}</div>${cash?'<div class="notice">Kasa bilgisi ofis sunucusundan alındı.</div>':`<div class="error-box">${safe(c.reason?.message||'Kasa bilgisi alınamadı.')}</div>`}</div><div class="card" data-money="bank"><h2>Banka</h2><div class="big-balance">${money(bankBalance(bank))}</div>${bank?banks.map(o=>`<div class="stat-line" data-bank-account="${safe(o.id)}"><span>${safe(field(o,'name','accountName')||'Banka Hesabı')}</span><strong>${money(typeof o?.balanceMinor==='number'?o.balanceMinor/100:field(o,'balance','currentBalance'))}</strong></div>`).join(''):`<div class="error-box">${safe(b.reason?.message||'Banka bilgisi alınamadı.')}</div>`}</div></div>`;fitAmounts()}
function accountEvent(e){const label=field(e,'note','label','kindLabel','kind')||'Hareket';return `<div class="entry-row"><div><strong>${safe(label)}</strong><small>${safe(field(e,'date','createdAt')||'')}</small></div><strong>${money(field(e,'amount','total'))}</strong></div>`}
function stockEvent(e,unit){const label=field(e,'note','accountName','invoiceNumber')||(e.kind==='in'?'Giriş':'Çıkış');return `<div class="entry-row"><div><strong>${safe(label)}</strong><small>${safe(field(e,'date','createdAt')||'')}</small></div><strong class="${e.kind==='in'?'in':'out'}">${e.kind==='in'?'+':'−'}${qty(field(e,'qty'))} ${safe(unit||'')}</strong></div>`}
async function detail(kind,id){const generation=++state.requestGeneration,company=state.company;state.selected={kind,id};$('content').innerHTML='<div class="center muted" style="padding:75px">Kayıt açılıyor…</div>';try{const d=await api(path(`/${kind==='accounts'?'accounts':'stock'}/${encodeURIComponent(id)}`));if(generation!==state.requestGeneration||company!==state.company||state.selected?.id!==id)return;const obj=d?.account||d?.item||d;const label=field(obj,'name','title','code')||'Kayıt';const events=listOf(d,kind==='accounts'?'entries':'moves');const recent=events.slice(-30).reverse();const balance=kind==='accounts'?money(typeof obj?.balance==='number'?obj.balance:obj?.totals?.balance):`${qty(field(obj,'qty'))} ${safe(field(obj,'unit')||'')}`;$('content').innerHTML=`<button class="btn page-back" data-action="back">← Listeye Dön</button>`+heading(label,kind==='accounts'?'Cari hesap detayları':'Stok kartı detayları')+`<div class="split-detail"><div class="card"><h2>${safe(label)}</h2><div class="small-label">${kind==='accounts'?'Cari Bakiye':'Mevcut Miktar'}</div><div class="big-balance" data-detail-balance>${balance}</div>${kind==='accounts'?`<div class="detail-actions"><button class="btn" data-account-statement="${safe(id)}">Cari Ekstre PDF</button></div>`:''}</div><div class="card"><h2>Son Hareketler</h2>${recent.length?recent.map(e=>kind==='accounts'?accountEvent(e):stockEvent(e,field(obj,'unit'))).join(''):'<div class="empty">Gösterilecek hareket yok.</div>'}</div></div>`;fitAmounts();yazma?.decorateDetail(kind,id,d)}catch(e){if(generation===state.requestGeneration&&company===state.company)err(e)}}

// Salt okunur rapor ekranları: programın Raporlar penceresinin (report-center) aynı hesabı; telefonda yalnız izinli rapor listesi.
const reportPeriods=[['thisYear','Bu Yıl'],['thisMonth','Bu Ay'],['lastMonth','Geçen Ay'],['last30','Son 30 Gün'],['all','Tüm Zamanlar'],['custom','Tarih Aralığı']];
const reportGroups={Cari:'Cari Hesaplar',Taksit:'Taksit ve Vadeler'};
const reportNumber=(str)=>safe(str==null?'':String(str));
function renderReportCatalog(){
  if(state.page!=='reports')return;
  state.reportSelected=null;state.reportResult=null;
  const list=state.reportCatalog;
  $('content').innerHTML=heading('Müşteri Raporları','Cari hesap, tahsilat, borç/alacak ve taksit raporları. Sonuçlar ofis sunucunuzdan alınır.')+
    `<div class="report-message">Raporlar yalnız görüntülenir. Hangi raporu görebileceğiniz DestekOfis'teki kullanıcı yetkilerinize bağlıdır. PDF ve Excel dosyaları programın kendi rapor motorundan üretilir.</div>`+
    (list.length?Object.entries(reportGroups).map(([group,title])=>{
      const entries=list.filter(r=>r.group===group);
      return entries.length?`<h2 class="section-sub">${safe(title)}</h2><div class="report-catalog">${entries.map(r=>`<button class="report-choice" data-report-pick="${safe(r.id)}"><strong>${safe(r.title)}</strong><small>${safe(r.description||'')}</small><span class="pill neutral">İncele →</span></button>`).join('')}</div>`:'';
    }).join(''):blank('Bu kullanıcıya tanımlı müşteri raporu yok. Yönetici Finans Raporları yetkisini verebilir.'));
}
function reportField(name,title,content,wide=false){return `<label${wide?' class="wide"':''}>${safe(title)}${content}</label>`}
function reportFilterForm(r){
  const inputs=new Set(r.params||[]);
  const old=state.reportQuery||{};
  const form=[];
  if(inputs.has('range')){
    form.push(reportField('preset','Dönem',`<select name="preset">${reportPeriods.map(([v,n])=>`<option value="${v}" ${old.preset===(v)||(!old.preset&&(r.preset||'thisYear')===v)?'selected':''}>${n}</option>`).join('')}</select>`));
    form.push(reportField('from','Başlangıç',`<input name="from" type="date" value="${safe(old.from||'')}">`));
    form.push(reportField('to','Bitiş',`<input name="to" type="date" value="${safe(old.to||'')}">`));
  }
  if(inputs.has('type'))form.push(reportField('type','Cari Türü',`<select name="type"><option value="">Tüm Cariler</option>${[['customer','Müşteri'],['supplier','Tedarikçi'],['other','Diğer']].map(([v,n])=>`<option value="${v}" ${old.type===v?'selected':''}>${n}</option>`).join('')}</select>`));
  if(inputs.has('side'))form.push(reportField('side','Bakiye',`<select name="side"><option value="">Tümü</option>${[['debtor','Borçlular'],['creditor','Alacaklılar'],['nonzero','Bakiyesi Olanlar'],['zero','Sıfır Bakiyeler'],['overdue','Gecikenler']].map(([v,n])=>`<option value="${v}" ${old.side===v?'selected':''}>${n}</option>`).join('')}</select>`));
  if(inputs.has('planStatus'))form.push(reportField('planStatus','Kart Durumu',`<select name="planStatus">${[['active','Açık'],['closed','Kapalı'],['all','Tümü']].map(([v,n])=>`<option value="${v}" ${old.planStatus===v?'selected':''}>${n}</option>`).join('')}</select>`));
  if(r.accountRequired){
    form.push(reportField('account','Cari Seçimi',`<input type="search" id="report-account-search" placeholder="Ad ya da cari no (en az 2 harf)" autocomplete="off" value="${safe(state.reportChosenAccount?.name||'')}"><button class="btn" type="button" data-report-search="1">Cari Ara</button><select id="report-account-select" name="account" required><option value="">${state.reportChosenAccount?'Cari Seçin':'Cari Arayın ve Seçin'}</option>${state.reportAccounts.map(a=>`<option value="${safe(a.id)}" ${state.reportChosenAccount?.id===a.id?'selected':''}>${safe(a.name)} ${a.refNo?'· '+safe(a.refNo):''}</option>`).join('')}</select>`,true));
  }
  if(inputs.has('items'))form.push(reportField('items','Ayrıntı',`<select name="items"><option value="">Özet Hareketler</option><option value="1" ${old.items==='1'?'selected':''}>Fatura Kalemlerini Göster</option></select>`));
  return `<form class="card" id="report-filter-form"><div class="report-filters">${form.join('')}<button class="btn primary" type="submit">Raporu Getir</button></div></form>`;
}
function reportScreenBase(r){
  $('content').innerHTML=`<button class="btn page-back" data-report-back="1">← Raporlara Dön</button>`+
    heading(r.title,r.description||'Rapor ofis sunucunuzda hesaplanır.')+
    reportFilterForm(r)+`<div id="report-preview">${r.accountRequired?'<div class="report-message">Önce cari arayıp seçin, sonra raporu getirin.</div>':'<div class="report-message">Raporu getirerek sonuçları görüntüleyebilirsiniz.</div>'}</div>`;
}
function selectReport(id){
  if(state.page!=='reports')return;
  const r=state.reportCatalog.find(item=>item.id===id);
  if(!r)return toast('Bu rapor için yetkiniz yok.',true);
  ++state.requestGeneration;
  state.reportSelected=r;state.reportResult=null;state.reportQuery=null;state.reportAccounts=[];state.reportChosenAccount=null;
  reportScreenBase(r);
  if(!(r.params||[]).length&&!r.accountRequired)loadReportPreview({});
}
async function searchReportAccounts(){
  if(!state.reportSelected?.accountRequired)return;
  const query=($('report-account-search')?.value||'').trim();
  if(query.length<2)return toast('En az iki harf yazın.',true);
  const generation=++state.requestGeneration,company=state.company,id=state.reportSelected.id;
  const button=document.querySelector('[data-report-search]');if(button)button.disabled=true;
  try{
    const rows=await api(path('/accounts/search?q='+encodeURIComponent(query)));
    if(state.requestGeneration!==generation||state.company!==company||state.reportSelected?.id!==id)return;
    state.reportAccounts=Array.isArray(rows)?rows:[];
    state.reportChosenAccount=null;
    const select=$('report-account-select');
    select.innerHTML='<option value="">Cari Seçin</option>'+state.reportAccounts.map(a=>`<option value="${safe(a.id)}">${safe(a.name)} ${a.refNo?'· '+safe(a.refNo):''}</option>`).join('');
    if(state.reportAccounts.length===1)select.value=state.reportAccounts[0].id;
    toast(state.reportAccounts.length?`${state.reportAccounts.length} cari bulundu.`:'Cari bulunamadı.');
  }catch(e){if(!(e instanceof SessionEnded))toast(e.message,true)}finally{if(button)button.disabled=false}
}
function reportQueryFrom(form){
  const r=state.reportSelected;const input=new FormData(form);const q={};
  for(const key of ['preset','from','to','type','side','planStatus','account','items']){
    const val=String(input.get(key)||'').trim();if(val)q[key]=val;
  }
  if((r.params||[]).includes('range')&&q.preset!=='custom'){delete q.from;delete q.to;}
  if(q.preset==='custom'&&!q.from&&!q.to)throw Error('Tarih aralığı için tarih girin.');
  if(q.from&&q.to&&q.from>q.to)throw Error('Başlangıç tarihi bitişten sonra olamaz.');
  if(r.accountRequired&&!q.account)throw Error('Bu rapor için cari seçin.');
  return q;
}
async function submitReportFilters(form){
  try{
    const q=reportQueryFrom(form);
    const a=state.reportAccounts.find(item=>item.id===q.account);
    if(a)state.reportChosenAccount={id:a.id,name:a.name};
    state.reportQuery=q;
    await loadReportPreview(q);
  }catch(e){toast(e.message,true)}
}
const reportUrl=(id,query={},suffix='')=>path(`/reports/${encodeURIComponent(id)}${suffix}?`+new URLSearchParams(query).toString());
async function loadReportPreview(query){
  const r=state.reportSelected;if(!r)return;
  const generation=++state.requestGeneration,company=state.company;
  const root=$('report-preview');if(root)root.innerHTML='<div class="center muted" style="padding:40px">Rapor hesaplanıyor…</div>';
  try{
    const data=await api(reportUrl(r.id,query));
    if(generation!==state.requestGeneration||company!==state.company||state.reportSelected?.id!==r.id)return;
    state.reportResult=data;state.reportQuery=query;
    renderReportPreview(data);
  }catch(e){if(!(e instanceof SessionEnded)&&generation===state.requestGeneration&&state.reportSelected?.id===r.id){$('report-preview').innerHTML=`<div class="error-box">${safe(e.message)}</div>`;toast(e.message,true)}}
}
function renderReportPreview(data){
  const root=$('report-preview');if(!root)return;
  const headers=Array.isArray(data?.headers)?data.headers:[];
  const types=Array.isArray(data?.types)?data.types:[];
  const rows=Array.isArray(data?.rows)?data.rows:[];
  const footerRows=Array.isArray(data?.footers)?data.footers:(Array.isArray(data?.footer)?[data.footer]:[]);
  const summary=Array.isArray(data?.summary)?data.summary:[];
  const total=Number(data?.total)||0;
  const cell=(v,j,tag='td')=>`<${tag} class="${types[j]==='money'||types[j]==='number'?'numeric':''}">${reportNumber(v)}</${tag}>`;
  root.innerHTML=`<div class="report-toolbar"><button class="btn primary" data-report-download="pdf" title="Raporu PDF olarak indir">PDF</button><button class="btn" data-report-download="xlsx" title="Raporu Excel olarak indir">Excel</button><span class="report-muted">${Math.min(rows.length,200)} / ${total} satır önizleme · Salt Okunur</span></div>`+
    (data.subtitle?`<div class="report-message">${safe(data.subtitle)}</div>`:'')+
    (summary.length?`<div class="report-summary">${summary.slice(0,12).map(line=>`<div class="report-chip"><small>${reportNumber(line[0])}</small><strong>${reportNumber(line[1])}</strong></div>`).join('')}</div>`:'')+
    (headers.length?`<div class="report-scroll" tabindex="0" aria-label="Rapor tablosu yatay kaydırılabilir"><table class="report-table"><thead><tr>${headers.map((x,j)=>cell(x,j,'th')).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${headers.map((_,j)=>cell(Array.isArray(row)?row[j]:'',j)).join('')}</tr>`).join('')}</tbody>${footerRows.length?`<tfoot>${footerRows.map(row=>`<tr>${headers.map((_,j)=>cell(Array.isArray(row)?row[j]:'',j)).join('')}</tr>`).join('')}</tfoot>`:''}</table></div>`:blank('Rapor tablosu boş.'))+
    (rows.length<total?`<p class="report-muted">İlk 200 satır görüntüleniyor. PDF ve Excel dosyası bütün satırları içerir.</p>`:'');
}
async function reportDownloadFetch(url,format,stem){
  ozet.assertOnline();
  const response=await fetch(API+url,{credentials:'same-origin',cache:'no-store',headers:{'x-requested-with':'DestekOfisMobile'}});
  if(!response.ok){let message='Dosya alınamadı.';try{message=(await response.json()).error||message}catch{}throw Error(message)}
  const mime=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if(!String(response.headers.get('content-type')||'').includes(mime))throw Error('Beklenmeyen dosya türü.');
  const blob=await response.blob();if(blob.size>25*1024*1024)throw Error('Dosya çok büyük.');
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=`${stem}.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
}
async function downloadReport(format){
  if(!['pdf','xlsx'].includes(format)||!state.reportSelected||!state.reportResult)return;
  const report=state.reportSelected,company=state.company,query=state.reportQuery||{};
  const buttons=document.querySelectorAll('[data-report-download]');buttons.forEach(b=>b.disabled=true);
  try{await reportDownloadFetch(reportUrl(report.id,query,`/${format}`),format,`DestekOfis-${report.id}`);if(company!==state.company)toast('Şirket değişti; dosyanın şirket başlığını denetleyin.',true)}catch(e){toast(e.message,true)}finally{buttons.forEach(b=>b.disabled=false)}
}
async function downloadAccountStatement(id){
  try{await reportDownloadFetch(path(`/accounts/${encodeURIComponent(id)}/statement.pdf`),'pdf','Cari-Ekstre')}catch(e){toast(e.message,true)}
}
async function startSession(){const auth=await api('/session');setAuth(auth);state.writesEnabled=auth.writesEnabled===true;state.writes=auth.writes||{};setPage('home')}
// ---------- 2.4.7 M2: cihaz anahtarı, eşleme ve imzalı giriş ----------
const KEY_DB='destekofis-mobil',KEY_STORE='cihaz';
function keyDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(KEY_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(KEY_STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function keyOp(mode,fn){const db=await keyDb();return new Promise((resolve,reject)=>{const tx=db.transaction(KEY_STORE,mode);const req=fn(tx.objectStore(KEY_STORE));tx.oncomplete=()=>{db.close();resolve(req.result)};tx.onerror=()=>{db.close();reject(tx.error)}})}
const b64url=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const secure=()=>window.isSecureContext&&!!window.crypto?.subtle&&!!window.indexedDB;
function deviceKind(){const ua=navigator.userAgent||'';if(/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return 'tablet';if(/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua))return 'telefon';return 'tarayici'}
function deviceNameGuess(){const ua=navigator.userAgent||'';if(/iPhone/.test(ua))return 'iPhone';if(/iPad/.test(ua))return 'iPad';const kind=deviceKind();return kind==='telefon'?'Android Telefon':kind==='tablet'?'Tablet':'Uzak Tarayıcı'}
function showPanel(id){for(const p of ['login-form','pair-form','unpaired'])$(p).classList.toggle('hidden',p!==id);$('login').classList.remove('hidden');$('app').classList.add('hidden')}
function showUnpaired(message){state.user=null;if(message)$('unpaired-text').textContent=message;showPanel('unpaired')}
const pairing={code:''};
function showPair(code){pairing.code=code;$('device-name').value=deviceNameGuess();showPanel('pair-form')}
// Uzak bağlantıda girişin cihaz kanıtı: meydan okuma + cihaz anahtarıyla imza. Ofis ağında uç yoktur (404) → olağan giriş.
async function loginProof(){let ch;try{ch=await api('/session/challenge')}catch(e){if(e.status===404)return null;throw e}
  if(!secure())throw Error('Bu bağlantı güvenli değil (https gerekli); cihaz doğrulanamadı.');
  const stored=await keyOp('readonly',s=>s.get('anahtar'));if(!stored?.privateKey)throw Error('Bu tarayıcıda cihaz anahtarı yok; karekodu yeniden okutun.');
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},stored.privateKey,new TextEncoder().encode(`DestekOfis-mobil-giris\n${ch.device}\n${ch.nonce}`));
  return {nonce:ch.nonce,signature:b64url(signature)}}
$('pair-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('pair-submit');button.disabled=true;$('pair-error').classList.add('hidden');try{
  if(!secure())throw Error('Eşleme için güvenli bağlantı (https) gerekir; karekoddaki adresi açın.');
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicJwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  const enc=await ozet.sifreAnahtari();
  const paired=await api('/eslesme',{kod:pairing.code,ad:$('device-name').value,tur:deviceKind(),anahtar:{kty:publicJwk.kty,crv:publicJwk.crv,x:publicJwk.x,y:publicJwk.y},sifre:enc.acik});
  await keyOp('readwrite',s=>s.put({privateKey:keys.privateKey,publicJwk},'anahtar'));
  await ozet.eslesmeKaydet(paired,enc);
  pairing.code='';toast('Cihaz eşlendi. Kullanıcı adınız ve parolanızla girin.');showPanel('login-form')
}catch(err){if(err instanceof SessionEnded)return;$('pair-error').textContent=err.message;$('pair-error').classList.remove('hidden')}finally{button.disabled=false}});

$('login-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('login-submit');button.disabled=true;$('login-error').classList.add('hidden');try{const proof=await loginProof();await api('/session/login',{username:$('username').value,password:$('password').value,...(proof||{})});$('password').value='';await startSession()}catch(err){$('login-error').textContent=err.message;$('login-error').classList.remove('hidden');if(err.unreachable)ozet.offer()}finally{button.disabled=false}});
$('company').addEventListener('change',e=>{state.company=e.target.value;state.reportSelected=null;state.reportQuery=null;state.reportResult=null;state.reportChosenAccount=null;state.reportCatalog=[];setPage('home')});
document.addEventListener('click',async e=>{const reportPick=e.target.closest('[data-report-pick]');if(reportPick){selectReport(reportPick.dataset.reportPick);return}const reportBack=e.target.closest('[data-report-back]');if(reportBack){renderReportCatalog();return}const reportSearch=e.target.closest('[data-report-search]');if(reportSearch){searchReportAccounts();return}const reportDownload=e.target.closest('[data-report-download]');if(reportDownload){downloadReport(reportDownload.dataset.reportDownload);return}const reportStatement=e.target.closest('[data-account-statement]');if(reportStatement){downloadAccountStatement(reportStatement.dataset.accountStatement);return}const nav=e.target.closest('[data-nav]');if(nav){setPage(nav.dataset.nav);return}const row=e.target.closest('[data-detail]');if(row){const [kind,id]=row.dataset.detail.split(':');if(id)detail(kind,id);return}const act=e.target.closest('[data-action]')?.dataset.action;if(!act)return;if(act==='refresh'){if(ozet.aktif())return ozet.refresh(startSession);state.selected?detail(state.selected.kind,state.selected.id):load()}if(act==='back')setPage(state.page);if(act==='logout'){if(!ozet.aktif()){try{await api('/session/logout',{})}catch{}}loggedOut()}});
$('content').addEventListener('input',e=>{if(e.target.id==='list-search')listSearch(e.target.value,e.target.selectionStart)});
$('content').addEventListener('submit',e=>{if(e.target.id==='report-filter-form'){e.preventDefault();submitReportFilters(e.target)}});
// Karekoddan açılış: #eslesme=<kod> (kod sunucuya adres satırıyla gitmez); adres çubuğundan hemen silinir.
ozet.bagla({keyOp,b64url,secure,setAuth,serverState,loggedOut,showUnpaired,setPage,state,SessionEnded}); // 2.4.7 M3
(async()=>{const m=/^#eslesme=([A-Za-z0-9_-]{8,64})$/.exec(location.hash);if(m){history.replaceState(null,'',location.pathname+location.search);showPair(m[1]);return}try{await startSession()}catch(e){if(!(e instanceof SessionEnded)){loggedOut();if(e.unreachable)ozet.offer()}}})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
// 2.4.7 M5: kayıt girişi (yazma.js — tahsilat, ödeme, taksit tahsilatı, stok girişi); modül yüklenemezse mobil salt okunur kalır.
let yazma=null;import('./yazma.js').then(m=>{yazma=m;m.initYazma({state,path,safe,money,toast,detail,loggedOut,serverState})}).catch(()=>{});
