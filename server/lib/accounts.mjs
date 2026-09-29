// Cari ve Stok (v2.0.6) — saf hesap motoru ve Excel başlık eşleme. Veritabanına dokunmaz; yollar (routes/accounts.mjs,
// routes/stock.mjs) ve testler doğrudan kullanır.
//
// Cari defteri (ledger)
//   Borç tarafı  : borç yazma (debt), cariye yapılan ödeme (out), taksit planının toplamı, taksit iadesi; verilen ya da
//                  ciro edilen çek/senet ve karşılıksız çıkan alınan çek (v2.0.7, source = 'cheque').
//   Alacak tarafı: alacak yazma (credit), cariden tahsilat (in), taksit tahsilatı; kapatılan kartın ödenmeyen kısmı;
//                  alınan çek/senet (taksite sayılmadıysa).
//   Bakiye = Borç − Alacak. Artı: cari bize borçlu. Eksi: biz cariye borçluyuz. Satırlar tarih sırasıyla, yürüyen bakiyeyle.
//
// Stok
//   Mevcut = girişler − çıkışlar (hareketlerden hesaplanır; "kalan" saklanmaz, hareket silinince/düzeltilince doğru kalır).
//   Kritik: mevcut ≤ kritik seviye (kritik seviye > 0 ise). Değer = mevcut × son birim fiyat.
import { roundMoney } from "./money.mjs";

const EPS = 0.005;
export const roundQty = value => Math.round((Number(value) || 0) * 1000) / 1000;

export const ACCOUNT_TYPES = Object.freeze({ customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" });
export const ENTRY_KINDS = Object.freeze({
  debt: { label: "Borç", side: "debit", cash: "" },
  credit: { label: "Alacak", side: "credit", cash: "" },
  in: { label: "Tahsilat", side: "credit", cash: "in" },
  out: { label: "Ödeme", side: "debit", cash: "out" },
});

/**
 * Carinin defteri.
 * @param {Array<{ id, kind, amount, date, note, receiptNo?, source?, createdAt? }>} entries  cari hareketleri
 * @param {Array<{ id, name, refNo?, status, total, registeredOn?, createdAt?, totals: { paid }, entries: Array<{ id, kind, amount, date, note, receiptNo?, itemSeq?, createdAt? }> }>} plans
 */
export function accountLedger(entries = [], plans = []) {
  const lines = [];
  for (const entry of entries) {
    const meta = ENTRY_KINDS[entry.kind];
    if (!meta) continue;
    const amount = roundMoney(Number(entry.amount) || 0);
    const origin = entry.source === "stock" ? "stock" : entry.source === "cheque" ? "cheque" : "account";
    lines.push({
      id: entry.id,
      origin,
      kind: entry.kind,
      date: entry.date,
      at: entry.createdAt || "",
      // Çek/senetten gelen satır (v2.0.7): alınan/ciro/karşılıksız açıklamada yazar; etiket evrak olduğunu söyler.
      label: origin === "cheque" ? "Çek / senet" : meta.label,
      note: entry.note || "",
      receiptNo: entry.receiptNo || null,
      debit: meta.side === "debit" ? amount : 0,
      credit: meta.side === "credit" ? amount : 0,
    });
  }
  let planTotal = 0;
  let planRemaining = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const plan of plans) {
    const total = roundMoney(Number(plan.total) || 0);
    const opened = plan.registeredOn || String(plan.createdAt || "").slice(0, 10);
    lines.push({ id: `plan:${plan.id}`, origin: "plan", planId: plan.id, kind: "plan", date: opened, at: plan.createdAt || "", label: "Taksit planı", note: `${plan.name}${plan.itemCount ? ` · ${plan.itemCount} taksit` : ""}`, debit: total, credit: 0 });
    for (const entry of plan.entries || []) {
      const amount = roundMoney(Number(entry.amount) || 0);
      const incoming = entry.kind === "in";
      lines.push({
        id: `plan-entry:${entry.id}`,
        origin: "plan",
        planId: plan.id,
        kind: incoming ? "plan-in" : "plan-out",
        date: entry.date,
        at: entry.createdAt || "",
        label: incoming ? `Taksit tahsilatı${entry.itemSeq ? ` · ${entry.itemSeq}. taksit` : ""}` : "Taksit iadesi",
        note: entry.note || "",
        receiptNo: entry.receiptNo || null,
        debit: incoming ? 0 : amount,
        credit: incoming ? amount : 0,
      });
    }
    const paid = roundMoney(Number(plan.totals?.paid) || 0);
    if (plan.status === "closed") {
      // Kapatılan kartın ödenmeyen kısmı artık istenmez: defterde alacak olarak düşülür (iz kalır, bakiye doğru olur).
      const writeOff = roundMoney(total - paid);
      if (writeOff > EPS) lines.push({ id: `plan-close:${plan.id}`, origin: "plan", planId: plan.id, kind: "plan-close", date: String(plan.updatedAt || plan.createdAt || opened).slice(0, 10), at: plan.updatedAt || "", label: "Kart kapatıldı", note: `${plan.name} · kalan düşüldü`, debit: 0, credit: writeOff });
    } else {
      planTotal = roundMoney(planTotal + total);
      planRemaining = roundMoney(planRemaining + Math.max(0, total - paid));
      overdue = roundMoney(overdue + (Number(plan.totals?.overdue) || 0));
      overdueCount += Number(plan.totals?.overdueCount) || 0;
    }
  }
  lines.sort((a, b) => (a.date === b.date ? (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) : a.date < b.date ? -1 : 1));
  let balance = 0;
  let debit = 0;
  let credit = 0;
  let collected = 0;
  for (const line of lines) {
    debit = roundMoney(debit + line.debit);
    credit = roundMoney(credit + line.credit);
    balance = roundMoney(balance + line.debit - line.credit);
    line.balance = balance;
    if (line.kind === "in" || line.kind === "plan-in") collected = roundMoney(collected + line.credit);
  }
  return { lines, totals: { debit, credit, balance, collected, planTotal, planRemaining, overdue, overdueCount } };
}

// Bakiye metni: "₺1.200,00 borçlu" gibi okunur ifade için yön.
export const balanceSide = balance => (balance > EPS ? "debtor" : balance < -EPS ? "creditor" : "zero");

/**
 * Stok seviyesi.
 * @param {{ minQty: number, unitPrice: number }} item
 * @param {Array<{ kind: "in"|"out", qty: number }>} moves
 */
export function stockLevel(item, moves = []) {
  let qtyIn = 0;
  let qtyOut = 0;
  for (const move of moves) {
    const qty = Number(move.qty) || 0;
    if (move.kind === "in") qtyIn += qty;
    else qtyOut += qty;
  }
  const qty = roundQty(qtyIn - qtyOut);
  // Hizmet kalemi (v2.0.7): miktar izlenmez; kritik/tükendi sayılmaz, stok değeri yoktur.
  if (item.kind === "service") return { qtyIn: roundQty(qtyIn), qtyOut: roundQty(qtyOut), qty, value: 0, state: "service", low: false };
  const min = Number(item.minQty) || 0;
  const state = qty <= 0 ? (min > 0 || qtyIn > 0 ? "out" : "empty") : min > 0 && qty <= min ? "low" : "ok";
  return { qtyIn: roundQty(qtyIn), qtyOut: roundQty(qtyOut), qty, value: roundMoney(Math.max(0, qty) * (Number(item.unitPrice) || 0)), state, low: state === "low" || (state === "out" && min > 0) };
}

// Miktar hücresi: "12", "12,5", "1.250", "3 kg" → sayı; okunamazsa NaN.
export function parseQty(value) {
  if (typeof value === "number") return value;
  let text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return Number.NaN;
  text = text.replace(/[^\d.,-]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? number : Number.NaN;
}

// ---------- Excel başlık eşleme ----------
const ASCII = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
export const plainHeader = value =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/i̇/g, "i")
    .replace(/[ışğüöçâîû]/g, char => ASCII[char] || char)
    .replace(/[^a-z0-9#@]+/g, " ")
    .trim();

// Cari kartı: bilinen alanlar rolle eşlenir; kalan her dolu başlık "ek alan" olur ve kartta aynı adla görünür
// ("Excel'de ne varsa kişi kartı ona göre açılır").
const ACCOUNT_ROLE_TESTS = [
  ["seq", t => /^(#|s n|sn|s no|sira|sira no|no|nr|numara|cari no|cari kodu|cari kod|musteri no|musteri kodu|kod|kayit no|uye no|ogrenci no)$/.test(t)],
  ["phone", t => /(^| )(tel|telefon|telefonu|gsm|cep|cep tel|iletisim)( |$)/.test(t) && !/(2|ikinci|is tel|ev tel)/.test(t)],
  ["email", t => /(^| )(e ?posta|eposta|email|e mail|mail)( |$)/.test(t)],
  ["address", t => /(^| )(adres|adresi|ikamet|acik adres)( |$)/.test(t)],
  ["registered", t => (/(^| )(kayit|giris|kaydolma|uyelik|basvuru|sozlesme|acilis)( |$)/.test(t) && /tarih/.test(t)) || /^(kayit|kayit tarihi|giris tarihi)$/.test(t)],
  ["subgroup", t => /(^| )(alt|ara) ?(grup|grubu)( |$)|altgrup|(^| )(guzergah|guzergahi|blok|blogu|sube|subesi|sinif|sinifi|okul|okulu|daire)( |$)/.test(t)],
  // Grup: "Grup", "Kategori", "Plaka", "Site", "Bölge" gibi başlıklar; "Servis ücreti" gibi tutar başlıkları grup sayılmaz.
  ["group", t => (/(^| )(grup|grubu|kategori|kategorisi|bolge|bolgesi)( |$)/.test(t) || /^(plaka|plakasi|arac|arac plakasi|servis|servis plakasi|site|sitesi|site adi)$/.test(t)) && !/(ucret|tutar|bedel|fiyat|borc|bakiye)/.test(t)],
  ["balance", t => /(^| )(bakiye|acilis bakiyesi|devir|devreden|borc|borcu|kalan borc|alacak)( |$)/.test(t) && !/(taksit|tarih)/.test(t)],
  ["type", t => /^(tur|turu|tip|tipi|cari turu|cari tipi)$/.test(t)],
  ["note", t => /(^| )(not|notu|notlar|bilgi|bilgi notu|aciklama)( |$)/.test(t)],
  ["name", t => /(^| )adi? ?soyadi?( |$)|adisoyadi|(^| )(isim|ismi|ogrenci|ogrencinin adi|musteri|musteri adi|kisi|cari|cari adi|unvan|unvani|firma|firma adi|sakin|uye|hasta|danisan|abone|alici|kiraci|borclu|borclunun adi|muvekkil|ad)( |$)/.test(t) && !/(veli|anne|baba|avukat|vekil)/.test(t)],
];
export const ACCOUNT_ROLES = Object.freeze(["seq", "name", "phone", "email", "address", "registered", "group", "subgroup", "balance", "type", "note", "extra"]);

// Stok kartı.
const STOCK_ROLE_TESTS = [
  ["code", t => /^(#|kod|kodu|urun kodu|stok kodu|malzeme kodu|barkod|sku|sira|sira no|no)$/.test(t)],
  ["unit", t => /^(birim|birimi|olcu|olcu birimi|br)$/.test(t)],
  ["min", t => /(kritik|minimum|min|asgari|alt limit|uyari)/.test(t)],
  ["price", t => /(fiyat|fiyati|birim fiyat|alis|alis fiyati|maliyet|tutar)/.test(t) && !/toplam/.test(t)],
  ["qty", t => /(^| )(miktar|miktari|adet|adedi|stok|mevcut|kalan|sayi|sayisi|envanter)( |$)/.test(t) && !/(kod|kritik|min)/.test(t)],
  ["category", t => /(^| )(kategori|kategorisi|grup|grubu|cins|tur|turu|sinif|depo|raf)( |$)/.test(t)],
  ["note", t => /(^| )(not|notu|aciklama|bilgi)( |$)/.test(t)],
  ["name", t => /(^| )(urun|urun adi|urunun adi|malzeme|malzeme adi|stok adi|ad|adi|isim|cinsi|mal|mal adi|kalem)( |$)/.test(t)],
];
export const STOCK_ROLES = Object.freeze(["kind", "code", "name", "unit", "category", "qty", "price", "min", "note", "extra"]);

function mapWith(tests, headers) {
  const roles = {};
  const taken = new Set();
  headers.forEach((header, index) => {
    const key = plainHeader(header);
    if (!key) return;
    const role = tests.find(([name, test]) => !taken.has(name) && test(key))?.[0];
    if (role) {
      roles[index] = role;
      taken.add(role);
    } else roles[index] = "extra";
  });
  return roles;
}
export function mapAccountHeaders(headers) {
  const roles = mapWith(ACCOUNT_ROLE_TESTS, headers);
  // Ad kolonu bulunamadıysa kişi adı taşıyan ilk kolon (Veli, Yetkili…) ad sayılır; kullanıcı eşlemede değiştirebilir.
  if (!Object.values(roles).includes("name")) {
    const index = headers.findIndex(header => /(^| )(veli|veli adi|yetkili|sorumlu|sahibi|ilgili kisi)( |$)/.test(plainHeader(header)));
    if (index >= 0) roles[index] = "name";
  }
  // Yalnız alt grup kolonu bulunduysa (ör. tek "Okul" kolonu) o kolon grup sayılır.
  const values = Object.values(roles);
  if (values.includes("subgroup") && !values.includes("group")) roles[Object.keys(roles).find(key => roles[key] === "subgroup")] = "group";
  return roles;
}
export const mapStockHeaders = headers => mapWith(STOCK_ROLE_TESTS, headers);

// Cari türü hücresi: "Tedarikçi", "satıcı", "firma (tedarik)" → supplier; "müşteri", "alıcı" → customer.
export function parseAccountType(value) {
  const t = plainHeader(value);
  if (!t) return "";
  if (/(tedarik|satici|toptanci|uretici|bayi)/.test(t)) return "supplier";
  if (/(musteri|alici|ogrenci|veli|uye|hasta|kiraci|sakin)/.test(t)) return "customer";
  if (/(diger|personel|ortak)/.test(t)) return "other";
  return "";
}
