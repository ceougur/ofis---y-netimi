// 2.5.0 Ç7a tur 2 — K-14 / K-15 (kural kitabı; KULLANICI KARARI S179 = A, 14.11.2026): "açılışta sayılmış" hesabı atanmamış para satırı.
// docs/erp/C7A-BANKA-TASARIM.md §13.2. TEK TANIM: Ana Defter'in türetmesi (general-ledger journal, rows().refs.cover), defter beklenenleri (money-lines groups),
// Hesabı Atanmamış kovasının ekran bakiyesi (money-lines unassigned / unassignedWays), Alt Hesap Mizanı (periodGroups) ve 519 ikinci yükleyicisi
// (ledger-opening openingCounterpart) bu dosyanın sınırlarını ve koşulunu kullanır — biri değişip öbürü değişmezse Mutabakat Testi sapma gösterir.
//
// Hesabı atanmamış (fin_ref / ref '') satır açılışta sayılmıştır ⟺
//   modül satırı, havale yolu (102.00)                 : tarih < bounds.bank
//   modül satırı, kart yolu (108.00), yön çıkış (kurumsal kartla ödeme — Kart Borcuna Aktar havuzu) : tarih < bounds.card
//   modül satırı, kart yolu, yön giriş (POS tahsilatı — Bankaya Geçmiş Say havuzu; POS'un açılış tarihi yok) : tarih < bounds.pos
//   Banka Fişi satırı: Devir Kapanışı ve ters kaydı HER ZAMAN (kapattığı küme açılıştadır); öbürleri tarih < bounds.pos
// Sınırlar: bank = max(Devir Kapanışı, silinmemiş TL Vadesiz / Ticari / Diğer hesapların EN GEÇ açılışı); card = max(Devir Kapanışı, silinmemiş TL kredi kartlarının
// EN GEÇ açılışı); pos = Devir Kapanışı. Hesabın durumu (etkin / pasif) sınırı değiştirmez: pasife almak geçmiş günlerin defterini değiştirmesin (BAŞ MİMAR KARARI GEREKİYOR
// — öneri bu). "<": açılış günü D'nin gün başındaki bakiyedir (plan §10.3); D günlü satır açılıştan sonradır (module-ref pickRef'in "none" kabulüyle aynı ölçü).
// Karşılığı defterde 519 "Eşleştirilecek Açılış Bakiyeleri" (olağan madde, hareketin tarihinde): "Para zaten banka açılış bakiyesinin içinde → çift sayım olmaz" (K-14).

/** Devir Kapanışı satırının işareti (money-lines bank_lines kaynağı ve routes/ledger rows bankLines): olayın kendisi ya da ters kaydının asıl türü carry_close. */
export const CARRY_TYPE = "carry_close";
const BANK_KINDS_SQL = "'demand', 'commercial', 'other'";

const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
const later = (a, b) => (a > b ? a : b);

/**
 * YALNIZ TEST (test/banka-210-hiz-esdegerlik.test.mjs): 2.1.0 hız düzeltmesinin eşdeğerlik kâhini (eski money-lines kopyası) bu ayrımı bilmez; karşılaştırma ayrımsız kipte
 * yapılır (ayrımın kendisi test/hesapsiz-acilis-250.test.mjs). Üretimde hiçbir yol değiştirmez.
 */
export const COVER_TEST = { off: false };

/** Açılış sınırları (tek SQL; tablo yoksa ''): { bank, card, pos, carry }. */
export function coverBounds(store) {
  if (COVER_TEST.off) return Object.freeze({ bank: "", card: "", pos: "", carry: "", off: true });
  const accounts = hasTable(store, "bank_accounts");
  const events = hasTable(store, "fin_events");
  if (!accounts && !events) return Object.freeze({ bank: "", card: "", pos: "", carry: "" });
  const row = store.get(
    // Devir Kapanışı günü accounts.carryBoundary ile AYNI küme (etkin carry_close'un en geç günü), ama hesabı atanmamış fiş satırlarının dizininden (idx_bank_lines_ref; ref '' —
    // yalnız Devir Kapanışı / eski bakiye aktarımı satırları): fin_events'te tür dizini yok, düz sorgu her çağrıda bütün işlem başlıklarını dolaşırdı (kapı her yazımda çağırır).
    `SELECT ${events && hasTable(store, "bank_lines") ? "(SELECT MAX(e.date) FROM bank_lines l CROSS JOIN fin_events e ON e.id = l.event_id WHERE l.ref = '' AND l.role = 'closing' AND e.type = 'carry_close' AND +e.status = 'active')" : "NULL"} AS carry,
            ${accounts ? `(SELECT MAX(opening_date) FROM bank_accounts WHERE deleted_at IS NULL AND currency = 'TRY' AND kind IN (${BANK_KINDS_SQL}))` : "NULL"} AS bank,
            ${accounts ? "(SELECT MAX(opening_date) FROM bank_accounts WHERE deleted_at IS NULL AND currency = 'TRY' AND kind = 'card')" : "NULL"} AS card`,
  ) || {};
  const carry = row.carry || "";
  return Object.freeze({ bank: later(carry, row.bank || ""), card: later(carry, row.card || ""), pos: carry, carry });
}

/**
 * JS koşulu (defter türetmesi). line: { way: 'bank' | 'card', kind: 'in' | 'out', date, bankLine: bool, carry: bool }. Hesabı atanmış satır için çağrılmaz.
 */
export function isCovered({ way, kind, date, bankLine = false, carry = false }, bounds) {
  if (!bounds || !date) return false;
  if (bankLine) return (Boolean(carry) && !bounds.off) || (Boolean(bounds.pos) && date < bounds.pos);
  if (way === "bank") return Boolean(bounds.bank) && date < bounds.bank;
  if (way === "card") {
    const limit = kind === "out" ? bounds.card : bounds.pos;
    return Boolean(limit) && date < limit;
  }
  return false;
}

/**
 * Aynı koşulun SQL'i (money-lines waySql çıktısı üzerinde; kolonlar w.ref, w.way, w.kind, w.date, w.src, w.carry). Parametreler coverParams(bounds).
 */
export const COVER_SQL = `(w.ref = '' AND (
    (w.src = 9 AND w.way IN ('bank', 'card') AND ((w.carry = 1 AND :cov_carry = 1) OR w.date < :cov_pos))
    OR (w.src <> 9 AND w.way = 'bank' AND w.date < :cov_bank)
    OR (w.src <> 9 AND w.way = 'card' AND w.kind = 'out' AND w.date < :cov_card)
    OR (w.src <> 9 AND w.way = 'card' AND w.kind <> 'out' AND w.date < :cov_pos)))`;
// '' sınır hiçbir tarihi kapsamaz (date < '' yanlış).
export const coverParams = bounds => ({ cov_bank: bounds?.bank || "", cov_card: bounds?.card || "", cov_pos: bounds?.pos || "", cov_carry: bounds?.off ? 0 : 1 });

/** Banka Fişi kaynağının işaret kolonu (money-lines select): Devir Kapanışı olayı ya da ters kaydı. */
export const CARRY_FLAG_SQL = `CASE WHEN fe.type = '${CARRY_TYPE}' OR (fe.type = 'reversal' AND EXISTS (SELECT 1 FROM fin_events o WHERE o.id = fe.reversal_of AND o.type = '${CARRY_TYPE}')) THEN 1 ELSE 0 END`;
