// Şirketler (v2.0.17): liste, seçim, açma, adlandırma, yetki, silme, veri sıfırlama ve şirketler arası birleşik rapor.
// Yalnız hub'da (ortak katman) kayıtlıdır; her şirketin verisi kendi örneğinden (appFor) okunur.
import { verifyPassword } from "../lib/passwords.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { separateCompany } from "../lib/company-separate.mjs";
import { systemClock } from "../lib/clock.mjs";
import { canUser } from "../lib/permissions.mjs";
import { K10_LABELS } from "../lib/bank/accounts.mjs";

export function registerCompanyRoutes(router, { store, auth, audit, companies, appFor, resetData, config, events, backups, closeCompany, busyCompanies, withCompanyDb, log, now: clock = systemClock }) {
  const requireManage = req => auth.requirePermission(req, "system.manage");
  // Geri yüklenen ya da silinen şirkette aynı anda ikinci işlem (ad değiştirme, sıfırlama, silme) yapılmaz.
  const notBusy = company => {
    if (busyCompanies?.has(company.id)) throw new HttpError(409, busyCompanies.get(company.id) || "Bu şirkette başka bir işlem sürüyor; birkaç saniye sonra yeniden deneyin.");
  };
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const shape = (user, company) => {
    const current = companies.selectedFor(user);
    return { id: company.id, code: company.code, name: company.name, label: company.label, root: company.root, current: company.id === current, createdAt: company.createdAt };
  };
  // Parola onayı (silme / sıfırlama): yöneticinin kendi parolası.
  const confirmPassword = (user, password) => {
    const row = store.get("SELECT password_hash AS hash FROM users WHERE id = ?", user.id);
    if (!row || !verifyPassword(String(password || ""), row.hash)) throw new HttpError(403, "Parola doğrulanamadı; işlem yapılmadı.", { code: "password" });
  };
  const confirmCode = (company, value) => {
    const typed = text(value);
    if (typed !== company.code && typed.toLocaleLowerCase("tr-TR") !== company.name.toLocaleLowerCase("tr-TR")) throw new HttpError(400, `Onay için şirket kodunu (${company.code}) ya da adını yazın.`, { code: "confirm" });
  };

  // Veri dosyası paylaşan şirketler (v2.0.21): kullanıcının görebildiği şirketleri içeren gruplar.
  const conflictsFor = user =>
    companies
      .conflicts()
      .filter(group => group.companies.some(item => companies.canAccess(user, item.id)))
      .map(group => ({
        keeper: group.keeper,
        // Yetkisi olmayan şirketin adı gösterilmez; yalnız paylaşım olduğu söylenir.
        companies: group.companies.map(item => (companies.canAccess(user, item.id) ? { id: item.id, code: item.code, name: item.name, label: item.label, keeper: item.keeper } : { id: "", code: "", name: "", label: "erişiminiz olmayan bir şirket", keeper: item.keeper, hidden: true })),
      }));
  router.get("/api/companies", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const manage = Boolean(user.permissions?.includes?.("system.manage")) || user.role === "admin";
    ok(res, { current: companies.selectedFor(user), companies: companies.listFor(user), all: manage ? companies.list().map(item => shape(user, item)) : undefined, canManage: manage, nextCode: manage ? companies.nextCode() : "", limit: manage ? companies.limit() : undefined, conflicts: conflictsFor(user) });
  });
  // Ayır (v2.0.21): ortak veri dosyasını kullanan şirketi kendi klasörüne alır (önce yedek; kayıt silinmez). Onay: kod/ad + parola.
  router.post("/api/companies/:id/separate", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const company = companies.require(params.id);
    if (!companies.canAccess(user, company.id)) throw new HttpError(404, "Şirket bulunamadı ya da bu şirketi görme yetkiniz yok.");
    confirmCode(company, body.confirm);
    confirmPassword(user, body.password);
    const group = companies.conflictOf(company.id);
    const result = await separateCompany({ registry: companies, backups, withDb: withCompanyDb, closeCompany, busy: busyCompanies, dataDir: config.dataDir, id: company.id, log });
    // Unvan (gözden geçirme bulgusu): paylaşım döneminde iki şirketin ad değişiklikleri aynı dosyaya yazıldı; ayrılan da
    // dosyayı koruyan da kendi kayıttaki adını alır (rapor/PDF başlıkları doğru şirketle basılır).
    for (const id of [company.id, group?.keeper].filter(Boolean)) {
      const item = companies.get(id);
      try {
        if (item) appFor(item).store.setSetting("office.name", item.name, user.id);
      } catch (error) {
        log?.warn?.(`Unvan yazılamadı (${item?.label}): ${error.message}`);
      }
    }
    audit(user, "company.separated", company.id, { code: company.code, name: company.name, from: result.from, to: result.to, backup: result.backup, sharedWith: result.sharedWith });
    publish(user, { kind: "companies" });
    ok(res, { company: shape(user, result.company), backup: result.backup, sharedWith: result.sharedWith, conflicts: conflictsFor(user) });
  });
  router.post("/api/companies/select", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const body = await readJson(req);
    const company = companies.select(user, text(body.id));
    audit(user, "company.selected", company.id, { code: company.code, name: company.name });
    ok(res, { current: company.id, company: shape(user, company) });
  });
  router.post("/api/companies", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const company = companies.create(user, { code: text(body.code), name: text(body.name) });
    // Veri tabanı hemen açılır (göçler koşar); unvan ofis adı olarak yazılır.
    const app = appFor(company);
    app.store.setSetting("office.name", company.name, user.id);
    audit(user, "company.created", company.id, { code: company.code, name: company.name });
    if (body.select) companies.select(user, company.id);
    publish(user, { kind: "companies" });
    ok(res, { company: shape(user, company), companies: companies.listFor(user) });
  });
  router.put("/api/companies/:id", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const before = companies.require(params.id);
    notBusy(before);
    const company = companies.update(user, before.id, { name: body.name !== undefined ? text(body.name) : undefined, code: body.code !== undefined ? text(body.code) : undefined });
    if (body.name !== undefined) appFor(company).store.setSetting("office.name", company.name, user.id);
    audit(user, "company.updated", company.id, { from: { code: before.code, name: before.name }, to: { code: company.code, name: company.name } });
    publish(user, { kind: "companies" });
    ok(res, { company: shape(user, company), companies: companies.listFor(user) });
  });
  router.delete("/api/companies/:id", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const company = companies.require(params.id);
    notBusy(company);
    if (company.root) throw new HttpError(409, "001 kodlu ilk şirket silinemez; verisini sıfırlayabilirsiniz.");
    // v2.0.21: veri dosyası paylaşan şirket silinirse ortak klasör taşınır ve öbür şirket verisiz kalır; önce Ayır.
    backups.assertNotShared(company, "silme");
    confirmCode(company, body.confirm);
    confirmPassword(user, body.password);
    // Önce yedek (şirketin kendi yedek klasörüne: <kod> - <ad>), sonra örnek kapatılır ve veri klasörü silinen-sirketler
    // altına taşınır. Yedek klasörü yerinde kalır (v2.0.20). Bu sırada şirkete gelen istek 503 alır (yeniden açılmaz).
    busyCompanies?.set(company.id, `“${company.code} · ${company.name}” siliniyor.`);
    let backup = "";
    let removed;
    try {
      await closeCompany?.(company.id);
      try {
        backup = backups.backup(company, { label: `silme-oncesi-${company.code}`, keep: 100 })?.name || "";
      } catch (error) {
        throw new HttpError(500, `Silme öncesi yedek alınamadı; şirket silinmedi (${error.message}).`);
      }
      removed = companies.remove(user, company.id);
    } finally {
      busyCompanies?.delete(company.id);
    }
    audit(user, "company.deleted", company.id, { code: company.code, name: company.name, backup, archivedTo: removed.archivedTo });
    publish(user, { kind: "companies" });
    ok(res, { deleted: company.id, backup, companies: companies.listFor(user) });
  });
  // Kullanıcı yetkisi: hangi şirketleri görür (yönetici hepsini görür).
  router.get("/api/companies/access", async ({ req, res }) => {
    requireManage(req);
    const users = store.all("SELECT id, username, display_name AS name, role FROM users WHERE deleted_at IS NULL AND active = 1 ORDER BY display_name");
    ok(res, { companies: companies.list().map(item => ({ id: item.id, code: item.code, name: item.name })), users: users.map(user => ({ ...user, companies: user.role === "admin" ? "*" : companies.accessOf({ id: user.id, role: user.role }) })) });
  });
  // Yönetim → Şirketler (v2.0.20): her şirketin veri dosyası (yol, boyut), cari ve kayıt sayısı, son yedeği ve yedek
  // klasörü. Açılmamış şirketin dosyası kısa süreliğine salt okunur açılıp kapatılır (şirket örneği açılmaz).
  router.get("/api/companies/storage", async ({ req, res }) => {
    const user = requireManage(req);
    ok(res, { backupRoot: backups.root(), companies: companies.list().filter(item => companies.canAccess(user, item.id)).map(item => backups.storage(item)) });
  });
  router.put("/api/companies/access/:userId", async ({ req, res, params }) => {
    const admin = requireManage(req);
    const body = await readJson(req);
    const target = store.get("SELECT id, role, display_name AS name FROM users WHERE id = ? AND deleted_at IS NULL", limited(params.userId, 120, "Kullanıcı"));
    if (!target) throw new HttpError(404, "Kullanıcı bulunamadı.");
    if (target.role === "admin") throw new HttpError(409, "Yönetici bütün şirketleri görür; yetkisi daraltılamaz.");
    const ids = companies.setAccess(admin, target.id, body.companies);
    audit(admin, "company.access", target.id, { user: target.name, companies: ids });
    ok(res, { userId: target.id, companies: ids });
  });
  // Şirket verisini sıfırla (m6): zorunlu yedek + onay (kod/ad + parola).
  router.post("/api/companies/:id/reset", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const company = companies.require(params.id);
    notBusy(company);
    backups.assertNotShared(company, "sıfırlama");
    confirmCode(company, body.confirm);
    confirmPassword(user, body.password);
    const result = resetData(company, user, { mode: text(body.mode) || "movements", resetNumbers: body.resetNumbers !== false });
    audit(user, "company.reset", company.id, { code: company.code, ...result });
    publish(user, { kind: "reset" });
    ok(res, { company: shape(user, company), ...result });
  });

  // ---------- Birleşik rapor (m2 kararı: ilk sürümde) ----------
  // Seçilen şirketlerin Kasa, banka, cari alacak/borç, stok değeri, açık fatura ve çek/senet toplamları yan yana + toplam.
  // v2.1.0 Aşama 14 (K10; plan §8.9): eski tek "Banka / POS" sütunu yerine ANLIK DURUM ve Banka Genel Bakış'la AYNI adlarla ayrı sütunlar:
  // Gerçek Banka, Kart ve Kredi Borcu, Hesabı Atanmamış Eski Hareketler (POS Bekleyen ve Blokeli POS 2.2.0'da, POS ile). Banka sütunları yalnız
  // Banka Görüntüleme ya da Finans Raporları yetkisi olana dolu döner (öbürüne boş: "—"); öbür sütunların yetkisi ayrı karar (plan §11.2).
  const bankVisible = user => canUser(user, "bank.view") || canUser(user, "overview.view");
  function buildReport(user, ids) {
    const allowed = companies.listFor(user);
    const chosen = ids.length ? allowed.filter(item => ids.includes(item.id)) : allowed;
    if (!chosen.length) throw new HttpError(400, "Rapor için en az bir şirket seçin (yetkili olduğunuz şirketler).");
    const showBank = bankVisible(user);
    const rows = chosen.map(item => {
      const app = appFor(companies.get(item.id));
      const view = app.context.overview?.compute?.() || {};
      const bank = view.cash?.bank || {};
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        cash: view.cash?.balance ?? 0,
        realBank: showBank ? (bank.balance ?? 0) : null,
        bankDebt: showBank ? (bank.debt?.total ?? 0) : null,
        bankUnassigned: showBank ? (bank.unassigned?.total ?? 0) : null,
        receivable: view.receivable?.total ?? 0,
        payable: view.payable?.total ?? 0,
        overdue: view.receivable?.overdue ?? 0,
        stock: view.stock?.value ?? 0,
        invoiceOpenSale: view.invoices?.openSale ?? 0,
        invoiceOpenPurchase: view.invoices?.openPurchase ?? 0,
        monthSale: view.invoices?.month?.sale ?? 0,
        monthPurchase: view.invoices?.month?.purchase ?? 0,
      };
    });
    const sum = key => (rows.some(row => row[key] !== null) ? roundMoney(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)) : null);
    const headers = ["Şirket", "Nakit Kasa", K10_LABELS.realBank, K10_LABELS.debt, K10_LABELS.unassigned, "Cari Alacak", "Cari Borç", "Geciken Taksit", "Stok Değeri", "Açık Satış Faturası", "Açık Alış Faturası", "Bu Ay Satış", "Bu Ay Alış"];
    const keys = ["cash", "realBank", "bankDebt", "bankUnassigned", "receivable", "payable", "overdue", "stock", "invoiceOpenSale", "invoiceOpenPurchase", "monthSale", "monthPurchase"];
    const table = rows.map(row => [`${row.code} · ${row.name}`, ...keys.map(key => row[key])]);
    const totals = ["TOPLAM", ...keys.map(sum)];
    return { headers, keys, rows, table, totals, types: ["", ...keys.map(() => "money")], labels: K10_LABELS, bankVisible: showBank, generatedAt: clock().toISOString() };
  }
  // Yetkisiz banka sütunu (null) PDF ve Excel'de "—".
  const moneyCell = value => (value === null || value === undefined ? "—" : tl(value));
  const idsOf = url => text(url.searchParams.get("ids")).split(",").map(value => value.trim()).filter(Boolean);
  router.get("/api/companies/report", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    ok(res, buildReport(user, idsOf(url)));
  });
  router.get("/api/companies/report.pdf", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    const report = buildReport(user, idsOf(url));
    const pdf = tablePdf({
      now: clock(),
      title: "Şirketler Birleşik Raporu",
      subtitle: `${report.rows.length} şirket · ${clock().toLocaleDateString("tr-TR")}`,
      headers: report.headers,
      types: ["text", ...report.keys.map(() => "money")],
      rows: [...report.table.map(row => row.map((cell, index) => (index ? moneyCell(cell) : cell))), report.totals.map((cell, index) => (index ? moneyCell(cell) : cell))],
      summary: [["Şirket", String(report.rows.length)], ["Toplam Nakit Kasa", tl(report.totals[1])], ...(report.bankVisible ? [[`Toplam ${K10_LABELS.realBank}`, tl(report.totals[2])]] : []), ["Toplam Cari Alacak", tl(report.totals[report.keys.indexOf("receivable") + 1])], ["Toplam Cari Borç", tl(report.totals[report.keys.indexOf("payable") + 1])]],
      officeName: store.setting("office.name", ""),
      userName: user.display_name || user.username || "",
      brand: config.productName,
    });
    sendBuffer(res, pdf, { type: "application/pdf", name: "Sirketler Birlesik Raporu.pdf", inline: url.searchParams.get("inline") === "1" });
  });
  router.get("/api/companies/report.xlsx", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    const report = buildReport(user, idsOf(url));
    const columns = report.headers;
    const rowsOf = row => Object.fromEntries(columns.map((column, index) => [column, row[index] === null ? "—" : row[index]]));
    const xlsx = buildXlsx([{ name: "Birleşik Rapor", columns, rows: [...report.table.map(rowsOf), rowsOf(report.totals)] }], { now: clock(), title: "Şirketler Birleşik Raporu" });
    sendBuffer(res, xlsx, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Sirketler Birlesik Raporu.xlsx" });
  });
}
