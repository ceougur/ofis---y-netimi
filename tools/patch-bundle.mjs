// Derlenmiş arayüz paketine (kaynak kodu olmayan Manus/Vite çıktısı) küçük, doğrulanmış yamalar uygular.
// Her yama tam olarak BİR kez eşleşmek zorundadır; eşleşmezse işlem durur ve paket değişmez.
// Kullanım: node tools/patch-bundle.mjs   → client/assets/app-<özet>.js ve app-<özet>.css üretir, index.html'i günceller.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "client", "assets");

export const PATCHES = [
  {
    id: "varsayilan-sheet-kaldir",
    why: "Geliştiricinin kendi Google Sheet bağlantısı her yeni kurulumda varsayılan kaynak olarak açılıyordu.",
    find: /hT="https:\/\/docs\.google\.com\/spreadsheets\/[^"]*"/,
    replace: 'hT=""',
  },
  {
    id: "ic-alanlari-kolon-yapma",
    why: "Sunucunun eklediği __hofKey gibi iç alanlar tabloda kolon olarak görünmesin.",
    find: 'Object.keys(N).filter(U=>U!=="__sheet"&&U.trim())',
    replace: 'Object.keys(N).filter(U=>!U.startsWith("__")&&U.trim())',
  },
  {
    id: "satir-kimligi",
    why: "Her tablo satırı sunucunun hesapladığı dosya kimliğini taşısın (DOM'dan tahmin yerine).",
    find: 'className:u===Z?"selected":"",onClick:()=>G(Z,gt)',
    replace: 'className:(u===Z?"selected":"")+(Z.__hofFlag?" hof-row-flagged":""),"data-hof-key":Z.__hofKey||"",onClick:()=>G(Z,gt)',
  },
  {
    id: "detay-kimligi",
    why: "Detay paneli seçili dosyanın kimliğini taşısın.",
    find: 'className:"panel detail-panel",children:u?',
    replace: 'className:"panel detail-panel","data-hof-key":u&&u.__hofKey||"","data-hof-case":ft?ft.id:"",children:u?',
  },
  {
    id: "secimi-koru",
    why: "Senkron veya düzenleme sonrası tablo yenilenince seçili dosya ve yazılmakta olan not kaybolmasın.",
    find: 'C.useEffect(()=>{const Z=w.displayRows[0];f(Z??null),h(0),$(Z?no(Z,0).note:"")},[w.displayRows])',
    replace: 'C.useEffect(()=>{const hk=u&&u.__hofKey,hi=hk?w.displayRows.findIndex(R=>R.__hofKey===hk):-1;if(hi>=0){f(w.displayRows[hi]),h(hi);return}const Z=w.displayRows[0];f(Z??null),h(0),$(Z?no(Z,0).note:"")},[w.displayRows])',
  },
  {
    id: "kaynak-etiketi",
    why: "Merkezi Excel kaynağında başlık ve kaynak adı dosya adını göstersin.",
    find: '[nt,X]=C.useState("Google Sheets")',
    replace: '[nt,X]=C.useState(()=>window.localStorage.getItem("hukuk-ofisi-active-source-label")||"Google Sheets")',
  },
  {
    id: "not-mesaji",
    why: "Notlar artık merkezi sunucuda saklanıyor.",
    find: "Bu cihazda kalıcı olarak saklandı.",
    replace: "Merkezi sunucuya kaydedildi; tüm bilgisayarlarda görünür.",
  },
  {
    id: "marka-adi",
    why: "Ürün adı DestekOfis.",
    find: 'children:"Hukuk Ofisi"',
    replace: 'children:"DestekOfis"',
  },
  {
    id: "marka-alt-baslik",
    why: "Ürün alt başlığı.",
    find: 'children:"Akıllı tablo otomasyonu"',
    replace: 'children:"Ofis yönetimi"',
  },
  // ---- v1.7.0: "Tümü" sekmesi kaldırıldı ----
  // Farklı kolonlu sekmeleri tek tabloya zorlamak boş kolonlar üretiyordu (ör. çek sekmesinde "icra dairesi"). Artık her
  // zaman bir sekme açıktır: varsayılan ilk sekme (sunucunun sırasıyla), sayfa yenilenince en son açılan sekme. Arama
  // kutusu dolunca her sekmenin düğmesi o sekmedeki eşleşme sayısını gösterir; eşleşmesi olmayan sekmeler soluklaşır.
  {
    id: "tumu-yok-kapsam",
    why: "Tümü birleşik görünümü yerine her zaman bir sekme; sekme sırası sunucunun; aramada sekme başına eşleşme sayısı.",
    find: 'st=C.useMemo(()=>{const Z=new Set;for(const gt of it)gt.__sheet?.trim()&&Z.add(gt.__sheet.trim());for(const gt of tt?.tabs??[])gt.title.trim()&&Z.add(gt.title.trim());return Array.from(Z)},[it,tt?.tabs]),ut=C.useMemo(()=>P==="Tümü"?it:it.filter(Z=>Z.__sheet===P),[it,P]),w=C.useMemo(()=>dT(ut,P==="Tümü"?nt:P),[ut,P,nt])',
    replace:
      'st=C.useMemo(()=>{const Z=new Set;for(const gt of tt?.tabs??[])gt.title.trim()&&Z.add(gt.title.trim());for(const gt of it)gt.__sheet?.trim()&&Z.add(gt.__sheet.trim());if(it.some(gt=>gt.__hofFlag))Z.add("⚠ İşaretlenen hatalar");return Array.from(Z)},[it,tt?.tabs]),hofP=st.includes(P)?P:st[0]??null,hofQ=n.trim().toLocaleLowerCase("tr-TR"),hofText=C.useMemo(()=>hofQ?it.map(hofTextOf):null,[it,!!hofQ]),hofHits=C.useMemo(()=>{const Z=new Map;let gt=0;it.forEach((Yt,Dt)=>{if(hofQ&&!hofText[Dt].includes(hofQ))return;const xe=Yt.__sheet?.trim()||"";Z.set(xe,(Z.get(xe)||0)+1),gt++;if(Yt.__hofFlag)Z.set("⚠ İşaretlenen hatalar",(Z.get("⚠ İşaretlenen hatalar")||0)+1)});return{total:gt,count:Yt=>Z.get(Yt)||0}},[it,hofText,hofQ]),ut=C.useMemo(()=>hofP===null?it:hofP==="⚠ İşaretlenen hatalar"?it.filter(Z=>Z.__hofFlag):it.filter(Z=>Z.__sheet===hofP),[it,hofP]),w=C.useMemo(()=>dT(ut,nt),[ut,nt])',
  },
  {
    id: "sekme-hatirla",
    why: "Sayfa yenilenince (ör. güncellemeden sonra) en son açılan sekme açılır.",
    find: '[P,M]=C.useState("Tümü")',
    replace: '[P,M]=C.useState(()=>{try{return sessionStorage.getItem("hof-tab")||"Tümü"}catch{return"Tümü"}})',
  },
  {
    id: "tumu-dugmesi-yok",
    why: "Tümü düğmesi kaldırıldı; sekme düğmeleri aramada eşleşme sayısını gösterir. v2.0.2: şeridin sağındaki sayaç ('10 kayıt · toplam 30', aramada 'N sonuç') yazılmaz.",
    find: 'children:P==="Tümü"?`${it.length} toplam kayıt`:`${ut.length} kayıt`})]}),x.jsxs("div",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-tabs",children:[x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:P==="Tümü"?"category-tab active":"category-tab",onClick:()=>M("Tümü"),children:["Tümü ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:it.length})]}),st.map(Z=>x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:P===Z?"category-tab active":"category-tab",onClick:()=>M(Z),title:Z,children:[Z," ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:it.filter(gt=>gt.__sheet===Z).length})]},Z))]})',
    replace:
      'children:null})]}),x.jsxs("div",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-tabs",children:[st.map(Z=>{const hofN=hofHits.count(Z);return x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:(hofP===Z?"category-tab active":"category-tab")+(hofQ&&!hofN?" hof-tab-nohit":""),onClick:()=>{M(Z);try{sessionStorage.setItem("hof-tab",Z)}catch{}},title:Z,"aria-pressed":hofP===Z,children:[Z," ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:hofN})]},Z)})]})',
  },
  {
    id: "tek-sekmede-serit-yok",
    why: "Tek sekmeli veride sekme şeridi gereksiz yer kaplamasın; sayfa ekleyebilen kullanıcıda (v2.0.1, hof-free.js) şerit \"+ Sayfa\" düğmesi için her zaman görünür.",
    find: 'st.length>0&&x.jsxs("section",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-bar"',
    replace: '(st.length>1||st.length>0&&window.hofAlwaysTabs===!0)&&x.jsxs("section",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-bar"',
  },
  {
    id: "tablo-basligi-sekme",
    why: "Sayfa başlığı verinin adı, tablo başlığı açık sekmenin adı.",
    find: 'className:"panel-title",children:w.title',
    replace: 'className:"panel-title",children:st.length>1?hofP:w.title',
  },
  {
    id: "disa-aktar-sekme-adi",
    why: "Dışa aktarılan dosya açık sekmenin kayıtlarıdır; dosya adında sekmenin adı da yazar.",
    find: 'Yt.download=`${w.title||"tablo"}.csv`,Yt.click(),URL.revokeObjectURL(gt),ja.success("Analiz edilen tablo CSV olarak indirildi")',
    replace: 'Yt.download=`${w.title||"tablo"}${st.length>1?` - ${hofP.replace(/[\\\\/:*?"<>|]+/g," ")}`:""}.csv`,Yt.click(),URL.revokeObjectURL(gt),ja.success(st.length>1?`“${hofP}” sekmesi CSV olarak indirildi`:"Analiz edilen tablo CSV olarak indirildi")',
  },
  // ---- v2.0.0: sektörden bağımsız varsayılanlar ----
  {
    id: "notr-varsayilanlar",
    why: "Paketin iç kayıt özeti eksik alanlarda hukuka özgü metin (borçlu, icra, gayrimenkul satış) üretiyordu.",
    find: 'client:u||"Borçlu belirtilmemiş",creditor:s,type:d||"Gayrimenkul satış dosyası",court:f||"İcra bilgisi belirtilmemiş"',
    replace: 'client:u||"Belirtilmemiş",creditor:s,type:d||"Kayıt",court:f||"Belirtilmemiş"',
  },
  {
    id: "hukuk-suzgeci-yalniz-hukukta",
    why: "Dosya/borçlu/icra kolonu görünce açılan durum süzgeci (İcra aşamasında, Kapanmış) yalnızca hukuk profilinde çalışsın.",
    find: 'z=!!(q.length&&w.columns.some(Z=>/dosya|borçlu|borclu|icra/i.test(Z.label)))',
    replace: 'z=!!(window.HOF?.modules?.haciz&&q.length&&w.columns.some(Z=>/dosya|borçlu|borclu|icra/i.test(Z.label)))',
  },
  // ---- v2.0.2: sade kenar çubuğu ----
  {
    id: "kenar-cubugu-sade",
    why: "Kenar çubuğundaki 'Çalışma alanı' ve 'Veri kaynağı' başlıkları, 'Dinamik görünüm' (işlevsiz), 'Tüm kayıtlar' (işlevsiz; tüm sekmelerin satırlarını sayan yanıltıcı sayı) ve 'Bu ay' (tahsilat takvimi ve zil aynı işi görüyor) kaldırıldı. 'Ayarlar' yerinde kalır.",
    find: "x.jsx(\"p\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-label\",children:\"ÇALIŞMA ALANI\"}),x.jsxs(\"button\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-item active\",children:[x.jsx(S_,{\"data-loc\":\"client/src/pages/Home.tsx:82\",size:17}),\" Dinamik görünüm\"]}),x.jsxs(\"button\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-item\",children:[x.jsx(rv,{\"data-loc\":\"client/src/pages/Home.tsx:82\",size:17}),\" Tüm kayıtlar \",x.jsx(\"span\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-count\",children:w.rows.length})]}),x.jsxs(\"button\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-item\",children:[x.jsx(tv,{\"data-loc\":\"client/src/pages/Home.tsx:82\",size:17}),\" Bu ay \",x.jsx(\"span\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-count soft\",children:w.currentMonthRows.length})]}),x.jsx(\"p\",{\"data-loc\":\"client/src/pages/Home.tsx:82\",className:\"nav-label mt-8\",children:\"VERİ KAYNAĞI\"}),",
    replace: "",
  },
  {
    id: "tum-kolonlar-basliklar",
    why: "v2.0.2: tablo yalnızca ilk 7 kolonu gösteriyordu; Excel/Sheets'teki dolu tüm kolonlar gösterilir (yatay kaydırma, hof-grid.js).",
    find: 'children:w.columns.slice(0,7).map(Z=>x.jsx("th"',
    replace: 'children:w.columns.map(Z=>x.jsx("th"',
  },
  {
    id: "tum-kolonlar-hucreler",
    why: "v2.0.2: satırlarda da tüm kolonlar.",
    find: 'children:w.columns.slice(0,7).map(Dt=>',
    replace: 'children:w.columns.map(Dt=>',
  },
  {
    id: "tablo-alt-basligi",
    why: "v2.0.2: tablo artık tüm kolonları gösterir; \"öncelikli kayıt\" ifadesi yanıltıcıydı.",
    find: 'w.displayRows.length," öncelikli kayıt · ",w.columns.length," kolon otomatik oluşturuldu"',
    replace: 'w.displayRows.length," kayıt · ",w.columns.length," kolon"',
  },
  // ---- v2.0.6: büyük tabloda arama hızı ----
  // 9 bin satırlık veride her tuşta tüm satırlar yeniden çiziliyordu (9 bin satır × 24 kolon ≈ 216 bin hücre) ve her satırın
  // metni yeniden küçük harfe çevriliyordu. Artık paket yalnız açık sayfanın satırlarını çizer (sayfa penceresi
  // HOF.tableWindow ile kaplama modüllerine verilir; hof-table.js sayfalamayı, hof-insight.js kayda gitmeyi buradan
  // yürütür) ve satır metinleri satır nesnesine bağlı önbellekte tutulur.
  {
    id: "arama-metni-onbellek",
    why: "Satırın arama metni (küçük harfe çevrilmiş tüm değerler) her tuşta değil bir kez hesaplanır; sayfa penceresi durumu.",
    find: 'function pT(){const[n,r]=C.useState("")',
    replace:
      'const hofRowText=new WeakMap,hofTextOf=Z=>{let v=hofRowText.get(Z);return v===void 0&&(v=Object.values(Z).join(" ").toLocaleLowerCase("tr-TR"),hofRowText.set(Z,v)),v},hofPageSize=20;function pT(){const[hofPg,hofSetPg]=C.useState(1),[n,r]=C.useState("")',
  },
  {
    id: "arama-suzgeci-onbellekten",
    why: "Arama süzgeci önbellekteki satır metnini kullanır.",
    find: 'const Yt=Object.values(Z).join(" ").toLocaleLowerCase("tr-TR"),Dt=!n.trim()||Yt.includes(n.trim().toLocaleLowerCase("tr-TR")),xe=',
    replace: 'const Dt=!hofQ||hofTextOf(Z).includes(hofQ),xe=',
  },
  {
    id: "tablo-penceresi",
    why: "Sayfa penceresi: arama/sekme/durum değişince 1. sayfa; pencere ve sayfa değiştirme kaplama modüllerine verilir.",
    find: ",[w.displayRows,q,z,n,i]);",
    replace:
      ',[w.displayRows,q,z,n,i]),hofTotal=Math.max(1,Math.ceil(lt.length/hofPageSize)),hofCur=Math.min(hofPg,hofTotal);C.useEffect(()=>{hofSetPg(1)},[n,hofP,i]);C.useEffect(()=>{const H=window.HOF;if(!H)return;H.tableWindow={page:hofCur,size:hofPageSize,pages:hofTotal,total:lt.length,setPage:R=>hofSetPg(Math.max(1,Math.min(hofTotal,Number(R)||1))),indexOf:R=>lt.findIndex(Z=>Z.record.__hofKey===R)},H.emit&&H.emit("table-window")},[lt,hofCur,hofTotal]);',
  },
  {
    id: "tablo-sayfasi-ciz",
    why: "Tablo gövdesi yalnız açık sayfanın satırlarını çizer.",
    find: 'x.jsx("tbody",{"data-loc":"client/src/pages/Home.tsx:90",children:lt.map(',
    replace: 'x.jsx("tbody",{"data-loc":"client/src/pages/Home.tsx:90",children:lt.slice((hofCur-1)*hofPageSize,hofCur*hofPageSize).map(',
  },
  // Profil (9 bin satır, 24 kolon): zamanın dörtte üçü Ti'de (Türkçe küçük harf) — kayıt kartı için her satırda sütun adları
  // ~11 kez yeniden normalize ediliyordu (~2,4 milyon çağrı, 5,5 sn). Sonuçlar önbelleğe alınır; rn aynı sütun kümesi ve
  // aday listesi için eşleşen sütunu bir kez bulur; localStorage'daki notlar satır başına değil değişince ayrıştırılır.
  {
    id: "ti-onbellek",
    why: "Türkçe küçük harfe çevirme (Ti) sonuçları önbellekte: sütun adları ve durum metinleri hep aynı.",
    find: "function Ti(n){return n.trim().toLocaleLowerCase(\"tr-TR\").replace(/[İI]/g,\"i\").replace(/ı/g,\"i\")}",
    replace: "const hofTiCache=new Map;function Ti(n){let v=hofTiCache.get(n);if(v===void 0){v=n.trim().toLocaleLowerCase(\"tr-TR\").replace(/[İI]/g,\"i\").replace(/ı/g,\"i\");if(hofTiCache.size>2e4)hofTiCache.clear();hofTiCache.set(n,v)}return v}",
  },
  {
    id: "rn-onbellek",
    why: "Alan eşleme (rn): sütun kümesi + aday listesi + eşleme ayarı için eşleşen sütun adı bir kez bulunur.",
    find: "function rn(n,r){const i=r.map(Ti);try{const s=JSON.parse(window.localStorage.getItem(\"hukuk-ofisi-ai-mapping\")||\"{}\"),u=r.join(\"|\");const f=/Dosya No|Dosya Numarası|Dosya|Esas/i.test(u)?\"case_id\":/Alacaklı|Alacakli|Müvekkil/i.test(u)?\"creditor\":/Borçlu|Borclu|Ad Soyad/i.test(u)?\"debtor\":/İcra|Mahkeme|Daire/i.test(u)?\"court\":/Dosyanın Son Durumu|Son Durum|Açıklama|Not/i.test(u)?\"status\":/Ödeme|Avans|Tahsil|Alacak|Bakiye|Borç/i.test(u)?\"payment\":/Satış.*Tarihi|Takip Tarihi/i.test(u)?\"sale_date\":/Kıymet Takdiri/i.test(u)?\"valuation_date\":\"\";s[f]&&i.unshift(Ti(s[f]))}catch{}return Object.entries(n).find(([s])=>i.includes(Ti(s)))?.[1]?.trim()??\"\"}",
    replace: "const hofRnCache=new Map;function rn(n,r){const m=window.localStorage.getItem(\"hukuk-ofisi-ai-mapping\")||\"{}\",keys=Object.keys(n),ck=keys.join(\"\\u0001\")+\"\\u0002\"+r.join(\"|\")+\"\\u0002\"+m;let key=hofRnCache.get(ck);if(key===void 0){const i=r.map(Ti);try{const s=JSON.parse(m),u=r.join(\"|\");const f=/Dosya No|Dosya Numarası|Dosya|Esas/i.test(u)?\"case_id\":/Alacaklı|Alacakli|Müvekkil/i.test(u)?\"creditor\":/Borçlu|Borclu|Ad Soyad/i.test(u)?\"debtor\":/İcra|Mahkeme|Daire/i.test(u)?\"court\":/Dosyanın Son Durumu|Son Durum|Açıklama|Not/i.test(u)?\"status\":/Ödeme|Avans|Tahsil|Alacak|Bakiye|Borç/i.test(u)?\"payment\":/Satış.*Tarihi|Takip Tarihi/i.test(u)?\"sale_date\":/Kıymet Takdiri/i.test(u)?\"valuation_date\":\"\";s[f]&&i.unshift(Ti(s[f]))}catch{}key=keys.find(s=>i.includes(Ti(s)))??\"\";if(hofRnCache.size>5e3)hofRnCache.clear();hofRnCache.set(ck,key)}return key?n[key]?.trim()??\"\":\"\"}",
  },
  {
    id: "not-onbellek",
    why: "Kayıt kartındaki not localStorage'dan satır başına değil, değer değişince ayrıştırılır.",
    find: "note:(()=>{try{const Z=JSON.parse(window.localStorage.getItem(\"hukuk-ofisi-notlar\")||\"{}\");return Z[i||`Kayıt ${r+1}`]??h}catch{return h}})()",
    replace: "note:hofNoteOf(i||`Kayıt ${r+1}`,h)",
  },
  {
    id: "not-onbellek-yardimci",
    why: "hofNoteOf yardımcısı.",
    find: "function no(n,r){",
    replace: "let hofNotesRaw=null,hofNotesObj={};function hofNoteOf(k,h){try{const raw=window.localStorage.getItem(\"hukuk-ofisi-notlar\")||\"{}\";if(raw!==hofNotesRaw){hofNotesRaw=raw;hofNotesObj=JSON.parse(raw)||{}}return hofNotesObj[k]??h}catch{return h}}function no(n,r){",
  },
];

// Stil dosyası: Google Fonts'a giden dış @import kaldırılır (yazı tipleri artık sunucudan, çevrimdışı çalışır).
export function patchStyles(source) {
  const output = source.replace(/@import\s*"https:\/\/fonts\.googleapis\.com[^"]*";?/, "");
  if (output === source && /fonts\.googleapis\.com/.test(source)) throw new Error("Google Fonts içe aktarımı kaldırılamadı.");
  return output;
}

export function applyPatches(source) {
  let output = source;
  const report = [];
  for (const patch of PATCHES) {
    const isRegex = patch.find instanceof RegExp;
    const matches = isRegex ? output.match(new RegExp(patch.find.source, "g")) || [] : output.split(patch.find).length - 1;
    const count = isRegex ? matches.length : matches;
    const alreadyApplied = !count && output.includes(patch.replace);
    if (alreadyApplied) {
      report.push({ id: patch.id, status: "zaten uygulanmış" });
      continue;
    }
    if (count !== 1) throw new Error(`Yama "${patch.id}" ${count} kez eşleşti (tam 1 bekleniyordu).`);
    output = isRegex ? output.replace(patch.find, patch.replace) : output.replace(patch.find, () => patch.replace);
    report.push({ id: patch.id, status: "uygulandı" });
  }
  return { output, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const vendor = path.join(root, "tools", "vendor");
  const { output, report } = applyPatches(readFileSync(path.join(vendor, "app-bundle.original.js"), "utf8"));
  const styles = patchStyles(readFileSync(path.join(vendor, "app-styles.original.css"), "utf8"));
  const hash = content => createHash("sha256").update(content).digest("hex").slice(0, 10);
  const scriptName = `app-${hash(output)}.js`;
  const styleName = `app-${hash(styles)}.css`;
  for (const name of readdirSync(assets)) if (/^app-[0-9a-f]{10}\.(js|css)$/.test(name) && name !== scriptName && name !== styleName) unlinkSync(path.join(assets, name));
  writeFileSync(path.join(assets, scriptName), output);
  writeFileSync(path.join(assets, styleName), styles);
  const indexPath = path.join(root, "client", "index.html");
  const html = readFileSync(indexPath, "utf8");
  const updated = html
    .replace(/<meta name="hof-app-bundle" content="[^"]*">/, `<meta name="hof-app-bundle" content="/assets/${scriptName}">`)
    .replace(/<link rel="stylesheet" href="\/assets\/(?:index|app)-[^"]+\.css" \/>/, `<link rel="stylesheet" href="/assets/${styleName}" />`);
  if (!updated.includes(scriptName) || !updated.includes(styleName)) throw new Error("index.html içinde paket etiketleri bulunamadı.");
  writeFileSync(indexPath, updated);
  for (const item of report) console.log(`${item.status.padEnd(18)} ${item.id}`);
  console.log(`Paket: client/assets/${scriptName}, client/assets/${styleName}`);
}
