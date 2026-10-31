// 2.4.8 İş P1 birim testleri: store.probeWritable (lib/db.mjs) ve kilit işareti (lib/write-lock.mjs); POS valör kuyruğu kilitte turu atlar (lib/bank/pos.mjs).
// probeWritable: kilitsizde true; başka bağlantı kilitliyken ≤ 0,5 sn içinde false; işlem içindeyken null (sınanmaz — "bilinmiyor → bugünkü yol"); her durumda busy_timeout
// sonra BUSY_TIMEOUT_MS (10 sn) — kullanıcı yazımları kısalmaz.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { createPosQueue } from "../server/lib/bank/pos.mjs";
import { BUSY_TIMEOUT_MS, createStore, openDatabase } from "../server/lib/db.mjs";
import { createWriteLock } from "../server/lib/write-lock.mjs";
import { removeTestDir } from "./helpers.mjs";

function fresh() {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-yazim-kilidi-"));
  const file = path.join(dir, "veri.sqlite");
  const db = openDatabase(file);
  db.exec("CREATE TABLE t (x INTEGER)");
  return { dir, file, db, store: createStore(db) };
}
const busyOf = store => Number(Object.values(store.get("PRAGMA busy_timeout"))[0]);

describe("2.4.8 İş P1 — store.probeWritable ve yazım kilidi işareti", () => {
  it("kilitsizde true, busy_timeout 10 sn kalır", () => {
    const t = fresh();
    try {
      assert.equal(t.store.probeWritable(), true);
      assert.equal(busyOf(t.store), BUSY_TIMEOUT_MS, "busy_timeout geri alındı");
      assert.equal(BUSY_TIMEOUT_MS, 10_000);
    } finally {
      t.db.close();
      removeTestDir(t.dir);
    }
  });

  it("başka bağlantı kilitliyken ≤ 0,5 sn içinde false; busy_timeout yine 10 sn", () => {
    const t = fresh();
    const other = new DatabaseSync(t.file);
    try {
      other.exec("BEGIN EXCLUSIVE");
      const t0 = Date.now();
      assert.equal(t.store.probeWritable(), false);
      assert.ok(Date.now() - t0 <= 500, `kısa sınama (${Date.now() - t0} ms)`);
      assert.equal(busyOf(t.store), BUSY_TIMEOUT_MS, "busy_timeout geri alındı");
      other.exec("ROLLBACK");
      assert.equal(t.store.probeWritable(), true, "kilit kalkınca true");
    } finally {
      other.close();
      t.db.close();
      removeTestDir(t.dir);
    }
  });

  it("işlem içindeyken sınanmaz (null) ve işlem bozulmaz", () => {
    const t = fresh();
    try {
      const inside = t.store.tx(() => {
        t.store.run("INSERT INTO t (x) VALUES (1)");
        return t.store.probeWritable();
      });
      assert.equal(inside, null, "işlem içinde null");
      assert.equal(t.store.get("SELECT COUNT(*) AS n FROM t").n, 1, "işlem tamamlandı");
      assert.equal(busyOf(t.store), BUSY_TIMEOUT_MS);
    } finally {
      t.db.close();
      removeTestDir(t.dir);
    }
  });

  it("createWriteLock: kilitte işaretler ve işaret süresi boyunca yeniden sınamaz; süre dolunca kalkar; sınama null ise yazılabilir sayar", () => {
    let clock = 1_000;
    let probes = 0;
    let result = false;
    const store = { probeWritable: () => (probes += 1, result) };
    const lock = createWriteLock({ backoffMs: 30_000, now: () => clock });
    assert.equal(lock.guard("s1", store), false, "kilitli");
    assert.equal(lock.isMarked("s1"), true);
    assert.equal(lock.guard("s1", store), false, "işaretliyken");
    assert.equal(probes, 1, "işaretliyken yeniden sınanmaz");
    assert.equal(lock.isMarked("s2"), false, "şirket başına");
    clock += 30_001;
    result = true;
    assert.equal(lock.guard("s1", store), true, "süre dolunca yeniden sınanır");
    result = null;
    assert.equal(lock.guard("s1", store), true, "bilinmiyor → yazılabilir (bugünkü yol)");
    lock.mark("s1");
    assert.equal(lock.guard("s1", store), false, "mark() işaretler");
    const off = createWriteLock({ probe: false });
    assert.equal(off.guard("s1", { probeWritable: () => false }), true, "sınama kapalıyken (yalnız test) true");
  });

  it("POS valör kuyruğu: yazılamıyorken tur runQueue çağırmaz", async () => {
    let ran = 0;
    let writable = false;
    const queue = createPosQueue({ pos: () => ({ isReady: () => true, runQueue: () => (ran += 1, { remaining: 0 }), autoDrafts: () => {} }), canWrite: () => writable, minutes: 60 });
    queue.start();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ran, 0, "kilitte tur atlandı");
    writable = true;
    queue.kick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ran, 1, "yazılabilir olunca tur çalıştı");
    queue.stop();
  });
});
