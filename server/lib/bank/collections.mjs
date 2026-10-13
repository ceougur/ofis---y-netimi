// Bankaya Tahsile Ver / Bankadan Geri Al (v2.2.0; docs/BANKA-MODULU-PLAN.md §3.14, §3.6, §3.7 #21, §3.11 cheque:collections, §5.2, §5.5,
// §7, §10.6 h). Kullanıcı (12.10.2026): müşteri taleplerindeki öneriler uygulanır — SENET de bankaya tahsile verilir (plan "alınan çek" der;
// senet için aynı kural: bankalar senedi de tahsile alır, yevmiyesi aynı 101 hesabındadır).
//
// İz (plan §3.14): cheque_events'e HİÇ satır yazılmaz (kind CHECK'i, migrations.mjs) ve cheques.status "portfolio" kalır. İz iki yerde:
//   cheque_collections (cheque_id, bank_account_id, given_date, status, closed_date, event_id, close_event_id)
//   fin_events         (cheque_deposit / cheque_withdraw; para satırı yok, src_table "cheque_collections", src_id = kayıt, cheque_id dolu)
// Kayıt durumları: pending (Bankada Tahsilde) → collected (Tahsil Edildi; close_event_id = tahsil olayının İşlem No'lu başlığı) |
//   withdrawn (Bankadan Geri Al; close_event_id = cheque_withdraw başlığı) | returned (Karşılıksız, bankadan döndü; close_event_id =
//   cheque_withdraw başlığı, origin_key "cheque-return:<karşılıksız olayı>").
// Yevmiye (lib/general-ledger.mjs; 101 alt hesapları bu kayıtlardan türetilir): verilme B 101.02 / A 101.01 (verilme günü); Bankadan Geri Al ve
//   karşılıksız kapanışı B 101.01 / A 101.02 (kapanış günü); kaydı kapatan tahsil olayı B 102.x / A 101.02; öbür 101 satırları 101.01.
//   KARAR (plan "mevcut bounce maddesinde A 101.02"): karşılıksız kapanış ayrı madde (B 101.01 / A 101.02) + mevcut karşılıksız maddesi (A 101.01)
//   — net etki aynı; taksite sayılmış çekte karşılıksız maddesi taksit tahsilatının ters kaydıdır (doğrulama T11), tek kural hepsini kapsar.
// Bütün yazımlar çek rotasının bank.post işleminde (write geri çağrısı) yapılır: olay, kayıt, işlem geçmişi ve istek kimliği birlikte ya da hiç.
import { createHash } from "node:crypto";
import { DOCUMENT_SUB_NAMES, documentGlSql } from "../cheque-gl.mjs";
import { STATUSES } from "../cheques.mjs";
import { HttpError, limited, text } from "../http.mjs";
import { toMinor } from "../minor.mjs";
import { newEventId, nextEventNo } from "./event-no.mjs";

export const CHEQUE_SUB = Object.freeze({ portfolio: "101.01", bank: "101.02" });
// 2.2.0 İz 4.2 (plan §3.11a): senet 121.01 / 121.02 — adlar ve hesap kuralı tek yerde (lib/cheque-gl.mjs).
export const CHEQUE_SUB_NAMES = DOCUMENT_SUB_NAMES;
export const BANK_ACTIONS = Object.freeze({ "bank-deposit": "Bankaya Tahsile Ver", "bank-withdraw": "Bankadan Geri Al" });
export const COLLECTION_LABELS = Object.freeze({ pending: "Bankada Tahsilde", collected: "Tahsil Edildi", withdrawn: "Bankadan Geri Alındı", returned: "Karşılıksız Döndü" });
const DEPOSIT_KINDS = new Set(["demand", "commercial", "other"]);
const INSTRUMENT = { cheque: "Çek", note: "Senet" };
const dayText = iso => (iso ? String(iso).split("-").reverse().join(".") : "");
const labelOf = row => `${row.bank_name} · ${row.name}`;

// v2.2.0 (İz 2.6, kullanıcı 12.10.2026): alınan çek yalnız "Çek Kullan", alınan senet yalnız "Senet Kullan" işaretli hesaba tahsile verilir.
const DEPOSIT_FLAGS = Object.freeze({ cheque: { column: "use_cheque", name: "Çek Kullan", what: "çek" }, note: { column: "use_note", name: "Senet Kullan", what: "senet" } });

/**
 * Bankaya tahsile verilecek evrak için hesap uygunluğu — TEK kural (seçici, rota ve testler bunu kullanır). Uygun: silinmemiş, etkin, TL, türü
 * Vadesiz / Ticari / Diğer ve evrak türünün işareti (çekte "Çek Kullan", senette "Senet Kullan"; İz 2.6). instrument: "cheque" | "note".
 * existing (true): ZATEN tahsile verilmiş evrakın hesabı (Tahsil Edildi, karşılıksızın Geri Al'ı, açılış onarımı) — işaret aranmaz: hesabın işareti
 * sonradan kaldırılsa da bankadaki evrak tahsil edilir, geri alınır, karşılıksız yapılır; yalnız YENİ tahsile verme işarete bağlıdır.
 * Dönüş: { ok: true } ya da { ok: false, status, code, reason }.
 */
export function depositEligibility(row, { instrument = "cheque", existing = false } = {}) {
  if (!row || row.deleted_at) return { ok: false, status: 404, code: "bank-account-missing", reason: "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir." };
  if (row.status !== "active") return { ok: false, status: 400, code: "bank-account-invalid", reason: `${labelOf(row)} pasif; bu hesaba evrak tahsile verilmez. Önce Banka → Hesaplar'dan Etkinleştir.` };
  if (row.currency !== "TRY") return { ok: false, status: 400, code: "bank-currency", reason: `${labelOf(row)} ${row.currency} hesabı; çek ve senet yalnız TL hesaba tahsile verilir.` };
  if (!DEPOSIT_KINDS.has(row.kind)) return { ok: false, status: 400, code: "bank-account-invalid", reason: `${labelOf(row)}: çek ve senet yalnız Vadesiz, Ticari ya da Diğer TL hesaba tahsile verilir.` };
  if (!existing) {
    const flag = DEPOSIT_FLAGS[instrument] || DEPOSIT_FLAGS.cheque;
    if (!Number(row[flag.column])) return { ok: false, status: 400, code: "bank-account-flag", reason: `${labelOf(row)} hesabında “${flag.name}” işaretli değil; ${flag.what} yalnız “${flag.name}” işaretli hesaba tahsile verilir. Önce hesabın Düzenle'sinden “${flag.name}”ı işaretleyin ya da başka hesap seçin.` };
  }
  return { ok: true };
}

/**
 * Tahsildeki evrakın banka hesabı bugün tahsile uygun değilse nedeni ve yolu; uygunsa null. Yeni sürümde tahsildeki evrakın hesabı silinmez,
 * pasife alınmaz, türü değişmez (assertNoPendingCollections) — bunu yalnız eski sürüm (v2.1.0, tahsil kaydını bilmez) yapabilir. Doğrulama tur 2
 * E2–E4: Tahsil Edildi "Banka hesabı bulunamadı" (404) ya da genel havale metniyle reddediliyor, yol söylenmiyordu; açılış onarımı uyarmıyordu.
 */
export function depositAccountProblem(row, instrument = "cheque") {
  const check = depositEligibility(row, { instrument, existing: true });
  if (check.ok) return null;
  const way = "Çek / Senet'ten Bankadan Geri Al'ıp evrakı uygun bir hesaba yeniden tahsile verin";
  const reason = !row || row.deleted_at
    ? `banka hesabı silinmiş; tahsil o hesaba yazılamaz — ${way}`
    : row.status !== "active"
      ? `banka hesabı (${labelOf(row)}) pasif; Banka → Hesaplar'dan Etkinleştirin ya da ${way}`
      : `banka hesabı (${labelOf(row)}) tahsile uygun değil (çek ve senet yalnız Vadesiz, Ticari ya da Diğer TL hesapta tahsil edilir) — ${way}`;
  return { status: check.status === 404 ? 409 : check.status, code: check.code, reason };
}

/**
 * @param {{ store, bank, period, now: () => Date }} options  bank: banka çekirdeği (lib/bank/post.mjs; yazılan satırın para satırı olmadığı
 *   denetimi — K6 "para-disi" yazıcı); period: hareket tarihi ve dönem kilidi (lib/period.mjs)
 */
export function createChequeCollections({ store, bank, period, now }) {
  const stamp = () => now().toISOString();
  let ready = false;
  const has = () => (ready ||= Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")));
  const VIEW_SQL = `SELECT k.id, k.cheque_id AS chequeId, k.bank_account_id AS bankAccountId, k.given_date AS givenDate, k.status, k.closed_date AS closedDate,
      k.event_id AS eventId, k.close_event_id AS closeEventId, COALESCE(a.bank_name, '') AS bankName, COALESCE(a.name, '') AS accountName, COALESCE(a.code, '') AS accountCode,
      COALESCE(e.no, '') AS eventNo, COALESCE(c.no, '') AS closeEventNo
    FROM cheque_collections k LEFT JOIN bank_accounts a ON a.id = k.bank_account_id LEFT JOIN fin_events e ON e.id = k.event_id LEFT JOIN fin_events c ON c.id = k.close_event_id AND k.close_event_id <> ''`;
  const view = row =>
    row && {
      ...row,
      statusLabel: COLLECTION_LABELS[row.status] || row.status,
      bankLabel: row.bankName || row.accountName ? `${row.bankName} · ${row.accountName}` : "",
      label: `Bankada Tahsilde · ${row.bankName || row.accountName || "Banka"} · ${dayText(row.givenDate)}`,
    };

  /** Çekin bekleyen (bankada tahsilde) kaydı ya da null. */
  const pendingOf = chequeId => (has() ? view(store.get(`${VIEW_SQL} WHERE k.cheque_id = ? AND k.status = 'pending'`, chequeId)) || null : null);
  /** Bütün bekleyen kayıtlar (çek kimliği → görünüm): liste, akış ve özet tek sorguda. */
  function pendingMap() {
    const out = new Map();
    if (!has()) return out;
    for (const row of store.all(`${VIEW_SQL} WHERE k.status = 'pending'`)) out.set(row.chequeId, view(row));
    return out;
  }
  /** Çekin bütün tahsil kayıtları (kartın geçmişi; eskiden yeniye). */
  const historyOf = chequeId => (has() ? store.all(`${VIEW_SQL} WHERE k.cheque_id = ? ORDER BY k.rowid`, chequeId).map(view) : []);

  /** Seçicinin hesapları (yalnız YENİ tahsile vermeye uygunlar — işaret dahil; sıra Banka → Hesaplar'daki gibi). Bakiye dönmez. */
  function choices({ instrument = "cheque" } = {}) {
    if (!has()) return [];
    return store
      .all("SELECT * FROM bank_accounts WHERE deleted_at IS NULL ORDER BY position, created_at")
      .filter(row => depositEligibility(row, { instrument }).ok)
      .map(row => ({ id: row.id, code: row.code, bankName: row.bank_name, name: row.name, label: `${labelOf(row)} (${row.code})` }));
  }
  /** Hesabı seç: verilen kimlik uygunluktan geçer; verilmezse tek uygun hesap kendiliğinden, yoksa ya da birden çoksa 400. */
  function pickAccount(value, instrument) {
    const id = text(value ?? "").slice(0, 120);
    if (id) {
      const row = store.get("SELECT * FROM bank_accounts WHERE id = ?", id);
      const check = depositEligibility(row, { instrument });
      if (!check.ok) throw new HttpError(check.status, check.reason, { code: check.code, field: "bankAccountId", accountId: id });
      return row;
    }
    const list = choices({ instrument });
    if (list.length === 1) return store.get("SELECT * FROM bank_accounts WHERE id = ?", list[0].id);
    if (!list.length) {
      const flag = DEPOSIT_FLAGS[instrument] || DEPOSIT_FLAGS.cheque;
      throw new HttpError(400, `Evrakı bankaya tahsile vermek için önce “${flag.name}” işaretli, etkin bir TL Vadesiz, Ticari ya da Diğer hesap tanımlayın (Banka → hesap → Düzenle'den “${flag.name}”ı işaretleyin).`, { code: "bank-account-required", field: "bankAccountId" });
    }
    throw new HttpError(400, "Banka Hesabı seçin: evrak hangi bankaya tahsile verildi?", { code: "bank-account-required", field: "bankAccountId" });
  }
  /** Tahsildeki evrak değişmez (ciro, silme, tutar, tarih, vade, cari, fatura iptali): 409 cheque-deposited. */
  function assertNotDeposited(cheque, what = "") {
    const pending = pendingOf(cheque.id);
    if (!pending) return;
    const kind = INSTRUMENT[cheque.instrument] || "Çek";
    throw new HttpError(409, `${kind}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} ${pending.bankName || "bankada"} tahsilde (${dayText(pending.givenDate)}); ${what || "bu işlem yapılamaz"}. Önce Bankadan Geri Al'ın.`, { code: "cheque-deposited", chequeId: cheque.id, collectionId: pending.id });
  }

  /**
   * Doğrulama D4 (plan §3.14 "tahsile verme tarihi alış tarihinden önce olamaz"): evrakın alış tarihi, herhangi bir tahsil kaydının (geri alınmış
   * olsa da) veriliş gününden sonraya alınamaz — yevmiyede evrak alınmadan bankaya verilmiş görünürdü (101.01 ara dönemde eksi).
   */
  function assertIssueBeforeDeposits(cheque, issueDate) {
    if (!has() || !issueDate) return;
    const first = store.get("SELECT MIN(given_date) AS d FROM cheque_collections WHERE cheque_id = ?", cheque.id)?.d || "";
    if (first && issueDate > first) {
      throw new HttpError(409, `Alış tarihi, evrakın bankaya tahsile verildiği tarihten (${dayText(first)}) sonra olamaz. Tarih ${dayText(first)} ya da öncesi olmalı.`, { code: "date-after-deposit", field: "issueDate", depositDate: first });
    }
  }

  // İşlem başlığı (para satırı yok): bank.post'un işleminde (ctx); dokunulan olaylara girer (kapı, K6).
  function openEvent(ctx, { type, date, record, accountId, cheque, description, originKey = "" }) {
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = newEventId();
    const minor = toMinor(Math.abs(Number(cheque.amount) || 0));
    store.run(
      `INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, origin_key, src_table, src_id, bank_ref, direction, amount_minor, try_minor, currency, method, party_id, cheque_id, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 'cheque_collections', ?, ?, '', ?, ?, 'TRY', '', ?, ?, ?, ?, ?)`,
      id, year, seq, no, type, date, originKey ? "system" : "manual", originKey, record, accountId, minor, minor, String(cheque.accountId || ""), cheque.id, String(description || "").slice(0, 300), ctx?.user?.id || "system", stamp(),
    );
    // K6 "para-disi": yazılan başlık para satırı değildir (NON_MONEY_TYPES; bank_lines'ı yok).
    bank.assertWrittenNonMoney("fin_events", id);
    ctx?.events?.add(id);
    ctx?.created?.add(id);
    return { id, no };
  }
  const describe = (cheque, head, note = "") => [head, `${INSTRUMENT[cheque.instrument] || "Çek"}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""}`, cheque.bank, `vade ${dayText(cheque.dueDate)}`, note].filter(Boolean).join(" · ");

  /**
   * Bankaya Tahsile Ver (§3.14): yalnız portföydeki ALINAN çek ve senet. Tarih: hareket tarihi kuralı (ileri 400, kilitli 409) ve alış tarihinden
   * önce olamaz. Yazılanlar: cheque_collections (pending) + fin_events (cheque_deposit). Dönüş: { record, event, account }.
   */
  function deposit(ctx, { cheque, body = {} }) {
    if (cheque.direction !== "in" || cheque.status !== "portfolio") {
      throw new HttpError(409, `Yalnız portföydeki alınan çek ve senet bankaya tahsile verilir (bu evrak: ${cheque.direction === "in" ? STATUSES[cheque.status]?.label || cheque.status : "verilen"}).`, { code: "cheque-not-in-portfolio" });
    }
    assertNotDeposited(cheque, "ikinci kez tahsile verilemez");
    const date = period.movementDate({ date: body.date }, { label: "Tahsile Veriliş Tarihi" });
    if (date < cheque.issueDate) throw new HttpError(400, `Tahsile veriliş tarihi, evrakın alış tarihinden (${dayText(cheque.issueDate)}) önce olamaz.`, { code: "date-before-receive", field: "date" });
    const account = pickAccount(body.bankAccountId, cheque.instrument);
    // Doğrulama T8/D5 (B1 kuralı: hesabın uygunluğu satırın TARİHİNDE): hesabın açılışından önce program o hesabı tutmaz; tahsile verme de
    // kabul edilmez. Önceden verme 200 alıyor, aynı tarihteki tahsil 409 bank-before-opening alıyor ve "Hesapsız seçin" öneriyordu (tahsildeki
    // evrakta hesapsız seçim 400). Evrak açılıştan önce bankaya verildiyse ve hâlâ tahsildeyse veriliş tarihi açılış günü yazılır.
    if (account.opening_date && date < account.opening_date) {
      throw new HttpError(409, `Tahsile veriliş tarihi (${dayText(date)}) ${labelOf(account)} hesabının açılışından (${dayText(account.opening_date)}) önce; program bu hesabı o tarihte tutmuyor. Evrak açılıştan önce bankaya verildiyse ve hâlâ tahsildeyse veriliş tarihini açılış günü (${dayText(account.opening_date)}) ya da sonrası yazın (ya da hesabın açılış tarihini Banka → Hesap Detayı → Açılışı Düzelt ile öne alın); açılıştan önce tahsil edildiyse tahsili Banka Hesabı alanında "Hesapsız (Açılıştan Önce)" seçerek kaydedin.`, { code: "bank-before-opening", field: "date", accountId: account.id });
    }
    const note = limited(body.note ?? "", 300, "Açıklama");
    const record = `chqcol-${newEventId().slice(3)}`;
    const event = openEvent(ctx, { type: "cheque_deposit", date, record, accountId: account.id, cheque, description: describe(cheque, `Bankaya tahsile verildi (${labelOf(account)})`, note) });
    store.run(
      "INSERT INTO cheque_collections (id, cheque_id, bank_account_id, given_date, status, closed_date, event_id, close_event_id, created_by, created_at) VALUES (?, ?, ?, ?, 'pending', '', ?, '', ?, ?)",
      record, cheque.id, account.id, date, event.id, ctx?.user?.id || "system", stamp(),
    );
    bank.assertWrittenNonMoney("cheque_collections", record);
    return { record, event, account, date, note };
  }

  /** Bankadan Geri Al (§3.14): kayıt withdrawn + fin_events (cheque_withdraw). Tarih hareket kuralıyla; verilme tarihinden önce olamaz. */
  function withdraw(ctx, { cheque, body = {} }) {
    const pending = pendingOf(cheque.id);
    if (!pending) throw new HttpError(409, `${INSTRUMENT[cheque.instrument] || "Çek"}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} bankada tahsilde değil; geri alınacak tahsil kaydı yok.`, { code: "cheque-not-deposited" });
    const date = period.movementDate({ date: body.date }, { label: "Geri Alış Tarihi" });
    if (date < pending.givenDate) throw new HttpError(400, `Geri alış tarihi, evrakın bankaya tahsile verildiği tarihten (${dayText(pending.givenDate)}) önce olamaz.`, { code: "date-before-deposit", field: "date" });
    const note = limited(body.note ?? "", 300, "Açıklama");
    const event = openEvent(ctx, { type: "cheque_withdraw", date, record: pending.id, accountId: pending.bankAccountId, cheque, description: describe(cheque, `Bankadan geri alındı (${pending.bankLabel})`, note) });
    store.run("UPDATE cheque_collections SET status = 'withdrawn', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'pending'", date, event.id, ctx?.user?.id || "system", stamp(), pending.id);
    bank.assertWrittenNonMoney("cheque_collections", pending.id);
    return { record: pending.id, event, previous: pending, date, note };
  }

  /**
   * Tahsil Edildi / Karşılıksız (mevcut eylemler) tahsildeki evrakta: tarih verilme tarihinden önce olamaz; tahsilde yol bank ve hesap tahsil
   * kaydının hesabı (ön seçili; başka hesap ya da nakit 400). Dönüş: bekleyen kayıt (yoksa null) ve tahsilin hesap kimliği.
   */
  function forAction(cheque, action, { date, body = {} }) {
    const pending = pendingOf(cheque.id);
    if (!pending) return { pending: null, value: body.bankAccountId };
    if (action === "endorse") assertNotDeposited(cheque, "ciro edilemez");
    if (date < pending.givenDate) throw new HttpError(400, `İşlem tarihi, evrakın bankaya tahsile verildiği tarihten (${dayText(pending.givenDate)}) önce olamaz.`, { code: "date-before-deposit", field: "date" });
    if (action === "collect") {
      const problem = depositAccountProblem(store.get("SELECT * FROM bank_accounts WHERE id = ?", pending.bankAccountId), cheque.instrument);
      if (problem) throw new HttpError(problem.status, `${INSTRUMENT[cheque.instrument] || "Çek"}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} ${pending.bankName || "bankada"} tahsilde; ${problem.reason}.`, { code: problem.code, field: "bankAccountId", accountId: pending.bankAccountId });
      if (body.method !== undefined && body.method !== null && text(body.method) !== "" && text(body.method) !== "bank") {
        throw new HttpError(400, `Bu evrak ${pending.bankLabel} hesabında tahsilde; tahsil bankadan (Havale / EFT) olur. Elden (nakit) tahsil edildiyse önce Bankadan Geri Al'ın.`, { code: "cheque-deposited-method", field: "method" });
      }
      const given = body.bankAccountId === undefined || body.bankAccountId === null ? "" : text(body.bankAccountId);
      if (given && given !== pending.bankAccountId) {
        throw new HttpError(400, `Bu evrak ${pending.bankLabel} hesabında tahsilde; tahsil o hesaba yazılır. Başka bankaya verildiyse önce Bankadan Geri Al'ıp doğru hesaba tahsile verin.`, { code: "cheque-deposited-account", field: "bankAccountId", accountId: pending.bankAccountId });
      }
    }
    return { pending, value: pending.bankAccountId };
  }
  /** Tahsil olayı kaydı kapatır (collected; close_event_id = tahsil olayının başlığı). */
  function closeCollected(ctx, pending, { date, eventId }) {
    if (!pending) return;
    if (!eventId) throw new TypeError("Tahsil olayının işlem başlığı yok");
    store.run("UPDATE cheque_collections SET status = 'collected', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'pending'", date, eventId, ctx?.user?.id || "system", stamp(), pending.id);
    bank.assertWrittenNonMoney("cheque_collections", pending.id);
  }
  /** Karşılıksız (bankadan döndü): kapanış başlığı (cheque_withdraw, origin_key = karşılıksız olayı) + kayıt returned. */
  function closeReturned(ctx, pending, { cheque, date, chequeEventId, note = "" }) {
    if (!pending) return;
    const event = openEvent(ctx, { type: "cheque_withdraw", date, record: pending.id, accountId: pending.bankAccountId, cheque, description: describe(cheque, `Karşılıksız döndü (${pending.bankLabel})`, note), originKey: `cheque-return:${chequeEventId}` });
    store.run("UPDATE cheque_collections SET status = 'returned', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'pending'", date, event.id, ctx?.user?.id || "system", stamp(), pending.id);
    bank.assertWrittenNonMoney("cheque_collections", pending.id);
  }
  /**
   * Son işlemi Geri Al (tahsil ya da karşılıksız): o işlemin kapattığı tahsil kaydı yeniden bekleyen olur; karşılıksız kapanış başlığı iptal edilir.
   * last: geri alınan cheque_events satırı (id, kind). Dönüş: yeniden açılan kaydın kimliği ya da "".
   */
  function reopenFor(ctx, chequeId, last) {
    if (!has() || !last) return "";
    let record = null;
    if (last.kind === "collect") {
      const eventId = store.get("SELECT event_id AS e FROM cheque_events WHERE id = ?", last.id)?.e || "";
      if (eventId) record = store.get("SELECT id FROM cheque_collections WHERE cheque_id = ? AND status = 'collected' AND close_event_id = ?", chequeId, eventId);
    } else if (last.kind === "bounce") {
      const event = store.get("SELECT id, src_id AS record FROM fin_events WHERE origin_key = ? AND status = 'active'", `cheque-return:${last.id}`);
      if (event) {
        record = store.get("SELECT id FROM cheque_collections WHERE id = ? AND status = 'returned' AND close_event_id = ?", event.record, event.id);
        if (record) {
          store.run("UPDATE fin_events SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", ctx?.user?.id || "system", stamp(), event.id);
          bank.assertWrittenNonMoney("fin_events", event.id);
          ctx?.events?.add(event.id);
        }
      }
    }
    if (!record) return "";
    // Doğrulama D3: karşılıksızın geri alınması kaydı yeniden "Bankada Tahsilde" yapar; hesabı bugün de tahsile uygun olmalı (tek kural:
    // depositEligibility). Karşılıksızdan sonra hesap pasife alınabiliyor ya da türü Vadeli'ye çevrilebiliyordu (hesapta para hareketi yok);
    // Geri Al kaydı o hesapta yeniden açıyor, sonra Tahsil Edildi 400 alıyordu (çıkış yalnız Bankadan Geri Al). Tahsilin geri alınmasında
    // hesabın para satırı vardır: pasif hesap 400 bank-account-passive (bank.post), tür değişikliği ve silme zaten engelli.
    if (last.kind === "bounce") {
      const own = store.get("SELECT k.bank_account_id AS accountId, c.instrument FROM cheque_collections k LEFT JOIN cheques c ON c.id = k.cheque_id WHERE k.id = ?", record.id);
      const check = depositEligibility(store.get("SELECT * FROM bank_accounts WHERE id = ?", own?.accountId || ""), { instrument: own?.instrument || "cheque", existing: true });
      if (!check.ok) throw new HttpError(check.status === 404 ? 409 : check.status, `Karşılıksızı geri almak evrakı yeniden bankada tahsilde yapar; ${check.reason}`, { code: check.code, accountId: own?.accountId || "" });
    }
    store.run("UPDATE cheque_collections SET status = 'pending', closed_date = '', close_event_id = '', updated_by = ?, updated_at = ? WHERE id = ?", ctx?.user?.id || "system", stamp(), record.id);
    bank.assertWrittenNonMoney("cheque_collections", record.id);
    return record.id;
  }
  return { pendingOf, pendingMap, historyOf, choices, pickAccount, assertNotDeposited, assertIssueBeforeDeposits, deposit, withdraw, forAction, closeCollected, closeReturned, reopenFor };
}

/**
 * Zil / takvim ve ANLIK DURUM önbelleğinin tahsil kaydı parmak izi (routes/cheques.mjs fingerprint). Tahsildeki evrakın beklenen günü Banka
 * Ayarları'nın iş günü takviminden (yarım gün, hafta sonu, şirketin tatil ekleri) ve etiketi banka hesabının adından okunur; doğrulama tur 2
 * T13/B1: ayar ya da hesap adı değişince önbellek eski günü/adı gösteriyordu. Bekleyen kayıt yoksa yalnız kayıt tablosunun izi (ucuz).
 */
export function collectionsFingerprint(store) {
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return "";
  const own = store.get("SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS k FROM cheque_collections").k;
  const banks = store.get(
    `SELECT COUNT(*) AS n, COALESCE(GROUP_CONCAT(id || ':' || bank_name || ':' || name || ':' || COALESCE(updated_at, created_at), '|'), '') AS k
     FROM bank_accounts WHERE id IN (SELECT bank_account_id FROM cheque_collections WHERE status = 'pending')`,
  );
  if (!banks.n) return own;
  const holidays = store.get("SELECT COALESCE(GROUP_CONCAT(date || ':' || kind || ':' || name, '|'), '') AS k FROM bank_holidays")?.k || "";
  const digest = createHash("sha1").update(`${store.setting("bank.settings", "") || ""}\n${holidays}\n${banks.k}`).digest("hex").slice(0, 16);
  return `${own}|${digest}`;
}

/**
 * Açılış onarımı (lib/bank/repair.mjs h; doğrulama tur 2 E5/E6, plan §10.6): ESKİ SÜRÜMDE (tahsil kaydını bilmeyen v2.1.0) tahsildeki evrakın tahsili
 * ya da karşılıksızı Geri Al'ınmış — kayıt "Tahsil Edildi" / "Karşılıksız Döndü" kalıyor, Mutabakat Testi kalıcı kırmızı ("kapatan tahsil olayı
 * yok" ya da 101.01/101.02 farkı), evrak kartı "Portföyde" diyordu. Yeni sürümün kendi Geri Al'ı gibi (reopenFor) kayıt yeniden bekleyen olur,
 * karşılıksız kapanış başlığı iptal edilir. Kapanış günü kilitli dönemdeyse dokunulmaz: "Onarım Bekliyor" (kilit açılınca yeniden açılışta onarılır).
 * Sonra onarımın bekleyen kayıt döngüsü evrakın bugünkü hâline bakar (eski sürümde ardından ciro / silme / tahsil edildiyse kayıt kapanır).
 * Dönüş: yeniden açılan kayıtlar [{ id, was }].
 */
export function reopenLegacyClosures(store, { open = () => true, at, pending = () => {} } = {}) {
  const out = [];
  if (!at) throw new TypeError("reopenLegacyClosures: onarım anı (at) verilmeli");
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return out;
  for (const row of store.all(
    `SELECT k.id, k.status, k.closed_date AS closed, f.id AS headerId
     FROM cheque_collections k
       LEFT JOIN fin_events f ON f.id = k.close_event_id AND k.close_event_id <> '' AND f.type = 'cheque_withdraw' AND f.src_id = k.id AND f.status = 'active'
     WHERE (k.status = 'collected' AND f.id IS NULL
            AND NOT EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = k.cheque_id AND ev.kind = 'collect' AND ev.event_id <> '' AND ev.event_id = k.close_event_id))
        OR (k.status = 'returned' AND f.origin_key LIKE 'cheque-return:%'
            AND NOT EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.id = substr(f.origin_key, 15) AND ev.kind = 'bounce'))`,
  )) {
    const what = row.status === "collected" ? "tahsili" : "karşılıksızı";
    if (!open(row.closed)) {
      pending("h", row.id, `tahsildeki evrakın ${what} eski sürümde geri alındı ama kapanış günü (${dayText(row.closed)}) kapatılmış (kilitli) dönemde; kayıt yeniden açılamadı — dönem kilidi açılınca yeniden açılışta onarılır`);
      continue;
    }
    if (row.status === "returned" && row.headerId) store.run("UPDATE fin_events SET status = 'cancelled', updated_by = 'system', updated_at = ? WHERE id = ?", at, row.headerId);
    store.run("UPDATE cheque_collections SET status = 'pending', closed_date = '', close_event_id = '', updated_by = 'system', updated_at = ? WHERE id = ?", at, row.id);
    out.push({ id: row.id, was: row.status });
  }
  return out;
}

const OPENING_FIX = "hesabın açılışını Banka → Hesap Detayı → Açılışı Düzelt ile veriliş gününe ya da öncesine alın";
/**
 * Açılış onarımı (repair h; doğrulama tur 2 E1 komşusu): kapanmış (tahsil edilmiş, geri alınmış, karşılıksız) kaydın veriliş günü hesabın açılışından
 * önce — eski sürüm (tahsil kaydını bilmeyen) açılışı sonraya almış. Kayıt değişmez (kapanış ve tahsil satırı o günlerde); "Onarım Bekliyor" yolu
 * söyler. Bekleyen kayıtta onarım veriliş gününü açılış gününe alır (repair.mjs). Dönüş: [{ id, reason }].
 */
export function closedBeforeOpening(store) {
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return [];
  return store
    .all(
      `SELECT k.id, k.given_date AS given, a.opening_date AS opened FROM cheque_collections k
       JOIN bank_accounts a ON a.id = k.bank_account_id AND a.deleted_at IS NULL AND a.opening_date <> ''
       WHERE k.status <> 'pending' AND k.given_date < a.opening_date`,
    )
    .map(row => ({ id: row.id, reason: `tahsil kaydının veriliş günü (${dayText(row.given)}) hesabın açılışından (${dayText(row.opened)}) önce (açılış eski sürümde değişti); ${OPENING_FIX}` }));
}

/** Banka hesabında bekleyen (tahsildeki) evrak sayısı. */
export function pendingCollectionCount(store, accountId) {
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return 0;
  return Number(store.get("SELECT COUNT(*) AS n FROM cheque_collections WHERE bank_account_id = ? AND status = 'pending'", accountId).n) || 0;
}
/**
 * Tahsildeki evrakı olan banka hesabı silinmez, pasife alınmaz, türü/para birimi değişmez (409 bank-cheques-pending; lib/bank/accounts.mjs).
 * returned (yalnız silmede; doğrulama tur 2 A22): bu hesaptan karşılıksız dönmüş evrak da silmeyi engeller — karşılıksızın Geri Al'ı evrakı bu
 * hesapta yeniden "Bankada Tahsilde" yapar (reopenFor); hesap silinince yanlışlıkla işaretlenen karşılıksız kalıcı geri alınamıyordu. Pasife
 * alma serbest (Geri Al öncesi Etkinleştir yolu var).
 */
export function assertNoPendingCollections(store, accountId, what, { returned = false } = {}) {
  const n = pendingCollectionCount(store, accountId);
  if (n) throw new HttpError(409, `Bu hesapta bankaya tahsile verilmiş ${n} çek/senet var; hesap ${what}. Önce evrakı tahsil edin ya da Çek / Senet'ten Bankadan Geri Al'ın.`, { code: "bank-cheques-pending", count: n });
  if (!returned || !store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return;
  const back = Number(store.get("SELECT COUNT(*) AS n FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL AND c.status = 'bounced' WHERE k.bank_account_id = ? AND k.status = 'returned'", accountId).n) || 0;
  if (back) throw new HttpError(409, `Bu hesaptan karşılıksız dönmüş ${back} çek/senet var; karşılıksız Geri Al'ınırsa evrak bu hesapta yeniden tahsilde olur, hesap ${what}. Kullanılmayacaksa Pasife Alın.`, { code: "bank-cheques-returned", count: back });
}

/**
 * Mutabakat denetimi cheque:collections (§3.11 "Tahsildeki Çekler"): kuralları bozan kayıtlar [{ key, sample }].
 *   - bekleyen kaydın çeki var, silinmemiş, alınan ve "portföyde"; verilme başlığı cheque_deposit, etkin, bu kaydın, bu çekin, bu hesabın ve tutarı
 *     çekin tutarı (tahsildeyken tutar değişmez)
 *   - verilme tarihi evrakın alış tarihinden ve hesabın açılış tarihinden önce değil (§3.14 "tarih alış tarihinden önce olamaz"; doğrulama D4/D5:
 *     önceden geri alınmış kaydın alışı sonraya çekilebiliyor, yevmiyede 101.01 ara dönemde eksiye düşüyordu)
 *   - kapanmış kaydın kapanış başlığı var: tahsilde bu çekin tahsil olayının İşlem No'lu başlığı (etkin); geri almada ve karşılıksızda bu kaydın
 *     cheque_withdraw başlığı (etkin); kapanış tarihi verilme tarihinden önce değil
 *   - her etkin cheque_deposit / cheque_withdraw başlığının kaydı var ve kayıt o başlığı gösteriyor
 * scope (dokunulan varlıklar kapısı, lib/integrity-scope.mjs): { cheques } — yalnız bu evrakın kayıtları ve başlıkları (indeksli; tam kapıyla aynı
 * kural). Verilmezse bütün kayıtlar.
 */
export function collectionProblems(store, { cheques = null } = {}) {
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) return [];
  const list = cheques ? JSON.stringify([...cheques].filter(Boolean)) : null;
  if (list === "[]") return [];
  const out = [];
  const fail = (key, sample) => out.push({ key, sample });
  for (const row of store.all(
    `SELECT k.id, k.cheque_id AS chequeId, k.bank_account_id AS accountId, k.given_date AS given, k.status, k.closed_date AS closed, k.event_id AS eventId, k.close_event_id AS closeId,
            c.id AS cid, c.direction, c.status AS chequeStatus, c.deleted_at AS deletedAt, c.issue_date AS issued, CAST(ROUND(c.amount * 100) AS INTEGER) AS cents,
            e.type AS eType, e.status AS eStatus, e.src_id AS eSrc, e.cheque_id AS eCheque, e.bank_ref AS eBank, e.try_minor AS eMinor, e.date AS eDate,
            COALESCE(a.opening_date, '') AS opened
     FROM ${list ? "json_each(?) j CROSS JOIN cheque_collections k ON k.cheque_id = j.value" : "cheque_collections k"}
       LEFT JOIN cheques c ON c.id = k.cheque_id LEFT JOIN fin_events e ON e.id = k.event_id LEFT JOIN bank_accounts a ON a.id = k.bank_account_id`,
    ...(list ? [list] : []),
  )) {
    const tag = `${row.id} (${row.status})`;
    if (!["pending", "collected", "withdrawn", "returned"].includes(row.status)) fail(`${row.id}:status`, `${tag}: tanınmayan durum`);
    if (!row.eType || row.eType !== "cheque_deposit" || row.eSrc !== row.id || row.eCheque !== row.chequeId || row.eBank !== row.accountId || row.eDate !== row.given) fail(`${row.id}:given`, `${tag}: verilme başlığı yok ya da kayıtla uyuşmuyor`);
    if (row.cid && !row.deletedAt && row.issued && row.given < row.issued) fail(`${row.id}:issued`, `${tag}: verilme tarihi (${dayText(row.given)}) evrakın alış tarihinden (${dayText(row.issued)}) önce; evrakı Bankadan Geri Al'ıp Düzenle ile alış tarihini düzeltin`);
    if (row.opened && row.given < row.opened) fail(`${row.id}:opening`, `${tag}: verilme tarihi (${dayText(row.given)}) hesabın açılışından (${dayText(row.opened)}) önce; ${OPENING_FIX}`);
    if (row.status === "pending") {
      if (!row.cid || row.deletedAt || row.direction !== "in" || row.chequeStatus !== "portfolio") fail(`${row.id}:cheque`, `${tag}: tahsildeki evrak portföyde değil (${row.cid ? row.chequeStatus : "evrak yok"}${row.deletedAt ? ", silinmiş" : ""})`);
      if (row.eStatus !== "active") fail(`${row.id}:event`, `${tag}: verilme başlığı etkin değil`);
      if (row.cid && Number(row.eMinor) !== Number(row.cents)) fail(`${row.id}:amount`, `${tag}: evrak tutarı ${Number(row.cents) / 100} / verilme ${Number(row.eMinor) / 100}`);
      if (row.closed || row.closeId) fail(`${row.id}:open`, `${tag}: bekleyen kaydın kapanışı dolu`);
      continue;
    }
    if (!row.closed || !row.closeId || row.closed < row.given) {
      fail(`${row.id}:close`, `${tag}: kapanış tarihi ya da başlığı eksik`);
      continue;
    }
    if (row.status === "collected") {
      const collect = store.get("SELECT ev.id FROM cheque_events ev JOIN fin_events e ON e.id = ev.event_id WHERE ev.event_id = ? AND ev.cheque_id = ? AND +ev.kind = 'collect' AND +e.status = 'active'", row.closeId, row.chequeId);
      const repaired = store.get("SELECT id FROM fin_events WHERE id = ? AND type = 'cheque_withdraw' AND src_id = ? AND status = 'active'", row.closeId, row.id);
      if (!collect && !repaired) fail(`${row.id}:collect`, `${tag}: kapatan tahsil olayı yok`);
    } else if (!store.get("SELECT id FROM fin_events WHERE id = ? AND type = 'cheque_withdraw' AND src_id = ? AND status = 'active' AND date = ?", row.closeId, row.id, row.closed)) {
      fail(`${row.id}:withdraw`, `${tag}: kapanış başlığı (Bankadan Geri Al / karşılıksız) yok ya da kayıtla uyuşmuyor`);
    }
  }
  for (const event of store.all(
    `SELECT e.id, e.no, e.type, e.src_id AS record FROM ${list ? "json_each(?) j CROSS JOIN fin_events e ON e.cheque_id = j.value AND e.cheque_id <> ''" : "fin_events e"}
     WHERE ${list ? "+" : ""}e.type IN ('cheque_deposit', 'cheque_withdraw') AND ${list ? "+" : ""}e.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM cheque_collections k WHERE k.id = e.src_id AND ((e.type = 'cheque_deposit' AND k.event_id = e.id) OR (e.type = 'cheque_withdraw' AND k.close_event_id = e.id)))`,
    ...(list ? [list] : []),
  )) fail(`${event.id}:orphan`, `${event.no}: ${event.type === "cheque_deposit" ? "Bankaya Tahsile Ver" : "Bankadan Geri Al"} başlığının tahsil kaydı yok`);
  return out;
}

/**
 * Alt Hesap Mizanı'nın 101.01 / 101.02 (çek) ve 121.01 / 121.02 (senet; 2.2.0 İz 4.2, plan §3.11a) satırları (kuruş): alt hesap → { opening, debit,
 * credit } — Ana Defter KURULMADAN, SQL toplamıyla. Aşağıdaki 101 kuralları senette 121 için aynıdır.
 * Doğrulama tur 2 G1 (plan §3.11 madde 5 hız bütçesi; 2.1.0 hız düzeltmesi "rapor toplamları SQL'de"): önceki yol her açılışta bütün alınan
 * evrak için yevmiye kuruyordu (15.000 evrakta ~0,7 sn, ana iş parçacığında). Kurallar Ana Defter'in 101 satırlarının AYNISIDIR
 * (routes/ledger.mjs rows + lib/general-ledger.mjs journal; eşdeğerlik testi test/banka-220-tahsile-ver-tur2.test.mjs G1, beş dönem):
 *   1. çekli cari satırı (silinmemiş cari; verilen evrak 103 hariç): alacak satırı B 101.01, borç satırı A 101.01 — bankada tahsildeyken karşılıksız
 *      dönen evrakın kendi carisine borcu A 101.02
 *   2. taksite sayılan evrak (silinmemiş kart): tahsilat B 101.01 (açılış hariç); karşılıksız ters kaydı A 101.01 / 101.02 (tahsilde döndüyse)
 *   3. tahsil olayı (silinmemiş evrak): A 101.01; tahsildeki evrakın kaydını kapatan tahsil A 101.02
 *   4. cariye işlenmemiş alınan evrak (kartı da yok): alış günü B 101.01; karşılıksız (carisine borç yazılmamışsa) son karşılıksız günü A 101.01 / 101.02
 *   5. tahsil kaydı (silinmemiş evrak): verilişte B 101.02 / A 101.01; Bankadan Geri Al ve eski sürüm kapanışında B 101.01 / A 101.02 (tutar verilme
 *      başlığının kuruşu; karşılıksız ve tahsille kapanan kayıtta ayrı kapanış yok)
 * Dönem: from'dan önceki satırlar devir; to'dan sonrakiler yok; alt hesap satırı devir ya da dönem satırı varsa döner.
 * Sonuç, 2.1.0'ın saklanan toplamları gibi (lib/bank/money-lines.mjs refTotal) aynı veri için saklanır: bağlantının total_changes'ı ve data_version
 * değişince yeniden okunur; işlemin içinde okunan saklanmaz.
 */
const SUB_TRIAL_CACHE = new WeakMap();
export function chequeSubTrial(store, { from = "", to = "" } = {}) {
  const counters = typeof store.changeCounters === "function" && !store.inTransaction ? store.changeCounters() : null;
  const stamp = counters ? `${counters.total}|${counters.version}` : "";
  const key = `${from}|${to}`;
  let cache = stamp ? SUB_TRIAL_CACHE.get(store) : null;
  if (stamp && cache?.stamp !== stamp) SUB_TRIAL_CACHE.set(store, (cache = { stamp, values: new Map() }));
  if (cache?.values.has(key)) return new Map(cache.values.get(key));
  const out = computeChequeSubTrial(store, { from, to });
  if (cache && cache.values.size < 16) cache.values.set(key, out);
  return new Map(out);
}
function computeChequeSubTrial(store, { from = "", to = "" } = {}) {
  const out = new Map();
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheques'")) return out;
  const collections = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'"));
  const cents = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
  const returned = chequeColumn => (collections ? `EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = ${chequeColumn} AND k.status = 'returned')` : "0");
  // 2.2.0 İz 4.2 (plan §3.11a; lib/cheque-gl.mjs): alt hesap evrak türüne göre — çek 101.01 / 101.02, senet 121.01 / 121.02 (Ana Defter'in kuralı).
  const bank = (flag, instrument) => `CASE WHEN ${flag} THEN ${documentGlSql(instrument, "bank")} ELSE ${documentGlSql(instrument, "portfolio")} END`;
  const planInstrument = "(SELECT x.instrument FROM cheques x WHERE x.id = e.cheque_id)";
  const lines = [
    `SELECT ${bank(`e.kind = 'debt' AND c.direction = 'in' AND e.account_id = c.account_id AND ${returned("c.id")}`, "c.instrument")} AS sub, e.date AS date,
            CASE WHEN e.kind = 'debt' THEN 0 ELSE ${cents("e.amount")} END AS dr, CASE WHEN e.kind = 'debt' THEN ${cents("e.amount")} ELSE 0 END AS cr
     FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL LEFT JOIN cheques c ON c.id = e.source_id
     WHERE e.source = 'cheque' AND COALESCE(c.direction, '') <> 'out'`,
    `SELECT ${bank(`e.kind = 'out' AND ${returned("e.cheque_id")}`, planInstrument)}, e.date, CASE WHEN e.kind = 'in' THEN ${cents("e.amount")} ELSE 0 END, CASE WHEN e.kind = 'in' THEN 0 ELSE ${cents("e.amount")} END
     FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL WHERE e.cheque_id <> '' AND (e.kind = 'out' OR e.opening = 0)`,
    `SELECT ${bank(collections ? "ev.event_id <> '' AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = ev.cheque_id AND k.status = 'collected' AND k.close_event_id = ev.event_id)" : "0", "c.instrument")}, ev.date, 0, ${cents("ev.amount")}
     FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL WHERE ev.kind = 'collect'`,
    `SELECT ${documentGlSql("f.instrument", "portfolio")}, f.issue_date, ${cents("f.amount")}, 0 FROM free f
     UNION ALL
     SELECT ${bank(returned("f.id"), "f.instrument")}, f.bounced, 0, ${cents("f.amount")} FROM free f
     WHERE f.status = 'bounced' AND f.bounced IS NOT NULL AND f.bounced <> ''
       AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                       WHERE e.source = 'cheque' AND e.source_id = f.id AND e.account_id = f.account_id AND e.kind = 'debt')`,
  ];
  if (collections) {
    const amount = `COALESCE(NULLIF((SELECT d.try_minor FROM fin_events d WHERE d.id = k.event_id), 0), ${cents("c.amount")})`;
    const closes = `k.status NOT IN ('pending', 'returned') AND k.closed_date <> ''
      AND NOT (k.status = 'collected' AND k.close_event_id <> '' AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = k.cheque_id AND ev.kind = 'collect' AND ev.event_id = k.close_event_id))`;
    const atBank = documentGlSql("c.instrument", "bank");
    const portfolio = documentGlSql("c.instrument", "portfolio");
    lines.push(
      `SELECT ${atBank}, k.given_date, ${amount}, 0 FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL
       UNION ALL SELECT ${portfolio}, k.given_date, 0, ${amount} FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL
       UNION ALL SELECT ${portfolio}, k.closed_date, ${amount}, 0 FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL WHERE ${closes}
       UNION ALL SELECT ${atBank}, k.closed_date, 0, ${amount} FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL WHERE ${closes}`,
    );
  }
  // Cariye işlenmemiş alınan evrak (routes/ledger.mjs "free" sorgusunun alınan yönü): kartı ve kendi carisine alacak satırı yok.
  const free = `free AS (
    SELECT c.id, c.instrument, c.amount, c.issue_date, c.status, c.account_id,
           (SELECT ev.date FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce' ORDER BY ev.created_at DESC LIMIT 1) AS bounced
    FROM cheques c
    WHERE c.deleted_at IS NULL AND c.direction = 'in'
      AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                      WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'credit'))`;
  const rows = store.all(
    `WITH ${free}, lines(sub, date, dr, cr) AS (${lines.join("\nUNION ALL\n")})
     SELECT sub,
            SUM(CASE WHEN ?1 <> '' AND date < ?1 THEN dr - cr ELSE 0 END) AS opening,
            SUM(CASE WHEN NOT (?1 <> '' AND date < ?1) AND (?2 = '' OR date <= ?2) THEN dr ELSE 0 END) AS debit,
            SUM(CASE WHEN NOT (?1 <> '' AND date < ?1) AND (?2 = '' OR date <= ?2) THEN cr ELSE 0 END) AS credit,
            SUM(CASE WHEN (?1 <> '' AND date < ?1) OR ?2 = '' OR date <= ?2 THEN 1 ELSE 0 END) AS seen
     FROM lines WHERE dr <> 0 OR cr <> 0 GROUP BY sub ORDER BY sub`,
    String(from || ""),
    String(to || ""),
  );
  for (const row of rows) if (Number(row.seen) > 0) out.set(row.sub, { opening: Number(row.opening) || 0, debit: Number(row.debit) || 0, credit: Number(row.credit) || 0 });
  return out;
}
