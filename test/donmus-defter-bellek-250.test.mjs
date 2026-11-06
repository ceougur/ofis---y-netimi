// 2.5.0 Ç3 tamamlama — büyük veride bellek (docs/erp/C3-DONDURMA-TASARIM.md §16; ders 47). Bulgu: 1.000.000 satırlık şirkette kilit konunca dondurma iş parçacığı Ana Defter'i
// türetirken (routes/ledger.mjs rows → store.all) yığın doldu: süreç ya "FATAL ERROR … StatementSync::All" ile çöktü ya da dondurma "memory limit" ile düştü; koşu bekliyordu, her
// açılışta yeniden denendi. Kök neden: node:sqlite'ın all()'ı her satırı sözlük kipli nesne kurar (~1,35 KB / satır). Düzeltme lib/lean-rows.mjs (satırlar tek tek, hızlı kipli
// nesnelerle; yinelenen kısa metinler tek kopya), donmuş satırlar parça parça, donmuş okuma ve Kural Değişikliği Farkı dizi kurmadan. Davranış AYNEN: B1 / B3 eşdeğerlik.
// Veri: B3 / B4 eski sürümün (v2.0.16 → v2.0.26) GERÇEK koduyla üretilmiş zincir fikstürü (test/fixtures/surum-2.0.26-zincir), programın göçleriyle güncel şemaya.
// Eski kodda (Ç3 ucu 40ad9bed) kırmızı: lib/lean-rows.mjs yok (B1, B2, B3, B5). B4 eski kodda da geçer (parça parça yazım zaten vardı; davranışın aynı kaldığını gösterir).
// Belleğin kendisi büyük veride ölçülür: test/donmus-defter-olcum-cekirdek-250.mjs (100.000 / 1.000.000 satır; bellek sınırlı deneme node --max-old-space-size).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClock } from "../server/lib/clock.mjs";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { runMigrations } from "../server/lib/migrations.mjs";
import { createPeriod } from "../server/lib/period.mjs";
import { createRouter } from "../server/lib/router.mjs";
import { registerLedgerRoutes } from "../server/routes/ledger.mjs";
import { buildRule249 } from "../server/lib/ledger-rule-249/index.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEAN = pathToFileURL(path.join(ROOT, "server", "lib", "lean-rows.mjs")).href;
const lean = () => import(LEAN);
const NOW = "2027-01-10T10:00:00+03:00";
// Bütün geçmişi okuyan kaynak sorguları (Ana Defter türetmesi): bunlar store.all ile değil sıkı satırlarla okunmalı.
const SOURCE_SQL = /\bFROM (payments|cash_entries|account_entries|plans|plan_entries|invoices|stock_moves|cheque_events|cheques|cheque_collections|bank_lines)\b/;
const FROZEN_SQL = /FROM ledger_snapshots WHERE date <= \? AND date >= \?/;
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const silent = { info() {}, warn() {}, error() {} };
// Kural Değişikliği Farkı'nın ÖNCEKİ uygulaması (Ç3 ucu 40ad9bed lib/ledger-snapshots.mjs ruleDiff; iki dizi, birleşik anahtar kümesi) — akışlı uygulama bununla birebir olmalı.
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const contentOf = entry => `${entry.date}|${entry.lines.map(line => `${line.account}/${line.sub || ""}/${line.party || ""}/${line.debit}/${line.credit}`).sort().join(";")}`;
function referenceRuleDiff(frozenList, liveList, through) {
  const keyed = list => {
    const out = new Map();
    const seen = new Map();
    for (const entry of list) {
      if (entry.date > through || String(entry.id).startsWith("voucher")) continue;
      const n = (seen.get(entry.id) || 0) + 1;
      seen.set(entry.id, n);
      out.set(`${entry.id}#${n}`, entry);
    }
    return out;
  };
  const frozen = keyed(frozenList);
  const current = keyed(liveList);
  const sums = new Map();
  const add = (entry, side) => {
    if (!entry) return;
    for (const line of entry.lines) {
      const key = `${entry.date.slice(0, 4)}|${line.account}|${line.sub || ""}|${line.party || ""}`;
      const row = sums.get(key) || { frozen: 0, live: 0 };
      row[side] += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      sums.set(key, row);
    }
  };
  let count = 0;
  const sample = [];
  for (const key of new Set([...frozen.keys(), ...current.keys()])) {
    const a = frozen.get(key);
    const b = current.get(key);
    if (a && b && contentOf(a) === contentOf(b)) continue;
    count += 1;
    if (sample.length < 5) sample.push(`${(a || b).id} (${dayText((a || b).date)})${a ? "" : " · donmuş defterde yok"}${b ? "" : " · güncel türetmede yok"}`);
    add(a, "frozen");
    add(b, "live");
  }
  const balances = [];
  for (const [key, row] of sums) {
    if (row.frozen === row.live) continue;
    const [year, account, sub, party] = key.split("|");
    balances.push({ year: Number(year), account, sub, party, frozenMinor: row.frozen, liveMinor: row.live, differenceMinor: row.live - row.frozen });
  }
  balances.sort((x, y) => x.year - y.year || x.account.localeCompare(y.account) || x.sub.localeCompare(y.sub) || x.party.localeCompare(y.party));
  return { through, count, sample, balances };
}
// store.all çağrılarını kaydeden depo (sıkı okuma store.db'den gider, buraya düşmez).
function spyOf(store) {
  const seen = [];
  const spy = Object.create(store);
  spy.all = (sql, ...args) => {
    seen.push(String(sql));
    return store.all(sql, ...args);
  };
  return { spy, seen };
}

describe("2.5.0 Ç3 tamamlama — büyük okumada sıkı satırlar (lib/lean-rows.mjs)", () => {
  it("B1: leanAll / leanRows = store.all — aynı anahtarlar, aynı sıra, aynı değerler (metin, tamsayı, ondalık, NULL, BLOB, büyük tamsayı; konumlu ve adlı parametre); tutma sınırı aşılınca da", async () => {
    const { leanAll, leanRows } = await lean();
    const db = new DatabaseSync(":memory:");
    const store = createStore(db);
    db.exec("CREATE TABLE t (id TEXT, kind TEXT, amount REAL, n INTEGER, note TEXT, blob BLOB, big INTEGER)");
    const insert = db.prepare("INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (let i = 0; i < 300; i += 1) insert.run(`satir-${i}`, ["debt", "credit", "in"][i % 3], i % 7 === 0 ? null : i * 1.25, i, i % 5 === 0 ? null : `not ${i % 11}`, i % 9 === 0 ? new Uint8Array([i % 256, 1, 2]) : null, 2 ** 40 + i);
    const sql = "SELECT id, kind, amount, n, note, blob, big AS büyük FROM t WHERE n >= ? ORDER BY n";
    const flat = rows => rows.map(row => Object.entries(row));
    assert.deepStrictEqual(flat(leanAll(store, sql, 10)), flat(store.all(sql, 10)), "konumlu parametre");
    const named = "SELECT id, kind, note FROM t WHERE kind = :kind ORDER BY n";
    assert.deepStrictEqual(flat(leanAll(store, named, { kind: "in" })), flat(store.all(named, { kind: "in" })), "adlı parametre");
    assert.deepStrictEqual(flat(Array.from(leanRows(store, sql, [0], { limit: 2 }))), flat(store.all(sql, 0)), "kolon başına tutma sınırı aşılınca değerler aynı");
    assert.deepStrictEqual(flat(leanAll(store, "SELECT id FROM t WHERE n < 0")), [], "boş sonuç");
    // store.db yoksa (sahte depo) store.all'a düşer.
    const fake = { all: (q, ...args) => store.all(q, ...args) };
    assert.deepStrictEqual(flat(leanAll(fake, sql, 290)), flat(store.all(sql, 290)));
    db.close();
  });

  it("B2: sıkı satırlar V8'in hızlı kipinde (ayrı süreç, --allow-natives-syntax: %HasFastProperties); store.all'ın satırı bilgi için ölçülür", () => {
    const code = `
      import { DatabaseSync } from "node:sqlite";
      import { createStore } from ${JSON.stringify(pathToFileURL(path.join(ROOT, "server", "lib", "db.mjs")).href)};
      import { leanAll } from ${JSON.stringify(LEAN)};
      const fast = new Function("o", "return %HasFastProperties(o)");
      const db = new DatabaseSync(":memory:");
      const cols = Array.from({ length: 18 }, (_, i) => "c" + i);
      db.exec("CREATE TABLE t (" + cols.map(c => c + " TEXT").join(", ") + ")");
      const insert = db.prepare("INSERT INTO t VALUES (" + cols.map(() => "?").join(", ") + ")");
      for (let i = 0; i < 200; i += 1) insert.run(...cols.map((c, j) => j % 3 ? c + "-" + (i % 4) : "kimlik-" + i + "-" + j));
      const store = createStore(db);
      const sql = "SELECT " + cols.join(", ") + " FROM t";
      const leanRows = leanAll(store, sql);
      const allRows = store.all(sql);
      console.log(JSON.stringify({ rows: leanRows.length, lean: leanRows.every(fast), all: allRows.every(fast) }));
    `;
    const run = spawnSync(process.execPath, ["--allow-natives-syntax", "--disable-warning=ExperimentalWarning", "--input-type=module", "-e", code], { encoding: "utf8" });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const result = JSON.parse(run.stdout.trim().split(/\r?\n/).pop());
    assert.equal(result.rows, 200);
    assert.equal(result.lean, true, `sıkı satırlar hızlı kipte olmalı (store.all'ın satırı hızlı kipte mi: ${result.all})`);
  });

  it("B5: 2.4.9 kural kopyasını çağıran her yer sıkı depoyla çağırır (kaynak taraması; kopyanın kendisi değişmez)", () => {
    const calls = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "ledger-rule-249") walk(full);
        } else if (entry.name.endsWith(".mjs")) {
          readFileSync(full, "utf8").split(/\r?\n/).forEach((line, index) => {
            if (/^\s*(\/\/|\*)/.test(line)) return;
            for (const match of line.matchAll(/buildRule249\(([^)]*)\)?/g)) calls.push({ file: path.relative(ROOT, full).split(path.sep).join("/"), line: index + 1, arg: match[1] });
          });
        }
      }
    };
    walk(path.join(ROOT, "server"));
    // Beklenen çağıranlar: donmuş defter (ana iş parçacığı, kural kayıt defteri) ve dondurma iş parçacığı.
    assert.deepEqual([...new Set(calls.map(call => call.file))].sort(), ["server/lib/ledger-freeze-worker.mjs", "server/lib/ledger-snapshots.mjs"], `çağıranlar: ${JSON.stringify(calls)}`);
    const raw = calls.filter(call => !call.arg.startsWith("leanStore("));
    assert.deepEqual(raw, [], `buildRule249 sıkı depo olmadan çağrılıyor: ${JSON.stringify(raw)}`);
  });
});

describe("2.5.0 Ç3 tamamlama — türetme ve donmuş defter sıkı satırlarla (eski sürüm verisi, güncel şema)", () => {
  let fixture;
  let db;
  let store;
  let file;
  let period;
  const now = createClock({ time: NOW, fixed: true });
  let lockA;
  let lockB;
  before(() => {
    fixture = unpackFixture("surum-2.0.26-zincir");
    file = path.join(fixture.dataDir, "destekofis.sqlite");
    db = openDatabase(file);
    store = createStore(db);
    runMigrations(store, { backupDir: null, log: silent });
    period = createPeriod({ store, now });
    const days = store.all("SELECT DISTINCT date FROM account_entries WHERE date <> '' ORDER BY date").map(row => row.date);
    assert.ok(days.length > 10, `fikstürde cari hareketi var: ${days.length} gün`);
    lockA = days[Math.floor(days.length / 3)];
    lockB = days[Math.floor((days.length * 2) / 3)];
  });
  after(() => {
    try {
      db?.close();
    } catch {
      // kapalı
    }
    fixture?.cleanup();
  });
  const ledgerOf = (target, extra = {}) => registerLedgerRoutes(createRouter(), { store: target, now, auth: null, audit: () => {}, events: null, period, integrity: () => null, money: null, config: {}, log: silent, ...extra });

  it("B3: Ana Defter türetmesi (güncel kural ve 2.4.9 kopyası) kaynak satırlarını store.all ile okumaz; çıktı store.all'lı türetmeyle BİREBİR; donmuş okuma ve Kural Değişikliği Farkı da store.all'sız", async () => {
    const plain = Object.create(store, { db: { value: undefined } });
    const { spy, seen } = spyOf(store);
    const current = ledgerOf(spy).build();
    assert.deepEqual(seen.filter(sql => SOURCE_SQL.test(sql)), [], "güncel kural: kaynak sorguları store.all'a düşmemeli");
    const reference = ledgerOf(plain).build();
    assert.ok(reference.length > 100, `türetme boş değil: ${reference.length}`);
    assert.deepStrictEqual(current, reference, "güncel kural: sıkı satırlı türetme = store.all'lı türetme (madde madde, bütün alanlar)");
    seen.length = 0;
    const { leanStore } = await lean();
    const copy = buildRule249(leanStore(spy));
    assert.deepEqual(seen.filter(sql => SOURCE_SQL.test(sql)), [], "2.4.9 kopyası: kaynak sorguları store.all'a düşmemeli");
    assert.deepStrictEqual(copy, buildRule249(plain), "2.4.9 kopyası: sıkı depoyla = store.all'la");
    // Donmuş defter (eşzamanlı kip; dosya yolu yok): kilit + 2.4.9 kuralıyla dondurma aynı işlemde; okuma ve fark denetimi.
    const ledger = ledgerOf(spy);
    const S = ledger.snapshots;
    seen.length = 0;
    spy.tx(() => {
      period.setLock(lockA);
      S.freezeSync({ through: lockA, rule: "2.4.9", reason: "api" });
    });
    assert.deepEqual(seen.filter(sql => SOURCE_SQL.test(sql)), [], "dondurma (2.4.9 kuralı, ana iş parçacığı): kaynak sorguları store.all'a düşmemeli");
    assert.equal(S.coverage(), lockA);
    seen.length = 0;
    const frozen = S.entries();
    assert.deepStrictEqual(canon(frozen), canon(copy.filter(entry => entry.date <= lockA)), "donmuş maddeler = 2.4.9 kopyasının türetmesi (kilit gününe kadar)");
    assert.deepStrictEqual(canon(S.entries({ from: lockA.slice(0, 4) + "-01-01", to: lockA })), canon(copy.filter(entry => entry.date >= lockA.slice(0, 4) + "-01-01" && entry.date <= lockA)), "aralıklı okuma");
    const diff = S.ruleDiff();
    assert.equal(diff.count, 0, `kural değişmedi: fark yok (${JSON.stringify(diff.sample)})`);
    assert.deepEqual(seen.filter(sql => FROZEN_SQL.test(sql) || SOURCE_SQL.test(sql)), [], "donmuş okuma ve fark denetimi store.all'a düşmemeli");
    // Fark varsa (benzetim: güncel türetmede bir madde değişti, biri eksildi, biri iki kez, biri yeni) sayı, örnek sırası ve tutarlar önceki uygulamayla aynı.
    const tweak = entries => [
      ...entries.filter((entry, index) => index !== 1).map((entry, index) => (index === 0 ? { ...entry, lines: entry.lines.map(line => ({ ...line, debit: line.debit ? line.debit + 100 : 0, credit: line.credit ? line.credit + 100 : 0 })) } : entry)),
      { ...entries[2] },
      { ...entries[3], id: "test:ek-madde" },
    ];
    const changed = ledgerOf(spy, { __testLedgerRule: { fn: tweak } });
    const live = changed.build();
    const shifted = S.ruleDiff({ live });
    assert.ok(shifted.count >= 1, `benzetimde fark görünür: ${JSON.stringify(shifted)}`);
    assert.deepStrictEqual(shifted, referenceRuleDiff(frozen, live, lockA), "akışlı fark denetimi = önceki (dizili) uygulamanın sonucu: sayı, örnekler ve sırası, tutarlar");
  });

  it("B4: iş parçacığı kipi — donmuş satırlar parça parça üretilir (parça 7 satır: tam parçalar + eksik son parça); yazılan = türetilen (sayı, borç, alacak), donmuş = canlı; koşunun toplamları satırlarla aynı", async () => {
    const batches = [];
    const ledger = ledgerOf(store, { config: { dbPath: file }, freezeBatchLines: 7, __testFreezeHook: { fn: (phase, info) => phase === "batch" && batches.push(info.done) } });
    const S = ledger.snapshots;
    // B3'ten bağımsız: dondurulacak aralık o anki kapsamdan (B3 koştuysa lockA, koşmadıysa baştan).
    const start = S.coverage();
    assert.ok(start < lockB, `kapsam ${start} < ${lockB}`);
    store.tx(() => {
      const value = period.setLock(lockB);
      S.lockChanged({ next: value, user: { id: "bellek", display_name: "Bellek Testi" }, reason: "lock" });
    });
    const done = await S.runPending();
    assert.equal(done.phase, "tamam", JSON.stringify(done));
    assert.equal(S.coverage(), lockB);
    const expected = canon(ledger.build().filter(entry => entry.date > start && entry.date <= lockB));
    const lines = expected.reduce((sum, entry) => sum + entry.lines.length, 0);
    assert.ok(lines > 7, `birden çok parça: ${lines} satır`);
    assert.equal(done.total, lines, "iş parçacığının toplamı = türetilen satır sayısı");
    assert.equal(batches.length, Math.ceil(lines / 7), `parça sayısı: ${JSON.stringify(batches)}`);
    assert.equal(batches.at(-1), lines, "son parça eksik değil");
    assert.deepStrictEqual(canon(S.entries().filter(entry => entry.date > start)), expected, "yeni dönem güncel kuralla: donmuş = canlı");
    const run = store.get("SELECT * FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
    const sums = store.get("SELECT COUNT(*) AS n, SUM(debit_minor) AS d, SUM(credit_minor) AS c FROM ledger_snapshots WHERE run = ?", run.no);
    assert.deepEqual([Number(run.line_count), Number(run.debit_minor), Number(run.credit_minor)], [Number(sums.n), Number(sums.d), Number(sums.c)], "koşu başlığı = yazılan satırlar");
    await S.close();
  });
});
