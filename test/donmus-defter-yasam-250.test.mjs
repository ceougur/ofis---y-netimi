// 2.5.0 Ç3 — donmuş defterin yaşam döngüsü (docs/erp/C3-DONDURMA-TASARIM.md §6, §7, §10, §14 F7, F11–F13; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §4, §9 madde 1, 5):
// süreç öldürme dondurma sırasında (açılışta sürer), disk dolu (yarım koşu görünmez, yer açılınca tamamlanır), iki şirket, yedek → geri yükle, eski sürümün kilidi ilerletmesi /
// geri çekmesi / Şirket Verisini Sıfırla'sı (açılış onarımı), göç 47 (kilitli dosyada bekleyen 2.4.9 koşusu → açılıştan sonra 2.4.9 kopyasıyla donar). Saat sahte ve sabit
// (ders 13, 22). Eski kodda (a2796dd4) her test "donmuş defter yok" nedeniyle kırmızıdır (ders 7, 38).
// WINDOWS (ders 48): süreç öldürme (SIGKILL → TerminateProcess) ve öldürülen sürecin dosyasını yeniden açma, iş parçacığının dosya tutamağı ve geri yüklemede dosya
// takası bu dosyadadır — ilk gönderimde CI'nin Windows işlerinde görülmeli.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HERE, "fixtures", "donma-isci.mjs");
const NOW = "2027-01-10T10:00:00+03:00";
const LOCK = "2026-12-31";
const TRIGGERS = ["ledger_snapshot_runs_no_delete", "ledger_snapshot_runs_no_replace", "ledger_snapshot_runs_state", "ledger_snapshots_insert", "ledger_snapshots_no_delete", "ledger_snapshots_no_update"];
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);
const snapshotsOf = app => {
  assert.ok(app?.ledger?.snapshots?.state, "donmuş defter yok (ledger.snapshots)");
  return app.ledger.snapshots;
};
const countOf = (store, table, where = "") => store.get(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`).n;
// v2.4.9 server/app.mjs MOVEMENT_TABLES (sırasıyla; "ledger_snapshots" 2.1.0'dan beri listede, audit_events ondan ÖNCE).
const LEGACY_MOVEMENT_TABLES = ["cash_entries", "payments", "account_entries", "stock_moves", "invoice_offsets", "invoice_repeats", "invoice_lines", "invoices", "einvoice_inbox", "plan_entries", "plan_items", "plan_imports", "plans", "cheque_events", "cheques", "integrity_log", "message_sends", "wa_job_pdfs", "wa_jobs", "wa_batches", "trash", "audit_events",
  "fin_events", "bank_lines", "pos_sales", "pos_items", "cheque_collections", "bank_statements", "bank_statement_lines", "bank_matches", "bank_plans", "bank_jobs", "request_keys", "ledger_snapshots", "doubtful_receivables", "doubtful_provisions"];
const triggersOf = store => store.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_snapshot%' ORDER BY name").map(row => row.name);

async function seed(admin, query = "") {
  const q = query ? `?${query}` : "";
  const customer = await must("müşteri", admin.post(`/api/workspace/accounts${q}`, { name: "Cem Kara", registeredOn: "2026-02-01" }));
  await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries${q}`, { kind: "debt", amount: "800", date: "2026-02-01", note: "Açılış bakiyesi" }));
  for (const [day, amount] of [["2026-03-01", "100"], ["2026-05-01", "200"], ["2026-08-01", "300"], ["2026-10-01", "400"], ["2026-12-31", "500"], ["2027-01-02", "600"]]) {
    await must(`kasa ${day}`, admin.post(`/api/workspace/cash${q}`, { kind: "in", amount, date: day, description: `Giriş ${day}` }));
  }
  await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries${q}`, { kind: "in", amount: "250", date: "2026-11-15", method: "cash", note: "Tahsilat" }));
  return customer;
}

describe("2.5.0 Ç3 — donmuş defter: iki şirket, yedek → geri yükle", () => {
  let server;
  let admin;
  let second;
  let q2;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, maxCompanies: 2 });
    admin = await loginAdmin(server);
    second = await must("002", admin.post("/api/companies", { name: "Donma İkinci Şirket", select: false }));
    second = second.company || second;
    q2 = `hofCompany=${encodeURIComponent(second.id)}`;
    await seed(admin);
    await seed(admin, q2);
  });
  after(() => server?.close());
  const child = () => server.app.openCompany(second.id);

  it("F13a: iki şirket karışmaz — 001'in kilidi yalnız 001'i dondurur; 002 kendi gününe kendi kuralıyla donar", async () => {
    snapshotsOf(server.app);
    await must("001 kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    assert.equal(snapshotsOf(server.app).state().coverage, LOCK);
    assert.equal(countOf(child().store, "ledger_snapshot_runs"), 0, "002'de koşu yok");
    await must("002 kilit", admin.put(`/api/admin/period-lock?${q2}`, { lockedUntil: "2026-06-30" }));
    assert.equal(snapshotsOf(child()).state().coverage, "2026-06-30");
    assert.equal(snapshotsOf(server.app).state().coverage, LOCK, "001 değişmedi");
    assert.deepEqual(canon(snapshotsOf(child()).entries()), canon(upTo(child().ledger.build(), "2026-06-30")));
    assert.deepEqual(canon(snapshotsOf(server.app).entries()), canon(upTo(server.app.ledger.build(), LOCK)));
  });

  it("F13b: 002 yedeği (kilitli) → kilidi geri çek → geri yükle: yedekteki kapsam, koşular, satırlar ve tetikleyiciler döner; donmuş = canlı", async () => {
    snapshotsOf(child());
    if (snapshotsOf(child()).state().coverage !== "2026-06-30") await must("002 kilit", admin.put(`/api/admin/period-lock?${q2}`, { lockedUntil: "2026-06-30" }));
    const lines = countOf(child().store, "ledger_snapshots");
    const backup = (await must("yedek", admin.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
    await must("002 kilit aç", admin.put(`/api/admin/period-lock?${q2}`, { lockedUntil: "" }));
    assert.equal(countOf(child().store, "ledger_snapshots"), 0);
    await must("geri yükle", admin.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    await must("002 yeniden", admin.get(`/api/workspace/ledger?${q2}`));
    const store = child().store;
    assert.equal(snapshotsOf(child()).state().coverage, "2026-06-30", "yedekteki kapsam");
    assert.equal(countOf(store, "ledger_snapshots"), lines);
    assert.deepEqual(triggersOf(store), TRIGGERS);
    assert.throws(() => store.db.exec("UPDATE ledger_snapshots SET debit_minor = 1"), /değiştirilemez/);
    assert.deepEqual(canon(snapshotsOf(child()).entries()), canon(upTo(child().ledger.build(), "2026-06-30")));
    assert.equal((await must("002 tarama", admin.get(`/api/workspace/ledger/integrity?${q2}`))).ok, true);
  });

  it("F13c: Tümünü Sıfırla donmuş defteri siler; sonra kilit yeniden donar", async () => {
    snapshotsOf(server.app);
    const result = await must("sıfırla", admin.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD }));
    assert.ok(result.counts.ledger_snapshot_runs >= 1, JSON.stringify(result.counts));
    assert.equal(countOf(server.app.store, "ledger_snapshots"), 0);
    assert.equal(countOf(server.app.store, "ledger_snapshot_runs"), 0);
    assert.deepEqual(triggersOf(server.app.store), TRIGGERS);
    await seed(admin);
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    assert.deepEqual(canon(snapshotsOf(server.app).entries()), canon(upTo(server.app.ledger.build(), LOCK)));
  });
});

describe("2.5.0 Ç3 — donmuş defter: yarıda kesilme, disk dolu, eski sürüm, göç", () => {
  let root;
  let n = 0;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "donma-yasam-"));
  });
  after(() => removeTestDir(root));
  const dirsOf = () => {
    n += 1;
    return { dataDir: path.join(root, `data-${n}`), backupDir: path.join(root, `backups-${n}`) };
  };
  const open = (dirs, extra = {}) => startTestServer({ now: { time: NOW, fixed: true }, ...dirs, ...extra });
  const raw = (dirs, fn) => {
    const db = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

  it("F7a: dondurma sırasında süreç öldürülürse (ilk parça yazılmış, koşu açık) yarım koşu görünmez; açılışta sürer, sonuç kilit = kapsam, donmuş = canlı", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    try {
      snapshotsOf(server.app);
      await seed(await loginAdmin(server));
    } finally {
      await server.close();
    }
    const marker = path.join(root, `isaret-${n}.txt`);
    const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", WORKER, dirs.dataDir, dirs.backupDir, marker, LOCK], { stdio: "ignore", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const started = Date.now();
    while (!existsSync(marker) && Date.now() - started < 60_000) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(existsSync(marker), "işçi ilk parçayı yazdı (ön koşul oluştu)");
    const exited = new Promise(resolve => proc.once("exit", resolve));
    proc.kill("SIGKILL");
    await exited;
    // Öldürüldükten sonra dosya: kilit konmuş, koşu bekliyor, yazılan satırlar kapsamın üstünde (görünmez).
    const afterKill = raw(dirs, db => ({
      lock: db.prepare("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'").get()?.value || "",
      pending: db.prepare("SELECT COUNT(*) AS n FROM ledger_snapshot_runs WHERE state = 'pending'").get().n,
      done: db.prepare("SELECT COUNT(*) AS n FROM ledger_snapshot_runs WHERE state = 'done'").get().n,
      lines: db.prepare("SELECT COUNT(*) AS n FROM ledger_snapshots").get().n,
      check: db.prepare("PRAGMA integrity_check").get().integrity_check,
    }));
    assert.deepEqual({ lock: afterKill.lock, pending: afterKill.pending, done: afterKill.done, check: afterKill.check }, { lock: LOCK, pending: 1, done: 0, check: "ok" }, JSON.stringify(afterKill));
    assert.ok(afterKill.lines >= 3, `ilk parça yazılmıştı: ${afterKill.lines}`);
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      const state = S.state();
      assert.equal(state.coverage, LOCK);
      assert.equal(state.pending, null);
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), LOCK)));
      assert.equal(countOf(server.app.store, "ledger_snapshots"), countOf(server.app.store, "ledger_snapshots", `date <= '${LOCK}'`));
      assert.equal(countOf(server.app.store, "ledger_snapshot_runs", "state = 'abandoned'") + countOf(server.app.store, "ledger_snapshot_runs", "state = 'done' AND kind = 'freeze'"), 1, "yarım koşu sürdürüldü (yenisi açılmadı)");
      assert.equal((await must("tarama", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"))).ok, true);
    } finally {
      await server.close();
    }
  });

  it("F7b: disk dolu — kilit konur ama dondurma tamamlanamaz: yarım satırlar görünmez, raporlar canlı (doğru); yer açılınca tamamlanır", async () => {
    const dirs = dirsOf();
    const hook = { fn: null };
    const server = await open(dirs, { freezeBatchLines: 50, __testFreezeHook: hook });
    try {
      const S = snapshotsOf(server.app);
      const admin = await loginAdmin(server);
      await seed(admin);
      for (let i = 0; i < 120; i += 1) await must("dolgu", admin.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-04-01", description: `Dolgu ${"x".repeat(150)} ${i}` }));
      const db = server.app.store.db;
      // İlk parça yazılınca dosya büyüyemez (sayfa sınırı = bugünkü boyut): sonraki parçalar "database or disk is full".
      let limited = false;
      hook.fn = phase => {
        if (phase !== "batch" || limited) return;
        limited = true;
        db.exec(`PRAGMA max_page_count = ${db.prepare("PRAGMA page_count").get().page_count}`);
      };
      let result;
      try {
        result = await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      } finally {
        hook.fn = null;
        db.exec("PRAGMA max_page_count = 1073741823");
      }
      assert.ok(limited, "ön koşul: ilk parçadan sonra sayfa sınırı kondu");
      assert.equal(result.lockedUntil, LOCK, "kilit kondu");
      assert.equal(result.frozenThrough, "", "dondurma tamamlanmadı");
      assert.match(String(result.freeze?.error || ""), /full|dolu/i);
      assert.equal(S.state().coverage, "");
      assert.ok(S.state().pending, "koşu bekliyor");
      assert.equal(S.entries().length, 0, "yarım satırlar görünmez");
      assert.deepEqual(canon(server.app.ledger.book()), canon(server.app.ledger.build()), "raporlar canlı (doğru)");
      await S.runPending();
      assert.equal(S.state().coverage, LOCK);
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), LOCK)));
    } finally {
      await server.close();
    }
  });

  it("F12: eski sürüm (BS-7 kapısını bilmez) kilidi ilerletir → açılışta aradaki dönem 2.4.9 kuralıyla donar; geri çeker → açılışta çözülür; Şirket Verisini Sıfırla (önce işlem geçmişi) donmuş satırları silebilir → açılışta tutarlı", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    try {
      snapshotsOf(server.app);
      const admin = await loginAdmin(server);
      await seed(admin);
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" }));
      // Ç2 fişi (açık dönemde): (c)'deki eski sürüm sıfırlamasından artakalınca Ç2'nin açılış onarımı (withTriggersLifted) çalışsın diye.
      server.app.ledger.vouchers.post({ id: "eski-surum", display_name: "Eski Sürüm" }, { type: "opening-match", date: "2027-01-03", requestKey: "donma-f12-fis", lines: [{ account: "590", debit: 100 }, { account: "519", credit: 100 }] });
    } finally {
      await server.close();
    }
    // (a) Eski sürüm kilidi 31.12'ye götürür (yalnız ayar; koşu açmaz).
    raw(dirs, db => db.prepare("UPDATE settings SET value = ? WHERE key = 'ledger.lockedUntil'").run(LOCK));
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      const run = server.app.store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
      assert.deepEqual({ kind: run.kind, state: run.state, reason: run.reason, rule: run.rule_version, from: run.from_date, through: run.through }, { kind: "freeze", state: "done", reason: "repair", rule: "2.4.9", from: "2026-06-30", through: LOCK });
      assert.equal(S.state().coverage, LOCK);
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), LOCK)));
    } finally {
      await server.close();
    }
    // (b) Eski sürüm kilidi 30.06'ya geri çeker → açılışta thaw (repair), 30.06'dan sonraki satırlar kalkar.
    raw(dirs, db => db.prepare("UPDATE settings SET value = '2026-06-30' WHERE key = 'ledger.lockedUntil'").run());
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      const run = server.app.store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
      assert.deepEqual({ kind: run.kind, reason: run.reason, through: run.through }, { kind: "thaw", reason: "repair", through: "2026-06-30" });
      assert.equal(S.state().coverage, "2026-06-30");
      assert.equal(countOf(server.app.store, "ledger_snapshots", "date > '2026-06-30'"), 0);
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), "2026-06-30")));
    } finally {
      await server.close();
    }
    // (c) 2.4.9'un Şirket Verisini Sıfırla'sı: MOVEMENT_TABLES sırasıyla önce audit_events, sonra ledger_snapshots silinir (iz gidince silme geçer); kilit ayarı silinir.
    raw(dirs, db => {
      const has = table => Boolean(db.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
      db.exec("BEGIN IMMEDIATE");
      for (const table of LEGACY_MOVEMENT_TABLES) if (has(table)) db.exec(`DELETE FROM ${table}`);
      db.exec("DELETE FROM settings WHERE key = 'ledger.lockedUntil'");
      db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES ('event-eski-sifirlama', 'company.reset', 'sirket-001', 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', '2027-01-10T07:00:00.000Z')").run();
      db.exec("COMMIT");
    });
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      assert.equal(S.state().coverage, "");
      assert.equal(countOf(server.app.store, "ledger_snapshots"), 0);
      const run = server.app.store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
      assert.deepEqual({ kind: run.kind, reason: run.reason, through: run.through }, { kind: "thaw", reason: "repair", through: "" });
      // Ç2'nin açılış onarımı artakalan fişi kaldırdı (fiş tetikleyicilerini kaldırıp kurdu); göç 47'nin tetikleyicileri yerinde (ana oturum notu, 22:0x).
      assert.equal(countOf(server.app.store, "ledger_vouchers"), 0, "Ç2 onarımı çalıştı");
      assert.deepEqual(triggersOf(server.app.store), TRIGGERS, "donmuş defter tetikleyicileri onarımdan sonra yerinde");
      assert.equal(countOf(server.app.store, "sqlite_master", "type = 'trigger' AND name LIKE 'ledger_vou%'"), 6, "fiş tetikleyicileri yerinde");
      assert.equal((await must("tarama", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"))).ok, true);
    } finally {
      await server.close();
    }
  });

  it("F11 (benzetim): göç 47 — kilitli 46'lık dosyada bekleyen 2.4.9 koşusu yazılır, açılıştan sonra 2.4.9 kopyasıyla donar; kilitsiz dosyada koşu yok", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    try {
      snapshotsOf(server.app);
      const admin = await loginAdmin(server);
      await seed(admin);
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await server.close();
    }
    // 46'lık dosya (göç 47'den önceki şema): donmuş defter tabloları ve tetikleyicileri yok, kilit ayarı var.
    raw(dirs, db => {
      db.exec("BEGIN IMMEDIATE");
      for (const name of TRIGGERS) db.exec(`DROP TRIGGER IF EXISTS ${name}`);
      db.exec("DROP TABLE ledger_snapshots; DROP TABLE ledger_snapshot_runs; PRAGMA user_version = 46; COMMIT;");
    });
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      const first = server.app.store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no LIMIT 1");
      assert.deepEqual({ kind: first.kind, reason: first.reason, rule: first.rule_version, from: first.from_date, through: first.through }, { kind: "freeze", reason: "migration", rule: "2.4.9", from: "", through: LOCK });
      // Donmadan önce bile raporlar 2.4.9 kuralıyla (bekleyen koşunun kuralı) okur.
      const { buildRule249 } = await import("../server/lib/ledger-rule-249/index.mjs");
      assert.deepEqual(canon(upTo(server.app.ledger.book(), LOCK)), canon(upTo(buildRule249(server.app.store), LOCK)));
      await S.runPending();
      assert.equal(S.state().coverage, LOCK);
      assert.equal(server.app.store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots").v, "2.4.9");
      assert.deepEqual(canon(S.entries()), canon(upTo(buildRule249(server.app.store), LOCK)), "donmuş = 2.4.9 kopyası");
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), LOCK)), "bugün güncel kural = 2.4.9 (tutarda)");
      assert.equal(server.app.store.get("PRAGMA user_version").user_version, 47);
    } finally {
      await server.close();
    }
    // Kilitsiz dosya: koşu yok.
    const plain = dirsOf();
    server = await open(plain);
    try {
      await seed(await loginAdmin(server));
    } finally {
      await server.close();
    }
    raw(plain, db => {
      db.exec("BEGIN IMMEDIATE");
      for (const name of TRIGGERS) db.exec(`DROP TRIGGER IF EXISTS ${name}`);
      db.exec("DROP TABLE ledger_snapshots; DROP TABLE ledger_snapshot_runs; PRAGMA user_version = 46; COMMIT;");
    });
    server = await open(plain);
    try {
      assert.equal(countOf(server.app.store, "ledger_snapshot_runs"), 0);
      assert.equal(snapshotsOf(server.app).state().coverage, "");
    } finally {
      await server.close();
    }
  });
});
