// Çek / Senet (v2.0.7): alınan (müşteriden, portföy) ve verilen (kendi çekimiz/senedimiz) evrak. Cari ve taksit
// defterlerine bağlıdır; Kasa'ya yalnız tahsil ve ödeme olaylarında düşer. Kural motoru server/lib/cheques.mjs içinde
// (saf, testli); burada doğrulama, yetki ve işlem bütünlüğü vardır.
//
// Bütünlük (ACID): her yazma tek store.tx (BEGIN IMMEDIATE … COMMIT) bloğudur. Olay satırı (cheque_events), durumu
// değişen çek ve olayın defter etkileri (cari hareketi, taksit tahsilatı) birlikte yazılır; biri başarısız olursa hepsi
// geri alınır. Etkiler effects_json'da tutulur; "Geri al" bunları birebir tersine çevirir (silinen satır aynı kimlikle
// geri eklenir). İki kişi aynı çeki aynı anda işlerse ikincisi "bu arada değişti" (409) alır (beklenen durum denetimi).
import { methodInput } from "../lib/pay-method.mjs";
import { randomUUID } from "node:crypto";
import { ACTIONS, DIRECTIONS, EVENT_LABELS, INSTRUMENTS, STATUSES, dueState, initialEvent, initialStatus, mapChequeHeaders, parseDirection, parseInstrument, parseStatus, plannedEffects, portfolioSummary, transition } from "../lib/cheques.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { findHeaderRow, inferRolesByValues, sanitizeCell, validateRows } from "../lib/import-gate.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { bankForm } from "../lib/bank/module-ref.mjs";
import { canUser } from "../lib/permissions.mjs";
import { dayText, isoDay, parseDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => {
  if (!DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const MAX_IMPORT = 100_000;
const PDF_ROWS = 20_000;
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
// Geri çevrilebilir etkilerin yazılabileceği tablolar (effects_json'dan gelen ad SQL'e yalnız bu listeden girer).
const EFFECT_TABLES = new Set(["account_entries", "plan_entries"]);

export function registerChequeRoutes(router, { store, bank, auth, audit, events, period = null, cash = null, accounts = () => null, plans = () => null, bankModule = () => null, now: clock = systemClock }) {
  // İş saati (v2.1.0): context.now (config.now).
  const now = () => clock().toISOString();
  const today = () => isoDay(clock());
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const office = () => store.setting("office.name", "");
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const changed = (user, { chequeId = "", accountIds = [], planIds = [], cash = false } = {}) => {
    publish(user, { kind: "cheques", chequeId });
    for (const accountId of new Set(accountIds.filter(Boolean))) publish(user, { kind: "accounts", accountId });
    for (const planId of new Set(planIds.filter(Boolean))) publish(user, { kind: "plans", planId });
    if (cash) publish(user, { kind: "cash" });
  };
  const amountOf = value => {
    const amount = parseAmount(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Tutar sıfırdan büyük geçerli bir sayı olmalı.");
    return roundMoney(amount);
  };
  const dateOf = (value, label, fallback = "") => {
    const date = text(value) || fallback;
    if (!validDate(date)) throw new HttpError(400, `${label} için geçerli bir tarih seçin.`);
    return date;
  };
  const kindName = cheque => INSTRUMENTS[cheque.instrument] || "Çek";
  const title = cheque => `${kindName(cheque)}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""}`;

  // ---------- Okuma ----------
  const CHEQUE_SQL = `SELECT c.id, c.direction, c.instrument, c.serial_no AS serialNo, c.bank, c.drawer, c.account_id AS accountId, c.plan_id AS planId, c.amount,
      c.issue_date AS issueDate, c.due_date AS dueDate, c.status, c.status_date AS statusDate, c.endorse_account_id AS endorseAccountId, c.note,
      c.invoice_id AS invoiceId, COALESCE((SELECT i.number FROM invoices i WHERE i.id = c.invoice_id), '') AS invoiceNumber,
      c.created_by AS createdBy, c.created_at AS createdAt, c.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName,
      COALESCE(a.name, '') AS accountName, COALESCE(a.ref_no, '') AS accountRef, COALESCE(a.phone, '') AS accountPhone, COALESCE(e.name, '') AS endorseAccountName, COALESCE(p.name, '') AS planName
    FROM cheques c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN accounts a ON a.id = c.account_id AND a.deleted_at IS NULL
      LEFT JOIN accounts e ON e.id = c.endorse_account_id AND e.deleted_at IS NULL LEFT JOIN plans p ON p.id = c.plan_id AND p.deleted_at IS NULL`;
  const party = cheque => cheque.accountName || cheque.drawer || "—";
  const shapeRow = (row, day = today()) => {
    const due = dueState(row.dueDate, day);
    const open = STATUSES[row.status]?.open;
    return {
      ...row,
      party: party(row),
      directionLabel: DIRECTIONS[row.direction],
      instrumentLabel: INSTRUMENTS[row.instrument],
      statusLabel: STATUSES[row.status]?.label || row.status,
      open: Boolean(open),
      days: due.days,
      dueStateKey: open ? due.state : "closed",
    };
  };
  const chequeRow = id => {
    const row = store.get(`${CHEQUE_SQL} WHERE c.id = ? AND c.deleted_at IS NULL`, limited(id, 120, "Çek"));
    if (!row) throw new HttpError(404, "Çek/senet bulunamadı. Silinmiş olabilir.");
    return row;
  };
  const eventsOf = chequeId =>
    store.all(
      `SELECT ev.id, ev.kind, ev.date, ev.amount, ev.account_id AS accountId, COALESCE(a.name, '') AS accountName, ev.from_status AS fromStatus, ev.to_status AS toStatus, ev.note, ev.invoice_id AS invoiceId, ev.method, ev.fin_ref AS finRef,
              ev.effects_json AS effectsJson, ev.created_by AS createdBy, ev.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName
       FROM cheque_events ev LEFT JOIN users u ON u.id = ev.created_by LEFT JOIN accounts a ON a.id = ev.account_id WHERE ev.cheque_id = ? ORDER BY ev.created_at, ev.rowid`,
      chequeId,
    );
  const effectsOf = event => {
    try {
      const value = JSON.parse(event?.effectsJson || event?.effects_json || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  function detail(id, user) {
    const cheque = shapeRow(chequeRow(id));
    const history = eventsOf(cheque.id);
    const manage = canUser(user, "cheques.manage");
    const actions = manage ? Object.entries(ACTIONS).filter(([, rule]) => rule.from.includes(cheque.status)).map(([key, rule]) => ({ key, label: rule.label })) : [];
    const last = history.at(-1);
    const lock = period?.lockedUntil?.() || "";
    const coreLocked = Boolean(lock && cheque.issueDate && cheque.issueDate <= lock);
    const canEditCore = manage && history.length === 1 && !cheque.invoiceId && !coreLocked;
    // v2.0.26 (2. gözden geçirme İ3): formun giriş metni ve kartın kilit notu sunucuda, sunucunun gerçek kuralıyla (PUT/DELETE/undo)
    // aynı sırada seçilir: faturadan gelen → faturayı iptal; işlem görmüş → önce son işlemi geri al (son işlem ya da evrak kilitli
    // dönemdeyse bunun için önce kilit açılmalı); yalnız ilk olaylı ve kilitli → kilit. Önceden istemci kilit metnini öne alıyordu:
    // kilitli dönemde tahsil edilmiş çekte "kilidi açın" deniyor, kilit açılınca "önce son işlemi geri alın" 409'u geliyordu.
    const received = cheque.direction === "in" ? "alındı" : "verildi";
    const undoLocked = Boolean(lock && history.length > 1 && last.date <= lock);
    let coreNote = "";
    if (manage && !canEditCore) {
      if (cheque.invoiceId) coreNote = `Bu evrak ${cheque.invoiceNumber || "bir fatura"} ile kaydedildi; yalnız vade, no, banka ve açıklama değiştirilebilir. Tutar, cari ve tarih faturadan gelir; değiştirmek için faturayı iptal edin.`;
      else if (history.length > 1)
        coreNote = `İşlem görmüş evrakta yalnız vade, no, banka ve açıklama değiştirilebilir. Tutar, cari ve tarih için önce son işlemi geri alın.${
          undoLocked ? ` Son işlem (${EVENT_LABELS[last.kind] || last.kind}, ${dayText(last.date)}) kapatılmış (kilitli) dönemde (${dayText(lock)} ve öncesi); geri almak için önce yönetici dönem kilidini açmalı.`
          : coreLocked ? ` Evrak kapatılmış (kilitli) dönemde ${received} (${dayText(cheque.issueDate)}); işlem geri alınsa da tutar, cari ve tarih için yönetici dönem kilidini açmalı.`
          : ""}`;
      else if (coreLocked) coreNote = `Bu evrak kapatılmış (kilitli) dönemde ${received}; yalnız vade, no, banka ve açıklama değiştirilebilir. Tutar, cari ve tarih için yönetici dönem kilidini açmalı.`;
    }
    // Kartta, işlem düğmelerinin altında görünür neden (pasif/eksik düğmenin nedeni yalnız düğme ipucunda kalmasın).
    const lockNote = !manage ? ""
      : history.length === 1 && !cheque.invoiceId && coreLocked ? `Bu evrak kapatılmış (kilitli) dönemde (${dayText(lock)} ve öncesi) ${received}; silinemez, tutarı, carisi ve tarihi değişmez. Vade, no, banka ve açıklama Düzenle ile düzeltilir.`
      : undoLocked ? `Son işlem (${EVENT_LABELS[last.kind] || last.kind}, ${dayText(last.date)}) kapatılmış (kilitli) dönemde (${dayText(lock)} ve öncesi); geri alınamaz.`
      : "";
    return {
      ...cheque,
      events: history.map(({ effectsJson, ...event }) => ({ ...event, label: EVENT_LABELS[event.kind] || event.kind, fromLabel: STATUSES[event.fromStatus]?.label || "", toLabel: STATUSES[event.toStatus]?.label || "", ledger: effectsOf({ effectsJson }).length })),
      actions,
      // v2.0.15: faturayla alınan/verilen evrak ve faturayla yapılan ciro faturanın parçasıdır (fatura iptaliyle geri alınır).
      canUndo: manage && history.length > 1 && !last.invoiceId,
      undoLabel: history.length > 1 && !last.invoiceId ? `“${EVENT_LABELS[last.kind]}” İşlemini Geri Al` : "",
      // v2.0.26 (gözden geçirme G3): kapanmış dönemde alınan/verilen evrakta form tutar, cari ve tarih alanlarını açmaz (sunucu
      // zaten 409 verir); yalnız vade, no, banka ve açıklama düzeltilir. coreLocked formun giriş metnini seçer.
      canEditCore,
      coreLocked,
      coreNote,
      lockNote,
      // İ3: kapanmış dönemdeki evrak silinmez (DELETE 409 period-locked); düğme sunulmaz, nedeni lockNote'ta.
      canDelete: manage && history.length === 1 && !cheque.invoiceId && !coreLocked,
      canManage: manage,
    };
  }

  const SORTS = new Set(["due", "amount", "party", "created"]);
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    direction: ["in", "out"].includes(text(params.get("direction"))) ? text(params.get("direction")) : "",
    status: STATUSES[text(params.get("status"))] || ["open", "closed", "overdue", "soon"].includes(text(params.get("status"))) ? text(params.get("status")) : "",
    from: validDate(text(params.get("from"))) ? text(params.get("from")) : "",
    to: validDate(text(params.get("to"))) ? text(params.get("to")) : "",
    account: text(params.get("account")).slice(0, 120),
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "due",
  });
  function list(user, { q = "", direction = "", status = "", from = "", to = "", account = "", sort = "due" } = {}) {
    const day = today();
    const rows = store.all(`${CHEQUE_SQL} WHERE c.deleted_at IS NULL`);
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const out = [];
    for (const raw of rows) {
      if (direction && raw.direction !== direction) continue;
      if (account && raw.accountId !== account && raw.endorseAccountId !== account) continue;
      if (from && raw.dueDate < from) continue;
      if (to && raw.dueDate > to) continue;
      const row = shapeRow(raw, day);
      if (status === "open" && !row.open) continue;
      if (status === "closed" && row.open) continue;
      if (status === "overdue" && !(row.open && row.days < 0)) continue;
      if (status === "soon" && !(row.open && row.days >= 0 && row.days <= 7)) continue;
      if (STATUSES[status] && row.status !== status) continue;
      if (needle && !`${row.serialNo} ${row.bank} ${row.drawer} ${row.accountName} ${row.endorseAccountName} ${row.planName} ${row.note}`.toLocaleLowerCase("tr-TR").includes(needle)) continue;
      out.push(row);
    }
    const compare = {
      due: (a, b) => Number(b.open) - Number(a.open) || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) || collator.compare(a.party, b.party),
      amount: (a, b) => b.amount - a.amount || (a.dueDate < b.dueDate ? -1 : 1),
      party: (a, b) => collator.compare(a.party, b.party) || (a.dueDate < b.dueDate ? -1 : 1),
      created: (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0),
    }[sort];
    out.sort(compare);
    const listed = out.reduce((acc, row) => ({ count: acc.count + 1, amount: roundMoney(acc.amount + row.amount) }), { count: 0, amount: 0 });
    return { cheques: out, listed, summary: portfolioSummary(rows, day), today: day, canManage: canUser(user, "cheques.manage") };
  }
  // Salt okunur liste ve dışa aktarım: çek yetkisi ya da ANLIK DURUM yetkisi (Rapor Al › Çek / Senet sekmesi) yeter.
  const requireReader = req => {
    try {
      return auth.requirePermission(req, "cheques.view");
    } catch (error) {
      if (error?.status !== 403) throw error;
      return auth.requirePermission(req, "overview.view");
    }
  };
  router.get("/api/workspace/cheques", async ({ req, res, url }) => {
    const user = requireReader(req);
    const data = list(user, listQuery(url.searchParams));
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 300)));
    const offset = Math.max(0, Math.trunc(Number(url.searchParams.get("offset")) || 0));
    ok(res, { ...data, cheques: data.cheques.slice(offset, offset + limit), total: data.cheques.length, offset, limit, hasMore: offset + limit < data.cheques.length });
  });

  // ---------- Defter etkileri ----------
  const noteFor = (cheque, kind, extra = "") => {
    const head = { receive: `${kindName(cheque)} alındı`, issue: `${kindName(cheque)} verildi`, endorse: `${kindName(cheque)} ciro edildi`, bounce: `${kindName(cheque)} karşılıksız / iade` }[kind] || kindName(cheque);
    return [head, cheque.serialNo ? `No ${cheque.serialNo}` : "", cheque.bank, `vade ${dayText(cheque.dueDate)}`, extra].filter(Boolean).join(" · ").slice(0, 300);
  };
  // v2.0.26 (gözden geçirme G1): evrakın karta sayılan tahsilatı, kart kapanmış dönemde kapatıldıysa eklenmez/kalkmaz (karşılıksız,
  // geri al, sil, düzenle): vazgeçilen kalan (689) kilitli günde değişirdi.
  const CLOSED_CARD = "Bu evrakın sayıldığı taksit tahsilatı değiştirilemez (karşılıksız, geri alma, silme ve düzenleme kartı değiştirir).";
  function applyEffects(user, cheque, planned) {
    const done = [];
    for (const effect of planned) {
      if (effect.type === "account-entry") {
        if (!accounts()?.exists?.(effect.accountId)) throw new HttpError(409, "Çekin bağlı olduğu cari silinmiş. Önce cariyi geri yükleyin ya da çekte cariyi değiştirin.");
        const id = newId("aentry");
        // Evrakın cari etkisi (borç/alacak) para satırı değildir: para çek tahsil/ödeme olayında el değiştirir.
        store.run(
          "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'cheque', ?, ?, ?)",
          id, effect.accountId, effect.kind, effect.amount, effect.date, effect.note || "", cheque.id, user.id, now(),
        );
        // Yazılan satırın kendisi denetlenir (gözden geçirme D10).
        bank.assertWrittenNonMoney("account_entries", id);
        done.push({ op: "insert", table: "account_entries", id, accountId: effect.accountId });
      } else if (effect.type === "plan-entry") {
        const plan = store.get("SELECT id, account_id AS accountId, status FROM plans WHERE id = ? AND deleted_at IS NULL", effect.planId);
        if (!plan) throw new HttpError(409, "Çekin sayıldığı taksit kartı silinmiş. Çekte taksit kartını kaldırın.");
        plans()?.assertCloseOpen?.(plan.id, CLOSED_CARD);
        const id = newId("entry");
        const receiptNo = plans()?.receiptSeq ? plans().receiptSeq() : null;
        const itemId = effect.itemId && store.get("SELECT 1 AS found FROM plan_items WHERE id = ? AND plan_id = ?", effect.itemId, plan.id) ? effect.itemId : null;
        // Çekle sayılan taksit tahsilatı (cheque_id dolu) para satırı değildir: Kasa'ya çek tahsil edilince düşer.
        store.run(
          "INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, cheque_id, created_by, created_at) VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?)",
          id, plan.id, itemId, effect.amount, effect.date, effect.note || "", receiptNo, cheque.id, user.id, now(),
        );
        // Yazılan satırın kendisi denetlenir (gözden geçirme D10).
        bank.assertWrittenNonMoney("plan_entries", id);
        done.push({ op: "insert", table: "plan_entries", id, planId: plan.id, accountId: plan.accountId });
      } else if (effect.type === "remove-plan-entry") {
        const row = store.get("SELECT * FROM plan_entries WHERE id = ?", effect.id);
        if (!row) continue;
        plans()?.assertCloseOpen?.(row.plan_id, CLOSED_CARD);
        store.run("DELETE FROM plan_entries WHERE id = ?", effect.id);
        done.push({ op: "delete", table: "plan_entries", row, planId: row.plan_id });
      }
    }
    syncCards(user, done);
    return done;
  }
  // v2.0.24 (gözden geçirme G4): çekin karta sayılan tahsilatı eklenince/kalkınca faturanın kendi kartı faturanın açığına eşitlenir.
  const SYSTEM = { id: "system", role: "admin" };
  function syncCards(user, effects) {
    for (const planId of new Set(effects.filter(effect => effect.table === "plan_entries").map(effect => effect.planId || effect.row?.plan_id).filter(Boolean))) plans()?.syncInvoiceCard?.(user || SYSTEM, planId);
  }
  // Etkileri tersine çevirir (son yapılan önce). Eklenen satır silinir; silinen satır aynı kimlikle geri eklenir.
  function revertEffects(effects, user = null) {
    for (const effect of [...effects].reverse()) {
      if (!EFFECT_TABLES.has(effect.table)) continue;
      if (effect.table === "plan_entries") plans()?.assertCloseOpen?.(effect.planId || effect.row?.plan_id, CLOSED_CARD);
      if (effect.op === "insert") store.run(`DELETE FROM ${effect.table} WHERE id = ?`, effect.id);
      else if (effect.op === "delete" && effect.row && !store.get(`SELECT 1 AS found FROM ${effect.table} WHERE id = ?`, effect.row.id)) {
        // Geri eklenen evrak etkisi (çekli taksit satırı) para satırı değildir.
        const columns = Object.keys(effect.row).filter(column => /^[a-z_]+$/.test(column));
        store.run(`INSERT INTO ${effect.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, ...columns.map(column => effect.row[column]));
        bank.assertWrittenNonMoney(effect.table, effect.row.id);
      }
    }
    syncCards(user, effects);
  }
  const touchedBy = effects => ({
    accountIds: effects.map(effect => effect.accountId).filter(Boolean),
    planIds: effects.map(effect => effect.planId).filter(Boolean),
  });
  // v2.1.0 (bank.post): tahsil ve ödeme olayı para satırıdır, İşlem No'lu işlem başlığı alır; alındı/verildi, ciro ve karşılıksız
  // olayları para satırı değildir.
  function writeEvent(user, cheque, { kind, date, amount, accountId = "", fromStatus = "", toStatus, note = "", effects = [], method = "cash", invoiceId = "", finRef = "" }) {
    const id = newId("cevent");
    const way = methodInput(method);
    const eventId = bank.eventFor("cheque_events", { kind, date, method: way, fin_ref: finRef });
    store.run(
      "INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, method, invoice_id, fin_ref, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, cheque.id, kind, date, amount, accountId, fromStatus, toStatus, note, JSON.stringify(effects), way, invoiceId, finRef, eventId, user.id, now(),
    );
    return id;
  }

  // ---------- Giriş doğrulama ----------
  // dated (v2.0.26, A6): alış/veriliş tarihi bir hareket tarihidir (portföye giriş, cari etkisi): Kasa/cari ile aynı kural —
  // ileri tarih 400 date-future, kilitli dönem 409 period-locked (lib/period.mjs). Önceden ileri tarihli ve kilitli döneme
  // evrak girilebiliyordu. Yalnız vade/not gibi para dışı alanlar düzeltilirken (dated: false) eski tarih yeniden denetlenmez.
  function coreInput(body, previous = null, { checkLinks = true, dated = false } = {}) {
    const direction = previous ? previous.direction : text(body.direction);
    if (!DIRECTIONS[direction]) throw new HttpError(400, "Alınan mı verilen mi olduğunu seçin.");
    const instrument = text(body.instrument) || previous?.instrument || "cheque";
    if (!INSTRUMENTS[instrument]) throw new HttpError(400, "Evrak türü çek ya da senet olmalı.");
    const amount = amountOf(body.amount ?? previous?.amount);
    const issueLabel = direction === "in" ? "Alış Tarihi" : "Veriliş Tarihi";
    const rawIssue = text(body.issueDate ?? previous?.issueDate) || today();
    const issueDate = dated && period ? period.movementDate({ issueDate: rawIssue }, { field: "issueDate", label: issueLabel }) : dateOf(rawIssue, issueLabel, today());
    const dueDate = dateOf(body.dueDate ?? previous?.dueDate, "Vade tarihi");
    let accountId = text(body.accountId ?? previous?.accountId ?? "").slice(0, 120);
    let planId = direction === "in" ? text(body.planId ?? "").slice(0, 120) : "";
    const itemId = planId ? text(body.itemId ?? "").slice(0, 120) : "";
    if (planId && checkLinks) {
      const plan = store.get("SELECT id, account_id AS accountId, status FROM plans WHERE id = ? AND deleted_at IS NULL", planId);
      if (!plan) throw new HttpError(400, "Seçilen taksit kartı bulunamadı; silinmiş olabilir.");
      if (plan.status !== "active") throw new HttpError(400, "Kapatılan taksit kartına çek sayılamaz.");
      if (accountId && plan.accountId && plan.accountId !== accountId) throw new HttpError(400, "Seçilen taksit kartı bu cariye ait değil.");
      accountId = accountId || plan.accountId || "";
    } else if (!planId) planId = "";
    if (accountId && checkLinks && !accounts()?.exists?.(accountId)) throw new HttpError(400, "Seçilen cari bulunamadı; silinmiş olabilir.");
    const drawer = limited(body.drawer ?? previous?.drawer ?? "", 160, direction === "in" ? "Keşideci / borçlu" : "Lehtar");
    if (!accountId && !drawer) throw new HttpError(400, direction === "in" ? "Çeki kimden aldığınızı yazın ya da cari seçin." : "Çeki kime verdiğinizi yazın ya da cari seçin.");
    return {
      direction,
      instrument,
      amount,
      issueDate,
      dueDate,
      accountId,
      planId,
      itemId,
      drawer,
      serialNo: limited(body.serialNo ?? previous?.serialNo ?? "", 60, "Seri no"),
      bank: limited(body.bank ?? previous?.bank ?? "", 120, "Banka / şube"),
      note: limited(body.note ?? previous?.note ?? "", 500, "Açıklama"),
    };
  }
  // Aynı seri numaralı (aynı yön, tür ve banka) kayıt varsa yanlışlıkla ikinci kez girilmesin.
  function assertUnique(input, exceptId = "") {
    if (!input.serialNo) return;
    const twin = store.get(
      "SELECT id FROM cheques WHERE deleted_at IS NULL AND serial_no = ? AND direction = ? AND instrument = ? AND bank = ? COLLATE NOCASE AND id <> ?",
      input.serialNo, input.direction, input.instrument, input.bank, exceptId,
    );
    if (twin) throw new HttpError(409, `${INSTRUMENTS[input.instrument]} No ${input.serialNo}${input.bank ? ` (${input.bank})` : ""} zaten kayıtlı.`, { code: "cheque-duplicate", id: twin.id });
  }
  function insertCheque(user, input, { post = true, eventNote = "", invoiceId = "", effectNote = "" } = {}) {
    const id = newId("cheque");
    const status = initialStatus(input.direction);
    const stamp = now();
    store.run(
      "INSERT INTO cheques (id, direction, instrument, serial_no, bank, drawer, account_id, plan_id, amount, issue_date, due_date, status, status_date, note, invoice_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, input.direction, input.instrument, input.serialNo, input.bank, input.drawer, input.accountId, input.planId, input.amount, input.issueDate, input.dueDate, status, input.issueDate, input.note, invoiceId, user.id, stamp, stamp,
    );
    const cheque = { id, ...input, status };
    const kind = initialEvent(input.direction);
    const effects = post ? applyEffects(user, cheque, plannedEffects(cheque, kind, { date: input.issueDate, note: noteFor(cheque, kind, effectNote) })) : [];
    writeEvent(user, cheque, { kind, date: input.issueDate, amount: input.amount, accountId: input.accountId, toStatus: status, note: eventNote, effects, invoiceId });
    return { id, effects };
  }

  // v2.0.26 (gözden geçirme G3): para alanları değeriyle karşılaştırılır. Form tutarı "2500,5" gönderir, kayıtta 2500.5 durur;
  // metin karşılaştırması bunu "tutar değişti" sayıyor, kilitli dönemdeki evrakta yalnız vade düzeltmesi 409 alıyor, açık dönemde
  // de cari/taksit satırını gereksiz yere yeniden yazıyordu. Okunamayan tutar değişiklik sayılır (coreInput 400 verir).
  function coreChanged(body, previous) {
    if (body.amount !== undefined) {
      const amount = parseAmount(body.amount);
      if (!Number.isFinite(amount) || roundMoney(amount) !== roundMoney(Number(previous.amount) || 0)) return true;
    }
    return ["accountId", "planId", "itemId", "issueDate", "instrument"].some(key => body[key] !== undefined && text(body[key] ?? "") !== text(previous[key] ?? ""));
  }

  // ---------- Yazma ----------
  router.post("/api/workspace/cheques", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    const created = bank.post({ user, module: "cheque", op: "create", write: () => {
      const input = coreInput(body, null, { dated: true });
      if (body.allowDuplicate !== true) assertUnique(input);
      const result = insertCheque(user, input);
      audit(user, "cheque.created", result.id, { direction: input.direction, instrument: input.instrument, serialNo: input.serialNo, amount: input.amount, dueDate: input.dueDate, accountId: input.accountId, planId: input.planId });
      return result;
    } });
    changed(user, { chequeId: created.id, ...touchedBy(created.effects) });
    ok(res, detail(created.id, user));
  });

  router.put("/api/workspace/cheques/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    let touched = { accountIds: [], planIds: [] };
    const id = bank.post({ user, module: "cheque", op: "update", prev: { chequeId: params.id }, write: () => {
      const previous = chequeRow(params.id);
      if (body.updatedAt && body.updatedAt !== previous.updatedAt) throw new HttpError(409, "Bu çek siz bakarken değişti. Kartı yenileyip yeniden deneyin.", { code: "cheque-stale" });
      const history = eventsOf(previous.id);
      const coreChange = coreChanged(body, previous);
      if (coreChange && previous.invoiceId) throw new HttpError(409, `Bu evrak ${previous.invoiceNumber || "bir fatura"} ile kaydedildi; tutarı, carisi ve tarihi faturadan gelir. Değiştirmek için faturayı iptal edin.`, { code: "invoice-linked", invoiceId: previous.invoiceId });
      if (coreChange && history.length > 1) throw new HttpError(409, "Tahsil, ciro ya da ödeme yapılmış evrakın tutarı, carisi ve tarihi değiştirilemez. Önce son işlemi geri alın.");
      // v2.0.26 (A6): kapanmış dönemdeki evrakın tutarı, carisi, kartı ve tarihi değişmez; yeni tarih de kilitli/ileri olamaz.
      if (coreChange) period?.assertOpen(previous.issueDate, "Bu çek/senet");
      const input = coreInput({ ...previous, ...body }, previous, { checkLinks: coreChange, dated: coreChange });
      if (body.allowDuplicate !== true) assertUnique(input, previous.id);
      if (coreChange) {
        // Tek olaylı (alındı/verildi) kayıt: eski defter etkileri geri alınır, yenileri yazılır (aynı işlem bloğunda).
        const first = history[0];
        const oldEffects = effectsOf(first);
        revertEffects(oldEffects, user);
        const cheque = { ...previous, ...input };
        const kind = initialEvent(previous.direction);
        const posted = oldEffects.length > 0 || !first.note.startsWith("Açılış");
        const effects = posted ? applyEffects(user, cheque, plannedEffects(cheque, kind, { date: input.issueDate, note: noteFor(cheque, kind) })) : [];
        store.run("UPDATE cheque_events SET date = ?, amount = ?, account_id = ?, effects_json = ? WHERE id = ?", input.issueDate, input.amount, input.accountId, JSON.stringify(effects), first.id);
        touched = { accountIds: [...touchedBy(oldEffects).accountIds, ...touchedBy(effects).accountIds], planIds: [...touchedBy(oldEffects).planIds, ...touchedBy(effects).planIds] };
      }
      store.run(
        "UPDATE cheques SET instrument = ?, serial_no = ?, bank = ?, drawer = ?, account_id = ?, plan_id = ?, amount = ?, issue_date = ?, due_date = ?, note = ?, status_date = CASE WHEN ? THEN ? ELSE status_date END, updated_by = ?, updated_at = ? WHERE id = ?",
        input.instrument, input.serialNo, input.bank, input.drawer, input.accountId, input.planId, input.amount, input.issueDate, input.dueDate, input.note, history.length === 1 ? 1 : 0, input.issueDate, user.id, now(), previous.id,
      );
      audit(user, "cheque.updated", previous.id, { previous: { amount: previous.amount, dueDate: previous.dueDate, accountId: previous.accountId, serialNo: previous.serialNo }, amount: input.amount, dueDate: input.dueDate, accountId: input.accountId, serialNo: input.serialNo });
      return previous.id;
    } });
    changed(user, { chequeId: id, ...touched });
    ok(res, detail(id, user));
  });

  // Durum değişikliği: tahsil, ciro, karşılıksız, ödeme. Gövde: { action, date, note, accountId (ciro), status (beklenen) }.
  // v2.1.0 Aşama 8 (plan §3.7 #9): tahsil ve ödeme havale/EFT ile bankadan geçiyorsa olay banka hesabına bağlanır (fin_ref; tek hesapta
  // kendiliğinden, birden çokta seçim zorunlu), istek kimliği, K7 (ödemede ve geri almada hesaptan para çıkar), ödeme bank.move ister.
  // Bankaya Tahsile Ver sonraki dilimde (görünmez).
  const banking = bankForm(bankModule);
  router.post("/api/workspace/cheques/:id/actions", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    const action = text(body.action);
    let result = null;
    let k7 = null;
    const posted = bank.post({ user, module: "cheque", op: "create", requestId: banking.requestId(req, body), scope: "cheque.action", body: { ...body, chequeId: params.id }, similarOk: body.similarOk === true, guard: (written, ctx) => k7?.guard?.(written, ctx), write: () => {
      const cheque = chequeRow(params.id);
      if (body.status && body.status !== cheque.status) throw new HttpError(409, `Bu ${kindName(cheque).toLocaleLowerCase("tr-TR")} bu arada “${STATUSES[cheque.status]?.label}” oldu. Kartı yenileyin.`, { code: "cheque-stale" });
      const rule = transition(cheque, action);
      if (!rule.ok) throw new HttpError(409, rule.reason);
      // v2.0.24: işlem tarihi Kasa/cari hareketleriyle aynı kurala bağlı: ileri tarihli olamaz, kilitli döneme yazılmaz.
      const date = period ? period.movementDate({ date: text(body.date) || today() }, { label: "İşlem Tarihi" }) : dateOf(body.date, "İşlem Tarihi", today());
      // v2.0.13: çek/senet tahsili ya da ödemesi çoğunlukla bankadan geçer (varsayılan Banka); elden ise Nakit.
      const method = methodInput(body.method, "bank");
      if (rule.cash === "out") cash?.guardOut?.(cheque.amount, date, body.cashForce === true, method);
      const finRef = rule.cash ? banking.ref({ method, value: body.bankAccountId, date }) : "";
      banking.requireOut(user, rule.cash === "out", finRef);
      k7 = banking.negative([finRef], date, banking.forced(body));
      k7.capture();
      if (date < cheque.issueDate) throw new HttpError(400, `İşlem tarihi, ${cheque.direction === "in" ? "alış" : "veriliş"} tarihinden (${dayText(cheque.issueDate)}) önce olamaz.`);
      const note = limited(body.note, 300, "Açıklama");
      let endorseAccountId = "";
      if (action === "endorse") {
        endorseAccountId = text(body.accountId).slice(0, 120);
        if (!endorseAccountId) throw new HttpError(400, "Çeki kime ciro ettiğinizi seçin (tedarikçi carisi).");
        if (!accounts()?.exists?.(endorseAccountId)) throw new HttpError(400, "Seçilen cari bulunamadı; silinmiş olabilir.");
        if (endorseAccountId === cheque.accountId) throw new HttpError(400, "Çek, alındığı cariye ciro edilemez; iade için “Karşılıksız / iade” kullanın.");
      }
      const history = eventsOf(cheque.id);
      const receiveEffects = effectsOf(history.find(event => event.kind === "receive"));
      const endorseEffects = effectsOf(history.filter(event => event.kind === "endorse").at(-1));
      const planned = plannedEffects({ ...cheque }, action, { date, note: noteFor(cheque, action, note), endorseAccountId, receiveEffects, endorseEffects });
      const effects = applyEffects(user, cheque, planned);
      writeEvent(user, cheque, { kind: action, date, amount: cheque.amount, accountId: endorseAccountId || (action === "bounce" ? cheque.accountId : ""), fromStatus: cheque.status, toStatus: rule.to, note, effects, method: rule.cash ? method : "cash", finRef });
      store.run(
        "UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = CASE WHEN ? <> '' THEN ? ELSE endorse_account_id END, updated_by = ?, updated_at = ? WHERE id = ?",
        rule.to, date, endorseAccountId, endorseAccountId, user.id, now(), cheque.id,
      );
      audit(user, `cheque.${action}`, cheque.id, { serialNo: cheque.serialNo, amount: cheque.amount, date, accountId: endorseAccountId || cheque.accountId, from: cheque.status, to: rule.to });
      result = { id: cheque.id, effects, cash: Boolean(rule.cash) };
      return { id: cheque.id };
    } });
    k7?.prime(posted);
    if (posted?.replayed) return ok(res, { ...detail(posted.refId || params.id, user), replayed: true });
    changed(user, { chequeId: result.id, ...touchedBy(result.effects), cash: result.cash });
    ok(res, detail(result.id, user));
  });

  // Son işlemi geri al (ilk "alındı/verildi" olayı hariç; onu kaldırmak için kaydı silin).
  router.post("/api/workspace/cheques/:id/undo", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    let result = null;
    let k7 = null;
    // v2.1.0 (bank.post op 'delete'): geri alınan tahsil/ödeme olayının işlem başlığı iptal olur. Aşama 8: bankaya bağlı tahsilin geri alınması
    // hesaptan para çıkarır (K7).
    const posted = bank.post({ user, module: "cheque", op: "delete", prev: { chequeId: params.id }, guard: (written, ctx) => k7?.guard?.(written, ctx), write: () => {
      const cheque = chequeRow(params.id);
      const history = eventsOf(cheque.id);
      const last = history.at(-1);
      if (history.length < 2) throw new HttpError(409, "Geri alınacak işlem yok. Kaydı kaldırmak için Sil'i kullanın.");
      if (last.invoiceId) throw new HttpError(409, "Bu ciro bir faturanın ödemesidir; geri almak için faturayı iptal edin.", { code: "invoice-linked", invoiceId: last.invoiceId });
      if (body.eventId && body.eventId !== last.id) throw new HttpError(409, "Bu evrakta bu arada başka bir işlem yapıldı. Kartı yenileyin.", { code: "cheque-stale" });
      // v2.0.24: kilitli dönemdeki işlem geri alınmaz (Kasa/cari etkisi kapanmış ayı değiştirirdi).
      period?.assertOpen(last.date, "Bu çek/senet işlemi");
      k7 = banking.negative([store.get("SELECT fin_ref AS f FROM cheque_events WHERE id = ?", last.id)?.f || ""], last.date, body.negativeOk === true);
      k7.capture();
      const effects = effectsOf(last);
      revertEffects(effects, user);
      store.run("DELETE FROM cheque_events WHERE id = ?", last.id);
      const previousEndorse = last.kind === "endorse" ? "" : cheque.endorseAccountId;
      const statusDate = history.at(-2).date;
      store.run("UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", last.fromStatus, statusDate, previousEndorse, user.id, now(), cheque.id);
      audit(user, "cheque.undone", cheque.id, { event: last.kind, from: last.toStatus, to: last.fromStatus, amount: cheque.amount });
      result = { id: cheque.id, effects, cash: Boolean(ACTIONS[last.kind]?.cash) };
      return { id: cheque.id };
    } });
    k7?.prime(posted);
    changed(user, { chequeId: result.id, ...touchedBy(result.effects), cash: result.cash });
    ok(res, detail(result.id, user));
  });

  // Silme: yalnız ilk olaydaki (alındı/verildi) evrak. Defter etkileri geri alınır; kayıt Silinenler'e gider.
  router.delete("/api/workspace/cheques/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    let result = null;
    bank.post({ user, module: "cheque", op: "delete", prev: { chequeId: params.id }, write: () => {
      const cheque = chequeRow(params.id);
      const history = eventsOf(cheque.id);
      if (history.length > 1) throw new HttpError(409, `Tahsil, ciro ya da ödeme yapılmış ${kindName(cheque).toLocaleLowerCase("tr-TR")} silinemez. Önce işlemleri geri alın.`);
      if (cheque.invoiceId) throw new HttpError(409, `Bu evrak ${cheque.invoiceNumber || "bir fatura"} ile kaydedildi; silmek için faturayı iptal edin.`, { code: "invoice-linked", invoiceId: cheque.invoiceId });
      // v2.0.26 (A6): kapanmış dönemde alınan/verilen evrak silinmez (portföy ve cari etkisi kilitli mizandadır).
      period?.assertOpen(cheque.issueDate, "Bu çek/senet");
      const effects = effectsOf(history[0]);
      revertEffects(effects, user);
      store.run("UPDATE cheque_events SET effects_json = ? WHERE id = ?", JSON.stringify({ reverted: effects.length > 0 }), history[0].id);
      store.run("UPDATE cheques SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), cheque.id);
      audit(user, "cheque.deleted", cheque.id, { serialNo: cheque.serialNo, amount: cheque.amount, dueDate: cheque.dueDate, direction: cheque.direction });
      result = { id: cheque.id, effects };
    } });
    changed(user, { chequeId: result.id, ...touchedBy(result.effects) });
    ok(res, { id: result.id });
  });

  // ---------- PDF ve Excel ----------
  const filterText = query =>
    [
      query.direction ? DIRECTIONS[query.direction] : "",
      STATUSES[query.status]?.label || { open: "Açık", closed: "Kapanmış", overdue: "Vadesi geçmiş", soon: "7 gün içinde" }[query.status] || "",
      query.from || query.to ? `vade ${query.from ? dayText(query.from) : "…"} – ${query.to ? dayText(query.to) : "…"}` : "",
      query.q ? `“${query.q}”` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  router.get("/api/workspace/cheques/liste.pdf", async ({ req, res, url }) => {
    const user = requireReader(req);
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const rows = data.cheques.slice(0, PDF_ROWS);
    const pdf = tablePdf({
      now: clock(),
      title: "Çek / Senet Portföyü",
      subtitle: [filterText(query) || "Tüm evrak", `${data.cheques.length} kayıt`, data.cheques.length > PDF_ROWS ? "ilk 20.000 satır (tamamı Excel'de)" : ""].filter(Boolean).join(" · "),
      headers: ["Vade", "Yön", "Tür", "No", "Banka", "Kimden / Kime", "Durum", "Tutar"],
      types: ["", "", "", "", "", "", "", "money"],
      rows: rows.map(row => [dayText(row.dueDate), row.directionLabel, row.instrumentLabel, row.serialNo, row.bank, row.status === "endorsed" ? `${row.party} → ${row.endorseAccountName}` : row.party, row.statusLabel, tl(row.amount)]),
      summary: [
        ["Listelenen", `${data.listed.count} · ${tl(data.listed.amount)}`],
        ["Portföyde (alınan)", `${data.summary.in.open.count} · ${tl(data.summary.in.open.amount)}`],
        ["Ödenecek (verilen)", `${data.summary.out.open.count} · ${tl(data.summary.out.open.amount)}`],
      ],
      officeName: office(),
      userName: user.display_name || user.username || "",
    });
    audit(user, "cheque.exported", "pdf", { count: rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: "Cek-Senet-Portfoyu.pdf", inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/cheques/export.xlsx", async ({ req, res, url }) => {
    const user = requireReader(req);
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const columns = ["Vade", "Yön", "Tür", "Seri No", "Banka / Şube", "Keşideci / Lehtar", "Cari", "Taksit Kartı", "Ciro Edilen", "Alış / Veriliş", "Durum", "Durum Tarihi", "Tutar", "Açıklama"];
    const rows = data.cheques.map(row => ({ Vade: dayText(row.dueDate), Yön: row.directionLabel, Tür: row.instrumentLabel, "Seri No": row.serialNo, "Banka / Şube": row.bank, "Keşideci / Lehtar": row.drawer, Cari: row.accountName, "Taksit Kartı": row.planName, "Ciro Edilen": row.endorseAccountName, "Alış / Veriliş": dayText(row.issueDate), Durum: row.statusLabel, "Durum Tarihi": dayText(row.statusDate), Tutar: money(row.amount), Açıklama: row.note }));
    const buffer = buildXlsx([{ name: "Çek-Senet", columns, rows }], { now: clock(), title: "Çek / Senet Portföyü" });
    audit(user, "cheque.exported", "xlsx", { count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Cek-Senet-Portfoyu.xlsx", inline: false });
  });

  // Tek evrak (statik yollardan — liste.pdf, export.xlsx — sonra kaydedilir).
  router.get("/api/workspace/cheques/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.view");
    ok(res, detail(params.id, user));
  });

  // ---------- Excel / Google Sheets'ten toplu alım ----------
  // Açılış portföyü: evrak portföye (alınan) ya da ödenecekler listesine (verilen) girer. Varsayılan olarak cari
  // bakiyelerine DOKUNULMAZ (cari bakiyeleri Excel'den ayrıca yüklendiyse çek iki kez düşülmesin); "carilere işle"
  // seçilirse alınan/verilen hareketi carilere yazılır. Kapanmış (tahsil edildi, ödendi, ciro, karşılıksız) satırlar alınmaz.
  router.post("/api/workspace/cheques/import/preview", async ({ req, res }) => {
    auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = findHeaderRow(matrix, { mapper: mapChequeHeaders });
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(sanitizeCell);
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const roles = body.roles && typeof body.roles === "object" ? body.roles : inferRolesByValues(headers, rows, mapChequeHeaders(headers), "cheque");
    ok(res, { headerAt, headers, roles, rows: matrix.length - headerAt - 1, gate: validateRows(headers, rows, roles, "cheque", { headerAt }) });
  });
  router.post("/api/workspace/cheques/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = Math.max(0, Math.trunc(Number(body.headerAt) || 0));
    const headers = (matrix[headerAt] || []).map(sanitizeCell);
    const roles = body.roles && typeof body.roles === "object" ? body.roles : {};
    const columnOf = role => {
      const found = Object.entries(roles).find(([, value]) => value === role);
      return found ? Number(found[0]) : -1;
    };
    const col = Object.fromEntries(["direction", "instrument", "serial", "bank", "drawer", "amount", "due", "issue", "status", "note"].map(role => [role, columnOf(role)]));
    if (col.amount < 0) throw new HttpError(400, "Tutar kolonunu seçin.");
    if (col.due < 0) throw new HttpError(400, "Vade tarihi kolonunu seçin.");
    const defaultDirection = body.direction === "out" ? "out" : "in";
    const post = body.post === true;
    const cell = (row, index) => (index >= 0 ? sanitizeCell(row[index]) : "");
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, skipped: [], skippedTotal: 0, linked: 0, posted: 0, closed: 0, truncated: Math.max(0, matrix.length - headerAt - 1 - MAX_IMPORT) };
    const skip = (index, reason) => {
      report.skippedTotal += 1;
      if (report.skipped.length < 500) report.skipped.push({ row: headerAt + index + 2, reason });
    };
    // Cari eşleşmesi: keşideci/lehtar adı ile birebir aynı adlı TEK cari (şüphede bağlanmaz).
    const accountByName = new Map();
    const findAccount = name => {
      if (!name) return "";
      const key = name.toLocaleLowerCase("tr-TR");
      if (!accountByName.has(key)) {
        const found = store.all("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE LIMIT 2", name);
        accountByName.set(key, found.length === 1 ? found[0].id : "");
      }
      return accountByName.get(key);
    };
    const seen = new Set();
    store.tx(() => {
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => sanitizeCell(value))) return;
        const amount = parseAmount(cell(row, col.amount));
        if (!Number.isFinite(amount) || amount <= 0) return skip(index, "Tutar okunamadı");
        const due = parseDay(cell(row, col.due));
        if (!due) return skip(index, "Vade tarihi okunamadı");
        const status = parseStatus(cell(row, col.status));
        if (status && status !== "open") {
          report.closed += 1;
          return skip(index, "Kapanmış evrak (tahsil edildi / ödendi / ciro / karşılıksız); portföye alınmadı");
        }
        const direction = col.direction >= 0 ? parseDirection(cell(row, col.direction), defaultDirection) : defaultDirection;
        const drawer = cell(row, col.drawer).slice(0, 160);
        const accountId = findAccount(drawer);
        const serialNo = cell(row, col.serial).slice(0, 60);
        const bank = cell(row, col.bank).slice(0, 120);
        const instrument = col.instrument >= 0 ? parseInstrument(cell(row, col.instrument), "cheque") : body.instrument === "note" ? "note" : "cheque";
        if (!drawer && !accountId) return skip(index, direction === "in" ? "Keşideci / borçlu boş" : "Lehtar boş");
        const key = `${direction}|${instrument}|${serialNo}|${bank.toLocaleLowerCase("tr-TR")}`;
        if (serialNo && (seen.has(key) || store.get("SELECT 1 AS found FROM cheques WHERE deleted_at IS NULL AND serial_no = ? AND direction = ? AND instrument = ? AND bank = ? COLLATE NOCASE", serialNo, direction, instrument, bank))) return skip(index, `No ${serialNo} zaten kayıtlı`);
        seen.add(key);
        const issue = parseDay(cell(row, col.issue)) || today();
        // v2.0.26 (A6): alış/veriliş tarihi ileri tarihli ya da kapatılmış dönemde olan satır nedeniyle atlanır (tek tek
        // girişteki kuralın aynısı; bütün aktarım kapıda geri alınmasın).
        const issueLabel = direction === "in" ? "Alış Tarihi" : "Veriliş Tarihi";
        if (issue > today()) return skip(index, `${issueLabel} ileri tarihli (${dayText(issue)}); ileri tarihli hareket girilmez`);
        const lock = period?.lockedUntil?.() || "";
        if (lock && issue <= lock) return skip(index, `${issueLabel} (${dayText(issue)}) kapatılmış (kilitli) dönemde; ${dayText(lock)} ve öncesine evrak girilmez`);
        const input = { direction, instrument, amount: roundMoney(amount), issueDate: issue, dueDate: due, accountId, planId: "", itemId: "", drawer, serialNo, bank, note: cell(row, col.note).slice(0, 500) };
        const created = insertCheque(user, input, { post: post && Boolean(accountId), eventNote: post && accountId ? "" : "Açılış portföyü (Excel/Sheets)" });
        report.created += 1;
        if (accountId) report.linked += 1;
        if (created.effects.length) report.posted += 1;
      });
      audit(user, "cheque.imported", "import", { created: report.created, skipped: report.skippedTotal, post, file: limited(body.fileName, 200, "Dosya adı") });
    });
    publish(user, { kind: "cheques" });
    if (post && report.posted) publish(user, { kind: "accounts" });
    ok(res, report);
  });

  // ---------- Diğer modüller için ----------
  // Kasa (v2.1.0, K5): tahsil edilen alınan evrak (giriş), ödenen verilen evrak (çıkış) tek kaynaktan (lib/bank/money-lines.mjs, kaynak 8)
  // okunur; silinen evrakın olayları düşer.
  // ANLIK DURUM ve nakit akışı: açık evrak (portföydeki alınan, ödenecek verilen).
  const openRows = () => store.all(`${CHEQUE_SQL} WHERE c.deleted_at IS NULL AND c.status IN ('portfolio', 'pending')`);
  const summary = (day = today()) => portfolioSummary(store.all("SELECT direction, status, amount, due_date AS dueDate FROM cheques WHERE deleted_at IS NULL"), day);
  const flows = () =>
    openRows().map(row => ({
      date: row.dueDate,
      direction: row.direction === "out" ? "out" : "in",
      amount: row.amount,
      source: row.instrument === "note" ? "note" : "cheque",
      label: `${row.direction === "out" ? "Verilen" : "Alınan"} ${INSTRUMENTS[row.instrument].toLocaleLowerCase("tr-TR")}${row.serialNo ? ` · No ${row.serialNo}` : ""}${row.bank ? ` · ${row.bank}` : ""}`,
      party: party(row),
      phone: row.accountPhone,
      ref: { type: "cheque", id: row.id },
    }));
  // Tahsilat takvimi ve bildirimler: vadesi geçen, bugün ve 7 gün içinde gelecek açık evrak.
  function dueItems(day = today()) {
    return openRows()
      .map(row => ({ row, due: dueState(row.dueDate, day) }))
      .filter(({ due }) => due.state !== "later")
      .map(({ row, due }) => ({
        id: `cheque|${row.id}`,
        source: "cheque",
        chequeId: row.id,
        direction: row.direction,
        person: party(row),
        caseNo: "",
        caseKey: "",
        tab: "",
        label: `${row.direction === "out" ? "Ödenecek" : "Tahsil Edilecek"} ${INSTRUMENTS[row.instrument].toLocaleLowerCase("tr-TR")}${row.serialNo ? ` No ${row.serialNo}` : ""}`,
        kind: "date",
        dueDate: row.dueDate,
        dueText: dayText(row.dueDate),
        amount: row.amount,
        partial: false,
        days: due.days,
        state: due.state === "today" ? "today" : due.state === "overdue" ? "overdue" : "upcoming",
      }));
  }
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(created_at), '') FROM cheque_events) AS e, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') || '/' || COUNT(deleted_at) FROM cheques) AS c");
    return `${row.e}|${row.c}`;
  };
  // Cari silinmeden önce: bu cariye bağlı (alındığı/verildiği ya da ciro edildiği) silinmemiş evrak sayısı.
  const countForAccount = accountId => store.get("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL AND (account_id = ? OR endorse_account_id = ?)", accountId, accountId).n;
  const countForPlan = planId => store.get("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL AND plan_id = ?", planId).n;
  // Silinenler (routes/trash.mjs).
  const deletedList = () =>
    store.all("SELECT c.id, c.direction, c.instrument, c.serial_no AS serialNo, c.amount, c.due_date AS dueDate, c.drawer, COALESCE(a.name, '') AS accountName, c.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM cheques c LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN users u ON u.id = c.deleted_by WHERE c.deleted_at IS NOT NULL AND c.invoice_id = ''").map(item => ({
      id: `cheque:${item.id}`,
      kind: "cheque",
      title: `${DIRECTIONS[item.direction]} ${INSTRUMENTS[item.instrument].toLocaleLowerCase("tr-TR")}${item.serialNo ? ` No ${item.serialNo}` : ""} · ${item.accountName || item.drawer}`,
      detail: `${tl(item.amount)} · vade ${dayText(item.dueDate)}`,
      deletedAt: item.deletedAt,
      actorName: item.actorName,
      restorable: true,
      note: "Portföye geri döner; cari/taksit hareketi yeniden yazılır.",
    }));
  function restoreDeleted(user, id) {
    const raw = store.get(`${CHEQUE_SQL.replace("AND a.deleted_at IS NULL", "")} WHERE c.id = ? AND c.deleted_at IS NOT NULL`, id);
    if (!raw) throw new HttpError(404, "Bu evrak zaten geri yüklenmiş.");
    let effects = [];
    // v2.0.26 (A6): kapanmış dönemde alınan/verilen evrak geri yüklenmez (silmedeki kuralın aynısı). Gözden geçirme G5: ileri
    // alış/veriliş tarihli eski evrak da (2.0.25 girebiliyordu) nedenli 400 alır; cari satırı yeni kimlikle ileri tarihe yazılırdı.
    period?.restoreDate(raw.issueDate, "Bu çek/senet");
    bank.post({ user, module: "cheque", op: "restore", prev: { chequeId: raw.id }, write: () => {
      if (raw.accountId && !accounts()?.exists?.(raw.accountId)) throw new HttpError(409, "Evrakın carisi silinmiş. Önce cariyi geri yükleyin.");
      if (raw.serialNo && store.get("SELECT 1 AS found FROM cheques WHERE deleted_at IS NULL AND serial_no = ? AND direction = ? AND instrument = ? AND bank = ? COLLATE NOCASE", raw.serialNo, raw.direction, raw.instrument, raw.bank)) {
        throw new HttpError(409, `${INSTRUMENTS[raw.instrument]} No ${raw.serialNo} bu arada yeniden girilmiş; ikisi aynı anda duramaz.`);
      }
      const first = store.get("SELECT id, kind, effects_json AS effectsJson FROM cheque_events WHERE cheque_id = ? ORDER BY created_at, rowid LIMIT 1", raw.id);
      let reverted = false;
      try {
        reverted = Boolean(JSON.parse(first?.effectsJson || "{}")?.reverted);
      } catch {
        reverted = false;
      }
      const cheque = { ...raw, planId: raw.planId && store.get("SELECT 1 AS found FROM plans WHERE id = ? AND deleted_at IS NULL", raw.planId) ? raw.planId : "" };
      const kind = initialEvent(raw.direction);
      effects = reverted ? applyEffects(user, cheque, plannedEffects(cheque, kind, { date: raw.issueDate, note: noteFor(cheque, kind) })) : [];
      if (first) store.run("UPDATE cheque_events SET effects_json = ? WHERE id = ?", JSON.stringify(effects), first.id);
      store.run("UPDATE cheques SET deleted_at = NULL, deleted_by = NULL, plan_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", cheque.planId, user.id, now(), raw.id);
      audit(user, "cheque.restored", raw.id, { serialNo: raw.serialNo, amount: raw.amount });
    } });
    changed(user, { chequeId: raw.id, ...touchedBy(effects) });
    return `${INSTRUMENTS[raw.instrument]}${raw.serialNo ? ` No ${raw.serialNo}` : ""} geri geldi.`;
  }

  // v2.0.15: faturanın çek/senetle ödenen kısmı. Fatura ile aynı işlem bloğunda (store.tx) çağrılır:
  //   create : satışta müşteriden alınan evrak portföye girer (carinin borcu düşer = mahsup); alışta tedarikçiye
  //            verilen kendi evrakımız "ödenecek" olur (tedarikçi alacağı düşer).
  //   endorse: alışta portföydeki müşteri çeki tedarikçiye ciro edilir (tedarikçi alacağı düşer).
  //   voidFor: fatura iptalinde faturanın evrakı ve cirosu birebir geri alınır. Evrak bu arada tahsil, ciro ya da ödeme
  //            gördüyse iptal durdurulur (önce o işlem geri alınmalı; para gerçekten el değiştirmiştir).
  const invoiceCheques = {
    create(user, body, { invoiceId, note = "" }) {
      const input = coreInput(body, null, { dated: true });
      if (input.dueDate < input.issueDate) throw new HttpError(400, `${INSTRUMENTS[input.instrument]} vadesi (${dayText(input.dueDate)}) fatura tarihinden (${dayText(input.issueDate)}) önce olamaz.`, { code: "cheque-due-before-issue" });
      assertUnique(input);
      const result = insertCheque(user, input, { invoiceId, effectNote: note });
      return result;
    },
    endorse(user, chequeId, { accountId, date, invoiceId, note = "" }) {
      const cheque = chequeRow(chequeId);
      const rule = transition(cheque, "endorse");
      if (!rule.ok) throw new HttpError(409, rule.reason, { code: "cheque-not-in-portfolio" });
      if (cheque.direction !== "in") throw new HttpError(409, "Yalnız alınan (portföydeki) evrak ciro edilir.");
      if (date < cheque.issueDate) throw new HttpError(400, `Ciro tarihi, evrakın alış tarihinden (${dayText(cheque.issueDate)}) önce olamaz.`, { code: "cheque-endorse-before-receive" });
      if (accountId === cheque.accountId) throw new HttpError(400, "Çek, alındığı cariye ciro edilemez.");
      const history = eventsOf(cheque.id);
      const planned = plannedEffects({ ...cheque }, "endorse", { date, note: noteFor(cheque, "endorse", note), endorseAccountId: accountId, receiveEffects: effectsOf(history.find(event => event.kind === "receive")) });
      const effects = applyEffects(user, cheque, planned);
      writeEvent(user, cheque, { kind: "endorse", date, amount: cheque.amount, accountId, fromStatus: cheque.status, toStatus: rule.to, note, effects, invoiceId });
      store.run("UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", rule.to, date, accountId, user.id, now(), cheque.id);
      return { id: cheque.id, amount: cheque.amount, effects };
    },
    voidFor(user, invoiceId) {
      const touched = { accountIds: [], chequeIds: [] };
      // Önce ciro olayları (portföydeki eski evrak faturayla ciro edildiyse): olay evrakın son olayı olmalı.
      for (const event of store.all("SELECT ev.id, ev.cheque_id AS chequeId FROM cheque_events ev WHERE ev.invoice_id = ? AND ev.kind = 'endorse'", invoiceId)) {
        const cheque = chequeRow(event.chequeId);
        const history = eventsOf(cheque.id);
        const last = history.at(-1);
        if (last.id !== event.id) throw new HttpError(409, `Faturayla ciro edilen ${title(cheque)} sonradan ${EVENT_LABELS[last.kind]?.toLocaleLowerCase("tr-TR") || "işlem gördü"}; önce o işlemi Çek/Senet'ten geri alın.`, { code: "cheque-moved", chequeId: cheque.id });
        const effects = effectsOf(last);
        revertEffects(effects, user);
        store.run("DELETE FROM cheque_events WHERE id = ?", last.id);
        store.run("UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = '', updated_by = ?, updated_at = ? WHERE id = ?", last.fromStatus, history.at(-2).date, user.id, now(), cheque.id);
        touched.accountIds.push(...touchedBy(effects).accountIds);
        touched.chequeIds.push(cheque.id);
      }
      // Faturayla açılan evrak: yalnız ilk olayı (alındı/verildi) varsa geri alınır ve kaldırılır.
      for (const row of store.all("SELECT id FROM cheques WHERE invoice_id = ? AND deleted_at IS NULL", invoiceId)) {
        const cheque = chequeRow(row.id);
        const history = eventsOf(cheque.id);
        if (history.length > 1) throw new HttpError(409, `Faturayla ${cheque.direction === "in" ? "alınan" : "verilen"} ${title(cheque)} ${STATUSES[cheque.status]?.label?.toLocaleLowerCase("tr-TR") || "işlem gördü"}; önce o işlemi Çek/Senet'ten geri alın.`, { code: "cheque-moved", chequeId: cheque.id });
        const effects = effectsOf(history[0]);
        revertEffects(effects, user);
        store.run("UPDATE cheque_events SET effects_json = ? WHERE id = ?", JSON.stringify({ reverted: effects.length > 0, invoiceCancelled: true }), history[0].id);
        store.run("UPDATE cheques SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), cheque.id);
        touched.accountIds.push(...touchedBy(effects).accountIds);
        touched.chequeIds.push(cheque.id);
      }
      return touched;
    },
    forInvoice: invoiceId => store.all(`${CHEQUE_SQL} WHERE c.deleted_at IS NULL AND (c.invoice_id = ? OR c.id IN (SELECT cheque_id FROM cheque_events WHERE invoice_id = ? AND kind = 'endorse'))`, invoiceId, invoiceId).map(row => shapeRow(row)),
    // Ciro için seçilebilecek portföy evrakı (alış faturasının ödeme bölümü).
    portfolio: () => store.all(`${CHEQUE_SQL} WHERE c.deleted_at IS NULL AND c.direction = 'in' AND c.status = 'portfolio' ORDER BY c.due_date`).map(row => shapeRow(row)),
    publish: (user, { accountIds = [], chequeIds = [] } = {}) => {
      for (const chequeId of new Set(chequeIds)) publish(user, { kind: "cheques", chequeId });
      changed(user, { accountIds });
    },
  };

  return { summary, flows, dueItems, fingerprint, countForAccount, countForPlan, deletedList, restoreDeleted, list, detail, invoiceCheques };
}
