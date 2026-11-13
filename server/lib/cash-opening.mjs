// Kasa açılışı / devir (2.2.0 İz 1.3; K6, hakem 10.10.2026 "KASA-ACILIS-649"). Plan susuyor → yaygın muhasebe (Tekdüzen açılış fişi):
// Kasa'ya devreden nakit B 100 / A 500 "Açılış ve Devir Bakiyeleri" — banka hesabı açılışı (bank/voucher.mjs openingLines), cari açılışı ve
// taksit açılışıyla aynı karşı hesap (general-ledger.mjs). Önceden Kasa'ya elle giriş olarak 649'a (gelir) yazılıyordu.
//
// Tanım (Yargıç 2.2.0 Y2/Y3 düzeltmesi): açılış, Kasa → Açılış Bakiyesi ucunun yazdığı İŞARETLİ satırdır (cash_entries.is_opening = 1, göç 22).
// Açıklama metni açılışı BELİRLEMEZ: önceden "Açılış …" ile başlayan her nakit giriş açılış sayılıyordu — 2.1.0'da 200 dönen "Açılış kampanyası
// hasılatı" 409/403 alıyor, eski verinin birden çok "Açılış …" girişi düzeltilemiyor ve kilitli dönemde bile 649'dan 500'e kayıyordu. Artık
// açıklaması "Açılış" ile başlayan sıradan giriş 2.1.0'daki gibi sıradan Kasa girişidir (649); eski veride hiçbir satır kendiliğinden açılışa
// çevrilmez. Kurallar (routes/cash.mjs, routes/trash.mjs) yalnız işaretli satıra uygulanır: yalnız yönetici (system.manage) girer, düzeltir,
// siler, geri yükler; bir kez (ikincisi 409 cash-opening-exists); tarihi Kasa'nın açılış dışındaki ilk nakit hareketinden sonra olamaz (409
// cash-opening-after-first; banka açılışının kuralı); dönem kilidi ve ileri tarih her Kasa hareketi gibi.
//
// 2.5.0 Ç5-K (kullanıcı kararları S12, S20, S26, S40, S44 = A; Z9 ve B11 BAŞ MİMAR KARARI; tasarım docs/erp/C5K-KASA-TASARIM.md): Kasa açılışından
// ÖNCE tarihli YENİ nakit hareketi 409 cash-opening'in ikizi "cash-before-opening" (bankadaki bank-before-opening gibi). Kapsam 100'e yazan HER kaynak:
// denetim yol başına değil, en dış işlemin COMMIT'inden hemen önce (store.addCommitGuard; mutabakat kapısının yanında) işlemde yazılan bütün para
// satırlarına uygulanır (installCashOpeningGuard). Aynı gün olur; açılış yoksa kural yok. Düzeltme: tarihi açılıştan önceye alan ya da açılıştan önce
// tarihli kaydı nakde çeviren düzeltme de 409 (B11); tarihi değişmeyen düzeltme (tutar, açıklama, Kapatılacak Fatura, Normal Cari Hesaba İşle) kabul
// (S26 / S40 / S44). Yedekten / eski sürümden gelen satır aynen kalır (S20; geri yükleme ayrı bağlantıdır), Silinenler'den geri gelen de (Z9:
// restoringCash kapsamı, routes/trash.mjs). Mutabakat Testi bu satırları "Kasa Açılışından Önce Tarihli Hareket" uyarısıyla gösterir (cashBeforeOpening).
import { HttpError } from "./http.mjs";
import { createMoneyLines, isMoneyRow } from "./bank/money-lines.mjs";

/** Kasa → Açılış Bakiyesi'nin yazdığı açıklama. */
export const CASH_OPENING_TEXT = "Açılış Bakiyesi";

/** Satır Kasa açılışı mı (işaretli; nakit giriş, transfer değil). isOpening / is_opening ikisi de okunur. */
export function isCashOpening(row) {
  if (!row || row.kind !== "in") return false;
  if (String(row.transferId ?? row.transfer_id ?? "")) return false;
  if ((row.method || "cash") !== "cash") return false;
  return Number(row.isOpening ?? row.is_opening ?? 0) === 1;
}

const COLUMNS = "id, kind, amount, date, description, method, transfer_id AS transferId, is_opening AS isOpening, created_at AS createdAt";
const OPENINGS = `SELECT ${COLUMNS} FROM cash_entries WHERE is_opening = 1 ORDER BY date, created_at, id`;

/** Kasa açılışları (tarih sırasıyla; normalde en çok bir). except: bu satır sayılmaz (düzeltilen). */
export function cashOpenings(store, { except = "" } = {}) {
  return store.all(OPENINGS).filter(row => row.id !== except && isCashOpening(row));
}

/** Kayıtlı satır (kimlikle) Kasa açılışı mı. */
export function isCashOpeningId(store, id) {
  return isCashOpening(store.get(`SELECT ${COLUMNS} FROM cash_entries WHERE id = ?`, id));
}

/**
 * Kasa'nın açılış DIŞINDAKİ ilk nakit hareketinin tarihi ('' = yok): bütün kaynaklar (kayıt tahsilatı, cari, fatura, taksit, stok, çek, Kasa ↔
 * Banka) tek kaynaktan (money-lines), Kasa elle girişleri ayrıca (işaretli açılışlar ve except satırı hariç).
 */
export function firstCashMovement(store, money, { except = "" } = {}) {
  let first = money?.firstDate ? money.firstDate("cash", { skip: [2] }) : "";
  const own = store.get("SELECT MIN(date) AS d FROM cash_entries WHERE method = 'cash' AND id <> ? AND is_opening = 0", except)?.d;
  if (own && (!first || own < first)) first = String(own);
  return first;
}

// ---------- 2.5.0 Ç5-K: Kasa açılışından önce tarihli nakit hareketi (S12 = A; B11; S20, S26, S40, S44 = A; Z9) ----------
export const CASH_BEFORE_OPENING = "cash-before-opening";
/** 100'e yazan para tabloları (lib/bank/money-lines.mjs MODULE_TABLES; Banka Fişi satırının nakit rolü yok). */
const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);
const CASH_TABLE_SET = new Set(CASH_TABLES);
const dayText = iso => (iso ? String(iso).split("-").reverse().join(".") : "");
// Etkin Kasa açılışının tarihi (isCashOpening ile aynı tanım). Açılış varken tarih indeksiyle anında; açılışsızken tablo taraması (101.554 Kasa satırında
// ~38 ms — ölçüldü) → installCashOpeningGuard'da önbellekli.
const OPENING_DATE_SQL = "SELECT MIN(date) AS d FROM cash_entries WHERE is_opening = 1 AND kind = 'in' AND (method = 'cash' OR COALESCE(method, '') = '') AND COALESCE(transfer_id, '') = ''";

/** Kasa açılış tarihi ('' = açılış yok). */
export function cashOpeningDate(store) {
  return String(store.get(OPENING_DATE_SQL)?.d || "");
}

/** Satır (kolon adlarıyla) Kasa hareketi mi: 100'e yazan nakit para satırı (money-lines yolu "cash"); Kasa açılışının kendisi hareket değildir. */
export function isCashMovement(table, row) {
  if (!row || !CASH_TABLE_SET.has(table)) return false;
  if (String(row.method ?? "") !== "cash") return false;
  if (!isMoneyRow(table, row)) return false;
  return !(table === "cash_entries" && isCashOpening(row));
}

function beforeOpeningError({ date, opening, change = false, converted = false, table = "", id = "" }) {
  const message = converted
    ? `Bu hareket ${dayText(date)} tarihli ve Kasa açılışından (${dayText(opening)}) önce; nakde (Kasa'ya) çevrilirse o günün nakdi Kasa açılış bakiyesiyle birlikte iki kez sayılır. Düzeltme kaydedilmedi.`
    : change
      ? `Düzeltmeyle hareketin tarihi (${dayText(date)}) Kasa açılışından (${dayText(opening)}) önceye düşüyor; o günün nakdi Kasa açılış bakiyesinin içindedir. Düzeltme kaydedilmedi; tarihi Kasa açılış günü ya da sonrası yapın.`
      : `İşlem tarihi (${dayText(date)}) Kasa açılışından (${dayText(opening)}) önce; o günün nakdi Kasa açılış bakiyesinin içindedir, hareket iki kez sayılır. Tarihi Kasa açılış günü ya da sonrası yapın; hareket gerçekten açılıştan önceyse yönetici Kasa → Açılış Bakiyesi'nin tarihini öne alabilir.`;
  return new HttpError(409, message, { code: CASH_BEFORE_OPENING, field: "date", date, openingDate: opening, ...(change || converted ? { change: true } : {}), ...(table ? { row: `${table}:${id}` } : {}) });
}

const guardStates = new WeakMap();

/**
 * Kasa açılışından önce tarihli nakit hareketinin ortak denetimi (S12 = A; tek yer). Store başına bir kez kurulur (routes/cash.mjs); mutabakat kapısı gibi en dış
 * işlemin COMMIT'inden hemen önce (lib/db.mjs addCommitGuard) bu işlemde YAZILAN para satırlarına bakar — 100'e yazan bütün yollar (Kasa Giriş / Çıkış, Kasa ↔
 * Banka, Vergi Ödemesi, cari ve fatura peşini, taksit, kayıt tahsilatı, çek / senet, stok, mobil, Silinenler) kendiliğinden kapsanır. D = Kasa açılış tarihi;
 * işlemde eklenen ya da düzeltilen nakit satırı R için R.tarih < D ise:
 *   - R'nin işlemden ÖNCEKİ hâli P varsa (aynı kimlik; aynı İşlem No — Taksite Aktar, fatura Düzenle'de özeti aynı peşin; aynı faturanın peşini; olaysız eski
 *     satırın aynı gün ve tutarla taşınması): P nakit ve tarihi aynıysa KABUL (S26 / S40 / S44: tarih değişmeyen düzeltme), değilse 409 (B11: düzeltme de red —
 *     tarihi önceye alan ya da açılıştan önce tarihli kaydı nakde çeviren).
 *   - P yoksa (yeni hareket): Silinenler'den geri yükleme kapsamındaysa KABUL (Z9; restoringCash), değilse 409 cash-before-opening (S12).
 * Aynı gün olur (açılış günün başı); açılış yoksa kural yok; silme reddedilmez. Bu işlemde eklenip sonra düzeltilen satırın "önceki hâli" (scope.before'daki eklendiği
 * hâl) önceki hâl SAYILMAZ: işlem kapsamı (lib/db.mjs) böyle önceki hâlleri kesin olarak işaretler (scope.born — eklendiği işlemde yakalanan önceki hâl).
 * 2.5.0 Ç5-K tur 2 (dar kontrol DÜŞÜK-1): önceden "son COMMIT'teki en büyük rowid'den büyük" sezgisiydi; başka bağlantı yazınca (data_version) bilinmez sayılıp KABUL
 * yönünde kapanıyordu (aynı işlemde ekle + düzelt yapan bir yol olsaydı açılıştan önce tarihli YENİ satır geçerdi). Artık dış yazım sonucu değiştirmez.
 */
export function installCashOpeningGuard(store) {
  if (!store || typeof store.addCommitGuard !== "function") return null;
  const known = guardStates.get(store);
  if (known) return known;
  const counters = () => (typeof store.changeCounters === "function" ? store.changeCounters() : null);
  // Uyarı kümesinin açıklanmış kimlikleri (birleşik tur 7, DK-B6 ORTA-1 — sayı yerine kimlik; docs/devir/D2-ALTYAPI-TASARIM.md §16): restored = sıra numarası
  // (her kayıtta 1 artar; lib/integrity.mjs settleScan taramanın anlık görüntüsünden önce okur); explained = kimlik → { seq, from }: Silinenler geri yüklemesinin
  // "Kasa Açılışından Önce Tarihli Hareket" uyarısına kattığı kimlikler (from '') ve kapının kabul ettiği kimlik değişimleri (from = önceki hâlin kimliği; pending
  // işlem kesinleşince yazılır). Tarama yalnız işaretinden SONRAKİ kayıtları açıklama sayar.
  const state = { restoring: 0, opening: null, openingTouched: false, restored: 0, explained: new Map(), pending: [] };
  // Açılış tarihinin önbelleği: başka bağlantı yazınca (data_version) ya da store dışı yazımda (total − tracked) geçersiz; açılış satırına dokunan işlem
  // kendi içinde yeniden okur ve COMMIT'ten sonra önbelleği düşürür.
  function openingDate(fresh) {
    const now = counters();
    const stamp = now ? `${now.version}|${now.total - now.tracked}` : "";
    if (!fresh && state.opening && stamp && state.opening.stamp === stamp) return state.opening.date;
    const date = cashOpeningDate(store);
    state.opening = fresh || !stamp ? null : { stamp, date };
    return date;
  }
  function priorIndex(scope) {
    // Önceki hâl bu işlemde eklenen satırın eklendiği hâli mi (lib/db.mjs işlem kapsamının kesin izi; dış yazımdan bağımsız).
    const insertedHere = (table, rowid) => Boolean(scope.born?.get(table)?.has(Number(rowid)));
    const byId = new Map();
    const byEvent = new Map();
    const byInvoice = new Map();
    const loose = [];
    for (const table of CASH_TABLES) {
      const before = scope.before.get(table);
      if (!before) continue;
      const rows = scope.rows.get(table);
      for (const row of before.values()) {
        if (insertedHere(table, row.__rowid)) continue;
        const item = { table, row };
        if (row.id) byId.set(`${table}:${row.id}`, item);
        if (row.event_id && !byEvent.has(String(row.event_id))) byEvent.set(String(row.event_id), item);
        if (table === "account_entries" && row.source === "invoice" && row.source_id) {
          const key = String(row.source_id);
          if (!byInvoice.has(key)) byInvoice.set(key, []);
          byInvoice.get(key).push(item);
        }
        // Olaysız (eski sürümden) satır bu işlemde silindiyse: aynı gün ve tutarla başka tabloya taşınmış olabilir (Taksite Aktar).
        if (!row.event_id && !rows?.has(row.__rowid) && isCashMovement(table, row)) loose.push(item);
      }
    }
    const cents = row => Math.round((Number(row.amount) || 0) * 100);
    return (table, row) => {
      const own = byId.get(`${table}:${row.id}`);
      if (own) return own;
      const event = row.event_id ? byEvent.get(String(row.event_id)) : null;
      if (event) return event;
      if (table === "account_entries" && row.source === "invoice" && row.source_id) {
        const same = byInvoice.get(String(row.source_id)) || [];
        const match = same.find(item => isCashMovement(item.table, item.row) && item.row.date === row.date) || same[0];
        if (match) return match;
      }
      return loose.find(item => item.row.date === row.date && cents(item.row) === cents(row)) || null;
    };
  }
  const guard = {
    check({ tables, scope }) {
      state.openingTouched = false;
      state.pending = [];
      if (!scope || ![...(tables || [])].some(table => CASH_TABLE_SET.has(table))) return;
      const written = [];
      for (const table of CASH_TABLES) {
        const rowids = scope.rows.get(table);
        if (!rowids?.size) continue;
        for (const row of store.all(`SELECT rowid AS __rowid, * FROM ${table} WHERE rowid IN (SELECT value FROM json_each(?))`, JSON.stringify([...rowids]))) written.push({ table, row });
      }
      const openingRow = row => Number(row?.is_opening) === 1;
      if (written.some(item => item.table === "cash_entries" && openingRow(item.row)) || [...(scope.before.get("cash_entries")?.values() || [])].some(openingRow)) state.openingTouched = true;
      const moves = written.filter(item => isCashMovement(item.table, item.row));
      if (!moves.length) return;
      const opening = openingDate(state.openingTouched);
      if (!opening) return;
      let priorOf = null;
      for (const { table, row } of moves) {
        const date = String(row.date || "");
        if (!date || date >= opening) continue;
        priorOf ||= priorIndex(scope);
        const prior = priorOf(table, row);
        if (prior) {
          const wasCash = isCashMovement(prior.table, prior.row);
          if (wasCash && String(prior.row.date || "") === date) {
            // Birleşik tur 7: önceki hâli BAŞKA kimlikte (Tablodan Aktar, Aktarımı Geri Al, aynı İşlem No'lu yeniden yazım) — uyarı kümesinde onun yerine geçer.
            const key = cashNoticeKeyOf(table, row.id);
            const from = cashNoticeKeyOf(prior.table, prior.row.id);
            if (key !== from) state.pending.push({ key, from });
            continue;
          }
          throw beforeOpeningError({ date, opening, change: true, converted: !wasCash && String(prior.row.date || "") === date, table, id: row.id });
        }
        if (state.restoring > 0) continue;
        throw beforeOpeningError({ date, opening, table, id: row.id });
      }
    },
    after() {
      if (state.openingTouched) state.opening = null;
      state.openingTouched = false;
      if (state.pending.length) {
        state.restored += 1;
        for (const { key, from } of state.pending) state.explained.set(key, { seq: state.restored, from });
      }
      state.pending = [];
    },
    rolledBack() {
      state.openingTouched = false;
      state.pending = [];
    },
  };
  const remove = store.addCommitGuard(guard);
  const handle = { state, remove, openingDate: () => openingDate(false) };
  guardStates.set(store, handle);
  return handle;
}

/**
 * Silinenler'den geri yükleme kapsamı (Z9 BAŞ MİMAR KARARI; S20): fn'nin işlemlerinde geri gelen para satırı Kasa açılışından önce tarihli olsa da aynen döner
 * (yalnız S12 kalkar; dönem kilidi, ileri tarih, düzeltme kuralı aynen). Eşzamanlı (düğüm tek iş parçacığı; fn store işlemlerini beklemeden bitirir).
 */
// Birleşik tur 8 (dar kontrol DK-B7 ORTA-1; BAŞ MİMAR KARARI 13.11 09:54 — kullanıcıya gösterildi): expected = Silinenler öğesinin silinirkenki özeti (kimlik → 'tarih|kuruş';
// recordingHidden / trash ekleme) — verilirse geri yükleme yalnız özette AYNI kimlik + tarih + tutarla duran satırları açıklar; silindikten sonra dışarıdan değişmiş (tarih / tutar /
// kimlik) satır açıklanmaz → tarama 'kapının görmediği yazım' alarmı verir. Özeti olmayan (eski) öğede bugünkü davranış AYNEN (yanlış alarm üretilmez).
export function restoringCash(store, fn, { expected = null } = {}) {
  const handle = guardStates.get(store);
  if (!handle) return fn();
  // 2.5.0 birleşik tur 6 (DK-D2T3 ORTA-1; BAŞ MİMAR 11.11 — kullanıcı onaylı): en dış geri yüklemede uyarı önce / sonra ölçülür. Birleşik tur 7 (DK-B6 ORTA-1; BAŞ MİMAR
  // 12.11 12:52): sayı yerine KİMLİK — SONRA'da olup ÖNCE'de olmayan her kimlik (geri gelen satırlar ve görünürlüğü dönen üst kaydın — cari, kart, çek — satırları) bir sıra
  // numarasıyla açıklanmış kaydedilir. Tarama bunları "kapının görmediği yazım" saymaz; silinip geri gelen satır başka bir kimliğin artışını açıklamaz. Ölçüm eşzamanlı
  // (fn store işlemlerini beklemeden bitirir; arada başka istek çalışmaz); fn hata verse de ölçülür (işlemin bir kısmı kesinleşmiş olabilir).
  const outer = handle.state.restoring === 0;
  const before = outer ? keysBeforeOpening(store) : null;
  const settle = () => {
    if (!outer || !before) return;
    const after = keysBeforeOpening(store);
    const added = after ? [...after.keys()].filter(key => !before.has(key)) : [];
    const explains = expected ? added.filter(key => expected.get(key) === after.get(key)) : added;
    if (!explains.length) return;
    handle.state.restored += 1;
    for (const key of explains) handle.state.explained.set(key, { seq: handle.state.restored, from: "" });
  };
  handle.state.restoring += 1;
  let result;
  try {
    result = fn();
  } finally {
    handle.state.restoring -= 1;
    if (!(result && typeof result.then === "function")) settle();
  }
  // Bekleyen iş (bugün yok): sonuç gelince ölçülür (arada başka istek çalışabilir — artış yine açıklanmış sayılır, yanlış alarm yönüne gitmez).
  if (result && typeof result.then === "function") return Promise.resolve(result).finally(settle);
  return result;
}

/**
 * Uyarı kümesi (cashBeforeOpening ile aynı tanım: Kasa açılışından önce tarihli görünür nakit hareketlerinin kimlikleri; açılış yoksa boş). Okunamazsa null (eski şema):
 * restoringCash ölçemez — o geri yükleme açıklama katmaz (taramanın bir sonraki karşılaştırması yine çalışır).
 */
function keysBeforeOpening(store) {
  try {
    // Hız (ders 47, 53): yalnız kimlik + imza — örnek metni / kaynak adı kurulmaz (geri yükleme başına iki kez; 18.651 açılış öncesi satırda ölçüldü).
    const opening = cashOpeningDate(store);
    const keys = new Map();
    if (!opening) return keys;
    const lines = createMoneyLines(store);
    for (const line of lines.lines({ ways: ["cash"], before: opening, light: true })) keys.set(noticeKeyOf(lines, line), signatureOf(line));
    return keys;
  } catch {
    return null;
  }
}

// Birleşik tur 8 (DK-B7 ORTA-1): satırın özeti — tarih + kuruş (kimlik anahtarın kendisi).
const signatureOf = line => `${line.date || ""}|${Number(line.cents) || 0}`;
const HIDDEN_PREFIX = "cash-hidden:";
/** Silinenler özetinin ayar anahtarı (kaynak: plan / account / cheque / trash; ref: öğenin kimliği). */
export const hiddenKeyOf = (source, ref) => `${HIDDEN_PREFIX}${source}:${ref}`;
// Üst kaydın gizlenen para satırları (Kasa uyarısının kimliğiyle aynı tablo + kimlik; tarih + kuruş): kartın taksit hareketleri, carinin cari satırları, evrakın olayları.
// Hız (ders 47, 53 (a)): yalnız silinen kaydın satırları, dizinli tek sorgu — Kasa'nın bütün satırları OKUNMAZ (ilk sürümde iki tam tarama kart silmeyi ~57 → ~700 ms yapıyordu).
const CHILD_ROWS = {
  plan: ["plan_entries", "SELECT id, date, CAST(ROUND(amount * 100) AS INTEGER) AS cents FROM plan_entries WHERE plan_id = ?"],
  account: ["account_entries", "SELECT id, date, CAST(ROUND(amount * 100) AS INTEGER) AS cents FROM account_entries WHERE account_id = ?"],
  cheque: ["cheque_events", "SELECT id, date, CAST(ROUND(amount * 100) AS INTEGER) AS cents FROM cheque_events WHERE cheque_id = ?"],
};
/**
 * Üst kayıt (kart, cari, çek / senet) silinirken görünürlüğü kalkan para satırlarının özeti (kimlik → tarih|kuruş) — fn'den ÖNCE okunur (silinirkenki hâl), fn başarıyla
 * bitince ayar tablosuna TEK değer olarak yazılır. fn hata verirse özet yazılmaz. Okunamazsa (eski şema) öğe özetsiz kalır (bugünkü davranış).
 */
export function recordingHidden(store, source, ref, fn) {
  let rows = null;
  try {
    const [table, sql] = CHILD_ROWS[source] || [];
    if (table) {
      rows = {};
      for (const row of store.all(sql, ref)) rows[`${table}:${row.id}`] = `${row.date || ""}|${Number(row.cents) || 0}`;
    }
  } catch {
    rows = null;
  }
  const result = fn();
  if (rows) {
    try {
      saveHidden(store, hiddenKeyOf(source, ref), rows);
    } catch {
      // özet yazılamadı: öğe özetsiz kalır (bugünkü davranış)
    }
  }
  return result;
}
/** Özeti yazar (kimlik → 'tarih|kuruş'); tek satırlık Silinenler öğesi için yükten (lib/trash.mjs) de çağrılır. */
export function saveHidden(store, key, rows) {
  store.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", key, JSON.stringify({ rows }), new Date().toISOString());
}
/** Özetleri birleştirir: hepsi varsa Map, biri yoksa null (eksik özet → bugünkü davranış; yanlış alarm üretilmez). */
export function hiddenExpected(store, keys) {
  const out = new Map();
  for (const key of keys) {
    let value = null;
    try {
      value = JSON.parse(store.get("SELECT value FROM settings WHERE key = ?", key)?.value || "null");
    } catch {
      value = null;
    }
    if (!value?.rows) return null;
    for (const [rowKey, sig] of Object.entries(value.rows)) out.set(rowKey, sig);
  }
  return out;
}

/** Açıklama kayıtlarının sıra numarası (store başına; denetim kurulu değilse 0). lib/integrity.mjs settleScan taramanın anlık görüntüsünden önce okur. */
export function cashRestoreMark(store) {
  return guardStates.get(store)?.state.restored ?? 0;
}

const NO_EXPLAINED = new Map();
/** Açıklanmış kimlikler: kimlik → { seq, from } (Silinenler geri yüklemesi: from ''; kapının kabul ettiği kimlik değişimi: from = önceki kimlik). Salt okunur kullanılır. */
export function cashExplained(store) {
  return guardStates.get(store)?.state.explained ?? NO_EXPLAINED;
}

// Uyarı kümesinin kimliği: para satırının TABLOSU + satır kimliği (lib/bank/money-lines.mjs kaynakları; aynı tablonun iki kaynağı — cari / fatura — tek kimlik).
const TABLE_OF_SOURCE = Object.freeze({ payment: "payments", manual: "cash_entries", account: "account_entries", invoice: "account_entries", bank: "account_entries", plan: "plan_entries", stock: "stock_moves", cheque: "cheque_events", bankLine: "bank_lines" });
const cashNoticeKeyOf = (table, id) => `${table}:${id ?? ""}`;
// Para satırının (money-lines) uyarı kimliği — cashBeforeOpening ve keysBeforeOpening AYNI tanımla.
const noticeKeyOf = (lines, line) => {
  const source = typeof lines.sourceName === "function" ? lines.sourceName(line.src) : "";
  return cashNoticeKeyOf(TABLE_OF_SOURCE[source] || source || "?", line.id);
};

const SOURCE_LABEL = { payment: "Kayıt Tahsilatı", manual: "Kasa Hareketi", account: "Cari Hareketi", invoice: "Fatura Peşini", plan: "Taksit Hareketi", stock: "Stok Hareketi", cheque: "Çek / Senet Hareketi" };
/**
 * S20 = A (Mutabakat Testi uyarısı): Kasa açılışından önce tarihli görünür nakit hareketleri (geri yüklenen yedek, eski sürüm verisi, Silinenler) — null = açılış yok.
 * { opening, rows: [{ source, id, date, sample }] } (tarih sırasıyla; money-lines'ın Kasa satırlarıyla aynı görünürlük).
 */
export function cashBeforeOpening(store, money = null) {
  const opening = cashOpeningDate(store);
  if (!opening) return null;
  const lines = money?.lines ? money : createMoneyLines(store);
  const rows = lines.lines({ ways: ["cash"], before: opening, light: true }).map(line => {
    const source = typeof lines.sourceName === "function" ? lines.sourceName(line.src) : "";
    return { source, id: String(line.id || ""), date: String(line.date || ""), key: noticeKeyOf(lines, line), sample: `${SOURCE_LABEL[source] || "Kasa Hareketi"} ${line.id} · ${dayText(line.date)}` };
  });
  return { opening, rows };
}
