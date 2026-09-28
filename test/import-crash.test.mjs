// Çökme senaryosu (v2.0.6): toplu cari yüklemesi işlem bloğunun ORTASINDA süreç öldürülür (elektrik kesintisi / kapatma).
// Beklenen: veritabanı bozulmaz (integrity_check = ok), yarım işlemden tek satır kalmaz (ROLLBACK), yeniden açılınca
// program normal çalışır ve aynı yükleme baştan yapılabilir. Ayrı süreçte koşar; ana süreç SIGKILL gönderir.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { runMigrations } from "../server/lib/migrations.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("toplu yükleme sırasında çökme: ROLLBACK ve bütünlük", () => {
  it("işlem ortasında öldürülen süreç geride satır bırakmaz; veritabanı sağlam; yükleme yeniden yapılır", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-crash-"));
    const dbPath = path.join(root, "destekofis.sqlite");
    // Şema hazır (göçler), veritabanı kapatılır.
    {
      const store = createStore(openDatabase(dbPath));
      runMigrations(store, { backupDir: path.join(root, "b") });
      store.run("INSERT INTO accounts (id, ref_no, name, created_by, created_at, updated_at) VALUES ('acc-1', '1', 'Önceki Cari', 'u', '2026-01-01', '2026-01-01')");
      store.db.close();
    }
    // Çocuk süreç: tek işlem bloğunda 200 bin satır yazar; ortada "hazır" sinyali verir ve yazmaya devam eder.
    // İçe alma yolu file:// URL'siyle (Windows'ta "D:\..." çıplak yol modül adı sanılır); sinyal writeSync ile
    // (Windows'ta boru üzerinden process.stdout.write eşzamansızdır, döngü bitene dek boruya düşmez).
    const script = path.join(root, "yukle.mjs");
    writeFileSync(
      script,
      `import { writeSync } from "node:fs";
       import { createStore, openDatabase } from ${JSON.stringify(pathToFileURL(path.join(here, "..", "server", "lib", "db.mjs")).href)};
       const store = createStore(openDatabase(${JSON.stringify(dbPath)}));
       store.tx(() => {
         for (let i = 0; i < 200000; i += 1) {
           store.run("INSERT INTO accounts (id, ref_no, name, phone, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'u', '2026-01-01', '2026-01-01')", "acc-crash-" + i, String(1000 + i), "Kesilen Cari " + i, "0532 " + i);
           if (i === 20000) writeSync(1, "YARIDA\\n");
         }
       });
       writeSync(1, "BITTI\\n");`,
    );
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "inherit"] });
    let finished = false;
    let signalled = false;
    const exited = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })));
    await new Promise(resolve => {
      child.stdout.on("data", chunk => {
        const text = String(chunk);
        if (text.includes("BITTI")) finished = true;
        if (text.includes("YARIDA") && !signalled) {
          signalled = true;
          child.kill("SIGKILL"); // elektrik kesildi
          resolve();
        }
      });
      exited.then(resolve);
    });
    const exit = await exited;
    assert.equal(signalled, true, `çocuk süreç sinyal vermeden çıktı (kod ${exit.code}, sinyal ${exit.signal})`);
    assert.equal(finished, false, "süreç işlem bitmeden öldürüldü");
    // Yeniden açılış: bütünlük ve satır sayısı.
    const store = createStore(openDatabase(dbPath));
    assert.equal(store.get("PRAGMA integrity_check").integrity_check, "ok");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM accounts").n, 1, "yarım işlemden tek satır kalmadı; önceki cari duruyor");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM accounts WHERE id LIKE 'acc-crash-%'").n, 0);
    store.db.close();
    // Program aynı veritabanıyla normal açılır ve yükleme baştan yapılır.
    const server = await startTestServer({ dataDir: root });
    try {
      const admin = await loginAdmin(server);
      const matrix = [["Ad Soyad", "Telefon"], ["Kesilen Cari 1", "0532 1"], ["Kesilen Cari 2", "0532 2"]];
      const preview = (await admin.post("/api/workspace/accounts/import/preview", { matrix })).data.data;
      assert.equal(preview.gate.ready, 2);
      const done = (await admin.post("/api/workspace/accounts/import", { matrix, headerAt: 0, roles: preview.roles })).data.data;
      assert.equal(done.created, 2);
      assert.equal((await admin.get("/api/workspace/accounts?status=all")).data.data.total, 3);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
