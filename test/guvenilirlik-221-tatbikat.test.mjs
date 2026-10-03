// YEDEK TATBİKATI (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 3). Gerçek veri üzerinde: v2.0.16 → … → v2.0.19 zincirinin
// gerçek koduyla üretilmiş kurulum (test/fixtures/surum-2.0.19-zincir) güncel sürümle açılır. 001 ve 002 için:
//   veri gir (cari, satış faturası — biri taksitli, tahsilat, Kasa, taksit kartı) → yedek → çalışmaya devam (başka veri) →
//   geri yükle → bütün sayılar yedek anındaki gibi → geri yüklenen veride yeniden çalış (yeni kayıt, rapor) → yeniden yedek →
//   yeniden geri yükle → sayılar ikinci yedeğin anındaki gibi.
// Ayrıca ESKİ SÜRÜMÜN aldığı yedekler (v2.0.19 ve v2.0.16 kodunun kendi yedek ucuyla, eski yerde ve kimliksiz) geri yüklenir:
// veri o sürümün yedek anındakiyle bire bir; geri yüklenen veride çalışmaya devam edilir. Öbür şirketler hiç değişmez.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { apiFacts, dbFacts, expectedFacts, knownFacts } from "./guvenilirlik/olgular.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

describe("yedek tatbikatı: gerçek v2.0.19 verisinde 001 ve 002", () => {
  let fixture;
  let server;
  let api;
  let today;
  const manifest = () => fixture.fixture;
  const restart = async () => {
    await server.close();
    server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir });
    api = await server.login();
  };
  const select = async id => assert.equal((await api.post("/api/companies/select", { id })).status, 200);
  const facts = async id => {
    await select(id);
    const entry = readRegistry(fixture.dataDir).find(item => item.id === id);
    return { db: dbFacts(companyDbFile(fixture.dataDir, entry)), api: await apiFacts(api) };
  };
  const others = async id => {
    const out = {};
    for (const company of manifest().final.filter(item => item.id !== id)) out[company.id] = (await facts(company.id)).db;
    return out;
  };
  const ok = async (promise, what) => {
    const response = await promise;
    assert.equal(response.status, 200, `${what}: ${JSON.stringify(response.data).slice(0, 300)}`);
    return response.data;
  };
  // Bir tur iş: cariler, satış faturaları (açık, peşin, taksitli), tahsilat, Kasa, taksit kartı ve tahsilatı.
  let turn = 0;
  const work = async (id, label) => {
    await select(id);
    turn += 1;
    const accounts = [];
    for (let i = 0; i < 3; i += 1) accounts.push(await ok(api.post("/api/workspace/accounts", { name: `${label} Cari ${turn}-${i} Şükrü Öztürk`, type: "customer" }), "cari"));
    await ok(api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: accounts[0].id, issueDate: today, lines: [{ name: "Danışmanlık Hizmeti", qty: 2, unitPrice: 750, vatRate: 20 }], payment: { rest: "open" } }), "açık fatura");
    await ok(api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: accounts[1].id, issueDate: today, lines: [{ name: "Eğitim Hizmeti", qty: 1, unitPrice: 1200, vatRate: 10 }], payment: { cash: [{ amount: 500, method: "cash" }], rest: "open" } }), "peşinli fatura");
    await ok(api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: accounts[2].id, issueDate: today, lines: [{ name: "Yazılım Lisansı", qty: 1, unitPrice: 6000, vatRate: 20 }], payment: { rest: "installments", installments: { count: 4, firstDue: today, everyMonths: 1 } } }), "taksitli fatura");
    await ok(api.post(`/api/workspace/accounts/${accounts[0].id}/entries`, { kind: "in", amount: 250.5, method: "cash", note: "Tahsilat" }), "tahsilat");
    await ok(api.post("/api/workspace/cash", { kind: "in", amount: 333.33, description: "Elden tahsilat" }), "Kasa");
    const plan = await ok(api.post("/api/workspace/plans", { accountId: accounts[1].id, name: accounts[1].name, total: "9000", mode: "auto", count: 3, firstDue: today }), "taksit kartı");
    await ok(api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "3000", date: today, method: "cash" }), "taksit tahsilatı");
    return accounts;
  };
  const restore = async (id, code, name) => {
    const data = await ok(api.post("/api/admin/backups/restore", { name, company: id, confirm: code, password: ADMIN_PASSWORD }), `geri yükle ${name}`);
    if (data.staged) {
      await restart();
      assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
    } else assert.equal(data.restored, true);
    return data;
  };

  before(async () => {
    fixture = unpackFixture("surum-2.0.19-zincir");
    server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir });
    api = await server.login();
    today = (await api.get("/api/workspace/accounts?limit=1")).data.today;
  });
  after(async () => {
    await server?.close();
    fixture?.cleanup();
  });

  for (const code of ["001", "002"]) {
    test(`${code}: veri gir → yedek → çalış → geri yükle → sayılar → yeniden çalış → yedek → geri yükle`, async () => {
      const company = manifest().final.find(item => item.code === code);
      assert.ok(company, `${code} fikstürde var`);
      const first = await facts(company.id);
      assert.deepEqual(knownFacts(first.db, company.facts), expectedFacts(company.facts), "açılışta veri v2.0.19'un bıraktığı gibi");
      await work(company.id, "Tatbikat");
      const moment1 = await facts(company.id);
      assert.ok(moment1.db.invoices > company.facts.invoices && moment1.db.plans > company.facts.plans, "yeni fatura ve taksit kartı girildi");
      const backup1 = (await ok(api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name;
      const othersBefore = await others(company.id);

      await work(company.id, "Yedekten Sonra");
      assert.notDeepEqual((await facts(company.id)).db, moment1.db, "yedekten sonra veri değişti");
      await restore(company.id, company.code, backup1);
      const restored1 = await facts(company.id);
      assert.deepEqual(restored1.db, moment1.db, "geri yükleme: kayıt sayıları ve tutarlar yedek anındaki gibi (cari, Kasa, fatura, taksit)");
      assert.deepEqual(restored1.api, moment1.api, "geri yükleme: ekrandaki cari listesi yedek anındaki gibi");
      assert.deepEqual(await others(company.id), othersBefore, "öbür şirketler değişmedi");

      // Geri yüklenen veride yeniden çalış: yeni kayıtlar ve rapor.
      const added = await work(company.id, "Geri Yüklemeden Sonra");
      const report = (await ok(api.get("/api/workspace/report-center/cari-listesi"), "Cari Listesi raporu"));
      const listed = (await apiFacts(api)).accounts.count;
      assert.equal(report.total, listed, "rapor bütün carileri sayar");
      const search = await ok(api.get(`/api/workspace/accounts?status=all&q=${encodeURIComponent(added[0].name)}`), "arama");
      assert.deepEqual(search.accounts.map(item => item.name), [added[0].name], "geri yüklemeden sonra girilen cari bulunur");
      const moment2 = await facts(company.id);
      const backup2 = (await ok(api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "ikinci yedek")).backups[0].name;
      await work(company.id, "İkinci Yedekten Sonra");
      await restore(company.id, company.code, backup2);
      const restored2 = await facts(company.id);
      assert.deepEqual(restored2.db, moment2.db, "ikinci geri yükleme: sayılar ikinci yedeğin anındaki gibi");
      assert.deepEqual(restored2.api, moment2.api);
      assert.deepEqual(await others(company.id), othersBefore, "öbür şirketler yine değişmedi");
      // Bu şirketin yeni durumu sonraki testler için.
      company.facts = restored2.db;
      company.api = restored2.api;
    });
  }

  for (const [version, code] of [["v2.0.19", "002"], ["v2.0.19", "001"], ["v2.0.16", "001"], ["v2.0.17", "007"]]) {
    test(`eski sürümün (${version}) kendi aldığı yedek ${code} şirketine geri yüklenir; veri o anki gibi; çalışmaya devam`, async () => {
      const company = manifest().final.find(item => item.code === code);
      const record = manifest().backups.filter(item => item.version === version && item.companyId === company.id).at(-1);
      assert.ok(record, `${version} ${code} yedeği manifestte`);
      assert.ok(!/destekofis-\d{3}-/.test(record.file), "eski biçim: adında şirket kodu yok");
      const othersBefore = await others(company.id);
      const listing = (await api.get("/api/admin/backups")).data.filter(item => item.name === record.file);
      assert.deepEqual(listing.map(item => item.companyId), [company.id], "eski yedek listede yalnız kendi şirketinin altında");
      await restore(company.id, company.code, record.file);
      const now = await facts(company.id);
      assert.deepEqual(knownFacts(now.db, record.facts), expectedFacts(record.facts), `${version}'un yedek anındaki veri`);
      assert.deepEqual(now.api, record.api, `${version}'un yedek anında ekranda görünen cari listesi`);
      assert.deepEqual(await others(company.id), othersBefore, "öbür şirketler değişmedi");
      await work(company.id, `Eski Yedekten Sonra ${version}`);
      const after = await facts(company.id);
      assert.equal(after.db.accounts, record.facts.accounts + 3);
      assert.equal(after.db.invoices, record.facts.invoices + 3);
    });
  }
});
