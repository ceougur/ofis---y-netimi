// Çek / Senet (v2.0.7) — saf kural motoru. Veritabanına dokunmaz; yol (routes/cheques.mjs), rapor motoru ve testler
// doğrudan kullanır.
//
// Yön
//   in  = alınan: müşteriden alınan çek/senet. Portföye girer; alındığı carinin borcu düşer (alacak yazılır) ya da
//         seçilen taksit kartına tahsilat olarak sayılır. Para Kasa'ya ancak tahsil edilince girer.
//   out = verilen: tedarikçiye verilen kendi çekimiz/senedimiz. Tedarikçiye borcumuz düşer (borç yazılır); para
//         Kasa'dan vadesinde ödenince çıkar. Ödenene kadar "ödenecek" yükümlülüktür.
//
// Durum geçişleri (her geçiş bir olaydır; son olay "Geri al" ile birebir geri çevrilir)
//   alınan : portfolio ─ collect ─▶ collected          (Kasa'ya giriş)
//            portfolio ─ endorse ─▶ endorsed           (ciro edilen carinin — tedarikçi — alacağı düşer)
//            portfolio | endorsed ─ bounce ─▶ bounced  (karşılıksız/iade: müşteri yeniden borçlanır, ciro geri alınır)
//   verilen: pending ─ pay ─▶ paid                     (Kasa'dan çıkış)
//
// Toplamlar (ANLIK DURUM)
//   Alacak tarafına portföydeki alınan çek/senet eklenir (carinin borcu çek alınınca düştüğü için para "kaybolmaz").
//   Borç tarafına ödenmemiş verilen çek/senet eklenir (tedarikçi borcu çek verilince düştüğü için yükümlülük kaybolmaz).
import { roundMoney } from "./money.mjs";
import { daysUntil } from "./plans.mjs";

export const DIRECTIONS = Object.freeze({ in: "Alınan", out: "Verilen" });
export const INSTRUMENTS = Object.freeze({ cheque: "Çek", note: "Senet" });
export const STATUSES = Object.freeze({
  portfolio: { label: "Portföyde", direction: "in", open: true },
  endorsed: { label: "Ciro edildi", direction: "in", open: false },
  collected: { label: "Tahsil edildi", direction: "in", open: false },
  bounced: { label: "Karşılıksız / iade", direction: "in", open: false },
  pending: { label: "Ödenecek", direction: "out", open: true },
  paid: { label: "Ödendi", direction: "out", open: false },
});
export const ACTIONS = Object.freeze({
  collect: { from: ["portfolio"], to: "collected", label: "Tahsil edildi", past: "tahsil edildi", cash: "in" },
  endorse: { from: ["portfolio"], to: "endorsed", label: "Ciro et", past: "ciro edildi", cash: "" },
  bounce: { from: ["portfolio", "endorsed"], to: "bounced", label: "Karşılıksız / iade", past: "karşılıksız/iade işaretlendi", cash: "" },
  pay: { from: ["pending"], to: "paid", label: "Ödendi", past: "ödendi", cash: "out" },
});
export const EVENT_LABELS = Object.freeze({
  receive: "Alındı",
  issue: "Verildi",
  collect: "Tahsil edildi",
  endorse: "Ciro edildi",
  bounce: "Karşılıksız / iade",
  pay: "Ödendi",
});
export const initialStatus = direction => (direction === "out" ? "pending" : "portfolio");
export const initialEvent = direction => (direction === "out" ? "issue" : "receive");

/** Geçiş kuralı: izin yoksa okunur bir neden döner. */
export function transition(cheque, action) {
  const rule = ACTIONS[action];
  if (!rule) return { ok: false, reason: "İşlem tanınmadı." };
  const status = STATUSES[cheque.status];
  if (!status) return { ok: false, reason: "Çekin durumu tanınmadı." };
  if (status.direction !== (cheque.direction === "out" ? "out" : "in")) return { ok: false, reason: "Çekin yönü ile durumu uyuşmuyor." };
  if (!rule.from.includes(cheque.status)) {
    const what = INSTRUMENTS[cheque.instrument] || "Çek";
    return { ok: false, reason: `${what} “${status.label}” durumunda; “${rule.label}” yapılamaz.` };
  }
  return { ok: true, to: rule.to, cash: rule.cash };
}

/**
 * Bir olayın defter etkileri (yazılacak satırlar). Yol bu listeyi aynı işlem bloğunda uygular.
 * @param {{ direction, amount, accountId, planId, itemId?, endorseAccountId? }} cheque
 * @param {"receive"|"issue"|"collect"|"endorse"|"pay"|"bounce"} kind
 * @param {{ date, note, endorseAccountId?, receiveEffects? }} context  receiveEffects: alış olayının uygulanmış etkileri
 */
export function plannedEffects(cheque, kind, { date, note = "", endorseAccountId = "", receiveEffects = [], endorseEffects = [] } = {}) {
  const amount = roundMoney(Number(cheque.amount) || 0);
  if (kind === "receive") {
    if (cheque.planId) return [{ type: "plan-entry", planId: cheque.planId, itemId: cheque.itemId || null, kind: "in", amount, date, note }];
    if (cheque.accountId) return [{ type: "account-entry", accountId: cheque.accountId, kind: "credit", amount, date, note }];
    return [];
  }
  if (kind === "issue") return cheque.accountId ? [{ type: "account-entry", accountId: cheque.accountId, kind: "debt", amount, date, note }] : [];
  if (kind === "endorse") return endorseAccountId ? [{ type: "account-entry", accountId: endorseAccountId, kind: "debt", amount, date, note }] : [];
  if (kind === "bounce") {
    const out = [];
    // Müşteri yeniden borçlanır: taksite sayılan çekte o tahsilat kaldırılır (taksit yeniden açık/gecikmiş olur),
    // cariye alacak yazılan çekte cariye aynı tutarda borç yazılır.
    const planEntry = receiveEffects.find(effect => effect.op === "insert" && effect.table === "plan_entries");
    if (planEntry) out.push({ type: "remove-plan-entry", id: planEntry.id });
    else if (cheque.accountId) out.push({ type: "account-entry", accountId: cheque.accountId, kind: "debt", amount, date, note });
    // Ciro edilmişse: ciro edilen carinin (tedarikçi) alacağı geri gelir.
    const endorsed = endorseEffects.find(effect => effect.op === "insert" && effect.table === "account_entries");
    if (endorsed && cheque.endorseAccountId) out.push({ type: "account-entry", accountId: cheque.endorseAccountId, kind: "credit", amount, date, note });
    return out;
  }
  return []; // collect / pay: yalnız Kasa (olay satırından okunur)
}

/** Vade durumu (takvim günü; saat diliminden bağımsız). */
export function dueState(dueDate, today, soonDays = 7) {
  const days = daysUntil(dueDate, today);
  const state = days < 0 ? "overdue" : days === 0 ? "today" : days <= soonDays ? "soon" : "later";
  return { days, state };
}

/**
 * Portföy özeti: açık (portföydeki alınan, ödenecek verilen) çek/senet tutarları, vadesi geçen / bugün / 7 gün içinde.
 * @param {Array<{ direction, status, amount, dueDate }>} rows  silinmemiş kayıtlar
 */
export function portfolioSummary(rows, today) {
  const blank = () => ({ count: 0, amount: 0 });
  const out = {
    in: { open: blank(), overdue: blank(), today: blank(), soon: blank() },
    out: { open: blank(), overdue: blank(), today: blank(), soon: blank() },
    endorsed: blank(),
    collected: blank(),
    paid: blank(),
    bounced: blank(),
  };
  const add = (bucket, amount) => {
    bucket.count += 1;
    bucket.amount = roundMoney(bucket.amount + amount);
  };
  for (const row of rows) {
    const amount = roundMoney(Number(row.amount) || 0);
    if (row.status === "portfolio" || row.status === "pending") {
      const side = row.direction === "out" ? out.out : out.in;
      add(side.open, amount);
      const { state } = dueState(row.dueDate, today);
      if (state === "overdue") add(side.overdue, amount);
      else if (state === "today") add(side.today, amount);
      else if (state === "soon") add(side.soon, amount);
    } else if (out[row.status]) add(out[row.status], amount);
  }
  return out;
}

// ---------- Excel başlık eşleme (toplu alım) ----------
const ASCII = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
const plain = value =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ışğüöçâîû]/g, char => ASCII[char] || char)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const CHEQUE_ROLE_TESTS = [
  ["direction", t => /^(yon|yonu|alinan verilen|alinan veya verilen|islem|islem turu|hareket)$/.test(t)],
  ["instrument", t => /^(tur|turu|tip|tipi|evrak|evrak turu|cek senet|belge|belge turu)$/.test(t)],
  ["serial", t => /(cek no|senet no|seri no|seri|cek numarasi|senet numarasi|evrak no|belge no|numara|^no$)/.test(t) && !/(hesap|tel|iban)/.test(t)],
  ["bank", t => /(banka|sube|banka adi|banka sube)/.test(t)],
  ["amount", t => /(tutar|tutari|miktar|bedel|meblag|toplam)/.test(t)],
  ["due", t => /(vade|vadesi|vade tarihi|odeme tarihi|son odeme)/.test(t)],
  ["issue", t => /(alis tarihi|alinis|alinma|verilis|veris|duzenleme|kesilme|kayit tarihi|islem tarihi|^tarih$)/.test(t)],
  ["status", t => /^(durum|durumu|son durum|akibet)$/.test(t)],
  ["drawer", t => /(kesideci|borclu|lehtar|musteri|firma|cari|kimden|kime|unvan|ad soyad|adi soyadi|^ad$|^isim$)/.test(t)],
  ["note", t => /(aciklama|not|notlar|bilgi)/.test(t)],
];
export const CHEQUE_ROLES = Object.freeze(["direction", "instrument", "serial", "bank", "drawer", "amount", "due", "issue", "status", "note", "extra"]);
export function mapChequeHeaders(headers) {
  const roles = {};
  const taken = new Set();
  headers.forEach((header, index) => {
    const t = plain(header);
    if (!t) {
      roles[index] = "";
      return;
    }
    const hit = CHEQUE_ROLE_TESTS.find(([role, test]) => !taken.has(role) && test(t));
    if (hit) {
      roles[index] = hit[0];
      taken.add(hit[0]);
    } else roles[index] = "extra";
  });
  return roles;
}
// Hücre değerleri: "Alınan", "müşteri çeki" → in; "Verilen", "kendi çekimiz", "firma çeki" → out.
export function parseDirection(value, fallback = "in") {
  const t = plain(value);
  if (!t) return fallback;
  if (/(verilen|verdik|kendi|borc senedi|odenecek|out)/.test(t)) return "out";
  if (/(alinan|aldik|musteri|tahsil|portfoy|in)/.test(t)) return "in";
  return fallback;
}
export function parseInstrument(value, fallback = "cheque") {
  const t = plain(value);
  if (!t) return fallback;
  if (/senet|bono|police/.test(t)) return "note";
  if (/cek/.test(t)) return "cheque";
  return fallback;
}
// Excel'deki "Durum" kolonu: yalnız başlangıç durumu okunur (portföyde / ödenecek). Kapanmış (tahsil edildi, ödendi,
// ciro, karşılıksız) satırlar ayrıca işaretlenir; yükleyen kişi onları almayı ya da atlamayı seçer.
export function parseStatus(value) {
  const t = plain(value);
  if (!t) return "";
  if (/karsiliksiz|iade|protesto/.test(t)) return "bounced";
  if (/ciro/.test(t)) return "endorsed";
  if (/tahsil edil|tahsil olundu|tahsilat yapildi|bankadan tahsil|odendi|odenmis|kapandi|kapali/.test(t)) return "closed";
  if (/portfoy|bekliyor|acik|odenecek|vadesi gelmedi/.test(t)) return "open";
  return "";
}
