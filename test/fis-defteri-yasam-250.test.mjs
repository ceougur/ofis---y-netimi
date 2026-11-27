// 2.5.0 Ç2 — saklanan fiş defterinin yaşam döngüsü (docs/erp/C2-FIS-DEFTERI-TASARIM.md §8, §9 N5, N11, N15–N19; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §9 madde 4–5):
// iki şirket, yedek → geri yükle, Şirket Verisini Sıfırla (iki kip), eski sürüm (2.4.9) sıfırlamasından artakalan fişin açılış onarımı, eski sürüm fikstüründen göç,
// süreç öldürme ve disk dolu (yarım fiş yok), eşzamanlı iki süreç aynı istek kimliği (tek fiş). Saat sahte ve sabit (ders 13, 22).
// WINDOWS (ders 48): süreç öldürme (process.kill) ve öldürülen sürecin dosyasını yeniden açma bu dosyadadır — Windows CI'de ayrıca görülür.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { createPeriod } from "../server/lib/period.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HERE, "fixtures", "fis-defteri-isci.mjs");
const NOW = "2027-01-10T10:00:00+03:00";
const USER = { id: "fis-yasam", display_name: "Fiş Yaşam" };
const TRIGGERS = ["ledger_vouchers_no_update", "ledger_vouchers_no_delete", "ledger_vouchers_no_replace", "ledger_voucher_lines_no_update", "ledger_voucher_lines_no_delete", "ledger_voucher_lines_closed"];
const pair = (amount, debit = "590", credit = "519") => [{ account: debit, debit: amount }, { account: credit, credit: amount }];
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const triggersOf = store => store.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_vou%' ORDER BY name").map(row => row.name);
const countOf = (store, table) => store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
const vouchersOf = app => {
  assert.ok(app?.ledger?.vouchers?.post, "fiş defteri yok (ledger.vouchers)");
  return app.ledger.vouchers;
};

describe("2.5.0 Ç2 — fiş defteri: iki şirket, yedek → geri yükle, Şirket Verisini Sıfırla", () => {
  let server;
  let admin;
  let second;
  let q2;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, maxCompanies: 2 });
    admin = await loginAdmin(server);
    second = await must("002", admin.post("/api/companies", { name: "Fiş İkinci Şirket", select: false }));
    second = second.company || second;
    q2 = `hofCompany=${encodeURIComponent(second.id)}`;
    await must("002 defteri", admin.get(`/api/workspace/ledger?${q2}`));
  });
  after(() => server?.close());
  const child = () => server.app.openCompany(second.id);

  it("N15: 001'e yazılan fiş 002'de yok; numaralar şirket başına ayrı; 002'nin defterinde yalnız kendi fişi", async () => {
    const one = vouchersOf(server.app).post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "yasam-n15-001-a", lines: pair(1000) });
    const two = vouchersOf(child()).post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "yasam-n15-001-a", lines: pair(2000) });
    assert.equal(one.no, 1);
    assert.equal(two.no, 1, "002'nin sayacı ayrı");
    assert.notEqual(one.id, two.id);
    assert.equal(countOf(server.app.store, "ledger_vouchers"), 1);
    assert.equal(countOf(child().store, "ledger_vouchers"), 1);
    const list1 = await must("001 liste", admin.get("/api/admin/ledger/vouchers"));
    const list2 = await must("002 liste", admin.get(`/api/admin/ledger/vouchers?${q2}`));
    assert.deepEqual(list1.vouchers.map(item => item.totalMinor), [1000]);
    assert.deepEqual(list2.vouchers.map(item => item.totalMinor), [2000]);
    const trial2 = (await must("002 mizan", admin.get(`/api/workspace/ledger?${q2}`))).trial;
    assert.equal(Math.round((trial2.accounts.find(row => row.code === "590")?.balance || 0) * 100), 2000);
  });

  it("N16: 002 yedeği → yeni fiş → geri yükle: yedekteki fişler ve tetikleyiciler döner, numara yedeğin devamı", async () => {
    const backup = (await must("yedek", admin.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
    vouchersOf(child()).post(USER, { type: "opening-match", date: "2027-01-03", requestKey: "yasam-n16-sonra-1", lines: pair(3000) });
    assert.equal(countOf(child().store, "ledger_vouchers"), 2);
    await must("geri yükle", admin.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    await must("002 yeniden", admin.get(`/api/workspace/ledger?${q2}`));
    const store = child().store;
    assert.equal(countOf(store, "ledger_vouchers"), 1, "yedekten sonraki fiş gitti");
    assert.deepEqual(triggersOf(store), [...TRIGGERS].sort(), "tetikleyiciler yedekle döndü");
    assert.throws(() => store.db.exec("UPDATE ledger_vouchers SET description = 'x'"), /değiştirilemez/);
    const next = vouchersOf(child()).post(USER, { type: "opening-match", date: "2027-01-04", requestKey: "yasam-n16-sonra-2", lines: pair(4000) });
    assert.equal(next.no, 2, "numara geri yüklenen verinin devamı");
    assert.equal((await must("002 tarama", admin.get(`/api/workspace/ledger/integrity?${q2}`))).ok, true);
  });

  for (const mode of ["movements", "all"]) {
    it(`N17: Şirket Verisini Sıfırla (${mode}) fişleri ve satırları siler, tetikleyiciler yeniden kurulu, numara 1'den`, async () => {
      const V = vouchersOf(server.app);
      const a = V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: `yasam-n17-${mode}-a`, lines: pair(500) });
      V.reverse(USER, a.id, { requestKey: `yasam-n17-${mode}-r` });
      const store = server.app.store;
      assert.ok(countOf(store, "ledger_vouchers") >= 2);
      const result = await must("sıfırla", admin.post("/api/companies/sirket-001/reset", { mode, confirm: "001", password: ADMIN_PASSWORD }));
      assert.ok(result.counts.ledger_vouchers >= 2, `sıfırlama raporu fiş sayısını taşır: ${JSON.stringify(result.counts)}`);
      assert.equal(countOf(store, "ledger_vouchers"), 0);
      assert.equal(countOf(store, "ledger_voucher_lines"), 0);
      assert.deepEqual(triggersOf(store), [...TRIGGERS].sort());
      const fresh = V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: `yasam-n17-${mode}-b`, lines: pair(600) });
      assert.equal(fresh.no, 1, "numara 1'den");
      assert.throws(() => store.db.exec("DELETE FROM ledger_vouchers"), /silinemez/, "sıfırlamadan sonra silme yine engelli");
      assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
    });
  }
});

describe("2.5.0 Ç2 — N18: eski sürüm (fiş defterini bilmeyen kod) Şirket Verisini Sıfırla yaptıysa artakalan fiş açılışta kaldırılır", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-n18-"));
  });
  after(() => removeTestDir(root));
  const open = () => startTestServer({ now: { time: NOW, fixed: true }, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
  // 2.4.9'un resetData'sının fiş defterine dokunan kısmı (server/app.mjs v2.4.9 MOVEMENT_TABLES): işlem geçmişi silinir, "company.reset" izi yazılır, fiş tablosu listede yok.
  const legacyReset = file => {
    const db = new DatabaseSync(file);
    try {
      db.exec("BEGIN IMMEDIATE; DELETE FROM audit_events; DELETE FROM integrity_log;");
      db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES ('event-eski-sifirlama', 'company.reset', 'sirket-001', 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', '2027-01-10T07:00:00.000Z')").run();
      db.exec("COMMIT");
    } finally {
      db.close();
    }
  };
  it("izi olmayan fiş + sıfırlama izi → kaldırılır (Mutabakat Günlüğü 'repair', işlem geçmişi); sonra yazılan fiş kalır; sıfırlama izi yoksa dokunulmaz", async () => {
    let server = await open();
    let file = server.app.config.dbPath;
    let V;
    try {
      V = vouchersOf(server.app);
      const a = V.post(USER, { type: "closing", date: "2027-01-06", requestKey: "yasam-n18-eski-a", lines: pair(700, "602", "690") });
      V.reverse(USER, a.id, { requestKey: "yasam-n18-eski-r" });
    } finally {
      await server.close();
    }
    legacyReset(file);
    server = await open();
    try {
      file = server.app.config.dbPath;
      const store = server.app.store;
      assert.equal(server.app.context.voucherRepair?.removed, 2, JSON.stringify(server.app.context.voucherRepair));
      assert.equal(countOf(store, "ledger_vouchers"), 0);
      assert.equal(countOf(store, "ledger_voucher_lines"), 0);
      assert.deepEqual(triggersOf(store), [...TRIGGERS].sort());
      const log = store.get("SELECT summary, tables FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers'");
      assert.match(log?.summary || "", /artakalan 2 fiş kaldırıldı/);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.vouchers.legacy-reset-removed'").n, 1);
      V = vouchersOf(server.app);
      V.post(USER, { type: "closing", date: "2027-01-07", requestKey: "yasam-n18-yeni-b", lines: pair(800, "602", "690") });
    } finally {
      await server.close();
    }
    server = await open();
    try {
      assert.equal(server.app.context.voucherRepair, null, "izi olan fiş onarıma girmez");
      assert.equal(countOf(server.app.store, "ledger_vouchers"), 1);
    } finally {
      await server.close();
    }
    // İşlem geçmişi sıfırlama izi olmadan boşalmışsa (bilinmeyen neden): fiş kaldırılmaz.
    const db = new DatabaseSync(file);
    db.exec("DELETE FROM audit_events");
    db.close();
    server = await open();
    try {
      assert.equal(server.app.context.voucherRepair?.removed, 0);
      assert.equal(countOf(server.app.store, "ledger_vouchers"), 1, "sıfırlama izi yoksa dokunulmadı");
    } finally {
      await server.close();
    }
  });
});

describe("2.5.0 Ç2 — N19: eski sürüm verisinden göç (v2.4.3 fikstürü, iki şirket) 46'ya; kilit izi ve defter değişmez", () => {
  let unpacked;
  before(() => {
    unpacked = unpackFixture("surum-2.4.3-baslarken");
  });
  after(() => unpacked?.cleanup());
  it("iki şirketin dosyası son şemaya çıkar, tablolar ve tetikleyiciler kurulu, kilit izi (2.4.9 tanımı = güncel tanım), Mutabakat tutarlı; ikinci açılışta göç yok", async () => {
    const files = [path.join(unpacked.dataDir, "destekofis.sqlite"), path.join(unpacked.dataDir, "sirketler", "002", "destekofis.sqlite")];
    const before = files.map(file => {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        return db.prepare("PRAGMA user_version").get().user_version;
      } finally {
        db.close();
      }
    });
    assert.ok(before.every(version => version < 46), `fikstür eski şemada: ${before}`);
    let server = await startTestServer({ now: { time: NOW, fixed: true }, dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, maxCompanies: 5 });
    try {
      const admin = await loginAdmin(server);
      const companies = (await must("şirketler", admin.get("/api/companies"))).companies;
      const other = companies.find(item => item.code === "002");
      await must("002 defteri", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(other.id)}`));
      for (const app of [server.app, server.app.openCompany(other.id)]) {
        const store = app.store;
        assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
        assert.deepEqual(triggersOf(store), [...TRIGGERS].sort());
        assert.equal(countOf(store, "ledger_vouchers"), 0);
        for (const day of ["2025-12-31", "2026-12-31", "2027-01-10"]) assert.equal(lockDigestOf(store, day), lockDigestOf(store, day, { version: "2.4.9" }), `kilit izi ${day}: yeni girdi satır üretmez`);
        assert.equal(app.ledger.check().reconciliation.ok, true);
        assert.equal(app.ledger.build().some(entry => entry.id.startsWith("voucher")), false);
      }
    } finally {
      await server.close();
    }
    server = await startTestServer({ now: { time: NOW, fixed: true }, dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, maxCompanies: 5 });
    try {
      assert.deepEqual(server.app.migration.applied, [], "ikinci açılışta göç yok");
    } finally {
      await server.close();
    }
  });
});

describe("2.5.0 Ç2 — N11 süreç öldürme / disk dolu ve N5 eşzamanlı iki süreç (ayrı bağlantılar)", () => {
  let root;
  let file;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "fis-surec-"));
    const server = await startTestServer({ now: { time: NOW, fixed: true }, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    // Eski kodda tablo yok: testler kendi başında "no such table: ledger_vouchers" / modül yok nedeniyle kırmızı (hazırlık düşmez).
    try {
      file = server.app.config.dbPath;
    } finally {
      await server.close();
    }
  });
  after(() => removeTestDir(root));
  const look = () => {
    const db = openDatabase(file);
    try {
      const store = createStore(db);
      return { vouchers: countOf(store, "ledger_vouchers"), lines: countOf(store, "ledger_voucher_lines"), traces: store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.voucher.created'").n, check: store.get("PRAGMA integrity_check").integrity_check };
    } finally {
      db.close();
    }
  };

  it("N11a: fiş yazılırken (işlem açık) süreç öldürülürse yarım fiş yok — başlık, satır ve iz yok; dosya sağlam", async () => {
    const marker = path.join(root, "isci-isaret.txt");
    const before = look();
    const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", WORKER, "spin", file, "yasam-n11-oldurme", marker], { stdio: "ignore" });
    const started = Date.now();
    while (!existsSync(marker)) {
      if (Date.now() - started > 30_000) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(existsSync(marker), "işçi fişi işlemin içinde yazdı (ön koşul oluştu)");
    const exited = new Promise(resolve => proc.once("exit", resolve));
    proc.kill("SIGKILL");
    await exited;
    const after = look();
    assert.deepEqual({ vouchers: after.vouchers, lines: after.lines, traces: after.traces }, { vouchers: before.vouchers, lines: before.lines, traces: before.traces }, "yarım fiş yok");
    assert.equal(after.check, "ok");
  });

  it("N11b: disk dolu (sayfa sınırı) → fiş yazılamaz, hiçbir satır kalmaz; yer açılınca aynı istek kimliğiyle yazılır", async () => {
    // Göreli içe aktarım (eski kodda modül yok → bu test "fiş defteri yok" nedeniyle kırmızı; öbür testler kendi nedenleriyle).
    const { createLedgerVouchers } = await import("../server/lib/ledger-vouchers.mjs");
    const db = openDatabase(file);
    try {
      const store = createStore(db);
      const now = createClock({ time: NOW, fixed: true });
      // Ç2 tur 1: alt defter hesapları (ownedAccounts) zorunlu; bu test yalnız 590 / 519 yazar ve sunucusuz kurar → boş küme.
      const V = createLedgerVouchers({ store, period: createPeriod({ store, now }), now, ownedAccounts: () => new Set() });
      const pages = db.prepare("PRAGMA page_count").get().page_count;
      db.exec(`PRAGMA max_page_count = ${pages + 1}`);
      const big = { type: "opening-match", date: "2027-01-05", requestKey: "yasam-n11-disk-dolu", lines: Array.from({ length: 3000 }, (_, i) => ({ account: i % 2 ? "519" : "590", debit: i % 2 ? 0 : 100, credit: i % 2 ? 100 : 0, note: `uzun açıklama ${"x".repeat(200)} ${i}` })) };
      const before = countOf(store, "ledger_voucher_lines");
      assert.throws(() => V.post(USER, big), /full|dolu/i);
      assert.equal(countOf(store, "ledger_voucher_lines"), before);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE request_key = ?", big.requestKey).n, 0);
      db.exec("PRAGMA max_page_count = 1073741823");
      const written = V.post(USER, big);
      assert.equal(written.lineCount, 3000);
      assert.equal(written.replayed, false);
    } finally {
      db.close();
    }
  });

  it("N5: iki ayrı süreç aynı anda aynı istek kimliğiyle fiş yazar → tek fiş; biri yeni, öbürü yinelenen (aynı kimlik)", async () => {
    const at = Date.now() + 1500;
    const run = () =>
      new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", WORKER, "post", file, "yasam-n5-eszamanli", String(at)], { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        proc.stdout.on("data", chunk => (out += chunk));
        proc.stderr.on("data", chunk => (err += chunk));
        proc.once("exit", code => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`işçi ${code}: ${err}`))));
      });
    const results = await Promise.all([run(), run()]);
    assert.ok(results.every(item => item.ok), JSON.stringify(results));
    assert.equal(results[0].id, results[1].id, "aynı fiş");
    assert.deepEqual(results.map(item => item.replayed).sort(), [false, true]);
    const db = openDatabase(file);
    try {
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE request_key = 'yasam-n5-eszamanli'").get().n, 1);
    } finally {
      db.close();
    }
  });
});
