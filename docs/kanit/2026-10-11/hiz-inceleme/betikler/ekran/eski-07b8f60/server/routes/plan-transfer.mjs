// Tablodan taksit kartına aktarma (v2.0.8). Ana tabloya yüklenen Excel/Sheets'teki ödeme planları (ay kolonları, sıralı
// taksit kolonları, toplam + taksit sayısı + ilk vade) Taksitler modülüne kart olarak aktarılır.
//
// İlkeler (muhasebe programlarının açılış/devir aktarımı gibi)
//   - Ön izleme ve doğrulama önce: her kişi için taksitler, Excel'e göre ödenen, programda girilmiş tahsilat, kalan ve
//     bulgular (hata: aktarılmaz; uyarı: aktarılır, raporda; bilgi). Aktar düğmesinde sunucu her şeyi yeniden hesaplar;
//     ön izlemeden sonra tablo ya da kartlar değiştiyse aktarmaz, ön izlemeyi yeniler (409).
//   - Kişi bir kez girilir: kart hem tablodaki kayda hem cariye bağlanır; kaydın kartı varsa atlanır; Taksitler'de bağsız
//     aynı kişinin kartı varsa (Excel'den yüklenmiş) yeni kart açılmaz, o kart kayda bağlanır. Belirsizse tahmin edilmez.
//   - Excel'de ödenmiş kısım açılış (devir) kaydıdır: taksiti kapatır, carinin bakiyesine sayılır, Kasa'ya girmez.
//   - Kayıt kartından programda girilmiş tahsilatlar (isteğe bağlı) karta taşınır: Kasa toplamı ve tarihleri değişmez.
//   - Tek işlem bloğu: yarıda kesilirse hiçbir şey yazılmaz. Aktarım kaydı tutulur; geri alınabilir (aktarımdan sonra
//     kartlarda işlem yapılmadıysa).
import { randomUUID } from "node:crypto";
import { methodInput } from "../lib/pay-method.mjs";
import { HttpError, limited, ok, readJson, text } from "../lib/http.mjs";
import { extractSchedules } from "../lib/insight/schedules.mjs";
import { monthsInText } from "../lib/insight/installments.mjs";
import { roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { dayText, isoDay } from "../lib/plans.mjs";
import { FREEZE_CLOSE, SkippedRow } from "./plans.mjs";
import { systemClock } from "../lib/clock.mjs";

const SETTLED_KEY = "dues.settled";
const DISMISSED_KEY = "plans.transfer.dismissed";
const IMPORTABLE = new Set(["ready", "warning", "closed", "link"]);
const EPS = 0.005;
const fold = value => String(value ?? "").normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
const digits = value => String(value ?? "").replace(/\D/g, "");
const MONEY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = value => MONEY.format(Number(value) || 0);

export function registerPlanTransfer(router, { store, bank, auth, audit, events, dataset, profile, period = null, plans = () => null, accounts = () => null, now: clock = systemClock }) {
  // İş saati (v2.1.0): context.now (config.now).
  const now = () => clock().toISOString();
  const today = () => isoDay(clock());
  const source = () => (dataset?.currentKey ? dataset.currentKey() : "");
  const settingKey = name => (dataset?.settingKey ? dataset.settingKey(name) : name);
  const readJsonSetting = (name, fallback) => {
    try {
      const value = JSON.parse(store.setting(settingKey(name), "") || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  };
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const sessionName = () => {
    try {
      return dataset?.sessions ? dataset.sessions().find(item => item.current)?.name || "" : "";
    } catch {
      return "";
    }
  };

  const optionsOf = input => {
    const dueDay = Math.trunc(Number(input.dueDay) || 1);
    const firstDue = text(input.firstDue);
    return {
      dueDay: Math.min(28, Math.max(1, dueDay)),
      firstDue: /^\d{4}-\d{2}-\d{2}$/.test(firstDue) ? firstDue : "",
      // Kayıt kartından girilmiş tahsilatlar karta taşınsın mı (varsayılan evet: takvim de onları sayıyordu).
      payments: !(input.payments === false || input.payments === "0" || input.payments === 0 || input.payments === "false"),
      group: ["tab", "none", "custom"].includes(text(input.group)) ? text(input.group) : "tab",
      groupName: limited(input.groupName, 80, "Grup adı"),
    };
  };

  // Veri, kartlar, tahsilatlar ve "ödendi say" işaretleri: ön izleme ile aktarma arasında değişirse aktarım durur.
  const fingerprint = () => {
    const payments = store.get("SELECT COUNT(*) AS n, COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS at, COALESCE(SUM(amount), 0) AS sum FROM payments");
    const accountsRow = store.get("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS at FROM accounts");
    const settled = store.setting(settingKey(SETTLED_KEY), "") || "";
    return [source(), profile?.fingerprint ? profile.fingerprint() : "", plans()?.fingerprint ? plans().fingerprint() : "", `${payments.n}/${payments.at}/${payments.sum}`, `${accountsRow.n}/${accountsRow.at}`, settled.length, settled.slice(-40)].join("|");
  };

  async function analyze(options) {
    const view = await dataset.view();
    const rows = view.rows || [];
    const tabs = (view.tabs || []).map(item => item.title);
    const key = source();
    const nowDate = clock();
    const { tabs: planTabs, records } = extractSchedules({ rows, tabs, settled: readJsonSetting(SETTLED_KEY, {}), now: nowDate, forced: profile?.roles ? profile.roles() : null, dueDay: options.dueDay, defaultFirstDue: options.firstDue });
    if (!records.length) return { tabs: [], records: [], raw: new Map(), totals: emptyTotals(), fingerprint: fingerprint(), source: key, sessionName: sessionName() };

    // Kaydın kartı var mı (bu oturumda)?
    const linked = new Map();
    for (const plan of store.all("SELECT id, name, case_key AS caseKey FROM plans WHERE deleted_at IS NULL AND case_key <> '' AND case_source = ? ORDER BY created_at", key)) if (!linked.has(plan.caseKey)) linked.set(plan.caseKey, plan);
    // Taksitler'de hiçbir kayda bağlı olmayan kartlar (ör. Taksitler → Excel'den yüklenmiş): aynı kişiyse bağlanır.
    const free = new Map();
    for (const plan of store.all("SELECT id, name, phone, total, account_id AS accountId FROM plans WHERE deleted_at IS NULL AND case_key = ''")) {
      const name = fold(plan.name);
      if (!free.has(name)) free.set(name, []);
      free.get(name).push(plan);
    }
    // Kaydın kayıt kartından girilmiş tahsilatları (Kasa'daki "kayıt tahsilatı").
    const keys = new Set(records.map(record => record.key));
    const payments = new Map();
    for (const payment of store.all("SELECT id, case_key AS caseKey, amount, date, note FROM payments ORDER BY date, created_at")) {
      if (!keys.has(payment.caseKey)) continue;
      if (!payments.has(payment.caseKey)) payments.set(payment.caseKey, []);
      payments.get(payment.caseKey).push(payment);
    }
    // Kayda bağlı cari ve carinin taksit dışı tahsilatları.
    const caseAccounts = new Map();
    for (const account of store.all("SELECT id, name, case_key AS caseKey FROM accounts WHERE deleted_at IS NULL AND case_key <> '' AND case_source = ? ORDER BY created_at", key)) if (!caseAccounts.has(account.caseKey)) caseAccounts.set(account.caseKey, account);
    const accountIn = new Map(store.all("SELECT account_id AS id, COALESCE(SUM(amount), 0) AS total FROM account_entries WHERE kind = 'in' AND source = '' GROUP BY account_id").map(row => [row.id, row.total]));
    // Aynı ad (ve telefon) ile birden çok kayıt: her biri ayrı kart ve cari olur; kullanıcı görsün.
    const sameName = new Map();
    for (const record of records) {
      const name = fold(record.name);
      sameName.set(name, (sameName.get(name) || 0) + 1);
    }
    // Bağsız kart kime bağlanır: telefon ikisinde de yazılıysa aynı olmalı; biri yoksa ad hem kartlarda hem tabloda tek olmalı.
    const freeHits = new Map();
    const claims = new Map();
    for (const record of records) {
      const candidates = free.get(fold(record.name)) || [];
      if (!candidates.length) continue;
      const phone = digits(record.phone);
      let hits = phone.length >= 7 ? candidates.filter(plan => digits(plan.phone) === phone) : [];
      if (!hits.length && (phone.length < 7 || candidates.every(plan => digits(plan.phone).length < 7))) hits = candidates.length === 1 && sameName.get(fold(record.name)) === 1 && (phone.length < 7 || digits(candidates[0].phone).length < 7) ? candidates : [];
      freeHits.set(record.key, { hits, candidates });
      for (const plan of hits) claims.set(plan.id, (claims.get(plan.id) || 0) + 1);
    }
    const groupExisting = name => (name ? store.get("SELECT id FROM plan_groups WHERE name = ? COLLATE NOCASE AND parent_id IS NULL", name)?.id || "" : "");

    const totals = emptyTotals();
    const out = records.map(record => {
      const issues = [...record.issues];
      const add = (level, code, message) => issues.push({ level, code, text: message });
      const own = payments.get(record.key) || [];
      const programPaid = roundMoney(own.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));
      let status = "ready";
      let linkPlan = null;
      const existing = linked.get(record.key);
      if (issues.some(entry => entry.level === "error")) status = "error";
      else if (existing) {
        status = "exists";
        add("info", "exists", `Bu kaydın taksit kartı zaten var (“${existing.name}”); yeniden açılmaz.`);
      } else {
        const match = freeHits.get(record.key);
        if (match?.hits.length === 1 && claims.get(match.hits[0].id) === 1) {
          linkPlan = match.hits[0];
          status = "link";
          add("info", "link", `Taksitler'de bu kişinin bağsız kartı var (“${linkPlan.name}”); yeni kart açılmaz, o kart bu kayda bağlanır.`);
          if (Math.abs(roundMoney(linkPlan.total) - record.total) > 0.01) add("warning", "link-total", `Kartın toplamı ${money(linkPlan.total)}, tablodaki plan ${money(record.total)}. Kart değiştirilmeden bağlanır.`);
        } else if (match?.candidates.length) {
          status = "error";
          add("error", "ambiguous-card", `Taksitler'de “${record.name}” adlı ${match.candidates.length} bağsız kart var; hangisi olduğu kesin değil. Kartı açıp “Tablodaki kayıt” alanından bu kayda bağlayın.`);
        }
      }
      if (sameName.get(fold(record.name)) > 1) add("warning", "same-name", `Tabloda “${record.name}” adıyla ${sameName.get(fold(record.name))} kayıt var; her biri ayrı kart ve ayrı cari olur.`);
      // Programda girilmiş kayıt tahsilatları.
      const countPayments = options.payments && own.length && (status === "ready" || status === "warning" || status === "link" || status === "closed");
      // v2.0.26 (2. gözden geçirme İ1): bağlanacak bağsız kart kapanmış dönemde kapatıldıysa (kalandan vazgeçildi, 689 kilitli mizanda)
      // kayıt tahsilatı o karta taşınamaz: vazgeçilen kalan değişirdi. Önceden ön izleme "bağlanır" diyor, aktarım bütünüyle kapıda
      // nedensiz 409 alıyordu (geri almada da). Tahsilatlar taşınmadan (seçenek kapalı) bağlanabilir.
      if (status === "link" && countPayments) {
        const lock = period?.lockedUntil?.() || "";
        const closedOn = lock ? plans()?.closeDayOf?.(linkPlan.id) || "" : "";
        if (closedOn && closedOn <= lock) {
          status = "error";
          add("error", "link-closed-locked", `Taksitler'deki bağsız kartı (“${linkPlan.name}”) ${dayText(closedOn)} tarihinde kapatıldı (kalan alacaktan vazgeçildi); ${dayText(lock)} ve öncesi kapatılmış (kilitli) dönemdir. Kayıt tahsilatları bu karta taşınamaz, kişi aktarılmaz. Tahsilatları taşımadan aktarabilir ya da yönetici dönem kilidini açınca yeniden deneyebilirsiniz.`);
        }
      }
      if (own.length) {
        if (options.payments) add("info", "payments", `Kayıt kartından girilmiş ${own.length} tahsilat (${money(programPaid)}) karta taşınır; Kasa toplamı değişmez.`);
        else add("warning", "payments-left", `Kayıt kartında ${own.length} tahsilat (${money(programPaid)}) var; seçiminize göre karta sayılmaz, kayıt tahsilatı olarak kalır.`);
      }
      const remainingAfter = status === "link" ? null : roundMoney(Math.max(0, record.total - record.paid - (countPayments ? programPaid : 0)));
      if (countPayments && status !== "link" && programPaid > record.total - record.paid + 0.01) add("warning", "payments-exceed", `Kayıt tahsilatları kalan borcu ${money(programPaid - (record.total - record.paid))} aşıyor; kartta fazla tahsilat görünür.`);
      // Cari: kayda bağlı cari, bağsız aynı kişi (ad + telefon) ya da yeni.
      let account = "new";
      let accountName = "";
      const bound = caseAccounts.get(record.key);
      if (status === "link" && linkPlan.accountId) {
        account = "card";
        accountName = store.get("SELECT name FROM accounts WHERE id = ?", linkPlan.accountId)?.name || "";
      } else if (bound) {
        account = "bound";
        accountName = bound.name;
        if (accountIn.get(bound.id) > EPS) add("info", "account-in", `Carisinde taksit dışı ${money(accountIn.get(bound.id))} tahsilat var; karta sayılmaz, cari bakiyesinde görünür.`);
      } else if (status !== "error" && status !== "exists") {
        const matched = accounts()?.matchPerson ? accounts().matchPerson({ name: record.name, phone: record.phone, groupId: groupExisting(groupNameFor(record, options)) || "__yeni__" }) : "";
        const owner = matched ? store.get("SELECT name, case_key AS caseKey FROM accounts WHERE id = ?", matched) : null;
        if (matched && !owner?.caseKey) {
          account = "match";
          accountName = owner?.name || record.name;
        }
      }
      if (status === "ready" && (record.closed || record.inactive)) status = "closed";
      if (status === "ready" && issues.some(entry => entry.level === "warning")) status = "warning";
      if (status === "closed" && record.inactive) add("info", "inactive", "Durumu “ayrıldı / pasif”: varsayılan olarak aktarılmaz.");
      else if (status === "closed") add("info", "closed", "Planı kapanmış (ödenmiş): varsayılan olarak aktarılmaz.");
      totals[status] += 1;
      if (status === "ready" || status === "warning" || status === "link") {
        totals.selected += 1;
        totals.total = roundMoney(totals.total + record.total);
        totals.paid = roundMoney(totals.paid + record.paid);
        totals.programPaid = roundMoney(totals.programPaid + (countPayments ? programPaid : 0));
        totals.remaining = roundMoney(totals.remaining + (remainingAfter ?? 0));
      }
      return {
        key: record.key,
        tab: record.tab,
        name: record.name,
        caseNo: record.caseNo,
        phone: record.phone,
        shape: record.shape,
        items: record.items.map(item => [item.dueDate, item.amount, item.paid, item.label]),
        total: record.total,
        paid: record.paid,
        programPaid,
        paymentCount: own.length,
        remaining: remainingAfter,
        excel: record.excel,
        groupName: groupNameFor(record, options),
        subgroupName: record.groupName ? record.subgroupName : "",
        account,
        accountName,
        linkPlanId: linkPlan?.id || "",
        linkPlanName: linkPlan?.name || "",
        status,
        selectable: IMPORTABLE.has(status),
        selected: status === "ready" || status === "warning" || status === "link",
        issues,
      };
    });
    // raw: sunucuda kalan tam kayıt (taksitler, not, sıra no); aktarma bunu yazar, istemciye gitmez.
    return { tabs: planTabs, records: out, raw: new Map(records.map(record => [record.key, record])), totals, fingerprint: fingerprint(), source: key, sessionName: sessionName() };
  }
  // Grup: tablodaki grup kolonu (plaka, okul…) varsa o ve alt grubu; yoksa seçime göre sekme adı, verilen ad ya da grupsuz.
  function groupNameFor(record, options) {
    if (record.groupName) return record.groupName;
    if (options.group === "none") return "";
    if (options.group === "custom") return options.groupName;
    return String(record.tab || "").slice(0, 80);
  }
  const emptyTotals = () => ({ ready: 0, warning: 0, link: 0, closed: 0, exists: 0, error: 0, selected: 0, total: 0, paid: 0, programPaid: 0, remaining: 0 });

  router.get("/api/workspace/plans/from-table", async ({ req, res, url }) => {
    auth.requirePermission(req, "plans.manage");
    const options = optionsOf(Object.fromEntries(url.searchParams));
    const { raw, ...analysis } = await analyze(options);
    ok(res, { ...analysis, options, imports: recentImports() });
  });

  // Yükleme sonrası soru (v2.0.8): "Bu veride N kişinin ödeme planı var, aktarılsın mı?" Yalnız kart yöneten rollere.
  router.get("/api/workspace/plans/from-table/summary", async ({ req, res }) => {
    const user = auth.requireUser(req);
    if (!canUser(user, "plans.manage")) return ok(res, { count: 0, tabs: [], ask: false });
    const analysis = await analyze(optionsOf({}));
    const dismissed = new Set(readJsonSetting(DISMISSED_KEY, { tabs: [] }).tabs || []);
    const tabs = analysis.tabs.map(tab => ({ tab: tab.tab, shapeText: tab.shapeText, count: analysis.records.filter(record => record.tab === tab.tab && record.selected).length })).filter(tab => tab.count);
    const count = tabs.reduce((sum, tab) => sum + tab.count, 0);
    ok(res, { count, tabs, ask: tabs.some(tab => !dismissed.has(tab.tab)), sessionName: analysis.sessionName });
  });
  router.post("/api/workspace/plans/from-table/dismiss", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req);
    const tabs = (Array.isArray(body.tabs) ? body.tabs : []).map(tab => limited(tab, 200, "Sekme")).filter(Boolean);
    const current = new Set(readJsonSetting(DISMISSED_KEY, { tabs: [] }).tabs || []);
    for (const tab of tabs) current.add(tab);
    store.setSetting(settingKey(DISMISSED_KEY), JSON.stringify({ tabs: [...current].slice(-200) }), user.id);
    ok(res, { ok: true });
  });

  router.post("/api/workspace/plans/from-table", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req, { limit: 8_000_000 });
    const options = optionsOf(body);
    const wanted = new Set((Array.isArray(body.keys) ? body.keys : []).map(key => limited(key, 200, "Kayıt")).filter(Boolean));
    if (!wanted.size) throw new HttpError(400, "Aktarılacak kişileri seçin.");
    const analysis = await analyze(options);
    if (body.fingerprint && body.fingerprint !== analysis.fingerprint) throw new HttpError(409, "Ön izlemeden sonra tablo, kartlar ya da tahsilatlar değişti. Ön izleme yenilendi; kontrol edip yeniden aktarın.", { code: "stale" });
    const byKey = new Map(analysis.records.map(record => [record.key, record]));
    const importId = `import-${randomUUID()}`;
    const key = source();
    const report = { importId, created: 0, linked: 0, accountsCreated: 0, accountsLinked: 0, paymentsMoved: 0, paymentsAmount: 0, total: 0, opening: 0, remaining: 0, skipped: [] };
    const undo = { plans: [], openings: [], links: [], accounts: [], accountLinks: [], payments: [], groups: [], source: key };
    const plansService = plans();
    const accountsService = accounts();
    // v2.1.0 (bank.post op 'move'): kayıt tahsilatı karta taşınırken işlem başlığını (İşlem No, yol) taşır; kart, taksitler ve
    // açılış (devir) satırları para satırı değildir.
    const result = bank.post({ user, module: "plan", op: "move", prev: { importId }, write: () => {
      // Sıra No: tablodaki numara başka kartta yoksa o, yoksa sıradaki boş numara (iki kartın numarası aynı olmaz).
      const refs = new Set(store.all("SELECT ref_no AS refNo FROM plans WHERE deleted_at IS NULL").map(row => String(row.refNo || "")));
      let autoRef = Number(plansService.nextRef()) - 1;
      const refFor = wantedRef => {
        if (wantedRef && !refs.has(wantedRef)) {
          refs.add(wantedRef);
          return wantedRef;
        }
        do autoRef += 1;
        while (refs.has(String(autoRef)));
        refs.add(String(autoRef));
        return String(autoRef);
      };
      const groupId = (name, parentId = null) => {
        if (!name) return null;
        const found = store.get("SELECT id FROM plan_groups WHERE name = ? COLLATE NOCASE AND COALESCE(parent_id, '') = ?", name, parentId || "");
        if (found) return found.id;
        const id = plansService.ensureGroup(user, name, parentId);
        if (id) undo.groups.push(id);
        return id;
      };
      for (const wantedKey of wanted) {
        const record = byKey.get(wantedKey);
        if (!record) {
          report.skipped.push({ key: wantedKey, name: "", reason: "Kayıt tabloda artık yok ya da ödeme planı okunmadı." });
          continue;
        }
        if (!IMPORTABLE.has(record.status)) {
          report.skipped.push({ key: record.key, name: record.name, reason: record.issues.find(entry => entry.level === "error" || entry.code === "exists")?.text || "Aktarılamaz." });
          continue;
        }
        // v2.0.26 (gözden geçirme G6): kapanmış dönemdeki kayıt tahsilatı karta taşınmaz (kilitli dönemin kayıt tahsilatı ve taksit
        // hareketi değişirdi); kişi nedeniyle atlanır, tahsilat kayıtta kalır. Önceden bütün aktarım kapıda nedensiz 409 alıyordu.
        const lock = period?.lockedUntil?.() || "";
        const lockedPay = lock && options.payments ? store.get("SELECT MIN(date) AS day FROM payments WHERE case_key = ? AND date <= ?", record.key, lock)?.day : "";
        if (lockedPay) {
          report.skipped.push({ key: record.key, name: record.name, reason: `${dayText(lockedPay)} tarihli kayıt tahsilatı kapatılmış (kilitli) dönemde (${dayText(lock)} ve öncesi); karta taşınamaz, kişi aktarılmadı. Tahsilatları taşımadan aktarabilir ya da yönetici dönem kilidini açınca yeniden deneyebilirsiniz.` });
          continue;
        }
        let planId;
        let items = [];
        if (record.status === "link") {
          const plan = store.get("SELECT id, account_id AS accountId FROM plans WHERE id = ? AND deleted_at IS NULL AND case_key = ''", record.linkPlanId);
          if (!plan) {
            report.skipped.push({ key: record.key, name: record.name, reason: "Bağlanacak kart bu arada değişti." });
            continue;
          }
          store.run(`UPDATE plans SET ${FREEZE_CLOSE}, case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ''`, record.key, key, record.name, user.id, now(), plan.id);
          undo.links.push({ planId: plan.id, caseKey: record.key });
          // Kartın carisi bir kayda bağlı değilse bu kayda bağlanır (kişi bir kez).
          if (plan.accountId && store.get("SELECT 1 AS found FROM accounts WHERE id = ? AND deleted_at IS NULL AND case_key = ''", plan.accountId)) {
            store.run("UPDATE accounts SET case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ''", record.key, key, record.name, user.id, now(), plan.accountId);
            undo.accountLinks.push({ accountId: plan.accountId, caseKey: record.key });
            report.accountsLinked += 1;
          }
          audit(user, "plan.updated", plan.id, { linkedCase: key ? record.key : "", from: "table-import", importId });
          planId = plan.id;
          report.linked += 1;
        } else {
          const full = analysis.raw.get(record.key);
          // v2.0.26 (G6): grup, cari ve Kayıt Tarihi iç işlemde (SAVEPOINT) belirlenir; kartın Kayıt Tarihi (ilk vade ya da kayıt
          // günü) kapanmış dönemdeyse hepsi geri alınır, kişi nedeniyle atlanır.
          const groupsBefore = undo.groups.length;
          let group;
          let subgroup;
          let outcome;
          let accountId;
          let start;
          try {
            ({ group, subgroup, outcome, accountId, start } = store.tx(() => {
              const g = groupId(record.groupName);
              const sg = g && record.subgroupName ? groupId(record.subgroupName, g) : null;
              const person = { name: record.name, phone: record.phone, note: "", registeredOn: full.registeredOn || "", groupId: g, subgroupId: sg, caseKey: record.key, caseSource: key, caseTitle: record.name };
              const result = {};
              const id = accountsService?.createFromPlan ? accountsService.createFromPlan(user, person, result) : "";
              const day = plansService.scheduledStart(full.registeredOn || (id && !result.created ? store.get("SELECT registered_on AS day FROM accounts WHERE id = ?", id)?.day : "") || today(), full.items);
              const reason = plansService.lockedStartReason(day);
              if (reason) throw new SkippedRow(reason);
              return { group: g, subgroup: sg, outcome: result, accountId: id, start: day };
            }));
          } catch (error) {
            if (!(error instanceof SkippedRow)) throw error;
            undo.groups.length = groupsBefore;
            report.skipped.push({ key: record.key, name: record.name, reason: error.message });
            continue;
          }
          const person = { name: record.name, phone: record.phone, note: "", registeredOn: start, groupId: group, subgroupId: subgroup, caseKey: record.key, caseSource: key, caseTitle: record.name };
          if (outcome.created) {
            undo.accounts.push(accountId);
            report.accountsCreated += 1;
          }
          if (outcome.linked) {
            undo.accountLinks.push({ accountId, caseKey: record.key });
            report.accountsLinked += 1;
          }
          items = full.items;
          const created = plansService.createScheduled(user, { ...person, accountId, note: full.note, refNo: refFor(full.refNo), registeredOn: start }, { importId, items, openingDate: today(), openingNote: "Excel'de ödenmiş (açılış)" });
          planId = created.id;
          undo.plans.push(planId);
          undo.openings.push(...created.openingIds);
          report.created += 1;
          report.total = roundMoney(report.total + record.total);
          report.opening = roundMoney(report.opening + record.paid);
        }
        // Kayıt kartından girilmiş tahsilatlar karta taşınır (Kasa toplamı değişmez).
        if (options.payments) {
          const itemRows = store.all("SELECT id, due_date AS dueDate FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId);
          for (const payment of store.all("SELECT * FROM payments WHERE case_key = ? ORDER BY date, created_at, rowid", record.key)) {
            const entryId = plansService.adoptPayment(user, planId, payment, itemForNote(payment.note, itemRows));
            store.run("DELETE FROM payments WHERE id = ?", payment.id);
            undo.payments.push({ row: payment, entryId });
            report.paymentsMoved += 1;
            report.paymentsAmount = roundMoney(report.paymentsAmount + (Number(payment.amount) || 0));
          }
        }
        if (record.remaining !== null) report.remaining = roundMoney(report.remaining + record.remaining);
      }
      if (!report.created && !report.linked) return report;
      const title = `${analysis.sessionName || "Tablo"} · ${[...new Set([...wanted].map(wantedKey => byKey.get(wantedKey)?.tab).filter(Boolean))].join(", ")}`.slice(0, 200);
      const summary = { created: report.created, linked: report.linked, accountsCreated: report.accountsCreated, paymentsMoved: report.paymentsMoved, total: report.total, opening: report.opening, remaining: report.remaining, skipped: report.skipped.length };
      store.run("INSERT INTO plan_imports (id, kind, source, title, summary_json, undo_json, created_by, created_at) VALUES (?, 'table', ?, ?, ?, ?, ?, ?)", importId, key, title, JSON.stringify(summary), JSON.stringify(undo), user.id, now());
      audit(user, "plan.table-import", importId, { ...summary, source: key, dueDay: options.dueDay, payments: options.payments });
      return report;
    } });
    if (result.created || result.linked) {
      publish(user, { kind: "plans" });
      publish(user, { kind: "accounts" });
      publish(user, { kind: "dues", datasetKey: key });
      if (result.paymentsMoved) publish(user, { kind: "cash" });
    }
    ok(res, result);
  });

  // Tahsilat notunda ay yazıyorsa ("eylül taksiti", pilden "Eylül ödemesi · Eylül 2026") o aya düşen tek taksite bağlanır.
  function itemForNote(note, items) {
    const months = monthsInText(note);
    if (months.length !== 1) return null;
    const [want] = months;
    const hits = items.filter(item => Number(item.dueDate.slice(5, 7)) === want.month && (want.year === null || Number(item.dueDate.slice(0, 4)) === want.year));
    return hits.length === 1 ? hits[0].id : null;
  }

  // ---------- Aktarımlar ve geri alma ----------
  function recentImports() {
    return store
      .all("SELECT i.id, i.kind, i.title, i.summary_json AS summaryJson, i.created_at AS createdAt, i.undone_at AS undoneAt, COALESCE(u.display_name, '') AS actorName FROM plan_imports i LEFT JOIN users u ON u.id = i.created_by ORDER BY i.created_at DESC LIMIT 10")
      .map(({ summaryJson, ...row }) => {
        let summary = {};
        try {
          summary = JSON.parse(summaryJson || "{}");
        } catch {
          summary = {};
        }
        return { ...row, summary };
      });
  }
  router.get("/api/workspace/plans/imports", async ({ req, res }) => {
    auth.requirePermission(req, "plans.manage");
    ok(res, { imports: recentImports() });
  });

  // Aktarımdan sonra karta işlem yapıldıysa (tahsilat, düzenleme, taksit, çek) geri alma durur ve hangi kartlar olduğunu söyler.
  function blockers(undo) {
    const own = new Set([...(undo.openings || []), ...(undo.payments || []).map(item => item.entryId)]);
    const out = [];
    for (const planId of undo.plans || []) {
      const plan = store.get("SELECT name, created_at AS createdAt, updated_at AS updatedAt FROM plans WHERE id = ?", planId);
      if (!plan) continue;
      const foreign = store.all("SELECT id FROM plan_entries WHERE plan_id = ?", planId).some(entry => !own.has(entry.id));
      const touchedItems = store.get("SELECT COUNT(*) AS n FROM plan_items WHERE plan_id = ? AND updated_at <> created_at", planId).n;
      const cheques = store.get("SELECT COUNT(*) AS n FROM cheques WHERE plan_id = ? AND deleted_at IS NULL", planId).n;
      if (foreign || touchedItems || cheques || plan.updatedAt !== plan.createdAt) out.push(plan.name);
    }
    for (const link of undo.links || []) {
      const plan = store.get("SELECT name, case_key AS caseKey FROM plans WHERE id = ?", link.planId);
      if (plan && plan.caseKey !== link.caseKey) out.push(plan.name);
    }
    return out;
  }
  router.post("/api/workspace/plans/imports/:id/undo", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const batch = store.get("SELECT id, kind, title, undo_json AS undoJson, undone_at AS undoneAt FROM plan_imports WHERE id = ?", limited(params.id, 120, "Aktarım"));
    if (!batch) throw new HttpError(404, "Aktarım bulunamadı.");
    if (batch.undoneAt) throw new HttpError(409, "Bu aktarım zaten geri alındı.");
    let undo;
    try {
      undo = JSON.parse(batch.undoJson || "{}");
    } catch {
      throw new HttpError(409, "Aktarımın geri alma bilgisi okunamadı.");
    }
    const blocked = blockers(undo);
    if (blocked.length) throw new HttpError(409, `Aktarımdan sonra ${blocked.length} kartta işlem yapılmış (${blocked.slice(0, 5).join(", ")}${blocked.length > 5 ? "…" : ""}). Geri almak için önce bu işlemleri kaldırın ya da kartları tek tek silin.`, { code: "touched", names: blocked.slice(0, 50) });
    // v2.0.26 (gözden geçirme G6): aktarımın açtığı kartın Kayıt Tarihi, açılışı ya da taşınan kayıt tahsilatı kapanmış dönemdeyse geri
    // alınmaz (kilitli dönemin cari borcu, taksit hareketi ve kayıt tahsilatı değişirdi; önceden kapıda nedensiz 409).
    const lock = period?.lockedUntil?.() || "";
    if (lock) {
      const hits = [];
      for (const planId of undo.plans || []) {
        const plan = store.get("SELECT name, registered_on AS registeredOn, covers_balance AS covers FROM plans WHERE id = ?", planId);
        const entry = store.get("SELECT MIN(date) AS day FROM plan_entries WHERE plan_id = ?", planId)?.day || "";
        const day = [plan && !plan.covers ? plan.registeredOn : "", entry].filter(Boolean).sort()[0] || "";
        if (plan && day && day <= lock) hits.push(`${plan.name}, ${dayText(day)}`);
      }
      for (const moved of undo.payments || []) {
        if (moved.row?.date && moved.row.date <= lock) hits.push(`${moved.row.case_title || "kayıt tahsilatı"}, ${dayText(moved.row.date)}`);
        // 2. gözden geçirme İ1: tahsilat kapanmış dönemde kapatılmış (bağlanan bağsız) karta taşındıysa geri almak kartın vazgeçilen
        // kalanını (689, kilitli mizan) değiştirir; önceden kapıda nedensiz 409 ledger-integrity.
        const entry = moved.entryId ? store.get("SELECT e.plan_id AS planId, p.name FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE e.id = ?", moved.entryId) : null;
        const closedOn = entry ? plans()?.closeDayOf?.(entry.planId) || "" : "";
        if (closedOn && closedOn <= lock) hits.push(`${entry.name}, ${dayText(closedOn)} tarihinde kapatıldı`);
      }
      if (hits.length) throw new HttpError(409, `Bu aktarımın kartlarında ya da taşınan tahsilatlarında kapatılmış (kilitli) döneme (${dayText(lock)} ve öncesi) düşen kayıt var (${[...new Set(hits)].slice(0, 5).join("; ")}); aktarım geri alınamaz. Gerekirse yönetici dönem kilidini açmalı.`, { code: "period-locked", lockedUntil: lock });
    }
    const report = { plans: 0, links: 0, payments: 0, accounts: 0, accountsKept: 0 };
    // v2.1.0 (bank.post op 'move'): geri dönen kayıt tahsilatı karttaki satırın işlem başlığıyla döner (İşlem No ve yol aynı).
    bank.post({ user, module: "plan", op: "move", prev: { importId: batch.id, payments: undo.payments || [] }, write: () => {
      // Karta taşınan kayıt tahsilatları kayıt kartına aynen döner (kimlik, tarih, giren kişi).
      for (const moved of undo.payments || []) {
        const moving = store.get("SELECT event_id AS e, fin_ref AS f FROM plan_entries WHERE id = ?", moved.entryId) || {};
        const movedEvent = moving.e || "";
        store.run("DELETE FROM plan_entries WHERE id = ?", moved.entryId);
        const row = moved.row || {};
        if (row.id && !store.get("SELECT 1 AS found FROM payments WHERE id = ?", row.id)) {
          // v2.0.26 (A2): ödeme yolu da döner (önceden yazılmıyor, havale/POS tahsilatı kayda nakit olarak dönüyordu).
          const method = methodInput(row.method);
          // GG2 (K13/7): banka hesabı bağı da döner (karttaki satırın bugünkü bağı; kart silindiyse aktarımdaki satırınki).
          const finRef = bank.keepRef(moving.f ?? row.fin_ref, { method, date: row.date }).ref;
          store.run(
            "INSERT INTO payments (id, case_key, case_title, amount, date, note, method, fin_ref, event_id, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            row.id, row.case_key, row.case_title || "", row.amount, row.date, row.note || "", method, finRef, bank.eventFor("payments", { date: row.date, method, event_id: movedEvent || row.event_id || "" }), row.created_by, row.created_at, row.updated_by || null, row.updated_at || null,
          );
          report.payments += 1;
        }
      }
      for (const planId of undo.plans || []) {
        store.run("DELETE FROM plan_entries WHERE plan_id = ?", planId);
        store.run("DELETE FROM plan_items WHERE plan_id = ?", planId);
        store.run("DELETE FROM plans WHERE id = ? AND import_id = ?", planId, batch.id);
        report.plans += 1;
      }
      for (const link of undo.links || []) {
        store.run(`UPDATE plans SET ${FREEZE_CLOSE}, case_key = '', case_source = '', case_title = '', updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ?`, user.id, now(), link.planId, link.caseKey);
        report.links += 1;
      }
      for (const link of undo.accountLinks || []) store.run("UPDATE accounts SET case_key = '', case_source = '', case_title = '', updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ?", user.id, now(), link.accountId, link.caseKey);
      // Aktarımın açtığı cari: başka hareketi, kartı ya da evrakı yoksa kaldırılır; varsa kalır.
      for (const accountId of undo.accounts || []) {
        const used = store.get("SELECT (SELECT COUNT(*) FROM account_entries WHERE account_id = ?) + (SELECT COUNT(*) FROM plans WHERE account_id = ?) + (SELECT COUNT(*) FROM cheques WHERE account_id = ? OR endorse_account_id = ?) AS n", accountId, accountId, accountId, accountId).n;
        if (used) report.accountsKept += 1;
        else {
          store.run("DELETE FROM accounts WHERE id = ?", accountId);
          report.accounts += 1;
        }
      }
      for (const groupIdValue of [...(undo.groups || [])].reverse()) {
        const used = store.get("SELECT (SELECT COUNT(*) FROM plans WHERE group_id = ? OR subgroup_id = ?) + (SELECT COUNT(*) FROM plan_groups WHERE parent_id = ?) AS n", groupIdValue, groupIdValue, groupIdValue).n;
        if (!used) store.run("DELETE FROM plan_groups WHERE id = ?", groupIdValue);
      }
      store.run("UPDATE plan_imports SET undone_by = ?, undone_at = ? WHERE id = ?", user.id, now(), batch.id);
      audit(user, "plan.import-undone", batch.id, { ...report, title: batch.title });
    } });
    publish(user, { kind: "plans" });
    publish(user, { kind: "accounts" });
    publish(user, { kind: "cash" });
    publish(user, { kind: "dues", datasetKey: undo.source || "" });
    ok(res, report);
  });

  return { analyze: options => analyze(optionsOf(options || {})) };
}
