// 2.1.0 Aşama 16 — Arıza ve yedek tatbikatı BANKA VERİSİYLE (plan §12.3 Aşama 16 "Arıza: … sihirbaz ve göç ortasında kesinti; disk dolu; kilitli
// dosya", "Yedek tatbikatı"; §12.4 "Eski sürüm ve arıza"; CLAUDE.md test kuralı: yedek → çalış → geri yükle → sayılar → yeniden çalış).
// guvenilirlik-221-ariza/-tatbikat aynı arızaları banka verisi OLMADAN (v2.0.19 fikstürü) sınıyordu; burada iki şirketin ikisinde de banka hesabı,
// açılış, Banka Fişi, bankalar arası transfer ve modüllerden hesaba bağlı havale (cari, fatura peşini, kayıt, taksit, stok) var.
//
// Nasıl bozarım:
//   A1  Kurulum Sihirbazı (eski hareketleri hesaba bağla + Devir Kapanışı) işlemin son yazımında SIGKILL → yeniden açılışta hiçbir parça yok
//       (bağ, Devir Kapanışı fişi, kurulum kaydı, işlem geçmişi, istek kaydı); aynı istek kimliğiyle yeniden çalışır, İşlem No boşluksuz
//   A2  Yedek alırken disk dolu → açık hata; canlı banka verisi aynı; yer açılınca yedek alınır
//   A3  Geri yükleme ortasında EIO / EBUSY → 500; şirketin banka verisi aynı; hata geçince geri yükleme yedek anına döner
//   A4  Başka program şirketin veri dosyasını kilitlemiş → banka uçları 503 company-unavailable (001'e düşmez); kilit kalkınca bakiyeler aynı
//   A5  Yedek tatbikatı (002): hesaba bağlı veri → yedek → çalış (transfer, havale, fiş, peşinli fatura) → geri yükle → bütün banka sayıları yedek
//       anındaki → geri yüklenen veride yeniden çalış → yeniden yedek → yeniden geri yükle → ikinci anın sayıları; 001 hiç değişmez
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createClient, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "banka-210-post-kesinti-cocuk.mjs");
const pad = n => String(n).padStart(2, "0");
const dayOf = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = dayOf(0);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
function inject(name, when, makeError) {
  const original = fs[name];
  fs[name] = function patched(...args) {
    if (when(...args)) throw makeError(...args);
    return original.apply(this, args);
  };
  syncBuiltinESMExports();
  return () => {
    fs[name] = original;
    syncBuiltinESMExports();
  };
}
const fsError = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

/** Şirketin banka "fotoğrafı": hesap bakiyeleri, alt hesap mizanı, Gerçek Banka, Kasa, cari bakiyeleri, olay sayısı, Mutabakat Testi. */
async function bankFacts(api, q = "") {
  const join = url => `${url}${q ? `${url.includes("?") ? "&" : "?"}${q}` : ""}`;
  const accounts = (await must("hesaplar", api.get(join("/api/workspace/bank/accounts?status=all")))).accounts.map(item => [item.label, item.balanceMinor]).sort();
  const subs = (await must("alt hesap", api.get(join("/api/workspace/bank/sub-trial")))).rows.map(row => [row.sub, row.balance]).sort();
  const summary = await must("özet", api.get(join("/api/workspace/bank/summary")));
  const cash = await must("Kasa", api.get(join("/api/workspace/cash")));
  const parties = (await must("cariler", api.get(join("/api/workspace/accounts?status=all&limit=500")))).accounts.map(item => [item.name, item.balance]).sort();
  const movements = (await must("hareketler", api.get(join("/api/workspace/bank/movements?limit=500")))).rows.length;
  const integrity = await must("Mutabakat Testi", api.get(join("/api/workspace/ledger/integrity")));
  return { accounts, subs, realBank: summary.realBank?.minor ?? null, cash: cash.totals.balance, parties, movements, integrity: integrity.ok };
}

/** Banka verisi: iki hesap, açılış, fiş, transfer ve modüllerden bağlı havale. tag: adların öneki. q: ?hofCompany=. */
async function bankWork(api, tag, q = "") {
  const at = url => `${url}${q ? `${url.includes("?") ? "&" : "?"}${q}` : ""}`;
  const open = (bankName, amount) => must(`${tag} ${bankName}`, api.post(at("/api/workspace/bank/accounts"), { bankName, name: `${tag} Ana TL`, kind: "demand", opening: { date: dayOf(-30), amount, confirmed: true } }));
  const z = await open("Ziraat Bankası", "100.000");
  const g = await open("Garanti BBVA", "50.000");
  const party = await must("cari", api.post(at("/api/workspace/accounts"), { name: `${tag} Müşteri`, type: "customer", registeredOn: dayOf(-40) }));
  await must("havale tahsilat", api.post(at(`/api/workspace/accounts/${party.id}/entries`), { kind: "in", amount: "12.345,67", method: "bank", bankAccountId: z.id, date: dayOf(-5) }));
  await must("peşinli fatura", api.post(at("/api/workspace/invoices"), { kind: "sale", accountId: party.id, issueDate: dayOf(-4), pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 6000, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: "6.000", method: "bank", bankAccountId: g.id }], cheques: [], endorse: [], rest: "open" }, force: true }));
  await must("kayıt tahsilatı", api.post(at(`/api/workspace/cases/${tag}-K1/payments`), { amount: "700", date: dayOf(-3), method: "bank", bankAccountId: g.id, caseTitle: `${tag} Kayıt` }));
  const plan = await must("kart", api.post(at("/api/workspace/plans"), { accountId: party.id, name: `${tag} Kart`, total: "9.000", mode: "auto", count: 3, firstDue: dayOf(10) }));
  await must("taksit tahsilatı", api.post(at(`/api/workspace/plans/${plan.id}/entries`), { kind: "in", amount: "3.000", method: "bank", bankAccountId: z.id, date: dayOf(-2) }));
  const item = await must("ürün", api.post(at("/api/workspace/stock"), { name: `${tag} Ürün`, unit: "Adet", openingQty: "10" }));
  await must("stok satışı", api.post(at(`/api/workspace/stock/${item.id}/moves`), { kind: "out", qty: "2", unitPrice: "450", pay: "cash", method: "bank", bankAccountId: z.id, date: dayOf(-2) }));
  await must("masraf", api.post(at("/api/workspace/bank/vouchers"), { type: "fee", accountId: z.id, date: dayOf(-1), amount: "10,50", feeType: "eft", tax: "bsmv_incl" }));
  await must("transfer", api.post(at("/api/workspace/bank/transfers"), { accountId: z.id, toAccountId: g.id, amount: "20.000", date: TODAY }));
  return { z, g, party };
}

describe("A1 — Kurulum Sihirbazı ortasında SIGKILL (elektrik kesintisi)", () => {
  const roots = [];
  after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

  it("işlem geçmişi yazılırken kesinti → bağ, Devir Kapanışı, kurulum kaydı, istek kaydı yok; aynı istek kimliğiyle yeniden çalışır; İşlem No boşluksuz", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-210-sihirbaz-kesinti-"));
    roots.push(root);
    const dataDir = path.join(root, "data");
    const marker = path.join(root, "donduruldu");
    const child = fork(CHILD, [dataDir, path.join(root, "backups"), marker, ADMIN_PASSWORD, "audit_events", "NEW.type = 'bank.setup'"], { stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
    let stderr = "";
    child.stderr.on("data", chunk => (stderr += chunk));
    const exited = new Promise(resolve => child.once("exit", resolve));
    const { port } = await new Promise((resolve, reject) => {
      child.once("message", resolve);
      child.once("exit", code => reject(new Error(`çocuk süreç açılmadı (${code}): ${stderr.slice(0, 500)}`)));
    });
    const api = apiOf(createClient(`http://127.0.0.1:${port}`));
    assert.equal((await api.client.login("admin", ADMIN_PASSWORD)).status, 200);
    // Hesap tanımlanmadan girilmiş eski hareketler: açılıştan ÖNCE (Devir Kapanışı'na girer) ve SONRA (hesaba bağlanır) birer havale.
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: dayOf(-60) }));
    const early = await must("eski havale (açılıştan önce)", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "4.000", method: "bank", date: dayOf(-40) }));
    const late = await must("eski havale (açılıştan sonra)", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "2.000", method: "bank", date: dayOf(-5) }));
    const ziraat = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: dayOf(-20), amount: "100.000", confirmed: true } }));
    const preview = await must("önizleme", api.post("/api/workspace/bank/setup?dryRun=1", { accountId: ziraat.id, carryClose: true, assign: "all" }));
    assert.equal(preview.assign.rows.length, 1, "açılıştan sonraki havale bağlanacak");
    const pending = api.post("/api/workspace/bank/setup", { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "sihirbaz-kesinti-0001-abcdef" }).catch(() => null);
    for (let i = 0; i < 200 && !existsSync(marker); i += 1) await sleep(25);
    assert.ok(existsSync(marker), "sihirbaz işlemin son yazımına (işlem geçmişi) ulaştı");
    child.kill("SIGKILL");
    await exited;
    await pending;

    const server = await startTestServer({ dataDir });
    try {
      const store = server.app.store;
      const again = apiOf(await loginAdmin(server));
      assert.equal(store.get("SELECT fin_ref FROM account_entries WHERE id = ?", late.entryId).fin_ref, "", "bağ yazılmadı");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'carry_close'").n, 0, "Devir Kapanışı fişi yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'bank.setup'").n, 0, "işlem geçmişi yok");
      assert.equal((await must("kurulumlar", again.get("/api/workspace/bank/setup"))).runs.length, 0, "kurulum kaydı yok");
      const maxNo = store.get("SELECT MAX(seq) AS n FROM fin_events").n;
      const subs = Object.fromEntries((await must("alt hesap", again.get("/api/workspace/bank/sub-trial"))).rows.map(row => [row.sub, row.balance]));
      assert.deepEqual([subs["102.00"], subs["102.01"]], [6000, 100000], "eski havaleler Hesabı Atanmamış'ta, Ziraat yalnız açılış");
      assert.equal(server.app.integrity.run().ok, true, "Mutabakat Testi tutarlı");
      // Aynı istek kimliğiyle yeniden: kesintide istek kaydı yazılmadığı için çalışır (replayed değil); numara boşluksuz.
      const run = await must("yeniden çalıştır", again.post("/api/workspace/bank/setup", { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "sihirbaz-kesinti-0001-abcdef" }));
      assert.notEqual(run.replayed, true);
      assert.equal(run.assigned, 1);
      assert.equal(run.no, `BNK-${TODAY.slice(0, 4)}-${String(maxNo + 1).padStart(6, "0")}`, "İşlem No kesintide harcanmadı");
      assert.equal(store.get("SELECT fin_ref FROM account_entries WHERE id = ?", late.entryId).fin_ref, ziraat.id);
      assert.equal(store.get("SELECT fin_ref FROM account_entries WHERE id = ?", early.entryId).fin_ref, "", "açılıştan önceki havale bağlanmaz (Devir Kapanışı'nda)");
      const after = Object.fromEntries((await must("alt hesap", again.get("/api/workspace/bank/sub-trial"))).rows.map(row => [row.sub, row.balance]));
      assert.deepEqual([after["102.00"] || 0, after["102.01"]], [0, 102000], "kurulum sonrası: Ziraat 100.000 + 2.000; Hesabı Atanmamış 0");
      const replay = await must("aynı istek", again.post("/api/workspace/bank/setup", { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "sihirbaz-kesinti-0001-abcdef" }));
      assert.equal(replay.replayed, true, "ikinci kez çalışmaz");
      assert.equal(server.app.integrity.run().ok, true);
    } finally {
      await server.close();
    }
  });
});

describe("A2–A5 — banka verili iki şirkette disk dolu, geri yükleme arızası, kilitli dosya ve yedek tatbikatı", () => {
  let server;
  let api;
  let second;
  let q2;
  let rootFacts;
  const dbFileOf = id => companyDbFile(server.dataDir, readRegistry(server.dataDir).find(item => item.id === id));
  before(async () => {
    server = await startTestServer({ maxCompanies: 2 });
    api = apiOf(await loginAdmin(server));
    await bankWork(api, "001");
    const created = await must("002", api.post("/api/companies", { name: "Banka Tatbikat Şirketi", select: false }));
    second = created.company || created;
    q2 = `hofCompany=${encodeURIComponent(second.id)}`;
    await bankWork(api, "002", q2);
    rootFacts = await bankFacts(api);
    assert.equal(rootFacts.integrity, true);
  });
  after(() => server?.close());

  it("A2: 001'in yedeği alınırken disk dolu → 500 açık hata, yarım dosya yok; 001 ve 002'nin banka verisi aynı; yer açılınca yedek alınır", async () => {
    const before002 = await bankFacts(api, q2);
    const db = server.app.db;
    const exec = db.exec;
    db.exec = function full(sql) {
      const match = /^VACUUM INTO '(.+)'$/.exec(String(sql));
      if (!match) return exec.call(this, sql);
      writeFileSync(match[1].replace(/''/g, "'"), Buffer.alloc(64 * 1024, 7));
      throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });
    };
    try {
      const response = await api.client.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(response.status, 500, JSON.stringify(response.data));
      assert.match(response.data.error, /disk is full/);
    } finally {
      db.exec = exec;
    }
    const folder = server.app.backups.folderOf(server.app.companies.get("sirket-001"));
    assert.deepEqual(existsSync(folder) ? readdirSync(folder).filter(name => name.endsWith(".yaziliyor")) : [], [], "yarım dosya kalmadı");
    assert.deepEqual(await bankFacts(api), rootFacts, "001 banka verisi aynı");
    assert.deepEqual(await bankFacts(api, q2), before002, "002 banka verisi aynı");
    await must("yer açılınca yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }));
  });

  it("A3: 002'nin geri yüklemesinde EIO ve EBUSY → 500, banka verisi aynı; hata geçince geri yükleme yedek anına döner", async () => {
    const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
    const atBackup = await bankFacts(api, q2);
    // Yedekten sonra: bankalı yeni iş (geri yüklemede kaybolmalı).
    const accounts = (await must("hesaplar", api.get(`/api/workspace/bank/accounts?${q2}`))).accounts;
    await must("yedekten sonra transfer", api.post(`/api/workspace/bank/transfers?${q2}`, { accountId: accounts[1].id, toAccountId: accounts[0].id, amount: "1.111", date: TODAY, similarOk: true }));
    const changed = await bankFacts(api, q2);
    assert.notDeepEqual(changed.accounts, atBackup.accounts);
    const body = { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD };
    for (const [fn, when, code] of [["copyFileSync", (from, to) => String(to).endsWith(".geri-yukleme"), "EIO"], ["renameSync", from => String(from).endsWith(".geri-yukleme"), "EBUSY"]]) {
      const restore = inject(fn, when, () => fsError(code, "arıza"));
      let response;
      try {
        response = await api.client.post("/api/admin/backups/restore", body);
      } finally {
        restore();
      }
      assert.equal(response.status, 500, `${code}: ${JSON.stringify(response.data)}`);
      assert.match(response.data.error, /verisi değişmedi/);
      assert.deepEqual(await bankFacts(api, q2), changed, `${code}: 002 banka verisi aynı`);
      assert.deepEqual(readdirSync(path.dirname(dbFileOf(second.id))).filter(name => name.includes(".geri-yukleme")), [], `${code}: geçici dosya kalmadı`);
    }
    await must("hata geçince geri yükle", api.post("/api/admin/backups/restore", body));
    assert.deepEqual(await bankFacts(api, q2), atBackup, "002 yedek anına döndü (transfer geri gitti)");
    assert.deepEqual(await bankFacts(api), rootFacts, "001 değişmedi");
  });

  it("A4: 002'nin veri dosyası başka programca kilitli → banka uçları 503 company-unavailable (001'e düşmez); kilit kalkınca bakiyeler aynı", async () => {
    const before002 = await bankFacts(api, q2);
    await server.app.context.closeCompany(second.id);
    const lock = new DatabaseSync(dbFileOf(second.id));
    lock.exec("PRAGMA locking_mode = EXCLUSIVE; BEGIN EXCLUSIVE; UPDATE settings SET value = value WHERE key = 'office.name';");
    try {
      for (const [method, url, body] of [["get", "/api/workspace/bank/summary"], ["get", "/api/workspace/bank/accounts"], ["post", "/api/workspace/bank/vouchers", { type: "fee", accountId: "x", amount: "1", feeType: "eft", tax: "none" }]]) {
        const res = await api.client[method](`${url}?${q2}`, body);
        assert.equal(res.status, 503, `${method} ${url}: ${res.status}`);
        assert.equal(res.data.code, "company-unavailable");
      }
    } finally {
      lock.exec("ROLLBACK");
      lock.close();
    }
    assert.deepEqual(await bankFacts(api), rootFacts, "001'in banka verisi değişmedi (istekler 001'e düşmedi)");
    assert.deepEqual(await bankFacts(api, q2), before002, "kilit kalkınca 002 aynı");
  });

  it("A5: yedek tatbikatı (002, hesaba bağlı veri): yedek → çalış → geri yükle → sayılar → yeniden çalış → yedek → geri yükle", async () => {
    const accounts = () => must("hesaplar", api.get(`/api/workspace/bank/accounts?${q2}`)).then(data => Object.fromEntries(data.accounts.map(item => [item.bankName, item])));
    const first = (await must("yedek 1", api.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
    const moment1 = await bankFacts(api, q2);
    // Çalış: havale ödemesi, peşinli alış, fiş, transfer.
    let acc = await accounts();
    const supplier = await must("tedarikçi", api.post(`/api/workspace/accounts?${q2}`, { name: "002 Tedarikçi", type: "supplier", registeredOn: dayOf(-10) }));
    await must("havale ödeme", api.post(`/api/workspace/accounts/${supplier.id}/entries?${q2}`, { kind: "out", amount: "3.000", method: "bank", bankAccountId: acc["Ziraat Bankası"].id, date: TODAY }));
    await must("peşinli alış", api.post(`/api/workspace/invoices?${q2}`, { kind: "purchase", accountId: supplier.id, number: "T-1", issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 1200, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: "1.200", method: "bank", bankAccountId: acc["Garanti BBVA"].id }], cheques: [], endorse: [], rest: "open" }, force: true }));
    await must("fiş", api.post(`/api/workspace/bank/vouchers?${q2}`, { type: "other_in", accountId: acc["Garanti BBVA"].id, amount: "250", date: TODAY, description: "Promosyon" }));
    assert.notDeepEqual(await bankFacts(api, q2), moment1);
    await must("geri yükle 1", api.post("/api/admin/backups/restore", { name: first, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await bankFacts(api, q2), moment1, "geri yüklenince bütün banka sayıları yedek anındaki gibi");
    assert.deepEqual(await bankFacts(api), rootFacts, "001 hiç değişmedi");
    // Geri yüklenen veride yeniden çalış: transfer + havale tahsilat; İşlem No geri yüklenen sayaçtan devam eder (plan §11.3: bilinen sınır).
    acc = await accounts();
    const t = await must("yeniden transfer", api.post(`/api/workspace/bank/transfers?${q2}`, { accountId: acc["Garanti BBVA"].id, toAccountId: acc["Ziraat Bankası"].id, amount: "4.321", date: TODAY, similarOk: true }));
    assert.match(t.no, /^BNK-\d{4}-\d{6}$/);
    // Transferin iki ayağı aynı İşlem No'yu taşır; bir numara yalnız BİR olaya ait olmalı.
    const owners = new Map();
    for (const row of (await must("hareketler", api.get(`/api/workspace/bank/movements?limit=500&${q2}`))).rows) {
      if (!row.no) continue;
      owners.set(row.no, new Set([...(owners.get(row.no) || []), row.eventId]));
    }
    assert.deepEqual([...owners].filter(([, set]) => set.size > 1).map(([no]) => no), [], "geri yüklenen veride bir İşlem No iki olaya verilmez");
    const moment2 = await bankFacts(api, q2);
    assert.equal(moment2.integrity, true);
    const secondBackup = (await must("yedek 2", api.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
    await must("yedekten sonra fiş", api.post(`/api/workspace/bank/vouchers?${q2}`, { type: "fee", accountId: acc["Ziraat Bankası"].id, amount: "5", feeType: "eft", tax: "none", date: TODAY }));
    await must("geri yükle 2", api.post("/api/admin/backups/restore", { name: secondBackup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await bankFacts(api, q2), moment2, "ikinci geri yükleme ikinci anın sayılarına döner");
    assert.deepEqual(await bankFacts(api), rootFacts, "001 hiç değişmedi");
  });
});
