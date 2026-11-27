// Kılavuzdaki ekran adlarının (kalın/eğik yazılan düğme, sekme, alan, seçenek adları) ekranda BİREBİR göründüğünü denetler.
// Ekran metinleri ekran-banka.mjs'in EKRAN_METIN çıktısından gelir (gerçek ekrandan, Playwright ile okunan innerText + seçenekler).
// Kullanım: node docs/kilavuz/metin-denetle.mjs <metinler.json> [bölüm numaraları, virgülle; varsayılan bütün bölümler]
// ya da ekran-banka.mjs --denetim (npm run test:kilavuz-metin) içinden: denetle(texts) + yazdir(sonuç).
// Çıkış kodu: ekranda (ya da aşağıdaki kurala göre program kaynağında) bulunmayan ad varsa 1 (liste yazılır).
// 2.5.0 BS-5: BÜTÜN bölümler taranır. Ekranda (ekran-banka.mjs gezintisinin okuduğu metin) bulunmayan ad, 7. ve 8. bölüm DIŞINDA,
// programın arayüz kaynağında (client/ + server/, yorumlar ayıklanmış) birebir geçiyorsa "kaynakta" sayılır: o bölümlerin bütün ekranları
// (WhatsApp bağlantısı, e-Belge, telefon, kurulum…) gezintide açılamaz, ama yeniden adlandırılan düğmenin eski adı kaynakta da kalmaz.
// 7. ve 8. bölüm (Kasa, Banka) gezintide baştan sona açıldığı için ekran ZORUNLU kalır (2.4.9 B4 düzeni).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = value => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
export const EKRAN_ZORUNLU = new Set([7, 8]);
// Ekrandaki ad değil (kılavuzun kendi vurgusu, yol tarifi, örnek ya da başka bölüme ait genel ad): bunlar denetim dışında, listede ayrıca yazılır.
const NOT_LABEL = new Set([
  // Madde başı vurguları (kılavuzun kendi sözü; ekranda ad olarak geçmez).
  "Ödeme ve tahsilat yolu", "Kasa ile banka arasında para", "Kasa eksiye düşecekse", "İleri tarih yok", "Hesap ayrıntısı", "Yanlış girdiyseniz", "Kimler kullanır",
  "Hesap açılışından önceki havaleyi girmek ya da düzeltmek", "\"Aktarılmış eski hareket\" uyarısı",
  // v2.2.0 (İz 2): madde başı vurguları.
  "Kullanım işaretleri", "Bakiye", "Hesap yoksa",
  // v2.2.0 (İz 3): POS ile Tahsilat madde başları.
  "POS tanımlama", "POS ile tahsilat", "İptal ve iade",
  // 2.4.9 B4: madde başı vurguları (iki ekran adını birleştiren kılavuz sözü; parçaları — Vade Takip, PDF, Excel — ayrıca denetlenir).
  "Zil ve Vade Takip", "Hareketler sekmesinde PDF / Excel",
  // 2.5.0 BS-5: öbür bölümlerin madde başı vurguları ve cümle içi vurgular.
  "Sunucu bilgisayara", "Personel bilgisayarlarına", "yazdırın", "sürükleyin", "sarı", "Exceliniz yok mu?", "İşaretlenen hatalar", "Sol üstte Şirket",
  "alış f", "cari h", "Sol menü", "Kullanıcı kartı", "Üstte zil", "özet kartları", "Tahsilat Takvimi şeridi", "Sayfalar şeridi (ortada)", "sayfa",
  "Sağda detay kartı", "Açık pencereler kendiliğinden yenilenir", "Dolu formu kapatmak", "Onay pencerelerinde Enter vazgeçer", "Sütun ekle / sil",
  "Kayıt ve cari ayrıdır", "Acil görev", "zil", "Carileri toplu açın", "Tek cari", "Hareket girin", "Arama ve süzgeç", "Çıktı",
  "İade bedelini geri ödeme", "Aynı kişi iki kez açılmaz", "Cariyi iki kişi aynı anda düzenlerse", "Cariyi silmek", "Hareketler süzgeci",
  "Şüpheliye alın", "Tahsilatta seçim", "Nerede görünür", "Hazırlık", "Günlük sınır", "Yalnız bilgilendirme", "Grup › Alt Grup", "Tek kart",
  "Birden çok cariye birden", "Kartsız grup", "Veresiye satışı ya da mevcut borcu taksitlendirme", "Tahsilat alınmadı", "Tablodaki kişi",
  "Alış ve satış fiyatı", "Hizmet kalemi", "Yanlış işlem", "Vade takibi", "Banka tahsil edince", "bu müşteriye ve başkalarına son satış/alış fiyatı",
  "Sonradan tahsilat / ödeme", "Belgeyi verin", "e-Fatura / e-Arşiv denemesi", "e-SMM (serbest meslek makbuzu)", "e-Belge numara sırası ve Gönderilecekler",
  "numarasız", "Tarih ve numara sırası", "Canlıya geçiş", "e-Faturada ölçü birimi", "Toplu işler", "Kimler görür", "yöneticinin", "Toplam alacak",
  "Vadesi geçen alacak", "Kimden ne tahsil edildi", "çıkarırsınız", "Kurtarma anahtarı", "sunucu bilgisayarında", "Eksi bakiye denetimi",
  "Dönem kilidi", "Güncelleme", "Vekil sunucu (proxy)", "Sektör ve görünüm", "Elle Bağla ön koşulları", "Ücret ve sınır",
  "Yurt dışına aktarım (KVKK md. 9)", "Eşleme (yönetici)", "iPhone ve iPad", "Android telefon", "Neler görünür", "Kayıt girmek", "Bağlantı koparsa",
  "Ofisteki bilgisayar kapalıyken", "En çok 3 cihaz", "Telefon kaybolursa", "Lisans bitince", "hiç yazmaz", "Ciro (satış)", "Hızlı Arama (Ctrl+K)", "Vadesinde",
  // Örnek: şirket adı yerine "Unvan", kullanıcının tablosundaki kolon adı.
  "Unvan ▾", "Kalan Gün",
  // 2.5.0 BS-5 yeni maddeler.
  "Defter türünü seçmek",
]);
// Program dışı ekranlar (Windows, Meta Geliştirici Paneli, Excel, telefonun tarayıcısı) ve örnek değerler: aranmaz, listede ayrıca yazılır.
const DIS_EKRAN = new Set([
  // Windows kurulumu / SmartScreen ve kurulum dosyası adı.
  "DestekOfis-Kurulum.exe", "Ek bilgi", "Yine de çalıştır",
  // Meta Geliştirici Paneli ve Graph API (WhatsApp bağlantısı, 17. bölüm).
  "System Users", "Generate token", "Never", "messages", "POST <WABA ID>/subscribed_apps", "Configure Webhooks", "Callback URL", "Verify token",
  "Verify and save", "Webhook fields", "Subscribe", "Publish", "Privacy Policy URL",
  // EDM Bilişim'in e-Fatura portalı (13. bölüm).
  "SMMM Portalı Girişi",
  // Telefonun tarayıcısı (18. bölüm) ve Excel (19. bölüm).
  "Ana Ekrana Ekle", "Ana ekrana ekle", "\"Doldurma tutamacını ve hücre sürükleyip bırakmayı etkinleştir\"",
  // Örnek değerler (parola, vekil sunucu adresi, örnek rol / kart adı, e-posta adresi).
  "Ofis2026!", "vekil.firma.local:8080", "Kasiyer", "Servis Ücreti", "destek@destekofis.net",
]);
// Virgülle sıralanmış ad listesi (süzgeç seçenekleri): parçalara bölünür ("Kaydet, Sonra Gönder" gibi virgüllü düğme adı bölünmez).
const LISTE = new Set(["Devam Eden, Geciken, Biten, Kapalı, Tümü"]);
// Yer tutucu: "…", tek başına "N" ve örnek sayı ("40 / 120") ekranda / kaynakta değişkendir; adın sabit parçaları sırayla ve yakın aranır.
// Yer tutucuyu saran ayraç ve tırnak da değişkenin parçasıdır ("Yok Say (N)" → `Yok Say${n > 1 ? ` (${n})` : ""}`; "“…” İşlemini Geri Al").
const PLACEHOLDER = /…|\bN\b|\d+(?:\s*\/\s*\d+)?/;
const parts = term => term.split(/\s*[(“"]?\s*(?:…|\bN\b|\d+(?:\s*\/\s*\d+)?)\s*[)”"]?\s*/g).map(item => item.trim()).filter(item => item.length >= 2);
function found(haystack, term) {
  if (haystack.includes(term)) return true;
  if (!PLACEHOLDER.test(term)) return false;
  const list = parts(term);
  if (!list.length) return false;
  for (let from = haystack.indexOf(list[0]); from >= 0; from = haystack.indexOf(list[0], from + 1)) {
    let at = from + list[0].length;
    let ok = true;
    for (const part of list.slice(1)) {
      const next = haystack.indexOf(part, at);
      if (next < 0 || next - at > 160) { ok = false; break; }
      at = next + part.length;
    }
    if (ok) return true;
  }
  return false;
}
// Kesme işareti ekranda tipografik (’) ya da düz (') olabilir: ikisi aynı sayılır (Kasa’ya / Kasa'ya).
const decode = value => value.replace(/’/g, "'").replace(/\\u\{?([0-9a-fA-F]{4,5})\}?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"").replace(/&#39;|\\'/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\\"/g, "\"");
// Yorumlar ayıklanır (yorumdaki eski ad "kaynakta var" saydırmasın): /* … */, <!-- … --> ve // — yalnız satır başında ya da boşluk / ayraçtan
// sonra başlayanlar (dizgedeki accept="image/*" ve adreslerdeki "://" yorum sayılmaz; yoksa arkasındaki bütün kod silinirdi).
const stripComments = source => source.replace(/(^|[\s;{}(),])\/\*[\s\S]*?\*\//gm, "$1 ").replace(/<!--[\s\S]*?-->/g, " ").replace(/(^|[\s;{}(),])\/\/[^\n]*/gm, "$1");
/** Programın arayüz metni kaynağı: client/ (HTML + JS; satıcı kitaplıkları, yazı tipleri, kılavuz hariç) ve server/ (PDF / rapor / bildirim adları). */
export function kaynakMetni(root = path.resolve(HERE, "..", "..")) {
  const skip = /^(vendor|fonts|brand|icons|kilavuz|node_modules)$/;
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return skip.test(entry.name) ? [] : walk(full);
    return /\.(m?js|html)$/.test(entry.name) && !/^xlsx-|worker/.test(entry.name) ? [full] : [];
  });
  const read = file => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const code = [...walk(path.join(root, "client")), ...walk(path.join(root, "server"))].sort().map(file => decode(stripComments(read(file)))).join("\n");
  // Kurulum sihirbazının metni (1. bölüm: "Sunucu Bilgisayar" seçeneği); ";" ile başlayan satırlar Inno Setup yorumudur.
  const setup = read(path.join(root, "packaging", "windows", "setup.iss")).replace(/^\s*;[^\n]*/gm, "");
  // Etiketler ayıklanmış kopya da eklenir: "<span>+</span> Sayfa" ekranda "+ Sayfa" görünür.
  return `${code}\n${setup}\n${code.replace(/<[^<>]*>/g, "")}`.replace(/[ \t]+/g, " ");
}
// Ekranda büyük harfle görünen ad (pencere üst başlığı "PERSONEL ÖZETİ", "+ SAYFA"): kılavuzda her sözcüğün ilk harfi büyük yazılır; Türkçe büyük harfle de aranır.
const upper = term => term.toLocaleUpperCase("tr-TR");
// Parçalardan kurulan düğme adı: kılavuzdaki ad ekranda bu parçaların birleşimidir ("<belge türü> - PDF"); kaynakta her parça ayrı aranır.
const BILESIK = new Map([["Satış Faturası - PDF", ["Satış Faturası", "} - PDF`"]]]);
/** Kılavuzdaki bölüm numaraları (<h2>N. …). */
export const bolumler = html => [...html.matchAll(/<h2>(\d+)\. /g)].map(match => Number(match[1]));

/** Kılavuzun verilen bölümlerindeki <b>/<i> adlarını ekran metinleriyle (7. ve 8. bölüm dışında, ekranda yoksa program kaynağıyla) karşılaştırır.
 *  sections verilmezse bütün bölümler; html verilmezse depodaki kılavuz; kaynak verilmezse kaynakMetni(). */
export function denetle(texts, sections = null, html = readFileSync(path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.html"), "utf8"), { kaynak = null } = {}) {
  const screen = Object.values(texts).join("\n").replace(/’/g, "'").replace(/\s+/g, " ");
  const out = { checked: [], source: [], missing: [], skipped: [] };
  let source = kaynak;
  for (const n of sections || bolumler(html)) {
    const start = html.indexOf(`<h2>${n}. `);
    if (start < 0) throw new Error(`bölüm ${n} yok`);
    const end = html.indexOf("<h2>", start + 5);
    const part = html.slice(start, end < 0 ? undefined : end);
    for (const m of part.matchAll(/<(b|i)>(.*?)<\/\1>/g)) {
      const raw = decode(norm(m[2]));
      // "A → B → C" yolu ve "A · B · C" sırası parçalara bölünür; "A / B" düğme adıdır (ör. Havale / EFT), bölünmez.
      const terms = raw.split(/\s*(?:→|\s·\s)\s*/).map(item => item.replace(/[:.]$/, "").trim()).flatMap(item => LISTE.has(item) ? item.split(/,\s*/) : [item]);
      for (const term of terms) {
        if (/^\d/.test(term) || term.length < 2) continue;
        if (found(screen, term) || found(screen, upper(term))) out.checked.push(`${n}: ${term}`);
        else if (NOT_LABEL.has(term) || DIS_EKRAN.has(term)) out.skipped.push(`${n}: ${term}`);
        else if (EKRAN_ZORUNLU.has(n)) out.missing.push(`${n}: ${term}`);
        else if (found(source ??= kaynakMetni(), term) || found(source, upper(term)) || BILESIK.get(term)?.every(item => source.includes(item))) out.source.push(`${n}: ${term}`);
        else out.missing.push(`${n}: ${term}`);
      }
    }
  }
  const uniq = list => [...new Set(list)];
  return { checked: uniq(out.checked), source: uniq(out.source), missing: uniq(out.missing), skipped: uniq(out.skipped) };
}

/** Sonucu yazar; ozet: false iken node:test biçimli özet satırları yazılmaz (çağıran kendi toplamını yazar). */
export function yazdir(result, { ozet = true } = {}) {
  console.log(`ekranda bulunan: ${result.checked.length}`);
  for (const item of result.checked) console.log("  ✓", item);
  console.log(`ekranda yok, program kaynağında birebir var (7. ve 8. bölüm dışı): ${result.source.length}`);
  for (const item of result.source) console.log("  ~", item);
  console.log(`ekran adı değil (vurgu / yol / program dışı ekran / örnek): ${result.skipped.length}`);
  for (const item of result.skipped) console.log("  ·", item);
  console.log(`EKRANDA BULUNMAYAN: ${result.missing.length}`);
  for (const item of result.missing) console.log("  ✗", item);
  if (!ozet) return;
  console.log(`# tests ${result.checked.length + result.source.length + result.missing.length}`);
  console.log(`# pass ${result.checked.length + result.source.length}`);
  console.log(`# fail ${result.missing.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const texts = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const sections = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
  const result = denetle(texts, sections);
  yazdir(result);
  if (result.missing.length) process.exitCode = 1;
}
