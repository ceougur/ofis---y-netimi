// Taksitler (v2.0.4): Operasyon Merkezi'ndeki kalıcı modül. Grup › alt grup (servis plakası › güzergâh, site › blok…),
// taksit kartı (ad, bilgi notu, telefon, toplam, taksitler), kart üstünde tahsilat/ödeme girişi, gecikme uyarısı,
// makbuz ve ekstre PDF'i, Excel'den ilk yükleme. Hareketler Kasa'ya kendiliğinden düşer (routes/cash.mjs bu servisi okur).
// Hesap kuralı server/lib/plans.mjs içinde (saf, testli); burada yalnızca doğrulama, kayıt ve yetki vardır.
import { randomUUID } from "node:crypto";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { allocate, dayText, distribute, isoDay, mapHeaders, parseDay } from "../lib/plans.mjs";
import { extractSchedules, spreadPaid } from "../lib/insight/schedules.mjs";
import { tabContext } from "../lib/insight/dues.mjs";
import { planStatementPdf, receiptPdf } from "../lib/plan-report.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { methodInput } from "../lib/pay-method.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// v2.0.26 (G6): toplu aktarımda bir satırın iç işlemini geri alıp nedeniyle atlamak için (kapanmış dönem).
export class SkippedRow extends Error {}
// v2.0.26 (G1): 2.0.13 öncesi kapatılmış kartta closed_at boştur; kapanış günü (vazgeçilen kalanın, 689, tarihi) son güncelleme
// gününden okunur (routes/ledger.mjs). Kart güncellenince o gün kaymasın diye UPDATE'e eklenir: güncellemeden önceki gün yazılır
// (SQLite UPDATE'te sağ taraf eski satırı okur).
export const FREEZE_CLOSE = "closed_at = CASE WHEN status = 'closed' AND closed_at IS NULL THEN substr(updated_at, 1, 10) ELSE closed_at END";
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
const MAX_ITEMS = 360;
const MAX_IMPORT = 100_000;

// accounts (v2.0.6): cari servisi daha sonra kurulur; her taksit kartı bir cariye aittir (plans.account_id).
export function registerPlanRoutes(router, { store, bank, auth, audit, events, trash, dataset = null, cash = null, period = null, accounts = () => null, cheques = () => null, invoices = () => null, now: clock = systemClock }) {
  // İş saati (v2.1.0): context.now (config.now).
  const now = () => clock().toISOString();
  const today = () => isoDay(clock());
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const changed = (user, detail = {}) => events?.publish("workspace.changed", { kind: "plans", actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  // Kayda bağlı kartın hareketi kişinin işlem geçmişini de değiştirir (v2.0.6): açık ekranlardaki kart yenilensin.
  const touchedCase = (user, plan) => {
    if (plan?.caseKey) changed(user, { kind: "activity", caseKey: plan.caseKey, datasetKey: plan.caseSource || "" });
  };
  const currentSource = () => (dataset?.currentKey ? dataset.currentKey() : "");
  const amountOf = (value, label = "Tutar") => {
    const amount = parseAmount(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) throw new HttpError(400, `${label} geçerli bir sayı olmalı.`);
    return roundMoney(amount);
  };
  const dateOf = (value, label = "Tarih", fallback = "") => {
    const date = text(value) || fallback;
    if (!validDate(date)) throw new HttpError(400, `${label} için geçerli bir tarih seçin.`);
    return date;
  };

  // ---------- Gruplar ----------
  const groupRows = () => store.all("SELECT id, parent_id AS parentId, name, position FROM plan_groups ORDER BY position, name COLLATE NOCASE");
  const groupOrNull = id => (id ? store.get("SELECT id, parent_id AS parentId, name FROM plan_groups WHERE id = ?", id) : null);
  const groupTree = () => {
    const rows = groupRows();
    const counts = new Map();
    for (const row of store.all("SELECT group_id AS g, subgroup_id AS s, COUNT(*) AS n FROM plans WHERE deleted_at IS NULL GROUP BY group_id, subgroup_id")) {
      if (row.g) counts.set(row.g, (counts.get(row.g) || 0) + row.n);
      if (row.s) counts.set(row.s, (counts.get(row.s) || 0) + row.n);
    }
    // Gruplar cari ve taksit kartında ortaktır (v2.0.6). v2.0.11: gruptaki cari sayısı ve bunların kaçının açık taksit
    // kartı olmadığı da döner; Taksitler'de "42 C 0079 (0)" gibi boş görünen grup aslında carisi olan gruptur.
    const people = new Map();
    const bump = (id, key) => {
      if (!id) return;
      if (!people.has(id)) people.set(id, { accounts: 0, free: 0 });
      people.get(id)[key] += 1;
    };
    for (const row of store.all(`SELECT a.group_id AS g, a.subgroup_id AS s,
        EXISTS (SELECT 1 FROM plans p WHERE p.account_id = a.id AND p.deleted_at IS NULL AND p.status = 'active') AS carded
        FROM accounts a WHERE a.deleted_at IS NULL AND a.status = 'active' AND (a.group_id IS NOT NULL OR a.subgroup_id IS NOT NULL)`)) {
      for (const id of [row.g, row.s]) {
        bump(id, "accounts");
        if (!row.carded) bump(id, "free");
      }
    }
    const node = row => ({ id: row.id, name: row.name, count: counts.get(row.id) || 0, accounts: people.get(row.id)?.accounts || 0, withoutPlan: people.get(row.id)?.free || 0 });
    const groups = rows.filter(row => !row.parentId).map(row => ({ ...node(row), subgroups: [] }));
    const byId = new Map(groups.map(group => [group.id, group]));
    for (const row of rows.filter(row => row.parentId)) byId.get(row.parentId)?.subgroups.push(node(row));
    return groups;
  };
  // Aynı adlı grup ikinci kez açılmaz (Excel'den yüklemede de kullanılır); ad boşsa null döner.
  function ensureGroup(user, name, parentId = null) {
    const clean = limited(name, 80, "Grup adı");
    if (!clean) return null;
    const found = store.get("SELECT id FROM plan_groups WHERE name = ? COLLATE NOCASE AND COALESCE(parent_id, '') = ?", clean, parentId || "");
    if (found) return found.id;
    const id = newId("group");
    const position = (store.get("SELECT COALESCE(MAX(position), 0) AS p FROM plan_groups WHERE COALESCE(parent_id, '') = ?", parentId || "")?.p || 0) + 1;
    store.run("INSERT INTO plan_groups (id, parent_id, name, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, parentId, clean, position, user.id, now(), now());
    audit(user, "plan.group.created", id, { name: clean, parentId });
    return id;
  }
  const resolveGroups = (body, user) => {
    let groupId = text(body.groupId) || null;
    let subgroupId = text(body.subgroupId) || null;
    // Ad yazılmışsa (yeni grup) oluşturulur; kimlik verilmişse doğrulanır.
    if (!groupId && text(body.groupName)) groupId = ensureGroup(user, body.groupName);
    if (groupId && !groupOrNull(groupId)) throw new HttpError(400, "Seçilen grup artık yok; listeyi yenileyin.");
    if (groupId && groupOrNull(groupId).parentId) throw new HttpError(400, "Alt grup, grup olarak seçilemez.");
    if (!subgroupId && text(body.subgroupName)) {
      if (!groupId) throw new HttpError(400, "Alt grup için önce grup seçin.");
      subgroupId = ensureGroup(user, body.subgroupName, groupId);
    }
    if (subgroupId) {
      const sub = groupOrNull(subgroupId);
      if (!sub || sub.parentId !== groupId) throw new HttpError(400, "Alt grup seçilen gruba ait değil.");
    }
    return { groupId, subgroupId };
  };

  router.get("/api/workspace/plans/groups", async ({ req, res }) => {
    auth.requirePermission(req, "plans.view");
    ok(res, groupTree());
  });
  router.post("/api/workspace/plans/groups", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req);
    const parentId = text(body.parentId) || null;
    if (parentId) {
      const parent = groupOrNull(parentId);
      if (!parent || parent.parentId) throw new HttpError(400, "Alt grup yalnızca bir grubun altına eklenir.");
    }
    const name = limited(body.name, 80, "Grup adı");
    if (!name) throw new HttpError(400, parentId ? "Alt grubun adını yazın (ör. 15 Temmuz, A Blok)." : "Grubun adını yazın (ör. 42 C 1070, Yıldız Sitesi).");
    const id = store.tx(() => ensureGroup(user, name, parentId));
    changed(user, { groups: true });
    ok(res, { id, groups: groupTree() });
  });
  router.put("/api/workspace/plans/groups/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const group = groupOrNull(limited(params.id, 120, "Grup"));
    if (!group) throw new HttpError(404, "Grup bulunamadı.");
    const body = await readJson(req);
    const name = limited(body.name, 80, "Grup adı");
    if (!name) throw new HttpError(400, "Grubun adını yazın.");
    const clash = store.get("SELECT id FROM plan_groups WHERE name = ? COLLATE NOCASE AND COALESCE(parent_id, '') = ? AND id <> ?", name, group.parentId || "", group.id);
    if (clash) throw new HttpError(400, `“${name}” adlı bir ${group.parentId ? "alt grup" : "grup"} zaten var.`);
    store.run("UPDATE plan_groups SET name = ?, updated_at = ? WHERE id = ?", name, now(), group.id);
    audit(user, "plan.group.renamed", group.id, { previous: group.name, name });
    changed(user, { groups: true });
    ok(res, { groups: groupTree() });
  });
  router.delete("/api/workspace/plans/groups/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const group = groupOrNull(limited(params.id, 120, "Grup"));
    if (!group) throw new HttpError(404, "Grup bulunamadı.");
    const column = group.parentId ? "subgroup_id" : "group_id";
    const used = store.get(`SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND ${column} = ?`, group.id).n;
    if (used) throw new HttpError(409, `Bu ${group.parentId ? "alt grupta" : "grupta"} ${used} taksit kartı var. Önce kartları başka gruba taşıyın.`);
    store.tx(() => {
      const children = store.all("SELECT id FROM plan_groups WHERE parent_id = ?", group.id);
      for (const child of children) {
        const childUsed = store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND subgroup_id = ?", child.id).n;
        if (childUsed) throw new HttpError(409, "Grubun alt gruplarında taksit kartı var. Önce kartları taşıyın.");
        store.run("DELETE FROM plan_groups WHERE id = ?", child.id);
      }
      store.run("DELETE FROM plan_groups WHERE id = ?", group.id);
      store.run(`UPDATE plans SET ${column} = NULL WHERE ${column} = ?`, group.id);
      audit(user, "plan.group.deleted", group.id, { name: group.name, parentId: group.parentId });
    });
    changed(user, { groups: true });
    ok(res, { groups: groupTree() });
  });

  // ---------- Kart okuma ----------
  const PLAN_SQL = `SELECT p.id, p.account_id AS accountId, p.ref_no AS refNo, p.registered_on AS registeredOn, p.case_key AS caseKey, p.case_source AS caseSource, p.case_title AS caseTitle, p.group_id AS groupId, p.subgroup_id AS subgroupId, p.name, p.note, p.phone, p.total, p.status, p.covers_balance AS coversBalance,
      p.invoice_id AS invoiceId, COALESCE((SELECT i.number FROM invoices i WHERE i.id = p.invoice_id), '') AS invoiceNumber,
      p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName,
      COALESCE(g.name, '') AS groupName, COALESCE(s.name, '') AS subgroupName, COALESCE(ac.name, '') AS accountName, COALESCE(ac.ref_no, '') AS accountRef
    FROM plans p LEFT JOIN users u ON u.id = p.created_by LEFT JOIN plan_groups g ON g.id = p.group_id LEFT JOIN plan_groups s ON s.id = p.subgroup_id
      LEFT JOIN accounts ac ON ac.id = p.account_id AND ac.deleted_at IS NULL`;
  const itemsOf = planId => store.all("SELECT id, seq, due_date AS dueDate, amount, note FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId);
  const entriesOf = planId =>
    store.all(
      `SELECT e.id, e.item_id AS itemId, e.kind, e.amount, e.date, e.note, e.method, e.receipt_no AS receiptNo, e.cheque_id AS chequeId, e.opening, e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
              COALESCE(u.display_name, '') AS actorName
       FROM plan_entries e LEFT JOIN users u ON u.id = e.created_by WHERE e.plan_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      planId,
    );
  const planRow = id => {
    const plan = store.get(`${PLAN_SQL} WHERE p.id = ? AND p.deleted_at IS NULL`, limited(id, 120, "Kart"));
    if (!plan) throw new HttpError(404, "Taksit kartı bulunamadı. Silinmiş olabilir.");
    return plan;
  };
  const shape = (plan, user) => {
    const items = itemsOf(plan.id);
    const entries = entriesOf(plan.id);
    const ledger = allocate(plan, items, entries, { today: today() });
    const manage = canUser(user, "plans.manage");
    return {
      ...plan,
      ...ledger,
      // Çekle yapılan tahsilat (v2.0.7) çekin kartından yönetilir (tahsil/karşılıksız/geri al); burada düzeltilmez.
      // Açılış (devir) kaydını (v2.0.8) yalnız kart yöneten roller düzeltir.
      entries: entries.map(entry => ({ ...entry, opening: Boolean(entry.opening), editable: !entry.chequeId && (manage || (!entry.opening && entry.createdBy === user.id)) })),
      canManage: manage,
      canCollect: canUser(user, "plans.collect"),
    };
  };
  const detail = (id, user) => shape(planRow(id), user);

  // Sıra No (v2.0.5): Excel'deki "S.N" kolonu ya da kart açılırken verilen numara. Sayı olanlar sayı gibi sıralanır
  // ("2" < "10"); boş ya da sayı olmayan numara en sona.
  const refCompare = (a, b) => {
    const x = String(a.refNo || "");
    const y = String(b.refNo || "");
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return x.localeCompare(y, "tr", { numeric: true });
  };
  // Yeni kartın numarası: sayı olan en büyük numaradan bir sonraki.
  const nextRef = () => {
    let max = 0;
    for (const row of store.all("SELECT ref_no AS refNo FROM plans WHERE deleted_at IS NULL")) {
      const value = Number(String(row.refNo || "").replace(",", "."));
      if (Number.isFinite(value) && value > max) max = Math.floor(value);
    }
    return String(max + 1);
  };
  const SORTS = new Set(["no", "name", "due", "remaining", "registered"]);
  const STATUSES = new Set(["active", "overdue", "done", "closed", "all"]);
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    group: text(params.get("group")),
    subgroup: text(params.get("subgroup")),
    status: STATUSES.has(text(params.get("status"))) ? text(params.get("status")) : "active",
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "no",
    // Kayda bağlı kartlar (v2.0.6): yalnız bu kaydın kartları (açık veri oturumunda).
    caseKey: text(params.get("caseKey")).slice(0, 200),
    // Carinin kartları (v2.0.6).
    account: text(params.get("account")).slice(0, 120),
  });

  // Liste: her kart için özet (taksitler ve hareketler bellekte tek geçişte eşlenir; 5 bin kartta da hızlıdır).
  // ids (v2.1.0, §3.11): yalnız bu kartlar (mutabakat kapısı dokunulan kartları denetler); kartın hesabı aynıdır.
  function list(user, { q = "", group = "", subgroup = "", status = "active", sort = "no", caseKey = "", caseSource = "", account = "", ids = null } = {}) {
    const only = ids ? JSON.stringify([...ids]) : null;
    // ids: tekli + deleted_at indeksini kapatır (birincil anahtar seçilir; değer aynı).
    let plans = only ? store.all(`${PLAN_SQL} WHERE +p.deleted_at IS NULL AND p.id IN (SELECT value FROM json_each(?)) ORDER BY p.name COLLATE NOCASE, p.created_at`, only) : store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL ORDER BY p.name COLLATE NOCASE, p.created_at`);
    if (caseKey) plans = plans.filter(plan => plan.caseKey === caseKey && (!caseSource || plan.caseSource === caseSource));
    if (account) plans = plans.filter(plan => plan.accountId === account);
    const items = new Map();
    for (const item of only ? store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items WHERE plan_id IN (SELECT value FROM json_each(?)) ORDER BY due_date, seq", only) : store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
      if (!items.has(item.planId)) items.set(item.planId, []);
      items.get(item.planId).push(item);
    }
    const entries = new Map();
    for (const entry of only ? store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries WHERE plan_id IN (SELECT value FROM json_each(?)) ORDER BY date, created_at, rowid", only) : store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push(entry);
    }
    const day = today();
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const digits = needle.replace(/\D/g, "");
    const totals = { total: 0, paid: 0, remaining: 0, overdue: 0, overdueCount: 0, month: 0, count: 0 };
    const month = day.slice(0, 7);
    const out = [];
    for (const plan of plans) {
      if (group && plan.groupId !== group) continue;
      if (subgroup && plan.subgroupId !== subgroup) continue;
      if (needle) {
        const hay = `${plan.name} ${plan.note} ${plan.groupName} ${plan.subgroupName}`.toLocaleLowerCase("tr-TR");
        const phoneHit = digits.length >= 3 && String(plan.phone || "").replace(/\D/g, "").includes(digits);
        const refHit = String(plan.refNo || "").toLocaleLowerCase("tr-TR") === needle;
        if (!hay.includes(needle) && !phoneHit && !refHit) continue;
      }
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      if (status === "active" && !["active", "overdue"].includes(ledger.state)) continue;
      if (status === "overdue" && ledger.state !== "overdue") continue;
      if (status === "done" && ledger.state !== "done") continue;
      if (status === "closed" && ledger.state !== "closed") continue;
      totals.total = roundMoney(totals.total + ledger.totals.total);
      totals.paid = roundMoney(totals.paid + ledger.totals.paid);
      totals.remaining = roundMoney(totals.remaining + ledger.totals.remaining);
      totals.overdue = roundMoney(totals.overdue + ledger.totals.overdue);
      totals.overdueCount += ledger.totals.overdueCount;
      totals.month = roundMoney(totals.month + ledger.items.filter(item => item.dueDate.startsWith(month) && item.remaining > 0.005 && item.state !== "closed").reduce((sum, item) => sum + item.remaining, 0));
      totals.count += 1;
      out.push({
        id: plan.id,
        accountId: plan.accountId || "",
        accountName: plan.accountName || "",
        refNo: plan.refNo || "",
        registeredOn: plan.registeredOn || "",
        caseKey: plan.caseKey || "",
        caseSource: plan.caseSource || "",
        caseTitle: plan.caseTitle || "",
        name: plan.name,
        phone: plan.phone,
        note: plan.note,
        groupId: plan.groupId,
        subgroupId: plan.subgroupId,
        groupName: plan.groupName,
        subgroupName: plan.subgroupName,
        status: plan.status,
        state: ledger.state,
        totals: ledger.totals,
        next: ledger.next,
        itemCount: ledger.items.length,
      });
    }
    // Sıralama: Sıra No (varsayılan; Excel'deki sıra), ad, vade (önce gecikenler, sonra vadesi en yakın), kalan (çoktan aza).
    const rank = plan => (plan.state === "overdue" ? 0 : plan.state === "active" ? 1 : plan.state === "done" ? 2 : 3);
    const byName = (a, b) => a.name.localeCompare(b.name, "tr");
    const compare = {
      no: (a, b) => refCompare(a, b) || byName(a, b),
      name: byName,
      due: (a, b) => rank(a) - rank(b) || (a.next?.days ?? 9e9) - (b.next?.days ?? 9e9) || byName(a, b),
      remaining: (a, b) => b.totals.remaining - a.totals.remaining || byName(a, b),
      registered: (a, b) => String(b.registeredOn).localeCompare(String(a.registeredOn)) || refCompare(a, b),
    }[sort] || ((a, b) => refCompare(a, b) || byName(a, b));
    out.sort(compare);
    return { plans: out, totals, sort, canManage: canUser(user, "plans.manage"), canCollect: canUser(user, "plans.collect"), today: day };
  }

  router.get("/api/workspace/plans", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "plans.view");
    const data = list(user, { ...listQuery(url.searchParams), caseSource: currentSource() });
    // v2.0.22: sol menü rozeti yalnız sayıyı ister (count=1); kartların tamamı (binlerce kartta ~200 KB) gönderilmez.
    if (url.searchParams.get("count") === "1") return ok(res, { total: data.plans.length, totals: data.totals, today: data.today });
    ok(res, data);
  });

  // Kaydın taksit kartları (v2.0.6): kişinin kartındaki "Taksit planı" bölümü ve Tahsilat penceresi buradan okur.
  router.get("/api/workspace/cases/:key/plans", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.view");
    const key = limited(params.key, 200, "Kayıt");
    ok(res, { plans: forCase(key, currentSource(), user), canManage: canUser(user, "plans.manage"), canCollect: canUser(user, "plans.collect") });
  });

  // Liste PDF'i (v2.0.5): ekrandaki süzgeçler ve sıralamayla (durum, grup › alt grup, arama). Yazdır düğmesi de bunu kullanır.
  const STATUS_TEXT = { active: "Devam eden", overdue: "Geciken", done: "Biten", closed: "Kapalı", all: "Tümü" };
  const STATE_TEXT = { overdue: "Gecikti", active: "Devam ediyor", done: "Tamamlandı", closed: "Kapalı" };
  router.get("/api/workspace/plans/liste.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "plans.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const groupName = id => store.get("SELECT name FROM plan_groups WHERE id = ?", id)?.name || "";
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Taksitler";
    const subtitle = [STATUS_TEXT[query.status], query.group ? groupName(query.group) : "Tüm gruplar", query.subgroup ? groupName(query.subgroup) : "", query.q ? `“${query.q}”` : ""].filter(Boolean).join(" · ");
    const pdf = tablePdf({
      now: clock(),
      title: `${title} listesi`,
      subtitle,
      // v2.0.6: kayıt tarihi ve bilgi notu da basılır (yatay sayfada notun yeri var; uzun not satır içinde sarılır).
      headers: ["No", "Ad Soyad", "Grup", "Telefon", "Kayıt", "Toplam", "Ödenen", "Kalan", "Sıradaki Vade", "Durum", "Bilgi Notu"],
      types: ["text", "text", "text", "text", "text", "money", "money", "money", "text", "text", "text"],
      rows: data.plans.map(plan => [
        plan.refNo,
        plan.name,
        [plan.groupName, plan.subgroupName].filter(Boolean).join(" › "),
        plan.phone,
        dayText(plan.registeredOn),
        tl(plan.totals.total),
        tl(plan.totals.paid),
        tl(plan.totals.remaining),
        plan.next ? `${dayText(plan.next.dueDate)} · ${plan.next.seq}. taksit` : "",
        `${STATE_TEXT[plan.state] || ""}${plan.totals.overdueCount ? ` · ${plan.totals.overdueCount} taksit geciken` : ""}`,
        plan.note || "",
      ]),
      summary: [["Kart", String(data.totals.count)], ["Kalan Alacak", tl(data.totals.remaining)], ["Geciken", `${tl(data.totals.overdue)} · ${data.totals.overdueCount} taksit`], ["Bu Ay Beklenen", tl(data.totals.month)], ["Tahsil Edilen", tl(data.totals.paid)]],
      officeName: office(),
      userName: user.display_name || user.username || "",
      // Liste okula ya da veliye verilebilir: altbilgide program adı değil firma adı (v2.0.6).
      brand: office(),
    });
    audit(user, "plan.list.exported", "list", { ...query, count: data.totals.count });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${title}-listesi ${dayText(today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });

  // ---------- Kart yazma ----------
  const planInput = (body, user, previous = null) => {
    const name = limited(body.name, 160, "Ad Soyad");
    if (!name) throw new HttpError(400, "Ad Soyad (ya da kurum adı) yazın.");
    const phone = limited(body.phone, 60, "Telefon");
    const note = limited(body.note, 1000, "Bilgi notu");
    const total = amountOf(body.total, "Toplam tutar");
    const refNo = limited(body.refNo, 30, "Sıra No");
    // Kayıt tarihi: kişinin kaydedildiği gün (v2.0.6). v2.0.12: boş bırakılırsa carinin kayıt tarihi, cari yoksa bugün.
    const ownerDay = String(body.accountId || "").trim() ? store.get("SELECT registered_on AS day FROM accounts WHERE id = ? AND deleted_at IS NULL", String(body.accountId).trim().slice(0, 120))?.day || "" : "";
    const registeredOn = dateOf(body.registeredOn, "Kayıt tarihi", ownerDay || today());
    // v2.0.13: kart ileri tarihle açılamaz (Kayıt Tarihi kartın işlem tarihidir; vadeler bundan önce olamaz).
    if (registeredOn > today()) throw new HttpError(400, "Kayıt tarihi ileri bir tarih olamaz.", { code: "date-future" });
    // Tablodaki kayıt (v2.0.6): kart, açık veri oturumundaki bir kayda bağlanır; boş kimlik bağı kaldırır.
    const caseKey = limited(body.caseKey, 200, "Kayıt");
    const caseSource = caseKey ? limited(body.caseSource, 200, "Veri oturumu") || currentSource() : "";
    const caseTitle = caseKey ? limited(body.caseTitle, 200, "Kayıt adı") : "";
    // Yeni ya da değişen bağ, açık veri oturumundaki gerçek bir kayda gitmeli: başka oturumun anahtarı ya da yanlış yazılmış
    // bir anahtar bağlanamaz (başka oturumda kurulmuş bağ, o kayıt bu oturumda olmadığı için olduğu gibi korunur).
    const linkChanged = caseKey !== String(previous?.caseKey || "") || caseSource !== String(previous?.caseSource || "");
    if (caseKey && linkChanged && caseSource === currentSource() && dataset?.hasRecord && !dataset.hasRecord(caseKey)) throw new HttpError(400, "Bağlanacak kayıt açık veri oturumunda bulunamadı. Tablodan seçerek bağlayın.");
    // Cari (v2.0.6): kart bir cariye aittir. Verilmezse kart açılırken ad, telefon ve gruptan yeni cari açılır.
    const accountId = limited(body.accountId, 120, "Cari");
    if (accountId && accountId !== String(previous?.accountId || "") && !accounts()?.exists(accountId)) throw new HttpError(400, "Seçilen cari bulunamadı; silinmiş olabilir. Listeden yeniden seçin.");
    return { name, phone, note, total, refNo, registeredOn, caseKey, caseSource, caseTitle, accountId, ...resolveGroups(body, user) };
  };
  // Taksitleri yeniden kurar: mevcut taksitler silinir; taksite bağlı hareketler serbest kalır (havuza düşer).
  function replaceItems(planId, items) {
    store.run("UPDATE plan_entries SET item_id = NULL WHERE plan_id = ?", planId);
    store.run("DELETE FROM plan_items WHERE plan_id = ?", planId);
    const stamp = now();
    items.forEach((item, index) => {
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("item"), planId, index + 1, item.dueDate, item.amount, item.note || "", stamp, stamp);
    });
  }
  const distributionInput = (body, total, from = "") => {
    const count = Math.trunc(Number(body.count));
    if (!Number.isInteger(count) || count < 1 || count > MAX_ITEMS) throw new HttpError(400, `Taksit sayısı 1 ile ${MAX_ITEMS} arasında olmalı.`);
    const firstDue = dateOf(body.firstDue, "İlk vade");
    // v2.0.13: ilk vade kartın Kayıt Tarihi'nden (işlem/satış tarihi) önce olamaz.
    if (period && from) period.dueDate(firstDue, { from, label: "İlk Vade" });
    const everyMonths = Math.trunc(Number(body.everyMonths) || 1);
    if (everyMonths < 1 || everyMonths > 12) throw new HttpError(400, "Taksit aralığı 1–12 ay olmalı.");
    if (!(total > 0)) throw new HttpError(400, "Taksitlere bölmek için toplam tutar gerekli.");
    return distribute({ total, count, firstDue, everyMonths });
  };

  // v2.0.13: carinin taksitlendirilebilir borcu = bakiye − (mevcut borcu taksitlendiren açık kartların kalanı).
  // Böylece aynı borç iki karta bölünemez; ikinci kez taksitlendirme istenirse ne kadarının serbest olduğu söylenir.
  function uncoveredDebt(accountId, user, exceptPlanId = "") {
    const account = accounts()?.detail ? accounts().detail(accountId, user) : null;
    if (!account) return 0;
    let covered = 0;
    for (const plan of account.plans || []) {
      if (plan.id === exceptPlanId || plan.status === "closed") continue;
      const row = store.get("SELECT covers_balance AS c FROM plans WHERE id = ?", plan.id);
      if (row?.c) covered = roundMoney(covered + Math.max(0, (Number(plan.totals?.total) || 0) - (Number(plan.totals?.paid) || 0)));
    }
    return roundMoney(Math.max(0, (Number(account.totals?.balance) || 0) - covered));
  }
  // Kartı sondaki taksitlerden geriye doğru küçültür (tahsilat bağlı taksit satırı silinmez, sıfırlanır). Yeni toplamı döndürür.
  function cutPlan(plan, cut, user, { accountId = "", reason = "" } = {}) {
    let rest = cut;
    for (const item of itemsOf(plan.id).reverse()) {
      if (!(rest > 0.005)) break;
      const take = roundMoney(Math.min(rest, Number(item.amount) || 0));
      const amount = roundMoney((Number(item.amount) || 0) - take);
      const linked = store.get("SELECT 1 AS found FROM plan_entries WHERE item_id = ?", item.id);
      if (amount <= 0.005 && !linked) store.run("DELETE FROM plan_items WHERE id = ?", item.id);
      else store.run("UPDATE plan_items SET amount = ?, updated_at = ? WHERE id = ?", amount, now(), item.id);
      rest = roundMoney(rest - take);
    }
    const total = roundMoney(plan.total - cut);
    store.run(`UPDATE plans SET ${FREEZE_CLOSE}, total = ?, updated_by = ?, updated_at = ? WHERE id = ?`, total, user.id, now(), plan.id);
    audit(user, "plan.trimmed", plan.id, { accountId, from: plan.total, to: total, reason });
    return total;
  }
  // v2.0.24: iade faturası asıl faturayı taksitlendiren kartı (kendi kartı ya da faturayı kapsayan Mevcut Borç kartı)
  // küçültür; kalanı (toplam − net tahsilat) aşılmaz. Küçülen tutarı döndürür.
  function shrinkPlan(user, planId, amount, note = "") {
    const row = store.get("SELECT id, name, total, status, account_id AS accountId FROM plans WHERE id = ? AND deleted_at IS NULL", planId);
    if (!row || row.status === "closed") return 0;
    const plan = { id: row.id, name: row.name, total: Number(row.total) || 0 };
    const left = roundMoney(Math.max(0, plan.total - Math.max(0, netPaid(plan.id))));
    const cut = roundMoney(Math.min(Number(amount) || 0, left));
    if (!(cut > 0.005)) return 0;
    cutPlan(plan, cut, user, { accountId: row.accountId, reason: note || "İade" });
    return cut;
  }
  function leftOf(planId) {
    const row = store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", planId);
    return row ? roundMoney(Math.max(0, (Number(row.total) || 0) - Math.max(0, netPaid(planId)))) : 0;
  }
  // v2.0.13 (simülasyon bulgusu "iade taksitten düşmüyor"): cariye alacak yazılınca (müşteri iadesi) borç, mevcut borcu
  // taksitlendiren kartların kalanından küçük kalabilir. Kartlar borçtan büyük kalmasın: fazlası en yeni karttan
  // başlayarak, son taksitten geriye doğru düşülür (ödenmiş taksitlere dokunulmaz). Aynı işlemin içinde çalışır.
  function trimCovers(accountId, user, note = "") {
    const account = accounts()?.detail ? accounts().detail(accountId, user) : null;
    if (!account) return [];
    const covering = [];
    for (const plan of account.plans || []) {
      if (plan.status === "closed") continue;
      const row = store.get("SELECT covers_balance AS c, total, created_at AS createdAt, invoice_id AS invoiceId FROM plans WHERE id = ?", plan.id);
      // v2.0.24: faturanın kendi kartı faturanın açığını izler (iade faturasıyla küçülür); bakiyeye göre kırpılmaz.
      if (row?.c && !row.invoiceId) covering.push({ id: plan.id, name: plan.name, total: Number(row.total) || 0, createdAt: row.createdAt, left: Math.min(Number(row.total) || 0, Math.max(0, (Number(plan.totals?.total) || 0) - Math.max(0, Number(plan.totals?.paid) || 0))) });
    }
    const covered = covering.reduce((sum, plan) => roundMoney(sum + plan.left), 0);
    let excess = roundMoney(covered - Math.max(0, Number(account.totals?.balance) || 0));
    const changedPlans = [];
    for (const plan of covering.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      if (!(excess > 0.005)) break;
      const cut = roundMoney(Math.min(excess, plan.left));
      if (!(cut > 0.005)) continue;
      const total = cutPlan(plan, cut, user, { accountId, reason: note || "İade / alacak" });
      changedPlans.push({ id: plan.id, name: plan.name, from: plan.total, to: total, cut });
      excess = roundMoney(excess - cut);
    }
    return changedPlans;
  }
  // v2.0.23 (2. gözden geçirme): silinen "Carinin Mevcut Borcu" kartı, taksitlendirdiği borç bu arada azaldıysa (tahsil
  // edildi, iptal edildi) geri yüklenmez; yükleniyordu ve ödenmiş fatura yeniden açık görünüyordu.
  const GROW_COVER = "Bu kart carinin açıldığı günkü borcunu taksitlendirir; tutarı büyütülemez (küçültülebilir). Sonradan doğan borç için cari kartında + Taksit Planı → Carinin Mevcut Borcu ile yeni kart açın.";
  function assertRestorable(planId, user) {
    // v2.0.26 (A4): silinen kart geri gelince borcu ve tahsilatları deftere döner; kapanmış dönemdeyse geri yüklenmez
    // (silmedeki kuralın aynısı). Kartla birlikte geri gelecek silinmiş cari de kapanmış dönemde hareketliyse durur.
    const head = store.get("SELECT registered_on AS registeredOn, covers_balance AS covers, account_id AS accountId FROM plans WHERE id = ?", planId);
    if (head) {
      if (!head.covers) period?.assertOpen(head.registeredOn, "Bu kartın Kayıt Tarihi");
      const firstEntry = store.get("SELECT MIN(date) AS day FROM plan_entries WHERE plan_id = ?", planId)?.day;
      if (firstEntry) period?.assertOpen(firstEntry, "Bu kartın ilk tahsilatı");
      assertCloseOpen(planId, "Kart geri yüklenemez.");
      if (head.accountId && store.get("SELECT 1 AS found FROM accounts WHERE id = ? AND deleted_at IS NOT NULL", head.accountId)) accounts()?.assertUnlocked?.(head.accountId, "kartla birlikte geri yüklenemez");
    }
    const plan = store.get("SELECT id, account_id AS accountId, total, status, covers_balance AS covers, invoice_id AS invoiceId FROM plans WHERE id = ?", planId);
    if (!plan || !plan.covers || plan.invoiceId || plan.status === "closed" || !plan.accountId || !accounts()?.exists?.(plan.accountId)) return;
    const left = roundMoney(Math.max(0, (Number(plan.total) || 0) - netPaid(plan.id)));
    // Kart silinmişken tahsilatları bakiyede yok: geri gelince bakiye net tahsilat kadar düşer (3. gözden geçirme).
    const free = roundMoney(uncoveredDebt(plan.accountId, user, plan.id) - netPaid(plan.id));
    if (left > free + 0.005) throw new HttpError(409, `Bu kart carinin o günkü borcunu taksitlendiriyordu; borç bu arada azaldı (taksitlendirilebilecek borç ${tl(free)}, kartın kalanı ${tl(left)}). Kart geri yüklenmez; kalan borç için cari kartında + Taksit Planı → Carinin Mevcut Borcu ile yeni kart açın.`, { code: "cover-exceeds", free });
  }
  // v2.0.26 (gözden geçirme G1): kapatılan kartın vazgeçilen kalanı ana defterde kapatıldığı gün 689'a yazılır (routes/ledger.mjs:
  // closed_at, 2.0.13 öncesi kapatılmışta son güncelleme günü; Kayıt Tarihi'nden önce değil). O gün kapanmış dönemdeyse kart yeniden
  // açılmaz, silinmez, geri yüklenmez; tutarı, carisi, tahsilatı ve iadesi değişmez (vazgeçilen tutar kilitli mizandadır; kilit izi
  // integrity.mjs "plans_close_lock"). Önceden yalnız Kayıt Tarihi ve ilk tahsilat soruluyor, kilitli mizan sessizce değişiyordu.
  const closeDayOf = planId => {
    const row = store.get("SELECT status, COALESCE(closed_at, substr(updated_at, 1, 10)) AS closedOn, COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10)) AS startOn FROM plans WHERE id = ?", planId);
    if (!row || row.status !== "closed") return "";
    return row.closedOn && row.closedOn > row.startOn ? row.closedOn : row.startOn;
  };
  function assertCloseOpen(planId, what) {
    const lock = period?.lockedUntil?.() || "";
    const day = lock ? closeDayOf(planId) : "";
    if (day && day <= lock) throw new HttpError(409, `Bu kart ${dayText(day)} tarihinde kapatıldı (kalan alacaktan vazgeçildi); ${dayText(lock)} ve öncesi kapatılmış (kilitli) dönemdir. ${what} Gerekirse yönetici dönem kilidini açmalı.`, { code: "period-locked", lockedUntil: lock });
  }
  // v2.0.26 (gözden geçirme G2): kartın tahsilatları kartın carisinin hesabına (120/320/336) yazılır; kapanmış dönemde tahsilatı
  // olan kartın carisi değişirse kilitli dönemin cari bakiyeleri kayar (kilit izi integrity.mjs "plans_party_lock").
  function assertPartyOpen(planId) {
    const lock = period?.lockedUntil?.() || "";
    const first = lock ? store.get("SELECT MIN(date) AS day FROM plan_entries WHERE plan_id = ? AND date <= ?", planId, lock)?.day : "";
    if (first) throw new HttpError(409, `Bu kartın ${dayText(lock)} ve öncesinde (kapatılmış dönem) tahsilatı var (${dayText(first)}); carisi değiştirilemez. Kapanmış dönemin cari bakiyeleri değişirdi. Gerekirse yönetici dönem kilidini açmalı.`, { code: "period-locked", lockedUntil: lock });
  }
  function assertCoverable(accountId, total, user, exceptPlanId = "") {
    if (!accountId) throw new HttpError(400, "Mevcut borcu taksitlendirmek için cari seçin.");
    const free = uncoveredDebt(accountId, user, exceptPlanId);
    if (!(free > 0)) throw new HttpError(400, "Bu carinin taksitlendirilecek borcu yok (bakiye sıfır ya da borcun tamamı zaten bir taksit kartında). Yeni satış ya da hizmet için \"Yeni borç\" seçin.");
    if (total > free + 0.005) throw new HttpError(400, `Carinin taksitlendirilebilecek borcu ${tl(free)}; toplam bundan büyük olamaz. Fazlası yeni borçsa ayrı kart açın ya da "Yeni borç" seçin.`, { code: "cover-exceeds", free });
  }

  router.post("/api/workspace/plans", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req);
    const id = newId("plan");
    const result = store.tx(() => {
      const input = planInput(body, user);
      const accountId = input.accountId || accounts()?.createFromPlan(user, input) || "";
      // v2.0.7: cari kayda bağlıysa kart da o kayda bağlanır (kişinin kartında taksitler görünsün).
      if (accountId && !input.caseKey) {
        const owner = store.get("SELECT case_key AS caseKey, case_source AS caseSource, case_title AS caseTitle FROM accounts WHERE id = ? AND deleted_at IS NULL", accountId);
        if (owner?.caseKey) Object.assign(input, { caseKey: owner.caseKey, caseSource: owner.caseSource, caseTitle: owner.caseTitle });
      }
      // v2.0.11: kartta grup seçilmediyse carinin grubu alınır (toplu taksitlendirmedeki gibi); böylece Taksitler'deki
      // grup süzgeci ve sayıları cariyle tutarlı kalır ("42 C 0079 · 3 kart · 3 cari").
      if (accountId && !input.groupId) {
        const owner = store.get("SELECT group_id AS groupId, subgroup_id AS subgroupId FROM accounts WHERE id = ? AND deleted_at IS NULL", accountId);
        if (owner?.groupId) Object.assign(input, { groupId: owner.groupId, subgroupId: owner.subgroupId || null });
      }
      // v2.0.13: "mevcut borcu taksitlendir" seçildiyse kart carinin defterine ikinci kez borç yazmaz.
      const covers = body.coversBalance === true || body.coversBalance === "1" || body.coversBalance === "true";
      if (covers) assertCoverable(accountId, input.total, user);
      // Yeni borç kartı cariye Kayıt Tarihi'nde borç yazar: kapanmış döneme yazılamaz.
      else period?.assertOpen(input.registeredOn, "Kartın Kayıt Tarihi");
      const stamp = now();
      store.run(
        "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, covers_balance, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
        id, accountId, input.refNo || nextRef(), input.registeredOn, input.caseKey, input.caseSource, input.caseTitle, input.groupId, input.subgroupId, input.name, input.note, input.phone, input.total, covers ? 1 : 0, user.id, stamp, stamp,
      );
      // Kayıt bitince taksit sorulmaz; "count" verilmişse (kartı açarken "otomatik dağıt" seçildiyse) kurulur.
      if (text(body.mode) === "auto" || Number(body.count) > 0) replaceItems(id, distributionInput(body, input.total, input.registeredOn));
      audit(user, "plan.created", id, { name: input.name, total: input.total, groupId: input.groupId, subgroupId: input.subgroupId, accountId, coversBalance: covers });
      return detail(id, user);
    });
    changed(user, { planId: id });
    changed(user, { kind: "accounts", accountId: result.accountId || "" });
    ok(res, result);
  });

  router.get("/api/workspace/plans/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.view");
    ok(res, detail(params.id, user));
  });

  router.put("/api/workspace/plans/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const previous = planRow(params.id);
    const body = await readJson(req);
    const result = store.tx(() => {
      const input = planInput({ ...previous, ...body }, user, previous);
      const status = body.status === undefined ? previous.status : body.status === "closed" ? "closed" : "active";
      // v2.0.23 (gözden geçirme): faturanın kendi taksit kartının tutarı ve carisi faturadan gelir; burada değişince fatura ile
      // kart ayrışıyordu (fatura 3.000 açık, kart 2.000). Ad, grup, not ve kapatma burada serbest.
      if (previous.invoiceId && (roundMoney(input.total) !== roundMoney(Number(previous.total) || 0) || (input.accountId && input.accountId !== previous.accountId))) {
        throw new HttpError(409, `Bu kart ${previous.invoiceNumber || "bir fatura"} ile açıldı; tutarı ve carisi faturadan gelir. Değiştirmek için faturada Düzenle'yi ya da iade faturasını kullanın.`, { code: "invoice-linked", invoiceId: previous.invoiceId });
      }
      // Kapanmış dönem: yeni borç kartının tutarı, carisi ya da Kayıt Tarihi değişemez (o dönemin cari bakiyesi değişir).
      if (!previous.coversBalance && (roundMoney(input.total) !== roundMoney(Number(previous.total) || 0) || (input.accountId && input.accountId !== previous.accountId) || input.registeredOn !== previous.registeredOn)) {
        period?.assertOpen(previous.registeredOn, "Bu kartın Kayıt Tarihi");
        period?.assertOpen(input.registeredOn, "Kartın yeni Kayıt Tarihi");
      }
      // Cari boşaltılamaz: eski kartta (göç öncesinden kalma, cari yoksa) ilk düzenlemede cari açılır.
      const accountId = input.accountId || previous.accountId || accounts()?.createFromPlan(user, input) || "";
      // v2.0.26 (gözden geçirme G1, G2): kapanmış dönemde kapatılmış kart yeniden açılmaz; tutarı, carisi, Kayıt Tarihi değişmez.
      // Kapanmış dönemde tahsilatı olan kartın carisi değişmez (Mevcut Borç kartında da). Kilit bugünse kart bugün kapatılamaz
      // (vazgeçilen kalan kilitli güne yazılırdı).
      const moneyChange = roundMoney(input.total) !== roundMoney(Number(previous.total) || 0) || accountId !== previous.accountId || input.registeredOn !== previous.registeredOn;
      if (previous.status === "closed" && status !== "closed") assertCloseOpen(previous.id, "Kart yeniden açılamaz.");
      else if (previous.status === "closed" && moneyChange) assertCloseOpen(previous.id, "Kartın tutarı, carisi ve Kayıt Tarihi değiştirilemez.");
      if (previous.status !== "closed" && status === "closed") period?.assertOpen(today(), "Kartın kapatılma günü");
      if (accountId !== previous.accountId) assertPartyOpen(previous.id);
      // v2.0.23 (3. gözden geçirme): Mevcut Borç kartı açıldığı andaki borcu taksitlendirir; tutarı sonradan büyütülünce kart
      // yeni borcu da sayıyor ya da başka faturayı "ödenmiş" gösteriyordu. Yeni borç için yeni kart açılır.
      if (previous.coversBalance && !previous.invoiceId && input.total > roundMoney(Number(previous.total) || 0) + 0.005) throw new HttpError(409, GROW_COVER, { code: "cover-grow" });
      if (previous.coversBalance && status === "active" && (input.total > roundMoney(Number(previous.total) || 0) + 0.005 || accountId !== previous.accountId)) {
        const paid = roundMoney(entriesOf(previous.id).reduce((sum, e) => sum + (e.kind === "in" ? Number(e.amount) || 0 : -(Number(e.amount) || 0)), 0));
        assertCoverable(accountId, roundMoney(input.total - paid), user, previous.id);
      }
      store.run(
        `UPDATE plans SET ${FREEZE_CLOSE}, account_id = ?, ref_no = ?, registered_on = ?, case_key = ?, case_source = ?, case_title = ?, group_id = ?, subgroup_id = ?, name = ?, note = ?, phone = ?, total = ?, status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
        accountId, input.refNo, input.registeredOn, input.caseKey, input.caseSource, input.caseTitle, input.groupId, input.subgroupId, input.name, input.note, input.phone, input.total, status, user.id, now(), previous.id,
      );
      // Kapatma tarihi (v2.0.13): vazgeçilen kalan ana defterde bu tarihte yazılır; yeniden açılınca silinir.
      if (status !== previous.status) store.run("UPDATE plans SET closed_at = ? WHERE id = ?", status === "closed" ? today() : null, previous.id);
      // v2.1.0 (§3.11 bank:event): tahsilatların işlem başlığı kopyasındaki cari (party_id) kartın carisinden gelir; cari değişince
      // kopyalar aynı işlemde yenilenir (bank.post "assign"; para satırı değişmez).
      if (accountId !== previous.accountId && bank) {
        const eventIds = store.all("SELECT DISTINCT event_id AS id FROM plan_entries WHERE plan_id = ? AND event_id <> ''", previous.id).map(row => row.id);
        if (eventIds.length) bank.post({ user, module: "plans", op: "assign", prev: { accountId: previous.accountId }, write: ctx => ctx.affected(eventIds) });
      }
      audit(user, "plan.updated", previous.id, { previous: { name: previous.name, total: previous.total, status: previous.status, accountId: previous.accountId }, ...input, accountId, status });
      return detail(previous.id, user);
    });
    changed(user, { planId: previous.id });
    changed(user, { kind: "accounts", accountId: result.accountId || "" });
    ok(res, result);
  });

  router.delete("/api/workspace/plans/:id", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    if (plan.invoiceId) throw new HttpError(409, `Bu kart ${plan.invoiceNumber || "bir fatura"} ile açıldı (vadeli satışın taksitleri). Kaldırmak için faturayı iptal edin ya da iade faturası kesin.`, { code: "invoice-linked", invoiceId: plan.invoiceId });
    const linked = cheques()?.countForPlan ? cheques().countForPlan(plan.id) : 0;
    // Silinen kart cari bakiyesinden ve Kasa'dan düşer: kapanmış dönemdeki borcu ya da tahsilatı varsa silinemez.
    if (!plan.coversBalance) period?.assertOpen(plan.registeredOn, "Bu kartın Kayıt Tarihi");
    const firstEntry = store.get("SELECT MIN(date) AS day FROM plan_entries WHERE plan_id = ?", plan.id)?.day;
    if (firstEntry) period?.assertOpen(firstEntry, "Bu kartın ilk tahsilatı");
    assertCloseOpen(plan.id, "Kart silinemez.");
    if (linked) throw new HttpError(409, `Bu karta sayılmış ${linked} çek/senet var. Önce Çek/Senet'ten evrakı silin ya da başka karta taşıyın.`);
    // v2.0.26 (A4): kartın tahsilat ve iadeleri Kasa'dan/bankadan düşer; toplam etki eksi bakiye denetiminden geçer (açılış/devir
    // ve çekle gelen tahsilat Kasa'ya hiç girmemişti, sayılmaz).
    cash?.guardRemove?.(store.all("SELECT kind, amount, method, date FROM plan_entries WHERE plan_id = ? AND opening = 0 AND cheque_id = ''", plan.id), url.searchParams.get("cashForce") === "1", "Bu kart silinince tahsilat ve iadeleriyle birlikte");
    store.tx(() => {
      // Yumuşak silme: taksitler ve hareketler yerinde durur; yönetim panelinden geri yüklenir. Kasa'dan düşer.
      store.run("UPDATE plans SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), plan.id);
      audit(user, "plan.deleted", plan.id, { name: plan.name, total: plan.total });
    });
    changed(user, { planId: plan.id });
    changed(user, { kind: "cash" });
    ok(res, { id: plan.id });
  });

  router.post("/api/workspace/plans/:id/distribute", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const body = await readJson(req);
    const result = store.tx(() => {
      const total = body.total === undefined || body.total === "" ? plan.total : amountOf(body.total, "Toplam tutar");
      if (roundMoney(total) !== roundMoney(Number(plan.total) || 0)) {
        // v2.0.23 (2. gözden geçirme): Otomatik Dağıt da kartın toplamını değiştirir; Düzenle'deki denetimler burada da geçerli
        // (faturanın kartı faturayla ayrışıyor, Mevcut Borç kartı carinin borcunu aşıyor, kilitli dönemin bakiyesi değişiyordu).
        if (plan.invoiceId) throw new HttpError(409, `Bu kart ${plan.invoiceNumber || "bir fatura"} ile açıldı; tutarı faturadan gelir. Taksit sayısı ve vadeleri buradan değişir; tutar için faturada Düzenle'yi ya da iade faturasını kullanın.`, { code: "invoice-linked", invoiceId: plan.invoiceId });
        if (!plan.coversBalance) period?.assertOpen(plan.registeredOn, "Bu kartın Kayıt Tarihi");
        else if (total > roundMoney(Number(plan.total) || 0) + 0.005) throw new HttpError(409, GROW_COVER, { code: "cover-grow" });
        assertCloseOpen(plan.id, "Kartın tutarı değiştirilemez.");
        store.run(`UPDATE plans SET ${FREEZE_CLOSE}, total = ?, updated_by = ?, updated_at = ? WHERE id = ?`, total, user.id, now(), plan.id);
      }
      const items = distributionInput(body, total, plan.registeredOn);
      replaceItems(plan.id, items);
      audit(user, "plan.distributed", plan.id, { total, count: items.length, firstDue: items[0].dueDate });
      return detail(plan.id, user);
    });
    changed(user, { planId: plan.id });
    ok(res, result);
  });

  // ---------- Taksitler (elle) ----------
  const itemInput = (body, plan = null) => {
    const dueDate = dateOf(body.dueDate, "Vade");
    if (period && plan?.registeredOn) period.dueDate(dueDate, { from: plan.registeredOn, label: "Taksit Vadesi" });
    return { dueDate, amount: amountOf(body.amount, "Taksit tutarı"), note: limited(body.note, 200, "Açıklama") };
  };
  const itemOf = (planId, itemId) => {
    const item = store.get("SELECT id, seq, due_date AS dueDate, amount, note FROM plan_items WHERE plan_id = ? AND id = ?", planId, limited(itemId, 120, "Taksit"));
    if (!item) throw new HttpError(404, "Taksit bulunamadı.");
    return item;
  };
  router.post("/api/workspace/plans/:id/items", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const input = itemInput(await readJson(req), plan);
    if (!(input.amount > 0)) throw new HttpError(400, "Taksit tutarı sıfırdan büyük olmalı.");
    const count = store.get("SELECT COUNT(*) AS n FROM plan_items WHERE plan_id = ?", plan.id).n;
    if (count >= MAX_ITEMS) throw new HttpError(400, `Bir kartta en fazla ${MAX_ITEMS} taksit olabilir.`);
    const id = newId("item");
    store.tx(() => {
      const seq = (store.get("SELECT COALESCE(MAX(seq), 0) AS s FROM plan_items WHERE plan_id = ?", plan.id)?.s || 0) + 1;
      const stamp = now();
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, plan.id, seq, input.dueDate, input.amount, input.note, stamp, stamp);
      audit(user, "plan.item.created", id, { planId: plan.id, ...input });
    });
    changed(user, { planId: plan.id });
    ok(res, detail(plan.id, user));
  });
  router.put("/api/workspace/plans/:id/items/:itemId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const previous = itemOf(plan.id, params.itemId);
    const input = itemInput({ ...previous, ...(await readJson(req)) }, plan);
    if (!(input.amount > 0)) throw new HttpError(400, "Taksit tutarı sıfırdan büyük olmalı.");
    store.tx(() => {
      store.run("UPDATE plan_items SET due_date = ?, amount = ?, note = ?, updated_at = ? WHERE id = ?", input.dueDate, input.amount, input.note, now(), previous.id);
      audit(user, "plan.item.updated", previous.id, { planId: plan.id, previous, ...input });
    });
    changed(user, { planId: plan.id });
    ok(res, detail(plan.id, user));
  });
  router.delete("/api/workspace/plans/:id/items/:itemId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const previous = itemOf(plan.id, params.itemId);
    store.tx(() => {
      store.run("UPDATE plan_entries SET item_id = NULL WHERE item_id = ?", previous.id);
      store.run("DELETE FROM plan_items WHERE id = ?", previous.id);
      audit(user, "plan.item.deleted", previous.id, { planId: plan.id, ...previous });
    });
    changed(user, { planId: plan.id });
    ok(res, detail(plan.id, user));
  });

  // ---------- Hareketler: tahsilat ve ödeme/iade ----------
  const entryInput = (body, planId) => {
    const kind = text(body.kind) || "in";
    if (!["in", "out"].includes(kind)) throw new HttpError(400, "Hareket türü tahsilat ya da ödeme olmalı.");
    const amount = amountOf(body.amount);
    if (!(amount > 0)) throw new HttpError(400, "Tutar sıfırdan büyük olmalı.");
    const date = period ? period.movementDate(body) : dateOf(body.date, "Tarih", today());
    const note = limited(body.note, 300, "Açıklama");
    let itemId = text(body.itemId) || null;
    if (itemId && kind === "out") itemId = null;
    if (itemId && !store.get("SELECT 1 AS found FROM plan_items WHERE id = ? AND plan_id = ?", itemId, planId)) throw new HttpError(400, "Seçilen taksit bu kartta yok; kartı yenileyin.");
    return { kind, amount, date, note, itemId, method: methodInput(body.method) };
  };
  const entryOf = (planId, entryId) => {
    const entry = store.get("SELECT id, item_id AS itemId, kind, amount, date, note, method, receipt_no AS receiptNo, cheque_id AS chequeId, opening, event_id AS eventId, created_by AS createdBy, created_at AS createdAt FROM plan_entries WHERE plan_id = ? AND id = ?", planId, limited(entryId, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Hareket bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };
  const requireEntryRight = (user, entry) => {
    if (entry.chequeId) throw new HttpError(409, "Bu tahsilat bir çek/senetten geldi; Çek/Senet'teki evraktan düzeltin (karşılıksız, geri al ya da sil).", { code: "cheque-linked", chequeId: entry.chequeId });
    if (entry.opening && !canUser(user, "plans.manage")) throw new HttpError(403, "Açılış (devir) kaydını yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
    if (entry.createdBy !== user.id && !canUser(user, "plans.manage")) throw new HttpError(403, "Başkasının girdiği hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
  };
  // Makbuz numarası: ofis genelinde artan sayaç (tahsilatlarda). Silinen makbuzun numarası yeniden verilmez.
  const nextReceipt = () => {
    const current = Number(store.setting("plans.receiptSeq", "0")) || 0;
    store.setSetting("plans.receiptSeq", String(current + 1));
    return current + 1;
  };

  // v2.0.13 (mutabakat testi bulgusu): kartın net tahsilatı (tahsilat − iade) eksiye düşemez. Tahsil edilenden fazla
  // iade, iadeden sonra tahsilatın silinmesi ya da küçültülmesi kartı "eksi ödenmiş" bırakıyor, kalan toplamdan büyük
  // görünüyordu (iadede kart kırpması toplamı eksiye düşürüyordu).
  const netPaid = (planId, exceptId = "") => roundMoney(store.all("SELECT id, kind, amount FROM plan_entries WHERE plan_id = ?", planId).filter(e => e.id !== exceptId).reduce((sum, e) => sum + (e.kind === "in" ? Number(e.amount) || 0 : -(Number(e.amount) || 0)), 0));
  const assertNetPaid = (planId, change, exceptId = "") => {
    const after = roundMoney(netPaid(planId, exceptId) + change);
    if (after < -0.005) throw new HttpError(400, `Bu kartta tahsil edilen net tutar ${tl(roundMoney(after - change))}; iade ya da düzeltme sonrası ${tl(after)} olur. İade tahsil edilenden fazla olamaz.`, { code: "refund-exceeds" });
  };
  // v2.0.24 (mutabakat bulgusu): faturanın kendi kartında tahsilat eklenince/düzeltilince/silinince kartın kalanı faturanın
  // açığına eşitlenir (iade avansa taşmışken tahsilat silinirse kart, iadenin düşürdüğü kısmı da geri istiyordu).
  const syncInvoiceCard = (user, planId) => {
    const invoiceId = store.get("SELECT invoice_id AS id FROM plans WHERE id = ?", planId)?.id;
    if (invoiceId) invoices()?.syncOwnCard?.(user, invoiceId);
  };
  router.post("/api/workspace/plans/:id/entries", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.collect");
    const plan = planRow(params.id);
    assertCloseOpen(plan.id, "Kartın tahsilatı ve iadesi değiştirilemez.");
    const body = await readJson(req);
    const input = store.tx(() => entryInput(body, plan.id));
    if (input.kind === "out" && !canUser(user, "plans.manage")) throw new HttpError(403, "Ödeme/iade girişi yönetici, uzman ve muhasebe yetkisidir.");
    if (input.kind === "out") assertNetPaid(plan.id, -input.amount);
    if (input.kind === "out") cash?.guardOut?.(input.amount, input.date, body.cashForce === true, input.method);
    const id = newId("entry");
    // v2.1.0 (bank.post): tahsilat/iade, İşlem No'lu işlem başlığı ve işlem geçmişi tek işlemde.
    bank.post({
      user,
      module: "plan",
      op: "create",
      write: () => {
        const receiptNo = input.kind === "in" ? nextReceipt() : null;
        store.run("INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, method, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, plan.id, input.itemId, input.kind, input.amount, input.date, input.note, receiptNo, input.method, bank.eventFor("plan_entries", { ...input, cheque_id: "", opening: 0 }), user.id, now());
        audit(user, input.kind === "in" ? "plan.collected" : "plan.refunded", id, { planId: plan.id, planName: plan.name, ...input, receiptNo });
        syncInvoiceCard(user, plan.id);
      },
    });
    changed(user, { planId: plan.id });
    changed(user, { kind: "cash" });
    touchedCase(user, plan);
    ok(res, { ...detail(plan.id, user), entryId: id });
  });
  router.put("/api/workspace/plans/:id/entries/:entryId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.collect");
    const plan = planRow(params.id);
    const previous = entryOf(plan.id, params.entryId);
    requireEntryRight(user, previous);
    period?.assertOpen(previous.date, "Bu taksit hareketi");
    assertCloseOpen(plan.id, "Kartın tahsilatı ve iadesi değiştirilemez.");
    const body = await readJson(req);
    const input = entryInput({ ...previous, ...body, kind: previous.kind }, plan.id);
    assertNetPaid(plan.id, previous.kind === "in" ? input.amount : -input.amount, previous.id);
    cash?.guardChange?.(previous, input, body.cashForce === true);
    bank.post({
      user,
      module: "plan",
      op: "update",
      prev: previous,
      write: () => {
        // Açılış (opening) satırı para satırı değildir: olay almaz; eski (olaysız) tahsilat düzeltilince olay alır.
        const eventId = bank.eventFor("plan_entries", { kind: previous.kind, date: input.date, method: input.method, opening: previous.opening ? 1 : 0, cheque_id: previous.chequeId || "", event_id: previous.eventId });
        store.run("UPDATE plan_entries SET item_id = ?, amount = ?, date = ?, note = ?, method = ?, event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.itemId, input.amount, input.date, input.note, input.method, eventId, user.id, now(), previous.id);
        audit(user, "plan.entry.updated", previous.id, { planId: plan.id, previous, ...input });
        syncInvoiceCard(user, plan.id);
      },
    });
    changed(user, { planId: plan.id });
    changed(user, { kind: "cash" });
    touchedCase(user, plan);
    ok(res, detail(plan.id, user));
  });
  router.delete("/api/workspace/plans/:id/entries/:entryId", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "plans.collect");
    const plan = planRow(params.id);
    const previous = entryOf(plan.id, params.entryId);
    requireEntryRight(user, previous);
    period?.assertOpen(previous.date, "Bu taksit hareketi");
    assertCloseOpen(plan.id, "Kartın tahsilatı ve iadesi değiştirilemez.");
    if (previous.kind === "in") assertNetPaid(plan.id, 0, previous.id);
    if (!previous.opening && !previous.chequeId) cash?.guardChange?.(previous, null, url.searchParams.get("cashForce") === "1", previous.kind === "in" ? "Bu taksit tahsilatı silinince" : "Bu taksit iadesi silinince");
    bank.post({
      user,
      module: "plan",
      op: "delete",
      prev: previous,
      write: () => {
        store.run("DELETE FROM plan_entries WHERE id = ?", previous.id);
        trash?.add({ kind: "plan-entry", ref: previous.id, title: plan.name, detail: previous.note || (previous.opening ? "Açılış (devir)" : previous.kind === "in" ? "Taksit tahsilatı" : "Taksit ödemesi/iadesi"), payload: { ...previous, opening: previous.opening ? 1 : 0, planId: plan.id, planName: plan.name }, user });
        audit(user, "plan.entry.deleted", previous.id, { planId: plan.id, ...previous });
        syncInvoiceCard(user, plan.id);
      },
    });
    changed(user, { planId: plan.id });
    changed(user, { kind: "cash" });
    touchedCase(user, plan);
    ok(res, detail(plan.id, user));
  });

  // ---------- PDF: ekstre ve makbuz ----------
  const office = () => store.setting("office.name", "");
  router.get("/api/workspace/plans/:id/ekstre.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "plans.view");
    const plan = detail(params.id, user);
    const pdf = planStatementPdf(plan, { officeName: office(), userName: user.display_name || user.username || "", now: clock() });
    audit(user, "plan.statement.exported", plan.id, { name: plan.name });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Taksit-ekstresi ${plan.name}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/plans/:id/entries/:entryId/makbuz.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "plans.view");
    const plan = detail(params.id, user);
    const entry = plan.entries.find(item => item.id === params.entryId);
    if (!entry) throw new HttpError(404, "Hareket bulunamadı.");
    // Açılış (devir) kaydı programda alınmış bir tahsilat değildir; makbuzu kesilmez (v2.0.8).
    if (entry.opening) throw new HttpError(409, "Açılış (devir) kaydının makbuzu olmaz: bu tutar programa girmeden önce ödenmişti.");
    const pdf = receiptPdf(plan, entry, { officeName: office(), userName: user.display_name || user.username || "", now: clock() });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Makbuz ${entry.receiptNo ? `No ${entry.receiptNo} ` : ""}${plan.name} ${dayText(entry.date)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });

  // ---------- Excel'den ilk yükleme ----------
  // Tarayıcı dosyayı okur (hof-excel-worker.js) ve seçilen sayfanın hücre matrisini gönderir. Başlıklar rollerle
  // eşlenir (istemci düzeltebilir); her satır bir kart olur, grup/alt grup adları tanımlanır, taksitler dağıtılır.
  // Aynı ad + grup ile açık bir kart varsa satır atlanır (yeniden yükleme çift kart açmaz).
  // v2.0.8: sayfadaki ay kolonları ("Eylül", "Ekim taksiti"…) ya da sıralı taksit kolonları ("1. Taksit Tarihi/Tutarı")
  // gerçek vade ve tutarlarıyla okunur (tablodan aktarma ile aynı motor, insight/schedules.mjs); Ödenen / Kalan kolonu
  // açılış (devir) olur; kartlar açık tablodaki aynı kişinin kaydına bağlanır.
  const SHEET_KEY = "excel";
  const matrixRows = (matrix, headerAt, headers) =>
    matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT).map((row, index) => {
      const object = { __sheet: SHEET_KEY, __hofSheet: SHEET_KEY, __hofKey: `excel-${index}`, __row: index };
      if (!Array.isArray(row)) return object;
      headers.forEach((header, column) => {
        if (header) object[header] = row[column] ?? "";
      });
      return object;
    });
  const scheduleShape = (matrix, headerAt, headers, { dueDay = 1, firstDue = "" } = {}) => {
    const objects = matrixRows(matrix, headerAt, headers);
    const { tabs, records } = extractSchedules({ rows: objects, tabs: [SHEET_KEY], now: clock(), dueDay, defaultFirstDue: firstDue });
    const tab = tabs[0] || null;
    // Toplam + taksit sayısı biçimi Excel yüklemesinde kullanıcının eşlemesiyle kurulur (aşağıdaki yol); motor yalnız
    // ay ve sıralı taksit kolonları için kullanılır.
    if (!tab || tab.shape === "summary") return { shape: null, records: new Map() };
    return { shape: tab.shape, shapeText: tab.shapeText, monthMode: tab.monthMode, columns: tab.columns, records: new Map(records.map(record => [record.key, record])) };
  };
  router.post("/api/workspace/plans/import/preview", async ({ req, res }) => {
    auth.requirePermission(req, "plans.manage");
    const body = await readJson(req, { limit: 20_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = matrix.findIndex(row => Array.isArray(row) && row.filter(cell => String(cell ?? "").trim()).length >= 2);
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(cell => String(cell ?? "").trim());
    const roles = mapHeaders(headers);
    const schedule = scheduleShape(matrix, headerAt, headers);
    // Ay / taksit kolonları taksit olarak okunuyorsa "ilk vade", "taksit sayısı", "taksit tutarı" rolleri kullanılmaz;
    // o kolonlar eşlemede "Kullanma" gösterilir (yanlışlıkla ilk vade sanılan "1. Taksit Tarihi" gibi).
    if (schedule.shape) {
      const scheduled = new Set(schedule.columns);
      for (const [index, role] of Object.entries(roles)) if (scheduled.has(headers[Number(index)]) || ["firstDue", "count", "installment"].includes(role)) delete roles[index];
    }
    const hasTable = dataset?.hasData ? dataset.hasData() : false;
    ok(res, { headerAt, headers, roles, rows: matrix.length - headerAt - 1, schedule: schedule.shape ? { shape: schedule.shape, shapeText: schedule.shapeText, monthMode: schedule.monthMode, columns: schedule.columns, count: schedule.records.size } : null, hasTable });
  });
  // Açık tablodaki kayıtlar: ad (ve telefon) ile kesin eşleşen tek kayıt varsa kart ona bağlanır (kişi bir kez girilir).
  async function recordIndex() {
    if (!dataset?.view) return null;
    let view;
    try {
      view = await dataset.view();
    } catch {
      return null;
    }
    const rows = (view.rows || []).filter(row => row?.__hofKey && !String(row.__hofKey).startsWith("free:"));
    if (!rows.length) return null;
    const byTab = new Map();
    for (const row of rows) {
      const tab = String(row.__sheet || "");
      if (!byTab.has(tab)) byTab.set(tab, []);
      byTab.get(tab).push(row);
    }
    const fold = value => String(value ?? "").normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
    const digits = value => String(value ?? "").replace(/\D/g, "");
    const index = new Map();
    const now = clock();
    for (const [tab, scope] of byTab) {
      const context = tabContext(scope, { now });
      const nameColumn = context.primary.person;
      if (!nameColumn) continue;
      for (const row of scope) {
        const name = fold(row[nameColumn]);
        if (!name) continue;
        if (!index.has(name)) index.set(name, []);
        index.get(name).push({ key: row.__hofKey, phone: digits(context.primary.phone ? row[context.primary.phone] : ""), title: String(row[nameColumn]).trim(), tab });
      }
    }
    const carded = linkedCases(currentSource());
    return {
      find(name, phone) {
        const hits = index.get(fold(name)) || [];
        const wanted = digits(phone);
        const matched = hits.filter(hit => !(wanted.length >= 7 && hit.phone.length >= 7) || hit.phone === wanted);
        return matched.length === 1 ? { ...matched[0], carded: carded.has(matched[0].key) } : null;
      },
    };
  }
  router.post("/api/workspace/plans/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req, { limit: 20_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = Math.max(0, Math.trunc(Number(body.headerAt) || 0));
    const roles = body.roles && typeof body.roles === "object" ? body.roles : {};
    const columnOf = role => {
      const found = Object.entries(roles).find(([, value]) => value === role);
      return found ? Number(found[0]) : -1;
    };
    const col = Object.fromEntries(["seq", "registered", "group", "subgroup", "name", "phone", "total", "count", "firstDue", "installment", "note", "paid", "remaining"].map(role => [role, columnOf(role)]));
    if (col.name < 0) throw new HttpError(400, "Ad Soyad kolonunu seçin.");
    const headers = (Array.isArray(matrix[headerAt]) ? matrix[headerAt] : []).map(value => String(value ?? "").trim());
    const dueDay = Math.min(28, Math.max(1, Math.trunc(Number(body.dueDay) || 1)));
    const defaults = { count: Math.trunc(Number(body.defaultCount) || 0), firstDue: text(body.defaultFirstDue), groupName: limited(body.groupName, 80, "Grup adı"), subgroupName: limited(body.subgroupName, 80, "Alt grup adı") };
    // Ay / sıralı taksit kolonları (v2.0.8): taksitler oradan; yoksa toplam + taksit sayısı + ilk vade eşit bölünür.
    const schedule = scheduleShape(matrix, headerAt, headers, { dueDay, firstDue: defaults.firstDue });
    if (!schedule.shape && col.total < 0 && col.installment < 0) throw new HttpError(400, "Toplam tutar (ya da taksit tutarı) kolonunu seçin.");
    // Tablodaki kayıtlara bağ (v2.0.8; varsayılan açık): aynı ad (+ telefon) ile tek kayıt.
    const linkRecords = !(body.linkRecords === false || body.linkRecords === "0" || body.linkRecords === 0 || body.linkRecords === "false");
    const records = linkRecords ? await recordIndex() : null;
    const cell = (row, index) => (index >= 0 ? String(row[index] ?? "").trim() : "");
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, skipped: [], groups: 0, linked: 0, records: 0, opening: 0, shape: schedule.shape || "summary", importId: "" };
    const skip = (index, reason) => report.skipped.push({ row: headerAt + index + 2, reason });
    const before = store.get("SELECT COUNT(*) AS n FROM plan_groups").n;
    const source = currentSource();
    const importId = newId("import");
    const undo = { plans: [], openings: [], links: [], accounts: [], accountLinks: [], payments: [], groups: [], source };
    store.tx(() => {
      // Sıra No kolonu yoksa ya da hücre boşsa numara mevcut en büyük numaradan devam eder.
      let autoRef = Number(nextRef()) - 1;
      const groupsBefore = new Set(store.all("SELECT id FROM plan_groups").map(row => row.id));
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => String(value ?? "").trim())) return;
        const name = cell(row, col.name).slice(0, 160);
        if (!name) return skip(index, "Ad Soyad boş");
        const groupName = (cell(row, col.group) || defaults.groupName).slice(0, 80);
        const subgroupName = (cell(row, col.subgroup) || defaults.subgroupName).slice(0, 80);
        const phone = cell(row, col.phone).slice(0, 60);
        // Taksitler: motordan (ay / sıralı kolonlar) ya da eşit bölme.
        let items = [];
        let total = Number.NaN;
        const scheduled = schedule.shape ? schedule.records.get(`excel-${index}`) : null;
        if (schedule.shape) {
          if (!scheduled) return skip(index, "Taksit kolonları okunamadı");
          const error = scheduled.issues.find(issue => issue.level === "error");
          if (error) return skip(index, error.text);
          items = scheduled.items.map(item => ({ dueDate: item.dueDate, amount: item.amount, paid: item.paid, label: item.label }));
          total = scheduled.total;
        } else {
          let count = Math.trunc(Number(cell(row, col.count).replace(/\D+/g, ""))) || defaults.count || 0;
          const installment = col.installment >= 0 ? parseAmount(cell(row, col.installment)) : Number.NaN;
          total = col.total >= 0 ? parseAmount(cell(row, col.total)) : Number.NaN;
          if (!Number.isFinite(total) && Number.isFinite(installment) && count > 0) total = roundMoney(installment * count);
          if (!Number.isFinite(total) || total < 0) return skip(index, "Toplam tutar okunamadı");
          if (!count && Number.isFinite(installment) && installment > 0) count = Math.max(1, Math.round(total / installment));
          const firstDue = parseDay(cell(row, col.firstDue)) || defaults.firstDue;
          if (count > 0 && total > 0 && validDate(firstDue)) items = distribute({ total, count: Math.min(count, MAX_ITEMS), firstDue }).map(item => ({ ...item, paid: 0, label: "" }));
          // Ödenen (ya da Toplam − Kalan) açılış olarak en eski taksitten düşülür.
          const paidValue = col.paid >= 0 ? parseAmount(cell(row, col.paid)) : Number.NaN;
          const remainingValue = col.remaining >= 0 ? parseAmount(cell(row, col.remaining)) : Number.NaN;
          const paid = Number.isFinite(paidValue) && paidValue > 0 ? paidValue : Number.isFinite(remainingValue) && remainingValue >= 0 && total >= remainingValue ? roundMoney(total - remainingValue) : 0;
          if (paid > 0.004) {
            if (!items.length) return skip(index, "Ödenen tutar var ama taksitler kurulamadı (taksit sayısı ve ilk vade gerekli)");
            const left = spreadPaid(items, paid);
            if (left > 0.004) return skip(index, `Ödenen tutar taksitlerin toplamından ${roundMoney(left)} fazla`);
          }
        }
        // Tablodaki kayıt: kesin tek eşleşme bağlanır; o kaydın kartı zaten varsa satır atlanır (çift kart yok).
        const record = records ? records.find(name, phone) : null;
        // Kayıt tarihi kolonu yoksa ya da okunamıyorsa yükleme günü; v2.0.12: kart mevcut bir cariye bağlanırsa onun tarihi.
        const excelDay = parseDay(cell(row, col.registered)) || (scheduled?.registeredOn || "");
        const registeredOn = excelDay || today();
        // Gruplar yalnızca kart açılacak satırlar için tanımlanır (atlanan satır boş grup bırakmaz). v2.0.26 (G6): grup, cari ve kart
        // iç işlemde (SAVEPOINT) açılır; kartın Kayıt Tarihi kapanmış dönemdeyse hepsi geri alınır, satır nedeniyle atlanır (yükleme
        // durmaz). 2. gözden geçirme İ2: grup önceden iç işlemin DIŞINDA açılıyordu; kilit yüzünden atlanan satır boş grup bırakıyor
        // (Geri Al'sız; aktarım kaydı yoktu) ve rapor "groups: 1" diyordu.
        let person;
        let outcome;
        let accountId;
        let start;
        try {
          ({ person, outcome, accountId, start } = store.tx(() => {
            const g = groupName ? ensureGroup(user, groupName) : null;
            const sg = g && subgroupName ? ensureGroup(user, subgroupName, g) : null;
            const duplicate = store.get("SELECT id FROM plans WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND COALESCE(group_id, '') = ?", name, g || "");
            if (duplicate) throw new SkippedRow("Aynı adla açık kart var");
            if (record?.carded) throw new SkippedRow("Tablodaki kaydının taksit kartı zaten var");
            const who = { name, phone, note: cell(row, col.note).slice(0, 1000), registeredOn, groupId: g, subgroupId: sg, caseKey: record?.key || "", caseSource: record ? source : "", caseTitle: record?.title || "" };
            // Cari (v2.0.6): aynı ad ve telefonla (ya da telefonsuz aynı ad ve grupla) tek bir cari varsa ona bağlanır; yoksa açılır.
            const result = {};
            const id = accounts()?.createFromPlan(user, who, result) || "";
            const ownerDay = !excelDay && id && !result.created ? store.get("SELECT registered_on AS day FROM accounts WHERE id = ?", id)?.day || "" : "";
            const day = scheduledStart(ownerDay || registeredOn, items);
            const reason = lockedStartReason(day);
            if (reason) throw new SkippedRow(reason);
            return { person: who, outcome: result, accountId: id, start: day };
          }));
        } catch (error) {
          if (!(error instanceof SkippedRow)) throw error;
          return skip(index, error.message);
        }
        // Sıra No: tablodaki numara ya da (atlanan satır numara yemesin diye kart açılacağı kesinleşince) sıradaki numara.
        const refNo = cell(row, col.seq).slice(0, 30) || String((autoRef += 1));
        if (accountId && !outcome.created) report.linked += 1;
        if (outcome.created) undo.accounts.push(accountId);
        if (outcome.linked) undo.accountLinks.push({ accountId, caseKey: person.caseKey });
        const created = createScheduled(user, { ...person, registeredOn: start, accountId, refNo, total }, { importId, items, openingDate: today(), openingNote: "Excel'de ödenmiş (açılış)" });
        if (!items.length && total > 0) store.run("UPDATE plans SET total = ? WHERE id = ?", roundMoney(total), created.id);
        undo.plans.push(created.id);
        undo.openings.push(...created.openingIds);
        if (record) report.records += 1;
        report.opening = roundMoney(report.opening + items.reduce((sum, item) => sum + Math.min(Number(item.paid) || 0, Number(item.amount) || 0), 0));
        report.created += 1;
      });
      report.groups = store.get("SELECT COUNT(*) AS n FROM plan_groups").n - before;
      undo.groups = store.all("SELECT id FROM plan_groups").map(row => row.id).filter(id => !groupsBefore.has(id));
      if (report.created) {
        report.importId = importId;
        const summary = { created: report.created, linked: 0, accountsCreated: undo.accounts.length, paymentsMoved: 0, total: 0, opening: report.opening, remaining: 0, skipped: report.skipped.length };
        store.run("INSERT INTO plan_imports (id, kind, source, title, summary_json, undo_json, created_by, created_at) VALUES (?, 'excel', ?, ?, ?, ?, ?, ?)", importId, source, `Excel: ${limited(body.fileName, 150, "Dosya adı") || "dosya"}`, JSON.stringify(summary), JSON.stringify(undo), user.id, now());
      }
      audit(user, "plan.imported", "import", { created: report.created, skipped: report.skipped.length, groups: report.groups, records: report.records, opening: report.opening, shape: report.shape, importId: report.importId, file: limited(body.fileName, 200, "Dosya adı") });
    });
    changed(user, { groups: true });
    changed(user, { kind: "accounts" });
    if (report.records) changed(user, { kind: "dues", datasetKey: source });
    ok(res, report);
  });

  // ---------- Diğer modüller için ----------
  // Kasa (v2.1.0, K5): taksit hareketleri Kasa'ya tek kaynaktan (lib/bank/money-lines.mjs, kaynak 6) düşer. Bu satır listesi yalnız eski
  // tablo raporunun (routes/reports.mjs) nakit akışı içindir (plan §11.1 A11, Aşama 14).
  // Açılış (devir) kaydı (v2.0.8) Kasa'ya girmez: o para bu programın kasasından geçmedi.
  const cashSource = { table: "plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL", where: "e.cheque_id = '' AND e.opening = 0", kind: "e.kind", amount: "e.amount", date: "e.date", method: "e.method" };
  const cashEntries = (after = "") =>
    store.all(
      `SELECT e.id, e.kind, 'plan' AS source, e.method, e.amount, e.date, e.note AS description, e.plan_id AS planId, p.name AS planName,
              e.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM ${cashSource.table} LEFT JOIN users u ON u.id = e.created_by
       WHERE ${cashSource.where}${after ? ` AND ${cashSource.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
  // Tahsilat takvimi ve bildirimler: vadesi geçen, bugün ve 7 gün içinde gelecek açık taksitler.
  // v2.0.23 (2. gözden geçirme): birleşik listelerde (takvim, bildirim, yaşlandırma, nakit akış, vade takip) kartın payı kartın
  // kalanını (tutar − tahsil edilen) aşmaz. Tutarı Düzenle ile küçültülüp taksitleri yeniden dağıtılmayan kartta taksitler
  // toplamı tutardan büyük kalıyor, fark listelerde fazladan sayılıyordu; fazlası son vadeli taksitlerden düşülür.
  function capToRemaining(ledger) {
    let room = Math.max(0, Number(ledger.totals?.remaining) || 0);
    return ledger.items.map(item => {
      const remaining = roundMoney(Math.min(item.remaining, room));
      room = roundMoney(room - remaining);
      return remaining === item.remaining ? item : { ...item, remaining, partial: remaining > 0.005 && remaining < item.amount - 0.005 };
    });
  }
  function dueItems(day = today()) {
    const out = [];
    const plans = store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.status = 'active'`);
    if (!plans.length) return out;
    const items = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
      if (!items.has(item.planId)) items.set(item.planId, []);
      items.get(item.planId).push(item);
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push(entry);
    }
    for (const plan of plans) {
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      for (const item of capToRemaining(ledger)) {
        if (item.remaining <= 0.005 || item.state === "open" || item.state === "closed") continue;
        const where = [plan.groupName, plan.subgroupName].filter(Boolean).join(" › ");
        out.push({
          id: `plan|${plan.id}|${item.id}`,
          source: "plan",
          planId: plan.id,
          itemId: item.id,
          person: plan.name,
          caseNo: where,
          caseKey: plan.caseKey || "",
          caseSource: plan.caseSource || "",
          caseTitle: plan.caseTitle || "",
          tab: "",
          label: `${item.seq}. taksit`,
          kind: "date",
          dueDate: item.dueDate,
          dueText: dayText(item.dueDate),
          amount: item.remaining,
          partial: item.partial,
          days: item.days,
          state: item.state === "today" ? "today" : item.state === "overdue" ? "overdue" : "upcoming",
          phone: plan.phone,
        });
      }
    }
    return out;
  }
  // Nakit akışı (v2.0.7): açık kartların kalanı olan TÜM taksitleri (vade penceresi yok; ayrımı rapor motoru yapar).
  function openItems(day = today()) {
    const out = [];
    const plans = store.all(
      "SELECT p.id, p.name, p.phone, p.ref_no AS refNo, p.total, p.status, p.account_id AS accountId, COALESCE(a.name, '') AS accountName FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND p.status = 'active'",
    );
    if (!plans.length) return out;
    const items = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
      if (!items.has(item.planId)) items.set(item.planId, []);
      items.get(item.planId).push(item);
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push(entry);
    }
    for (const plan of plans) {
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      for (const item of capToRemaining(ledger)) {
        if (item.remaining <= 0.005 || item.state === "closed") continue;
        // Vade takip (v2.0.9) kartı, cariyi ve taksiti de gösterir; nakit akışı yalnız tarih/tutar/kaynağı okur.
        out.push({ date: item.dueDate, direction: "in", amount: item.remaining, source: "plan", label: `${item.seq}. taksit${item.partial ? " (kalan)" : ""}`, party: plan.name, ref: { type: "plan", id: plan.id }, seq: item.seq, fullAmount: item.amount, partial: Boolean(item.partial), phone: plan.phone || "", refNo: plan.refNo || "", accountId: plan.accountId || "", accountName: plan.accountName || "" });
      }
    }
    return out;
  }
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') FROM plan_entries) AS e, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM plan_items) AS i, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') || '/' || COUNT(deleted_at) FROM plans) AS p");
    return `${row.e}|${row.i}|${row.p}`;
  };

  // Kayda bağlı kartlar (v2.0.6): kişinin kartı için taksitleriyle; açık olanlar önce.
  function forCase(caseKey, caseSource, user) {
    if (!caseKey) return [];
    return store
      .all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.case_key = ? AND (? = '' OR p.case_source = ?) ORDER BY (p.status = 'active') DESC, p.created_at`, caseKey, caseSource || "", caseSource || "")
      .map(plan => shape(plan, user));
  }
  // Kayda bağlı kartların hareketleri: kişinin işlem geçmişinde tahsilat / ödeme olarak listelenir.
  function entriesForCase(caseKey, caseSource) {
    if (!caseKey) return [];
    return store.all(
      `SELECT e.id, e.plan_id AS planId, p.name AS planName, e.item_id AS itemId, i.seq AS itemSeq, e.kind, e.amount, e.date, e.note, e.receipt_no AS receiptNo, e.opening,
              e.created_by AS actorId, e.created_at AS createdAt, e.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName
       FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN plan_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.created_by
       WHERE p.case_key = ? AND (? = '' OR p.case_source = ?)`,
      caseKey, caseSource || "", caseSource || "",
    );
  }

  // Cari (v2.0.6): carilerin taksit özetleri tek geçişte (liste ve bakiye için) ve bir carinin kartları ayrıntılı.
  // accountIds (v2.1.0, §3.11): yalnız bu carilerin kartları (mutabakat kapısı dokunulan carileri denetler).
  function summariesByAccount(accountIds = null) {
    const only = accountIds ? JSON.stringify([...accountIds]) : null;
    const plans = only ? store.all(`${PLAN_SQL} WHERE +p.deleted_at IS NULL AND p.account_id <> '' AND p.account_id IN (SELECT value FROM json_each(?))`, only) : store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.account_id <> ''`);
    const out = new Map();
    if (!plans.length) return out;
    const planIds = only ? JSON.stringify(plans.map(plan => plan.id)) : null;
    const items = new Map();
    for (const item of planIds ? store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items WHERE plan_id IN (SELECT value FROM json_each(?)) ORDER BY due_date, seq", planIds) : store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
      if (!items.has(item.planId)) items.set(item.planId, []);
      items.get(item.planId).push(item);
    }
    const entries = new Map();
    for (const entry of planIds ? store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries WHERE plan_id IN (SELECT value FROM json_each(?)) ORDER BY date, created_at, rowid", planIds) : store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push(entry);
    }
    const day = today();
    for (const plan of plans) {
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ id: plan.id, name: plan.name, total: plan.total, coversBalance: Boolean(plan.coversBalance), status: plan.status, state: ledger.state, totals: ledger.totals, next: ledger.next, itemCount: ledger.items.length });
    }
    return out;
  }
  // v2.0.24: iadelerin Mevcut Borç kartlarından düştüğü tutar (iade belgesinde payment_json.coverCuts; iptal/silinen iade
  // sayılmaz). Kartın kapsamı açıldığı andaki tutarla kurulur (lib/accounts.mjs coverTotal): iadenin kapattığı borç kartın
  // payından düşer; küçülen tutar başka (daha eski) bir faturayı kapsamdan çıkarıp aynı borcu iki kez saydırmaz.
  function returnCuts() {
    const out = new Map();
    for (const row of store.all("SELECT payment_json AS j FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'")) {
      let cuts = {};
      try {
        cuts = JSON.parse(row.j || "{}").coverCuts || {};
      } catch {
        cuts = {};
      }
      for (const [planId, cut] of Object.entries(cuts)) out.set(planId, roundMoney((out.get(planId) || 0) + (Number(cut) || 0)));
    }
    return out;
  }
  // Mizan (v2.0.7): tüm carilerin kartları, hareketleriyle; carinin defteri (accountLedger) Cari kartıyla aynı girdiyi alır.
  function ledgerPlansByAccount() {
    const out = new Map();
    const plans = store.all("SELECT id, account_id AS accountId, name, total, status, covers_balance AS coversBalance, registered_on AS registeredOn, created_at AS createdAt, updated_at AS updatedAt FROM plans WHERE deleted_at IS NULL AND account_id <> ''");
    if (!plans.length) return out;
    const seqs = new Map();
    const counts = new Map();
    const planned = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq, amount FROM plan_items")) {
      seqs.set(item.id, item.seq);
      counts.set(item.planId, (counts.get(item.planId) || 0) + 1);
      planned.set(item.planId, (planned.get(item.planId) || 0) + (Number(item.amount) || 0));
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date, note, receipt_no AS receiptNo, opening, cheque_id AS chequeId, created_at AS createdAt FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push({ ...entry, opening: Boolean(entry.opening), itemSeq: entry.itemId ? seqs.get(entry.itemId) || null : null });
    }
    const cutsOf = returnCuts();
    for (const plan of plans) {
      const own = entries.get(plan.id) || [];
      const paid = roundMoney(own.reduce((sum, entry) => sum + (entry.kind === "in" ? Number(entry.amount) || 0 : -(Number(entry.amount) || 0)), 0));
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ ...plan, itemCount: counts.get(plan.id) || 0, planned: roundMoney(planned.get(plan.id) || 0), returnCuts: cutsOf.get(plan.id) || 0, totals: { paid }, entries: own });
    }
    return out;
  }
  function forAccount(accountId, user) {
    if (!accountId) return [];
    const cutsOf = returnCuts();
    return store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.account_id = ? ORDER BY (p.status = 'active') DESC, p.created_at`, accountId).map(plan => {
      const shaped = shape(plan, user);
      const seqOf = new Map(shaped.items.map(item => [item.id, item.seq]));
      return { ...shaped, itemCount: shaped.items.length, returnCuts: cutsOf.get(plan.id) || 0, entries: shaped.entries.map(entry => ({ ...entry, itemSeq: entry.itemId ? seqOf.get(entry.itemId) || null : null })) };
    });
  }
  // Carinin toplu taksitlendirmesi (routes/accounts.mjs): kartı cariye bağlı açar, isterse taksitleri dağıtır.
  // v2.0.12: kartın Kayıt Tarihi carinin kayıt tarihidir (kişi bir kez kaydolur; kart açıldığı gün değil).
  // refNo verilirse (toplu taksitlendirme sayacı) kart tablosu her kartta yeniden taranmaz.
  // v2.0.13: coversBalance = carinin mevcut borcunu (veresiye satış, açılış) taksitlendirir; ikinci kez borç yazmaz.
  // v2.0.15: faturadan açılan kartın Kayıt Tarihi fatura tarihidir (registeredOn) ve kart faturaya bağlıdır (invoiceId).
  function createForAccount(user, account, { total, count = 0, firstDue = "", everyMonths = 1, name = "", note = "", refNo = "", coversBalance = false, registeredOn: fixedOn = "", invoiceId = "" }) {
    const id = newId("plan");
    const amount = roundMoney(Number(total) || 0);
    const registeredOn = fixedOn || (account.registeredOn && account.registeredOn <= today() ? account.registeredOn : today());
    if (count > 0 && period) period.dueDate(firstDue, { from: registeredOn, label: "İlk Vade" });
    if (!coversBalance) period?.assertOpen(registeredOn, "Kartın Kayıt Tarihi");
    const stamp = now();
    store.run(
      "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, covers_balance, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
      id, account.id, refNo || nextRef(), registeredOn, account.caseKey || "", account.caseSource || "", account.caseTitle || "", account.groupId || null, account.subgroupId || null, (name || account.name).slice(0, 160), (note || "").slice(0, 1000), account.phone || "", amount, coversBalance ? 1 : 0, user.id, stamp, stamp,
    );
    if (count > 0 && amount > 0) replaceItems(id, distribute({ total: amount, count: Math.min(count, MAX_ITEMS), firstDue, everyMonths }));
    if (invoiceId) store.run("UPDATE plans SET invoice_id = ? WHERE id = ?", invoiceId, id);
    audit(user, "plan.created", id, { name: name || account.name, total: amount, accountId: account.id, bulk: true, coversBalance, invoiceId });
    return id;
  }
  // Satıştan iade iptal edilince (v2.0.15): iadenin küçülttüğü taksit kartı geri büyür — tutar son taksite eklenir; kart,
  // faturanın taksitlendirilen kalanını aşmaz (cap). Kapatılmış kart değişmez.
  function growForInvoice(user, planId, amount, cap, note = "") {
    const plan = store.get("SELECT id, name, total, status FROM plans WHERE id = ? AND deleted_at IS NULL", planId);
    if (!plan || plan.status === "closed") return null;
    const grow = roundMoney(Math.min(Number(amount) || 0, (Number(cap) || 0) - (Number(plan.total) || 0)));
    if (!(grow > 0.005)) return null;
    const last = store.get("SELECT id, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date DESC, seq DESC LIMIT 1", plan.id);
    const stamp = now();
    if (last) store.run("UPDATE plan_items SET amount = ?, updated_at = ? WHERE id = ?", roundMoney((Number(last.amount) || 0) + grow), stamp, last.id);
    else {
      // v2.0.17 (stres testi bulgusu): iade kartı tümüyle küçültmüşse (taksit satırı kalmamışsa) iade iptalinde borç
      // yeniden karta yazılır — yeni bir taksit satırı açılır (vade: son tahsilat tarihi ya da bugün). Aksi hâlde cari
      // borçlanır ama taksit kartı 0'da kalır (kart ile cari uyuşmaz).
      const lastEntry = store.get("SELECT MAX(date) AS date FROM plan_entries WHERE plan_id = ?", plan.id)?.date || "";
      const seq = (store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM plan_items WHERE plan_id = ?", plan.id)?.n || 0) + 1;
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("item"), plan.id, seq, lastEntry > today() ? lastEntry : today(), grow, note || "İade iptali", stamp, stamp);
    }
    store.run("UPDATE plans SET total = ?, updated_by = ?, updated_at = ? WHERE id = ?", roundMoney((Number(plan.total) || 0) + grow), user.id, stamp, plan.id);
    audit(user, "plan.grown", plan.id, { from: plan.total, to: roundMoney((Number(plan.total) || 0) + grow), reason: note || "İade iptali" });
    return { id: plan.id, grow };
  }
  // Fatura iptalinde faturanın kartı: tahsilatı yoksa kaldırılır (Silinenler'e gitmez; fatura iptalle geri gelmez).
  // Tahsilat varsa iptal durur: para alınmıştır; borcu düşürmek için iade faturası kesilir (kart kalana göre küçülür).
  function removeForInvoice(user, invoiceId) {
    const ids = [];
    for (const plan of store.all("SELECT id, name FROM plans WHERE invoice_id = ? AND deleted_at IS NULL", invoiceId)) {
      const paid = store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", plan.id).n;
      if (paid) throw new HttpError(409, `Faturanın taksit kartında (“${plan.name}”) ${paid} tahsilat var; fatura iptal edilemez. Borcu düşürmek için iade faturası kesin.`, { code: "plan-has-payments", planId: plan.id });
      const linked = cheques()?.countForPlan ? cheques().countForPlan(plan.id) : 0;
      if (linked) throw new HttpError(409, `Faturanın taksit kartına sayılmış ${linked} çek/senet var; önce evrakı karttan ayırın.`, { code: "plan-has-cheques", planId: plan.id });
      store.run("UPDATE plans SET deleted_by = ?, deleted_at = ?, updated_at = ? WHERE id = ?", user.id, now(), now(), plan.id);
      audit(user, "plan.deleted", plan.id, { name: plan.name, invoiceId, reason: "invoice-cancelled" });
      ids.push(plan.id);
    }
    return ids;
  }
  // Cari adı/telefonu değişince, adı/telefonu eski cariyle aynı olan kartlar da güncellenir (farklı adlı kart dokunulmaz).
  function followAccount(accountId, previous, next) {
    if (previous.name !== next.name) store.run(`UPDATE plans SET ${FREEZE_CLOSE}, name = ?, updated_at = ? WHERE account_id = ? AND name = ?`, next.name, now(), accountId, previous.name);
    if (previous.phone !== next.phone) store.run(`UPDATE plans SET ${FREEZE_CLOSE}, phone = ?, updated_at = ? WHERE account_id = ? AND phone = ?`, next.phone, now(), accountId, previous.phone);
  }
  const countForAccount = accountId => store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND account_id = ?", accountId).n;
  const receiptSeq = () => nextReceipt();

  // ---------- Aktarma (v2.0.8): tablodan ya da Excel'den kart ----------
  // Kartı taksitleriyle açar; Excel'e göre ödenmiş kısım her taksit için bir açılış (devir) kaydıdır: taksiti kapatır,
  // carinin bakiyesine sayılır, Kasa'ya girmez, makbuzu yoktur. Çağıran tek işlem bloğu (store.tx) içinde çağırır.
  // items: [{ dueDate, amount, paid, label }] (vade sırasıyla). Dönüş: { id, openingIds }.
  // v2.0.13: aktarılan (tarihsel) kartın işlem tarihi en geç ilk vadesidir: Kayıt Tarihi bilinmiyorsa ya da ilk
  // vadeden sonraysa ilk vade alınır (vade, kartın işlem tarihinden önce olamaz).
  function scheduledStart(registeredOn, items = []) {
    const firstDue = items.map(item => item.dueDate).filter(Boolean).sort()[0] || "";
    let start = registeredOn && registeredOn <= today() ? registeredOn : today();
    if (firstDue && firstDue < start) start = firstDue;
    return start;
  }
  // v2.0.26 (gözden geçirme G6): aktarılan kart cariye Kayıt Tarihi'nde borç yazar; o gün kapanmış dönemdeyse kişi aktarılmaz,
  // nedeni aktarım raporuna yazılır (önceden bütün aktarım kapıda nedensiz 409 ile duruyordu).
  function lockedStartReason(start) {
    const lock = period?.lockedUntil?.() || "";
    return lock && start && start <= lock ? `Kartın Kayıt Tarihi (${dayText(start)}; ilk vade ya da kayıt günü) kapatılmış (kilitli) dönemde (${dayText(lock)} ve öncesi); kart açılmadı. Yönetici dönem kilidini açarsa yeniden aktarın.` : "";
  }
  function createScheduled(user, input, { importId = "", items = [], openingDate = today(), openingNote = "Excel'de ödenmiş" } = {}) {
    const id = newId("plan");
    const total = roundMoney(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const registeredOn = scheduledStart(input.registeredOn, items);
    // Kart, taksitleri ve açılış kayıtları tek damga taşır: geri alma denetimi (plan-transfer.mjs) "created_at =
    // updated_at" ile kartın aktarımdan sonra dokunulmadığını anlar; iki ayrı now() milisaniye sınırında ayrışabiliyordu.
    const stamp = now();
    store.run(
      "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, import_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
      id, input.accountId || "", input.refNo || nextRef(), registeredOn, input.caseKey || "", input.caseKey ? input.caseSource || currentSource() : "", input.caseKey ? input.caseTitle || input.name : "", input.groupId || null, input.subgroupId || null, String(input.name).slice(0, 160), String(input.note || "").slice(0, 1000), String(input.phone || "").slice(0, 60), total, importId, user.id, stamp, stamp,
    );
    const openingIds = [];
    items.slice(0, MAX_ITEMS).forEach((item, index) => {
      const itemId = newId("item");
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", itemId, id, index + 1, item.dueDate, roundMoney(item.amount), String(item.label || "").slice(0, 200), stamp, stamp);
      const paid = roundMoney(Math.min(Number(item.paid) || 0, Number(item.amount) || 0));
      if (paid > 0.004) {
        const entryId = newId("entry");
        // Excel'de ödenmiş (açılış/devir): Kasa'ya girmez, para satırı değildir.
        store.run("INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, opening, created_by, created_at) VALUES (?, ?, ?, 'in', ?, ?, ?, NULL, 1, ?, ?)", entryId, id, itemId, paid, openingDate, openingNote, user.id, stamp);
        // Yazılan satırın kendisi denetlenir (gözden geçirme D10).
        bank.assertWrittenNonMoney("plan_entries", entryId);
        openingIds.push(entryId);
      }
    });
    audit(user, "plan.created", id, { name: input.name, total, accountId: input.accountId || "", importId, items: items.length, opening: roundMoney(items.reduce((sum, item) => sum + Math.min(Number(item.paid) || 0, Number(item.amount) || 0), 0)) });
    return { id, openingIds };
  }
  // Programda kayıt kartından girilmiş tahsilatı karta taşır (Kasa toplamı değişmez: kayıt tahsilatı olarak çıkar, taksit
  // tahsilatı olarak aynı tarih ve tutarla girer; giren kişi ve giriş zamanı korunur). v2.0.26 (A2): ödeme yolu da korunur
  // (önceden kolon yazılmıyor, havale/POS tahsilatı karta nakit olarak geçiyordu). Tanınmayan yol hata verir (B7).
  // v2.1.0 (bank.post op 'move'): taşınan tahsilat kayıt tahsilatının işlem başlığını (event_id) taşır — İşlem No ve yol aynı, olayın
  // kopyasında kaynak tablo plan_entries olur. Olaysız eski tahsilat taşınırken olay alır. Çağıran bank.post işleminin içindedir.
  function adoptPayment(user, planId, payment, itemId = null) {
    const entryId = newId("entry");
    const method = methodInput(payment.method);
    store.run(
      "INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, opening, method, event_id, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, 'in', ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?)",
      entryId, planId, itemId, roundMoney(payment.amount), payment.date, String(payment.note || "Kayıt kartından tahsilat").slice(0, 300), method,
      bank.eventFor("plan_entries", { kind: "in", date: payment.date, method, opening: 0, cheque_id: "", event_id: payment.event_id || "" }), payment.created_by || user.id, payment.created_at || now(), user.id, now(),
    );
    return entryId;
  }
  // Açık veri oturumunda kartı olan kayıtlar (silinmemiş kartlar): takvim bu kişilerin tablodaki ödeme kalemlerini
  // ikinci kez saymaz; aktarma "kartı var" der.
  const linkedCases = source => new Set(store.all("SELECT case_key AS k FROM plans WHERE deleted_at IS NULL AND case_key <> '' AND case_source = ?", source || "").map(row => row.k));

  return { uncoveredDebt, assertRestorable, assertCloseOpen, closeDayOf, trimCovers, shrinkPlan, leftOf, syncInvoiceCard, cashEntries, dueItems, openItems, fingerprint, ledgerPlansByAccount, list, detail, forCase, entriesForCase, summariesByAccount, forAccount, createForAccount, removeForInvoice, growForInvoice, followAccount, countForAccount, receiptSeq, nextRef, validDistribution: distributionInput, resolveGroups, groupTree, ensureGroup, createScheduled, scheduledStart, lockedStartReason, adoptPayment, linkedCases };
}
