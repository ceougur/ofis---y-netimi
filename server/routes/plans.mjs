// Taksitler (v2.0.4): Operasyon Merkezi'ndeki kalıcı modül. Grup › alt grup (servis plakası › güzergâh, site › blok…),
// taksit kartı (ad, bilgi notu, telefon, toplam, taksitler), kart üstünde tahsilat/ödeme girişi, gecikme uyarısı,
// makbuz ve ekstre PDF'i, Excel'den ilk yükleme. Hareketler Kasa'ya kendiliğinden düşer (routes/cash.mjs bu servisi okur).
// Hesap kuralı server/lib/plans.mjs içinde (saf, testli); burada yalnızca doğrulama, kayıt ve yetki vardır.
import { randomUUID } from "node:crypto";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { can } from "../lib/permissions.mjs";
import { allocate, dayText, distribute, isoDay, mapHeaders, parseDay } from "../lib/plans.mjs";
import { extractSchedules, spreadPaid } from "../lib/insight/schedules.mjs";
import { tabContext } from "../lib/insight/dues.mjs";
import { planStatementPdf, receiptPdf } from "../lib/plan-report.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
const MAX_ITEMS = 360;
const MAX_IMPORT = 100_000;

// accounts (v2.0.6): cari servisi daha sonra kurulur; her taksit kartı bir cariye aittir (plans.account_id).
export function registerPlanRoutes(router, { store, auth, audit, events, trash, dataset = null, accounts = () => null, cheques = () => null }) {
  const now = () => new Date().toISOString();
  const today = () => isoDay(new Date());
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
    const groups = rows.filter(row => !row.parentId).map(row => ({ id: row.id, name: row.name, count: counts.get(row.id) || 0, subgroups: [] }));
    const byId = new Map(groups.map(group => [group.id, group]));
    for (const row of rows.filter(row => row.parentId)) byId.get(row.parentId)?.subgroups.push({ id: row.id, name: row.name, count: counts.get(row.id) || 0 });
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
  const PLAN_SQL = `SELECT p.id, p.account_id AS accountId, p.ref_no AS refNo, p.registered_on AS registeredOn, p.case_key AS caseKey, p.case_source AS caseSource, p.case_title AS caseTitle, p.group_id AS groupId, p.subgroup_id AS subgroupId, p.name, p.note, p.phone, p.total, p.status,
      p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName,
      COALESCE(g.name, '') AS groupName, COALESCE(s.name, '') AS subgroupName, COALESCE(ac.name, '') AS accountName, COALESCE(ac.ref_no, '') AS accountRef
    FROM plans p LEFT JOIN users u ON u.id = p.created_by LEFT JOIN plan_groups g ON g.id = p.group_id LEFT JOIN plan_groups s ON s.id = p.subgroup_id
      LEFT JOIN accounts ac ON ac.id = p.account_id AND ac.deleted_at IS NULL`;
  const itemsOf = planId => store.all("SELECT id, seq, due_date AS dueDate, amount, note FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId);
  const entriesOf = planId =>
    store.all(
      `SELECT e.id, e.item_id AS itemId, e.kind, e.amount, e.date, e.note, e.receipt_no AS receiptNo, e.cheque_id AS chequeId, e.opening, e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
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
    const manage = can(user.role, "plans.manage");
    return {
      ...plan,
      ...ledger,
      // Çekle yapılan tahsilat (v2.0.7) çekin kartından yönetilir (tahsil/karşılıksız/geri al); burada düzeltilmez.
      // Açılış (devir) kaydını (v2.0.8) yalnız kart yöneten roller düzeltir.
      entries: entries.map(entry => ({ ...entry, opening: Boolean(entry.opening), editable: !entry.chequeId && (manage || (!entry.opening && entry.createdBy === user.id)) })),
      canManage: manage,
      canCollect: can(user.role, "plans.collect"),
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
  function list(user, { q = "", group = "", subgroup = "", status = "active", sort = "no", caseKey = "", caseSource = "", account = "" } = {}) {
    let plans = store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL ORDER BY p.name COLLATE NOCASE, p.created_at`);
    if (caseKey) plans = plans.filter(plan => plan.caseKey === caseKey && (!caseSource || plan.caseSource === caseSource));
    if (account) plans = plans.filter(plan => plan.accountId === account);
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
    return { plans: out, totals, sort, canManage: can(user.role, "plans.manage"), canCollect: can(user.role, "plans.collect"), today: day };
  }

  router.get("/api/workspace/plans", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "plans.view");
    ok(res, list(user, { ...listQuery(url.searchParams), caseSource: currentSource() }));
  });

  // Kaydın taksit kartları (v2.0.6): kişinin kartındaki "Taksit planı" bölümü ve Tahsilat penceresi buradan okur.
  router.get("/api/workspace/cases/:key/plans", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.view");
    const key = limited(params.key, 200, "Kayıt");
    ok(res, { plans: forCase(key, currentSource(), user), canManage: can(user.role, "plans.manage"), canCollect: can(user.role, "plans.collect") });
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
      title: `${title} listesi`,
      subtitle,
      // v2.0.6: kayıt tarihi ve bilgi notu da basılır (yatay sayfada notun yeri var; uzun not satır içinde sarılır).
      headers: ["No", "Ad Soyad", "Grup", "Telefon", "Kayıt", "Toplam", "Ödenen", "Kalan", "Sıradaki vade", "Durum", "Bilgi notu"],
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
      summary: [["Kart", String(data.totals.count)], ["Kalan alacak", tl(data.totals.remaining)], ["Geciken", `${tl(data.totals.overdue)} · ${data.totals.overdueCount} taksit`], ["Bu ay beklenen", tl(data.totals.month)], ["Tahsil edilen", tl(data.totals.paid)]],
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
    // Kayıt tarihi: kişinin kaydedildiği gün; boş bırakılırsa bugün (v2.0.6).
    const registeredOn = dateOf(body.registeredOn, "Kayıt tarihi", today());
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
    items.forEach((item, index) => {
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("item"), planId, index + 1, item.dueDate, item.amount, item.note || "", now(), now());
    });
  }
  const distributionInput = (body, total) => {
    const count = Math.trunc(Number(body.count));
    if (!Number.isInteger(count) || count < 1 || count > MAX_ITEMS) throw new HttpError(400, `Taksit sayısı 1 ile ${MAX_ITEMS} arasında olmalı.`);
    const firstDue = dateOf(body.firstDue, "İlk vade");
    const everyMonths = Math.trunc(Number(body.everyMonths) || 1);
    if (everyMonths < 1 || everyMonths > 12) throw new HttpError(400, "Taksit aralığı 1–12 ay olmalı.");
    if (!(total > 0)) throw new HttpError(400, "Taksitlere bölmek için toplam tutar gerekli.");
    return distribute({ total, count, firstDue, everyMonths });
  };

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
      store.run(
        "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
        id, accountId, input.refNo || nextRef(), input.registeredOn, input.caseKey, input.caseSource, input.caseTitle, input.groupId, input.subgroupId, input.name, input.note, input.phone, input.total, user.id, now(), now(),
      );
      // Kayıt bitince taksit sorulmaz; "count" verilmişse (kartı açarken "otomatik dağıt" seçildiyse) kurulur.
      if (text(body.mode) === "auto" || Number(body.count) > 0) replaceItems(id, distributionInput(body, input.total));
      audit(user, "plan.created", id, { name: input.name, total: input.total, groupId: input.groupId, subgroupId: input.subgroupId, accountId });
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
      // Cari boşaltılamaz: eski kartta (göç öncesinden kalma, cari yoksa) ilk düzenlemede cari açılır.
      const accountId = input.accountId || previous.accountId || accounts()?.createFromPlan(user, input) || "";
      store.run(
        "UPDATE plans SET account_id = ?, ref_no = ?, registered_on = ?, case_key = ?, case_source = ?, case_title = ?, group_id = ?, subgroup_id = ?, name = ?, note = ?, phone = ?, total = ?, status = ?, updated_by = ?, updated_at = ? WHERE id = ?",
        accountId, input.refNo, input.registeredOn, input.caseKey, input.caseSource, input.caseTitle, input.groupId, input.subgroupId, input.name, input.note, input.phone, input.total, status, user.id, now(), previous.id,
      );
      audit(user, "plan.updated", previous.id, { previous: { name: previous.name, total: previous.total, status: previous.status, accountId: previous.accountId }, ...input, accountId, status });
      return detail(previous.id, user);
    });
    changed(user, { planId: previous.id });
    changed(user, { kind: "accounts", accountId: result.accountId || "" });
    ok(res, result);
  });

  router.delete("/api/workspace/plans/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const linked = cheques()?.countForPlan ? cheques().countForPlan(plan.id) : 0;
    if (linked) throw new HttpError(409, `Bu karta sayılmış ${linked} çek/senet var. Önce Çek/Senet'ten evrakı silin ya da başka karta taşıyın.`);
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
      if (total !== plan.total) store.run("UPDATE plans SET total = ?, updated_by = ?, updated_at = ? WHERE id = ?", total, user.id, now(), plan.id);
      const items = distributionInput(body, total);
      replaceItems(plan.id, items);
      audit(user, "plan.distributed", plan.id, { total, count: items.length, firstDue: items[0].dueDate });
      return detail(plan.id, user);
    });
    changed(user, { planId: plan.id });
    ok(res, result);
  });

  // ---------- Taksitler (elle) ----------
  const itemInput = body => ({ dueDate: dateOf(body.dueDate, "Vade"), amount: amountOf(body.amount, "Taksit tutarı"), note: limited(body.note, 200, "Açıklama") });
  const itemOf = (planId, itemId) => {
    const item = store.get("SELECT id, seq, due_date AS dueDate, amount, note FROM plan_items WHERE plan_id = ? AND id = ?", planId, limited(itemId, 120, "Taksit"));
    if (!item) throw new HttpError(404, "Taksit bulunamadı.");
    return item;
  };
  router.post("/api/workspace/plans/:id/items", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const input = itemInput(await readJson(req));
    if (!(input.amount > 0)) throw new HttpError(400, "Taksit tutarı sıfırdan büyük olmalı.");
    const count = store.get("SELECT COUNT(*) AS n FROM plan_items WHERE plan_id = ?", plan.id).n;
    if (count >= MAX_ITEMS) throw new HttpError(400, `Bir kartta en fazla ${MAX_ITEMS} taksit olabilir.`);
    const id = newId("item");
    store.tx(() => {
      const seq = (store.get("SELECT COALESCE(MAX(seq), 0) AS s FROM plan_items WHERE plan_id = ?", plan.id)?.s || 0) + 1;
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, plan.id, seq, input.dueDate, input.amount, input.note, now(), now());
      audit(user, "plan.item.created", id, { planId: plan.id, ...input });
    });
    changed(user, { planId: plan.id });
    ok(res, detail(plan.id, user));
  });
  router.put("/api/workspace/plans/:id/items/:itemId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const plan = planRow(params.id);
    const previous = itemOf(plan.id, params.itemId);
    const input = itemInput({ ...previous, ...(await readJson(req)) });
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
    const date = dateOf(body.date, "Tarih", today());
    const note = limited(body.note, 300, "Açıklama");
    let itemId = text(body.itemId) || null;
    if (itemId && kind === "out") itemId = null;
    if (itemId && !store.get("SELECT 1 AS found FROM plan_items WHERE id = ? AND plan_id = ?", itemId, planId)) throw new HttpError(400, "Seçilen taksit bu kartta yok; kartı yenileyin.");
    return { kind, amount, date, note, itemId };
  };
  const entryOf = (planId, entryId) => {
    const entry = store.get("SELECT id, item_id AS itemId, kind, amount, date, note, receipt_no AS receiptNo, cheque_id AS chequeId, opening, created_by AS createdBy, created_at AS createdAt FROM plan_entries WHERE plan_id = ? AND id = ?", planId, limited(entryId, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Hareket bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };
  const requireEntryRight = (user, entry) => {
    if (entry.chequeId) throw new HttpError(409, "Bu tahsilat bir çek/senetten geldi; Çek/Senet'teki evraktan düzeltin (karşılıksız, geri al ya da sil).", { code: "cheque-linked", chequeId: entry.chequeId });
    if (entry.opening && !can(user.role, "plans.manage")) throw new HttpError(403, "Açılış (devir) kaydını yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
    if (entry.createdBy !== user.id && !can(user.role, "plans.manage")) throw new HttpError(403, "Başkasının girdiği hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
  };
  // Makbuz numarası: ofis genelinde artan sayaç (tahsilatlarda). Silinen makbuzun numarası yeniden verilmez.
  const nextReceipt = () => {
    const current = Number(store.setting("plans.receiptSeq", "0")) || 0;
    store.setSetting("plans.receiptSeq", String(current + 1));
    return current + 1;
  };

  router.post("/api/workspace/plans/:id/entries", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.collect");
    const plan = planRow(params.id);
    const body = await readJson(req);
    const input = store.tx(() => entryInput(body, plan.id));
    if (input.kind === "out" && !can(user.role, "plans.manage")) throw new HttpError(403, "Ödeme/iade girişi yönetici, uzman ve muhasebe yetkisidir.");
    const id = newId("entry");
    store.tx(() => {
      const receiptNo = input.kind === "in" ? nextReceipt() : null;
      store.run("INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, plan.id, input.itemId, input.kind, input.amount, input.date, input.note, receiptNo, user.id, now());
      audit(user, input.kind === "in" ? "plan.collected" : "plan.refunded", id, { planId: plan.id, planName: plan.name, ...input, receiptNo });
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
    const body = await readJson(req);
    const input = entryInput({ ...previous, ...body, kind: previous.kind }, plan.id);
    store.tx(() => {
      store.run("UPDATE plan_entries SET item_id = ?, amount = ?, date = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.itemId, input.amount, input.date, input.note, user.id, now(), previous.id);
      audit(user, "plan.entry.updated", previous.id, { planId: plan.id, previous, ...input });
    });
    changed(user, { planId: plan.id });
    changed(user, { kind: "cash" });
    touchedCase(user, plan);
    ok(res, detail(plan.id, user));
  });
  router.delete("/api/workspace/plans/:id/entries/:entryId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.collect");
    const plan = planRow(params.id);
    const previous = entryOf(plan.id, params.entryId);
    requireEntryRight(user, previous);
    store.tx(() => {
      store.run("DELETE FROM plan_entries WHERE id = ?", previous.id);
      trash?.add({ kind: "plan-entry", ref: previous.id, title: plan.name, detail: previous.note || (previous.opening ? "Açılış (devir)" : previous.kind === "in" ? "Taksit tahsilatı" : "Taksit ödemesi/iadesi"), payload: { ...previous, opening: previous.opening ? 1 : 0, planId: plan.id, planName: plan.name }, user });
      audit(user, "plan.entry.deleted", previous.id, { planId: plan.id, ...previous });
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
    const pdf = planStatementPdf(plan, { officeName: office(), userName: user.display_name || user.username || "" });
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
    const pdf = receiptPdf(plan, entry, { officeName: office(), userName: user.display_name || user.username || "" });
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
    const { tabs, records } = extractSchedules({ rows: objects, tabs: [SHEET_KEY], now: new Date(), dueDay, defaultFirstDue: firstDue });
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
    const now = new Date();
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
        // Gruplar yalnızca kart açılacak satırlar için tanımlanır (atlanan satır boş grup bırakmaz).
        const groupId = groupName ? ensureGroup(user, groupName) : null;
        const subgroupId = groupId && subgroupName ? ensureGroup(user, subgroupName, groupId) : null;
        const duplicate = store.get("SELECT id FROM plans WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND COALESCE(group_id, '') = ?", name, groupId || "");
        if (duplicate) return skip(index, "Aynı adla açık kart var");
        // Tablodaki kayıt: kesin tek eşleşme bağlanır; o kaydın kartı zaten varsa satır atlanır (çift kart yok).
        const record = records ? records.find(name, phone) : null;
        if (record?.carded) return skip(index, "Tablodaki kaydının taksit kartı zaten var");
        const refNo = cell(row, col.seq).slice(0, 30) || String((autoRef += 1));
        // Kayıt tarihi kolonu yoksa ya da okunamıyorsa yükleme günü.
        const registeredOn = parseDay(cell(row, col.registered)) || (scheduled?.registeredOn || "") || today();
        const person = { name, phone, note: cell(row, col.note).slice(0, 1000), registeredOn, groupId, subgroupId, caseKey: record?.key || "", caseSource: record ? source : "", caseTitle: record?.title || "" };
        // Cari (v2.0.6): aynı ad ve telefonla (ya da telefonsuz aynı ad ve grupla) tek bir cari varsa ona bağlanır; yoksa açılır.
        const outcome = {};
        const accountId = accounts()?.createFromPlan(user, person, outcome) || "";
        if (accountId && !outcome.created) report.linked += 1;
        if (outcome.created) undo.accounts.push(accountId);
        if (outcome.linked) undo.accountLinks.push({ accountId, caseKey: person.caseKey });
        const created = createScheduled(user, { ...person, accountId, refNo, total }, { importId, items, openingDate: today(), openingNote: "Excel'de ödenmiş (açılış)" });
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
  // Kasa: taksit hareketleri (silinmemiş kartların) tahsilat/ödeme olarak.
  // Kasa kaynağı: aynı tablo/koşul hem Kasa satırlarında hem Kasa toplamında (ANLIK DURUM) kullanılır.
  // Açılış (devir) kaydı (v2.0.8) Kasa'ya girmez: o para bu programın kasasından geçmedi.
  const cashSource = { table: "plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL", where: "e.cheque_id = '' AND e.opening = 0", kind: "e.kind", amount: "e.amount", date: "e.date" };
  const cashEntries = (after = "") =>
    store.all(
      `SELECT e.id, e.kind, 'plan' AS source, e.amount, e.date, e.note AS description, e.plan_id AS planId, p.name AS planName,
              e.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM ${cashSource.table} LEFT JOIN users u ON u.id = e.created_by
       WHERE ${cashSource.where}${after ? ` AND ${cashSource.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
  // Tahsilat takvimi ve bildirimler: vadesi geçen, bugün ve 7 gün içinde gelecek açık taksitler.
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
      for (const item of ledger.items) {
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
    const plans = store.all("SELECT id, name, total, status, account_id AS accountId FROM plans WHERE deleted_at IS NULL AND status = 'active'");
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
      for (const item of ledger.items) {
        if (item.remaining <= 0.005 || item.state === "closed") continue;
        out.push({ date: item.dueDate, direction: "in", amount: item.remaining, source: "plan", label: `${item.seq}. taksit${item.partial ? " (kalan)" : ""}`, party: plan.name, ref: { type: "plan", id: plan.id } });
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
  function summariesByAccount() {
    const plans = store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.account_id <> ''`);
    const out = new Map();
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
    const day = today();
    for (const plan of plans) {
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ id: plan.id, name: plan.name, total: plan.total, status: plan.status, state: ledger.state, totals: ledger.totals, next: ledger.next, itemCount: ledger.items.length });
    }
    return out;
  }
  // Mizan (v2.0.7): tüm carilerin kartları, hareketleriyle; carinin defteri (accountLedger) Cari kartıyla aynı girdiyi alır.
  function ledgerPlansByAccount() {
    const out = new Map();
    const plans = store.all("SELECT id, account_id AS accountId, name, total, status, registered_on AS registeredOn, created_at AS createdAt, updated_at AS updatedAt FROM plans WHERE deleted_at IS NULL AND account_id <> ''");
    if (!plans.length) return out;
    const seqs = new Map();
    const counts = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq FROM plan_items")) {
      seqs.set(item.id, item.seq);
      counts.set(item.planId, (counts.get(item.planId) || 0) + 1);
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date, note, receipt_no AS receiptNo, opening, created_at AS createdAt FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push({ ...entry, opening: Boolean(entry.opening), itemSeq: entry.itemId ? seqs.get(entry.itemId) || null : null });
    }
    for (const plan of plans) {
      const own = entries.get(plan.id) || [];
      const paid = roundMoney(own.reduce((sum, entry) => sum + (entry.kind === "in" ? Number(entry.amount) || 0 : -(Number(entry.amount) || 0)), 0));
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ ...plan, itemCount: counts.get(plan.id) || 0, totals: { paid }, entries: own });
    }
    return out;
  }
  function forAccount(accountId, user) {
    if (!accountId) return [];
    return store.all(`${PLAN_SQL} WHERE p.deleted_at IS NULL AND p.account_id = ? ORDER BY (p.status = 'active') DESC, p.created_at`, accountId).map(plan => {
      const shaped = shape(plan, user);
      const seqOf = new Map(shaped.items.map(item => [item.id, item.seq]));
      return { ...shaped, itemCount: shaped.items.length, entries: shaped.entries.map(entry => ({ ...entry, itemSeq: entry.itemId ? seqOf.get(entry.itemId) || null : null })) };
    });
  }
  // Carinin toplu taksitlendirmesi (routes/accounts.mjs): kartı cariye bağlı açar, isterse taksitleri dağıtır.
  // refNo verilirse (toplu taksitlendirme sayacı) kart tablosu her kartta yeniden taranmaz.
  function createForAccount(user, account, { total, count = 0, firstDue = "", everyMonths = 1, name = "", note = "", refNo = "" }) {
    const id = newId("plan");
    const amount = roundMoney(Number(total) || 0);
    store.run(
      "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      id, account.id, refNo || nextRef(), today(), account.caseKey || "", account.caseSource || "", account.caseTitle || "", account.groupId || null, account.subgroupId || null, (name || account.name).slice(0, 160), (note || "").slice(0, 1000), account.phone || "", amount, user.id, now(), now(),
    );
    if (count > 0 && amount > 0) replaceItems(id, distribute({ total: amount, count: Math.min(count, MAX_ITEMS), firstDue, everyMonths }));
    audit(user, "plan.created", id, { name: name || account.name, total: amount, accountId: account.id, bulk: true });
    return id;
  }
  // Cari adı/telefonu değişince, adı/telefonu eski cariyle aynı olan kartlar da güncellenir (farklı adlı kart dokunulmaz).
  function followAccount(accountId, previous, next) {
    if (previous.name !== next.name) store.run("UPDATE plans SET name = ?, updated_at = ? WHERE account_id = ? AND name = ?", next.name, now(), accountId, previous.name);
    if (previous.phone !== next.phone) store.run("UPDATE plans SET phone = ?, updated_at = ? WHERE account_id = ? AND phone = ?", next.phone, now(), accountId, previous.phone);
  }
  const countForAccount = accountId => store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND account_id = ?", accountId).n;
  const receiptSeq = () => nextReceipt();

  // ---------- Aktarma (v2.0.8): tablodan ya da Excel'den kart ----------
  // Kartı taksitleriyle açar; Excel'e göre ödenmiş kısım her taksit için bir açılış (devir) kaydıdır: taksiti kapatır,
  // carinin bakiyesine sayılır, Kasa'ya girmez, makbuzu yoktur. Çağıran tek işlem bloğu (store.tx) içinde çağırır.
  // items: [{ dueDate, amount, paid, label }] (vade sırasıyla). Dönüş: { id, openingIds }.
  function createScheduled(user, input, { importId = "", items = [], openingDate = today(), openingNote = "Excel'de ödenmiş" } = {}) {
    const id = newId("plan");
    const total = roundMoney(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    store.run(
      "INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, group_id, subgroup_id, name, note, phone, total, status, import_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
      id, input.accountId || "", input.refNo || nextRef(), input.registeredOn || today(), input.caseKey || "", input.caseKey ? input.caseSource || currentSource() : "", input.caseKey ? input.caseTitle || input.name : "", input.groupId || null, input.subgroupId || null, String(input.name).slice(0, 160), String(input.note || "").slice(0, 1000), String(input.phone || "").slice(0, 60), total, importId, user.id, now(), now(),
    );
    const openingIds = [];
    const stamp = now();
    items.slice(0, MAX_ITEMS).forEach((item, index) => {
      const itemId = newId("item");
      store.run("INSERT INTO plan_items (id, plan_id, seq, due_date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", itemId, id, index + 1, item.dueDate, roundMoney(item.amount), String(item.label || "").slice(0, 200), stamp, stamp);
      const paid = roundMoney(Math.min(Number(item.paid) || 0, Number(item.amount) || 0));
      if (paid > 0.004) {
        const entryId = newId("entry");
        store.run("INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, opening, created_by, created_at) VALUES (?, ?, ?, 'in', ?, ?, ?, NULL, 1, ?, ?)", entryId, id, itemId, paid, openingDate, openingNote, user.id, stamp);
        openingIds.push(entryId);
      }
    });
    audit(user, "plan.created", id, { name: input.name, total, accountId: input.accountId || "", importId, items: items.length, opening: roundMoney(items.reduce((sum, item) => sum + Math.min(Number(item.paid) || 0, Number(item.amount) || 0), 0)) });
    return { id, openingIds };
  }
  // Programda kayıt kartından girilmiş tahsilatı karta taşır (Kasa toplamı değişmez: kayıt tahsilatı olarak çıkar, taksit
  // tahsilatı olarak aynı tarih ve tutarla girer; giren kişi ve giriş zamanı korunur).
  function adoptPayment(user, planId, payment, itemId = null) {
    const entryId = newId("entry");
    store.run(
      "INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, opening, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, 'in', ?, ?, ?, NULL, 0, ?, ?, ?, ?)",
      entryId, planId, itemId, roundMoney(payment.amount), payment.date, String(payment.note || "Kayıt kartından tahsilat").slice(0, 300), payment.created_by || user.id, payment.created_at || now(), user.id, now(),
    );
    return entryId;
  }
  // Açık veri oturumunda kartı olan kayıtlar (silinmemiş kartlar): takvim bu kişilerin tablodaki ödeme kalemlerini
  // ikinci kez saymaz; aktarma "kartı var" der.
  const linkedCases = source => new Set(store.all("SELECT case_key AS k FROM plans WHERE deleted_at IS NULL AND case_key <> '' AND case_source = ?", source || "").map(row => row.k));

  return { cashEntries, cashSource, dueItems, openItems, fingerprint, ledgerPlansByAccount, list, detail, forCase, entriesForCase, summariesByAccount, forAccount, createForAccount, followAccount, countForAccount, receiptSeq, nextRef, validDistribution: distributionInput, resolveGroups, groupTree, ensureGroup, createScheduled, adoptPayment, linkedCases };
}
