// Çek / Senet (v2.0.7): alınan (müşteriden, portföy) ve verilen (kendi çekimiz/senedimiz) evrak. Cari ve taksit
// defterlerine bağlıdır; Kasa'ya yalnız tahsil ve ödeme olaylarında düşer. Kural motoru server/lib/cheques.mjs içinde
// (saf, testli); burada doğrulama, yetki ve işlem bütünlüğü vardır.
//
// Bütünlük (ACID): her yazma tek store.tx (BEGIN IMMEDIATE … COMMIT) bloğudur. Olay satırı (cheque_events), durumu
// değişen çek ve olayın defter etkileri (cari hareketi, taksit tahsilatı) birlikte yazılır; biri başarısız olursa hepsi
// geri alınır. Etkiler effects_json'da tutulur; "Geri al" bunları birebir tersine çevirir (silinen satır aynı kimlikle
// geri eklenir). İki kişi aynı çeki aynı anda işlerse ikincisi "bu arada değişti" (409) alır (beklenen durum denetimi).
import { randomUUID } from "node:crypto";
import { ACTIONS, DIRECTIONS, EVENT_LABELS, INSTRUMENTS, STATUSES, dueState, initialEvent, initialStatus, mapChequeHeaders, parseDirection, parseInstrument, parseStatus, plannedEffects, portfolioSummary, transition } from "../lib/cheques.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { findHeaderRow, inferRolesByValues, sanitizeCell, validateRows } from "../lib/import-gate.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { dayText, isoDay, parseDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";

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

export function registerChequeRoutes(router, { store, auth, audit, events, accounts = () => null, plans = () => null }) {
  const now = () => new Date().toISOString();
  const today = () => isoDay(new Date());
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
      `SELECT ev.id, ev.kind, ev.date, ev.amount, ev.account_id AS accountId, COALESCE(a.name, '') AS accountName, ev.from_status AS fromStatus, ev.to_status AS toStatus, ev.note,
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
    return {
      ...cheque,
      events: history.map(({ effectsJson, ...event }) => ({ ...event, label: EVENT_LABELS[event.kind] || event.kind, fromLabel: STATUSES[event.fromStatus]?.label || "", toLabel: STATUSES[event.toStatus]?.label || "", ledger: effectsOf({ effectsJson }).length })),
      actions,
      canUndo: manage && history.length > 1,
      undoLabel: history.length > 1 ? `“${EVENT_LABELS[last.kind]}” işlemini geri al` : "",
      canEditCore: manage && history.length === 1,
      canDelete: manage && history.length === 1,
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
  function applyEffects(user, cheque, planned) {
    const done = [];
    for (const effect of planned) {
      if (effect.type === "account-entry") {
        if (!accounts()?.exists?.(effect.accountId)) throw new HttpError(409, "Çekin bağlı olduğu cari silinmiş. Önce cariyi geri yükleyin ya da çekte cariyi değiştirin.");
        const id = newId("aentry");
        store.run(
          "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'cheque', ?, ?, ?)",
          id, effect.accountId, effect.kind, effect.amount, effect.date, effect.note || "", cheque.id, user.id, now(),
        );
        done.push({ op: "insert", table: "account_entries", id, accountId: effect.accountId });
      } else if (effect.type === "plan-entry") {
        const plan = store.get("SELECT id, account_id AS accountId, status FROM plans WHERE id = ? AND deleted_at IS NULL", effect.planId);
        if (!plan) throw new HttpError(409, "Çekin sayıldığı taksit kartı silinmiş. Çekte taksit kartını kaldırın.");
        const id = newId("entry");
        const receiptNo = plans()?.receiptSeq ? plans().receiptSeq() : null;
        const itemId = effect.itemId && store.get("SELECT 1 AS found FROM plan_items WHERE id = ? AND plan_id = ?", effect.itemId, plan.id) ? effect.itemId : null;
        store.run(
          "INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, cheque_id, created_by, created_at) VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?)",
          id, plan.id, itemId, effect.amount, effect.date, effect.note || "", receiptNo, cheque.id, user.id, now(),
        );
        done.push({ op: "insert", table: "plan_entries", id, planId: plan.id, accountId: plan.accountId });
      } else if (effect.type === "remove-plan-entry") {
        const row = store.get("SELECT * FROM plan_entries WHERE id = ?", effect.id);
        if (!row) continue;
        store.run("DELETE FROM plan_entries WHERE id = ?", effect.id);
        done.push({ op: "delete", table: "plan_entries", row, planId: row.plan_id });
      }
    }
    return done;
  }
  // Etkileri tersine çevirir (son yapılan önce). Eklenen satır silinir; silinen satır aynı kimlikle geri eklenir.
  function revertEffects(effects) {
    for (const effect of [...effects].reverse()) {
      if (!EFFECT_TABLES.has(effect.table)) continue;
      if (effect.op === "insert") store.run(`DELETE FROM ${effect.table} WHERE id = ?`, effect.id);
      else if (effect.op === "delete" && effect.row && !store.get(`SELECT 1 AS found FROM ${effect.table} WHERE id = ?`, effect.row.id)) {
        const columns = Object.keys(effect.row).filter(column => /^[a-z_]+$/.test(column));
        store.run(`INSERT INTO ${effect.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, ...columns.map(column => effect.row[column]));
      }
    }
  }
  const touchedBy = effects => ({
    accountIds: effects.map(effect => effect.accountId).filter(Boolean),
    planIds: effects.map(effect => effect.planId).filter(Boolean),
  });
  function writeEvent(user, cheque, { kind, date, amount, accountId = "", fromStatus = "", toStatus, note = "", effects = [] }) {
    const id = newId("cevent");
    store.run(
      "INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, cheque.id, kind, date, amount, accountId, fromStatus, toStatus, note, JSON.stringify(effects), user.id, now(),
    );
    return id;
  }

  // ---------- Giriş doğrulama ----------
  function coreInput(body, previous = null, { checkLinks = true } = {}) {
    const direction = previous ? previous.direction : text(body.direction);
    if (!DIRECTIONS[direction]) throw new HttpError(400, "Alınan mı verilen mi olduğunu seçin.");
    const instrument = text(body.instrument) || previous?.instrument || "cheque";
    if (!INSTRUMENTS[instrument]) throw new HttpError(400, "Evrak türü çek ya da senet olmalı.");
    const amount = amountOf(body.amount ?? previous?.amount);
    const issueDate = dateOf(body.issueDate ?? previous?.issueDate, direction === "in" ? "Alış tarihi" : "Veriliş tarihi", today());
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
  function insertCheque(user, input, { post = true, eventNote = "" } = {}) {
    const id = newId("cheque");
    const status = initialStatus(input.direction);
    store.run(
      "INSERT INTO cheques (id, direction, instrument, serial_no, bank, drawer, account_id, plan_id, amount, issue_date, due_date, status, status_date, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, input.direction, input.instrument, input.serialNo, input.bank, input.drawer, input.accountId, input.planId, input.amount, input.issueDate, input.dueDate, status, input.issueDate, input.note, user.id, now(), now(),
    );
    const cheque = { id, ...input, status };
    const kind = initialEvent(input.direction);
    const effects = post ? applyEffects(user, cheque, plannedEffects(cheque, kind, { date: input.issueDate, note: noteFor(cheque, kind) })) : [];
    writeEvent(user, cheque, { kind, date: input.issueDate, amount: input.amount, accountId: input.accountId, toStatus: status, note: eventNote, effects });
    return { id, effects };
  }

  // ---------- Yazma ----------
  router.post("/api/workspace/cheques", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    const created = store.tx(() => {
      const input = coreInput(body);
      if (body.allowDuplicate !== true) assertUnique(input);
      const result = insertCheque(user, input);
      audit(user, "cheque.created", result.id, { direction: input.direction, instrument: input.instrument, serialNo: input.serialNo, amount: input.amount, dueDate: input.dueDate, accountId: input.accountId, planId: input.planId });
      return result;
    });
    changed(user, { chequeId: created.id, ...touchedBy(created.effects) });
    ok(res, detail(created.id, user));
  });

  router.put("/api/workspace/cheques/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    let touched = { accountIds: [], planIds: [] };
    const id = store.tx(() => {
      const previous = chequeRow(params.id);
      if (body.updatedAt && body.updatedAt !== previous.updatedAt) throw new HttpError(409, "Bu çek siz bakarken değişti. Kartı yenileyip yeniden deneyin.", { code: "cheque-stale" });
      const history = eventsOf(previous.id);
      const coreChange = ["amount", "accountId", "planId", "itemId", "issueDate", "instrument"].some(key => body[key] !== undefined && String(body[key] ?? "") !== String(previous[key] ?? ""));
      if (coreChange && history.length > 1) throw new HttpError(409, "Tahsil, ciro ya da ödeme yapılmış evrakın tutarı, carisi ve tarihi değiştirilemez. Önce son işlemi geri alın.");
      const input = coreInput({ ...previous, ...body }, previous, { checkLinks: coreChange });
      if (body.allowDuplicate !== true) assertUnique(input, previous.id);
      if (coreChange) {
        // Tek olaylı (alındı/verildi) kayıt: eski defter etkileri geri alınır, yenileri yazılır (aynı işlem bloğunda).
        const first = history[0];
        const oldEffects = effectsOf(first);
        revertEffects(oldEffects);
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
    });
    changed(user, { chequeId: id, ...touched });
    ok(res, detail(id, user));
  });

  // Durum değişikliği: tahsil, ciro, karşılıksız, ödeme. Gövde: { action, date, note, accountId (ciro), status (beklenen) }.
  router.post("/api/workspace/cheques/:id/actions", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    const action = text(body.action);
    let result = null;
    store.tx(() => {
      const cheque = chequeRow(params.id);
      if (body.status && body.status !== cheque.status) throw new HttpError(409, `Bu ${kindName(cheque).toLocaleLowerCase("tr-TR")} bu arada “${STATUSES[cheque.status]?.label}” oldu. Kartı yenileyin.`, { code: "cheque-stale" });
      const rule = transition(cheque, action);
      if (!rule.ok) throw new HttpError(409, rule.reason);
      const date = dateOf(body.date, "İşlem tarihi", today());
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
      writeEvent(user, cheque, { kind: action, date, amount: cheque.amount, accountId: endorseAccountId || (action === "bounce" ? cheque.accountId : ""), fromStatus: cheque.status, toStatus: rule.to, note, effects });
      store.run(
        "UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = CASE WHEN ? <> '' THEN ? ELSE endorse_account_id END, updated_by = ?, updated_at = ? WHERE id = ?",
        rule.to, date, endorseAccountId, endorseAccountId, user.id, now(), cheque.id,
      );
      audit(user, `cheque.${action}`, cheque.id, { serialNo: cheque.serialNo, amount: cheque.amount, date, accountId: endorseAccountId || cheque.accountId, from: cheque.status, to: rule.to });
      result = { id: cheque.id, effects, cash: Boolean(rule.cash) };
    });
    changed(user, { chequeId: result.id, ...touchedBy(result.effects), cash: result.cash });
    ok(res, detail(result.id, user));
  });

  // Son işlemi geri al (ilk "alındı/verildi" olayı hariç; onu kaldırmak için kaydı silin).
  router.post("/api/workspace/cheques/:id/undo", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    const body = await readJson(req);
    let result = null;
    store.tx(() => {
      const cheque = chequeRow(params.id);
      const history = eventsOf(cheque.id);
      const last = history.at(-1);
      if (history.length < 2) throw new HttpError(409, "Geri alınacak işlem yok. Kaydı kaldırmak için Sil'i kullanın.");
      if (body.eventId && body.eventId !== last.id) throw new HttpError(409, "Bu evrakta bu arada başka bir işlem yapıldı. Kartı yenileyin.", { code: "cheque-stale" });
      const effects = effectsOf(last);
      revertEffects(effects);
      store.run("DELETE FROM cheque_events WHERE id = ?", last.id);
      const previousEndorse = last.kind === "endorse" ? "" : cheque.endorseAccountId;
      const statusDate = history.at(-2).date;
      store.run("UPDATE cheques SET status = ?, status_date = ?, endorse_account_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", last.fromStatus, statusDate, previousEndorse, user.id, now(), cheque.id);
      audit(user, "cheque.undone", cheque.id, { event: last.kind, from: last.toStatus, to: last.fromStatus, amount: cheque.amount });
      result = { id: cheque.id, effects, cash: Boolean(ACTIONS[last.kind]?.cash) };
    });
    changed(user, { chequeId: result.id, ...touchedBy(result.effects), cash: result.cash });
    ok(res, detail(result.id, user));
  });

  // Silme: yalnız ilk olaydaki (alındı/verildi) evrak. Defter etkileri geri alınır; kayıt Silinenler'e gider.
  router.delete("/api/workspace/cheques/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cheques.manage");
    let result = null;
    store.tx(() => {
      const cheque = chequeRow(params.id);
      const history = eventsOf(cheque.id);
      if (history.length > 1) throw new HttpError(409, `Tahsil, ciro ya da ödeme yapılmış ${kindName(cheque).toLocaleLowerCase("tr-TR")} silinemez. Önce işlemleri geri alın.`);
      const effects = effectsOf(history[0]);
      revertEffects(effects);
      store.run("UPDATE cheque_events SET effects_json = ? WHERE id = ?", JSON.stringify({ reverted: effects.length > 0 }), history[0].id);
      store.run("UPDATE cheques SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), cheque.id);
      audit(user, "cheque.deleted", cheque.id, { serialNo: cheque.serialNo, amount: cheque.amount, dueDate: cheque.dueDate, direction: cheque.direction });
      result = { id: cheque.id, effects };
    });
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
    const buffer = buildXlsx([{ name: "Çek-Senet", columns, rows }], { title: "Çek / Senet Portföyü" });
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
  // Kasa: tahsil edilen alınan evrak (giriş), ödenen verilen evrak (çıkış). Silinen evrakın olayları Kasa'dan düşer.
  // Kasa kaynağı: aynı tablo/koşul hem Kasa satırlarında hem Kasa toplamında (ANLIK DURUM) kullanılır.
  const cashSource = { table: "cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL", where: "ev.kind IN ('collect', 'pay')", kind: "CASE ev.kind WHEN 'collect' THEN 'in' ELSE 'out' END", amount: "ev.amount", date: "ev.date" };
  const cashEntries = (after = "") =>
    store
      .all(
        `SELECT ev.id, ev.kind AS eventKind, ev.amount, ev.date, ev.note, c.id AS chequeId, c.instrument, c.serial_no AS serialNo, c.drawer, COALESCE(a.name, '') AS accountName,
                ev.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, ev.created_at AS createdAt, ev.created_at AS updatedAt
         FROM ${cashSource.table} LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN users u ON u.id = ev.created_by
         WHERE ${cashSource.where}${after ? ` AND ${cashSource.date} > ?` : ""}`,
        ...(after ? [after] : []),
      )
      .map(({ eventKind, instrument, serialNo, drawer, accountName, note, ...row }) => ({
        ...row,
        kind: eventKind === "collect" ? "in" : "out",
        source: "cheque",
        description: `${INSTRUMENTS[instrument] || "Çek"} ${eventKind === "collect" ? "tahsili" : "ödemesi"}${serialNo ? ` · No ${serialNo}` : ""} · ${accountName || drawer || "—"}${note ? ` · ${note}` : ""}`,
      }));
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
        label: `${row.direction === "out" ? "Ödenecek" : "Tahsil edilecek"} ${INSTRUMENTS[row.instrument].toLocaleLowerCase("tr-TR")}${row.serialNo ? ` No ${row.serialNo}` : ""}`,
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
    store.all("SELECT c.id, c.direction, c.instrument, c.serial_no AS serialNo, c.amount, c.due_date AS dueDate, c.drawer, COALESCE(a.name, '') AS accountName, c.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM cheques c LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN users u ON u.id = c.deleted_by WHERE c.deleted_at IS NOT NULL").map(item => ({
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
    store.tx(() => {
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
    });
    changed(user, { chequeId: raw.id, ...touchedBy(effects) });
    return `${INSTRUMENTS[raw.instrument]}${raw.serialNo ? ` No ${raw.serialNo}` : ""} geri geldi.`;
  }

  return { cashEntries, cashSource, summary, flows, dueItems, fingerprint, countForAccount, countForPlan, deletedList, restoreDeleted, list, detail };
}
