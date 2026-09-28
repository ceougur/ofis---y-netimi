// Taksit modülü (v2.0.4) — saf hesap motoru. Veritabanına dokunmaz; yol (routes/plans.mjs) ve testler doğrudan kullanır.
//
// Kavramlar
//   plan     : taksit kartı ({ total, status }) — bir kişi/kurumun toplam borcu.
//   items    : taksitler ({ id, seq, dueDate, amount }) — vade ve tutar. Ödenen tutar saklanmaz, hareketlerden hesaplanır.
//   entries  : hareketler ({ id, itemId|null, kind: "in"|"out", amount, date }) — tahsilat (in) ve ödeme/iade (out).
//
// Eşleme kuralı (allocate)
//   1) Taksite bağlı tahsilat (itemId dolu) önce o taksite sayılır; taksitten artan havuza döner.
//   2) Havuz = serbest tahsilatlar + artanlar − ödemeler(iade). Havuz en eski vadeden başlayarak açık taksitlere dağıtılır.
//   3) Havuz eksiye düşerse (iade tahsilattan çok) en yeni taksitten geriye doğru "ödenen" azaltılır.
//   Böylece bir tahsilat silinince ya da düzeltilince defter kendiliğinden doğru kalır; hiçbir yerde "ödendi" bayrağı yok.
//
// Durumlar: paid (kapandı), partial (kısmen), overdue (vadesi geçti), today, upcoming (7 gün içinde), open (ileride).
import { roundMoney } from "./money.mjs";

const DAY = 86_400_000;
const EPS = 0.005;
const pad = value => String(value).padStart(2, "0");
export const isoDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const monthText = iso => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");

// Günler farkı: vade − bugün (yerel gün; saat yok).
export function daysUntil(iso, today) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const [ty, tm, td] = String(today).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY);
}

// Aynı gün, n ay sonra; ayın o günü yoksa ayın son günü (31 Ocak → 28/29 Şubat, sonra 31 Mart).
export function addMonths(iso, months) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(day)}`;
}

/**
 * Toplamı eşit taksitlere böler: her ay aynı gün, kuruş farkı son taksitte.
 * @param {{ total: number, count: number, firstDue: string, everyMonths?: number }} input
 * @returns {Array<{ seq: number, dueDate: string, amount: number }>}
 */
export function distribute({ total, count, firstDue, everyMonths = 1 }) {
  const sum = roundMoney(Number(total) || 0);
  const n = Math.max(1, Math.min(360, Math.trunc(Number(count) || 1)));
  const step = Math.max(1, Math.min(12, Math.trunc(Number(everyMonths) || 1)));
  const base = Math.floor((sum / n) * 100) / 100;
  const items = [];
  let allocated = 0;
  for (let index = 0; index < n; index += 1) {
    const last = index === n - 1;
    const amount = last ? roundMoney(sum - allocated) : base;
    allocated = roundMoney(allocated + amount);
    items.push({ seq: index + 1, dueDate: addMonths(firstDue, index * step), amount });
  }
  return items;
}

/**
 * Hareketleri taksitlere eşler ve kartın özetini çıkarır.
 * @param {{ total: number, status?: string }} plan
 * @param {Array<{ id: string, seq: number, dueDate: string, amount: number }>} items
 * @param {Array<{ id: string, itemId?: string|null, kind: "in"|"out", amount: number, date: string }>} entries
 * @param {{ today?: string, soonDays?: number }} options
 */
export function allocate(plan, items, entries, { today = isoDay(new Date()), soonDays = 7 } = {}) {
  const ordered = [...items].sort((a, b) => (a.dueDate === b.dueDate ? a.seq - b.seq : a.dueDate < b.dueDate ? -1 : 1));
  const paidByItem = new Map(ordered.map(item => [item.id, 0]));
  let pool = 0;
  let paidIn = 0;
  let paidOut = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    if (entry.kind === "out") {
      paidOut += amount;
      pool -= amount;
      continue;
    }
    paidIn += amount;
    const target = entry.itemId && paidByItem.has(entry.itemId) ? ordered.find(item => item.id === entry.itemId) : null;
    if (!target) {
      pool += amount;
      continue;
    }
    const room = Math.max(0, target.amount - paidByItem.get(target.id));
    const used = Math.min(room, amount);
    paidByItem.set(target.id, paidByItem.get(target.id) + used);
    pool += amount - used;
  }
  if (pool > 0) {
    for (const item of ordered) {
      if (pool <= EPS) break;
      const room = Math.max(0, item.amount - paidByItem.get(item.id));
      const used = Math.min(room, pool);
      paidByItem.set(item.id, paidByItem.get(item.id) + used);
      pool -= used;
    }
  } else if (pool < 0) {
    let debt = -pool;
    for (const item of [...ordered].reverse()) {
      if (debt <= EPS) break;
      const paid = paidByItem.get(item.id);
      const take = Math.min(paid, debt);
      paidByItem.set(item.id, paid - take);
      debt -= take;
    }
    pool = -debt;
  }
  const extra = Math.max(0, roundMoney(pool)); // taksitlerin üstünde kalan fazla tahsilat
  const closed = plan.status === "closed";
  const shaped = ordered.map(item => {
    const paid = roundMoney(paidByItem.get(item.id));
    const remaining = roundMoney(Math.max(0, item.amount - paid));
    const days = daysUntil(item.dueDate, today);
    let state = "open";
    if (remaining <= EPS) state = "paid";
    else if (closed) state = "closed";
    else if (days < 0) state = "overdue";
    else if (days === 0) state = "today";
    else if (days <= soonDays) state = "upcoming";
    return { ...item, paid, remaining, partial: paid > EPS && remaining > EPS, days, state };
  });
  const planned = roundMoney(shaped.reduce((sum, item) => sum + item.amount, 0));
  const net = roundMoney(paidIn - paidOut);
  const total = roundMoney(Number(plan.total) || 0);
  const remaining = roundMoney(Math.max(0, total - net));
  const overdue = shaped.filter(item => item.state === "overdue");
  const overdueAmount = roundMoney(overdue.reduce((sum, item) => sum + item.remaining, 0));
  const next = shaped.find(item => item.remaining > EPS && item.state !== "closed") || null;
  const unplanned = roundMoney(total - planned); // taksitlere bölünmemiş tutar (elle taksit girerken)
  let state = "active";
  if (closed) state = "closed";
  else if (total > EPS && remaining <= EPS && shaped.every(item => item.state === "paid")) state = "done";
  else if (overdue.length) state = "overdue";
  return {
    items: shaped,
    totals: { total, planned, unplanned, paidIn: roundMoney(paidIn), paidOut: roundMoney(paidOut), paid: net, remaining, extra, overdue: overdueAmount, overdueCount: overdue.length },
    next: next ? { id: next.id, seq: next.seq, dueDate: next.dueDate, remaining: next.remaining, days: next.days, state: next.state } : null,
    state,
  };
}

// Excel'den ilk yükleme: başlık satırındaki kolonları rollerle eşler (Türkçe, esnek yazım).
const fold = value => String(value ?? "").normalize("NFC").toLocaleLowerCase("tr-TR").replace(/[̇]/g, "").replace(/\s+/g, " ").trim();
// Başlıklar önce sadeleştirilir: küçük harf, Türkçe harfler ASCII'ye, parantez ve noktalama boşluğa
// ("GRUBU (Plaka)" → "grubu plaka", "S.N" → "s n", "TOPLAM TAKSİT TUTARI" → "toplam taksit tutari").
const ASCII = { ı: "i", i̇: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
const plain = value =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/i̇/g, "i")
    .replace(/[ışğüöçâîû]/g, char => ASCII[char] || char)
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
// Her rol için başlığın o rolü taşıyıp taşımadığını söyleyen kural; sıra önceliktir (ör. "ara grubu" önce alt gruba,
// "tek taksit ücreti" önce taksit tutarına bakar). Bir başlık birden çok role uyarsa ilk boş rolü alır.
const ROLE_TESTS = [
  ["seq", t => /^(#|s n|sn|s no|sira|sira no|sira nu|sira numarasi|no|nr|numara|kayit no|ogrenci no|musteri no|uye no|dosya no)$/.test(t) || (/(^| )(no|nr|numara|numarasi)$/.test(t) && !/(tel|tc|kimlik|iban|hesap|vergi|plaka|kapi)/.test(t))],
  ["phone", t => /(^| )(tel|telefon|telefonu|telefonlari|gsm|cep|iletisim)( |$)/.test(t)],
  ["subgroup", t => /(^| )(alt|ara) ?(grup|grubu|gruplar)( |$)|altgrup|(^| )(guzergah|guzergahi|blok|blogu|sube|subesi|hat|hatti|sinif|sinifi|okul|okulu|daire)( |$)/.test(t)],
  ["group", t => /(^| )(grup|grubu|gruplar|plaka|plakasi|arac|araci|servis|site|sitesi|kurum|kurumu)( |$)/.test(t)],
  ["installment", t => (/taksit/.test(t) && /(tutar|ucret|bedel|miktar)/.test(t) && !/(toplam|genel)/.test(t)) || /(^| )aylik( |$)/.test(t)],
  ["count", t => (/taksit/.test(t) && /(adet|adedi|sayi|sayisi)/.test(t)) || /^(taksit|adet|ay sayisi|taksit say)$/.test(t)],
  ["total", t => (/(toplam|genel)/.test(t) && /(tutar|ucret|bedel|borc|fiyat)/.test(t)) || /^(toplam|tutar|ucret|borc|bedel|fiyat|yillik ucret|sozlesme tutari|anlasma tutari)$/.test(t)],
  ["firstDue", t => /(vade|baslangic|ilk taksit|ilk odeme|tarih)/.test(t)],
  ["note", t => /(^| )(not|notu|notlar|bilgi|aciklama|adres|adresi)( |$)/.test(t)],
  ["name", t => /(^| )adi? ?soyadi?( |$)|adisoyadi|(^| )(isim|ismi|ogrenci|ogrencinin adi|musteri|kisi|veli|veli adi|sakin|cari|unvan|ad)( |$)/.test(t)],
];
export function mapHeaders(headers) {
  const roles = {};
  const taken = new Set();
  headers.forEach((header, index) => {
    const key = plain(header);
    if (!key) return;
    const role = ROLE_TESTS.find(([name, test]) => !taken.has(name) && test(key))?.[0];
    if (!role) return;
    roles[index] = role;
    taken.add(role);
  });
  // Yalnız alt grup kolonu bulunduysa (ör. tek "Okul" kolonu) o kolon grup sayılır; alt grup gruba bağlıdır.
  if (taken.has("subgroup") && !taken.has("group")) {
    const index = Object.keys(roles).find(key => roles[key] === "subgroup");
    roles[index] = "group";
  }
  return roles;
}

// Tarih hücresi: "15.09.2026", "2026-09-15", "15/9/2026", Excel seri numarası (45000) → ISO; yoksa "".
export function parseDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDay(value);
  const text = String(value ?? "").trim();
  if (!text) return "";
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text);
  if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  match = /^(\d{1,2})[./-](\d{4})$/.exec(text); // "09.2026" → ayın 1'i
  if (match) return `${match[2]}-${pad(match[1])}-01`;
  const month = MONTHS.findIndex(name => fold(text).startsWith(fold(name)));
  if (month >= 0) {
    const year = /\d{4}/.exec(text)?.[0] || String(new Date().getFullYear());
    return `${year}-${pad(month + 1)}-01`;
  }
  const serial = Number(text.replace(",", "."));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) return isoDay(new Date(Date.UTC(1899, 11, 30) + serial * DAY + 12 * 3_600_000));
  return "";
}
