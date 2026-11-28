// Şüpheli Ticari Alacaklar — çekirdek (2.3.0 İz 1; docs/BANKA-MODULU-PLAN.md §3.11b; kabul docs/2.3.0-SUPHELI-KABUL.md). Kalıp:
// lib/bank/collections.mjs (Bankaya Tahsile Ver): kendi tablosu + fin_events başlığı (para satırı yok), yevmiye lib/general-ledger.mjs'te
// TEK KURALDAN türetilir (lib/doubtful-gl.mjs), kapı denetimi doubtful:records, kilit izi sürüme bağlı girdi (lib/integrity.mjs since "2.3.0").
//
// İz: doubtful_receivables (kayıt: cari, tarih, tutar, neden, evrak; open → released | cancelled) · doubtful_provisions (karşılık; active |
//   cancelled) · account_entries (Değersiz Alacak satırı: kind 'credit', source 'doubtful', source_id = kayıt) · fin_events başlıkları
//   (doubtful_take / doubtful_release / doubtful_provision / doubtful_writeoff; NON_MONEY_TYPES, İşlem No'lu).
// Tahsil edilen, kalan, karşılığın çözülmesi SAKLANMAZ: ayırma kuralı (allocateDoubtful) carinin alacak satırlarından her seferinde aynı
//   sonucu türetir — tahsilatın silinmesi/düzeltilmesi/geri yüklenmesi kendiliğinden tutarlı kalır (bağlı kayıt yok). Beklenenler (routes/
//   ledger.mjs expected) aynı kuralı SQL'den okunan alacak satırlarıyla koşar (ikinci yükleyici); kapı iki yükleyiciyi karşılaştırır.
// Bütün yazımlar rotanın bank.post işleminde (write geri çağrısı): kayıt, başlık, işlem geçmişi ve istek kimliği birlikte ya da hiç.
import { randomUUID } from "node:crypto";
import { DOUBTFUL_REASONS, allocateDoubtful, doubtfulControl, doubtfulStatusOf, doubtfulView, isDoubtfulReason } from "../doubtful-gl.mjs";
import { HttpError, limited, text } from "../http.mjs";
import { fromMinor, parseMinor, toMinor } from "../minor.mjs";
import { newEventId, nextEventNo } from "./event-no.mjs";
// 2.5.0 Ç5-A tur 3c (C5-ACILIS-TASARIM §19; K-1): şüpheli ↔ kuyruk defter kuralı kuyruğu store'dan kurar. lib/obligation-input.mjs bu modülü (doubtfulState) içe aktarır — ESM döngüsü;
// iki yön de değerleri YALNIZ işlev içinde okur (modül düzeyinde okuma yok), hangisi önce yüklenirse yüklensin çalışır (test/supheli-kuyruk-defter-250.test.mjs ayrı süreçte sınar).
import { createObligationInput } from "../obligation-input.mjs";
import { createAccountLines } from "../account-lines.mjs";
import { accountLedger, waivesSql } from "../accounts.mjs";
import { doubtfulBefore } from "../obligation-queue.mjs";

export const DOUBTFUL_TABLES = Object.freeze(["doubtful_receivables", "doubtful_provisions"]);
export const DOUBTFUL_TYPES = Object.freeze(new Set(["doubtful_take", "doubtful_release", "doubtful_provision", "doubtful_writeoff"]));
export const DOUBTFUL_SOURCE = "doubtful";
const AUDITOR = Object.freeze({ id: "integrity", role: "admin", permissions: [] });
const dayText = iso => (iso ? String(iso).split("-").reverse().join(".") : "");
// K5 (2.3.0): iletilerde para işareti programın öbür iletileri gibi "TL" (önceden bu modülde "₺", öbürlerinde "TL").
const tl = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100)} TL`;
const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
export const hasDoubtful = store => hasTable(store, "doubtful_receivables");
/** Şüpheli alacak hiç kullanılmış mı (iptal edilenler dahil): 128/129 denetimleri yalnız kullanılınca açılır (300/309 ve 121/321 kuralı). */
export const doubtfulUsed = store => hasDoubtful(store) && Boolean(store.get("SELECT 1 AS found FROM doubtful_receivables LIMIT 1"));

const RECORD_SQL = `SELECT d.id, d.rowid AS seq, d.account_id AS party, d.date, d.amount_minor AS amountMinor, d.reason, d.note, d.cheque_id AS chequeId, d.status,
    d.closed_date AS closedDate, d.event_id AS eventId, d.close_event_id AS closeEventId, d.created_by AS createdBy, d.created_at AS createdAt,
    COALESCE(a.type, '') AS accountType, COALESCE(a.name, '') AS accountName, COALESCE(a.ref_no, '') AS accountRefNo, a.deleted_at AS accountDeletedAt,
    COALESCE(c.serial_no, '') AS chequeSerialNo, COALESCE(c.instrument, '') AS chequeInstrument,
    COALESCE(e.no, '') AS eventNo, COALESCE(x.no, '') AS closeEventNo
  FROM doubtful_receivables d LEFT JOIN accounts a ON a.id = d.account_id LEFT JOIN cheques c ON c.id = d.cheque_id AND d.cheque_id <> ''
    LEFT JOIN fin_events e ON e.id = d.event_id LEFT JOIN fin_events x ON x.id = d.close_event_id AND d.close_event_id <> ''`;
const PROVISION_SQL = `SELECT p.id, p.doubtful_id AS recordId, p.date, p.amount_minor AS amountMinor, p.note, p.status, p.event_id AS eventId, COALESCE(e.no, '') AS eventNo
  FROM doubtful_provisions p LEFT JOIN fin_events e ON e.id = p.event_id`;
const withControl = row => ({ ...row, control: doubtfulControl(row.accountType), reasonLabel: DOUBTFUL_REASONS[row.reason] || row.reason });

/**
 * Yevmiyenin ve beklenenlerin kayıtları: silinmemiş carinin iptal edilmemiş kayıtları ve etkin karşılıkları. parties: yalnız bu cariler
 * (dokunulan varlıklar süzgeci; routes/ledger.mjs rows). Tablo yoksa boş.
 */
export function doubtfulRows(store, { parties = null } = {}) {
  if (!hasDoubtful(store)) return { records: [], provisions: [] };
  const list = parties ? JSON.stringify([...parties]) : null;
  if (list === "[]") return { records: [], provisions: [] };
  // Süzgeçli okuma (kapının dokunulan varlıklar yolu; test/banka-210-kapi-plan.test.mjs): kimlik listesinden başlar (json_each CROSS JOIN →
  // idx_doubtful_receivables_account → idx_doubtful_provisions_record), cari ve başlık birincil anahtarla; silinme/durum kolonlarının indeksi
  // tekli + ile kapalı (istatistiksiz planlayıcı accounts.deleted_at indeksini seçip tabloyu dolaşıyordu).
  const records = list
    ? store.all(`${RECORD_SQL.replace("FROM doubtful_receivables d", "FROM json_each(?) j CROSS JOIN doubtful_receivables d ON d.account_id = j.value")} WHERE +a.deleted_at IS NULL AND +d.status <> 'cancelled' ORDER BY d.date, d.rowid`, list).map(withControl)
    : store.all(`${RECORD_SQL} WHERE +a.deleted_at IS NULL AND +d.status <> 'cancelled' ORDER BY d.date, d.rowid`).map(withControl);
  const provisions = list
    ? store.all(
        `SELECT p.id, p.doubtful_id AS recordId, p.date, p.amount_minor AS amountMinor, p.note, p.status, p.event_id AS eventId, COALESCE(e.no, '') AS eventNo
         FROM json_each(?) j CROSS JOIN doubtful_receivables d ON d.account_id = j.value CROSS JOIN doubtful_provisions p ON p.doubtful_id = d.id
           JOIN accounts a ON a.id = d.account_id LEFT JOIN fin_events e ON e.id = p.event_id
         WHERE +a.deleted_at IS NULL AND +p.status = 'active' AND +d.status <> 'cancelled' ORDER BY p.date, p.rowid`,
        list,
      )
    : store.all(
        `${PROVISION_SQL} JOIN doubtful_receivables d ON d.id = p.doubtful_id JOIN accounts a ON a.id = d.account_id
         WHERE +a.deleted_at IS NULL AND +p.status = 'active' AND +d.status <> 'cancelled' ORDER BY p.date, p.rowid`,
      );
  // 2.5.0 Ç5-A tur 3c: yevmiye yükleyicisinin (applyDoubtfulToJournal) şüpheli ↔ kuyruk geri çağrısı — ikinci yükleyiciyle aynı (sayılmayan özellik: satır verisi gibi dolaşmaz).
  const linked = records.length ? linkedShares(store, records.map(record => record.party)) : null;
  const out = linked ? Object.defineProperty({ records, provisions }, "linked", { value: linked, enumerable: false }) : { records, provisions };
  // B1 (ders 31): yevmiye yükleyicisinin yazım sırası — SQL yükleyicisinin (doubtfulCredits) at / seq'i, ref (account:… / plan-entry:… / plan-close:… / invoice:…) başına. TEMBEL: ayırıcı
  // yalnız aynı gün aynı sınıfta iki alacak karşılaşınca sorar; sorgu çağrı başına bir kez (kayıtların carileri).
  if (records.length) {
    let byRef = null;
    Object.defineProperty(out, "writeOrder", { enumerable: false, value: ref => {
      byRef ||= new Map(doubtfulCredits(store, new Set(records.map(record => record.party))).map(row => [row.key, { at: row.at, seq: row.seq }]));
      return byRef.get(String(ref)) || null;
    } });
  }
  return out;
}

/**
 * İkinci yükleyici: carinin kontrol hesabını alacaklandıran satırlar SQL'den (yevmiyenin kuralıyla aynı; lib/general-ledger.mjs journal):
 *   cari satırı: tahsilat ("Normal Cari Hesaba İşle" işaretli ve fatura peşini HARİÇ — karar 15.10.2026; Kapatılacak Fatura bağlısı 2.5.0 Ç5-A tur 3c'den beri dahil) ve
 *   alacak (fatura kaynaklı hariç; Değersiz Alacak satırı hedefli) · taksit tahsilatı (silinmemiş kart; kartın açılış tarihi openedOn) ·
 *   kapatılan kartın vazgeçilen kalanı (689; kapanış günü; openedOn) · kesilmiş satıştan iade ve alış faturası (ödenecek).
 */
export function doubtfulCredits(store, parties) {
  const list = JSON.stringify([...parties]);
  if (list === "[]") return [];
  const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
  const has = name => hasTable(store, name);
  const parts = [
    // Karar 15.10.2026 (plan §3.11b/2; lib/doubtful-gl.mjs doubtfulSkipOf ikizi): "Normal Cari Hesaba İşle" (doubtful_skip) ve fatura peşini (source 'invoice') tahsilatı
    // şüpheliden düşmez → hiç yüklenmez. 2.5.0 Ç5-A tur 3c (S25 (c), S39, S168 = B): Kapatılacak Fatura bağlı (invoice_id) tahsilat YÜKLENİR — payı ayırıcının `linked` kuralıyla.
    `SELECT 'account:' || e.id AS key, e.account_id AS party, e.date, ${c("e.amount")} AS minor, CASE WHEN e.source = 'doubtful' THEN e.source_id ELSE '' END AS target, '' AS openedOn,
            COALESCE(e.created_at, '') AS at, e.rowid AS seq
     FROM json_each(?1) j CROSS JOIN account_entries e ON e.account_id = j.value
     WHERE (e.kind = 'in' AND e.doubtful_skip = 0 AND e.source <> 'invoice') OR (e.kind = 'credit' AND e.source <> 'invoice')`,
  ];
  if (has("plans") && has("plan_entries")) {
    // openedOn: kartın açılış tarihi — şüpheli kaydından SONRA açılan kartın taksiti / vazgeçilen kalanı o kayıttan düşmez (doubtful-gl).
    // Kontrol turu 2 K1 (15.10.2026): "Mevcut borcu taksitlendir" (covers_balance) kartı yeni alacak getirmez (yevmiyede 602 yazılmaz; borç
    // caride zaten yazılı) → tarih kapısı YOK, taksiti şüpheliden düşer (önceden 128'den hiç düşmüyor, 120 bitince kapı reddediyordu).
    const openedOn = "CASE WHEN p.covers_balance = 1 THEN '' ELSE COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) END";
    parts.push(`SELECT 'plan-entry:' || pe.id, p.account_id, pe.date, ${c("pe.amount")}, '', ${openedOn}, COALESCE(pe.created_at, ''), pe.rowid FROM json_each(?1) j CROSS JOIN plans p ON p.account_id = j.value AND p.deleted_at IS NULL CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE pe.kind = 'in'`);
    // Vazgeçilen kalan kuruşla: kart tutarı (kuruş) − net tahsilat (her satır kuruşa çevrilip toplanır; banka kodunda REAL toplam yok).
    // 2.5.0 Ç7b tur 3b (karar (6) "Borçta Kalsın"): YALNIZ kalanı düşülen (eski kural, göç 53 '2.4.9') kart — yevmiyenin 689'uyla aynı yardımcı (lib/accounts.mjs waivesSql).
    parts.push(
      `SELECT 'plan-close:' || p.id, p.account_id, MAX(COALESCE(p.closed_at, substr(p.updated_at, 1, 10)), ${openedOn}),
              MAX(0, ${c("p.total")} - COALESCE((SELECT SUM(CAST(ROUND((CASE WHEN x.kind = 'in' THEN x.amount ELSE -x.amount END) * 100) AS INTEGER)) FROM plan_entries x WHERE x.plan_id = p.id), 0)), '', ${openedOn},
              COALESCE(p.updated_at, p.created_at, ''), p.rowid
       FROM json_each(?1) j CROSS JOIN plans p ON p.account_id = j.value AND p.deleted_at IS NULL WHERE ${waivesSql("p")}`,
    );
  }
  // Tek aday düzeltme turu (B1 hız; ders 47, 53 (a)): durum / tür koşulu dizin DIŞINDA (+) — planlayıcı carinin dizinini (idx_invoices_account) kullanır. Önceden idx_invoices_status'u
  // seçip carinin her satırı için BÜTÜN kesilmiş iade / alış faturalarını dolaşıyordu (100 bin satırda tek cari ~16 ms); B1'in yevmiye yükleyicisi (writeOrder) bu sorguyu bir kez
  // daha çağırdığından bağlı çek / tahsilat yazımı yavaşladı. Satır kümesi aynı (yalnız sıra / dizin seçimi).
  if (has("invoices")) parts.push(`SELECT 'invoice:' || i.id, i.account_id, i.issue_date, ${c("i.try_payable")}, '', '', COALESCE(NULLIF(i.issued_at, ''), i.created_at, ''), i.rowid FROM json_each(?1) j CROSS JOIN invoices i ON i.account_id = j.value WHERE +i.status = 'issued' AND +i.kind IN ('sale_return', 'purchase')`);
  // B1 (ders 31): at / seq — satırın yazım sırası (yazım anı, kaynak tablonun rowid'i); ayırıcı aynı gün aynı sınıfta bununla sıralar (lib/doubtful-gl.mjs by).
  return store.all(`SELECT * FROM (${parts.join("\nUNION ALL\n")}) WHERE minor > 0`, list).map(row => ({ key: row.key, party: row.party, date: row.date, minor: Number(row.minor), target: row.target || "", openedOn: row.openedOn || "", at: row.at || "", seq: Number(row.seq) }));
}

// Bağlı evrakı olan cariler (linkedShares'in ön denetimi): evrakın carisi / ciro edilen / olayın carisi j listesindeyse ve evrakın faturaya bağlı bir olayı (invoice_id) varsa.
export const LINKED_CHEQUE_PARTIES_SQL = `SELECT c.account_id AS id FROM json_each(?1) j CROSS JOIN cheques c ON c.account_id = j.value WHERE EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.invoice_id <> '')
  UNION SELECT c.endorse_account_id FROM cheques c WHERE c.endorse_account_id IN (SELECT value FROM json_each(?1)) AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.invoice_id <> '')
  UNION SELECT ev.account_id FROM cheque_events ev WHERE ev.account_id IN (SELECT value FROM json_each(?1)) AND ev.invoice_id <> '' AND EXISTS (SELECT 1 FROM cheques c WHERE c.id = ev.cheque_id)`;
/**
 * 2.5.0 Ç5-A tur 3c (S14, S25 (a)(b)(c), S39, S168 = B; C5-ACILIS-TASARIM §19.1; BAŞ MİMAR KARARI K-1): ayırıcının (lib/doubtful-gl.mjs allocateDoubtful) `linked` geri çağrısı — İKİ yükleyici
 * (yevmiye: doubtfulRows → applyDoubtfulToJournal; SQL: doubtfulState) AYNISINI verir. Kuyruğun BAĞI olan cari satırı (Kapatılacak Fatura invoice_id — taksitli fatura hariç; faturaya bağlı
 * evrak) için faturanın kuyrukta, satırdan ÖNCEKİ anda şüpheli sayılan payını kayıtlarıyla döndürür (lib/obligation-queue.mjs doubtfulBefore — kesitin şüpheli kalanları ayırıcının o anki
 * durumundan; döngü yok). Bağsız satır → null (bugünkü kural). Yalnız bağı olabilecek satırı olan cariler için kuyruk kurulur (tek SQL'lik ön denetim; cari başına girdi bir kez, kart
 * haritası cari kümesine göre bir kez — ders 47). Bellek çağrı başınadır (iki şirket / geri yükleme paylaşmaz).
 */
export function linkedShares(store, parties) {
  const ids = [...new Set(parties || [])];
  if (!ids.length || !hasTable(store, "account_entries")) return null;
  const list = JSON.stringify(ids);
  // TEK ADAY HIZ (t3hiz): aday kümesi de işlem dışı bellekte (aynı veri durumu, aynı cari listesi → aynı küme; linkedMemoOf).
  const memo = linkedMemoOf(store);
  const remembered = memo?.candidates.get(list);
  const candidates = remembered || new Set(store.all("SELECT DISTINCT e.account_id AS id FROM json_each(?) j CROSS JOIN account_entries e ON e.account_id = j.value WHERE e.invoice_id <> '' AND e.kind = 'in'", list).map(row => row.id));
  if (!remembered && hasTable(store, "cheque_events") && hasTable(store, "cheques")) {
    // 2.5.0 TEK ADAY HIZ (t3hiz; ders 47): koşul AYNI (faturaya bağlı olayı olan evrakın carisi / ciro edileni / olayın carisi), ama kollar ayrı — önceki tek EXISTS her cari için
    // bütün olayları evrakıyla dolaşıyordu (100 bin satırda cari başına ~13 ms; şüpheli kaydı olan her şirkette HER yazımın kapısında). Evrakın carisi idx_cheques_account'tan; ciro edilen ve
    // olayın carisi dizinsiz kolonlar → tek tarama (cari sayısından bağımsız). Eşdeğerlik test/t3hiz-esdegerlik-250.test.mjs (eski sorgu hakem; bütün cariler kümesinde de).
    // Küme BİRLEŞİMDİR: bağlı tahsilatı olduğu için zaten aday olan cari evrak sorgusuna sorulmaz (yazımın kapısında tek bağlı carisi → sorgu hiç koşmaz).
    const rest = ids.filter(id => !candidates.has(id));
    if (rest.length) for (const row of store.all(LINKED_CHEQUE_PARTIES_SQL, JSON.stringify(rest))) candidates.add(row.id);
  }
  if (!remembered) memo?.candidates.set(list, candidates);
  if (!candidates.size) return null;
  let input = null;
  let lines = null;
  let plans = null;
  const bases = new Map();
  // Kesitin aynı gün kuralı (§19.1): ayırıcıya giren alacak satırı ayırıcının işlediği kadarıyla; ref biçimi ayırıcınınki (account:<satır> / plan-entry:… / plan-close:… / invoice:<fatura>).
  const refOfLine = line => (line.origin === "plan" ? String(line.id) : line.origin === "invoice" ? `invoice:${line.sourceId}` : `account:${line.id}`);
  // Cari başına kurulum (girdi + satırın günü + aynı günün satırları + kesit belleği). TEK ADAY HIZ (t3hiz): işlem DIŞINDA, aynı veri durumunda (total_changes · data_version) ÇAĞRILAR
  // ARASINDA paylaşılır (linkedMemoOf); işlem içinde her çağrı kendi kurar (bugünkü gibi).
  const baseOf = party => {
    if (bases.has(party)) return bases.get(party);
    const memo = linkedMemoOf(store);
    let entry = memo?.entries.get(party);
    if (!entry) {
      input ||= createObligationInput({ store });
      lines ||= createAccountLines({ store });
      plans ||= lines.ledgerPlansOf([...candidates]);
      const ledger = input.ledgerLines({ ids: [party], plans }).get(party) || [];
      const base = input.withExtras(input.accountSettleInput(party, ledger, ""), input.obligationExtras(party, new Map()), party);
      // dayOf: kesit satırının günü — doubtfulBefore gibi İLK eşleşen satırdan (lines.find); sameDay: o günün bütün satırları (include yalnız onlar için sorulur).
      const sameDay = new Map();
      const dayOf = new Map();
      for (const line of base.lines || []) {
        if (!sameDay.has(line.date)) sameDay.set(line.date, []);
        sameDay.get(line.date).push(line);
        if (!dayOf.has(line.id)) dayOf.set(line.id, line.date);
      }
      entry = { base, dayOf, sameDay, cuts: new Map() };
      memo?.entries.set(party, entry);
    }
    bases.set(party, entry);
    return entry;
  };
  // 2.5.1 M2 (S270 güvenlik denetimi — tasarım m2-rapor.md §0b madde 3): varsayımsal Değersiz Alacak satırı (extra = { party, entry }) kuyruk kesitine de eklenir — yazımdan sonraki hâlin
  // birebiri (ayırıcının aynı gün kuralı `done` satırı görür). Kurulum (bases) paylaşılır; türetilmiş girdi ve kesit belleği ayrı (bellek girdisine yazılmaz).
  const derived = new Map();
  const extraOf = (party, extra) => {
    const plain = baseOf(party);
    if (!extra || extra.party !== party) return plain;
    const key = `${extra.entry.id}|${extra.entry.date}|${extra.entry.amount}|${extra.entry.createdAt}`;
    if (derived.has(key)) return derived.get(key);
    // Tur 2 hız: türetilmiş kurulum da (kesit belleğiyle) işlem DIŞINDA aynı veri durumunda çağrılar arasında paylaşılır (linkedMemoOf) — cari kartının listesi ile hemen ardından açılan
    // Değersiz Alacak Yaz formunun ucu aynı denemeleri yeniden kurmaz. Kesit SAF işlevdir (anahtar girdiyi taşır); işlem içinde bellek yok (bugünkü gibi).
    const memo = WRITE_OFF_TEST.exact ? null : linkedMemoOf(store);
    const shared = memo?.derived?.get(`${party}|${key}`);
    if (shared) {
      derived.set(key, shared);
      return shared;
    }
    const line = accountLedger([extra.entry]).lines[0];
    const base = { ...plain.base, lines: [...(plain.base.lines || []), line] };
    const sameDay = new Map();
    const dayOf = new Map();
    for (const item of base.lines) {
      if (!sameDay.has(item.date)) sameDay.set(item.date, []);
      sameDay.get(item.date).push(item);
      if (!dayOf.has(item.id)) dayOf.set(item.id, item.date);
    }
    const out = { base, dayOf, sameDay, cuts: new Map() };
    derived.set(key, out);
    memo?.derived?.set(`${party}|${key}`, out);
    return out;
  };
  const make = extra => (credit, view) => {
    const ref = String(credit.ref ?? credit.key ?? "");
    if (!ref.startsWith("account:") || !candidates.has(credit.party)) return null;
    // 2.5.1 M2 tur 2 (hız; dar kontrol DK-M2 YÜKSEK-1): varsayımsal satırın GÜNÜNDEN ÖNCEKİ günlerin kesiti varsayımsız kesitin AYNISIDIR — kesit yalnız kesit gününden önceki ve kesit
    // günündeki satırları alır (doubtfulBefore `kept`), varsayımsal satır sonraki bir gündedir; aynı gün sırası (rank) yalnız kesit gününün satırları arasında okunur. Bu günler varsayımsız
    // kurulumun kesit belleğinden okunur (denemenin bütün satırları için kuyruk yeniden kurulmaz). Eşdeğerlik test/supheli-degersiz-hiz-m2t2-251.test.mjs (WRITE_OFF_TEST.exact).
    if (extra && extra.party === credit.party && !WRITE_OFF_TEST.exact) {
      const plain = baseOf(credit.party);
      const day = plain.dayOf.get(ref.slice("account:".length));
      if (day && day < extra.entry.date) return linked(credit, view);
    }
    const entry = extraOf(credit.party, extra);
    const { base } = entry;
    const lineId = ref.slice("account:".length);
    const invoiceId = base.links.get(lineId);
    if (!invoiceId) return null;
    const include = line => {
      const key = refOfLine(line);
      return view.known?.has(key) ? view.done.has(key) : undefined;
    };
    // Kesit belleği (TEK ADAY HIZ, t3hiz): doubtfulBefore SAF işlevdir — sonucu girdi (bu kurulum), kesit satırı, aynı gün satırlarının include değeri ve açık kayıtların o anki kalanıyla
    // BELİRLİ; anahtar bu dördünü (kurulum = bellek girdisinin kendisi) taşır. Aynı veri durumunda iki yükleyici / birkaç çağıran (cari kartı, Mizan) kesiti bir kez kurar.
    const day = entry.dayOf.get(lineId);
    const cutKey = `${lineId}|${(entry.sameDay.get(day) || []).map(line => { const value = include(line); return value === true ? "1" : value === false ? "0" : "-"; }).join("")}|${JSON.stringify(view.open)}`;
    const known = entry.cuts.get(cutKey);
    if (known) return known;
    const held = doubtfulBefore({ ...base, doubtfulRecords: view.open }, { lineId, include });
    const out = Object.freeze((held.get(`inv:${invoiceId}`)?.records || []).map(item => Object.freeze({ ...item })));
    entry.cuts.set(cutKey, out);
    return out;
  };
  const linked = make(null);
  // withExtra: aynı kurulumla, varsayımsal satırı kuyruğa da ekleyen geri çağrı (yalnız Değersiz sınırı — writeOffLimitOf).
  Object.defineProperty(linked, "withExtra", { value: extra => make(extra) });
  return linked;
}

// TEK ADAY HIZ (t3hiz; ders 47 — docs/erp/C5-ACILIS-TASARIM.md §19.9): linkedShares'in cari başına kurulumu bir veri tabanı İŞLEMİNİN DIŞINDA, aynı veri durumunda çağrılar arasında paylaşılır.
// Anahtar şirketin store'u + total_changes() · data_version (lib/account-lines.mjs returnCuts, lib/obligation-input.mjs lockResolver ile AYNI kural): bu bağlantının her yazımı (store dışı
// db.prepare / exec dahil) total_changes'ı, başka bağlantının kesinleşen yazımı data_version'ı değiştirir. İşlem içinde (ya da açık kalmış işlemde) bellek ne okunur ne yazılır — geri alınan
// işlemde total_changes azalmaz (GG2). YALNIZ TEST: LINKED_MEMO_TEST.off belleği kapatır (eşdeğerlik testi bellekli ↔ belleksiz).
const LINKED_MEMO = new WeakMap();
export const LINKED_MEMO_TEST = { off: false };
function linkedMemoOf(store) {
  if (LINKED_MEMO_TEST.off || store.inTransaction || typeof store.changeCounters !== "function") return null;
  const counters = store.changeCounters();
  const stamp = `${counters.total}|${counters.version}`;
  let memo = LINKED_MEMO.get(store);
  if (!memo || memo.stamp !== stamp) {
    memo = { stamp, entries: new Map(), candidates: new Map(), derived: new Map() };
    LINKED_MEMO.set(store, memo);
  }
  return memo;
}

/** Kayıtlar + karşılıklar + SQL alacak satırlarıyla ayırma: { records, provisions, state, allocations }. */
export function doubtfulState(store, { parties = null } = {}) {
  const rows = doubtfulRows(store, { parties });
  const { records, provisions } = rows;
  if (!records.length) return { records, provisions, state: new Map(), allocations: new Map() };
  const credits = doubtfulCredits(store, new Set(records.map(record => record.party)));
  const { state, allocations } = allocateDoubtful({ records, provisions, credits, linked: rows.linked || null });
  return { records, provisions, state, allocations };
}

// ---------- 2.5.1 M2 — Değersiz Alacak sınırı (TEK işlev; tasarım docs/devir/2.5.1-DEVAM/m2-rapor.md §0b) ----------
// KARARLAR (karar girdisi docs/devir/2.5.1-DEVAM/m2-kararlar.md §1 AYNEN): S264 = A "Değersiz sınırı aynı günün sırasına uysun — Değersiz o günün bağlı payından önce, tam tutar kabul";
// S269 = A "S264 sınırı 'kayıt kapalı' denetiminden ÖNCE de uygulanır (Değersiz Yaz ve Silinenler'den geri yükleme); bu kayıtlarda düğme görünür; ipucu ve önerilen tutar sınırı gösterir";
// S268 = A "… üst sınır ipucu / önerilen tutar S264 sınırını göstersin"; S270 = A değişmez "hiçbir sırada bir şüpheli kaydın Değersiz toplamı, o kayda şüpheliye alınan tutardan kayda düşmüş
// tahsilatlar çıkınca kalanı aşamaz; Değersiz yazımı cariyi alacaklıya (eksi bakiyeye) düşürmez"; S-M2-1 = B "Değersiz o günün tarihiyle yazılırsa o günün bağlı payından önce değerlendirilir
// (S264); sonraki bir tarihle yazılırsa önceki günlerin bağlı payı düşülmüş kalan kadar yazılabilir"; SK-55 = C (aynı gün bağlı → bağsız → Şüpheliye Al sırasında payın ölçüm anı BİLİNEN
// SINIR — bugünkü davranış). BAŞ MİMAR (kâhin Y30-6): ekranın önerdiği tutar her zaman kabul edilir → öneri = sınır ile S155'in izin verdiğinin küçüğü.
// Liste ('yazılabilir' alanı), Değersiz Yaz, Silinenler'den geri yükleme ve formun uç noktası BU işlevleri okur. Ayırıcı (lib/doubtful-gl.mjs allocateDoubtful) ve kuyruk kesiti DEĞİŞMEDİ.
const WRITE_OFF_HYP = "m2-varsayimsal-degersiz";
const WRITE_OFF_LAST_AT = "9999-12-31T23:59:59.999Z";
// 2.5.1 M2 tur 2 (hız; dar kontrol DK-M2 YÜKSEK-1 — liste ve form ucu bağlı tahsilat GÜNÜ sayısıyla doğrusaldan hızlı büyüyordu): sınırın SONUCU değişmez, yalnız hesap kısalır. Üç kısaltma
// (her birinin gerekçesi ilgili işlevin notunda; tasarım ve kanıt docs/devir/2.5.1-DEVAM/m2t2-rapor.md §1):
//   (1) writeOffLimitOf — yeni satırdan SONRA sıralanan Değersiz satırı yoksa deneme gerekmez (sınır = üst uç); S155 denemesi önce bağlı satırsız üst sınırla.
//   (2) writeOffDays — aday günler sırayla, F(S, D) günle ARTMADIĞINDAN sonucu değiştiremeyecek günler hesaplanmaz.
//   (3) linkedShares.withExtra — varsayımsal satırın gününden önceki kesitler varsayımsız bellekten.
// YALNIZ TEST: WRITE_OFF_TEST.exact = true üçünü kapatır (tur 1'in tam hesabı — eşdeğerlik hakemi; test/supheli-degersiz-hiz-m2t2-251.test.mjs).
// count (YALNIZ TEST): { quotes, trials } — liste / uç başına hesap sayısı (hız gerilemesini süre yerine iş sayısıyla yakalayan dişli test; null iken sayılmaz).
export const WRITE_OFF_TEST = { exact: false, count: null };
/** Carinin Değersiz sınırı bağlamı: okuma (SQL) BİR kez; tam ayırma; bağlı satır kümesi (`linked` dizi döndürdü); dışarı taşan Değersiz tutarları (taban). */
export function writeOffContextOf(store, party) {
  const rows = doubtfulRows(store, { parties: [party] });
  const credits = rows.records.length ? doubtfulCredits(store, new Set([party])) : [];
  const bound = new Set();
  const linked = rows.linked
    ? (credit, view) => {
        const out = rows.linked(credit, view);
        if (out) bound.add(credit.key);
        return out;
      }
    : null;
  const full = allocateDoubtful({ records: rows.records, provisions: rows.provisions, credits, linked });
  const outside = new Map();
  for (const [key, hit] of full.allocations) if ((hit.outsideMinor || 0) > 0) outside.set(key, hit.outsideMinor);
  // rooms: F(S, D) belleği (gün başına bir ayırma; aynı bağlamın liste / ileti / form okumaları paylaşır — tur 2 hız).
  return { party, rows, credits, bound, full, outside, rooms: new Map() };
}
/** D gününe ve sonrasına ait bağlı satırlar çıkarılmış alacak satırları (F(S, D)'nin ve S155 üst sınırının dünyası). */
const creditsBefore = (ctx, date) => ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date >= date));
/** F(S, D): D gününe ve sonrasına ait bağlı satırlar yokken kaydın sondaki kalanı (S264 + S-M2-1 = B + S270 "sonradan gelen bağsız" ve "sonraki Değersiz satırları"). */
function writeOffRoomBefore(ctx, recordId, date) {
  const credits = creditsBefore(ctx, date);
  if (credits.length === ctx.credits.length) return ctx.full.state.get(recordId)?.remaining ?? 0;
  // Gün başına ayırma bir kez (bütün kayıtların kalanı aynı ayırmadan — kayıt kimliği anahtarda değil).
  const memo = ctx.rooms && !WRITE_OFF_TEST.exact ? ctx.rooms : null;
  let state = memo?.get(date);
  if (!state) {
    ({ state } = allocateDoubtful({ records: ctx.rows.records, provisions: ctx.rows.provisions, credits, linked: ctx.rows.linked || null }));
    memo?.set(date, state);
  }
  return state.get(recordId)?.remaining ?? 0;
}
/**
 * S155 denemesinin ÜST SINIRI (tur 2 hız): varsayımsal satırla, D gününe ve sonrasına ait bağlı satırlar ÇIKARILMIŞ dünyada açık şüpheli toplamı (A dünyası). Gerçek deneme (B) A'ya göre
 * yalnız o bağlı satırları FAZLADAN taşır; ayırıcının her olayı kalanı yalnız küçültür ya da sıfırlar ve aynı başlangıçta küçük kalan küçük kalır (alacak satırı en eski açık kayıttan sırayla,
 * bağlı satır payı kadar, Değersiz kalan kadar, çıkarma sıfırlar, karşılık kalana dokunmaz) — D'den önce iki dünya aynıdır (D'den önceki kesitler varsayımlı satırı görmez). Bu yüzden her
 * kaydın B kalanı ≤ A kalanı: açık_B ≤ açık_A. A'da "kayıttan sonra borç ≥ açık şüpheli" sağlanıyorsa B'de de sağlanır (deneme gerekmez); D'den sonra bağlı satır yoksa A = B (kesin).
 */
function writeOffOpenUpper(ctx, record, date, minor, at) {
  const key = `account:${WRITE_OFF_HYP}`;
  const credits = [...creditsBefore(ctx, date), { key, ref: key, party: ctx.party, date, minor, target: record.id, openedOn: "", at, seq: Infinity }];
  const { state } = allocateDoubtful({ records: ctx.rows.records, provisions: ctx.rows.provisions, credits, linked: ctx.rows.linked || null });
  let openMinor = 0;
  for (const s of state.values()) openMinor += Math.max(0, s.remaining);
  return openMinor;
}
/** Varsayımsal satırdan (gün D, yazım anı at) SONRA sıralanan Değersiz satırı var mı (ayırıcının sırası: gün → sınıf → yazım anı; eşit anda koruyucu: VAR sayılır). */
const targetAfter = (ctx, date, at) => ctx.credits.some(credit => credit.target && (credit.date > date || (credit.date === date && String(credit.at || "￿") >= String(at))));
/** Varsayımsal Değersiz (kayıt, gün, tutar, yazım anı) eklenmiş ayırma: satır sığıyor mu, öbür Değersiz satırları taşıyor mu, açık şüphelinin yeni toplamı. */
function writeOffTrial(ctx, record, date, minor, at) {
  if (WRITE_OFF_TEST.count) WRITE_OFF_TEST.count.trials += 1;
  const key = `account:${WRITE_OFF_HYP}`;
  // Kuyruk satırının tutarı denemeye göre değişir → türetilmiş girdi tutar başına (linkedShares içinde kimlik · gün · tutar · anla anahtarlı; kurulum paylaşılır).
  const linked = ctx.rows.linked?.withExtra ? ctx.rows.linked.withExtra({ party: ctx.party, entry: { id: WRITE_OFF_HYP, kind: "credit", amount: fromMinor(minor), date, source: "doubtful", sourceId: record.id, createdAt: at } }) : null;
  const credits = [...ctx.credits, { key, ref: key, party: ctx.party, date, minor, target: record.id, openedOn: "", at, seq: Infinity }];
  const out = allocateDoubtful({ records: ctx.rows.records, provisions: ctx.rows.provisions, credits, linked });
  const hit = out.allocations.get(key);
  let grows = false;
  for (const [other, item] of out.allocations) if (other !== key && (item.outsideMinor || 0) > (ctx.outside.get(other) || 0)) grows = true;
  let openMinor = 0;
  for (const s of out.state.values()) openMinor += Math.max(0, s.remaining);
  return { fits: Boolean(hit) && !((hit.outsideMinor || 0) > 0) && !grows, openMinor };
}
/** En büyük X ∈ [0, hi] (test(X) X büyüdükçe yalnız bozulur): önce üst uç, sonra kuruş kuruş ikili arama. */
function largestPassing(hi, test) {
  if (hi <= 0) return 0;
  if (test(hi)) return hi;
  let lo = 0;
  let top = hi;
  while (top - lo > 1) {
    const mid = Math.floor((lo + top) / 2);
    if (test(mid)) lo = mid;
    else top = mid;
  }
  return lo;
}
/**
 * Sınır(S, D) ve önerilen tutar (kuruş): sınır = F(S, D), bakiye ve S270 güvenlik denetimini (satır sığar, öbür Değersiz satırları taşmaz) sağlayan en büyük tutar; öneri = sınır ile S155'in
 * (kayıttan sonra carinin borcu açık şüphelinin altına düşemez — kapının doubtful:balance kuralı) izin verdiğinin küçüğü. why: sınırı ne belirledi (iletiler). at: yazım anı (geri yüklemede
 * satırın kendi anı; yoksa en son).
 */
export function writeOffLimitOf(ctx, record, date, { balanceMinor, at = WRITE_OFF_LAST_AT } = {}) {
  if (WRITE_OFF_TEST.count) WRITE_OFF_TEST.count.quotes += 1;
  const state = ctx.full.state.get(record.id);
  if (record.status !== "open" || !state) return { date, limitMinor: 0, offerMinor: 0, why: "closed", remainingMinor: 0, roomMinor: 0 };
  const room = Math.max(0, writeOffRoomBefore(ctx, record.id, date));
  const balance = Number(balanceMinor) || 0;
  const cap = Math.max(0, Math.min(room, balance));
  const trials = new Map();
  const trial = minor => {
    if (!trials.has(minor)) trials.set(minor, writeOffTrial(ctx, record, date, minor, at));
    return trials.get(minor);
  };
  // Tur 2 hız (1a): yeni satırdan SONRA sıralanan Değersiz satırı yoksa her X ≤ üst uç sığar — üst uç ≤ F(S, D) ≤ kaydın D anındaki kalanı (D'den önceki olaylar üç dünyada aynı; sonraki
  // olaylar kalanı yalnız küçültür), yeni satır o anda kalan kadar düşer (taşmaz); taşabilecek başka Değersiz satırı da yok ("grows" yalnız SONRA gelen hedefli satırda oluşur). Deneme gereksiz.
  const quick = !WRITE_OFF_TEST.exact;
  const fits = quick && !targetAfter(ctx, date, at) ? () => true : minor => trial(minor).fits;
  const limitMinor = largestPassing(cap, fits);
  // Tur 2 hız (1b): S155 — önce üst sınır (writeOffOpenUpper); sağlanıyorsa gerçek deneme de sağlar; D'den sonra bağlı satır yoksa üst sınır gerçeğin kendisidir.
  const boundLater = ctx.credits.some(credit => ctx.bound.has(credit.key) && credit.date >= date);
  const passes = (minor, openMinor) => openMinor <= 0 || balance - minor - openMinor >= 0;
  const offerMinor = largestPassing(limitMinor, minor => {
    if (quick) {
      const upper = writeOffOpenUpper(ctx, record, date, minor, at);
      if (passes(minor, upper) || !boundLater) return passes(minor, upper);
    }
    return passes(minor, trial(minor).openMinor);
  });
  const why = limitMinor < cap ? "later" : cap < room ? "balance" : room > state.remaining ? "sameDay" : "remaining";
  return { date, limitMinor, offerMinor, why, s155: offerMinor < limitMinor, remainingMinor: state.remaining, roomMinor: room };
}
const nextDay = iso => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/**
 * Formun ve listenin aday günleri: ilk açık gün (kayıt günü; kilitliyse kilidin ertesi), bugün ve aradaki bağlı satır günleri (sınır yalnız bu günlerde değişebilir — bağlı satır yoksa F günden
 * bağımsızdır). Dönüş: { today, first, best } (best = en çok önerilen; eşitlikte en erken gün) — kilitli / ileri gün aday değildir.
 */
export function writeOffDays(ctx, record, { today, lockedUntil = "", balanceMinor }) {
  const first = lockedUntil && lockedUntil >= record.date ? nextDay(lockedUntil) : record.date;
  if (record.status !== "open" || first > today) return { today: null, first: null, best: null };
  const days = new Set([first, today]);
  for (const credit of ctx.credits) if (ctx.bound.has(credit.key) && credit.date > first && credit.date < today) days.add(credit.date);
  const sorted = [...days].sort();
  // Seçim kuralı (tur 1 AYNEN): gün sırasıyla; öneri büyük olan, öneri eşitse sınırı büyük olan; tam eşitlikte en erken gün. anyMinor = en büyük sınır.
  const out = quotes => ({ today: quotes[quotes.length - 1].date === today ? quotes[quotes.length - 1] : null, first: quotes[0], best: chooseWriteOffQuote(quotes), anyMinor: Math.max(...quotes.map(quote => quote.limitMinor)) });
  const quoteOf = day => writeOffLimitOf(ctx, record, day, { balanceMinor });
  if (WRITE_OFF_TEST.exact || sorted.length <= 2) return out(sorted.map(quoteOf));
  return out(pickWriteOffQuotes(sorted, quoteOf, day => writeOffRoomBefore(ctx, record.id, day), balanceMinor));
}
/** Seçim kuralı (tur 1 AYNEN): gün sırasıyla; öneri büyük olan, öneri eşitse sınırı büyük olan; tam eşitlikte en erken gün. */
export function chooseWriteOffQuote(quotes) {
  let best = quotes[0];
  for (const quote of quotes) if (quote.offerMinor > best.offerMinor || (quote.offerMinor === best.offerMinor && quote.limitMinor > best.limitMinor)) best = quote;
  return best;
}
/**
 * Tur 2 hız (2) — SAF işlev (birim testi: test/supheli-degersiz-hiz-m2t2-251.test.mjs, rastgele tablolarla tam taramaya karşı): aday günler (artan) için hesaplanması GEREKEN teklifler, gün sırasıyla.
 * Gün d'nin sınırı ≤ üst ucu cap(d) = min(F(S, d), bakiye) ve öneri ≤ sınır. F(S, d) gün ilerledikçe ARTMAZ: d₂ > d₁ dünyası d₁ dünyasına yalnız [d₁, d₂) günlerinin bağlı satırlarını EKLER;
 * d₁'den önce iki dünya aynı, eklenen satırlar kalanı yalnız küçültür ve ayırıcının her olayı (sırayla alacak, bağlı pay, Değersiz, çıkarma, karşılık) küçük kalanı küçük bırakır → cap(d)
 * öncekilerin cap'inden büyük olamaz. Gün d seçimi ve anyMinor'u DEĞİŞTİREMEZ: cap(d) < en iyinin önerisi; ya da cap(d) = en iyinin önerisi ve (en iyinin sınırı > cap(d) ya da en iyi d'den
 * önceki gün). Bu koşul bir günde sağlanırsa sonraki her günde de sağlanır (cap artmaz, en iyi yalnız iyileşir, tarih ilerler) → tarama durur. İlk gün ve bugün her zaman hesaplanır.
 * quoteOf(gün) → { date, limitMinor, offerMinor, roomMinor }; roomOf(gün) → F(S, gün).
 */
export function pickWriteOffQuotes(days, quoteOf, roomOf, balanceMinor) {
  const quotes = new Map([[days[0], quoteOf(days[0])], [days[days.length - 1], quoteOf(days[days.length - 1])]]);
  const known = () => days.filter(day => quotes.has(day)).map(day => quotes.get(day));
  const balance = Number(balanceMinor) || 0;
  const capOf = room => Math.max(0, Math.min(Math.max(0, room ?? 0), balance));
  const idle = (cap, day) => {
    const best = chooseWriteOffQuote(known());
    return cap < best.offerMinor || (cap === best.offerMinor && (best.limitMinor > cap || best.date < day));
  };
  let upper = capOf(quotes.get(days[0]).roomMinor);
  for (const day of days.slice(1, -1)) {
    if (idle(upper, day)) break;
    upper = capOf(roomOf(day));
    if (idle(upper, day)) break;
    quotes.set(day, quoteOf(day));
  }
  return known();
}

/** Ana Defter'in beklenenleri (routes/ledger.mjs expected): 128 = Σ kalan; 129 = −Σ karşılık; kontrol hesabı (120/320/336) başına düşülecek kalan. */
export function doubtfulExpected(store) {
  const { records, state } = doubtfulState(store);
  let openMinor = 0;
  let provisionMinor = 0;
  const byControl = new Map();
  for (const record of records) {
    const s = state.get(record.id);
    if (!s) continue;
    openMinor += s.remaining;
    provisionMinor += s.provision;
    byControl.set(record.control, (byControl.get(record.control) || 0) + s.remaining);
  }
  return { openMinor, provisionMinor, byControl };
}

/**
 * Mutabakat denetimi doubtful:records (§3.11b/4): kuralları bozan kayıtlar [{ key, sample }] — her etkin kaydın etkin başlığı (tür, cari, tarih,
 * tutar), çıkarılmış kaydın kapanış başlığı (tarih ≥ kayıt), etkin karşılığın kaydı ve başlığı, Değersiz Alacak satırının kaydı/carisi/başlığı,
 * her etkin şüpheli başlığının kaydı; silinmiş carinin kaydı. parties: yalnız bu cariler (dokunulan varlıklar).
 */
export function doubtfulProblems(store, { parties = null } = {}) {
  if (!hasDoubtful(store)) return [];
  const list = parties ? JSON.stringify([...parties]) : null;
  if (list === "[]") return [];
  const where = list ? "d.account_id IN (SELECT value FROM json_each(?))" : "1";
  const args = list ? [list] : [];
  const out = [];
  const fail = (key, sample) => out.push({ key, sample });
  const header = (id, type) => (id ? store.get("SELECT id, type, status, src_table AS srcTable, src_id AS srcId, party_id AS partyId, date, try_minor AS tryMinor FROM fin_events WHERE id = ?", id) : null);
  for (const row of store.all(`${RECORD_SQL} WHERE ${where} AND +d.status <> 'cancelled'`, ...args)) {
    const tag = `${row.id} (${row.accountName || row.party})`;
    if (!["open", "released"].includes(row.status)) fail(`${row.id}:status`, `${tag}: tanınmayan durum ${row.status}`);
    if (!(Number(row.amountMinor) > 0)) fail(`${row.id}:amount`, `${tag}: tutar sıfır ya da eksi`);
    if (row.accountDeletedAt || !row.accountType) fail(`${row.id}:account`, `${tag}: carisi silinmiş ya da yok; şüpheli kaydı defterden düştü`);
    const head = header(row.eventId);
    if (!head || head.type !== "doubtful_take" || head.status !== "active" || head.srcTable !== "doubtful_receivables" || head.srcId !== row.id || head.partyId !== row.party || head.date !== row.date || Number(head.tryMinor) !== Number(row.amountMinor)) {
      fail(`${row.id}:event`, `${tag}: Şüpheli Alacağa Al başlığı yok, etkin değil ya da kayıtla uyuşmuyor`);
    }
    if (row.status === "released") {
      const close = header(row.closeEventId);
      if (!row.closedDate || row.closedDate < row.date || !close || close.type !== "doubtful_release" || close.status !== "active" || close.srcId !== row.id || close.date !== row.closedDate) fail(`${row.id}:close`, `${tag}: Şüpheliden Çıkar başlığı ya da kapanış tarihi eksik/uyuşmuyor`);
    } else if (row.closedDate || row.closeEventId) fail(`${row.id}:open`, `${tag}: açık kaydın kapanışı dolu`);
  }
  for (const row of store.all(
    `${PROVISION_SQL} JOIN doubtful_receivables d ON d.id = p.doubtful_id WHERE ${where} AND +p.status = 'active'`,
    ...args,
  )) {
    const record = store.get("SELECT id, date, status FROM doubtful_receivables WHERE id = ?", row.recordId);
    const head = header(row.eventId);
    if (!record || record.status === "cancelled") fail(`${row.id}:record`, `karşılık ${row.id}: kaydı yok ya da iptal edilmiş`);
    else if (row.date < record.date) fail(`${row.id}:date`, `karşılık ${row.id}: tarihi (${dayText(row.date)}) kaydın tarihinden (${dayText(record.date)}) önce`);
    if (!(Number(row.amountMinor) > 0)) fail(`${row.id}:amount`, `karşılık ${row.id}: tutar sıfır ya da eksi`);
    if (!head || head.type !== "doubtful_provision" || head.status !== "active" || head.srcTable !== "doubtful_provisions" || head.srcId !== row.id || head.date !== row.date || Number(head.tryMinor) !== Number(row.amountMinor)) fail(`${row.id}:event`, `karşılık ${row.id}: başlığı yok ya da uyuşmuyor`);
  }
  if (hasTable(store, "account_entries")) {
    for (const row of store.all(
      `SELECT e.id, e.account_id AS party, e.kind, e.date, CAST(ROUND(e.amount * 100) AS INTEGER) AS minor, e.source_id AS recordId, d.id AS did, d.status, d.date AS recordDate, d.account_id AS recordParty
       FROM account_entries e LEFT JOIN doubtful_receivables d ON d.id = e.source_id
       WHERE +e.source = 'doubtful'${list ? " AND e.account_id IN (SELECT value FROM json_each(?))" : ""}`,
      ...args,
    )) {
      if (!row.did || row.status === "cancelled") fail(`${row.id}:record`, `Değersiz Alacak satırı ${row.id}: kaydı yok ya da iptal edilmiş`);
      else if (row.recordParty !== row.party) fail(`${row.id}:party`, `Değersiz Alacak satırı ${row.id}: kaydın carisi başka`);
      else if (row.date < row.recordDate) fail(`${row.id}:date`, `Değersiz Alacak satırı ${row.id}: tarihi kaydın tarihinden önce`);
      if (row.kind !== "credit") fail(`${row.id}:kind`, `Değersiz Alacak satırı ${row.id}: alacak satırı değil (${row.kind})`);
      const head = store.get("SELECT status, date, try_minor AS tryMinor FROM fin_events WHERE type = 'doubtful_writeoff' AND src_table = 'account_entries' AND src_id = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END LIMIT 1", row.id);
      if (!head || head.status !== "active" || head.date !== row.date || Number(head.tryMinor) !== Number(row.minor)) fail(`${row.id}:event`, `Değersiz Alacak satırı ${row.id}: başlığı yok, etkin değil ya da uyuşmuyor`);
    }
  }
  // Kaydı olmayan (ya da kaydı kendisini göstermeyen) etkin şüpheli başlıkları.
  for (const row of store.all(
    `SELECT e.id, e.no, e.type, e.src_table AS srcTable, e.src_id AS srcId FROM fin_events e
     WHERE e.type IN ('doubtful_take', 'doubtful_release', 'doubtful_provision', 'doubtful_writeoff') AND +e.status = 'active'${list ? " AND e.party_id IN (SELECT value FROM json_each(?))" : ""}
       AND NOT EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.id = e.src_id AND d.status <> 'cancelled' AND ((e.type = 'doubtful_take' AND d.event_id = e.id) OR (e.type = 'doubtful_release' AND d.close_event_id = e.id)))
       AND NOT EXISTS (SELECT 1 FROM doubtful_provisions p WHERE e.type = 'doubtful_provision' AND p.id = e.src_id AND p.status = 'active' AND p.event_id = e.id)
       AND NOT EXISTS (SELECT 1 FROM account_entries x WHERE e.type = 'doubtful_writeoff' AND x.id = e.src_id AND x.source = 'doubtful')`,
    ...args,
  )) fail(`${row.id}:orphan`, `${row.no}: şüpheli alacak başlığının (${row.type}) kaydı yok ya da kayıt başka başlığı gösteriyor`);
  // Türetilmiş durum (yargıç 2.3.0 #2, #3, #8; 15.10.2026): kayıt bazında karşılık ≤ kalan (K5/K6) ve kapanan kayıtta karşılık 0; Değersiz Alacak
  // satırı kaydın kalanı içinde (K7 sonradan da: değersiz satırından önceye düşen geriye tarihli tahsilat satırı kayıt dışına taşırırdı — A 120 /
  // B 659, 120 eksi); Şüpheliden Çıkar başlığının tutarı yevmiyedeki çıkarılan tutar (çıkarma gününden önceye düşen tahsilat kalanı değiştirirdi).
  // Tam kapı ve dokunulan yol (lib/integrity-scope.mjs) aynı denetimi koşar: bozan yazım 409 ile reddedilir.
  const derived = doubtfulState(store, { parties });
  for (const record of derived.records) {
    const s = derived.state.get(record.id);
    if (!s) continue;
    const tag = `${record.id} (${record.accountName || record.party})`;
    if (s.provision > s.remaining) fail(`${record.id}:provision`, `${tag}: karşılık (${tl(s.provision)}) kalanı (${tl(s.remaining)}) aşıyor`);
    if (s.remaining <= 0 && s.provision > 0) fail(`${record.id}:provision-left`, `${tag}: kayıt kapandı, karşılık (${tl(s.provision)}) 129'da kaldı`);
    if (record.status === "released" && record.closeEventId) {
      const close = header(record.closeEventId);
      // Başlık çıkarma günündeki yazım sırasına göre o günün (günün sonunda sayılan) tahsilatlarının bir kısmını içerebilir: tolerans
      // [çıkarılan, çıkarılan + o gün düşen]; önceki güne düşen geriye tarihli tahsilat tolerans dışıdır (yargıç G).
      if (close && (Number(close.tryMinor) < s.released || Number(close.tryMinor) > s.released + (s.collectedOnCloseDay || 0))) fail(`${record.id}:close-amount`, `${tag}: Şüpheliden Çıkar başlığı ${tl(close.tryMinor)}, yevmiyedeki çıkarılan ${tl(s.released)} (çıkarma gününden önceye düşen tahsilat kalanı değiştirirdi); tahsilatı çıkarma gününden sonraya yazın ya da kaydı silip yeniden alın`);
    }
  }
  for (const [key, hit] of derived.allocations) {
    if ((hit.outsideMinor || 0) > 0) fail(`${key}:outside`, `Değersiz Alacak satırı ${key.replace(/^account:/, "")}: kaydın kalanını ${tl(hit.outsideMinor)} aşıyor (değersiz satırından önceye düşen tahsilat kalanı küçülttü); tahsilatı değersiz satırından sonraki tarihe yazın ya da önce değersiz satırını silin`);
  }
  // 2.5.1 M2 — S270 değişmezi (yazım sırasını okuyan iki koşul; writeOffInvariantProblems'in notu).
  for (const item of writeOffInvariantProblems(store, { parties })) out.push(item);
  return out;
}

/**
 * 2.5.1 M2 — S270 = A DEĞİŞMEZİ (Mutabakat Testi + kapı; doubtfulProblems'in parçası). Karar AYNEN: "hiçbir sırada bir şüpheli kaydın Değersiz toplamı, o kayda şüpheliye alınan tutardan kayda
 * düşmüş tahsilatlar çıkınca kalanı aşamaz; Değersiz yazımı cariyi alacaklıya (eksi bakiyeye) düşürmez." Değersiz'in sınırı yazım SIRASINA bağlıdır (aynı son durum meşru sırayla da — Değersiz'den
 * SONRA gelen avans — bozuk sırayla da — önce yazılmış sonraki tarihli bağsız tahsilat — oluşur), bu yüzden denetim yazım sırasını (created_at → rowid; ders 31) ve satırın sonradan
 * değiştirilmesini (updated_at; evrakta cheques.updated_at) okur:
 *   (i)  her Değersiz satırı W, YAZILDIĞI ANDAKİ dünyada sınırı aşmaz: W'den sonra yazılmış Değersiz satırları yok, W gününe ve sonrasına ait faturaya bağlı satırlar yok (S264), W gününe ve
 *        sonrasına ait bağsız satırlardan yalnız W'den ÖNCE yazılmış ve sonradan değişmemiş olanlar var (S270 "sonradan gelen bağsız tahsilat"); kaydın kalanı W'yi karşılar.
 *   (ii) carinin bakiyesi eksi, son işlemi bir Değersiz satırı ve o satırdan sonra cari için başka yazım / değişiklik / silme / geri yükleme yok → Değersiz cariyi eksiye düşürmüş.
 * Eski sürümden gelen ihlal kapının taban kuralıyla (sayı büyümedikçe) yazımı engellemez; Mutabakat Testi'nde görünür.
 */
export function writeOffInvariantProblems(store, { parties = null } = {}) {
  if (!hasTable(store, "account_entries")) return [];
  const list = parties ? JSON.stringify([...parties]) : null;
  if (list === "[]") return [];
  const lines = store.all(
    `SELECT e.id, e.account_id AS party, e.source_id AS recordId, e.date, CAST(ROUND(e.amount * 100) AS INTEGER) AS minor, COALESCE(e.created_at, '') AS at, e.rowid AS seq
     FROM account_entries e WHERE +e.source = 'doubtful' AND e.kind = 'credit'${list ? " AND e.account_id IN (SELECT value FROM json_each(?))" : ""} ORDER BY e.account_id, e.created_at, e.rowid`,
    ...(list ? [list] : []),
  );
  if (!lines.length) return [];
  const out = [];
  const byParty = new Map();
  for (const line of lines) {
    if (!byParty.has(line.party)) byParty.set(line.party, []);
    byParty.get(line.party).push(line);
  }
  const has = name => hasTable(store, name);
  for (const [party, own] of byParty) {
    const ctx = writeOffContextOf(store, party);
    const records = new Map(ctx.rows.records.map(record => [record.id, record]));
    const openWorld = ctx.rows.records.map(record => (record.status === "released" ? { ...record, status: "open", closedDate: "" } : record));
    // Satırın son değişme anı (yalnız sonradan değişen satırlar): cari satırı updated_at; evrak satırında evrakın updated_at'i; taksit tahsilatı updated_at; fatura updated_at / issued_at.
    const changed = new Map();
    for (const row of store.all(`SELECT e.id, COALESCE(e.updated_at, '') AS u${has("cheques") ? ", COALESCE((SELECT c.updated_at FROM cheques c WHERE e.source = 'cheque' AND c.id = e.source_id), '') AS c" : ", '' AS c"} FROM account_entries e WHERE e.account_id = ?`, party)) {
      const at = row.u > row.c ? row.u : row.c;
      if (at) changed.set(`account:${row.id}`, at);
    }
    if (has("plans") && has("plan_entries")) for (const row of store.all("SELECT pe.id, COALESCE(pe.updated_at, '') AS u FROM plans p JOIN plan_entries pe ON pe.plan_id = p.id WHERE p.account_id = ? AND pe.updated_at IS NOT NULL", party)) if (row.u) changed.set(`plan-entry:${row.id}`, row.u);
    if (has("invoices")) for (const row of store.all("SELECT id, COALESCE(updated_at, '') AS u FROM invoices WHERE account_id = ? AND updated_at IS NOT NULL", party)) if (row.u) changed.set(`invoice:${row.id}`, row.u);
    // 2.5.1 M2 tur 2 (S-DKM2-2 = A; dar kontrol DK-M2 ORTA-2 — v2.5.0 verisinde YANLIŞ kırmızı): BAĞLI OLDUĞU FATURA SONRADAN İPTAL EDİLEN (ya da silinen — silme iptal eder) tahsilat da
    // "sonradan değişmiş" sayılır. İptal bağı (invoice_id / evrak olayının bağı) satırın kendisine iz bırakmadan siler; hangi bağsız satırın o faturaya bağlı olduğu veride ayırt edilemez → carinin
    // satış faturasının son iptal / silinme anından ÖNCE yazılmış bugün bağsız her tahsilat o anda değişmiş sayılır. Gevşeme yalnız satır ÇIKARIR (W'nin dünyası küçülür, sınır büyür) —
    // yeni kırmızı üretmez; bedeli m2t2-rapor.md BİLİNEN SINIR (iptal edilen faturayla ilgisiz eski bağsız tahsilat da W'nin dünyasından çıkar).
    const lastUnbond = [
      has("invoices") ? store.get("SELECT MAX(cancelled_at) AS at FROM invoices WHERE account_id = ? AND status = 'cancelled' AND kind IN ('sale', 'smm') AND COALESCE(cancelled_at, '') <> ''", party)?.at || "" : "",
      has("trash") ? store.get("SELECT MAX(deleted_at) AS at FROM trash WHERE kind = 'invoice' AND instr(payload_json, ?) > 0", party)?.at || "" : "",
    ].sort().pop();
    if (lastUnbond) {
      for (const row of store.all("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND invoice_id = '' AND source <> 'invoice' AND COALESCE(created_at, '') <= ?", party, lastUnbond)) {
        const key = `account:${row.id}`;
        if (!((changed.get(key) || "") >= lastUnbond)) changed.set(key, lastUnbond);
      }
    }
    const writtenAfter = (credit, line) => (credit.at > line.at) || (credit.at === line.at && String(credit.key).startsWith("account:") && Number(credit.seq) > Number(line.seq));
    // (i)
    for (const line of own) {
      const record = records.get(line.recordId);
      if (!record || record.status === "cancelled") continue;
      const key = `account:${line.id}`;
      const credits = ctx.credits.filter(credit => {
        if (credit.key === key) return false;
        if (credit.target) return !writtenAfter(credit, line);
        if (credit.date < line.date) return true;
        if (ctx.bound.has(credit.key)) return false;
        return !writtenAfter(credit, line) && !((changed.get(credit.key) || "") >= line.at);
      });
      // Şüpheliden Çıkar Değersiz'den SONRA gelir (çıkarılmış kayda Değersiz yazılmaz): W'nin yazıldığı andaki dünyada kayıtlar açıktır — çıkarma kalanı sıfırlamaz.
      const { state } = allocateDoubtful({ records: openWorld, provisions: ctx.rows.provisions, credits, linked: ctx.rows.linked || null });
      const room = Math.max(0, state.get(record.id)?.remaining ?? 0);
      // figure: kapı reddinin anlaşılır iletisi için (lib/integrity.mjs doubtfulText — 2.5.1 M2 tur 2).
      if (line.minor > room) out.push({ key: `${line.id}:writeoff-limit`, sample: `Değersiz Alacak satırı ${dayText(line.date)} ${tl(line.minor)}: yazıldığı andaki sınırı (${tl(room)}) aşıyor — kaydın kalanından önce yararlanan bağsız tahsilat düşülmeden yazılmış (S270)`, figure: { kind: "writeoff-limit", date: line.date, minor: line.minor, roomMinor: room } });
    }
    // (ii)
    const last = own[own.length - 1];
    const balance = ledgerBalanceMinor(store, party);
    if (balance < 0 && !activityAfter(store, party, last)) out.push({ key: `${party}:writeoff-balance`, sample: `Değersiz Alacak satırı ${dayText(last.date)} ${tl(last.minor)} cariyi eksi bakiyeye (${tl(balance)}) düşürdü (S270)`, figure: { kind: "writeoff-balance", date: last.date, minor: last.minor, balanceMinor: balance } });
  }
  return out;
}
/** Carinin defter bakiyesi (kuruş): cari kartının satırlarıyla aynı kaynak (lib/accounts.mjs accountLedger; borç − alacak). */
export function ledgerBalanceMinor(store, party) {
  const lines = createAccountLines({ store });
  const ledger = createObligationInput({ store }).ledgerLines({ ids: [party], plans: lines.ledgerPlansOf([party]) }).get(party) || [];
  let sum = 0;
  for (const line of ledger) sum += Math.round((Number(line.debit) || 0) * 100) - Math.round((Number(line.credit) || 0) * 100);
  return sum;
}
/**
 * 2.5.1 M2 tur 2 — S-DKM2-2 = A (dar kontrol DK-M2 ORTA-2; 27.11 23:47 UTC KULLANICI KARARIYLA ÖNERİ UYGULANDI — 20:26 yetkisi, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar
 * önerilerini uygula"): "Değersiz Alacak yazıldıktan sonra faturanın iptali ya da iadesi cariyi eksiye düşürüyorsa … A (ÖNERİ): iptal de iade de reddedilsin — ileti 'önce Değersiz Alacak satırını
 * silin (en çok … yazılabilirdi)'". Fatura iptali (silme, e-Belge iptali ve Banka'dan Ters Kaydet iptali çağırır) ve satıştan iade (yeni ya da düzenlenen) bu denetimi işlemin İÇİNDE çağırır:
 * başta guard = writeOffBalanceGuard(store, cari), yazımlardan sonra guard?.check(). Ret koşulu: işlem bakiyeyi DÜŞÜRDÜ ve sonuç EKSİ.
 * 2.5.1 M2 tur 3 — S-M2T2-1 = A (28.11 01:54 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi; AYNEN: "Değersiz Alacak yazıldıktan sonra fatura iptali ya da iadesi, cari Değersiz OLMADAN
 * da eksi kalacaksa? … A (ÖNERİ): reddedilsin — bakiye −2.576,45 kalır."): tur 2'nin "Değersiz olmasaydı eksi olmazdı" (bakiye + Σ Değersiz ≥ 0) koşulu KALKTI — Değersiz satırı olan caride
 * eksiye götüren iptal / iade her durumda ret; ileti nedeni iki duruma göre anlatır.
 * 2.5.1 M2 tur 3 — S-M2T2-2 = A (aynı karar anı; AYNEN: "Değersiz Alacak'tan sonra fatura TUTARI Düzenle ile düşürülürse (2.900 → 100)? A (ÖNERİ): iade gibi reddedilsin (S241 = A ile
 * tutarlı) — bakiye 423,55 kalır."): borç yönlü belgenin (satış faturası, SMM, alıştan iade) Düzenle'si tutarı düşürüyorsa (ya da cari değişiyorsa) editInvoice aynı denetimi action "edit" ile çağırır.
 * Değersiz satırı olmayan caride hiçbir şey okunmaz (null).
 */
export function writeOffBalanceGuard(store, party, { action = "cancel" } = {}) {
  if (!party || !hasTable(store, "account_entries")) return null;
  const ownLines = () => store.all("SELECT id, source_id AS recordId, date, CAST(ROUND(amount * 100) AS INTEGER) AS minor FROM account_entries WHERE account_id = ? AND source = 'doubtful' AND kind = 'credit' ORDER BY created_at, rowid", party);
  if (!ownLines().length) return null;
  const before = ledgerBalanceMinor(store, party);
  return {
    before,
    check() {
      const lines = ownLines();
      if (!lines.length) return;
      const after = ledgerBalanceMinor(store, party);
      const total = lines.reduce((sum, line) => sum + line.minor, 0);
      // S-M2T2-1 = A: "Değersiz olmasaydı eksi olmazdı" koşulu yok — eksiye götüren her iptal / iade / tutar düşürme ret.
      if (!(after < before && after < 0)) return;
      const last = lines[lines.length - 1];
      const room = writeOffRoomAfter(store, party, last);
      const words = {
        cancel: { what: "Fatura iptal edilemez", act: "iptalden", by: "bu fatura olmasaydı", then: "faturayı iptal edin", op: "iptal" },
        return: { what: "İade faturası kaydedilemez", act: "iadeden", by: "bu iadeyle", then: "iadeyi kaydedin", op: "iade" },
        edit: { what: "Fatura düzenlenemez", act: "düzenlemeden", by: "bu düzenlemeyle", then: "faturayı düzenleyin", op: "düzenleme" },
      }[action] || { what: "İşlem kaydedilemez", act: "işlemden", by: "bu işlemle", then: "işlemi yeniden deneyin", op: "işlem" };
      const many = lines.length > 1 ? ` (carinin ${lines.length} Değersiz Alacak satırı, toplam ${tl(total)})` : "";
      const could = room > 0 ? `${words.by} o kayda en çok ${tl(room)} Değersiz Alacak yazılabilirdi` : `${words.by} o kayda Değersiz Alacak yazılamazdı`;
      // Neden: Değersiz yüzünden eksi (tur 2 cümlesi AYNEN) ya da Değersiz olmadan da eksi (S-M2T2-1 = A — Değersiz satırı silinse de cari alacaklı kalırdı).
      const why = after + total >= 0
        ? `Değersiz Alacak yazımı cariyi alacaklıya düşüremez — ${could}`
        : `Değersiz Alacak satırı olan caride ${words.op} cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak satırı olmasaydı da cari ${tl(-(after + total))} alacaklı olurdu — ${could}`;
      throw new HttpError(
        409,
        `${words.what}: bu caride ${dayText(last.date)} tarihli ${tl(last.minor)} Değersiz Alacak satırı var${many}; ${words.act} sonra cari ${tl(-after)} alacaklı (eksi bakiye) olurdu. ` +
          `${why}. Ne yapmalı: önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi), sonra ${words.then}; ` +
          "gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir şey kaydedilmedi.",
        { code: "doubtful-writeoff-balance", balanceMinor: after, writeOffMinor: total, limitMinor: room, entryId: last.id, date: last.date },
      );
    },
  };
}
/** İşlemden sonraki hâlde `line`'ın kaydına, kaydın Değersiz satırları OLMASAYDI satırın gününde formun önereceği tutar (ret iletisi için; aynı sınır işlevi — writeOffLimitOf). */
function writeOffRoomAfter(store, party, line) {
  const ctx = writeOffContextOf(store, party);
  const record = ctx.rows.records.find(item => item.id === line.recordId);
  if (!record || record.status !== "open") return 0;
  const own = store.all("SELECT CAST(ROUND(amount * 100) AS INTEGER) AS minor FROM account_entries WHERE account_id = ? AND source = 'doubtful' AND kind = 'credit' AND source_id = ?", party, record.id).reduce((sum, row) => sum + Number(row.minor), 0);
  const credits = ctx.credits.filter(credit => credit.target !== record.id);
  const full = allocateDoubtful({ records: ctx.rows.records, provisions: ctx.rows.provisions, credits, linked: ctx.rows.linked || null });
  const outside = new Map();
  for (const [key, hit] of full.allocations) if ((hit.outsideMinor || 0) > 0) outside.set(key, hit.outsideMinor);
  const quote = writeOffLimitOf({ ...ctx, credits, full, outside, rooms: new Map() }, record, line.date, { balanceMinor: ledgerBalanceMinor(store, party) + own });
  return quote.offerMinor;
}
/** Değersiz satırı `line`'dan SONRA cari için başka bir işlem oldu mu (yazım, değişiklik, silme / geri yükleme). Belirsiz eşitlikte (aynı an) işlem VAR sayılır (denetim yanlış alarm vermez). */
function activityAfter(store, party, line) {
  const has = name => hasTable(store, name);
  const q = (sql, ...args) => Boolean(store.get(sql, ...args));
  // Yazım sırası (i) ile aynı ölçü: created_at → rowid (ders 31); sonradan değişen satır updated_at.
  if (q("SELECT 1 AS found FROM account_entries WHERE account_id = ?1 AND id <> ?2 AND (COALESCE(created_at, '') > ?3 OR (COALESCE(created_at, '') = ?3 AND rowid > ?4) OR COALESCE(updated_at, '') >= ?3) LIMIT 1", party, line.id, line.at, line.seq)) return true;
  if (has("invoices") && q("SELECT 1 AS found FROM invoices WHERE account_id = ?2 AND (COALESCE(created_at, '') >= ?1 OR COALESCE(updated_at, '') >= ?1 OR COALESCE(issued_at, '') >= ?1 OR COALESCE(cancelled_at, '') >= ?1) LIMIT 1", line.at, party)) return true;
  if (has("plans") && q("SELECT 1 AS found FROM plans p WHERE p.account_id = ?2 AND (COALESCE(p.created_at, '') >= ?1 OR COALESCE(p.updated_at, '') >= ?1 OR COALESCE(p.deleted_at, '') >= ?1 OR EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND (COALESCE(pe.created_at, '') >= ?1 OR COALESCE(pe.updated_at, '') >= ?1))) LIMIT 1", line.at, party)) return true;
  if (has("cheques") && q("SELECT 1 AS found FROM cheques c WHERE (c.account_id = ?2 OR c.endorse_account_id = ?2) AND (COALESCE(c.created_at, '') >= ?1 OR COALESCE(c.updated_at, '') >= ?1 OR COALESCE(c.deleted_at, '') >= ?1) LIMIT 1", line.at, party)) return true;
  if (has("doubtful_receivables") && q("SELECT 1 AS found FROM doubtful_receivables WHERE account_id = ?2 AND (COALESCE(created_at, '') >= ?1 OR COALESCE(updated_at, '') >= ?1) LIMIT 1", line.at, party)) return true;
  if (has("trash") && q("SELECT 1 AS found FROM trash WHERE (deleted_at >= ?1 OR COALESCE(restored_at, '') >= ?1) AND instr(payload_json, ?2) > 0 LIMIT 1", line.at, party)) return true;
  return false;
}

/**
 * Cari başına özet (kuruş): açık (kalan) şüpheli, karşılık, tahsil edilen, değersiz yazılan, çıkarılan, kayıt sayısı. Cari kartı ve ANLIK DURUM.
 */
export function doubtfulSummary(store, accountId) {
  const empty = { count: 0, openCount: 0, openMinor: 0, provisionMinor: 0, collectedMinor: 0, writtenOffMinor: 0, releasedMinor: 0 };
  if (!hasDoubtful(store)) return empty;
  const { records, state } = doubtfulState(store, { parties: [accountId] });
  return summarize(records, state, empty);
}
// Özetin toplama kuralı (doubtfulSummary ve şüpheli kayıt listesi aynı ayırmanın sonucundan — 2.5.1 M2 hız: liste ikinci ayırıcı koşusu yapmaz).
function summarize(records, state, empty = { count: 0, openCount: 0, openMinor: 0, provisionMinor: 0, collectedMinor: 0, writtenOffMinor: 0, releasedMinor: 0 }) {
  const out = { ...empty };
  for (const record of records) {
    const s = state.get(record.id);
    if (!s) continue;
    out.count += 1;
    if (s.remaining > 0) out.openCount += 1;
    out.openMinor += s.remaining;
    out.provisionMinor += s.provision;
    out.collectedMinor += s.collected;
    out.writtenOffMinor += s.writtenOff;
    out.releasedMinor += s.released;
  }
  return out;
}

/**
 * Cari başına AÇIK şüpheli tutar (2.3.0 İz 1.6; plan §3.11b/5 "ANLIK DURUM, Alacak Yaşlandırma ve hatırlatmalar şüpheli tutarı ayrı gösterir"):
 * kalanı olan kayıtların carisi → { openMinor, provisionMinor, count }; totals bütün carilerin toplamı. Şüpheli hiç kullanılmamışsa tek sorgu
 * (doubtfulUsed) ve boş sonuç — listeler ve ANLIK DURUM bu yardımcıyı her istekte çağırır.
 */
export function doubtfulOpenByAccount(store, { parties = null } = {}) {
  const byAccount = new Map();
  const totals = { openMinor: 0, provisionMinor: 0, count: 0, accountCount: 0 };
  if (!doubtfulUsed(store)) return { byAccount, totals };
  // TEK ADAY HIZ (t3hiz; ders 47): parties verilirse yalnız o cariler (cari servisinin ids'li listesi — kartın bakiye / sınır okuması); ayırıcı cari başına bağımsız koşar → her carinin
  // satırı bütün şirket okumasındakiyle AYNI (totals yalnız verilen carilerin toplamı). Eşdeğerlik test/t3hiz-esdegerlik-250.test.mjs.
  const { records, state } = doubtfulState(store, parties ? { parties } : {});
  for (const record of records) {
    const s = state.get(record.id);
    if (!s || s.remaining <= 0) continue;
    const item = byAccount.get(record.party) || { openMinor: 0, provisionMinor: 0, count: 0 };
    item.openMinor += s.remaining;
    item.provisionMinor += s.provision;
    item.count += 1;
    byAccount.set(record.party, item);
    totals.openMinor += s.remaining;
    totals.provisionMinor += s.provision;
    totals.count += 1;
  }
  totals.accountCount = byAccount.size;
  return { byAccount, totals };
}

/**
 * @param {{ store, bank, period, now: () => Date, accounts: () => object, trash?: object }} options  bank: lib/bank/post.mjs (para dışı yazıcı
 *   denetimi); period: hareket tarihi ve dönem kilidi; accounts: cari servisi (bakiye, Değersiz Alacak satırı yazıcısı)
 */
export function createDoubtful({ store, bank, period, now, accounts, trash = null }) {
  const stamp = () => now().toISOString();
  const byId = (user = null) => user?.id || "system";

  // ---------- Okuma ----------
  function recordRow(id, { accountId = "" } = {}) {
    const row = store.get(`${RECORD_SQL} WHERE d.id = ?`, text(id).slice(0, 120));
    if (!row || row.status === "cancelled" || (accountId && row.party !== accountId)) throw new HttpError(404, "Şüpheli alacak kaydı bulunamadı. Silinmiş ya da başka cariye ait olabilir.", { code: "doubtful-missing" });
    return withControl(row);
  }
  const writeOffsOf = recordId =>
    store.all(
      `SELECT e.id AS entryId, e.date, CAST(ROUND(e.amount * 100) AS INTEGER) AS amountMinor, e.note, COALESCE((SELECT f.no FROM fin_events f WHERE f.type = 'doubtful_writeoff' AND f.src_table = 'account_entries' AND f.src_id = e.id AND f.status = 'active' LIMIT 1), '') AS eventNo
       FROM account_entries e WHERE e.source = 'doubtful' AND e.source_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      recordId,
    );
  function view(record, state, allocations) {
    const base = doubtfulView(record, state);
    const provisions = store.all(`${PROVISION_SQL} WHERE p.doubtful_id = ? AND p.status = 'active' ORDER BY p.date, p.rowid`, record.id).map(item => ({ id: item.id, date: item.date, amountMinor: item.amountMinor, note: item.note, eventNo: item.eventNo }));
    const writeOffs = writeOffsOf(record.id).map(item => {
      const hit = allocations?.get(`account:${item.entryId}`);
      return { ...item, provisionMinor: hit?.provisionUsed || 0, lossMinor: hit ? hit.lossMinor : item.amountMinor };
    });
    return {
      id: record.id, accountId: record.party, accountName: record.accountName, accountRefNo: record.accountRefNo, date: record.date,
      reason: record.reason, reasonLabel: record.reasonLabel, note: record.note, chequeId: record.chequeId, chequeSerialNo: record.chequeSerialNo,
      closedDate: record.closedDate, eventId: record.eventId, eventNo: record.eventNo, closeEventId: record.closeEventId, closeEventNo: record.closeEventNo,
      createdBy: record.createdBy, createdAt: record.createdAt, ...base, provisions, writeOffs,
    };
  }
  /** Carinin kayıtları (iptal edilenler hariç) ve özeti. */
  // 2.5.1 M2 — S268 / S269 = A: açık durumlu kaydın 'yazılabilir' alanı (writeOff): bugünün ve en çok yazdıran izinli günün sınırı / önerisi; düğme herhangi bir aday günde sınır > 0 ise görünür.
  // Kayıtların ayırması aynı bağlamın tam koşusundan (ikinci doubtfulState koşusu yok).
  function listFor(accountId) {
    const ctx = writeOffContextOf(store, accountId);
    const { records } = ctx.rows;
    const { state, allocations } = ctx.full;
    // Bakiye carinin defter satırlarından (cari kartının bakiyesiyle aynı kaynak — accountLedger; eşitlik testte denetlenir). Yazım yolları kartın kendi bakiyesini okur (headroom).
    const balanceMinor = records.some(record => record.status === "open") ? ledgerBalanceMinor(store, accountId) : 0;
    const writable = record => {
      if (record.status !== "open" || !state.get(record.id)) return null;
      const days = writeOffDaysOf(ctx, record, balanceMinor);
      return { anyMinor: days.anyMinor || 0, today: quoteOut(days.today), best: quoteOut(days.best) };
    };
    return { records: records.map(record => ({ ...view(record, state.get(record.id), allocations), writeOff: writable(record) })), summary: hasDoubtful(store) ? summarize(records, state) : doubtfulSummary(store, accountId) };
  }
  /** Rapor verisi: bütün (silinmemiş) carilerin kayıtları; status open | closed | all; from/to kayıt tarihine. "Açık" durumu TARİH İTİBARIYLA
   *  listedir (eleştirmen E1, 15.10.2026): dönem başlangıcı süzmez — geçen yıl açılmış, hâlâ açık kayıt "Bu Yıl"da görünür, TOPLAM Kalan = 128. */
  function report({ from = "", to = "", status = "open" } = {}) {
    const { records, state, allocations } = doubtfulState(store);
    const rows = records
      .filter(record => (!from || status === "open" || record.date >= from) && (!to || record.date <= to))
      .map(record => view(record, state.get(record.id), allocations))
      .filter(row => (status === "all" ? true : status === "closed" ? row.stateKey !== "open" : row.stateKey === "open"));
    const totals = { count: rows.length, amountMinor: 0, provisionMinor: 0, provisionReleasedMinor: 0, collectedMinor: 0, writtenOffMinor: 0, releasedMinor: 0, remainingMinor: 0 };
    for (const row of rows) for (const key of Object.keys(totals)) if (key !== "count") totals[key] += Number(row[key]) || 0;
    return { rows, totals, from, to, status };
  }
  const stateOf = (record, scope = null) => {
    const { state, allocations } = doubtfulState(store, { parties: [record.party] });
    return { state: state.get(record.id) || null, allocations, ...(scope ? {} : {}) };
  };

  // ---------- Yazım (bank.post'un write geri çağrısında) ----------
  // İşlem başlığı (para satırı yok): dokunulan olaylara girer (kapı, K6).
  function openEvent(ctx, { type, date, srcTable, srcId, partyId, minor, chequeId = "", description, user }) {
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = newEventId();
    store.run(
      `INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, origin_key, src_table, src_id, bank_ref, direction, amount_minor, try_minor, currency, method, party_id, cheque_id, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'manual', '', ?, ?, '', '', ?, ?, 'TRY', '', ?, ?, ?, ?, ?)`,
      id, year, seq, no, type, date, srcTable, srcId, minor, minor, partyId, chequeId || "", String(description || "").slice(0, 300), byId(user), stamp(),
    );
    bank.assertWrittenNonMoney("fin_events", id);
    ctx?.events?.add(id);
    ctx?.created?.add(id);
    return { id, no };
  }
  function setEventStatus(ctx, id, status, user) {
    if (!id) return;
    store.run("UPDATE fin_events SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?", status, byId(user), stamp(), id);
    bank.assertWrittenNonMoney("fin_events", id);
    ctx?.events?.add(id);
  }
  const accountRow = accountId => store.get("SELECT id, name, type, deleted_at AS deletedAt FROM accounts WHERE id = ?", text(accountId).slice(0, 120));
  const liveAccount = accountId => {
    const account = accountRow(accountId);
    if (!account || account.deletedAt) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");
    return account;
  };
  /** Carinin kartındaki bakiye (kuruş; cari servisinin kendi hesabı) ve açık şüpheli tutarı. */
  function headroom(accountId) {
    const account = accounts()?.list ? accounts().list(AUDITOR, { status: "all", ids: [accountId] }).accounts[0] : null;
    const balanceMinor = account ? toMinor(Number(account.balance) || 0) : 0;
    const openMinor = doubtfulSummary(store, accountId).openMinor;
    return { balanceMinor, openMinor, roomMinor: balanceMinor - openMinor };
  }
  /** Carinin ilk borç tarihi: cari satırı (borç / ödeme), taksit kartı başlangıcı, kesilmiş satış faturası; yoksa ''. */
  function firstDebitDate(accountId) {
    const dates = [store.get("SELECT MIN(date) AS d FROM account_entries WHERE account_id = ? AND kind IN ('debt', 'out')", accountId)?.d];
    if (hasTable(store, "plans")) dates.push(store.get("SELECT MIN(COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10))) AS d FROM plans WHERE account_id = ? AND deleted_at IS NULL", accountId)?.d);
    if (hasTable(store, "invoices")) dates.push(store.get("SELECT MIN(issue_date) AS d FROM invoices WHERE account_id = ? AND status = 'issued' AND kind IN ('sale', 'purchase_return')", accountId)?.d);
    return dates.filter(Boolean).sort()[0] || "";
  }
  const dateAfterRecord = (date, record, label) => {
    if (date < record.date) throw new HttpError(400, `${label} (${dayText(date)}) şüpheli alacak kaydının tarihinden (${dayText(record.date)}) önce olamaz.`, { code: "date-before-record", field: "date" });
  };
  const amountOf = (value, label = "Tutar") => parseMinor(value, { label });
  const describe = (record, head) => [head, record.reasonLabel, record.chequeSerialNo ? `Evrak No ${record.chequeSerialNo}` : "", record.accountName].filter(Boolean).join(" · ");

  /**
   * Şüpheli Alacağa Al (§3.11b/2): yalnız müşteri carisi; tutar ≤ borç bakiyesi − açık şüpheli; neden; karşılıksız evrak kısayolu (chequeId:
   * bu carinin karşılıksız alınan evrakı → neden ve tutar evraktan). Yazılanlar: doubtful_receivables (open) + fin_events (doubtful_take).
   */
  function take(ctx, { user, accountId, body = {} }) {
    const account = liveAccount(accountId);
    if (account.type !== "customer") throw new HttpError(409, `“${account.name}” müşteri carisi değil; şüpheli ticari alacak yalnız müşteri (120) carisinde izlenir.`, { code: "doubtful-customer-only" });
    let cheque = null;
    const chequeId = text(body.chequeId).slice(0, 120);
    if (chequeId) {
      cheque = store.get("SELECT id, direction, instrument, status, amount, serial_no AS serialNo, account_id AS accountId FROM cheques WHERE id = ? AND deleted_at IS NULL", chequeId);
      if (!cheque || cheque.accountId !== account.id) throw new HttpError(404, "Evrak bu caride bulunamadı.", { code: "doubtful-cheque-missing" });
      if (cheque.direction !== "in" || cheque.status !== "bounced") throw new HttpError(409, `${cheque.instrument === "note" ? "Senet" : "Çek"}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} karşılıksız/protestolu değil; yalnız karşılıksız dönen alınan evrak şüpheli alacağa alınır.`, { code: "doubtful-cheque-not-bounced" });
    }
    const reason = text(body.reason) || (cheque ? (cheque.instrument === "note" ? "note" : "cheque") : "");
    if (!isDoubtfulReason(reason)) throw new HttpError(400, "Neden seçin: Karşılıksız Çek, Protestolu Senet, Dava, İcra ya da Diğer.", { code: "doubtful-reason", field: "reason" });
    const date = period.movementDate(body, { label: "Tarih" });
    const minor = body.amount === undefined || body.amount === null || body.amount === "" ? (cheque ? toMinor(Number(cheque.amount) || 0) : amountOf(body.amount)) : amountOf(body.amount);
    // Yargıç 2.3.0 #7 (15.10.2026): kayıt tarihi carinin ilk borç satırından (cari satırı borç/ödeme, taksit kartı, kesilmiş fatura) önce olamaz —
    // o tarihte alacak yokken 128'e alınırdı (o ayın mizanında 120 eksi).
    const firstDebit = firstDebitDate(account.id);
    if (!firstDebit || date < firstDebit) throw new HttpError(400, firstDebit ? `Kayıt tarihi (${dayText(date)}) carinin ilk borç hareketinden (${dayText(firstDebit)}) önce olamaz; o tarihte şüpheliye alınacak alacak yoktu.` : "Carinin borç hareketi yok; şüpheliye alınacak alacak bulunmuyor.", { code: "doubtful-before-debt", field: "date", firstDebit: firstDebit || "" });
    const room = headroom(account.id);
    if (minor > room.roomMinor) {
      throw new HttpError(400, `Şüpheliye alınacak tutar (${tl(minor)}) carinin borç bakiyesini aşıyor: bakiye ${tl(room.balanceMinor)}${room.openMinor ? `, zaten şüphelide ${tl(room.openMinor)}` : ""} → en çok ${tl(Math.max(0, room.roomMinor))}.`, { code: "doubtful-exceeds-balance", field: "amount", balanceMinor: room.balanceMinor, openMinor: room.openMinor });
    }
    const note = limited(body.note ?? "", 300, "Açıklama");
    const id = `dbt-${randomUUID()}`;
    const label = { reasonLabel: DOUBTFUL_REASONS[reason], chequeSerialNo: cheque?.serialNo || "", accountName: account.name };
    const event = openEvent(ctx, { type: "doubtful_take", date, srcTable: "doubtful_receivables", srcId: id, partyId: account.id, minor, chequeId: cheque?.id || "", description: describe(label, "Şüpheli alacağa alındı"), user });
    store.run(
      "INSERT INTO doubtful_receivables (id, account_id, date, amount_minor, reason, note, cheque_id, status, closed_date, event_id, close_event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', '', ?, '', ?, ?)",
      id, account.id, date, minor, reason, note, cheque?.id || "", event.id, byId(user), stamp(),
    );
    bank.assertWrittenNonMoney("doubtful_receivables", id);
    const record = recordRow(id);
    return { record: view(record, stateOf(record).state, stateOf(record).allocations), event, account, minor, date, reason, note };
  }
  /** Açık (kalanı olan) kayıt; değilse 409 doubtful-closed. */
  function openRecord(accountId, did) {
    const record = recordRow(did, { accountId });
    const { state, allocations } = stateOf(record);
    if (record.status !== "open" || !state || state.remaining <= 0) {
      const why = record.status === "released" ? "şüpheliden çıkarılmış" : state?.writtenOff > 0 ? "değersiz yazılarak kapanmış" : "tamamı tahsil edilmiş";
      throw new HttpError(409, `Bu şüpheli alacak kaydı ${why}; kalan tutar yok.`, { code: "doubtful-closed", recordId: record.id });
    }
    return { record, state, allocations };
  }
  /** Şüpheliden Çıkar (§3.11b/2): kalan B 120 / A 128, karşılık B 129 / A 644 — yevmiye türetir; burada kapanış başlığı + durum. */
  function release(ctx, { user, accountId, did, body = {} }) {
    const { record, state } = openRecord(accountId, did);
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Çıkarma tarihi");
    const note = limited(body.note ?? "", 300, "Açıklama");
    const event = openEvent(ctx, { type: "doubtful_release", date, srcTable: "doubtful_receivables", srcId: record.id, partyId: record.party, minor: state.remaining, chequeId: record.chequeId, description: describe(record, `Şüpheliden çıkarıldı${note ? ` · ${note}` : ""}`), user });
    store.run("UPDATE doubtful_receivables SET status = 'released', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'open'", date, event.id, byId(user), stamp(), record.id);
    bank.assertWrittenNonMoney("doubtful_receivables", record.id);
    const fresh = recordRow(record.id);
    const after = stateOf(fresh);
    return { record: view(fresh, after.state, after.allocations), event, releasedMinor: state.remaining, date, note };
  }
  /** Karşılık Ayır (§3.11b/3, VUK 323): toplam karşılık ≤ kalan şüpheli. */
  function provision(ctx, { user, accountId, did, body = {} }) {
    const { record, state } = openRecord(accountId, did);
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Karşılık tarihi");
    const minor = amountOf(body.amount, "Karşılık tutarı");
    if (state.provision + minor > state.remaining) {
      throw new HttpError(400, `Karşılık (${tl(minor)}) kalan şüpheli tutarı aşıyor: kalan ${tl(state.remaining)}${state.provision ? `, ayrılmış karşılık ${tl(state.provision)}` : ""} → en çok ${tl(Math.max(0, state.remaining - state.provision))}.`, { code: "doubtful-provision-exceeds", field: "amount", remainingMinor: state.remaining, provisionMinor: state.provision });
    }
    const note = limited(body.note ?? "", 300, "Açıklama");
    const id = `dbtp-${randomUUID()}`;
    const event = openEvent(ctx, { type: "doubtful_provision", date, srcTable: "doubtful_provisions", srcId: id, partyId: record.party, minor, chequeId: record.chequeId, description: describe(record, `Karşılık ayrıldı${note ? ` · ${note}` : ""}`), user });
    store.run("INSERT INTO doubtful_provisions (id, doubtful_id, date, amount_minor, note, status, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)", id, record.id, date, minor, note, event.id, byId(user), stamp());
    bank.assertWrittenNonMoney("doubtful_provisions", id);
    const after = stateOf(record);
    return { record: view(record, after.state, after.allocations), event, provisionId: id, minor, date, note };
  }
  // 2.5.1 M2 — Değersiz Alacak sınırı (S264 / S269 / S268 / S270 / S-M2-1 = B; kararların AYNEN metni yukarıda writeOffLimitOf'un notunda). Sınır TEK işlevden (writeOffLimitOf):
  // liste ('writeOff' alanı), Değersiz Yaz, Silinenler'den geri yükleme ve formun uç noktası (writeOffQuote). Önceki uygulama (2.5.0 UD turu 3: kalan + o günün bağlı payı; 'kayıt kapalı'
  // denetimi sınırdan önce) S269'u karşılamıyordu; UD turu 4'ün geri alınan uygulaması (7141a308) sonradan gelen bağsız tahsilatta fazla yazıma izin veriyordu (bakiye −576,45).
  const WHY_TEXT = {
    remaining: "kayıtta kalan şüpheli tutar",
    sameDay: "kayıtta kalan şüpheli tutar — o günün faturaya bağlı tahsilatı Değersiz'den sonra sayılır, bağsız tahsilatlar tarihi ne olursa olsun düşülür",
    later: "daha fazlası sonraki bir Değersiz Alacak satırını ya da carinin başka bir şüpheli kaydını kalanın dışına taşırırdı",
    balance: "carinin borç bakiyesi; Değersiz yazımı cariyi alacaklıya düşüremez",
    closed: "kayıt kapalı",
  };
  const S155_TEXT = "kayıttan sonra carinin borcu açık şüpheli tutarın altına düşemez";
  const quoteOut = quote => (quote ? { date: quote.date, limitMinor: quote.limitMinor, offerMinor: quote.offerMinor, why: quote.why, whyText: WHY_TEXT[quote.why] || "", s155: Boolean(quote.s155), s155Text: quote.s155 ? S155_TEXT : "" } : null);
  const lockOf = () => period.lockedUntil?.() || "";
  /** Kaydın aday günlerinin sınırları (liste ve iletiler): { today, first, best, anyMinor }. */
  function writeOffDaysOf(ctx, record, balanceMinor) {
    return writeOffDays(ctx, record, { today: period.today(), lockedUntil: lockOf(), balanceMinor });
  }
  const altText = (days, date) => (days?.best && days.best.offerMinor > 0 && days.best.date !== date ? ` ${dayText(days.best.date)} tarihiyle en çok ${tl(days.best.offerMinor)} yazılabilir.` : "");
  const closedWhy = (record, state) => (record.status === "released" ? "şüpheliden çıkarılmış" : state?.writtenOff > 0 ? "değersiz yazılarak kapanmış" : "tamamı tahsil edilmiş");
  /**
   * Değersiz sınırı denetimi (Değersiz Yaz ve geri yükleme): çıkarılmış / iptal kayıt 409 doubtful-closed (eskisi gibi); sınır ≤ 0 → 409 doubtful-closed; tutar > sınır → 400 (Değersiz Yaz) /
   * 409 (geri yükleme) doubtful-writeoff-exceeds. İleti gerçek sınırı, nedenini ve (farklıysa) başka tarihle yazılabilecek tutarı söyler.
   */
  function assertWriteOffLimit(record, date, minor, { at, restoring = false } = {}) {
    const ctx = writeOffContextOf(store, record.party);
    const state = ctx.full.state.get(record.id);
    if (record.status !== "open" || !state) throw new HttpError(409, `Bu şüpheli alacak kaydı ${closedWhy(record, state)}; kalan tutar yok.`, { code: "doubtful-closed", recordId: record.id });
    const balanceMinor = headroom(record.party).balanceMinor;
    const quote = writeOffLimitOf(ctx, record, date, { balanceMinor, ...(at ? { at } : {}) });
    const head = restoring ? "Değersiz Alacak satırı geri yüklenemez: " : "";
    if (quote.limitMinor <= 0) {
      const days = writeOffDaysOf(ctx, record, balanceMinor);
      const why = state.remaining > 0 ? WHY_TEXT[quote.why] : closedWhy(record, state);
      throw new HttpError(409, `${head}Bu şüpheli alacak kaydına ${dayText(date)} tarihiyle değersiz alacak yazılamaz; yazılabilecek tutar kalmadı (${why}).${altText(days, date)}`, { code: "doubtful-closed", recordId: record.id, limitMinor: 0, date });
    }
    if (minor > quote.limitMinor) {
      const days = writeOffDaysOf(ctx, record, balanceMinor);
      throw new HttpError(restoring ? 409 : 400, `${head}Değersiz yazılacak tutar (${tl(minor)}) bu kayda ${dayText(date)} tarihiyle yazılabilecek en çok tutarı (${tl(quote.limitMinor)}) aşıyor; sınır: ${WHY_TEXT[quote.why]}.${altText(days, date)}`, { code: "doubtful-writeoff-exceeds", field: restoring ? undefined : "amount", remainingMinor: quote.limitMinor, limitMinor: quote.limitMinor, date });
    }
    return quote;
  }
  const writeOffOutside = record => {
    const out = new Map();
    for (const [key, hit] of stateOf(record).allocations) if (hit.outsideMinor > 0) out.set(key, hit.outsideMinor);
    return out;
  };
  // Yazımdan sonra (bank.post işlemi içinde) güvenlik denetimi: satır kaydın kalanına sığmıyorsa ya da carinin başka bir Değersiz satırını kalanın dışına taşırıyorsa yazım geri alınır
  // (doğru sınırla oluşmaz — sınır aynı ayırıcıyı yazımdan sonraki hâliyle koşar).
  const assertWriteOffFits = (record, entryId, minor, before, refused) => {
    const { allocations } = stateOf(record);
    const key = `account:${entryId}`;
    const fit = (allocations.get(key)?.records || []).reduce((sum, item) => sum + item.minor, 0);
    if (fit < minor) throw refused(`satır kaydın kalanına sığmıyor (sığan ${tl(fit)})`);
    for (const [other, hit] of allocations) if (other !== key && hit.outsideMinor > (before.get(other) || 0)) throw refused("carinin başka bir Değersiz Alacak satırı kalanın dışına taşardı");
  };
  /** Formun ve listenin sınırı: kaydın seçilen gündeki sınırı / önerisi + aday günlerin en çok önerdiği (Değersiz Alacak Yaz formu tarih değişince bunu okur). */
  function writeOffQuote(accountId, did, date = "") {
    const record = recordRow(did, { accountId });
    const ctx = writeOffContextOf(store, record.party);
    const balanceMinor = ledgerBalanceMinor(store, record.party);
    const days = writeOffDaysOf(ctx, record, balanceMinor);
    const today = period.today();
    const day = date || today;
    const lock = lockOf();
    let blocked = "";
    if (record.status !== "open" || !ctx.full.state.get(record.id)) blocked = "closed";
    else if (day > today) blocked = "future";
    else if (lock && day <= lock) blocked = "locked";
    else if (day < record.date) blocked = "before";
    const quote = blocked ? { date: day, limitMinor: 0, offerMinor: 0, why: "closed", s155: false } : writeOffLimitOf(ctx, record, day, { balanceMinor });
    const blockedText = { closed: "kayıt kapalı", future: "ileri tarihli hareket girilemez", locked: `${dayText(lock)} ve öncesi kilitli dönem`, before: `tarih şüpheli kaydın tarihinden (${dayText(record.date)}) önce` }[blocked] || "";
    return { recordId: record.id, ...quoteOut(quote), blocked, blockedText, today: quoteOut(days.today), best: quoteOut(days.best), anyMinor: days.anyMinor || 0, balanceMinor };
  }
  /** Değersiz Alacak Yaz (§3.11b/3): cari kartına alacak satırı (source 'doubtful') + başlık; yevmiye B 129/659 / A 128 türetir. */
  function writeOff(ctx, { user, accountId, did, body = {} }) {
    const record = recordRow(did, { accountId });
    if (record.status !== "open") throw new HttpError(409, `Bu şüpheli alacak kaydı ${closedWhy(record, null)}; kalan tutar yok.`, { code: "doubtful-closed", recordId: record.id });
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Değersiz yazma tarihi");
    const minor = amountOf(body.amount, "Değersiz alacak tutarı");
    assertWriteOffLimit(record, date, minor);
    const note = limited(body.note ?? "", 300, "Açıklama");
    const writer = accounts()?.doubtfulEntry;
    if (!writer) throw new HttpError(503, "Cari servisi hazır değil.");
    const before = writeOffOutside(record);
    const entry = writer.add(user, record.party, { amount: fromMinor(minor), date, note: note ? `Değersiz alacak · ${note}` : "Değersiz alacak", recordId: record.id });
    assertWriteOffFits(record, entry.id, minor, before, why => new HttpError(400, `Değersiz alacak yazılamadı: ${why}. Hiçbir şey kaydedilmedi.`, { code: "doubtful-writeoff-exceeds", field: "amount" }));
    const event = openEvent(ctx, { type: "doubtful_writeoff", date, srcTable: "account_entries", srcId: entry.id, partyId: record.party, minor, chequeId: record.chequeId, description: describe(record, `Değersiz alacak yazıldı${note ? ` · ${note}` : ""}`), user });
    const after = stateOf(record);
    // Bildirim (S268 / plan M2): bu yazımın tutarı, yazımdan sonraki gerçek kalan ve aynı tarihle daha yazılabilecek tutar (yazım işleminin içinde; aynı sınır işlevi).
    const next = writeOffLimitOf(writeOffContextOf(store, record.party), record, date, { balanceMinor: headroom(record.party).balanceMinor });
    return { record: view(record, after.state, after.allocations), event, entryId: entry.id, minor, date, note, writeOffAfter: quoteOut(next) };
  }
  const assertOpenDates = (dates, what) => {
    for (const date of dates.filter(Boolean)) period.assertOpen(date, what);
  };
  /**
   * Silme çakışması (15.10.2026; Uzun Doğrulama #199 tohum 10): silinen kaydın tahsilatları carinin öbür kayıtlarına kayar; daha önce çıkarılmış
   * kaydın "Şüpheliden Çıkar" başlığı ya da bir Değersiz Alacak satırı artık kalana sığmazsa yazım tamamen geri alınır ve neden AÇIK yazılır
   * (önceden yalnız kapı "ledger-integrity … yöneticinize bildirin" diyordu). Silme işleminden sonra, aynı işlem içinde çağrılır.
   */
  // K5 (2.3.0 kontrol turu 2): kullanıcıya kapının iç örneği (ham kayıt kimliği) değil, kaydın tarihi ve tutarıyla neden + ne yapacağı yazılır;
  // kapı örnekleri yanıtın `problems` alanında kalır (destek için).
  // 2.5.1 M2 tur 2 — S-DKM2-3 = C (dar kontrol DK-M2 ORTA-3; 27.11 23:47 UTC KULLANICI KARARIYLA ÖNERİ UYGULANDI — 20:26 yetkisi): "uç durum böyle kalsın (BİLİNEN SINIR) — yalnız ileti düzelsin
  // ('bu kayıt silinirse tahsilat Değersiz yazılan kayda düşer')". RET AYNEN; ileti ne olduğunu (hangi Değersiz satırı), nedenini (tahsilatın kayda düşmesi), ne yapılacağını ve nereye
  // gidileceğini söyler (önceden "yazıldığı andaki sınırı aşardı" — yanlış anlatım). `verb` silme / geri yükleme yoluna göre cümleyi kurar.
  const WRITEOFF_WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";
  const entryText = id => {
    const entry = store.get("SELECT date, amount FROM account_entries WHERE id = ?", id);
    return entry ? `${dayText(entry.date)} tarihli ${tl(Math.round(Number(entry.amount) * 100))}` : "";
  };
  const conflictReason = (key, verb = "silinemez") => {
    const [id, kind] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
    const happen = verb === "geri yüklenemez" ? "geri yüklenirse" : "silinirse";
    // 2.5.1 M2 (S270 değişmezi): Değersiz Alacak satırının sınırı (yazıldığı andaki dünya) / carinin bakiyesi.
    if (kind === "writeoff-limit" || kind === "outside") {
      const label = entryText(kind === "outside" ? id.replace(/^account:/, "") : id);
      return label
        ? { text: `bu kayıt ${happen} carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın ${label} Değersiz Alacak satırı, kayda düşen tahsilat çıkınca kalanı aşar (Değersiz Alacak bu kalanı aşamaz)`, fix: "o Değersiz Alacak satırını", writeOff: true }
        : null;
    }
    if (kind === "writeoff-balance") return { text: `bu kayıt ${happen} carinin Değersiz Alacak satırı cariyi alacaklıya (eksi bakiyeye) düşürür`, fix: "Değersiz Alacak satırını", writeOff: true };
    const record = store.get("SELECT date, amount_minor AS amountMinor FROM doubtful_receivables WHERE id = ?", id);
    if (!record) return null;
    const label = `${dayText(record.date)} tarihli ${tl(record.amountMinor)} şüpheli kaydının`;
    if (kind === "close-amount") return { text: `${label} Şüpheliden Çıkar tutarı değişirdi`, fix: "o kaydı" };
    if (kind === "provision" || kind === "provision-left") return { text: `${label} karşılığı kalan tutarı aşardı`, fix: "o kaydı" };
    return null;
  };
  const assertNoConflict = (party, what, verb = "silinemez") => {
    const problems = doubtfulProblems(store, { parties: [party] });
    if (!problems.length) return;
    const reasons = [...new Map(problems.map(item => conflictReason(item.key, verb)).filter(Boolean).map(item => [item.text, item])).values()];
    // Değersiz Alacak nedenli ret (S-DKM2-3 = C): dört parçalı ileti — ne oldu / neden / ne yapmalı / nereye; öbür nedenler eskisi gibi.
    const writeOff = reasons.find(item => item.writeOff);
    const message = writeOff
      ? `${what} ${verb}: ${reasons.map(item => item.text).join("; ")}. Ne yapmalı: önce ${writeOff.fix} silin (${WRITEOFF_WHERE}), sonra bu işlemi yeniden deneyin; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir şey kaydedilmedi.`
      : reasons.length
        ? `${what} ${verb}: carinin öbür şüpheli kayıtları bozulurdu (${reasons.map(item => item.text).join("; ")}). Önce ${reasons[0].fix} silin, sonra yeniden deneyin.`
        : `${what} ${verb}: carinin öbür şüpheli kayıtları bozulurdu. Önce carinin sonraki şüpheli işlemlerini silin, sonra yeniden deneyin.`;
    throw new HttpError(409, message, { code: "doubtful-delete-conflict", problems: problems.map(item => item.sample) });
  };
  /** Sil (kayıt hatası): kayıt + karşılıkları iptal (başlıklar cancelled), Silinenler'e. Değersiz satırı olan kayıt silinmez (önce satır). */
  function remove(ctx, { user, accountId, did }) {
    const record = recordRow(did, { accountId });
    const provisions = store.all(`${PROVISION_SQL} WHERE p.doubtful_id = ? AND p.status = 'active'`, record.id);
    assertOpenDates([record.date, record.closedDate, ...provisions.map(item => item.date)], "Şüpheli alacak kaydı");
    const writeOffs = writeOffsOf(record.id);
    if (writeOffs.length) throw new HttpError(409, `Bu kaydın ${writeOffs.length} Değersiz Alacak satırı var; önce değersiz yazmayı silin (kart → Değersiz Alacaklar → Sil).`, { code: "doubtful-has-writeoffs", count: writeOffs.length });
    for (const item of provisions) {
      store.run("UPDATE doubtful_provisions SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), item.id);
      bank.assertWrittenNonMoney("doubtful_provisions", item.id);
      setEventStatus(ctx, item.eventId, "cancelled", user);
    }
    setEventStatus(ctx, record.eventId, "cancelled", user);
    setEventStatus(ctx, record.closeEventId, "cancelled", user);
    store.run("UPDATE doubtful_receivables SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), record.id);
    bank.assertWrittenNonMoney("doubtful_receivables", record.id);
    assertNoConflict(record.party, "Şüpheli alacak kaydı");
    const payload = { kind: "record", id: record.id, accountId: record.party, accountName: record.accountName, date: record.date, amountMinor: record.amountMinor, reason: record.reason, note: record.note, status: record.status, closedDate: record.closedDate, eventId: record.eventId, closeEventId: record.closeEventId, provisions: provisions.map(item => ({ id: item.id, date: item.date, amountMinor: item.amountMinor, eventId: item.eventId })) };
    trash?.add({ kind: "doubtful", ref: record.id, title: record.accountName, detail: `${record.reasonLabel} · ${tl(record.amountMinor)} · ${dayText(record.date)}`, payload, user });
    return { record: payload, provisions: provisions.length };
  }
  function removeProvision(ctx, { user, accountId, did, pid }) {
    const record = recordRow(did, { accountId });
    const item = store.get(`${PROVISION_SQL} WHERE p.id = ? AND p.doubtful_id = ? AND p.status = 'active'`, text(pid).slice(0, 120), record.id);
    if (!item) throw new HttpError(404, "Karşılık kaydı bulunamadı.", { code: "doubtful-provision-missing" });
    period.assertOpen(item.date, "Karşılık kaydı");
    store.run("UPDATE doubtful_provisions SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), item.id);
    bank.assertWrittenNonMoney("doubtful_provisions", item.id);
    setEventStatus(ctx, item.eventId, "cancelled", user);
    const payload = { kind: "provision", id: item.id, recordId: record.id, accountId: record.party, accountName: record.accountName, date: item.date, amountMinor: item.amountMinor, note: item.note, eventId: item.eventId };
    trash?.add({ kind: "doubtful-provision", ref: item.id, title: record.accountName, detail: `Karşılık ${tl(item.amountMinor)} · ${dayText(item.date)}`, payload, user });
    return { provision: payload };
  }
  function removeWriteOff(ctx, { user, accountId, did, entryId }) {
    const record = recordRow(did, { accountId });
    const entry = store.get("SELECT * FROM account_entries WHERE id = ? AND source = 'doubtful' AND source_id = ? AND account_id = ?", text(entryId).slice(0, 120), record.id, record.party);
    if (!entry) throw new HttpError(404, "Değersiz Alacak satırı bulunamadı.", { code: "doubtful-writeoff-missing" });
    period.assertOpen(entry.date, "Değersiz Alacak satırı");
    const head = store.get("SELECT id FROM fin_events WHERE type = 'doubtful_writeoff' AND src_table = 'account_entries' AND src_id = ? AND status = 'active'", entry.id);
    accounts().doubtfulEntry.remove(entry.id);
    setEventStatus(ctx, head?.id, "cancelled", user);
    const payload = { kind: "writeoff", id: entry.id, recordId: record.id, accountId: record.party, accountName: record.accountName, date: entry.date, amountMinor: toMinor(Number(entry.amount) || 0), entry, eventId: head?.id || "" };
    assertNoConflict(record.party, "Değersiz Alacak satırı");
    trash?.add({ kind: "doubtful-writeoff", ref: entry.id, title: record.accountName, detail: `Değersiz alacak ${tl(payload.amountMinor)} · ${dayText(entry.date)}`, payload, user });
    return { writeOff: payload };
  }
  /** Silinenler'den geri yükleme (routes/trash.mjs; bank.post op 'restore' içinde): aynı kimlik, tarih ve tutarla. */
  function restore(ctx, { user, payload }) {
    const kind = payload?.kind;
    if (kind === "record") {
      const row = store.get("SELECT * FROM doubtful_receivables WHERE id = ?", payload.id);
      if (!row || row.status !== "cancelled") throw new HttpError(404, "Bu şüpheli alacak kaydı zaten geri yüklenmiş.");
      period.restoreDate(row.date, "Bu şüpheli alacak kaydı");
      if (payload.status === "released" && payload.closedDate) period.restoreDate(payload.closedDate, "Bu kaydın çıkarılması");
      const account = liveAccount(row.account_id);
      store.run("UPDATE doubtful_receivables SET status = ?, closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", payload.status === "released" ? "released" : "open", payload.status === "released" ? payload.closedDate || "" : "", payload.status === "released" ? payload.closeEventId || "" : "", byId(user), stamp(), row.id);
      bank.assertWrittenNonMoney("doubtful_receivables", row.id);
      // Yargıç 2.3.0 #4 (15.10.2026): önceki ön denetim kayıt tutarını bugünkü bakiyeyle kıyaslıyor, ayırma kuralının (K3) bu kayda düşüreceği
      // tahsilatı saymıyordu (tahsilatlı kayıt kalıcı 409). Şimdi kayıt geri yüklenmiş hâliyle (aynı işlemde) denetlenir: carinin normal alacağı
      // (120 = kart − açık şüpheli) eksiye düşerse 409, işlem geri alınır; tam kapı (doubtful:balance) aynı kuralı ayrıca koşar.
      if (payload.status !== "released") {
        const room = headroom(account.id);
        if (room.roomMinor < 0) throw new HttpError(409, `Kayıt geri yüklenemez: carinin borç bakiyesi (${tl(room.balanceMinor)}) geri yüklenen kayıtla birlikte açık şüpheli tutarı (${tl(room.openMinor)}) artık karşılamıyor; carinin 120 bakiyesi ${tl(room.roomMinor)} olurdu. Önce carinin tahsilat/alacak satırlarını ya da öbür şüpheli kayıtlarını düzeltin.`, { code: "doubtful-exceeds-balance", balanceMinor: room.balanceMinor, openMinor: room.openMinor });
      }
      setEventStatus(ctx, row.event_id, "active", user);
      if (payload.status === "released") setEventStatus(ctx, payload.closeEventId, "active", user);
      for (const item of payload.provisions || []) {
        period.restoreDate(item.date, "Bu kaydın karşılığı");
        store.run("UPDATE doubtful_provisions SET status = 'active', updated_by = ?, updated_at = ? WHERE id = ? AND status = 'cancelled'", byId(user), stamp(), item.id);
        bank.assertWrittenNonMoney("doubtful_provisions", item.id);
        setEventStatus(ctx, item.eventId, "active", user);
      }
      // Kontrol turu 2 K2 (15.10.2026): geri yükleme de silme gibi carinin öbür kayıtlarını (çıkarma başlığı, değersiz satırı) bozabilir → açık 409.
      assertNoConflict(account.id, "Şüpheli alacak kaydı", "geri yüklenemez");
      return { id: row.id, accountId: row.account_id, message: `“${account.name}” şüpheli alacak kaydı (${tl(row.amount_minor)}) geri geldi.` };
    }
    if (kind === "provision") {
      const row = store.get("SELECT * FROM doubtful_provisions WHERE id = ?", payload.id);
      if (!row || row.status !== "cancelled") throw new HttpError(404, "Bu karşılık kaydı zaten geri yüklenmiş.");
      period.restoreDate(row.date, "Bu karşılık");
      const { record, state } = openRecord(payload.accountId, row.doubtful_id);
      if (state.provision + Number(row.amount_minor) > state.remaining) throw new HttpError(409, `Karşılık geri yüklenemez: kalan şüpheli tutar (${tl(state.remaining)}) karşılığı (${tl(row.amount_minor)}${state.provision ? ` + ayrılmış ${tl(state.provision)}` : ""}) artık karşılamıyor.`, { code: "doubtful-provision-exceeds" });
      store.run("UPDATE doubtful_provisions SET status = 'active', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), row.id);
      bank.assertWrittenNonMoney("doubtful_provisions", row.id);
      setEventStatus(ctx, row.event_id, "active", user);
      return { id: row.id, accountId: record.party, message: `“${record.accountName}” karşılığı (${tl(row.amount_minor)}) geri geldi.` };
    }
    if (kind === "writeoff") {
      if (store.get("SELECT 1 AS found FROM account_entries WHERE id = ?", payload.id)) throw new HttpError(404, "Bu Değersiz Alacak satırı zaten geri yüklenmiş.");
      period.restoreDate(payload.date, "Bu Değersiz Alacak satırı");
      // 2.5.1 M2 — S269 = A: 'kayıt kapalı' denetimi sınırdan SONRA; sınır Değersiz Yaz'ınkiyle AYNI işlev (writeOffLimitOf), satırın kendi yazım anıyla (geri yüklenen satır o anla sıralanır).
      const record = recordRow(payload.recordId, { accountId: payload.accountId });
      assertWriteOffLimit(record, payload.date, Number(payload.amountMinor), { at: payload.entry?.created_at || undefined, restoring: true });
      const before = writeOffOutside(record);
      accounts().doubtfulEntry.reinsert(user, payload.entry);
      assertWriteOffFits(record, payload.id, Number(payload.amountMinor), before, why => new HttpError(409, `Değersiz Alacak satırı geri yüklenemez: ${why}.`, { code: "doubtful-writeoff-exceeds" }));
      setEventStatus(ctx, payload.eventId, "active", user);
      return { id: payload.id, accountId: record.party, message: `“${record.accountName}” değersiz alacak satırı (${tl(payload.amountMinor)}) geri geldi.` };
    }
    throw new HttpError(400, "Bilinmeyen öğe.");
  }
  /** Cari silinmeden önce (routes/accounts.mjs): şüpheli alacak kaydı olan cari silinmez (defter izi; açık ya da kapanmış). */
  function assertNone(accountId, what = "silinemez", hint = "Önce kayıtları silin ya da cariyi pasife alın.") {
    if (!hasDoubtful(store)) return;
    const n = Number(store.get("SELECT COUNT(*) AS n FROM doubtful_receivables WHERE account_id = ? AND status <> 'cancelled'", accountId)?.n) || 0;
    if (n) throw new HttpError(409, `Bu carinin ${n} şüpheli alacak kaydı var; cari ${what}. ${hint}`, { code: "account-doubtful-open", count: n });
  }
  /** Cari satırının (account_entries) ayırma kuralıyla şüpheli kayıtlara düşen kuruşu (kontrol turu 2 K3; routes/accounts.mjs assertNormalRoom). */
  const allocatedMinor = (accountId, entryId) => (doubtfulState(store, { parties: [accountId] }).allocations.get(`account:${entryId}`)?.records || []).reduce((sum, item) => sum + item.minor, 0);
  return { recordRow, listFor, writeOffQuote, report, summary: accountId => doubtfulSummary(store, accountId), openByAccount: (options = {}) => doubtfulOpenByAccount(store, options), headroom, allocatedMinor, take, release, provision, writeOff, remove, removeProvision, removeWriteOff, restore, assertNone, statusOf: doubtfulStatusOf };
}
