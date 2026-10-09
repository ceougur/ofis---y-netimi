// 2.1.0 — Aşama 2, bağımsız gözden geçirme: kapı süzgecinin (dokunulan varlıklar) açıkları (docs/2.1.0-KANIT.md "Aşama 2 — Bağımsız
// Gözden Geçirme": B6, B9, D8 ve bozma bulanıklaştırması).
//
// ÇALIŞIYOR MU:
//  - B9: açılışta tek bir kuruşu bozuk eski Kasa satırı varken yeni Kasa girişi süzgeç yolundan geçer (önceden her Kasa yazımı tam kapıya
//    gidiyordu: 100.000 satırda ~7 sn); eski satıra dokunan yazım tam kapıya gider ve (sapma büyümediği için) geçer.
//  - B9: para alanı hesap bazında: 102'deki eski sapma (karşılığı olmayan transfer bacağı) varken nakit yazımı süzgeçte, havale yazımı tam
//    kapıda.
// NASIL BOZARIM (işlem içinde store üzerinden doğrudan SQL — hatalı bir modülün yazacağı gibi):
//  - B6: kaynağı "çek" ya da "stok" yazılı ama kaynak kimliği BOŞ cari satırı → üretim kipinde 409 (önceden süzgeç "temiz" deyip COMMIT
//    ediyordu; tam kapı reddederdi); test kipinde 500 gate-equivalence değil 409. Tanınmayan kaynak da 409.
//  - B6 zinciri: reddedilen denemeden sonra Aşama 3'ün banka hesabı yazımı (tam kapı) 409 almaz.
//  - D8: kilitli dönemdeki satırın KİMLİĞİNİ değiştir → 409 (önceden süzgeç kabul ediyordu); store dışından kilitli satır değişikliği →
//    Mutabakat Testi (tam tarama) "Kapanmış dönem" sapmasını bulur.
//  - Bozma bulanıklaştırması (sabit tohum, test kipi): gerçek 2.0.26 verisinde rastgele ham SQL bozması (satır sil, kopyala, kolon değiştir,
//    kimlik değiştir; kilitli ve kilitsiz) → süzgeç "temiz" deyip tam kapının reddettiği (gate-equivalence) hiçbir yazım yok.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { IntegrityError } from "../server/lib/integrity.mjs";
import { boot, integrityOf, integrityOk, must, rawRun } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const PROD = { now: NOW, gateVerify: false, moneyStrict: false };
const TEST = { now: NOW, gateVerify: true, moneyStrict: false };
const gateOf = app => app.integrity.stats().gate;
const rejected = fn => assert.throws(fn, error => error instanceof IntegrityError && error.status === 409, "kapı reddetmeli (409)");
const orphanEntry = (store, accountId, source, sourceId = "") =>
  store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, method, source, source_id, created_by, created_at) VALUES (?, ?, 'debt', 75, ?, 'yetim', '', ?, ?, 'test', ?)", `ae-${randomUUID()}`, accountId, TODAY, source, sourceId, `${TODAY}T09:00:00.000Z`);

describe("B6 — kaynağı boş cari satırı süzgeçten geçmez", () => {
  for (const [label, options] of [["üretim kipi", PROD], ["test kipi (eşdeğerlik denetimi açık)", TEST]]) {
    it(`${label}: çek/stok kaynaklı, kaynak kimliği boş ve tanınmayan kaynaklı satır → 409; tam kapı temiz; sonraki banka hesabı yazımı geçer`, async () => {
      const ctx = await boot(options);
      try {
        const { api, app, store } = ctx;
        const account = await must("cari", api.post("/api/workspace/accounts", { name: "Yetim Cari", type: "customer", registeredOn: "2026-09-01" }));
        await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "50", date: TODAY, description: "x" }));
        const count = () => store.get("SELECT COUNT(*) AS n FROM account_entries WHERE note = 'yetim'").n;
        for (const [source, id] of [["cheque", ""], ["stock", ""], ["cheque", "yok"]]) {
          rejected(() => store.tx(() => orphanEntry(store, account.id, source, id)));
          assert.equal(gateOf(app).path, "full", `${source}/${id || "boş"}: karar tam kapının (${gateOf(app).reason || ""})`);
        }
        assert.equal(count(), 0, "yetim satır yazılmadı");
        // Tanınmayan kaynak: bu yol modellemez, karar tam kapının (defterde elle satır gibi işlenir; sapma yoksa geçer).
        store.tx(() => orphanEntry(store, account.id, "zzz", ""));
        assert.equal(gateOf(app).path, "full", `tanınmayan kaynak: karar tam kapının (${gateOf(app).reason || ""})`);
        assert.match(gateOf(app).reason || "", /tanınmayan kaynak/);
        store.raw("test: temizlik", () => store.tx(() => store.run("DELETE FROM account_entries WHERE note = 'yetim'")));
        assert.equal(app.integrity.run().ok, true, "tam kapı temiz");
        // Aşama 3'ün banka hesabı kartı yazımı (tam kapı yolu): kabul edilmiş gizli sapma yok → 409 almaz.
        store.tx(() => store.run("INSERT INTO bank_accounts (id, code, gl, gl_sub, kind, bank_name, name, currency, opening_date, created_by, created_at) VALUES ('acc-z', 'B01', '102', '102.01', 'demand', 'Test', 'Ana TL', 'TRY', '2026-01-01', 'admin', ?)", new Date().toISOString()));
        assert.equal(gateOf(app).path, "full");
        await integrityOk(api, "yetim denemelerinden sonra");
      } finally {
        await ctx.server.close();
      }
    });
  }
});

describe("B9 — taban sapması varlık bazında (eski kuruşlu satır, hesap bazında para alanı)", () => {
  let ctx;
  let account;
  before(async () => {
    ctx = await boot(PROD);
    account = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Taban Cari", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());

  it("eski kuruşlu Kasa satırı: yeni Kasa girişi süzgeç yolunda; eski satıra dokunan yazım tam kapıda ve geçer", async () => {
    const { api, app, db, store } = ctx;
    rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('eski-kurus', 'in', 10.005, '2024-03-01', 'eski sürüm', 'cash', 'admin', '2024-03-01T09:00:00.000Z')");
    app.integrity.start();
    assert.ok(app.integrity.run().failures.some(item => item.code === "cents:cash_entries"), "taban: cents:cash_entries");
    await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "5", date: TODAY, description: "yeni" }));
    assert.equal(gateOf(app).path, "scoped", `Kasa girişi süzgeç yolunda olmalı (${gateOf(app).reason || ""})`);
    store.tx(() => store.run("UPDATE cash_entries SET description = 'eski sürüm (açıklama)' WHERE id = 'eski-kurus'"));
    assert.equal(gateOf(app).path, "full", "eski satıra dokunan yazım tam kapıya");
    assert.match(gateOf(app).reason || "", /taban/);
    rejected(() => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at, event_id) VALUES ('yeni-kurus', 'in', 3.333, ?, 'x', 'cash', 'test', ?, '')", TODAY, `${TODAY}T09:00:00.000Z`)));
    rawRun(db, "DELETE FROM cash_entries WHERE id = 'eski-kurus'");
    app.integrity.start();
  });

  it("102'deki eski sapma (karşılığı olmayan transfer bacağı): nakit yazımı süzgeçte, havale yazımı tam kapıda", async () => {
    const { api, app, db } = ctx;
    rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, transfer_id, created_by, created_at) VALUES ('eski-bacak', 'out', 40, '2024-03-01', 'eski transfer', 'cash', 'trf-eski', 'admin', '2024-03-01T09:00:00.000Z')");
    app.integrity.start();
    const codes = app.integrity.run().failures.map(item => item.code);
    assert.ok(codes.some(code => code === "gl:102" || code.startsWith("bank:sub:102")), `taban 102'de: ${codes}`);
    assert.ok(!codes.includes("gl:100"), `100 temiz: ${codes}`);
    await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "5", date: TODAY, description: "nakit" }));
    assert.equal(gateOf(app).path, "scoped", `nakit yazımı süzgeçte (${gateOf(app).reason || ""})`);
    await must("havale tahsilatı", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "5", method: "bank", date: TODAY }));
    assert.equal(gateOf(app).path, "full", "havale yazımı tam kapıda");
    assert.match(gateOf(app).reason || "", /money:102/);
    rawRun(db, "DELETE FROM cash_entries WHERE id = 'eski-bacak'");
    app.integrity.start();
  });
});

describe("D8 — kilitli dönem: kimlik değişimi ve kapının görmediği değişiklik", () => {
  for (const [label, options] of [["üretim kipi", PROD], ["test kipi", TEST]]) {
    it(`${label}: kilitli satırın kimliğini değiştir → 409; store dışından kilitli satır değişikliği → Mutabakat Testi bulur`, async () => {
      const ctx = await boot(options);
      try {
        const { api, app, db, store } = ctx;
        const old = await must("eski Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "40", date: "2026-09-10", description: "Eski" }));
        await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
        rejected(() => store.tx(() => store.run("UPDATE cash_entries SET id = ? WHERE id = ?", `${old.id}-x`, old.id)));
        assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = ?", old.id).n, 1);
        await integrityOk(api, "kimlik denemesinden sonra");
        // Store dışından (aynı bağlantı): kapı görmez; tam tarama kilit izinin değiştiğini bulur.
        rawRun(db, "UPDATE cash_entries SET amount = 41 WHERE id = ?", old.id);
        const result = await integrityOf(api);
        assert.equal(result.ok, false);
        assert.ok(result.failures.some(item => item.code === "period-lock"), JSON.stringify(result.failures));
        assert.ok(app.integrity.recent(5).some(row => row.action === "scan" && /Kapanmış dönem/.test(row.summary)), "tarama günlüğü");
        rawRun(db, "UPDATE cash_entries SET amount = 40 WHERE id = ?", old.id);
      } finally {
        await ctx.server.close();
      }
    });
  }
});

describe("bozma bulanıklaştırması (sabit tohum; test kipi): süzgeç ↔ tam kapı eşdeğerliği", () => {
  const TABLES = {
    cash_entries: ["amount", "kind", "method", "date", "transfer_id", "event_id"],
    account_entries: ["amount", "kind", "method", "date", "account_id", "source", "source_id", "invoice_id", "event_id"],
    payments: ["amount", "method", "date", "event_id"],
    plan_entries: ["amount", "kind", "method", "date", "plan_id", "cheque_id", "opening", "event_id"],
    stock_moves: ["amount", "qty", "kind", "pay", "method", "date", "item_id", "account_id", "invoice_id", "event_id"],
    cheque_events: ["amount", "kind", "method", "date", "cheque_id", "event_id"],
    plans: ["total", "account_id", "status", "covers_balance", "registered_on", "deleted_at", "invoice_id", "closed_at"],
    plan_items: ["amount", "due_date", "plan_id"],
    cheques: ["amount", "status", "direction", "account_id", "endorse_account_id", "deleted_at", "issue_date", "invoice_id", "plan_id"],
    accounts: ["type", "deleted_at"],
    stock_items: ["kind", "deleted_at"],
    invoices: ["status", "kind", "account_id", "try_payable", "try_vat", "try_net", "payable_total", "net_total", "issue_date", "original_id"],
    invoice_lines: ["qty", "net", "vat", "payable", "move_id", "invoice_id", "origin_line_id"],
    invoice_offsets: ["amount", "invoice_id", "counter_id", "account_id"],
  };
  for (const [seed, lock, rounds] of [[11, "", 250], [23, "lock", 250], [7, "", 250]]) {
    it(`tohum ${seed}${lock ? " (kilitli dönem)" : ""}: ${rounds} bozma, eşdeğerlik ihlali yok`, async () => {
      const name = "surum-2.0.26-zincir";
      const today = readFixture(name).oncesi.today;
      const fixture = unpackFixture(name);
      let server = null;
      try {
        server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, gateVerify: true, moneyStrict: false, integrityScan: false });
        const store = server.app.store;
        if (lock) {
          const day = store.get("SELECT MIN(date) AS d FROM cash_entries").d || today;
          const lockDay = new Date(Date.parse(`${day}T00:00:00Z`) + 20 * 86_400_000).toISOString().slice(0, 10);
          const api = await server.login();
          await api.post("/api/companies/select", { id: "sirket-001" });
          const res = await api.put("/api/admin/period-lock", { lockedUntil: lockDay < today ? lockDay : day });
          assert.equal(res.status, 200, JSON.stringify(res.data));
        }
        let state = seed;
        const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
        const pick = list => list[Math.floor(rand() * list.length)];
        const columns = new Map();
        const columnsOf = table => {
          if (!columns.has(table)) columns.set(table, new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name)));
          return columns.get(table);
        };
        const mutate = () => {
          const table = pick(Object.keys(TABLES));
          const n = store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
          if (!n) return null;
          const row = store.get(`SELECT * FROM ${table} LIMIT 1 OFFSET ?`, Math.floor(rand() * n));
          const op = rand();
          if (op < 0.1) return { label: `${table} DELETE ${row.id}`, run: () => store.run(`DELETE FROM ${table} WHERE id = ?`, row.id) };
          if (op < 0.18) {
            const copy = { ...row, id: `fz-${Math.floor(rand() * 1e9)}` };
            const keys = [...columnsOf(table)].filter(key => key in copy);
            return { label: `${table} INSERT kopya ${row.id}`, run: () => store.run(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, ...keys.map(key => copy[key])) };
          }
          if (op < 0.23) return { label: `${table}.id ${row.id}`, run: () => store.run(`UPDATE ${table} SET id = ? WHERE id = ?`, `fz-${Math.floor(rand() * 1e9)}`, row.id) };
          const column = pick(TABLES[table].filter(name => columnsOf(table).has(name)));
          const value = row[column];
          let next;
          if (column === "deleted_at" || column === "closed_at") next = value ? null : `${today}T09:00:00.000Z`;
          else if (typeof value === "number") next = pick([value + 0.01, value + 1, value * 2, 0, -value, value + 100]);
          else if (/date|_on$/.test(column)) next = pick([today, "2025-01-01", "2099-10-20", "2024-02-30", "", "2026-05-01"]);
          else {
            const other = store.get(`SELECT ${column} AS v FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ? LIMIT 1 OFFSET ?`, value ?? "", Math.floor(rand() * 5));
            next = pick([other?.v ?? "", "", other?.v ?? "zzz", "zzz"]);
          }
          if (Object.is(next, value)) return null;
          return { label: `${table}.${column} ${JSON.stringify(value)} → ${JSON.stringify(next)} (${row.id})`, run: () => store.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, next, row.id) };
        };
        // Kapının tetiklenmesi için aynı işlemde zararsız bir para tablosu yazımı (yalnız fatura tablosuna yazım kapıyı tetiklemez — bilinen sınır).
        const touch = () => store.run("UPDATE accounts SET type = type WHERE id = (SELECT id FROM accounts LIMIT 1)");
        const equivalence = [];
        const other = [];
        let accepted = 0;
        let refused = 0;
        for (let round = 0; round < rounds; round += 1) {
          const change = mutate();
          if (!change) continue;
          try {
            store.raw("test: bozma", () => store.tx(() => {
              change.run();
              touch();
            }));
            accepted += 1;
          } catch (error) {
            if (error?.extra?.code === "gate-equivalence") equivalence.push(`${change.label} → ${error.extra.failures.map(item => item.code).join(", ")}`);
            else if (error?.status === 409) refused += 1;
            else if (!/constraint|UNIQUE|CHECK|NOT NULL|datatype|FOREIGN/i.test(error?.message || "")) other.push(`${change.label}: ${error.message}`);
          }
        }
        assert.deepEqual(equivalence, [], `süzgeç "temiz" dedi, tam kapı reddetti:\n${equivalence.join("\n")}`);
        assert.deepEqual(other.slice(0, 5), [], "beklenmeyen hata");
        assert.ok(refused > 0, `bozmaların bir kısmı reddedilmeli (kabul ${accepted}, ret ${refused})`);
      } finally {
        await server?.close().catch(() => {});
        fixture.cleanup();
      }
    });
  }
});
