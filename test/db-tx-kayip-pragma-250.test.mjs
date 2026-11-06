// 2.5.0 D2 tur 2 (D2 + birleşik tur 5 dar kontrolü 06.11 DÜŞÜK-2, D2 mutantı — yalnız test): BS-6 korumasında (server/lib/db.mjs READ_SQL) yalnız ATAMASIZ PRAGMA okuma
// sayılır; store.get / store.all ile PRAGMA ATAMASI (PRAGMA user_version = …) yazımdır. test/db-tx-kayip-250.test.mjs k4 PRAGMA atamasını yalnız store.exec ile sınıyordu →
// "her PRAGMA okumadır" mutantı (READ_SQL'in PRAGMA dalı /^\s*PRAGMA\b/i) yaşıyordu: kayıptan sonra get("PRAGMA user_version = 77") işlemsiz kesinleşip dosyanın şemasını
// değiştirirdi. Beklenen: get / all ile PRAGMA ataması (boşluk, küçük harf, şema öneki, noktalı virgül biçimleri) ERR_TX_LOST; dosyanın şeması değişmez; atamasız PRAGMA
// (user_version okuma, table_info(t)) çalışır. Kayıp her platformda SQLite'ın belgelenen kendiliğinden geri almasının benzetimiyle (gerçek ROLLBACK + G/Ç hatası; k1 emsali).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { removeTestDir } from "./helpers.mjs";

const ioError = () => Object.assign(new Error("disk I/O error"), { code: "ERR_SQLITE_ERROR", errcode: 778, errstr: "disk I/O error" });
const caught = fn => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

describe("store.get / store.all — kayıptan sonra PRAGMA ataması yazımdır (2.5.0 BS-6, birleşik tur 5)", () => {
  it("kayıptan sonra get / all ile PRAGMA ataması ERR_TX_LOST, dosyanın şeması değişmez; atamasız PRAGMA okuması çalışır", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-tx-kayip-pragma-250-"));
    const raw = openDatabase(path.join(dir, "islem.sqlite"));
    try {
      raw.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); PRAGMA user_version = 5");
      const store = createStore(raw);
      const out = { lost: null, writes: {}, reads: {} };
      const outer = caught(() =>
        store.tx(() => {
          store.run("INSERT INTO t (v) VALUES ('dış önce')");
          caught(() =>
            store.tx(() => {
              store.run("INSERT INTO t (v) VALUES ('iç')");
              raw.exec("ROLLBACK");
              throw ioError();
            }),
          );
          out.lost = raw.isTransaction;
          out.writes["get PRAGMA user_version = 77"] = caught(() => store.get("PRAGMA user_version = 77"));
          out.writes["all PRAGMA user_version = 78"] = caught(() => store.all("PRAGMA user_version = 78"));
          out.writes["get '  pragma main.user_version=79;'"] = caught(() => store.get("  pragma main.user_version=79;"));
          out.reads["get PRAGMA user_version"] = caught(() => store.get("PRAGMA user_version"));
          out.reads["all PRAGMA table_info(t)"] = caught(() => store.all("PRAGMA table_info(t)"));
        }),
      );
      const problems = [];
      if (out.lost !== false) problems.push(`ön koşul yok: iç hatadan sonra bağlantıda işlem ${out.lost} (SQLite geri almadı)`);
      for (const [label, error] of Object.entries(out.writes)) if (error?.code !== "ERR_TX_LOST") problems.push(`${label}: ${error ? `"${error.message}"` : "YAZDI (hata yok)"} — ERR_TX_LOST beklenirdi`);
      for (const [label, error] of Object.entries(out.reads)) if (error) problems.push(`${label}: okuma düştü "${error.message}"`);
      if (outer?.code !== "ERR_TX_LOST") problems.push(`dış işlem "${outer?.message}" ile düştü (ERR_TX_LOST beklenirdi)`);
      const version = Number(raw.prepare("PRAGMA user_version").get().user_version);
      if (version !== 5) problems.push(`dosyanın şeması değişti: user_version ${version} (5 kalmalıydı)`);
      const left = Number(raw.prepare("SELECT COUNT(*) AS n FROM t").get().n);
      if (left) problems.push(`yarım yazım: t tablosunda ${left} satır`);
      assert.deepEqual(problems, [], problems.join("\n"));
    } finally {
      try {
        if (raw.isTransaction) raw.exec("ROLLBACK");
        raw.close();
      } catch {
        // kapatma hatası testin asıl hatasını ezmez (ders 21)
      }
      removeTestDir(dir);
    }
  });
});
