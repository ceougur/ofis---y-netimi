// Drive'a yedek (v2.0.2): klasör yolu kipi, bağlantı ayrıştırma, hata durumunda yerel yedeğin engellenmemesi.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createCloudBackup, parseTarget } from "../server/lib/cloud-backup.mjs";

const memoryStore = () => {
  const settings = new Map();
  return { setting: (key, fallback = "") => settings.get(key) ?? fallback, setSetting: (key, value) => settings.set(key, value) };
};

describe("Drive'a yedek", () => {
  it("bağlantı ve klasör yolu ayrıştırılır; anlamsız metin reddedilir", () => {
    assert.deepEqual(parseTarget("https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOp?usp=sharing"), { mode: "link", folderId: "1AbC_dEf-GhIjKlMnOp", value: "https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOp?usp=sharing" });
    assert.equal(parseTarget("https://drive.google.com/drive/u/1/folders/1AbC_dEf-GhIjKlMnOp").folderId, "1AbC_dEf-GhIjKlMnOp");
    assert.deepEqual(parseTarget("G:\\Drive'ım\\Yedekler\\"), { mode: "folder", path: "G:\\Drive'ım\\Yedekler", value: "G:\\Drive'ım\\Yedekler\\" });
    assert.equal(parseTarget("/home/ali/Drive/Yedek").mode, "folder");
    assert.equal(parseTarget("bir şey"), null);
    assert.equal(parseTarget(""), null);
  });

  it("klasör kipi: 'DestekOfis Yedekleri' açılır, yedek kopyalanır, aynı yedek iki kez kopyalanmaz, eski kopyalar budanır", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "drive-"));
    const backups = mkdtempSync(path.join(tmpdir(), "yedek-"));
    try {
      const store = memoryStore();
      const cloud = createCloudBackup({ store, keep: 2 });
      const status = cloud.configure({ id: "u1" }, root);
      assert.equal(status.enabled, true);
      assert.equal(status.mode, "folder");
      assert.ok(existsSync(path.join(root, "DestekOfis Yedekleri")));
      const files = [];
      for (const name of ["a.sqlite", "b.sqlite", "c.sqlite"]) {
        const file = path.join(backups, name);
        writeFileSync(file, `yedek ${name}`);
        files.push(file);
        const result = await cloud.mirror({ path: file, name });
        assert.equal(result.ok, true, JSON.stringify(result));
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      assert.deepEqual((await cloud.mirror({ path: files[2], name: "c.sqlite" })).reason, "already");
      const copies = readdirSync(path.join(root, "DestekOfis Yedekleri")).sort();
      assert.equal(copies.length, 2, `budama: ${copies.join(", ")}`);
      assert.ok(copies.includes("c.sqlite"));
      const after = cloud.status();
      assert.equal(after.copies, 3);
      assert.equal(after.lastName, "c.sqlite");
      assert.equal(after.lastError, null);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(backups, { recursive: true, force: true });
    }
  });

  it("klasör açılamazsa bağlama reddedilir; kopya hatası yerel yedeği engellemez ve durumda görünür", async () => {
    const store = memoryStore();
    const cloud = createCloudBackup({ store });
    const blocker = mkdtempSync(path.join(tmpdir(), "engel-"));
    writeFileSync(path.join(blocker, "dosya"), "x"); // bir dosyanın altına klasör açılamaz (ENOTDIR)
    try {
      assert.throws(() => cloud.configure({ id: "u1" }, path.join(blocker, "dosya", "yedek")), /Klasör açılamadı/);
    } finally {
      rmSync(blocker, { recursive: true, force: true });
    }
    assert.throws(() => cloud.configure({ id: "u1" }, "rastgele"), /Drive klasör bağlantısı/);
    assert.deepEqual(cloud.configure({ id: "u1" }, ""), { enabled: false });
    // Bağlantı kipi: servis yoksa (404) anlaşılır hata, yerel yedek etkilenmez.
    const linked = createCloudBackup({ store, services: ["https://ornek.invalid/api/lisans"], fetchImpl: async () => ({ status: 404, ok: false, json: async () => ({}) }), license: { summary: () => ({ licenseKey: "DO-TEST" }) } });
    linked.configure({ id: "u1" }, "https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOp");
    const backups = mkdtempSync(path.join(tmpdir(), "yedek-"));
    try {
      const file = path.join(backups, "x.sqlite");
      writeFileSync(file, "x");
      const result = await linked.mirror({ path: file, name: "x.sqlite" });
      assert.equal(result.ok, false);
      assert.match(result.error, /etkin değil/);
      assert.match(linked.status().lastError, /etkin değil/);
    } finally {
      rmSync(backups, { recursive: true, force: true });
    }
  });
});
