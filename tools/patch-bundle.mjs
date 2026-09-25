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
    replace: 'className:u===Z?"selected":"","data-hof-key":Z.__hofKey||"",onClick:()=>G(Z,gt)',
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
      'st=C.useMemo(()=>{const Z=new Set;for(const gt of tt?.tabs??[])gt.title.trim()&&Z.add(gt.title.trim());for(const gt of it)gt.__sheet?.trim()&&Z.add(gt.__sheet.trim());return Array.from(Z)},[it,tt?.tabs]),hofP=st.includes(P)?P:st[0]??null,hofQ=n.trim().toLocaleLowerCase("tr-TR"),hofText=C.useMemo(()=>hofQ?it.map(Z=>Object.values(Z).join(" ").toLocaleLowerCase("tr-TR")):null,[it,!!hofQ]),hofHits=C.useMemo(()=>{const Z=new Map;let gt=0;it.forEach((Yt,Dt)=>{if(hofQ&&!hofText[Dt].includes(hofQ))return;const xe=Yt.__sheet?.trim()||"";Z.set(xe,(Z.get(xe)||0)+1),gt++});return{total:gt,count:Yt=>Z.get(Yt)||0}},[it,hofText,hofQ]),ut=C.useMemo(()=>hofP===null?it:it.filter(Z=>Z.__sheet===hofP),[it,hofP]),w=C.useMemo(()=>dT(ut,nt),[ut,nt])',
  },
  {
    id: "sekme-hatirla",
    why: "Sayfa yenilenince (ör. güncellemeden sonra) en son açılan sekme açılır.",
    find: '[P,M]=C.useState("Tümü")',
    replace: '[P,M]=C.useState(()=>{try{return sessionStorage.getItem("hof-tab")||"Tümü"}catch{return"Tümü"}})',
  },
  {
    id: "tumu-dugmesi-yok",
    why: "Tümü düğmesi kaldırıldı; sekme düğmeleri aramada eşleşme sayısını gösterir.",
    find: 'children:P==="Tümü"?`${it.length} toplam kayıt`:`${ut.length} kayıt`})]}),x.jsxs("div",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-tabs",children:[x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:P==="Tümü"?"category-tab active":"category-tab",onClick:()=>M("Tümü"),children:["Tümü ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:it.length})]}),st.map(Z=>x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:P===Z?"category-tab active":"category-tab",onClick:()=>M(Z),title:Z,children:[Z," ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:it.filter(gt=>gt.__sheet===Z).length})]},Z))]})',
    replace:
      'children:hofQ?`${hofHits.total} sonuç · tüm sekmelerde`:st.length>1?`${ut.length} kayıt · toplam ${it.length}`:`${ut.length} kayıt`})]}),x.jsxs("div",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-tabs",children:[st.map(Z=>{const hofN=hofHits.count(Z);return x.jsxs("button",{"data-loc":"client/src/pages/Home.tsx:86",className:(hofP===Z?"category-tab active":"category-tab")+(hofQ&&!hofN?" hof-tab-nohit":""),onClick:()=>{M(Z);try{sessionStorage.setItem("hof-tab",Z)}catch{}},title:Z,"aria-pressed":hofP===Z,children:[Z," ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:86",children:hofN})]},Z)})]})',
  },
  {
    id: "tek-sekmede-serit-yok",
    why: "Tek sekmeli veride sekme şeridi gereksiz yer kaplamasın.",
    find: 'st.length>0&&x.jsxs("section",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-bar"',
    replace: 'st.length>1&&x.jsxs("section",{"data-loc":"client/src/pages/Home.tsx:86",className:"category-bar"',
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
  {
    id: "tum-kayitlar-sayisi",
    why: "Kenar çubuğundaki 'Tüm kayıtlar' sayısı açık sekmenin değil, tüm verinin kayıt sayısı.",
    find: '" Tüm kayıtlar ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:82",className:"nav-count",children:w.rows.length})',
    replace: '" Tüm kayıtlar ",x.jsx("span",{"data-loc":"client/src/pages/Home.tsx:82",className:"nav-count",children:it.length})',
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
