// Cari (v2.0.6): Operasyon Merkezi'ndeki müşteri/tedarikçi kartları. Her sektöre uyar (öğrenci, veli, sakin, hasta,
// müşteri, firma); fatura ve KDV yoktur. Cari merkezdedir: taksit kartları bir cariye aittir (plans.account_id) ve
// carinin defterinde görünür. Hareketler: borç yaz, alacak yaz, tahsilat (Kasa'ya giriş), ödeme (Kasa'dan çıkış).
// Excel'den toplu alım: bilinen kolonlar (ad, telefon, adres, kayıt tarihi, grup…) alanlara, kalan her kolon kartta
// aynı adla "ek alan" olur; taksit sorulmaz. Toplu taksitlendirme: seçilen carilere tek seferde taksit kartı.
// Hesap kuralı server/lib/accounts.mjs içinde (saf, testli); burada doğrulama, kayıt ve yetki vardır.
import { randomUUID } from "node:crypto";
import { ACCOUNT_TYPES, accountLedger, balanceSide, mapAccountHeaders, parseAccountType } from "../lib/accounts.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { can } from "../lib/permissions.mjs";
import { receiptPdf } from "../lib/plan-report.mjs";
import { dayText, isoDay, parseDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { readSheetMatrices } from "../lib/sheets.mjs";
import { inferRolesByValues, findHeaderRow, sanitizeCell, validateRows } from "../lib/import-gate.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
// Tek seferde en çok bu kadar satır (100 bin cari ~ 7 sn); fazlası raporda "kesildi" olarak bildirilir.
const MAX_IMPORT = 250_000;
const MAX_FIELDS = 60;
const EPS = 0.005;
const KIND_TEXT = { debt: "Borç", credit: "Alacak", in: "Tahsilat", out: "Ödeme" };
// Türkçe sıralama: Intl.Collator, localeCompare'den kat kat hızlıdır (200 bin caride saniyeler yerine yüz ms).
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function registerAccountRoutes(router, { store, auth, audit, events, trash, config = {}, dataset = null, plans = () => null, cheques = () => null }) {
  const now = () => new Date().toISOString();
  const today = () => isoDay(new Date());
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const office = () => store.setting("office.name", "");
  const currentSource = () => (dataset?.currentKey ? dataset.currentKey() : "");
  const changed = (user, detail = {}) => events?.publish("workspace.changed", { kind: "accounts", actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const touched = (user, account) => {
    changed(user, { accountId: account.id });
    if (account.caseKey) changed(user, { kind: "activity", caseKey: account.caseKey, datasetKey: account.caseSource || "" });
  };
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
  const digits = value => String(value || "").replace(/\D/g, "");

  // ---------- Okuma ----------
  const ACCOUNT_SQL = `SELECT a.id, a.ref_no AS refNo, a.type, a.name, a.phone, a.email, a.address, a.registered_on AS registeredOn, a.group_id AS groupId, a.subgroup_id AS subgroupId,
      a.note, a.fields_json AS fieldsJson, a.case_key AS caseKey, a.case_source AS caseSource, a.case_title AS caseTitle, a.status,
      a.created_by AS createdBy, a.created_at AS createdAt, a.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName,
      COALESCE(g.name, '') AS groupName, COALESCE(s.name, '') AS subgroupName
    FROM accounts a LEFT JOIN users u ON u.id = a.created_by LEFT JOIN plan_groups g ON g.id = a.group_id LEFT JOIN plan_groups s ON s.id = a.subgroup_id`;
  const parseFields = json => {
    try {
      const value = JSON.parse(json || "[]");
      return Array.isArray(value) ? value.filter(item => item && typeof item.label === "string").map(item => ({ label: item.label, value: String(item.value ?? "") })) : [];
    } catch {
      return [];
    }
  };
  const withFields = row => {
    const { fieldsJson, ...rest } = row;
    return { ...rest, fields: parseFields(fieldsJson) };
  };
  const accountRow = id => {
    const row = store.get(`${ACCOUNT_SQL} WHERE a.id = ? AND a.deleted_at IS NULL`, limited(id, 120, "Cari"));
    if (!row) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");
    return withFields(row);
  };
  const exists = id => Boolean(id && store.get("SELECT 1 AS found FROM accounts WHERE id = ? AND deleted_at IS NULL", id));
  const entriesOf = accountId =>
    store.all(
      `SELECT e.id, e.kind, e.amount, e.date, e.note, e.receipt_no AS receiptNo, e.source, e.source_id AS sourceId, e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
              COALESCE(u.display_name, '') AS actorName
       FROM account_entries e LEFT JOIN users u ON u.id = e.created_by WHERE e.account_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      accountId,
    );

  function detail(id, user) {
    const account = accountRow(id);
    const manage = can(user.role, "accounts.manage");
    // Stok ve çek/senetten gelen satırlar (v2.0.6, v2.0.7) kendi kartlarından düzeltilir.
    const entries = entriesOf(account.id).map(entry => ({ ...entry, editable: entry.source === "" && (manage || (entry.createdBy === user.id && entry.kind === "in")) }));
    const planList = plans()?.forAccount ? plans().forAccount(account.id, user) : [];
    const ledger = accountLedger(entries, planList);
    return {
      ...account,
      typeLabel: ACCOUNT_TYPES[account.type] || "",
      entries,
      plans: planList.map(plan => ({ id: plan.id, name: plan.name, refNo: plan.refNo, status: plan.status, state: plan.state, totals: plan.totals, next: plan.next, itemCount: plan.itemCount, registeredOn: plan.registeredOn })),
      ledger: ledger.lines,
      totals: ledger.totals,
      side: balanceSide(ledger.totals.balance),
      canManage: manage,
      canCollect: can(user.role, "accounts.collect"),
    };
  }

  // Liste: hareket toplamları tek sorguda, taksit özetleri tek geçişte (5 bin caride de hızlı).
  const SORTS = new Set(["no", "name", "balance", "registered", "overdue"]);
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    group: text(params.get("group")),
    subgroup: text(params.get("subgroup")),
    type: ACCOUNT_TYPES[text(params.get("type"))] ? text(params.get("type")) : "",
    status: ["active", "passive", "all"].includes(text(params.get("status"))) ? text(params.get("status")) : "active",
    balance: ["debtor", "creditor", "zero", "overdue", "all"].includes(text(params.get("balance"))) ? text(params.get("balance")) : "all",
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "no",
  });
  const refCompare = (a, b) => {
    const x = String(a.refNo || "");
    const y = String(b.refNo || "");
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return collator.compare(x, y);
  };
  const withExtra = item => {
    const { fieldsJson, ...rest } = item;
    return { ...rest, extra: parseFields(fieldsJson).slice(0, 3) };
  };
  function list(user, { q = "", group = "", subgroup = "", type = "", status = "active", balance = "all", sort = "no" } = {}) {
    const rows = store.all(`${ACCOUNT_SQL} WHERE a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE`);
    const sums = new Map();
    for (const row of store.all("SELECT account_id AS accountId, kind, SUM(amount) AS amount FROM account_entries GROUP BY account_id, kind")) {
      if (!sums.has(row.accountId)) sums.set(row.accountId, { debt: 0, credit: 0, in: 0, out: 0 });
      sums.get(row.accountId)[row.kind] = Number(row.amount) || 0;
    }
    const planMap = plans()?.summariesByAccount ? plans().summariesByAccount() : new Map();
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const numbers = needle.replace(/\D/g, "");
    const totals = { count: 0, debtor: 0, creditor: 0, balance: 0, overdue: 0, overdueCount: 0, planRemaining: 0 };
    const labels = new Set();
    const out = [];
    for (const row of rows) {
      if (status !== "all" && row.status !== status) continue;
      if (type && row.type !== type) continue;
      if (group && row.groupId !== group) continue;
      if (subgroup && row.subgroupId !== subgroup) continue;
      if (needle) {
        // Ek alanlar ham JSON metninde aranır (200 bin caride her satırı ayrıştırmadan); ad, not, adres, grup ayrıca.
        const hay = `${row.name} ${row.note} ${row.address} ${row.email} ${row.groupName} ${row.subgroupName} ${row.caseTitle} ${row.fieldsJson}`.toLocaleLowerCase("tr-TR");
        const phoneHit = numbers.length >= 3 && digits(row.phone).includes(numbers);
        const refHit = String(row.refNo || "").toLocaleLowerCase("tr-TR") === needle;
        if (!hay.includes(needle) && !phoneHit && !refHit) continue;
      }
      // Ek alanlar sayfaya girerken ayrıştırılır (200 bin satırda hepsini ayrıştırmak boşuna); etiketler ham metinden.
      if (row.fieldsJson && row.fieldsJson !== "[]") for (const match of row.fieldsJson.matchAll(/"label":"((?:[^"\\]|\\.)*)"/g)) labels.add(JSON.parse(`"${match[1]}"`));
      const sum = sums.get(row.id) || { debt: 0, credit: 0, in: 0, out: 0 };
      const accountPlans = planMap.get(row.id) || [];
      let planDebit = 0;
      let planCredit = 0;
      let overdue = 0;
      let overdueCount = 0;
      let planRemaining = 0;
      let next = null;
      for (const plan of accountPlans) {
        const total = roundMoney(Number(plan.total) || 0);
        const paid = roundMoney(Number(plan.totals.paid) || 0);
        planDebit += total;
        planCredit += plan.status === "closed" ? Math.max(total, paid) : paid;
        if (plan.status !== "closed") {
          planRemaining += Math.max(0, total - paid);
          overdue += plan.totals.overdue || 0;
          overdueCount += plan.totals.overdueCount || 0;
          if (plan.next && (!next || plan.next.dueDate < next.dueDate)) next = { ...plan.next, planId: plan.id };
        }
      }
      const debit = roundMoney(sum.debt + sum.out + planDebit);
      const credit = roundMoney(sum.credit + sum.in + planCredit);
      const bal = roundMoney(debit - credit);
      const side = balanceSide(bal);
      if (balance === "debtor" && side !== "debtor") continue;
      if (balance === "creditor" && side !== "creditor") continue;
      if (balance === "zero" && side !== "zero") continue;
      if (balance === "overdue" && !overdueCount) continue;
      totals.count += 1;
      totals.balance = roundMoney(totals.balance + bal);
      if (side === "debtor") totals.debtor = roundMoney(totals.debtor + bal);
      if (side === "creditor") totals.creditor = roundMoney(totals.creditor - bal);
      totals.overdue = roundMoney(totals.overdue + overdue);
      totals.overdueCount += overdueCount;
      totals.planRemaining = roundMoney(totals.planRemaining + planRemaining);
      out.push({
        id: row.id,
        refNo: row.refNo || "",
        type: row.type,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        note: row.note,
        registeredOn: row.registeredOn || "",
        groupId: row.groupId,
        subgroupId: row.subgroupId,
        groupName: row.groupName,
        subgroupName: row.subgroupName,
        caseKey: row.caseKey || "",
        caseSource: row.caseSource || "",
        caseTitle: row.caseTitle || "",
        status: row.status,
        debit,
        credit,
        balance: bal,
        side,
        planCount: accountPlans.length,
        activePlans: accountPlans.filter(plan => plan.status !== "closed").length,
        planRemaining: roundMoney(planRemaining),
        overdue: roundMoney(overdue),
        overdueCount,
        next,
        fieldsJson: row.fieldsJson,
      });
    }
    const byName = (a, b) => collator.compare(a.name, b.name);
    const compare = {
      no: (a, b) => refCompare(a, b) || byName(a, b),
      name: byName,
      balance: (a, b) => b.balance - a.balance || byName(a, b),
      registered: (a, b) => String(b.registeredOn).localeCompare(String(a.registeredOn)) || refCompare(a, b),
      overdue: (a, b) => b.overdue - a.overdue || byName(a, b),
    }[sort];
    out.sort(compare);
    // Grup ağacı carilerin sayısıyla (taksit kartlarıyla aynı gruplar).
    const counts = new Map();
    for (const row of rows) {
      if (row.groupId) counts.set(row.groupId, (counts.get(row.groupId) || 0) + 1);
      if (row.subgroupId) counts.set(row.subgroupId, (counts.get(row.subgroupId) || 0) + 1);
    }
    const tree = (plans()?.groupTree ? plans().groupTree() : []).map(item => ({ ...item, count: counts.get(item.id) || 0, subgroups: item.subgroups.map(sub => ({ ...sub, count: counts.get(sub.id) || 0 })) }));
    return { accounts: out, totals, sort, groups: tree, fieldLabels: [...labels].slice(0, 200), canManage: can(user.role, "accounts.manage"), canCollect: can(user.role, "accounts.collect"), canPlan: can(user.role, "plans.manage"), today: today() };
  }

  // Liste sayfa sayfa gelir (200 bin caride tek yanıt 80 MB olurdu): limit/offset; toplamlar ve sayı tüm süzgeç için.
  const pageOf = (data, key, params) => {
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(params.get("limit")) || 300)));
    const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
    return { ...data, [key]: data[key].slice(offset, offset + limit).map(withExtra), total: data[key].length, offset, limit, hasMore: offset + limit < data[key].length };
  };
  router.get("/api/workspace/accounts", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    ok(res, pageOf(list(user, listQuery(url.searchParams)), "accounts", url.searchParams));
  });
  // Seçici (taksit kartı formu, stok hareketi): hafif arama, en çok 20 sonuç.
  router.get("/api/workspace/accounts/search", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const data = list(user, { q: text(url.searchParams.get("q")).slice(0, 120), status: "all", type: ACCOUNT_TYPES[text(url.searchParams.get("type"))] ? text(url.searchParams.get("type")) : "" });
    ok(res, data.accounts.slice(0, 20).map(withExtra).map(item => ({ id: item.id, refNo: item.refNo, name: item.name, phone: item.phone, type: item.type, groupName: item.groupName, subgroupName: item.subgroupName, balance: item.balance, status: item.status, caseKey: item.caseKey || "", caseSource: item.caseSource || "", caseTitle: item.caseTitle || "" })));
  });

  // ---------- Yazma ----------
  function fieldsInput(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value.slice(0, MAX_FIELDS)) {
      const label = String(item?.label ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      const fieldValue = String(item?.value ?? "").trim().slice(0, 1000);
      if (!label || seen.has(label.toLocaleLowerCase("tr-TR"))) continue;
      seen.add(label.toLocaleLowerCase("tr-TR"));
      out.push({ label, value: fieldValue });
    }
    return out;
  }
  const accountInput = (body, user, previous = null) => {
    const name = limited(body.name, 160, "Ad / Unvan");
    if (!name) throw new HttpError(400, "Carinin adını ya da unvanını yazın.");
    const type = ACCOUNT_TYPES[text(body.type)] ? text(body.type) : previous?.type || "customer";
    const caseKey = limited(body.caseKey, 200, "Kayıt");
    const caseSource = caseKey ? limited(body.caseSource, 200, "Veri oturumu") || currentSource() : "";
    const caseTitle = caseKey ? limited(body.caseTitle, 200, "Kayıt adı") : "";
    // Tablodaki kayda yeni ya da değişen bağ, açık veri oturumunda var olan kayda gitmeli (taksit kartıyla aynı kural).
    const linkChanged = caseKey !== String(previous?.caseKey || "") || caseSource !== String(previous?.caseSource || "");
    if (caseKey && linkChanged && caseSource === currentSource() && dataset?.hasRecord && !dataset.hasRecord(caseKey)) throw new HttpError(400, "Bağlanacak kayıt açık veri oturumunda bulunamadı. Tablodan seçerek bağlayın.");
    // Bir kayda tek cari bağlanır (v2.0.7): aynı kişi iki carinin defterine bölünmesin.
    if (caseKey && linkChanged) {
      const taken = store.get("SELECT name FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? AND id <> ?", caseKey, caseSource, previous?.id || "");
      if (taken) throw new HttpError(409, `Bu kayda zaten "${taken.name}" carisi bağlı. Aynı kişiyse o cariyi kullanın.`);
    }
    const groups = plans()?.resolveGroups ? plans().resolveGroups(body, user) : { groupId: null, subgroupId: null };
    return {
      name,
      type,
      refNo: limited(body.refNo, 30, "Cari No"),
      phone: limited(body.phone, 60, "Telefon"),
      email: limited(body.email, 160, "E-posta"),
      address: limited(body.address, 500, "Adres"),
      note: limited(body.note, 2000, "Bilgi notu"),
      registeredOn: dateOf(body.registeredOn, "Kayıt tarihi", previous?.registeredOn || today()),
      fields: fieldsInput(body.fields ?? previous?.fields),
      status: body.status === "passive" ? "passive" : body.status === "active" ? "active" : previous?.status || "active",
      caseKey,
      caseSource,
      caseTitle,
      ...groups,
    };
  };
  const nextRef = () => {
    let max = 0;
    for (const row of store.all("SELECT ref_no AS refNo FROM accounts WHERE deleted_at IS NULL")) {
      const value = Number(String(row.refNo || "").replace(",", "."));
      if (Number.isFinite(value) && value > max) max = Math.floor(value);
    }
    return String(max + 1);
  };
  // Numara başka bir caride kullanılıyorsa sıradaki numara verilir (iki carinin aynı numarası olmaz).
  const freeRef = refNo => (refNo && !store.get("SELECT 1 AS found FROM accounts WHERE deleted_at IS NULL AND ref_no = ?", refNo) ? refNo : "");
  function insertAccount(user, input) {
    const id = newId("account");
    store.run(
      "INSERT INTO accounts (id, ref_no, type, name, phone, email, address, registered_on, group_id, subgroup_id, note, fields_json, case_key, case_source, case_title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, freeRef(input.refNo) || nextRef(), input.type || "customer", input.name, input.phone || "", input.email || "", input.address || "", input.registeredOn || today(), input.groupId || null, input.subgroupId || null, input.note || "", JSON.stringify(input.fields || []),
      input.caseKey || "", input.caseKey ? input.caseSource || currentSource() : "", input.caseKey ? input.caseTitle || "" : "", input.status || "active", user.id, now(), now(),
    );
    return id;
  }

  router.post("/api/workspace/accounts", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req);
    const result = store.tx(() => {
      const input = accountInput(body, user);
      if (input.refNo && !freeRef(input.refNo)) throw new HttpError(409, `${input.refNo} numarası başka bir caride kullanılıyor.`);
      const id = insertAccount(user, input);
      // Açılış bakiyesi: ör. önceki programdan devreden borç (+) ya da alacak (−).
      const opening = parseAmount(body.openingBalance);
      if (Number.isFinite(opening) && Math.abs(opening) > EPS) addEntry(user, id, { kind: opening > 0 ? "debt" : "credit", amount: roundMoney(Math.abs(opening)), date: input.registeredOn, note: "Açılış bakiyesi" });
      audit(user, "account.created", id, { name: input.name, type: input.type });
      return detail(id, user);
    });
    touched(user, result);
    ok(res, result);
  });
  router.put("/api/workspace/accounts/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const previous = accountRow(params.id);
    const body = await readJson(req);
    const result = store.tx(() => {
      const wantedRef = limited(body.refNo, 30, "Cari No");
      if (wantedRef && wantedRef !== previous.refNo && store.get("SELECT 1 AS found FROM accounts WHERE deleted_at IS NULL AND ref_no = ? AND id <> ?", wantedRef, previous.id)) throw new HttpError(409, `${wantedRef} numarası başka bir caride kullanılıyor.`);
      // Görünen grup adları birleştirilmez: grup boşaltılınca eski adla yeniden açılmasın.
      const input = accountInput({ ...previous, groupName: "", subgroupName: "", ...body }, user, previous);
      store.run(
        "UPDATE accounts SET ref_no = ?, type = ?, name = ?, phone = ?, email = ?, address = ?, registered_on = ?, group_id = ?, subgroup_id = ?, note = ?, fields_json = ?, case_key = ?, case_source = ?, case_title = ?, status = ?, updated_by = ?, updated_at = ? WHERE id = ?",
        input.refNo || previous.refNo || nextRef(), input.type, input.name, input.phone, input.email, input.address, input.registeredOn, input.groupId, input.subgroupId, input.note, JSON.stringify(input.fields), input.caseKey, input.caseSource, input.caseTitle, input.status, user.id, now(), previous.id,
      );
      plans()?.followAccount?.(previous.id, { name: previous.name, phone: previous.phone }, { name: input.name, phone: input.phone });
      audit(user, "account.updated", previous.id, { previous: { name: previous.name, phone: previous.phone, status: previous.status }, name: input.name, phone: input.phone, status: input.status });
      return detail(previous.id, user);
    });
    touched(user, result);
    changed(user, { kind: "plans" });
    ok(res, result);
  });
  router.delete("/api/workspace/accounts/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const account = accountRow(params.id);
    const planCount = plans()?.countForAccount ? plans().countForAccount(account.id) : 0;
    if (planCount) throw new HttpError(409, `Bu carinin ${planCount} taksit kartı var. Önce kartları silin ya da başka cariye taşıyın; kapatılan kartlar da sayılır.`);
    const stockLinked = store.get(
      "SELECT COUNT(*) AS n FROM account_entries e JOIN stock_moves m ON m.id = e.source_id JOIN stock_items i ON i.id = m.item_id WHERE e.account_id = ? AND e.source = 'stock' AND i.deleted_at IS NULL",
      account.id,
    ).n;
    if (stockLinked) throw new HttpError(409, `Bu cariye yazılmış ${stockLinked} stok hareketi var. Önce stok hareketlerini düzeltin.`);
    const chequeLinked = cheques()?.countForAccount ? cheques().countForAccount(account.id) : 0;
    if (chequeLinked) throw new HttpError(409, `Bu cariye bağlı ${chequeLinked} çek/senet var. Önce Çek/Senet'ten evrakı silin ya da başka cariye taşıyın.`);
    store.tx(() => {
      // Yumuşak silme: hareketleri yerinde durur (Kasa'dan düşer); yönetim panelindeki Silinenler'den geri gelir.
      store.run("UPDATE accounts SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), account.id);
      audit(user, "account.deleted", account.id, { name: account.name });
    });
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, { id: account.id });
  });

  // ---------- Hareketler ----------
  const receiptNumber = () => {
    if (plans()?.receiptSeq) return plans().receiptSeq();
    const current = Number(store.setting("plans.receiptSeq", "0")) || 0;
    store.setSetting("plans.receiptSeq", String(current + 1));
    return current + 1;
  };
  function addEntry(user, accountId, { kind, amount, date, note, source = "", sourceId = "" }) {
    const id = newId("aentry");
    const receiptNo = kind === "in" && source !== "stock" ? receiptNumber() : null;
    store.run(
      "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, accountId, kind, amount, date, note || "", receiptNo, source, sourceId, user.id, now(),
    );
    return { id, receiptNo };
  }
  const entryInput = body => {
    const kind = text(body.kind);
    if (!KIND_TEXT[kind]) throw new HttpError(400, "Hareket türü borç, alacak, tahsilat ya da ödeme olmalı.");
    const amount = amountOf(body.amount);
    if (!(amount > 0)) throw new HttpError(400, "Tutar sıfırdan büyük olmalı.");
    return { kind, amount, date: dateOf(body.date, "Tarih", today()), note: limited(body.note, 300, "Açıklama") };
  };
  const entryOf = (accountId, entryId) => {
    const entry = store.get("SELECT id, kind, amount, date, note, receipt_no AS receiptNo, source, source_id AS sourceId, created_by AS createdBy, created_at AS createdAt FROM account_entries WHERE account_id = ? AND id = ?", accountId, limited(entryId, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Hareket bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };
  const requireKindRight = (user, kind) => {
    if (kind === "in" && !can(user.role, "accounts.collect")) throw new HttpError(403, "Tahsilat girme yetkiniz yok.");
    if (kind !== "in" && !can(user.role, "accounts.manage")) throw new HttpError(403, "Borç, alacak ve ödeme girişi yönetici, uzman ve muhasebe yetkisidir; tahsilatı herkes girer.");
  };
  const requireEntryRight = (user, entry) => {
    if (entry.source === "stock") throw new HttpError(409, "Bu hareket bir stok hareketinden geldi; Stok'taki hareketten düzeltin ya da silin.");
    if (entry.source === "cheque") throw new HttpError(409, "Bu hareket bir çek/senetten geldi; Çek/Senet'teki evraktan düzeltin (geri al ya da sil).", { code: "cheque-linked", chequeId: entry.sourceId });
    if (entry.createdBy !== user.id && !can(user.role, "accounts.manage")) throw new HttpError(403, "Başkasının girdiği hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
    requireKindRight(user, entry.kind);
  };

  router.post("/api/workspace/accounts/:id/entries", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const input = entryInput(await readJson(req));
    requireKindRight(user, input.kind);
    const created = store.tx(() => {
      const entry = addEntry(user, account.id, input);
      audit(user, `account.entry.${input.kind}`, entry.id, { accountId: account.id, accountName: account.name, ...input, receiptNo: entry.receiptNo });
      return entry;
    });
    touched(user, account);
    if (input.kind === "in" || input.kind === "out") changed(user, { kind: "cash" });
    ok(res, { ...detail(account.id, user), entryId: created.id });
  });
  router.put("/api/workspace/accounts/:id/entries/:entryId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const previous = entryOf(account.id, params.entryId);
    requireEntryRight(user, previous);
    const input = entryInput({ ...previous, ...(await readJson(req)), kind: previous.kind });
    store.tx(() => {
      store.run("UPDATE account_entries SET amount = ?, date = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.amount, input.date, input.note, user.id, now(), previous.id);
      audit(user, "account.entry.updated", previous.id, { accountId: account.id, previous, ...input });
    });
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, detail(account.id, user));
  });
  router.delete("/api/workspace/accounts/:id/entries/:entryId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const previous = entryOf(account.id, params.entryId);
    requireEntryRight(user, previous);
    store.tx(() => {
      store.run("DELETE FROM account_entries WHERE id = ?", previous.id);
      trash?.add({ kind: "account-entry", ref: previous.id, title: account.name, detail: previous.note || KIND_TEXT[previous.kind], payload: { ...previous, accountId: account.id, accountName: account.name }, user });
      audit(user, "account.entry.deleted", previous.id, { accountId: account.id, ...previous });
    });
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, detail(account.id, user));
  });

  // ---------- PDF ve Excel ----------
  const sideText = balance => (balance > EPS ? "borçlu" : balance < -EPS ? "alacaklı" : "");
  router.get("/api/workspace/accounts/:id/ekstre.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = detail(params.id, user);
    const t = account.totals;
    const pdf = tablePdf({
      title: `Cari ekstre · ${account.name}`,
      subtitle: [account.refNo ? `Cari No ${account.refNo}` : "", ACCOUNT_TYPES[account.type], [account.groupName, account.subgroupName].filter(Boolean).join(" › "), account.phone, account.address].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
      types: ["text", "text", "text", "money", "money", "money"],
      rows: account.ledger.map(line => [dayText(line.date), `${line.label}${line.receiptNo ? ` · Makbuz ${line.receiptNo}` : ""}`, line.note || "", line.debit ? tl(line.debit) : "", line.credit ? tl(line.credit) : "", `${tl(Math.abs(line.balance))} ${sideText(line.balance)}`.trim()]),
      summary: [["Borç toplamı", tl(t.debit)], ["Alacak toplamı", tl(t.credit)], ["Bakiye", `${tl(Math.abs(t.balance))} ${sideText(t.balance)}`.trim()], ...(t.planRemaining ? [["Taksitlerden kalan", tl(t.planRemaining)]] : []), ...(t.overdueCount ? [["Geciken", `${tl(t.overdue)} · ${t.overdueCount} taksit`]] : [])],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    audit(user, "account.statement.exported", account.id, { name: account.name });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Cari-ekstre ${account.name}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/accounts/:id/entries/:entryId/makbuz.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = detail(params.id, user);
    const entry = account.entries.find(item => item.id === params.entryId);
    if (!entry || !["in", "out"].includes(entry.kind)) throw new HttpError(404, "Makbuz yalnız tahsilat ve ödemeler için alınır.");
    const pdf = receiptPdf(
      { name: account.name, refNo: account.refNo, refLabel: "Cari No", phone: account.phone, groupName: account.groupName, subgroupName: account.subgroupName, items: [], balanceOnly: true, totals: { total: account.totals.debit, paid: account.totals.collected, remaining: account.totals.balance } },
      { ...entry, label: entry.kind === "in" ? "Cari tahsilat" : "Cariye ödeme" },
      { officeName: office(), userName: user.display_name || user.username || "" },
    );
    sendBuffer(res, pdf, { type: "application/pdf", name: `Makbuz ${entry.receiptNo ? `No ${entry.receiptNo} ` : ""}${account.name} ${dayText(entry.date)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  const STATUS_TEXT = { active: "Aktif", passive: "Pasif", all: "Tümü" };
  // PDF'te en çok bu kadar satır basılır (kâğıt için anlamlı sınır; 200 bin satır 22 MB olurdu). Tamamı Excel'de.
  const PDF_ROWS = 20_000;
  router.get("/api/workspace/accounts/liste.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const clipped = data.accounts.length > PDF_ROWS;
    if (clipped) data.accounts = data.accounts.slice(0, PDF_ROWS);
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Cari";
    const pdf = tablePdf({
      title: `${title} listesi`,
      subtitle: [STATUS_TEXT[query.status], query.type ? ACCOUNT_TYPES[query.type] : "", query.q ? `“${query.q}”` : "", clipped ? `ilk ${PDF_ROWS.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
      headers: ["No", "Ad / Unvan", "Tür", "Grup", "Telefon", "Kayıt", "Borç", "Alacak", "Bakiye", "Taksitten kalan", "Bilgi notu"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "money", "money", "text"],
      rows: data.accounts.map(item => [item.refNo, item.name, ACCOUNT_TYPES[item.type] || "", [item.groupName, item.subgroupName].filter(Boolean).join(" › "), item.phone, dayText(item.registeredOn), tl(item.debit), tl(item.credit), `${tl(Math.abs(item.balance))} ${sideText(item.balance)}`.trim(), item.planRemaining ? tl(item.planRemaining) : "", item.note || ""]),
      summary: [["Cari", String(data.totals.count)], ["Bize borçlu", tl(data.totals.debtor)], ["Bizim borcumuz", tl(data.totals.creditor)], ["Geciken taksit", `${tl(data.totals.overdue)} · ${data.totals.overdueCount}`]],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    audit(user, "account.list.exported", "list", { ...query, count: data.totals.count });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${title}-listesi ${dayText(today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  // Tüm cariler Excel'e: bilinen alanlar, bakiye ve kartın ek alanlarının hepsi (her ek alan bir kolon).
  router.get("/api/workspace/accounts/export.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const fieldsById = new Map(store.all("SELECT id, fields_json AS fieldsJson FROM accounts WHERE deleted_at IS NULL").map(row => [row.id, parseFields(row.fieldsJson)]));
    const base = ["Cari No", "Ad / Unvan", "Tür", "Grup", "Alt grup", "Telefon", "E-posta", "Adres", "Kayıt tarihi", "Durum", "Borç", "Alacak", "Bakiye", "Taksitten kalan", "Geciken", "Bilgi notu"];
    const extras = [...new Set(data.accounts.flatMap(item => (fieldsById.get(item.id) || []).map(field => field.label)))].filter(label => !base.includes(label));
    const money = value => MONEY_FORMAT.format(value || 0);
    const rows = data.accounts.map(item => {
      const row = {
        "Cari No": item.refNo,
        "Ad / Unvan": item.name,
        Tür: ACCOUNT_TYPES[item.type] || "",
        Grup: item.groupName,
        "Alt grup": item.subgroupName,
        Telefon: item.phone,
        "E-posta": item.email,
        Adres: item.address,
        "Kayıt tarihi": dayText(item.registeredOn),
        Durum: item.status === "passive" ? "Pasif" : "Aktif",
        Borç: money(item.debit),
        Alacak: money(item.credit),
        Bakiye: money(item.balance),
        "Taksitten kalan": money(item.planRemaining),
        Geciken: money(item.overdue),
        "Bilgi notu": item.note,
      };
      for (const field of fieldsById.get(item.id) || []) if (!base.includes(field.label)) row[field.label] = field.value;
      return row;
    });
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Cari";
    const buffer = buildXlsx([{ name: title.slice(0, 31), columns: [...base, ...extras], rows }], { title: `${title} listesi` });
    audit(user, "account.list.exported", "xlsx", { ...query, count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${title}-listesi ${dayText(today())}.xlsx` });
  });

  // Tek cari (statik adreslerden sonra kayıtlı: "liste.pdf", "export.xlsx" kimlik sanılmasın).
  router.get("/api/workspace/accounts/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    ok(res, detail(params.id, user));
  });

  // ---------- Google Sheets'ten toplu alım (Cari, Stok, Taksitler ortak) ----------
  // Sunucu Sheet'in sekmelerini hücre matrisi olarak okur; tarayıcı Excel'deki gibi sayfayı seçip kolonları eşler.
  router.post("/api/workspace/import/google-sheet", async ({ req, res }) => {
    const user = auth.requireUser(req);
    if (!["accounts.manage", "stock.manage", "plans.manage"].some(permission => can(user.role, permission))) throw new HttpError(403, "Toplu yükleme yönetici, uzman ve muhasebe yetkisidir.");
    const body = await readJson(req);
    const url = limited(body.url, 2000, "Bağlantı");
    if (!url) throw new HttpError(400, "Google Sheets bağlantısını yapıştırın.");
    try {
      const result = await readSheetMatrices(url, { fetchImpl: config.fetchImpl || fetch });
      audit(user, "import.sheet.read", "google-sheet", { tabs: result.sheets.length, rows: result.sheets.reduce((sum, sheet) => sum + sheet.matrix.length, 0) });
      ok(res, result);
    } catch (error) {
      throw new HttpError(400, error.message || "Google Sheets okunamadı.");
    }
  });

  // ---------- Excel'den (ya da açık tablodan) toplu alım ----------
  // Tarayıcı dosyayı okur (hof-excel-worker.js) ya da açık tablonun satırlarını gönderir; başlıklar rollerle eşlenir.
  // Taksit sorulmaz. Aynı cari (tablodaki kayıt, Cari No ya da ad + telefon) varsa "atla" ya da "güncelle".
  router.post("/api/workspace/accounts/import/preview", async ({ req, res }) => {
    auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = findHeaderRow(matrix, { mapper: mapAccountHeaders });
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(sanitizeCell);
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    // Eşleme: başlıktan, başlık tanınmadıysa değerlerden; kullanıcı eşlemeyi gönderirse (roles) yalnız kapı yeniden hesaplanır.
    const roles = body.roles && typeof body.roles === "object" ? body.roles : inferRolesByValues(headers, rows, mapAccountHeaders(headers), "account");
    ok(res, { headerAt, headers, roles, rows: matrix.length - headerAt - 1, gate: validateRows(headers, rows, roles, "account", { headerAt }) });
  });
  function matchExisting({ caseKey, caseSource, refNo, name, phone }) {
    if (caseKey) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ?", caseKey, caseSource);
      if (found) return found.id;
    }
    // Cari No tek başına kimlik sayılmaz (Excel'deki "S.N" satır numarasıdır, başka carinin numarasıyla çakışabilir):
    // aynı numara ancak ad da aynıysa aynı cari.
    if (refNo) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND ref_no = ? AND name = ? COLLATE NOCASE", refNo, name);
      if (found) return found.id;
    }
    const phoneDigits = digits(phone);
    if (phoneDigits.length >= 7) {
      const found = store.all("SELECT id, phone FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE", name).filter(row => digits(row.phone) === phoneDigits);
      if (found.length === 1) return found[0].id;
    }
    return "";
  }
  router.post("/api/workspace/accounts/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = Math.max(0, Math.trunc(Number(body.headerAt) || 0));
    const headers = (matrix[headerAt] || []).map(cell => String(cell ?? "").replace(/\s+/g, " ").trim());
    const roles = body.roles && typeof body.roles === "object" ? body.roles : {};
    const columnOf = role => {
      const found = Object.entries(roles).find(([, value]) => value === role);
      return found ? Number(found[0]) : -1;
    };
    const col = Object.fromEntries(["seq", "name", "phone", "email", "address", "registered", "group", "subgroup", "balance", "type", "note"].map(role => [role, columnOf(role)]));
    const extraColumns = Object.entries(roles).filter(([, value]) => value === "extra").map(([index]) => Number(index)).filter(index => headers[index]);
    if (col.name < 0) throw new HttpError(400, "Ad Soyad / Unvan kolonunu seçin.");
    const mode = body.mode === "update" ? "update" : "skip";
    const defaultType = ACCOUNT_TYPES[text(body.type)] ? text(body.type) : "customer";
    const defaults = { groupName: limited(body.groupName, 80, "Grup adı") };
    // Açık tablodan alımda her satırın kayıt kimliği gelir: kart o kayda bağlanır (kişinin kartında carisi görünür).
    const caseKeys = Array.isArray(body.caseKeys) ? body.caseKeys : [];
    const caseTitles = Array.isArray(body.caseTitles) ? body.caseTitles : [];
    const source = currentSource();
    const cell = (row, index) => (index >= 0 ? sanitizeCell(row[index]) : "");
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, updated: 0, skipped: [], groups: 0, balances: 0, linked: 0, renumbered: 0, truncated: Math.max(0, matrix.length - headerAt - 1 - MAX_IMPORT) };
    let skippedTotal = 0;
    // Atlanan satırların hepsi listelenmez (100 bin satırda yanıt şişmesin); sayı ve nedenler tam gelir.
    const skip = (index, reason) => {
      skippedTotal += 1;
      if (report.skipped.length < 500) report.skipped.push({ row: headerAt + index + 2, reason });
      report.skippedTotal = skippedTotal;
    };
    const ensure = (name, parentId = null) => (name && plans()?.resolveGroups ? plans().resolveGroups(parentId ? { groupId: parentId, subgroupName: name } : { groupName: name }, user)[parentId ? "subgroupId" : "groupId"] : null);
    const before = store.get("SELECT COUNT(*) AS n FROM plan_groups").n;
    store.tx(() => {
      let autoRef = Number(nextRef()) - 1;
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => sanitizeCell(value))) return;
        const name = cell(row, col.name).slice(0, 160);
        if (!name) return skip(index, "Ad boş");
        let caseKey = String(caseKeys[index] ?? "").slice(0, 200);
        if (caseKey && dataset?.hasRecord && !dataset.hasRecord(caseKey)) caseKey = "";
        const fields = [];
        for (const column of extraColumns) {
          const value = cell(row, column);
          if (value) fields.push({ label: headers[column].slice(0, 80), value: value.slice(0, 1000) });
        }
        const person = {
          name,
          refNo: cell(row, col.seq).slice(0, 30),
          type: parseAccountType(cell(row, col.type)) || defaultType,
          phone: cell(row, col.phone).slice(0, 60),
          email: cell(row, col.email).slice(0, 160),
          address: cell(row, col.address).slice(0, 500),
          note: cell(row, col.note).slice(0, 2000),
          registeredOn: parseDay(cell(row, col.registered)) || today(),
          groupName: (cell(row, col.group) || defaults.groupName).slice(0, 80),
          subgroupName: cell(row, col.subgroup).slice(0, 80),
          fields: fieldsInput(fields),
          caseKey,
          caseSource: caseKey ? source : "",
          caseTitle: caseKey ? String(caseTitles[index] ?? name).slice(0, 200) : "",
        };
        const matched = matchExisting(person);
        if (matched && mode === "skip") return skip(index, "Bu cari zaten var");
        const groupId = person.groupName ? ensure(person.groupName) : null;
        const subgroupId = groupId && person.subgroupName ? ensure(person.subgroupName, groupId) : null;
        if (matched) {
          // Güncelle: dolu gelen alanlar yazılır, boş gelenler eskisi kalır; ek alanlar birleşir. Bakiye tekrar yazılmaz.
          const previous = accountRow(matched);
          const merged = [...previous.fields];
          for (const field of person.fields) {
            const at = merged.findIndex(item => item.label.toLocaleLowerCase("tr-TR") === field.label.toLocaleLowerCase("tr-TR"));
            if (at >= 0) merged[at] = field;
            else merged.push(field);
          }
          store.run(
            "UPDATE accounts SET name = ?, phone = ?, email = ?, address = ?, note = ?, registered_on = ?, group_id = ?, subgroup_id = ?, fields_json = ?, case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ?",
            person.name, person.phone || previous.phone, person.email || previous.email, person.address || previous.address, person.note || previous.note, cell(row, col.registered) ? person.registeredOn : previous.registeredOn,
            groupId || previous.groupId, subgroupId || previous.subgroupId, JSON.stringify(fieldsInput(merged)), person.caseKey || previous.caseKey, person.caseKey ? person.caseSource : previous.caseSource, person.caseKey ? person.caseTitle : previous.caseTitle, user.id, now(), matched,
          );
          plans()?.followAccount?.(matched, { name: previous.name, phone: previous.phone }, { name: person.name, phone: person.phone || previous.phone });
          report.updated += 1;
          return;
        }
        // Numara: Excel'deki boş değilse ve başka caride yoksa o; değilse sıradaki boş numara (tablo taranmadan).
        let wanted = person.refNo && freeRef(person.refNo) ? person.refNo : "";
        if (!wanted) {
          if (person.refNo) report.renumbered += 1;
          do wanted = String((autoRef += 1));
          while (!freeRef(wanted));
        }
        const id = insertAccount(user, { ...person, refNo: wanted, groupId, subgroupId });
        if (person.caseKey) report.linked += 1;
        const opening = parseAmount(cell(row, col.balance));
        if (Number.isFinite(opening) && Math.abs(opening) > EPS) {
          addEntry(user, id, { kind: opening > 0 ? "debt" : "credit", amount: roundMoney(Math.abs(opening)), date: person.registeredOn, note: "Açılış bakiyesi" });
          report.balances += 1;
        }
        report.created += 1;
      });
      report.groups = store.get("SELECT COUNT(*) AS n FROM plan_groups").n - before;
      audit(user, "account.imported", "import", { created: report.created, updated: report.updated, skipped: report.skipped.length, groups: report.groups, file: limited(body.fileName, 200, "Dosya adı") });
    });
    changed(user, {});
    changed(user, { kind: "plans", groups: true });
    ok(res, report);
  });

  // ---------- Toplu taksitlendirme ----------
  // Seçilen carilere tek seferde taksit kartı: tutar herkese aynı ya da kartın bir ek alanından (ör. "SERVİS ÜCRETİ").
  router.post("/api/workspace/accounts/bulk-plan", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req, { limit: 5_000_000 });
    // Seçim: kimlik listesi ya da "süzgeçteki hepsi" (all: true + liste süzgeçleri; 200 bin cari için kimlik taşınmaz).
    const fromFilter = body.all === true ? list(user, { q: text(body.q).slice(0, 120), group: text(body.group), subgroup: text(body.subgroup), type: ACCOUNT_TYPES[text(body.type)] ? text(body.type) : "", status: ["active", "passive", "all"].includes(text(body.status)) ? text(body.status) : "active", balance: text(body.balance) || "all" }).accounts.map(item => item.id) : [];
    const ids = [...new Set((body.all === true ? fromFilter : Array.isArray(body.ids) ? body.ids : []).map(value => String(value || "").slice(0, 120)).filter(Boolean))];
    if (!ids.length) throw new HttpError(400, "Taksitlendirilecek carileri seçin.");
    if (ids.length > MAX_IMPORT) throw new HttpError(400, `Tek seferde en çok ${MAX_IMPORT} cari seçilebilir.`);
    const byField = body.amountMode === "field";
    const field = limited(body.field, 80, "Alan");
    if (byField && !field) throw new HttpError(400, "Tutarın okunacağı alanı seçin.");
    const fixed = byField ? 0 : amountOf(body.total, "Tutar");
    if (!byField && !(fixed > 0)) throw new HttpError(400, "Herkese uygulanacak toplam tutarı yazın.");
    // Taksit sayısı, ilk vade ve aralık, tek kart açılırken kullanılan doğrulamadan geçer.
    const distribution = { count: Math.trunc(Number(body.count)), firstDue: text(body.firstDue), everyMonths: Math.trunc(Number(body.everyMonths) || 1) };
    plans().validDistribution({ ...distribution }, 1);
    const skipExisting = body.skipExisting !== false;
    const planName = limited(body.name, 160, "Kart adı");
    const note = limited(body.note, 1000, "Bilgi notu");
    const report = { created: 0, skipped: [], total: 0 };
    store.tx(() => {
      const active = new Set(store.all("SELECT DISTINCT account_id AS id FROM plans WHERE deleted_at IS NULL AND status = 'active' AND account_id <> ''").map(row => row.id));
      let refNo = Number(plans().nextRef()) - 1;
      for (const id of ids) {
        const found = store.get(`${ACCOUNT_SQL} WHERE a.id = ? AND a.deleted_at IS NULL`, id);
        if (!found) {
          report.skipped.push({ name: id, reason: "Cari bulunamadı" });
          continue;
        }
        const account = withFields(found);
        if (skipExisting && active.has(account.id)) {
          report.skipped.push({ name: account.name, reason: "Açık taksit kartı var" });
          continue;
        }
        let total = fixed;
        if (byField) {
          const value = account.fields.find(item => item.label.toLocaleLowerCase("tr-TR") === field.toLocaleLowerCase("tr-TR"))?.value;
          total = roundMoney(parseAmount(value));
          if (!Number.isFinite(total) || total <= 0) {
            report.skipped.push({ name: account.name, reason: `“${field}” alanında tutar yok` });
            continue;
          }
        }
        plans().createForAccount(user, account, { total, ...distribution, name: planName ? `${account.name} · ${planName}` : "", note, refNo: String((refNo += 1)) });
        report.created += 1;
        report.total = roundMoney(report.total + total);
      }
      audit(user, "account.bulk-plan", "bulk", { created: report.created, skipped: report.skipped.length, total: report.total, count: distribution.count, firstDue: distribution.firstDue, field: byField ? field : "" });
    });
    changed(user, {});
    changed(user, { kind: "plans" });
    ok(res, report);
  });

  // ---------- Tablodaki kayıt ----------
  // Kişinin kartı (ortadaki tablo): kayda bağlı cari varsa özeti ve bakiyesi.
  // Yeni kayıt formu (v2.0.7): "Cari kartı da aç". Kayda bağlı cari varsa o; aynı ad + telefon (ya da telefonsuz tek
  // aynı ad) bağsız bir cari varsa kayda bağlanır; yoksa kayda bağlı yeni cari açılır. Kişi bir kez girilir.
  router.post("/api/workspace/cases/:key/account", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const key = limited(params.key, 200, "Kayıt");
    const body = await readJson(req);
    const name = limited(body.name, 160, "Ad Soyad / Unvan");
    if (!name) throw new HttpError(400, "Cari açmak için ad gerekli.");
    const phone = limited(body.phone, 60, "Telefon");
    const caseTitle = limited(body.caseTitle, 200, "Kayıt adı") || name;
    if (dataset?.hasRecord && !dataset.hasRecord(key)) throw new HttpError(400, "Kayıt açık veri oturumunda bulunamadı.");
    let outcome = "existing";
    const id = store.tx(() => {
      const linked = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? ORDER BY created_at LIMIT 1", key, currentSource());
      if (linked) return linked.id;
      const matched = matchPerson({ name, phone, groupId: "" });
      const free = matched && store.get("SELECT id FROM accounts WHERE id = ? AND case_key = ''", matched);
      if (free) {
        store.run("UPDATE accounts SET case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ?", key, currentSource(), caseTitle, user.id, now(), matched);
        audit(user, "account.updated", matched, { linkedCase: key, from: "record" });
        outcome = "linked";
        return matched;
      }
      const created = insertAccount(user, { name, phone, caseKey: key, caseSource: currentSource(), caseTitle, type: ACCOUNT_TYPES[text(body.type)] ? text(body.type) : "customer", fields: [] });
      audit(user, "account.created", created, { name, from: "record" });
      outcome = "created";
      return created;
    });
    changed(user, { accountId: id });
    changed(user, { kind: "activity", caseKey: key, datasetKey: currentSource() });
    ok(res, { ...detail(id, user), outcome });
  });

  router.get("/api/workspace/cases/:key/account", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const key = limited(params.key, 200, "Kayıt");
    const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? ORDER BY created_at LIMIT 1", key, currentSource());
    if (!found) return ok(res, { account: null, canManage: can(user.role, "accounts.manage") });
    const account = detail(found.id, user);
    ok(res, { account: { id: account.id, name: account.name, refNo: account.refNo, type: account.type, totals: account.totals, side: account.side, planCount: account.plans.length }, canManage: account.canManage });
  });

  // ---------- Diğer modüller için ----------
  // Taksit kartı açılırken cari: tablodaki aynı kayda bağlı cari varsa o, yoksa kartın bilgileriyle yeni cari.
  // outcome (isteğe bağlı): { created, linked } — aktarma geri alınırken yalnız kendi açtığı/bağladığı cariye dokunur.
  function createFromPlan(user, person, outcome = null) {
    const source = person.caseSource || currentSource();
    if (person.caseKey) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ?", person.caseKey, source);
      if (found) return found.id;
    }
    // v2.0.7: aynı ad + aynı telefon (ya da telefonsuz, aynı grupta tek aynı ad) kesin eşleşirse o cari; boşa cari açılmaz.
    // v2.0.8: kart bir kayda bağlıysa, başka bir kayda bağlı cari kullanılmaz (aynı adlı iki kişinin hesabı karışmaz).
    const matched = matchPerson({ name: person.name, phone: person.phone, groupId: person.groupId || "" });
    const owner = matched ? store.get("SELECT case_key AS caseKey, case_source AS caseSource FROM accounts WHERE id = ?", matched) : null;
    const foreign = Boolean(person.caseKey && owner?.caseKey && (owner.caseKey !== person.caseKey || owner.caseSource !== source));
    if (matched && !foreign) {
      if (person.caseKey && !owner?.caseKey) {
        store.run("UPDATE accounts SET case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ''", person.caseKey, source, person.caseTitle || person.name, user.id, now(), matched);
        if (outcome) outcome.linked = true;
      }
      return matched;
    }
    const id = insertAccount(user, { name: person.name, phone: person.phone, note: person.note, registeredOn: person.registeredOn, groupId: person.groupId, subgroupId: person.subgroupId, caseKey: person.caseKey, caseSource: person.caseKey ? source : "", caseTitle: person.caseTitle, type: "customer", fields: [] });
    audit(user, "account.created", id, { name: person.name, from: "plan" });
    if (outcome) outcome.created = true;
    return id;
  }
  // Taksit Excel'inden gelen kişi için kesin eşleşme: aynı ad + aynı telefon (7+ hane) ya da telefonsuz aynı ad + aynı grup
  // ve bu eşleşme tek olmalı. Şüpheli durumda yeni cari açılır (başka kişinin hesabına yazılmaz).
  function matchPerson(person) {
    const candidates = store.all("SELECT id, phone, group_id AS groupId FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE", person.name);
    const phone = digits(person.phone);
    const hits = phone.length >= 7 ? candidates.filter(row => digits(row.phone) === phone) : candidates.filter(row => !digits(row.phone) && (row.groupId || "") === (person.groupId || ""));
    return hits.length === 1 ? hits[0].id : "";
  }
  // Mizan (v2.0.7): tüm carilerin defter satırları tek geçişte. Her carinin satırları Cari kartındaki defterle aynı
  // kuraldan (accountLedger) gelir; mizan bakiyesi = Cari listesindeki bakiye.
  function allLedgers() {
    const rows = store.all(`${ACCOUNT_SQL} WHERE a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE`).map(({ fieldsJson, ...row }) => row);
    const entries = new Map();
    for (const entry of store.all("SELECT id, account_id AS accountId, kind, amount, date, note, receipt_no AS receiptNo, source, source_id AS sourceId, created_at AS createdAt FROM account_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.accountId)) entries.set(entry.accountId, []);
      entries.get(entry.accountId).push(entry);
    }
    const planMap = plans()?.ledgerPlansByAccount ? plans().ledgerPlansByAccount() : new Map();
    const lines = new Map();
    for (const row of rows) lines.set(row.id, accountLedger(entries.get(row.id) || [], planMap.get(row.id) || []).lines);
    return { accounts: rows, lines };
  }
  // Kasa: cari tahsilatları (giriş) ve ödemeleri (çıkış). Silinen carinin hareketi Kasa'dan düşer (taksit kartıyla aynı).
  // Kasa kaynağı: aynı tablo/koşul hem Kasa satırlarında hem Kasa toplamında (ANLIK DURUM) kullanılır.
  const cashSource = { table: "account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL", where: "e.kind IN ('in', 'out') AND e.source = ''", kind: "e.kind", amount: "e.amount", date: "e.date" };
  const cashEntries = (after = "") =>
    store.all(
      `SELECT e.id, e.kind, 'account' AS source, e.amount, e.date, e.note AS description, e.account_id AS accountId, a.name AS accountName,
              e.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM ${cashSource.table} LEFT JOIN users u ON u.id = e.created_by
       WHERE ${cashSource.where}${after ? ` AND ${cashSource.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
  // Stok hareketi cariye yazılınca (routes/stock.mjs): borç/alacak satırı stok hareketine bağlı açılır, düzeltilir, silinir.
  const stockEntry = {
    upsert(user, move, { accountId, kind, amount, date, note }) {
      const existing = store.get("SELECT id FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      if (existing) store.run("UPDATE account_entries SET account_id = ?, kind = ?, amount = ?, date = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", accountId, kind, amount, date, note, user.id, now(), existing.id);
      else addEntry(user, accountId, { kind, amount, date, note, source: "stock", sourceId: move });
    },
    remove(move) {
      const existing = store.get("SELECT account_id AS accountId FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      store.run("DELETE FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      return existing?.accountId || "";
    },
  };
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') FROM account_entries) AS e, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') || '/' || COUNT(deleted_at) FROM accounts) AS a");
    return `${row.e}|${row.a}`;
  };
  // Silinenler (routes/trash.mjs): silinen cariler ve cari hareketleri.
  const deletedList = () =>
    store.all("SELECT a.id, a.name, a.ref_no AS refNo, a.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM accounts a LEFT JOIN users u ON u.id = a.deleted_by WHERE a.deleted_at IS NOT NULL").map(item => ({
      id: `account:${item.id}`,
      kind: "account",
      title: item.name,
      detail: item.refNo ? `Cari No ${item.refNo}` : "",
      deletedAt: item.deletedAt,
      actorName: item.actorName,
      restorable: true,
      note: "Hareketleriyle Cari listesine geri döner; Kasa yeniden hesaplanır.",
    }));
  function restoreDeleted(user, id) {
    const account = store.get("SELECT id, name FROM accounts WHERE id = ? AND deleted_at IS NOT NULL", id);
    if (!account) throw new HttpError(404, "Bu cari zaten geri yüklenmiş.");
    store.tx(() => {
      // Numara bu arada başka bir cariye verildiyse geri gelen cari sıradaki boş numarayı alır (iki carinin aynı numarası olmaz).
      const current = store.get("SELECT ref_no AS refNo FROM accounts WHERE id = ?", account.id)?.refNo || "";
      const refNo = freeRef(current) || nextRef();
      store.run("UPDATE accounts SET deleted_at = NULL, deleted_by = NULL, ref_no = ?, updated_by = ?, updated_at = ? WHERE id = ?", refNo, user.id, now(), account.id);
      audit(user, "account.restored", account.id, { name: account.name, refNo, renumbered: refNo !== current });
    });
    changed(user, { accountId: account.id });
    changed(user, { kind: "cash" });
    return `“${account.name}” carisi geri geldi.`;
  }
  function restoreEntry(user, item, payload) {
    if (!KIND_TEXT[payload.kind]) throw new HttpError(409, "Hareketin bilgisi eksik; geri yüklenemez.");
    const account = store.get("SELECT id, deleted_at AS deletedAt FROM accounts WHERE id = ?", payload.accountId);
    if (!account) throw new HttpError(409, "Hareketin carisi artık yok; geri yüklenemez.");
    if (account.deletedAt) throw new HttpError(409, `“${payload.accountName}” carisi silinmiş. Önce cariyi geri yükleyin.`);
    store.tx(() => {
      if (!store.get("SELECT 1 AS found FROM account_entries WHERE id = ?", item.ref)) {
        store.run(
          "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)",
          item.ref, account.id, payload.kind, Number(payload.amount) || 0, payload.date, payload.note || "", payload.receiptNo || null, payload.createdBy || user.id, payload.createdAt || now(), user.id, now(),
        );
      }
      trash.markRestored(item.id, user);
      audit(user, "account.entry.restored", item.ref, { accountId: account.id, kind: payload.kind, amount: payload.amount, date: payload.date });
    });
    changed(user, { accountId: account.id });
    changed(user, { kind: "cash" });
    return "Cari hareketi geri eklendi; bakiye ve Kasa yeniden hesaplandı.";
  }

  return { exists, createFromPlan, matchPerson, cashEntries, cashSource, stockEntry, fingerprint, deletedList, restoreDeleted, restoreEntry, detail, list, allLedgers };
}
