// 2.4.8 (CI #944 Windows Node 24, T-Kbozuk EPERM): openDatabase bozuk (veri tabanı olmayan) dosyada PRAGMA'da düşünce bağlantıyı
// kapatmıyordu → dosya süreç kapanana kadar açık; Windows'ta silinemez / geri yüklemede değiştirilemez. Bu test yazma ve salt okunur
// açışta hatadan sonra dosyanın serbest olduğunu denetler: her platformda silinebilmeli (Windows'ta asıl kanıt), Linux'ta ayrıca
// /proc/self/fd'de dosyaya bağlı tutamak kalmamalı (kırmızı kanıt Linux'ta da alınır).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase } from "../server/lib/db.mjs";

const openHandlesTo = file => {
  if (process.platform !== "linux") return null;
  return readdirSync("/proc/self/fd").filter(fd => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`) === file;
    } catch {
      return false;
    }
  }).length;
};

describe("openDatabase — bozuk dosyada bağlantı sızmaz (2.4.8)", () => {
  it("yazma açışı: bozuk dosya → hata; dosya açık kalmaz, silinebilir", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-bozuk-"));
    try {
      const file = path.join(dir, "destekofis.sqlite");
      writeFileSync(file, "bu bir veri tabanı değil — bozuk dosya ".repeat(200));
      for (let i = 0; i < 3; i += 1) assert.throws(() => openDatabase(file), "bozuk dosya açılmamalı");
      const handles = openHandlesTo(file);
      if (handles !== null) assert.equal(handles, 0, `bozuk dosyada ${handles} açık tutamak kaldı (3 deneme)`);
      rmSync(file);
      for (const suffix of ["-wal", "-shm"]) rmSync(file + suffix, { force: true });
      assert.equal(existsSync(file), false, "bozuk dosya silinebilmeli");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("salt okunur açış: bozuk dosyada ilk sorgu düşer, çağıranın close'u dosyayı bırakır", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-bozuk-ro-"));
    try {
      const file = path.join(dir, "destekofis.sqlite");
      writeFileSync(file, "bu bir veri tabanı değil — bozuk dosya ".repeat(200));
      let db = null;
      try {
        db = openDatabase(file, { readOnly: true });
        assert.throws(() => db.prepare("SELECT 1 FROM settings").get(), "bozuk dosyada sorgu düşmeli");
      } catch (error) {
        assert.ok(!db, `açış düştüyse bağlantı dönmemeli (${error.message})`);
      } finally {
        db?.close();
      }
      const handles = openHandlesTo(file);
      if (handles !== null) assert.equal(handles, 0, `salt okunurda ${handles} açık tutamak kaldı`);
      rmSync(file);
      assert.equal(existsSync(file), false, "bozuk dosya silinebilmeli");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("sağlam dosya: açılış eskisi gibi (WAL, foreign_keys, busy_timeout)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-saglam-"));
    try {
      const file = path.join(dir, "destekofis.sqlite");
      const db = openDatabase(file);
      try {
        assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
        assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
        assert.equal(db.prepare("PRAGMA busy_timeout").get().timeout, 10_000);
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
