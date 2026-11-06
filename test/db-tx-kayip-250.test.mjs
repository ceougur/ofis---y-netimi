// 2.5.0 BS-6 (2.4.9 DB-TX KÖR NOKTA; devir tek işlemde koşacağı için devirden önce): store.tx'in derinliği > 0 iken bağlantıda işlem YOKSA (SQLite işlemi
// kendiliğinden geri aldı — G/Ç hatası, disk dolu — ve çağıran hatayı yakalayıp sürdü) yazım yapılmaz, açık hata fırlatılır. Önceden (yeniden üretildi, gerçek
// SQLite, Linux: iç store.tx'te önbellek taşması WAL'a yazarken RLIMIT_FSIZE → "disk I/O error" → db.isTransaction false, derinlik 1) sonraki store.run
// yazımları işlemsiz, kendiliğinden kesinleşerek diske gidiyordu; iç store.tx'in SAVEPOINT'i işlem dışında YENİ işlem açıp RELEASE ile kapı denetimi olmadan
// kesinleştiriyordu; dış işlem "cannot commit - no transaction is active" ile düşüyor, asıl hata (G/Ç) görünmüyordu → işlemin ilk yarısı geri alınmış,
// ikinci yarısı yazılmış (eski kodda 'dış sonra' 1 satır + para satırı 1).
// Beklenen: store.run / setSetting / iç store.tx / en dış COMMIT "ERR_TX_LOST" fırlatır, ileti ilk hatayı söyler; işlemin hiçbir parçası diskte kalmaz;
// derinlik 0'a döner, sonraki işlemler sağlıklı; işlem canlıyken seçici yakalama (iç işlem geri alınır, dış işlem sürer) bugünkü gibi çalışır.
// Platform (ders 48): dosya boyutu sınırı (prlimit) yalnız Linux'ta gerçek — o blok başka platformda atlanır (`skip` YOK; db-tx-commit-hata-249 emsali), aynı
// hücre her platformda SQLite'ın belgelenen kendiliğinden geri almasının benzetimiyle (gerçek ROLLBACK + hata) de koşar → Linux ve Windows'ta aynı sayıda test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { removeTestDir } from "./helpers.mjs";

const ioError = () => Object.assign(new Error("disk I/O error"), { code: "ERR_SQLITE_ERROR", errcode: 778, errstr: "disk I/O error" });
function fresh() {
  const dir = mkdtempSync(path.join(tmpdir(), "db-tx-kayip-250-"));
  const file = path.join(dir, "islem.sqlite");
  const raw = openDatabase(file);
  raw.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); CREATE TABLE cash_entries (id TEXT PRIMARY KEY, amount REAL); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT, updated_by TEXT);");
  const store = createStore(raw);
  const calls = { check: 0, after: 0, rolledBack: [] };
  store.addCommitGuard({
    check() {
      calls.check += 1;
    },
    after() {
      calls.after += 1;
    },
    rolledBack({ error }) {
      calls.rolledBack.push(error?.code || error?.message);
    },
  });
  return {
    file,
    raw,
    store,
    calls,
    count: (sql, ...args) => Number(raw.prepare(sql).get(...args).n),
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
const caught = fn => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};
const report = problems => assert.deepEqual(problems, [], problems.join("\n"));
/** Hatadan sonra: derinlik 0, açık işlem yok; sonraki iç içe işlem ve işlem dışı para yazımı başarılı. */
function expectHealthy(problems, ctx, label) {
  if (ctx.store.inTransaction !== false) problems.push(`${label}: store.inTransaction = ${ctx.store.inTransaction}`);
  if (ctx.raw.isTransaction !== false) problems.push(`${label}: bağlantıda açık işlem kaldı`);
  const next = caught(() => ctx.store.tx(() => ctx.store.tx(() => ctx.store.run("INSERT INTO t (v) VALUES (?)", `${label} sonraki`))));
  if (next) problems.push(`${label}: sonraki iç içe işlem düştü: ${next.message}`);
  if (ctx.count("SELECT COUNT(*) AS n FROM t WHERE v = ?", `${label} sonraki`) !== 1) problems.push(`${label}: sonraki işlemin yazımı yok`);
  const direct = caught(() => ctx.store.run("INSERT INTO cash_entries (id, amount) VALUES (?, 1)", `${label} doğrudan`));
  if (direct) problems.push(`${label}: işlem dışı para yazımı düştü: ${direct.message}`);
}
/** Kendiliğinden geri alma sonrası yakalayıp süren dış işlem: sonraki her yazım yolu (run, setSetting, iç tx) ERR_TX_LOST; hiçbir parça diskte yok. */
function expectNoHalfWrite(problems, ctx, label, { innerError, after, outer, cause }) {
  if (!innerError) problems.push(`${label}: iç işlem hata vermedi (ön koşul kurulmadı)`);
  if (after.connection !== false) problems.push(`${label}: ön koşul yok — iç hatadan sonra bağlantıda işlem ${after.connection} (SQLite geri almadı)`);
  for (const [path, error] of Object.entries(after.writes)) if (error?.code !== "ERR_TX_LOST") problems.push(`${label}: derinlik > 0, işlem yokken ${path} ${error ? `"${error.message}"` : "YAZDI (hata yok)"} — ERR_TX_LOST beklenirdi`);
  if (outer?.code !== "ERR_TX_LOST") problems.push(`${label}: dış işlem "${outer?.message}" ile düştü (ERR_TX_LOST beklenirdi)`);
  else if (!outer.message.includes(cause)) problems.push(`${label}: ileti ilk hatayı ("${cause}") söylemiyor: ${outer.message}`);
  const left = ["dış önce", "dış sonra", "iç tx sonra"].map(v => [v, ctx.count("SELECT COUNT(*) AS n FROM t WHERE v = ?", v)]).filter(([, n]) => n);
  if (left.length) problems.push(`${label}: yarım yazım — ${JSON.stringify(left)}`);
  if (ctx.count("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'sonra'")) problems.push(`${label}: yarım yazım — para satırı 'sonra'`);
  if (ctx.count("SELECT COUNT(*) AS n FROM settings WHERE key = 'bs6.sonra'")) problems.push(`${label}: yarım yazım — ayar 'bs6.sonra'`);
}
/** Dış işlem: 'dış önce' yazar, iç işlemde lose() ile işlemi kaybettirir, hatayı yakalar (seçici yakalama deseni), sonra her yazım yolunu dener. */
function runLost(ctx, lose) {
  const out = { innerError: null, after: { connection: null, writes: {} }, outer: null };
  out.outer = caught(() => ctx.store.tx(() => {
    ctx.store.run("INSERT INTO t (v) VALUES ('dış önce')");
    out.innerError = caught(() => ctx.store.tx(() => lose()));
    out.after.connection = ctx.raw.isTransaction;
    out.after.writes["store.run (para)"] = caught(() => ctx.store.run("INSERT INTO cash_entries (id, amount) VALUES ('sonra', 100)"));
    out.after.writes["store.run (düz)"] = caught(() => ctx.store.run("INSERT INTO t (v) VALUES ('dış sonra')"));
    out.after.writes["store.setSetting"] = caught(() => ctx.store.setSetting("bs6.sonra", "1"));
    out.after.writes["iç store.tx"] = caught(() => ctx.store.tx(() => ctx.store.run("INSERT INTO t (v) VALUES ('iç tx sonra')")));
  }));
  return out;
}

describe("store.run / store.tx — derinlik > 0 iken bağlantıda işlem yoksa yazım yok, açık hata (2.5.0 BS-6)", () => {
  it("(k1) iç işlemde SQLite işlemi kendiliğinden geri alır, çağıran yakalayıp sürer → sonraki yazımlar ERR_TX_LOST, yarım yazım yok; Linux'ta gerçek G/Ç hatası", () => {
    const problems = [];
    // Her platform: SQLite'ın belgelenen kendiliğinden geri alması (G/Ç hatası, disk dolu) — gerçek ROLLBACK + aynı hata.
    const ctx = fresh();
    try {
      const result = runLost(ctx, () => {
        ctx.store.run("INSERT INTO t (v) VALUES ('iç')");
        ctx.raw.exec("ROLLBACK");
        throw ioError();
      });
      expectNoHalfWrite(problems, ctx, "k1 benzetim", { ...result, cause: "disk I/O error" });
      if (ctx.calls.after !== 0) problems.push(`k1 benzetim: after ${ctx.calls.after} (kesinleşen işlem yok)`);
      expectHealthy(problems, ctx, "k1 benzetim");
    } finally {
      ctx.close();
    }
    // Linux: gerçek dosya boyutu sınırı (RLIMIT_FSIZE) + 8 sayfalık önbellek → iç işlemin büyük yazımı WAL'a taşarken G/Ç hatası, SQLite işlemi geri alır.
    if (process.platform === "linux") {
      const real = fresh();
      const pid = String(process.pid);
      const soft = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
      try {
        real.raw.exec("PRAGMA wal_autocheckpoint = 0");
        for (let i = 0; i < 3; i += 1) real.store.tx(() => real.store.run("INSERT INTO t (v) VALUES (?)", `ısınma ${i}`));
        real.raw.exec("PRAGMA cache_size = 8");
        let wal = 0;
        try {
          wal = statSync(`${real.file}-wal`).size;
        } catch {
          wal = 0;
        }
        const result = runLost(real, () => {
          execFileSync("prlimit", ["--pid", pid, `--fsize=${wal + 64 * 1024}:`]);
          try {
            for (let i = 0; i < 2000; i += 1) real.store.run("INSERT INTO t (v) VALUES (?)", `iç ${i} ${"x".repeat(2000)}`);
          } finally {
            execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
          }
        });
        expectNoHalfWrite(problems, real, "k1 gerçek (RLIMIT_FSIZE)", { ...result, cause: "disk I/O error" });
        if (real.count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'iç %'")) problems.push("k1 gerçek: iç işlemin satırları kaldı");
        real.raw.exec("PRAGMA cache_size = -2000");
        expectHealthy(problems, real, "k1 gerçek");
      } finally {
        execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
        real.close();
      }
    }
    report(problems);
  });

  it("(k2) işlem kayboldu ama sonra yazım yok → en dış COMMIT asıl nedeni söyler (\"cannot commit - no transaction is active\" değil); iç düzeyde RELEASE de", () => {
    const problems = [];
    const ctx = fresh();
    try {
      const outer = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('dış önce')");
        caught(() => ctx.store.tx(() => {
          ctx.raw.exec("ROLLBACK");
          throw ioError();
        }));
      }));
      if (outer?.code !== "ERR_TX_LOST" || !/disk I\/O error/.test(outer.message)) problems.push(`k2 COMMIT: "${outer?.message}" (ERR_TX_LOST + ilk hata beklenirdi)`);
      if (/cannot commit|no transaction|savepoint/i.test(outer?.message || "")) problems.push(`k2 COMMIT: asıl neden örtüldü: ${outer?.message}`);
      if (ctx.count("SELECT COUNT(*) AS n FROM t WHERE v = 'dış önce'")) problems.push("k2: 'dış önce' kaldı");
      expectHealthy(problems, ctx, "k2 COMMIT");
      // İç düzey: iç işlemin fn'i hatayı kendisi yutup normal döner → RELEASE yerine ERR_TX_LOST.
      const nested = caught(() => ctx.store.tx(() => {
        ctx.store.tx(() => {
          ctx.store.run("INSERT INTO t (v) VALUES ('iç yarım')");
          caught(() => ctx.store.tx(() => {
            ctx.raw.exec("ROLLBACK");
            throw ioError();
          }));
        });
      }));
      if (nested?.code !== "ERR_TX_LOST") problems.push(`k2 RELEASE: "${nested?.message}" (ERR_TX_LOST beklenirdi)`);
      if (ctx.count("SELECT COUNT(*) AS n FROM t WHERE v = 'iç yarım'")) problems.push("k2: 'iç yarım' kaldı");
      expectHealthy(problems, ctx, "k2 RELEASE");
    } finally {
      ctx.close();
    }
    report(problems);
  });

  it("(k3) işlem canlıyken seçici yakalama bugünkü gibi: iç işlem geri alınır, dış işlem yazmayı sürdürür ve kesinleşir; işlem dışı yazım etkilenmez", () => {
    const problems = [];
    const ctx = fresh();
    try {
      class Skipped extends Error {}
      ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('satır 1')");
        const error = caught(() => ctx.store.tx(() => {
          ctx.store.run("INSERT INTO t (v) VALUES ('atlanan')");
          throw new Skipped("Aynı adla açık kart var");
        }));
        if (!(error instanceof Skipped)) problems.push(`k3: iç hata ${error?.message}`);
        ctx.store.run("INSERT INTO cash_entries (id, amount) VALUES ('satır 2', 5)");
        ctx.store.setSetting("bs6.canli", "1");
      });
      const rows = ["satır 1", "atlanan"].map(v => ctx.count("SELECT COUNT(*) AS n FROM t WHERE v = ?", v));
      if (JSON.stringify(rows) !== JSON.stringify([1, 0])) problems.push(`k3: satırlar ${JSON.stringify(rows)} (beklenen [1, 0])`);
      if (ctx.count("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'satır 2'") !== 1) problems.push("k3: dış işlemin para satırı yok");
      if (ctx.store.setting("bs6.canli") !== "1") problems.push("k3: ayar yazılmadı");
      if (ctx.calls.after !== 1) problems.push(`k3: after ${ctx.calls.after}`);
      // Derinlik 0: dışarıdan açılmış işlem (iş parçacıklarının anlık görüntü BEGIN'i) ya da işlem dışı yazım ERR_TX_LOST almaz.
      const outside = caught(() => ctx.store.run("INSERT INTO t (v) VALUES ('işlem dışı')"));
      if (outside) problems.push(`k3: işlem dışı yazım düştü: ${outside.message}`);
      expectHealthy(problems, ctx, "k3");
    } finally {
      ctx.close();
    }
    report(problems);
  });
});
