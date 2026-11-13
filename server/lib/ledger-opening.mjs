// 2.5.0 Ç5-A tur 1 — açılış düzeni (docs/erp/C5-ACILIS-TASARIM.md §2.4, §2.8, §3.5, §11): KG-16 "Açılış Olabilir" listesi, "Açılış Karşılığı" ikinci yükleyicisi (519 / 500,
// modüllerin kendi tablolarından; journal()'dan bağımsız SQL) ve kilitsiz geçmiş yıl bilgisi (S53). Açılış Eşleştirme Fişi ve Kural Farkı Düzeltme Fişi TUR 2'de bu dosyaya eklenir
// (eşleştirme denetimi aynı `openingCounterpart` toplamını okur).
import { LEDGER_RULE_ALIASES, localDayOf } from "./general-ledger.mjs";
import { leanAll } from "./lean-rows.mjs";
import { roundMoney } from "./money.mjs";
import { isOpeningCandidateNote } from "./migrations.mjs";

export { isOpeningCandidateNote };
/** KG-16 durumları (account_entries.opening_review, göç 48): '' = listede değil; candidate = onay bekliyor (S47: defterde 519); confirmed = açılış (M-02 / M-03); rejected = sıradan Borç / Alacak Yaz. */
export const OPENING_REVIEW = Object.freeze({ none: "", candidate: "candidate", confirmed: "confirmed", rejected: "rejected" });
const DECIDED = new Set([OPENING_REVIEW.candidate, OPENING_REVIEW.confirmed, OPENING_REVIEW.rejected]);
const has = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
const hasColumn = (store, table, column) => store.all(`PRAGMA table_info(${table})`).some(item => item.name === column);
const cents = value => Math.round((Number(value) || 0) * 100);

/**
 * Silinenler'den geri alınan cari satırının KG-16 durumu (BAŞ MİMAR B8; KULLANICI S51 = A) — routes/accounts.mjs geri alma INSERT'inin `opening_review` (ve kapının kopyası
 * `opening_review_gate`) değeri (Ç5-A tur 1e'de bağlandı; silme yükü `openingReview`'i taşır). payload: silinmeden önceki satır (2.4.x yükünde openingReview yok);
 * restoredIsOpening: geri alınan satıra yazılan is_opening (carinin başka açılışı varsa 0 — 2.4.6 kuralı).
 *   - açılış işaretiyle dönüyor → '' (Açılış Bakiyesi satırı; listeye girmez);
 *   - açılış işaretli silinmiş (yükte isOpening; 2.4.5 yükünde açıklama "Açılış bakiyesi"), carinin başka açılışı yüzünden işaretsiz dönüyor → candidate (S51 = A — 2.5.0'da
 *     silinmiş yükte de: S51 yükteki duruma ÖNCELİKLİDİR);
 *   - yükte durum varsa (2.5.0'da silinmiş) silinmeden önceki durum AYNEN (onaylı onaylı, reddedilen reddedilen, aday aday döner; '' — göçten sonra elle girilmiş "Açılış…" — ''
 *     kalır: K8-1);
 *   - 2.4.x yükü, işaretsiz, açıklaması KG-16 kuralına uyuyor → candidate (B8: göçte aday olacaktı);
 *   - öbürleri ''.
 */
export function restoredOpeningReview(payload, restoredIsOpening) {
  if (Number(restoredIsOpening) === 1) return OPENING_REVIEW.none;
  if (!["debt", "credit"].includes(String(payload?.kind || "")) || String(payload?.source || "")) return OPENING_REVIEW.none;
  if (payload?.isOpening === true || Number(payload?.isOpening) === 1) return OPENING_REVIEW.candidate;
  if (payload && Object.hasOwn(payload, "openingReview")) return DECIDED.has(String(payload.openingReview)) ? String(payload.openingReview) : OPENING_REVIEW.none;
  return isOpeningCandidateNote(payload?.note) ? OPENING_REVIEW.candidate : OPENING_REVIEW.none;
}

/**
 * "Açılış Karşılığı" ikinci yükleyicisi (§2.8; BAŞ MİMAR B2 — `expected()`'e GİRMEZ, K6 değişmez): 519 = −(Σ modül açılışları) + Σ fiş satırlarının 519'u; 500 = Σ fiş satırlarının
 * 500'ü. Kuruş, borç artı. Modül açılışları kendi tablolarından (journal() okunmaz):
 *   Kasa açılışı (is_opening, giriş; transfer değil) · cari açılışı (is_opening ya da opening_review candidate / confirmed; silinmemiş cari) · yüklenen taksit kartı (KG-5: T − P,
 *   Mevcut Borcu Taksitlendir değil) ve öbür kartların açılış satırları (B 519) · stok açılışı (miktar × birim fiyat, tamsayı) · banka açılış / Devir Kapanışı satırları (saklı
 *   500, rol opening / closing) · cariye işlenmemiş açılış evrakı (alınan −, verilen +, carisiz karşılıksız +) · saklanan fişler (ledger_voucher_lines).
 */
export function openingCounterpart(store) {
  const parts = { cash: 0, accounts: 0, plans: 0, stock: 0, bank: 0, cheques: 0, vouchers519: 0, vouchers500: 0 };
  const sum = (sql, ...args) => Number(store.get(sql, ...args)?.n) || 0;
  if (has(store, "cash_entries") && hasColumn(store, "cash_entries", "is_opening")) {
    parts.cash = -sum("SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS n FROM cash_entries WHERE is_opening = 1 AND kind = 'in' AND COALESCE(transfer_id, '') = ''");
  }
  if (has(store, "account_entries") && has(store, "accounts") && hasColumn(store, "account_entries", "is_opening")) {
    const review = hasColumn(store, "account_entries", "opening_review") ? " OR e.opening_review IN ('candidate', 'confirmed')" : "";
    // Ç5-A tur 1c (hız; C5-ACILIS-TASARIM §13 H4): CROSS JOIN yalnız birleşim SIRASINI belirler (sonuç aynı iç birleşim) — satırlar önce koşulla süzülür, cari yalnız eşleşen
    // satır için aranır. Planlayıcı aksi hâlde silinmemiş her cari için bütün satırlarını dolaşıyordu (100.000 satırda ~40 ms → ~20 ms).
    parts.accounts = sum(
      `SELECT COALESCE(SUM(CASE e.kind WHEN 'debt' THEN -CAST(ROUND(e.amount * 100) AS INTEGER) ELSE CAST(ROUND(e.amount * 100) AS INTEGER) END), 0) AS n
       FROM account_entries e CROSS JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
       WHERE e.kind IN ('debt', 'credit') AND e.source NOT IN ('cheque', 'invoice', 'doubtful', 'stock') AND (e.is_opening = 1${review})`,
    );
  }
  if (has(store, "plans") && has(store, "plan_entries") && hasColumn(store, "plans", "import_id")) {
    for (const row of store.all(
      `SELECT p.total, COALESCE((SELECT SUM(e.amount) FROM plan_entries e WHERE e.plan_id = p.id AND e.kind = 'in' AND e.opening = 1), 0) AS paid
       FROM plans p WHERE p.deleted_at IS NULL AND p.import_id <> '' AND NOT p.covers_balance`,
    )) parts.plans -= cents(roundMoney((Number(row.total) || 0) - (Number(row.paid) || 0)));
    parts.plans += sum(
      `SELECT COALESCE(SUM(CAST(ROUND(e.amount * 100) AS INTEGER)), 0) AS n FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL
       WHERE e.kind = 'in' AND e.opening = 1 AND NOT (p.import_id <> '' AND NOT p.covers_balance)`,
    );
  }
  if (has(store, "stock_moves") && hasColumn(store, "stock_moves", "is_opening")) {
    for (const row of store.all("SELECT qty, unit_price AS price FROM stock_moves WHERE is_opening = 1 AND kind = 'in' AND pay = 'none'")) {
      const units = BigInt(Math.round((Number(row.qty) || 0) * 1000)) * BigInt(Math.round((Number(row.price) || 0) * 10000));
      parts.stock -= Number((units + 50_000n) / 100_000n);
    }
  }
  if (has(store, "bank_lines") && has(store, "fin_events")) {
    parts.bank = sum("SELECT COALESCE(SUM(CASE l.side WHEN 'D' THEN l.try_minor ELSE -l.try_minor END), 0) AS n FROM bank_lines l JOIN fin_events f ON f.id = l.event_id WHERE l.role IN ('opening', 'closing') AND l.gl = '500' AND l.try_minor > 0");
  }
  if (has(store, "cheques") && hasColumn(store, "cheques", "is_opening")) {
    const planLinked = has(store, "plan_entries") && has(store, "plans") ? "AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)" : "";
    const posted = "EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = ?)";
    parts.cheques = sum(
      `SELECT COALESCE(SUM(CASE WHEN c.direction = 'in' THEN -CAST(ROUND(c.amount * 100) AS INTEGER) ELSE CAST(ROUND(c.amount * 100) AS INTEGER) END
                          + CASE WHEN c.direction = 'in' AND c.status = 'bounced' AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce') AND NOT ${posted}
                                 THEN CAST(ROUND(c.amount * 100) AS INTEGER) ELSE 0 END), 0) AS n
       FROM cheques c
       WHERE c.deleted_at IS NULL AND c.is_opening = 1 ${planLinked}
         AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                         WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)`,
      "debt",
    );
  }
  if (has(store, "ledger_voucher_lines")) {
    parts.vouchers519 = sum("SELECT COALESCE(SUM(debit_minor - credit_minor), 0) AS n FROM ledger_voucher_lines WHERE account = '519'");
    parts.vouchers500 = sum("SELECT COALESCE(SUM(debit_minor - credit_minor), 0) AS n FROM ledger_voucher_lines WHERE account = '500'");
  }
  const counterpart = parts.cash + parts.accounts + parts.plans + parts.stock + parts.bank + parts.cheques + parts.vouchers519;
  return { 519: counterpart, 500: parts.vouchers500, parts };
}

/**
 * S127 = A (KULLANICI KARARI 11.11.2026, "bir olay tek kez yazılır"; C5-ACILIS-TASARIM §12.1): KG-5'ten ÖNCEKİ kuralla (2.4.9 ve takma adı "2.5.0") donmuş dönem ile Excel /
 * tablo taksit kartının iki kuraldaki yerleşimi kilit sınırının İKİ YANINA düşüyorsa kart eski kurala bağlıdır (journal() `pinnedOld`: kart Kayıt Tarihi'nde T, açılış satırları
 * kendi günlerinde — donmuş defterdeki maddeyle aynı kimlik / tarih / cari tutarı; karma okumada ikinci kez yazılmaz, eksik de kalmaz). Dönüş: bağlı kart kimlikleri (Set).
 * Eski kurallı bölge: koşu tablosunun sırayla yeniden oynatılması — tamamlanmış freeze kesitleri (from, through], tamamlanmış thaw kırpar; bekleyen eski kurallı koşunun kesiti de
 * bölgedir (göç / onarım penceresi: ara dilim o kuralla canlı türetilir — lib/ledger-snapshots.mjs middleOf). İleri yön (eski yerleşimin bir parçası bölgede, yeni yerleşim
 * dışında): eski maddelerden biri donmuş satırlarda GERÇEKTEN varsa (tarih indeksiyle; bekleyen kesitte tarih yeter) bağlı — donmadan sonra açılan / Silinenler'den dönen kart
 * yeni kuralla kalır. Ters yön (yeni yerleşim bölgede, eski yerleşim tamamen değil): bağlı (yeni kural maddeyi donmuş döneme koyar, karma okumada görünmezdi).
 * İkisi de bölgede (C5 §3.3 örneği) ya da ikisi de dışında: bağlı DEĞİL (yeni kural; fark ruleDiff'te). Donmuş koşu yoksa (kilitsiz) boş küme — sorgu yok.
 * ids (Ç5-A tur 1d, İş F — hız, ders 47; C5-ACILIS-TASARIM §14.7): verilirse yalnız bu kartlar değerlendirilir. Karar KART BAŞINADIR (kartın kendi maddeleri + koşu tablosunun
 * bölgesi; başka kart karara girmez) → sonuç = (süzgeçsiz sonuç ∩ ids). Kapının süzgeçli türetmesi (rows(filter)) her yazımda bütün yüklenen kartları ve açılış satırlarını
 * taramasın diye (100 bin satırda süzgeçli build başına ~2,5 ms).
 */
export function oldRulePinnedPlans(store, { ids = null } = {}) {
  const out = new Set();
  if (Array.isArray(ids) && !ids.length) return out;
  if (!has(store, "ledger_snapshot_runs") || !has(store, "ledger_snapshots") || !has(store, "plans") || !has(store, "plan_imports") || !hasColumn(store, "plans", "import_id")) return out;
  const preKg5 = rule => (LEDGER_RULE_ALIASES[rule] || rule) === "2.4.9";
  let segments = [];
  let pending = null;
  for (const run of leanAll(store, "SELECT no, kind, state, from_date AS fromDate, through, rule_version AS rule FROM ledger_snapshot_runs WHERE state IN ('done', 'pending') ORDER BY no")) {
    if (run.state === "pending") {
      pending = run;
      continue;
    }
    if (run.kind === "thaw") {
      const upto = String(run.through || "");
      segments = segments.map(segment => ({ ...segment, through: segment.through > upto ? upto : segment.through })).filter(segment => segment.through > segment.from);
    } else if (run.kind === "freeze" && run.through) segments.push({ from: String(run.fromDate || ""), through: String(run.through), rule: run.rule, frozen: true });
  }
  const done = segments.length ? segments.at(-1).through : "";
  if (pending && pending.kind === "freeze" && pending.through > done) segments.push({ from: done, through: String(pending.through), rule: pending.rule, frozen: false });
  const old = segments.filter(segment => preKg5(segment.rule));
  if (!old.length) return out;
  const regionOf = day => old.find(segment => day > segment.from && day <= segment.through) || null;
  const frozenRules = Object.keys(LEDGER_RULE_ALIASES).filter(preKg5).concat("2.4.9");
  const marks = frozenRules.map(() => "?").join(", ");
  const present = (id, day) => {
    const segment = regionOf(day);
    if (!segment) return false;
    if (!segment.frozen) return true;
    return Boolean(store.get(`SELECT 1 AS found FROM ledger_snapshots WHERE date = ? AND entry_id = ? AND rule_version IN (${marks}) LIMIT 1`, day, id, ...frozenRules));
  };
  const scoped = Array.isArray(ids);
  const scope = scoped ? [JSON.stringify([...new Set(ids.map(String))])] : [];
  const cards = leanAll(store,
    `SELECT p.id, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS date, COALESCE((SELECT x.created_at FROM plan_imports x WHERE x.id = p.import_id), '') AS importedAt
     FROM plans p WHERE p.deleted_at IS NULL AND p.import_id <> '' AND NOT p.covers_balance${scoped ? " AND p.id IN (SELECT value FROM json_each(?))" : ""}`,
    ...scope,
  );
  if (!cards.length) return out;
  const openings = new Map();
  for (const row of leanAll(store,
    `SELECT e.id, e.plan_id AS planId, e.date FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL
     WHERE e.kind = 'in' AND e.opening = 1 AND p.import_id <> '' AND NOT p.covers_balance${scoped ? " AND e.plan_id IN (SELECT value FROM json_each(?))" : ""}`,
    ...scope,
  )) {
    if (!openings.has(row.planId)) openings.set(row.planId, []);
    openings.get(row.planId).push(row);
  }
  for (const card of cards) {
    // Eski kuralın maddeleri: kart (Kayıt Tarihi) + her açılış satırı (kendi günü). Yeni kuralın tek maddesi: yüklemenin yerel günü (journal() ile aynı kural).
    const legacy = [{ id: `plan:${card.id}`, date: String(card.date) }, ...(openings.get(card.id) || []).map(row => ({ id: `plan-entry:${row.id}`, date: String(row.date) }))];
    const fresh = localDayOf(card.importedAt) || String(card.date);
    const inside = legacy.filter(item => regionOf(item.date));
    const freshInside = Boolean(regionOf(fresh));
    if (freshInside ? inside.length === legacy.length : inside.length === 0) continue;
    if (freshInside || inside.some(item => present(item.id, item.date))) out.add(card.id);
  }
  return out;
}

/** Yevmiyede hesabın bakiyesi (kuruş, borç artı). */
export function ledgerBalanceOf(entries, account) {
  let out = 0;
  for (const entry of entries) for (const line of entry.lines) if (line.account === account) out += line.debit - line.credit;
  return out;
}

/**
 * S53 = A (kilitsiz geçmiş yıl): dönem kilidinin ötesindeki GEÇMİŞ yıllarda (kilit < yıl sonu < bu yılın 1 Ocak'ı) Ç5-A kuralının değiştirdiği madde (açılış karşı hesabı 519,
 * formdan carisiz evrak 649.90 / 770.90) varsa yıllar. Defter Mutabakatı / Mutabakat Testi bilgi (uyarı) satırı ve "yılı kilitleyin" önerisi bundan.
 */
export function unlockedPastYears(entries, { lock = "", today = "" } = {}) {
  const yearStart = `${String(today).slice(0, 4)}-01-01`;
  if (!/^\d{4}-01-01$/.test(yearStart)) return [];
  const years = new Set();
  for (const entry of entries) {
    if (entry.date >= yearStart || (lock && entry.date <= lock)) continue;
    if (entry.lines.some(line => line.account === "519" || line.sub === "649.90" || line.sub === "770.90")) years.add(entry.date.slice(0, 4));
  }
  return [...years].sort();
}

/**
 * Ç5-A tur 1e (dar kontrol G-1; C5-ACILIS-TASARIM §15.2 (2)): KG-16 durumunun kapı dışı değişikliği — durumu (opening_review) kapının yazdığı kopyasından (opening_review_gate, göç 50)
 * farklı satırlar. lib/integrity.mjs tam taramasının "opening:review" denetimi (COMMIT'te değil). Sütun yoksa (eski şema) null.
 */
export function openingReviewDrift(store) {
  if (!has(store, "account_entries") || !hasColumn(store, "account_entries", "opening_review_gate")) return null;
  const count = Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE opening_review <> opening_review_gate")?.n) || 0;
  if (!count) return { count: 0, sample: [] };
  const text = value => ({ "": "listede değil", candidate: "onay bekliyor", confirmed: "açılış", rejected: "açılış değil" })[String(value)] ?? String(value);
  const sample = store
    .all("SELECT id, date, opening_review AS review, opening_review_gate AS gate FROM account_entries WHERE opening_review <> opening_review_gate ORDER BY date, rowid LIMIT 5")
    .map(row => `${row.id} (${row.date}): ${text(row.gate)} → ${text(row.review)}`);
  return { count, sample };
}

/** KG-16 listesi ve kararı (uçlar: routes/opening-review.mjs). */
export function createOpeningReview({ store }) {
  const ready = () => has(store, "account_entries") && hasColumn(store, "account_entries", "opening_review");
  function list({ all = false } = {}) {
    if (!ready()) return { items: [], counts: { candidate: 0, confirmed: 0, rejected: 0 } };
    const items = store
      .all(
        `SELECT e.id, e.account_id AS accountId, a.name AS accountName, a.type AS accountType, e.kind, e.amount, e.date, e.note, e.opening_review AS review
         FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
         WHERE e.opening_review ${all ? "IN ('candidate', 'confirmed', 'rejected')" : "= 'candidate'"} ORDER BY e.date, e.rowid`,
      )
      .map(row => ({ ...row, amount: roundMoney(Number(row.amount) || 0) }));
    const counts = { candidate: 0, confirmed: 0, rejected: 0 };
    for (const row of store.all("SELECT e.opening_review AS review, COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.opening_review <> '' GROUP BY e.opening_review")) {
      if (Object.hasOwn(counts, row.review)) counts[row.review] = Number(row.n) || 0;
    }
    return { items, counts };
  }
  /**
   * Karar: onay (confirmed) ya da ret (rejected). Satırın tutarı / tarihi / yönü / açılış işareti (is_opening) DEĞİŞMEZ; yalnız durum. Aynı karar tekrarı değişiklik yazmaz.
   * Ç5-A tur 1e (§15.2 (2)): kapının yazdığı durum (opening_review_gate, göç 50) AYNI işlemde yazılır; iki sütundan biri kararlıysa satır karar alır (kapı dışı değişiklikle
   * listeden düşmüş ya da durumu değişmiş satır yeniden kararla düzelir).
   */
  function decide(id, decision) {
    if (!ready()) return { status: 503 };
    const gated = hasColumn(store, "account_entries", "opening_review_gate");
    const row = store.get(`SELECT e.id, e.opening_review AS review, ${gated ? "e.opening_review_gate" : "e.opening_review"} AS gate, e.account_id AS accountId FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.id = ?`, id);
    if (!row || !(DECIDED.has(String(row.review)) || DECIDED.has(String(row.gate)))) return { status: 404 };
    const next = decision === "confirm" ? OPENING_REVIEW.confirmed : OPENING_REVIEW.rejected;
    const { gate, ...head } = row;
    if (row.review === next && gate === next) return { status: 200, row: { ...head, review: next }, changed: false };
    // Para alanı değil (tutar, yön, tarih, yol, bakiye, Kasa değişmez; yalnız Ana Defter'in karşı hesabı 519 ↔ 602 / 770): para koruması (bank.post) dışında, gerekçeli ham yazım
    // (göç 35 / 48 gibi). Kapı (mutabakat) işlemin sonunda yine koşar.
    store.raw("ledger.opening-review", () => {
      store.run("UPDATE account_entries SET opening_review = ? WHERE id = ?", next, id);
      if (gated) store.run("UPDATE account_entries SET opening_review_gate = ? WHERE id = ?", next, id);
    });
    return { status: 200, row: { ...head, review: next, previous: row.review }, changed: true };
  }
  return { list, decide };
}
