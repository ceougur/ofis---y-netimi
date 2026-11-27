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

// 2.5.0 BİRLEŞİK TUR 5 madde 1 (AH dar kontrol ORTA-1; süzgeçle — defter / veri): BS-6 store.run / setSetting / iç tx / COMMIT'i koruyordu; store.exec ve yazım yapan
// store.get / store.all (RETURNING) korunmuyordu — dar kontrol betiği (dk-ah/betik/bs6-exec-gercek.mjs, bs6-mesru.mjs) GERÇEK SQLite'ta üretti: kayıptan sonra exec INSERT diske
// gidiyor, DROP TABLE uygulanıyor, get(INSERT … RETURNING) satır yazıyor; ileti yine "yazım yapılmadı" diyordu. Programdaki yollar: göçün `PRAGMA user_version` adımı
// (migrations.mjs runMigrations), Şirket Verisini Sıfırla'nın tetikleyici DROP / CREATE'i (ledger-vouchers.mjs withTriggersLifted, ledger-snapshots.mjs clearSnapshots).
// Beklenen: derinlik > 0 iken bağlantıda işlem yoksa exec ve yazım yapabilen get / all ERR_TX_LOST; diskte hiçbir parça yok (satır 0, tablo / tetikleyici duruyor, user_version
// değişmez); açıkça okuma olan deyim (SELECT, atamasız PRAGMA) engellenmez. İşlemi kendiliğinden geri aldıran hata bir OKUMA ya da exec ise ileti onu "ilk hata" diye söyler
// (Linux'ta gerçek: işlem içindeki SELECT önbelleği taşırırken G/Ç hatası — eski kodda ileti ilk hatasız). İşlem canlıyken (meşru yollar) yanlış ERR_TX_LOST yok.
// Platform (ders 48): gerçek G/Ç hatası (prlimit) yalnız Linux'ta; aynı hücreler her platformda gerçek ROLLBACK benzetimiyle de koşar (aynı sayıda test).
const lostState = ctx => ({
  rows: ctx.count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'dış%' OR v LIKE 'exec%' OR v LIKE 'döner%'"),
  tables: ctx.count("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('t', 'settings', 'kalici')"),
  trigger: ctx.count("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name = 'kalici_degismez'"),
  version: Number(ctx.raw.prepare("PRAGMA user_version").get().user_version),
});
/** Kayıptan sonra exec / get / all yazım yolları: her biri ERR_TX_LOST; açıkça okuma olan deyimler çalışır. */
function lostWrites(ctx) {
  const writes = {
    "exec INSERT": () => ctx.store.exec("INSERT INTO t (v) VALUES ('exec sonra')"),
    "exec DROP TABLE": () => ctx.store.exec("DROP TABLE kalici"),
    "exec DROP TRIGGER (Sıfırla yolu)": () => ctx.store.exec("DROP TRIGGER IF EXISTS kalici_degismez"),
    "exec PRAGMA user_version (göç yolu)": () => ctx.store.exec("PRAGMA user_version = 77"),
    "get INSERT … RETURNING": () => ctx.store.get("INSERT INTO t (v) VALUES ('döner get') RETURNING id"),
    "all INSERT … RETURNING": () => ctx.store.all("INSERT INTO t (v) VALUES ('döner all 1'), ('döner all 2') RETURNING id"),
    "get UPDATE (RETURNING'siz)": () => ctx.store.get("UPDATE t SET v = 'dış güncel' WHERE v = 'ısınma'"),
    "all DELETE … RETURNING": () => ctx.store.all("DELETE FROM kalici RETURNING id"),
    "get WITH … INSERT": () => ctx.store.get("WITH x(v) AS (VALUES ('döner with')) INSERT INTO t (v) SELECT v FROM x"),
  };
  const out = {};
  for (const [name, fn] of Object.entries(writes)) out[name] = caught(fn);
  const reads = {};
  reads.select = caught(() => ctx.store.get("SELECT COUNT(*) AS n FROM t"));
  reads.pragma = caught(() => ctx.store.get("PRAGMA user_version"));
  reads.tableInfo = caught(() => ctx.store.all("PRAGMA table_info(t)"));
  return { writes: out, reads };
}
function prepareLostWorld(ctx) {
  ctx.raw.exec("CREATE TABLE kalici (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO kalici (v) VALUES ('ilk'); CREATE TRIGGER kalici_degismez BEFORE UPDATE ON kalici BEGIN SELECT RAISE(ABORT, 'değişmez'); END; INSERT INTO t (v) VALUES ('ısınma'); PRAGMA user_version = 5");
  return lostState(ctx);
}
function expectLostWrites(problems, label, result, before, after) {
  for (const [name, error] of Object.entries(result.writes)) if (error?.code !== "ERR_TX_LOST") problems.push(`${label}: kayıptan sonra ${name} ${error ? `"${error.message}"` : "YAZDI (hata yok)"} — ERR_TX_LOST beklenirdi`);
  for (const [name, error] of Object.entries(result.reads)) if (error) problems.push(`${label}: kayıptan sonra okuma (${name}) engellendi: ${error.message}`);
  if (JSON.stringify(after) !== JSON.stringify(before)) problems.push(`${label}: diskte değişiklik — önce ${JSON.stringify(before)}, sonra ${JSON.stringify(after)} (satır / tablo / tetikleyici / user_version aynı kalmalı)`);
}

describe("store.exec / store.get / store.all — kayıptan sonra yazım yok, ilk hata okuma / exec hatasında da (2.5.0 BİRLEŞİK TUR 5)", () => {
  it("(k4) kayıptan sonra exec INSERT / DROP TABLE / DROP TRIGGER / PRAGMA user_version ve get / all ile yazım (RETURNING, UPDATE, WITH) → ERR_TX_LOST, diskte değişiklik yok; okuma çalışır; Linux'ta gerçek G/Ç hatası", () => {
    const problems = [];
    const ctx = fresh();
    try {
      const before = prepareLostWorld(ctx);
      let result = null;
      const outer = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('dış önce')");
        caught(() => ctx.store.tx(() => {
          ctx.raw.exec("ROLLBACK");
          throw ioError();
        }));
        result = lostWrites(ctx);
      }));
      if (outer?.code !== "ERR_TX_LOST") problems.push(`k4 benzetim: dış işlem "${outer?.message}" (ERR_TX_LOST beklenirdi)`);
      expectLostWrites(problems, "k4 benzetim", result, before, lostState(ctx));
      expectHealthy(problems, ctx, "k4 benzetim");
    } finally {
      ctx.close();
    }
    if (process.platform === "linux") {
      const real = fresh();
      const pid = String(process.pid);
      const soft = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
      try {
        const before = prepareLostWorld(real);
        real.raw.exec("PRAGMA wal_autocheckpoint = 0");
        for (let i = 0; i < 3; i += 1) real.store.tx(() => real.store.run("INSERT INTO t (v) VALUES (?)", `ısınma ${i}`));
        const warm = lostState(real);
        real.raw.exec("PRAGMA cache_size = 8");
        let wal = 0;
        try {
          wal = statSync(`${real.file}-wal`).size;
        } catch {
          wal = 0;
        }
        let inner = null;
        let connection = null;
        let result = null;
        const outer = caught(() => real.store.tx(() => {
          real.store.run("INSERT INTO t (v) VALUES ('dış önce')");
          inner = caught(() => real.store.tx(() => {
            execFileSync("prlimit", ["--pid", pid, `--fsize=${wal + 64 * 1024}:`]);
            try {
              for (let i = 0; i < 2000; i += 1) real.store.run("INSERT INTO t (v) VALUES (?)", `iç ${i} ${"x".repeat(2000)}`);
            } finally {
              execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
            }
          }));
          connection = real.raw.isTransaction;
          real.raw.exec("PRAGMA cache_size = -2000");
          result = lostWrites(real);
        }));
        if (!inner) problems.push("k4 gerçek: iç işlem hata vermedi (ön koşul kurulmadı)");
        if (connection !== false) problems.push(`k4 gerçek: ön koşul yok — iç hatadan sonra bağlantıda işlem ${connection}`);
        if (outer?.code !== "ERR_TX_LOST" || !/disk I\/O error/.test(outer.message)) problems.push(`k4 gerçek: dış işlem "${outer?.message}" (ERR_TX_LOST + ilk hata beklenirdi)`);
        if (result) expectLostWrites(problems, "k4 gerçek (RLIMIT_FSIZE)", result, { ...warm }, lostState(real));
        if (before.version !== warm.version) problems.push("k4 gerçek: ısınma user_version'ı değiştirdi");
        expectHealthy(problems, real, "k4 gerçek");
      } finally {
        execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
        real.close();
      }
    }
    report(problems);
  });

  it("(k5) işlemi kendiliğinden geri aldıran hata bir OKUMA ya da exec ise ERR_TX_LOST iletisi onu \"ilk hata\" diye söyler; Linux'ta gerçek: işlem içindeki SELECT önbelleği taşırırken G/Ç hatası", () => {
    const problems = [];
    const ctx = fresh();
    try {
      // Benzetim (her platform): işlem kayboldu, ilk görülen hata bir okuma (store.get) — ardından gelen yazım ERR_TX_LOST + o hata.
      for (const [label, fail, cause] of [
        ["okuma (get)", () => ctx.store.get("SELECT * FROM yok_okuma"), "no such table: yok_okuma"],
        ["okuma (all)", () => ctx.store.all("SELECT * FROM yok_liste"), "no such table: yok_liste"],
        ["setting", () => {
          ctx.raw.exec("ALTER TABLE settings RENAME TO settings_gizli");
          try {
            return ctx.store.setting("bs6.okuma");
          } finally {
            ctx.raw.exec("ALTER TABLE settings_gizli RENAME TO settings");
          }
        }, "no such table: settings"],
      ]) {
        let first = null;
        const outer = caught(() => ctx.store.tx(() => {
          ctx.store.run("INSERT INTO t (v) VALUES ('dış önce')");
          ctx.raw.exec("ROLLBACK");
          first = caught(fail);
          ctx.store.run("INSERT INTO t (v) VALUES ('dış sonra')");
        }));
        if (!first) problems.push(`k5 ${label}: ön koşul yok — okuma hata vermedi`);
        if (outer?.code !== "ERR_TX_LOST" || !outer.message.includes(`(ilk hata: ${cause})`)) problems.push(`k5 ${label}: "${outer?.message}" — ERR_TX_LOST + "(ilk hata: ${cause})" beklenirdi`);
        if (ctx.count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'dış%'")) problems.push(`k5 ${label}: yarım yazım`);
        expectHealthy(problems, ctx, `k5 ${label}`);
      }
      // exec hatası (benzetim): exec'in kendi deyimi işlemi bitirir ve hata verir (doğrudan store.exec, iç işlem yok; çağıran yakalayıp sürer).
      const execLost = caught(() => ctx.store.tx(() => {
        ctx.store.run("INSERT INTO t (v) VALUES ('dış önce')");
        if (!caught(() => ctx.store.exec("ROLLBACK; SELECT * FROM yok_exec"))) problems.push("k5 exec: ön koşul yok — exec hata vermedi");
        ctx.store.run("INSERT INTO t (v) VALUES ('dış sonra')");
      }));
      if (execLost?.code !== "ERR_TX_LOST" || !execLost.message.includes("(ilk hata: no such table: yok_exec)")) problems.push(`k5 exec: "${execLost?.message}" — ERR_TX_LOST + "(ilk hata: no such table: yok_exec)" beklenirdi`);
      if (ctx.count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'dış%'")) problems.push("k5 exec: yarım yazım");
      expectHealthy(problems, ctx, "k5 exec");
    } finally {
      ctx.close();
    }
    if (process.platform === "linux") {
      const real = fresh();
      const pid = String(process.pid);
      const soft = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
      try {
        real.raw.exec("CREATE TABLE big (id INTEGER PRIMARY KEY, v TEXT); PRAGMA wal_autocheckpoint = 0");
        real.store.tx(() => {
          for (let i = 0; i < 3000; i += 1) real.store.run("INSERT INTO big (v) VALUES (?)", `büyük ${i} ${"y".repeat(1500)}`);
        });
        real.raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        let readError = null;
        let connection = null;
        const outer = caught(() => real.store.tx(() => {
          real.raw.exec("PRAGMA cache_size = -20000");
          for (let i = 0; i < 400; i += 1) real.store.run("INSERT INTO t (v) VALUES (?)", `dış önce ${i} ${"x".repeat(2000)}`);
          let wal = 0;
          try {
            wal = statSync(`${real.file}-wal`).size;
          } catch {
            wal = 0;
          }
          real.raw.exec("PRAGMA cache_size = 8");
          execFileSync("prlimit", ["--pid", pid, `--fsize=${wal + 32 * 1024}:`]);
          try {
            readError = caught(() => real.store.all("SELECT id, length(v) AS n FROM big ORDER BY v DESC"));
          } finally {
            execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
          }
          connection = real.raw.isTransaction;
          real.raw.exec("PRAGMA cache_size = -2000");
          real.store.run("INSERT INTO t (v) VALUES ('dış sonra')");
        }));
        if (!readError || !/disk I\/O error/.test(readError.message)) problems.push(`k5 gerçek: ön koşul yok — SELECT G/Ç hatası vermedi (${readError?.message})`);
        if (connection !== false) problems.push(`k5 gerçek: ön koşul yok — okuma hatasından sonra bağlantıda işlem ${connection} (SQLite geri almadı)`);
        if (outer?.code !== "ERR_TX_LOST" || !outer.message.includes("(ilk hata: disk I/O error)")) problems.push(`k5 gerçek (okuma G/Ç): "${outer?.message}" — ERR_TX_LOST + "(ilk hata: disk I/O error)" beklenirdi`);
        if (real.count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'dış%'")) problems.push("k5 gerçek: yarım yazım");
        expectHealthy(problems, real, "k5 gerçek");
      } finally {
        execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
        real.close();
      }
    }
    report(problems);
  });

  it("(k6) meşru yollar yanlış ERR_TX_LOST almaz: iç işlemde yakalanan kısıt hatası, iç içe JS hatası, işlem içinde okunamayan tablo + exec DDL + PRAGMA, işlem içinde exec / get RETURNING yazımı, store.raw, işlem dışı exec / get yazımı", () => {
    const problems = [];
    const ctx = fresh();
    try {
      ctx.raw.exec("CREATE TABLE tekil (id INTEGER PRIMARY KEY, v TEXT UNIQUE)");
      const rows = () => ctx.count("SELECT COUNT(*) AS n FROM tekil");
      const cases = [
        ["iç kısıt hatası yakalanır, dış sürer", () => ctx.store.tx(() => {
          ctx.store.run("INSERT INTO tekil (v) VALUES ('a')");
          caught(() => ctx.store.tx(() => ctx.store.run("INSERT INTO tekil (v) VALUES ('a')")));
          caught(() => ctx.store.tx(() => ctx.store.get("INSERT INTO tekil (v) VALUES ('a') RETURNING id")));
          ctx.store.run("INSERT INTO tekil (v) VALUES ('b')");
          ctx.store.setSetting("bt5.k6", "1");
        }), 2],
        ["iç içe JS hatası", () => ctx.store.tx(() => {
          ctx.store.tx(() => {
            ctx.store.run("INSERT INTO tekil (v) VALUES ('c')");
            caught(() => ctx.store.tx(() => {
              ctx.store.exec("INSERT INTO tekil (v) VALUES ('d')");
              throw new Error("iş kuralı");
            }));
          });
          ctx.store.run("INSERT INTO tekil (v) VALUES ('e')");
        }), 2],
        ["okunamayan tablo + exec DDL + PRAGMA + okuma PRAGMA'sı", () => ctx.store.tx(() => {
          caught(() => ctx.store.get("SELECT * FROM yok_tablo"));
          caught(() => ctx.store.exec("SELECT * FROM yok_tablo_exec"));
          ctx.store.exec("CREATE TABLE IF NOT EXISTS u (id INTEGER)");
          ctx.store.exec("PRAGMA foreign_keys = ON");
          ctx.store.exec("PRAGMA user_version = 9");
          ctx.store.all("PRAGMA table_info(u)");
          ctx.store.run("INSERT INTO tekil (v) VALUES ('f')");
        }), 1],
        ["işlem içinde exec / get / all yazımı (canlı)", () => ctx.store.tx(() => {
          ctx.store.exec("INSERT INTO tekil (v) VALUES ('g')");
          ctx.store.get("INSERT INTO tekil (v) VALUES ('h') RETURNING id");
          ctx.store.all("INSERT INTO tekil (v) VALUES ('i'), ('j') RETURNING id");
          ctx.store.get("WITH x(v) AS (VALUES ('k')) INSERT INTO tekil (v) SELECT v FROM x");
        }), 5],
        ["iç işlemde exec'in DDL hatası (işlem canlı kalır)", () => ctx.store.tx(() => {
          ctx.store.run("INSERT INTO tekil (v) VALUES ('o')");
          caught(() => ctx.store.tx(() => ctx.store.exec("CREATE TABLE iki_kez (id INTEGER); CREATE TABLE iki_kez (id INTEGER)")));
          caught(() => ctx.store.exec("INSERT INTO tekil (v) VALUES ('o')"));
          ctx.store.run("INSERT INTO tekil (v) VALUES ('p')");
        }), 2],
        ["store.raw içinde", () => ctx.store.tx(() => ctx.store.raw("deneme", () => ctx.store.exec("INSERT INTO tekil (v) VALUES ('l')"))), 1],
        ["işlem dışı exec / get yazımı", () => {
          ctx.store.exec("INSERT INTO tekil (v) VALUES ('m')");
          ctx.store.get("INSERT INTO tekil (v) VALUES ('n') RETURNING id");
        }, 2],
      ];
      for (const [label, fn, added] of cases) {
        const before = rows();
        const error = caught(fn);
        if (error) problems.push(`k6 ${label}: hata "${error.code || ""} ${error.message}" (meşru yol)`);
        if (rows() - before !== added) problems.push(`k6 ${label}: eklenen ${rows() - before} (beklenen ${added})`);
        if (ctx.raw.isTransaction) problems.push(`k6 ${label}: bağlantıda açık işlem kaldı`);
      }
      if (Number(ctx.raw.prepare("PRAGMA user_version").get().user_version) !== 9) problems.push("k6: işlem içindeki PRAGMA user_version kesinleşmedi");
      if (ctx.store.setting("bt5.k6") !== "1") problems.push("k6: ayar yazılmadı");
      expectHealthy(problems, ctx, "k6");
    } finally {
      ctx.close();
    }
    report(problems);
  });
});
