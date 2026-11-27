// 2.5.1 D4-ÖN İş 1 — kalıcı devir yedeğinin ".yaziliyor" klasörü son adına alınırken Windows yeniden denemesi (docs/devir/2.5.1-DEVAM/d4on-rapor.md §0, maddeler 1–8;
// CI Windows Node 22, 26.11: EPERM). Taşıma GERÇEK yoldan (backups.createDevirBackupFor → lib/devir/devir-backups.mjs) koşar; hata, node:fs'in renameSync'i
// sarılarak (syncBuiltinESMExports: programın named import'ları da sarmalı görür) yalnız ".yaziliyor" → son ad taşımasında enjekte edilir.
// Windows'ta 4. test GERÇEK ön koşulla koşar (klasördeki veri tabanı kopyası açık tutamakla tutulur; ders 18, 20, 48); Linux'ta aynı test enjeksiyonlu eşdeğeriyle
// (test sayısı iki platformda aynı — CI kapısı atlanan test kabul etmez).
// 2.5.1 D4-ÖN tur 2: 2. ve 3. test (uzun etiketler) CI #1115 Windows Node 24'te "unable to open database file" ile düşüyordu — kök neden taşıma değil, veri tabanı
// kopyasının yolu (Windows 260 karakter sınırı; docs/devir/2.5.1-DEVAM/d4ont2-rapor.md §1). Bu iki test Windows'ta o ön koşulun GERÇEK sınamasıdır; yol, yazma
// hatası ve iç dosya taşımaları test/devir-d4on-yol-251.test.mjs'te.
import assert from "node:assert/strict";
import fs, { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { companyOf } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const { listDevirBackups, verifyDevirBackup } = await import("../server/lib/devir/devir-backups.mjs");

const NOW = "2026-11-02T10:00:00+03:00";
const TRANSIENT = ["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"];
const roots = [];
let server = null;
after(async () => {
  await server?.close();
  for (const dir of roots) removeTestDir(dir);
});

async function open() {
  if (server) return server;
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4on-tasima-"));
  roots.push(dir);
  server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
  const admin = await loginAdmin(server);
  const created = await admin.post("/api/companies", { name: "Taşıma İkinci" });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  server.companyId = created.data.data.company.id;
  const dataDir = server.app.companies.dirsOf(companyOf(server.app, server.companyId)).dataDir;
  mkdirSync(path.join(dataDir, "belgeler", "cd"), { recursive: true });
  writeFileSync(path.join(dataDir, "belgeler", "cd", "cd".padEnd(64, "1")), "belge");
  writeFileSync(path.join(dataDir, "secret.key"), "y".repeat(44));
  return server;
}
const company = () => companyOf(server.app, server.companyId);
const folder = () => server.app.backups.folderOf(company());
const fsError = (code, note = "test: enjekte") => Object.assign(new Error(`${code}: ${note}, rename`), { code });

/** node:fs renameSync'i sarar; handler(real, from, to). Dönüş: geri alma. */
function patchRename(handler) {
  const real = fs.renameSync;
  fs.renameSync = (from, to) => handler(real, String(from), String(to));
  syncBuiltinESMExports();
  return () => {
    fs.renameSync = real;
    syncBuiltinESMExports();
  };
}
// Yalnız devir yedeği KLASÖRÜNÜN taşınması (devir-yedekleri/<ad>.yaziliyor); createBackup'ın kendi geçici veri tabanı dosyası (<dosya>.yaziliyor) değil.
const isMove = from => from.endsWith(".yaziliyor") && path.basename(path.dirname(from)) === "devir-yedekleri";

describe("D4-ÖN: devir yedeğinin son adına taşınması (Windows yeniden denemesi)", () => {
  test("geçici hata (EPERM, EBUSY, EACCES, ENOTEMPTY — dört kez) → yeniden denenir, 5. denemede taşınır; yedek Tamam, doğrulama geçer, yarım klasör kalmaz", async () => {
    await open();
    const codes = ["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"];
    let calls = 0;
    const real = []; // Windows'ta antivirüsün GERÇEK geçici hatası da gelebilir (yalnız geçici türde kabul)
    const restore = patchRename((rename, from, to) => {
      if (!isMove(from)) return rename(from, to);
      calls += 1;
      if (calls <= codes.length) throw fsError(codes[calls - 1]);
      try {
        return rename(from, to);
      } catch (error) {
        real.push(error.code);
        throw error;
      }
    });
    let made;
    try {
      made = await server.app.backups.createDevirBackupFor(company(), { label: "devir-oncesi-2026", year: "2026", runId: "d4on-gecici" });
    } finally {
      restore();
    }
    assert.ok(real.every(code => TRANSIENT.includes(code)), JSON.stringify(real));
    assert.equal(calls, 5 + real.length, "dört geçici hata + bir başarılı taşıma");
    assert.ok(existsSync(made.path), "son adlı klasör diskte");
    const listed = listDevirBackups(folder()).filter(item => item.name === made.name);
    assert.deepEqual(listed.map(item => item.state), ["tamam"]);
    assert.ok(!readdirSync(path.dirname(made.path)).some(name => name === `${made.name}.yaziliyor`), "yarım klasör kalmadı");
    assert.equal((await verifyDevirBackup(made.path)).ok, true, "yedeğin her dosyası bildirgeyle aynı");
  });

  test("kalıcı geçici hata (EBUSY hiç bitmez) → sınırlı deneme (12), 503 devir-backup-move + Türkçe neden; yazılmış klasör silinmez, listede Yarım", async () => {
    await open();
    let calls = 0;
    const restore = patchRename((real, from, to) => {
      if (!isMove(from)) return real(from, to);
      calls += 1;
      throw fsError("EBUSY");
    });
    const before = Date.now();
    let failure = null;
    try {
      await server.app.backups.createDevirBackupFor(company(), { label: "devri-yenile-oncesi-2026", year: "2026", runId: "d4on-kalici" });
    } catch (error) {
      failure = error;
    } finally {
      restore();
    }
    const elapsed = Date.now() - before;
    assert.ok(failure, "taşıma olmadıysa yedek başarılı sayılmamalı");
    assert.equal(failure.status, 503, `${failure.status} ${failure.message}`);
    assert.equal(failure.extra?.code, "devir-backup-move");
    assert.equal(failure.extra?.cause, "EBUSY");
    assert.match(failure.message, /son adına alınamadı \(klasördeki bir dosya başka bir programca \(ör\. virüs tarayıcısı\) kullanılıyor\)/);
    assert.match(failure.message, /Yarım Kaldı/);
    assert.equal(calls, 12, "yeniden deneme sınırlı (12 deneme)");
    assert.ok(elapsed >= 3000, `denemeler arası bekleme (~3,3 sn) uygulandı: ${elapsed} ms`);
    const partial = listDevirBackups(folder()).filter(item => item.state === "yarim" && /devri-yenile-oncesi-2026$/.test(item.name));
    assert.equal(partial.length, 1, "yazılmış klasör listede yarım");
    assert.ok(existsSync(path.join(partial[0].dir, "devir-yedegi.json")), "yarım klasörün içeriği tam (bildirge yazılmış)");
  });

  test("yeniden denenmeyen hata (EXDEV) → hemen 503 (tek deneme, bekleme yok); klasör listede Yarım", async () => {
    await open();
    let calls = 0;
    const restore = patchRename((real, from, to) => {
      if (!isMove(from)) return real(from, to);
      calls += 1;
      throw fsError("EXDEV");
    });
    const before = Date.now();
    let failure = null;
    try {
      await server.app.backups.createDevirBackupFor(company(), { label: "devri-geri-al-oncesi-2026", year: "2026", runId: "d4on-exdev" });
    } catch (error) {
      failure = error;
    } finally {
      restore();
    }
    const elapsed = Date.now() - before;
    assert.ok(failure);
    assert.equal(failure.status, 503, `${failure.status} ${failure.message}`);
    assert.equal(failure.extra?.code, "devir-backup-move");
    assert.equal(failure.extra?.cause, "EXDEV");
    // 2.5.1 D4-ÖN tur 2 (DEVİR NEDEN DURDU, kullanıcı kararı 27.11.2026): iletide iç kod yok — kod yalnız makine alanında (cause, yukarıda).
    assert.match(failure.message, /dosya sistemi taşımaya izin vermedi/);
    assert.doesNotMatch(failure.message, /EXDEV/);
    assert.equal(calls, 1, "yeniden denenmeyen türde tek deneme");
    assert.ok(elapsed < 2500, `bekleme yok: ${elapsed} ms`);
    assert.equal(listDevirBackups(folder()).filter(item => item.state === "yarim" && /devri-geri-al-oncesi-2026$/.test(item.name)).length, 1);
  });

  test("açık tutamak: klasördeki veri tabanı kopyası açık tutulurken taşıma düşer (Windows'ta GERÇEK EPERM, Linux'ta eşdeğer enjeksiyon), tutamak bırakılınca yeniden denemeyle taşınır", async () => {
    await open();
    let calls = 0;
    let fd = null;
    const seen = [];
    const late = [];
    const restore = patchRename((real, from, to) => {
      if (!isMove(from)) return real(from, to);
      calls += 1;
      if (calls === 1) {
        const database = readdirSync(from).find(name => name.endsWith(".sqlite"));
        assert.ok(database, "yarım klasörde veri tabanı kopyası");
        fd = openSync(path.join(from, database), "r");
      }
      if (calls === 3 && fd !== null) {
        closeSync(fd);
        fd = null;
      }
      const held = fd !== null;
      try {
        // Linux açık tutamağa rağmen taşır: Windows'un davranışı burada enjekte edilir (tutamak açıkken EPERM). Windows'ta GERÇEK taşıma denenir.
        if (process.platform !== "win32" && held) throw fsError("EPERM", "Linux eşdeğeri: klasörde açık tutamak");
        return real(from, to);
      } catch (error) {
        (held ? seen : late).push(error.code);
        throw error;
      }
    });
    let made;
    try {
      made = await server.app.backups.createDevirBackupFor(company(), { label: "devir-oncesi-2027", year: "2027", runId: "d4on-tutamak" });
    } finally {
      if (fd !== null) closeSync(fd);
      restore();
    }
    // Ön koşul GERÇEKTEN oluştu (ders 20): tutamak açıkken iki deneme de geçici hatayla düştü (Windows'ta işletim sisteminin verdiği hata).
    assert.equal(seen.length, 2, `tutamak açıkken düşen denemeler: ${JSON.stringify(seen)} (platform ${process.platform})`);
    assert.ok(seen.every(code => TRANSIENT.includes(code)), `geçici hata türü: ${JSON.stringify(seen)}`);
    // Tutamak bırakıldıktan sonra Windows'ta antivirüs dosyayı bir süre daha tutabilir (bu paketin konusu): o denemeler de yalnız geçici hatayla düşebilir.
    assert.ok(late.every(code => TRANSIENT.includes(code)), `tutamak bırakıldıktan sonraki hatalar geçici: ${JSON.stringify(late)}`);
    assert.equal(calls, 3 + late.length, "tutamak bırakıldıktan sonra yeniden denemeyle taşındı");
    assert.deepEqual(listDevirBackups(folder()).filter(item => item.name === made.name).map(item => item.state), ["tamam"]);
    assert.equal((await verifyDevirBackup(made.path)).ok, true);
  });
});
