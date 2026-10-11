// Yazım düzeni (v2.0.11, kullanıcı kararı): programın ürettiği adlar — pencere başlığı, düğme, sekme, menü, kolon başlığı,
// gösterge, form alanı ve açılır liste seçeneği — her sözcüğün ilk harfi büyük yazılır ("Cari Listesi ve Bakiyeler").
// Bağlaçlar ("ve", "ile", "veya", "ya da", "de/da", "ki") küçük; parantez içi açıklama, cümleler (yardım, uyarı,
// bildirim, onay kutusu metni) ve kullanıcının verisi olduğu gibi kalır. Bu test yeni eklenen bir etiket kurala uymazsa
// kırılır; bilerek cümle olarak kalan kısa metinler aşağıdaki listededir.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { titleCase } from "../server/lib/text-case.mjs";

const ROOT = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, ROOT), "utf8");
// Bilerek cümle düzeninde kalan kısa metinler (durum cümleleri, soru/uyarı başlıkları, yarım cümleler).
const SENTENCES = new Set([
    "Kasa'ya girmez",
    "Bağlı değil",
    "Yeni sürüm hazır: DestekOfis",
    "Bu kişi için",
    "Aktarım tamamlandı",
    "Aynı cari zaten varsa",
    "Aynı numaralı evrak var",
    "Aynı ürün zaten varsa",
    "Bilgisayar saati geri alınmış",
    "Birim kolonu yoksa",
    "Bu alan formülle hesaplanıyor",
    "Bu alan siz bakarken değişti",
    "Bu dosya şu anki veriden",
    "Bu dosyada olmayan kolonlar:",
    "Bu sayfa yöneticiler içindir",
    "Bırakın, bu kayda eklensin",
    "Deneme ve lisans aynı programdır:",
    "DestekOfis'i kullanmaya devam ettiğiniz için teşekkürler",
    "Detay kartında başlığın yanındaki simge kolonun",
    "Devretme — görevler silinen kişide kalsın",
    "Dosyanın önemli bir bölümü kayda giremedi;",
    "Doğrulanan kartlar",
    "Elle gireceğim (kart açılınca tek tek)",
    "Emin olunamayan veriye sektör atanmaz",
    "Evrak kolonu yoksa hepsi",
    // Fatura Ayarları onay kutuları (v2.0.15): cümle.
    "Fiyatlar varsayılan olarak KDV dahil yazılsın",
    "Kaydedilen e-Belge entegratöre hemen gönderilsin",
    // Banka hesap formu ve Kurulum Sihirbazı onay kutuları (v2.1.0): cümle.
    "Bu tutar bankadaki gerçek bakiyedir (Bakiye Doğrulandı)",
    "Açılış bakiyesi bankadaki gerçek bakiyedir (Bakiye Doğrulandı)",
    "IBAN faturada gösterilsin",
    "Excel/Sheets tablolarınızdaki",
    "Eşleşen kayıt yok",
    "Geçiş dönemi doldu",
    "Grup kolonu yoksa hepsi bu gruba",
    "Gösterilmeyen kartlar ve nedenleri",
    "Hayır — carinin borcundan düş",
    "Her carinin kendi kartındaki alandan",
    "Herkese aynı toplam tutar",
    "Hiç giriş yapmadı",
    "Kart kapatıldı",
    "Kartı var",
    "Kayıtlar okunuyor",
    "Kesin olarak belirlenemedi",
    "Kolon adları düzeltildi",
    "Kullanıcı ilk girişte parolasını değiştirsin (önerilir)",
    "Kurtarma anahtarı hazır",
    "Lisans bu bilgisayara ait değil",
    "Lisans doğrulanamadı",
    "Lisans engellendi",
    "Listeden sektörünüzü seçebilir ya da",
    "Mevcut taksitler silinir",
    "Ofis hesabınızla giriş yapın",
    "Programın kurulu olduğu",
    "Resimli kullanım kılavuzunu açın",
    "Stok eksiye düşecek",
    "Yeni sürümü kendiliğinden kur (sunucu açılışında, 15 dakika boşta kalınca ya da mesai dışında; kapalıyken yalnız haber verilir)",
    "Sunucuya bağlanılamadı",
    "Süre dolunca veriler kaybolmaz:",
    "Sürükleyerek daraltın/genişletin · çift tık: otomatik",
    "Taksit planı oluşturun",
    "Taksit sayısı yazılmayan satırlar için",
    "Taslak Excel: sektörünüzü seçin",
    "Tüm oturumlarda ortak:",
    "Tür kolonu yoksa",
    "Verinizi tanıyoruz",
    "Veriniz hazır",
    "Yalnızca programda görünen ad değişir",
    "Yön kolonu yoksa hepsi",
    "Ödeme alanı otomatik bulunamadı",
    "Ödemesi kesilmiş olabilir",
    "Önce bir veri kaynağı gerekli",
    "İlk girişte değiştirsin",
    "İlk vade yazılmayan satırlar için",
    "İlk vadesi yazılmayanlar için ilk vade",
    "İncele ve karar ver",
    "Şimdilik yok",
    // Kesin olmayan sektör önerisinin göstergesi: ad + kısa talimat (m3, 10.10.2026; "kontrol edin" cümle düzeninde kalır).
    "Orta Güven — kontrol edin"
  ]);

function eligible(text) {
  const s = text.trim();
  if (!s || SENTENCES.has(s) || /[$`<>{}\\]/.test(s) || !/^[+−↶←→↑·✓✎⤓↗#0-9A-ZÇĞİÖŞÜ]/.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 7) return false;
  // "Evet, Uygula" gibi onay düğmeleri cümle sayılmaz; virgülden sonrası da başlık yazımıyla denetlenir.
  const bare = s.replace(/\([^)]*\)/g, "").replace(/^(Evet|Hayır|Tamam),\s*/, "");
  if (/[,;!?]/.test(bare) || /\.\s|\.$/.test(bare) || /(ıyor|iyor|uyor|üyor)(…)?$/.test(bare.trim())) return false;
  // Geçmiş zaman yüklemiyle biten durum/geçmiş satırı ("Fiş kaydedildi", "Süresi doldu", "Kurulum geri alındı") cümledir (m3, 10.10.2026).
  if (/(ıldı|ildi|uldu|üldü|ndı|ndi|ndu|ndü|ştı|şti|ldu|ldü|ldı|ldi|ttı|tti)$/.test(bare.trim())) return false;
  if (/…$/.test(bare.trim()) && !/^[+−]/.test(s) && !/(seç|yaz|ara)…$/.test(bare.trim())) return false;
  return titleCase(s) !== s;
}

function violations(file, { server = false } = {}) {
  const src = read(file);
  const found = [];
  const check = (text, where) => eligible(text) && found.push(`${file} (${where}): “${text.trim()}” → “${titleCase(text.trim())}”`);
  const TAGS = "button|th|option|h1|h2|h3|h4|legend|dt|summary|label|strong|b|span|a|optgroup";
  for (const m of src.matchAll(new RegExp(`<(?:${TAGS})\\b[^<>]*>([^<>\`{}$\\n]{3,60})<`, "g"))) check(m[1], "etiket");
  // Simgeyle başlayan başlık ve düğmeler: <h3>${icon("sparkle")} Toplu Düzeltmeler</h3>, </svg>Excel İndir</a>.
  for (const m of src.matchAll(new RegExp(`<(?:${TAGS})\\b[^<>]*>\\s*\\$\\{[A-Za-z_.]+(?:\\([^)]*\\))?\\}\\s*([^<>\`{}$\\n]{3,60})<`, "g"))) check(m[1], "simgeli etiket");
  for (const m of src.matchAll(/<\/svg>\s*([^<>`{}$\n]{3,60})<\/(?:a|button|span|b|strong|h[1-6]|summary|label)>/g)) check(m[1], "simgeli etiket");
  for (const m of src.matchAll(/\b(title|eyebrow|label|submitLabel|confirmLabel|cancelLabel|heading|submit)\s*:\s*"([^"\n]{3,70})"/g)) check(m[2], m[1]);
  for (const m of src.matchAll(/\b(title|submitLabel|confirmLabel|label|eyebrow)\s*:\s*([^,\n]*\?[^,\n]*)/g)) for (const n of m[2].matchAll(/"([^"\n]{3,60})"/g)) check(n[1], `${m[1]} koşullu`);
  for (const m of src.matchAll(/\[\s*"[a-z][\w-]*"\s*,\s*"([^"\n]{3,70})"/g)) check(m[1], "seçenek");
  // Sayı ya da koşul eklenen başlıklar: <summary>Son Aktarımlar (${n})</summary>, <button>Önümüzdeki 30 Gün (${n})</button>.
  for (const m of src.matchAll(new RegExp(`<(?:${TAGS})\\b[^<>]*>([A-ZÇĞİÖŞÜ↑][^<>\`{}$\\n]{2,60}?)\\s*\\(?\\$\\{`, "g"))) check(m[1], "sayılı etiket");
  // Düğme yazısı sonradan geri konurken ("Giriş Yap" → hata → "Giriş yap") yazım kaymasın.
  for (const m of src.matchAll(/\.textContent\s*=\s*"([^"\n]{3,60})"/g)) check(m[1], "textContent");
  // 2.1.0 (ikinci küçük düzeltmeler m3, 10.10.2026): başlık değişkenden geldiğinde (title = TITLES[kind]; kaynak adı SOURCE_LABELS[id]) düz metin
  // denetimi yakalamıyordu ("Cari ekstre", "Vade takip", "Nakit akış" PDF/Excel başlığı; "Ödeme sözü", "Son tarih" süzgeç ve kaynak adı). Adı
  // TITLES / LABELS / TEXT / NAMES ile biten sabit nesnelerin metin değerleri de ad sayılıp denetlenir (cümleler eligible'da elenir).
  for (const m of src.matchAll(/\bconst\s+((?:[A-Z][A-Z0-9_]*_)?(?:TITLES|LABELS|TEXT|NAMES))\s*=\s*(?:Object\.freeze\(\s*)?\{([^{}]{0,4000})\}/g)) for (const n of m[2].matchAll(/(?:^|[,{\s])(?:"[^"\n]*"|[\w$]+)\s*:\s*"([^"\n]{3,70})"/g)) check(n[1], `${m[1]} değeri`);
  if (server) for (const m of src.matchAll(/\b(headers|columns|head)\s*[:=]\s*\[([^\]\n]{0,1200})\]/g)) for (const n of m[2].matchAll(/"([^"\n]{3,60})"/g)) check(n[1], m[1]);
  if (server) {
    // 2.1.0 (küçük düzeltmeler, 10.10.2026): Nakit Akış Excel'inin "Aylık toplamlar" sayfa adı yakalanmıyordu — denetim yalnız title/label
    // anahtarlarının düz metnine ve kolon dizilerine bakıyordu; Excel SAYFA ADI (buildXlsx'in { name, columns } nesnesi) ve ŞABLON METİNLE
    // kurulan başlık (title: `${title} listesi`) hiç okunmuyordu. Şablonun değişken kısmı "Ad" yerine konup denetlenir ("Ad toplamlar" kırılır).
    const literal = text => text.replace(/\$\{[^}]*\}/g, "Ad");
    for (const m of src.matchAll(/\{\s*name:\s*(?:"([^"\n]{3,40})"|`([^`\n]{3,60})`)(?:\.slice\([^)]*\))?\s*,\s*columns\b/g)) check(m[1] ?? literal(m[2]), "Excel sayfa adı");
    for (const m of src.matchAll(/\btitle\s*:\s*`([^`\n]{3,70})`/g)) check(literal(m[1]), "şablon başlık");
  }
  return found;
}

describe("yazım düzeni: başlıklarda her sözcüğün ilk harfi büyük", () => {
  it("arayüz dosyalarında kurala uymayan ad yok", () => {
    const files = [...readdirSync(new URL("client/assets/", ROOT)).filter(name => /^hof-.*\.js$|^admin\.js$/.test(name)).map(name => `client/assets/${name}`), "client/admin.html"];
    const found = files.flatMap(file => violations(file));
    assert.deepEqual(found, [], `Yeni etiketler başlık yazımıyla yazılmalı:\n${found.join("\n")}`);
  });
  it("rapor, PDF ve Excel başlıklarında kurala uymayan ad yok", () => {
    const files = readdirSync(new URL("server/routes/", ROOT)).map(name => `server/routes/${name}`);
    const found = files.flatMap(file => violations(file, { server: true }));
    assert.deepEqual(found, [], `Rapor ve dışa aktarım başlıkları başlık yazımıyla yazılmalı:\n${found.join("\n")}`);
  });
});
