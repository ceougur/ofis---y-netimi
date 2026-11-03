// 2.4.9 DB-TX (R2 dar kontrolünün kapsam dışı bulgusu; gerçek programda zorla üretildi): server/lib/db.mjs store.tx COMMIT'ten önce derinliği azaltıyor,
// COMMIT (ya da iç içe RELEASE, ya da COMMIT sonrası after kancası) düşünce catch derinliği İKİNCİ kez azaltıyordu → −1: "ROLLBACK TO sp_0" asıl hatayı örtüyor
// ("no such savepoint: sp_0"), açık kalan işlem geri alınmıyor, sonraki her store.tx "SAVEPOINT sp_-1" → "near "-": syntax error" (şirket yeniden açılana kadar
// her yazım 500). Ayrıca SQLite işlemi kendiliğinden geri aldığında (G/Ç hatası, disk dolu, OR ROLLBACK) "ROLLBACK" / "ROLLBACK TO" asıl hatayı örtüyordu.
// Beklenen: derinlik her çıkışta TAM BİR KEZ azalır; işlem açıksa tam geri alınır, değilse geri alma denenmez; asıl hata yeniden fırlatılır (geri alma hatası
// ezmez); kapı kancası rolledBack asıl hatayla çağrılır; store.inTransaction bağlantının gerçek durumunu söyler.
// Ölçü: store'a verilen bağlantı bir Proxy ile sarılır — db.exec'e giden her deyim kaydedilir (işlem dizisi: "BEGIN IMMEDIATE", "SAVEPOINT sp_1"…), istenen
// deyimde hata enjekte edilebilir. Her hücre bütün sorunları tek iletide verir (ders 38).
// Platform (ders 48): dosya boyutu sınırı (RLIMIT_FSIZE, prlimit; Node SIGXFSZ'yi yok sayar → yazım EFBIG → SQLite G/Ç hatası) yalnız Linux'ta gerçek; aynı
// hücre her platformda COMMIT'e enjekte edilen G/Ç hatasıyla da koşar. Linux'a özgü kısım başka platformda atlanan bir bloktur (`skip` YOK;
// db-bozuk-dosya-tutamak-248 emsali) → Linux ve Windows'ta aynı sayıda test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const DEAD_LICENSE_URL = "http://127.0.0.1:9"; // ders 30
const NOW = "2026-11-03T09:00:00+03:00"; // sahte saat (ders 13, 22)
const MASKS = /savepoint|syntax error|cannot rollback|cannot commit|geri alma düştü/i;

// ---------- Ölçü ve hata enjeksiyonu ----------
/** db.exec'i kaydeden (ve fault(sql, gerçekDb) bir hata döndürürse onu fırlatan) bağlantı sarması. Öbür üyeler gerçek bağlantıya bağlanır. */
function spied(db, fault) {
  const execs = [];
  const proxy = new Proxy(db, {
    get(target, prop) {
      if (prop === "exec") {
        return sql => {
          execs.push(sql);
          const injected = fault?.(sql, target);
          if (injected) throw injected;
          return target.exec(sql);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy, execs };
}
/** Bir kez ateşlenen hata: deyim `match`'e uyunca before(gerçekDb) çalışır, sonra hata döner. */
const once = (match, make, before = null) => {
  let fired = false;
  return (sql, target) => {
    if (fired || !match.test(sql)) return null;
    fired = true;
    before?.(target);
    return make();
  };
};
const ioError = () => Object.assign(new Error("disk I/O error"), { code: "ERR_SQLITE_ERROR", errcode: 778, errstr: "disk I/O error" });

/** Kendi geçici dosyasında store: ertelenmiş yabancı anahtarlı para tablosu (cash_entries → FINANCIAL; kapı kancası çalışır) + benzersiz kolonlu düz tablo. */
function fresh(fault) {
  const dir = mkdtempSync(path.join(tmpdir(), "db-tx-249-"));
  const file = path.join(dir, "islem.sqlite");
  const raw = openDatabase(file);
  raw.exec(`CREATE TABLE dp (id TEXT PRIMARY KEY);
    CREATE TABLE cash_entries (id TEXT PRIMARY KEY, p TEXT REFERENCES dp(id) DEFERRABLE INITIALLY DEFERRED);
    CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT UNIQUE);`);
  const spy = spied(raw, fault);
  const store = createStore(spy.db);
  const calls = { check: 0, after: 0, rolledBack: [] };
  store.addCommitGuard({
    check() {
      calls.check += 1;
    },
    after() {
      calls.after += 1;
    },
    rolledBack({ error }) {
      calls.rolledBack.push(error?.message);
    },
  });
  return {
    file,
    raw,
    store,
    execs: spy.execs,
    calls,
    count: (table, where, ...args) => Number(raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args).n),
    close() {
      try {
        if (raw.isTransaction) raw.exec("ROLLBACK");
        raw.close();
      } catch {
        // kapatma hatası testin asıl hatasını ezmez (ders 21)
      }
      removeTestDir(dir);
    },
  };
}
function caught(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}
/** Asıl hata çağırana gitti mi (örten ileti yok). */
function expectError(problems, error, pattern, label) {
  if (!error) return problems.push(`${label}: hata fırlatılmadı`);
  if (!pattern.test(error.message)) problems.push(`${label}: asıl hata yerine "${error.message}"`);
}
/** Hatadan sonra: derinlik 0, bağlantıda işlem yok; sonraki iç içe işlem BEGIN IMMEDIATE + SAVEPOINT sp_1 ile açılıp yazar; işlem dışı para yazımı işleme alınır. */
function expectHealthy(problems, ctx, label) {
  if (ctx.store.inTransaction !== false) problems.push(`${label}: store.inTransaction = ${ctx.store.inTransaction}`);
  if (ctx.raw.isTransaction !== false) problems.push(`${label}: bağlantıda açık işlem kaldı (db.isTransaction = ${ctx.raw.isTransaction})`);
  let at = ctx.execs.length;
  const nested = caught(() => ctx.store.tx(() => ctx.store.tx(() => ctx.store.run("INSERT INTO t (v) VALUES (?)", `${label} sonra`))));
  const seq = ctx.execs.slice(at);
  if (nested) problems.push(`${label}: sonraki iç içe işlem düştü: "${nested.message}" (deyimler ${JSON.stringify(seq)})`);
  else if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "SAVEPOINT sp_1", "RELEASE sp_1", "COMMIT"])) problems.push(`${label}: sonraki işlemin deyimleri ${JSON.stringify(seq)}`);
  if (ctx.count("t", "v = ?", `${label} sonra`) !== 1) problems.push(`${label}: sonraki işlemin yazımı yok`);
  at = ctx.execs.length;
  const direct = caught(() => ctx.store.run("INSERT INTO cash_entries (id, p) VALUES (?, NULL)", `${label} doğrudan`));
  const seq2 = ctx.execs.slice(at);
  if (direct) problems.push(`${label}: işlem dışı para yazımı düştü: "${direct.message}"`);
  else if (JSON.stringify(seq2) !== JSON.stringify(["BEGIN IMMEDIATE", "COMMIT"])) problems.push(`${label}: işlem dışı para yazımı işleme alınmadı (deyimler ${JSON.stringify(seq2)})`);
  if (ctx.raw.isTransaction !== false) problems.push(`${label}: sonraki yazımlardan sonra açık işlem kaldı`);
}
const report = problems => assert.deepEqual(problems, [], problems.join("\n"));

/** Linux: bu sürecin dosya boyutu yumuşak sınırı geçici olarak `bytes` (prlimit); fn bitince eski değer geri konur. */
async function withFileSizeLimit(bytes, fn) {
  const pid = String(process.pid);
  const before = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
  execFileSync("prlimit", ["--pid", pid, `--fsize=${bytes}:`]);
  try {
    return await fn();
  } finally {
    execFileSync("prlimit", ["--pid", pid, `--fsize=${before}:`]);
  }
}
const walSize = file => {
  try {
    return statSync(`${file}-wal`).size;
  } catch {
    return 0;
  }
};

describe("store.tx — COMMIT / RELEASE düşerse derinlik ve işlem tutarlı (2.4.9 DB-TX)", () => {
  it("(a1) COMMIT ertelenmiş yabancı anahtar ihlaliyle düşer → asıl hata, işlem tam geri alınır, rolledBack çağrılır, sonraki işlem ve yazım başarılı", () => {
    const ctx = fresh();
    const problems = [];
    try {
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('a1 yarım')");
        ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('a1', 'olmayan')");
      }));
      expectError(problems, error, /FOREIGN KEY constraint failed/, "a1 COMMIT");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "COMMIT", "ROLLBACK"])) problems.push(`a1: deyimler ${JSON.stringify(seq)} (açık kalan işlem bir kez ROLLBACK edilmeli)`);
      if (ctx.count("t", "v = 'a1 yarım'") || ctx.count("cash_entries", "id = 'a1'")) problems.push("a1: yarım yazım kaldı");
      if (ctx.calls.check !== 1 || ctx.calls.after !== 0) problems.push(`a1: kapı kancaları check=${ctx.calls.check} after=${ctx.calls.after}`);
      if (JSON.stringify(ctx.calls.rolledBack) !== JSON.stringify(["FOREIGN KEY constraint failed"])) problems.push(`a1: rolledBack ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "a1");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(a2) COMMIT G/Ç hatasıyla düşer, SQLite işlemi kendiliğinden geri alır → asıl hata, ROLLBACK denenmez; Linux'ta ayrıca gerçek dosya boyutu sınırı", async t => {
    const problems = [];
    // Her platform: COMMIT'e enjekte G/Ç hatası (SQLite'ın kendiliğinden geri alması gerçek ROLLBACK ile kurulur, deyim kaydına girmez).
    const ctx = fresh(once(/^COMMIT$/, ioError, target => target.exec("ROLLBACK")));
    try {
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('a2 yarım')");
        ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('a2', NULL)");
      }));
      expectError(problems, error, /^disk I\/O error$/, "a2 enjekte COMMIT");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "COMMIT"])) problems.push(`a2: deyimler ${JSON.stringify(seq)} (işlem kapalıyken ROLLBACK denenmemeli)`);
      if (ctx.count("t", "v = 'a2 yarım'") || ctx.count("cash_entries", "id = 'a2'")) problems.push("a2: yarım yazım kaldı");
      if (JSON.stringify(ctx.calls.rolledBack) !== JSON.stringify(["disk I/O error"])) problems.push(`a2: rolledBack ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "a2");
    } finally {
      ctx.close();
    }
    // Linux: gerçek RLIMIT_FSIZE — sınır şu anki WAL boyutu + 1 KB (bir sayfalık çerçeve bile sığmaz); COMMIT WAL'a yazarken düşer.
    if (process.platform === "linux") {
      const real = fresh();
      try {
        real.raw.exec("PRAGMA wal_autocheckpoint = 0"); // ölçüm sırasında WAL başa dönmesin (ana dosyaya yazılmasın)
        for (let i = 0; i < 5; i += 1) real.store.tx(() => real.store.run("INSERT INTO t (v) VALUES (?)", `a2 ısınma ${i} ${"x".repeat(3000)}`));
        const limit = walSize(real.file) + 1024;
        const at = real.execs.length;
        const error = await withFileSizeLimit(limit, () => caught(() => real.store.tx(() => {
          real.store.run("INSERT INTO t (v) VALUES (?)", `a2 büyük ${"y".repeat(8000)}`);
          real.store.run("INSERT INTO cash_entries (id, p) VALUES ('a2 gerçek', NULL)");
        })));
        t.diagnostic(`a2 gerçek (Linux RLIMIT_FSIZE ${limit} B): store.tx hatası "${error?.message}" (${error?.code || ""} ${error?.errcode ?? ""}); deyimler ${JSON.stringify(real.execs.slice(at))}; sonra db.isTransaction=${real.raw.isTransaction}`);
        if (!error) problems.push(`a2 gerçek: sınır (${limit} B) altında COMMIT düşmedi — ön koşul kurulamadı`);
        else if (MASKS.test(error.message) || !/I\/O|disk|full/i.test(error.message)) problems.push(`a2 gerçek: asıl hata yerine "${error.message}"`);
        if (!real.execs.slice(at).includes("COMMIT")) problems.push(`a2 gerçek: hata COMMIT'ten önce düştü (deyimler ${JSON.stringify(real.execs.slice(at))})`);
        if (real.count("t", "v LIKE 'a2 büyük%'") || real.count("cash_entries", "id = 'a2 gerçek'")) problems.push("a2 gerçek: yarım yazım kaldı");
        if (real.calls.rolledBack.length !== 1) problems.push(`a2 gerçek: rolledBack ${JSON.stringify(real.calls.rolledBack)}`);
        expectHealthy(problems, real, "a2 gerçek");
        if (real.count("t", "v LIKE 'a2 ısınma%'") !== 5) problems.push("a2 gerçek: önceki kesin yazımlar eksik");
      } finally {
        real.close();
      }
    }
    report(problems);
  });

  it("(a3) işlemin içinde SQLite işlemi kendiliğinden geri alır (INSERT OR ROLLBACK) → asıl hata, ROLLBACK denenmez, rolledBack çağrılır", () => {
    const ctx = fresh();
    const problems = [];
    try {
      ctx.store.run("INSERT INTO t (v) VALUES ('tek')");
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('a3', NULL)");
        ctx.store.run("INSERT OR ROLLBACK INTO t (v) VALUES ('tek')");
      }));
      expectError(problems, error, /UNIQUE constraint failed/, "a3");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE"])) problems.push(`a3: deyimler ${JSON.stringify(seq)} (işlem kapalıyken ROLLBACK denenmemeli)`);
      if (ctx.count("cash_entries", "id = 'a3'")) problems.push("a3: yarım yazım kaldı");
      if (ctx.calls.rolledBack.length !== 1 || !/UNIQUE/.test(ctx.calls.rolledBack[0] || "")) problems.push(`a3: rolledBack ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "a3");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(a4) COMMIT'ten sonra after kancası düşer → kancanın kendi hatası, veri kesin yazılı, geri alma denenmez, derinlik 0", () => {
    const ctx = fresh();
    const problems = [];
    try {
      let thrown = false;
      ctx.store.addCommitGuard({
        check() {},
        after() {
          if (thrown) return;
          thrown = true;
          throw new Error("after kancası düştü");
        },
      });
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('a4', NULL)")));
      expectError(problems, error, /^after kancası düştü$/, "a4");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "COMMIT"])) problems.push(`a4: deyimler ${JSON.stringify(seq)}`);
      if (ctx.count("cash_entries", "id = 'a4'") !== 1) problems.push("a4: kesinleşen yazım yok");
      if (ctx.calls.rolledBack.length) problems.push(`a4: kesinleşen işlem için rolledBack çağrıldı ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "a4");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(a5) geri alma düşerse asıl hata ezilmez; açık kalan işlem store.inTransaction'da görünür", () => {
    const ctx = fresh(once(/^ROLLBACK$/, () => new Error("geri alma düştü")));
    const problems = [];
    try {
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('a5')");
        throw new Error("asıl hata");
      }));
      expectError(problems, error, /^asıl hata$/, "a5");
      if (ctx.raw.isTransaction !== true) problems.push("a5: ön koşul kurulamadı (geri alma düşmedi)");
      else if (ctx.store.inTransaction !== true) problems.push("a5: bağlantıda işlem açıkken store.inTransaction = false (önbellekler kesinleşmemiş veriyi saklar)");
      ctx.raw.exec("ROLLBACK"); // açık kalan işlemi test kapatır
      if (ctx.count("t", "v = 'a5'")) problems.push("a5: yarım yazım kaldı");
      expectHealthy(problems, ctx, "a5");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(b1) iç içe: iç RELEASE düşer (savepoint yerinde) → iç yazımlar geri alınır, asıl hata; dış işlem sürer ve COMMIT olur", () => {
    const ctx = fresh(once(/^RELEASE sp_1$/, () => new Error("RELEASE düştü")));
    const problems = [];
    try {
      let inner = null;
      const at = ctx.execs.length;
      const outer = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('b1 dış')");
        inner = caught(() => ctx.store.tx(() => ctx.store.run("INSERT INTO t (v) VALUES ('b1 iç')")));
        ctx.store.run("INSERT INTO t (v) VALUES ('b1 dış 2')");
      }));
      if (outer) problems.push(`b1: dış işlem düştü: "${outer.message}"`);
      expectError(problems, inner, /^RELEASE düştü$/, "b1 iç");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "SAVEPOINT sp_1", "RELEASE sp_1", "ROLLBACK TO sp_1; RELEASE sp_1", "COMMIT"])) problems.push(`b1: deyimler ${JSON.stringify(seq)}`);
      if (ctx.count("t", "v = 'b1 iç'")) problems.push("b1: geri alınması gereken iç yazım kaldı");
      if (ctx.count("t", "v IN ('b1 dış', 'b1 dış 2')") !== 2) problems.push("b1: dış işlemin yazımları eksik");
      expectHealthy(problems, ctx, "b1");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(b2) iç içe: iç seviyede SQLite işlemi kendiliğinden geri alır → asıl hata iki seviyeden geçer, ROLLBACK TO / ROLLBACK denenmez", () => {
    const ctx = fresh();
    const problems = [];
    try {
      ctx.store.run("INSERT INTO t (v) VALUES ('tek')");
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('b2 dış', NULL)");
        ctx.store.tx(() => ctx.store.run("INSERT OR ROLLBACK INTO t (v) VALUES ('tek')"));
      }));
      expectError(problems, error, /UNIQUE constraint failed/, "b2");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "SAVEPOINT sp_1"])) problems.push(`b2: deyimler ${JSON.stringify(seq)} (işlem kapalıyken geri alma denenmemeli)`);
      if (ctx.count("cash_entries", "id = 'b2 dış'")) problems.push("b2: yarım yazım kaldı");
      if (ctx.calls.rolledBack.length !== 1) problems.push(`b2: rolledBack ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "b2");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(b3) iç içe: ihlal iç savepoint'te, dış COMMIT ertelenmiş yabancı anahtarla düşer → asıl hata, hiçbir yazım kalmaz", () => {
    const ctx = fresh();
    const problems = [];
    try {
      const at = ctx.execs.length;
      const error = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('b3 dış')");
        ctx.store.tx(() => ctx.store.run("INSERT INTO cash_entries (id, p) VALUES ('b3 iç', 'olmayan')"));
      }));
      expectError(problems, error, /FOREIGN KEY constraint failed/, "b3");
      const seq = ctx.execs.slice(at);
      if (JSON.stringify(seq) !== JSON.stringify(["BEGIN IMMEDIATE", "SAVEPOINT sp_1", "RELEASE sp_1", "COMMIT", "ROLLBACK"])) problems.push(`b3: deyimler ${JSON.stringify(seq)}`);
      if (ctx.count("t", "v = 'b3 dış'") || ctx.count("cash_entries", "id = 'b3 iç'")) problems.push("b3: yarım yazım kaldı");
      if (JSON.stringify(ctx.calls.rolledBack) !== JSON.stringify(["FOREIGN KEY constraint failed"])) problems.push(`b3: rolledBack ${JSON.stringify(ctx.calls.rolledBack)}`);
      expectHealthy(problems, ctx, "b3");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(c) gerçek program: cari açmanın COMMIT'i düşer → 500 ve asıl hata günlükte; düzelince cari açma ve Kasa girişi 200 (Linux: ayrıca gerçek dosya boyutu sınırı)", async t => {
    const logged = [];
    const quiet = () => {};
    const server = await startTestServer({ now: NOW, env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, log: { debug: quiet, info: quiet, warn: quiet, error: (message, error) => logged.push(`${message}: ${error?.message || ""}`) } });
    const problems = [];
    try {
      const api = await loginAdmin(server);
      const { store, db } = server.app;
      const cari = (name, note = "") => api.post("/api/workspace/accounts", { name, type: "customer", ...(note ? { note } : {}) });
      const accounts = name => Number(store.get("SELECT COUNT(*) AS n FROM accounts WHERE name = ?", name).n);
      const cash = description => Number(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE description = ?", description).n);
      for (let i = 0; i < 3; i += 1) if ((await cari(`DBTX Isınma ${i}`)).status !== 200) problems.push(`ısınma ${i} açılamadı`);
      /** Hatadan sonra: cari açma ve Kasa girişi 200, kayıtlar veri tabanında; derinlik 0. */
      const recovers = async label => {
        const from = logged.length;
        const next = await cari(`DBTX ${label} Sonraki Cari`);
        if (next.status !== 200) problems.push(`${label}: sonraki cari ${next.status} (${logged.slice(from).join(" | ")})`);
        const at = logged.length;
        const kasa = await api.post("/api/workspace/cash", { kind: "in", amount: "40", description: `DBTX ${label} Kasa` });
        if (kasa.status !== 200) problems.push(`${label}: Kasa girişi ${kasa.status} (${logged.slice(at).join(" | ")})`);
        if (accounts(`DBTX ${label} Sonraki Cari`) !== 1) problems.push(`${label}: sonraki cari veri tabanında yok`);
        if (cash(`DBTX ${label} Kasa`) !== 1) problems.push(`${label}: Kasa girişi veri tabanında yok`);
        if (store.inTransaction !== false || db.isTransaction !== false) problems.push(`${label}: store.inTransaction=${store.inTransaction}, db.isTransaction=${db.isTransaction}`);
      };
      // 1) Her platform: geçici (bağlantıya özgü) tetikleyici cari eklenince ertelenmiş yabancı anahtarı çiğner → COMMIT "FOREIGN KEY constraint failed".
      db.exec(`CREATE TEMP TABLE dbtx_ust (id TEXT PRIMARY KEY);
        CREATE TEMP TABLE dbtx_alt (p TEXT REFERENCES dbtx_ust(id) DEFERRABLE INITIALLY DEFERRED);
        CREATE TEMP TRIGGER dbtx_tetik AFTER INSERT ON main.accounts BEGIN INSERT INTO dbtx_alt (p) VALUES ('olmayan'); END;`);
      let from = logged.length;
      const broken = await cari("DBTX Düşen Cari");
      db.exec("DROP TRIGGER temp.dbtx_tetik");
      const reasons = logged.slice(from);
      t.diagnostic(`FK: cari ${broken.status}; günlük ${JSON.stringify(reasons)}`);
      if (broken.status !== 500) problems.push(`FK: COMMIT'i düşen cari ${broken.status}`);
      if (!reasons.some(line => /FOREIGN KEY constraint failed/.test(line)) || reasons.some(line => MASKS.test(line))) problems.push(`FK: günlükte asıl hata yok: ${JSON.stringify(reasons)}`);
      if (accounts("DBTX Düşen Cari")) problems.push("FK: düşen cari yarım yazıldı");
      await recovers("FK");
      // 2) Linux: gerçek RLIMIT_FSIZE — sınır şirket WAL'ı + 1 KB; büyük notlu cari COMMIT'te WAL'a yazamaz.
      if (process.platform === "linux") {
        const file = resolveDbPath(server.dataDir);
        db.exec("PRAGMA wal_autocheckpoint = 0"); // yalnız bu ölçüm için: WAL başa dönmesin
        try {
          const limit = walSize(file) + 1024;
          from = logged.length;
          const big = await withFileSizeLimit(limit, () => cari("DBTX Büyük Notlu Cari", "n".repeat(2000)));
          const lines = logged.slice(from);
          t.diagnostic(`FSIZE (${limit} B): cari ${big.status}; günlük ${JSON.stringify(lines)}`);
          if (big.status !== 500) problems.push(`FSIZE: sınır (${limit} B) altında yazım ${big.status} — ön koşul kurulamadı`);
          if (!lines.length || lines.some(line => MASKS.test(line)) || !lines.some(line => /I\/O|disk|full/i.test(line))) problems.push(`FSIZE: günlükte asıl hata yok: ${JSON.stringify(lines)}`);
          if (accounts("DBTX Büyük Notlu Cari")) problems.push("FSIZE: düşen cari yarım yazıldı");
          await recovers("FSIZE");
        } finally {
          db.exec("PRAGMA wal_autocheckpoint = 1000");
        }
      }
    } finally {
      await server.close();
    }
    report(problems);
  });
});
