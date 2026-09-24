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
    replace: 'children:"Hukuk ofisi yönetimi"',
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
