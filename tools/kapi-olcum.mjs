// Kapı ölçümü (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.11 "Kapı ölçeği", Aşama 2 kabulü): mutabakat kapısının tek bir yazımdaki süresi
// 10.000 / 100.000 / 1.000.000 para satırında.
//
// Veri programın KENDİ ürettiği veridir: önce gerçek sunucu (bu dalın kodu) gerçek HTTP API'si üzerinden mutabakat motoruyla
// (test/mutabakat/motor.mjs — cari, Kasa, stok, taksit, fatura (peşin, vadeli, taksitli, iade, iptal), çek/senet; 365 günlük zaman çizelgesi)
// iki şirkette sürülür (tohum). Hacim, tohumun satır satır kopyalanmasıyla büyütülür (her kopya kendi carileri, faturaları, kartları,
// çekleri ve İşlem No'larıyla; tarihleri 0–3 yıl geriye kaydırılır: dört yıllık şirket). Kopyalar tohumun bütün bağlarını taşır (cari ↔
// fatura ↔ stok ↔ taksit ↔ çek ↔ işlem başlığı), mutabakat açılışta tam tarama ile denetlenir (sapma varsa ölçüm durur).
//
// Ölçüm: veri bir kopyada programla açılır (açılış = göç + onarım + kapının taban taraması), sonra API'den tek tek yazılır — Kasa nakit
// girişi, cari havale tahsilatı, peşin satış faturası, taksit tahsilatı, Borç Yaz (para olmayan), çek alış + tahsil. Her yazımda: HTTP süresi,
// kapı süresi (COMMIT öncesi denetimlerin toplamı: mutabakat kapısı + K6 para yazımı denetimi), bölümleri (integrity.stats). Aynısı geçmiş
// dönem kilitliyken (bugün − 45 gün) yinelenir. --kod ile başka bir kod kökü (ör. v2.0.26) aynı veride ölçülür: banka ekinin payı =
// (kapı − v2.0.26 kapısı) / kapı.
//
// Kullanım:
//   node tools/kapi-olcum.mjs --hedef 10000,100000,1000000 [--klasor <dir>] [--tekrar 5] [--kod <kod kökü>] [--json <dosya>] [--yeniden]
//   node tools/kapi-olcum.mjs --hedef 100000 --yalniz-kur           (yalnız veri)
//   node tools/kapi-olcum.mjs --hedef 100000 --kod /tmp/v2026       (aynı veride v2.0.26)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const flag = name => argv.includes(`--${name}`);
const TARGETS = String(opt("hedef", "10000")).split(",").map(Number).filter(n => n > 0);
const DIR = path.resolve(opt("klasor", path.join(os.tmpdir(), "destekofis-kapi-olcum")));
const KOD = path.resolve(opt("kod", ROOT));
const REPEAT = Number(opt("tekrar", "0")) || 0;
const JSON_OUT = opt("json", "");
const NOW = "2026-10-08T12:00:00+03:00";
const LOCK_DAYS = 45;
const PASS = "Kapi-Olcum-2026!";
const SEED = { "001": { seed: 11, operations: Number(opt("tohum-islem", "2500")) }, "002": { seed: 12, operations: Number(opt("tohum-islem-2", "1000")) } };
const SECOND_SHARE = 0.1;
const quiet = { debug() {}, info() {}, warn() {}, error() {} };
const log = (...items) => console.log(...items);
const ms = value => (value === null || value === undefined ? "—" : value >= 100 ? String(Math.round(value)) : value.toFixed(1));

// ---------- Yardımcılar ----------
const addDays = (iso, days) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}${iso.slice(10)}`;
};
const median = list => {
  const sorted = list.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};
const pct = (list, p) => {
  const sorted = list.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
};

async function loadCode(root) {
  const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
  const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
  return { createApp, createClient };
}
function appOptions(dataDir, extra = {}) {
  return {
    dataDir,
    backupDir: path.join(path.dirname(dataDir), "backups"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
    integrityScan: false,
    analysisWorker: false,
    now: NOW,
    moneyStrict: false,
    ...extra,
  };
}
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
async function must(label, promise) {
  const response = await promise;
  if (response.status !== 200) throw new Error(`${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return unwrap(response);
}
// Şirkete yönelik istemci (?hofCompany=).
const scoped = (client, companyId) => {
  if (!companyId) return client;
  const at = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(companyId)}`;
  return { ...client, get: url => client.get(at(url)), post: (url, body) => client.post(at(url), body), put: (url, body) => client.put(at(url), body), del: url => client.del(at(url)), patch: (url, body) => client.patch(at(url), body) };
};
function companyFiles(dataDir) {
  const registry = JSON.parse(readFileSync(path.join(dataDir, "sirketler.json"), "utf8"));
  return registry.companies.filter(company => !company.deletedAt).map(company => ({ id: company.id, code: String(company.code), file: path.join(company.dir ? path.join(dataDir, company.dir) : dataDir, "destekofis.sqlite") }));
}

// ---------- Tohum: gerçek sunucu + mutabakat motoru (iki şirket) ----------
async function buildSeed(seedDir) {
  rmSync(seedDir, { recursive: true, force: true });
  mkdirSync(seedDir, { recursive: true });
  const { createApp, createClient } = await loadCode(ROOT);
  const { runReconciliation } = await import(pathToFileURL(path.join(ROOT, "test", "mutabakat", "motor.mjs")).href);
  const app = createApp(appOptions(path.join(seedDir, "data")));
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  try {
    await must("giriş", client.login("admin", PASS));
    const started = performance.now();
    const first = await runReconciliation({ client, seed: SEED["001"].seed, operations: SEED["001"].operations, verifyEvery: 1e9, reportEvery: 0, burst: 40, span: 365 });
    if (first.mismatches.length) throw new Error(`tohum 001: ${JSON.stringify(first.mismatches.slice(0, 2))}`);
    const company = await must("002", client.post("/api/companies", { name: "Ölçüm İkinci" }));
    const second = await runReconciliation({ client: scoped(client, company.company.id), seed: SEED["002"].seed, operations: SEED["002"].operations, verifyEvery: 1e9, reportEvery: 0, burst: 20, span: 365 });
    if (second.mismatches.length) throw new Error(`tohum 002: ${JSON.stringify(second.mismatches.slice(0, 2))}`);
    log(`tohum: 001 ${first.operations} işlem, 002 ${second.operations} işlem (${Math.round((performance.now() - started) / 1000)} sn)`);
  } finally {
    await app.close();
  }
}

// ---------- Kopyalama: tohumu hacme büyütme ----------
const CLONE_TABLES = ["accounts", "account_entries", "cash_entries", "payments", "plans", "plan_items", "plan_entries", "stock_items", "stock_moves", "cheques", "cheque_events", "invoices", "invoice_lines", "invoice_offsets", "fin_events", "bank_lines"];
const ID = /\b[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g;
const DAY = /^\d{4}-\d{2}-\d{2}/;
async function countMoney(db) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
  const { MONEY_SOURCES, moneyWhere } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "bank", "money-lines.mjs")).href);
  let money = 0;
  for (const table of new Set(MONEY_SOURCES.map(source => source.table))) if (tables.has(table)) money += db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${moneyWhere(table)}`).get().n;
  let rows = 0;
  for (const table of CLONE_TABLES) if (tables.has(table)) rows += db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  return { money, rows };
}
async function grow(file, target) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF;");
  try {
    const seed = {};
    for (const table of CLONE_TABLES) seed[table] = db.prepare(`SELECT * FROM ${table}`).all();
    const ids = new Set();
    for (const rows of Object.values(seed)) for (const row of rows) for (const value of Object.values(row)) if (typeof value === "string") for (const match of value.matchAll(ID)) if (!match[0].startsWith("user-")) ids.add(match[0]);
    const { money: seedMoney } = await countMoney(db);
    const copies = Math.max(0, Math.ceil(target / Math.max(1, seedMoney)) - 1);
    const insert = Object.fromEntries(CLONE_TABLES.filter(table => seed[table].length).map(table => {
      const columns = Object.keys(seed[table][0]);
      return [table, { columns, statement: db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`) }];
    }));
    const maxSeq = new Map(db.prepare("SELECT year, MAX(seq) AS seq FROM fin_events GROUP BY year").all().map(row => [row.year, row.seq]));
    const { eventNoText } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "bank", "event-no.mjs")).href);
    const started = performance.now();
    for (let k = 1; k <= copies; k += 1) {
      const suffix = `~${k}`;
      const shift = -364 * (k % 4);
      const value = item => {
        if (typeof item !== "string") return item;
        let out = item.replace(ID, match => (ids.has(match) ? `${match}${suffix}` : match));
        if (shift && DAY.test(out)) out = addDays(out, shift);
        return out;
      };
      db.exec("BEGIN");
      for (const [table, { columns, statement }] of Object.entries(insert)) {
        for (const row of seed[table]) {
          const next = {};
          for (const column of columns) next[column] = value(row[column]);
          if (table === "accounts" || table === "plans") next.ref_no = next.ref_no ? `${next.ref_no}-${k}` : next.ref_no;
          if (table === "stock_items" && next.code) next.code = `${next.code}-${k}`;
          if (table === "cheques" && next.serial_no) next.serial_no = `${next.serial_no}-${k}`;
          if (table === "invoices") {
            next.ettn = randomUUID();
            if (row.seq > 0) {
              next.year = Number(next.issue_date.slice(0, 4));
              // (seri, yıl, sıra) tekil: tohumdaki (yıl, sıra) çifti kopya içinde tekildir; yıl kaydırılınca da çakışmasın diye kodlanır.
              next.seq = k * 1_000_000 + (row.year - 2000) * 10_000 + row.seq;
              const match = /^(.*?)(\d{4})(\d{9})$/.exec(row.number);
              next.number = match ? `${match[1]}${next.year}${String(next.seq).padStart(9, "0")}` : `${row.number}-${k}`;
            } else if (next.number) next.number = `${row.number}-${k}`;
          }
          if (table === "fin_events") {
            const year = Number(next.date.slice(0, 4));
            const seq = (maxSeq.get(year) || 0) + 1;
            maxSeq.set(year, seq);
            next.year = year;
            next.seq = seq;
            next.no = eventNoText(year, seq);
            if (next.origin_key) next.origin_key = `${next.origin_key}${suffix}`;
            next.request_key = "";
          }
          statement.run(...columns.map(column => next[column] ?? null));
        }
      }
      db.exec("COMMIT");
      if (k % 50 === 0) process.stdout.write(`  kopya ${k}/${copies} (${Math.round((performance.now() - started) / 1000)} sn)\r`);
    }
    for (const [year, seq] of maxSeq) db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(`meta.bank.seq.${year}`, String(seq), new Date(NOW).toISOString());
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const counts = await countMoney(db);
    return { copies, seedMoney, ...counts, seconds: Math.round((performance.now() - started) / 1000) };
  } finally {
    db.close();
  }
}
async function fixture(target) {
  const seedDir = path.join(DIR, "tohum");
  if (!existsSync(path.join(seedDir, "hazir")) || flag("tohum-yeniden")) {
    await buildSeed(seedDir);
    writeFileSync(path.join(seedDir, "hazir"), new Date().toISOString());
  }
  const dir = path.join(DIR, `n-${target}`);
  if (existsSync(path.join(dir, "hazir.json")) && !flag("yeniden")) return { dir, info: JSON.parse(readFileSync(path.join(dir, "hazir.json"), "utf8")) };
  rmSync(dir, { recursive: true, force: true });
  cpSync(seedDir, dir, { recursive: true });
  const info = { target, companies: {} };
  for (const company of companyFiles(path.join(dir, "data"))) {
    const want = company.code === "001" ? target : Math.round(target * SECOND_SHARE);
    info.companies[company.code] = await grow(company.file, want);
    log(`\n  ${target}: ${company.code} → ${info.companies[company.code].money} para satırı, ${info.companies[company.code].rows} satır (${info.companies[company.code].copies} kopya, ${info.companies[company.code].seconds} sn)`);
  }
  writeFileSync(path.join(dir, "hazir.json"), JSON.stringify(info, null, 2));
  return { dir, info };
}

// ---------- Ölçüm ----------
async function measure(fixtureDir, info) {
  const work = path.join(DIR, "calisma");
  rmSync(work, { recursive: true, force: true });
  cpSync(fixtureDir, work, { recursive: true });
  const { createApp, createClient } = await loadCode(KOD);
  const openedAt = performance.now();
  const app = createApp(appOptions(path.join(work, "data")));
  const openMs = performance.now() - openedAt;
  // Kapı süresi her sürümde aynı yoldan: kapının COMMIT denetimi (store.addCommitGuard) sarılır ve kapı yeniden kurulur.
  let guardMs = null;
  const add = app.store.addCommitGuard.bind(app.store);
  app.store.addCommitGuard = guard => add({ ...guard, check(arg) {
    const at = performance.now();
    try {
      return guard.check(arg);
    } finally {
      guardMs = performance.now() - at;
    }
  } });
  const startedAt = performance.now();
  const baseline = app.integrity.start().baseline;
  const startMs = performance.now() - startedAt;
  if (!baseline.ok) throw new Error(`veri tutarsız (açılış taraması): ${baseline.failures.map(item => `${item.code} ${item.sample?.[0] || ""}`).join("; ")}`);
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  const out = { kod: path.basename(KOD), openMs, startMs, writes: [], second: [] };
  try {
    await must("giriş", client.login("admin", PASS));
    const store = app.store;
    const today = NOW.slice(0, 10);
    const account = store.get("SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.type = 'customer' AND a.id NOT LIKE '%~%' ORDER BY a.rowid LIMIT 1").id;
    const item = store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND kind = 'product' AND id NOT LIKE '%~%' ORDER BY rowid LIMIT 1").id;
    const plan = () => store.get("SELECT p.id FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.id NOT LIKE '%~%' AND p.total - COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) > 5 ORDER BY p.rowid LIMIT 1")?.id;
    const record = async (kind, run) => {
      guardMs = null;
      const at = performance.now();
      await run();
      const httpMs = performance.now() - at;
      const tx = store.lastTx || null;
      const stats = app.integrity.stats?.() || null;
      out.writes.push({ phase: out.phase, kind, httpMs, guardMs, moneyMs: tx ? tx.moneyMs + tx.marksMs : null, sections: stats?.gate?.sections || null, path: stats?.gate?.path || "", reason: stats?.gate?.reason || "" });
    };
    const round = async () => {
      await record("Kasa nakit girişi", () => must("kasa", client.post("/api/workspace/cash", { kind: "in", amount: "125,50", method: "cash", description: "Ölçüm", date: today })));
      await record("Cari havale tahsilatı", () => must("cari", client.post(`/api/workspace/accounts/${account}/entries`, { kind: "in", amount: "300", method: "bank", note: "Ölçüm", date: today })));
      await record("Peşin satış faturası", () => must("fatura", client.post("/api/workspace/invoices", { kind: "sale", accountId: account, issueDate: today, lines: [{ itemId: item, name: "", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 120, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true })));
      const planId = plan();
      if (planId) await record("Taksit tahsilatı", () => must("taksit", client.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "5", method: "cash", date: today })));
      await record("Borç Yaz (para olmayan)", () => must("borç", client.post(`/api/workspace/accounts/${account}/entries`, { kind: "debt", amount: "50", note: "Ölçüm", date: today })));
      let cheque = null;
      await record("Çek alış", async () => {
        cheque = await must("çek", client.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", issueDate: today, dueDate: addDays(today, 30), accountId: account, serialNo: `OLC-${randomUUID().slice(0, 8)}`, bank: "Ölçüm" }));
      });
      await record("Çek tahsili", () => must("çek tahsil", client.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: today, method: "bank" })));
    };
    const rounds = REPEAT || (info.companies["001"].money >= 500_000 ? 1 : info.companies["001"].money >= 50_000 ? 3 : 8);
    out.phase = "kilitsiz";
    for (let k = 0; k < rounds; k += 1) await round();
    // Geçmiş dönem kilitli (bugün − 45 gün): kapının kilit izi ve (varsa) kilitli dönem anlık görüntüsü devrede.
    const lockAt = performance.now();
    await must("kilit", client.put("/api/admin/period-lock", { lockedUntil: addDays(today, -LOCK_DAYS) }));
    out.lockMs = performance.now() - lockAt;
    out.phase = "kilitli";
    for (let k = 0; k < rounds; k += 1) await round();
    const scanAt = performance.now();
    const scan = app.integrity.scan ? app.integrity.scan() : { findings: [] };
    out.scanMs = performance.now() - scanAt;
    out.scanFindings = scan.findings?.map(item => item.code) || [];
    // 002: aynı süreçte ikinci şirkete yazım (HTTP süresi).
    const second = (await must("şirketler", client.get("/api/companies"))).companies?.find(company => company.code === "002");
    if (second) {
      const api = scoped(client, second.id);
      for (let k = 0; k < Math.min(rounds, 3); k += 1) {
        const at = performance.now();
        await must("002 kasa", api.post("/api/workspace/cash", { kind: "in", amount: "10", method: "cash", description: "Ölçüm 002", date: today }));
        out.second.push(performance.now() - at);
      }
    }
  } finally {
    await app.close();
    rmSync(work, { recursive: true, force: true });
  }
  return out;
}

function summarize(target, info, result) {
  const lines = [];
  const by = phase => result.writes.filter(item => item.phase === phase);
  const sectionsOf = list => {
    const keys = new Set(list.flatMap(item => Object.keys(item.sections || {})));
    return Object.fromEntries([...keys].map(key => [key, median(list.map(item => item.sections?.[key] ?? 0))]));
  };
  const rows = {};
  for (const phase of ["kilitsiz", "kilitli"]) {
    const list = by(phase);
    const gate = list.map(item => (item.guardMs ?? 0) + (item.moneyMs ?? 0));
    const paths = {};
    for (const item of list) if (item.path) paths[`${item.path}${item.reason ? ` (${item.reason})` : ""}`] = (paths[`${item.path}${item.reason ? ` (${item.reason})` : ""}`] || 0) + 1;
    rows[phase] = { paths, count: list.length, gateMedian: median(gate), gateP95: pct(gate, 95), gateMax: Math.max(...gate), httpMedian: median(list.map(item => item.httpMs)), moneyMedian: median(list.map(item => item.moneyMs)), sections: sectionsOf(list), byKind: Object.fromEntries([...new Set(list.map(item => item.kind))].map(kind => [kind, median(list.filter(item => item.kind === kind).map(item => (item.guardMs ?? 0) + (item.moneyMs ?? 0)))])) };
  }
  const c1 = info.companies["001"];
  lines.push(`\n=== ${target.toLocaleString("tr-TR")} hedef · kod ${result.kod} · 001: ${c1.money.toLocaleString("tr-TR")} para satırı / ${c1.rows.toLocaleString("tr-TR")} defter satırı · 002: ${info.companies["002"]?.money?.toLocaleString("tr-TR") ?? "—"} para satırı`);
  lines.push(`açılış ${ms(result.openMs)} ms · kapı kurulumu (taban taraması) ${ms(result.startMs)} ms · kilit koyma ${ms(result.lockMs)} ms · tam tarama ${ms(result.scanMs)} ms${result.scanFindings?.length ? ` (bulgu: ${result.scanFindings.join(", ")})` : ""}`);
  for (const [phase, row] of Object.entries(rows)) {
    lines.push(`${phase}: ${row.count} yazım · kapı ortanca ${ms(row.gateMedian)} ms, p95 ${ms(row.gateP95)}, en çok ${ms(row.gateMax)} · HTTP ortanca ${ms(row.httpMedian)} ms · K6 ${ms(row.moneyMedian)} ms`);
    lines.push(`  tür: ${Object.entries(row.byKind).map(([kind, value]) => `${kind} ${ms(value)}`).join(" · ")}`);
    if (Object.keys(row.paths).length) lines.push(`  kapı yolu: ${Object.entries(row.paths).map(([key, value]) => `${key} ${value}`).join(" · ")}`);
    if (Object.keys(row.sections).length) lines.push(`  bölüm (ortanca ms): ${Object.entries(row.sections).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key} ${ms(value)}`).join(" · ")}`);
  }
  if (result.second.length) lines.push(`002 Kasa yazımı HTTP ortanca ${ms(median(result.second))} ms`);
  return { text: lines.join("\n"), rows };
}

const report = [];
for (const target of TARGETS) {
  const { dir, info } = await fixture(target);
  if (flag("yalniz-kur")) {
    log(`${target}: veri hazır (${dir})`);
    continue;
  }
  const result = await measure(dir, info);
  const { text, rows } = summarize(target, info, result);
  log(text);
  report.push({ target, info, kod: result.kod, openMs: result.openMs, startMs: result.startMs, lockMs: result.lockMs, scanMs: result.scanMs, rows, writes: result.writes, second: result.second });
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
