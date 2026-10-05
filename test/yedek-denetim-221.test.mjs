// 2.0.21 madde 7 (kullanıcı: "her şirketin yedeğini sunucuda kendi adıyla klasör açıp yedeklediğini de kontrol et").
// Yedek kökü baştan sona taranır (server/lib/backup-audit.mjs, Yönetim → Yedekler → Yedekleri Denetle):
//   1. Güncel kodla gerçek iş akışı: 4 şirket (Türkçe ve Windows'ta geçersiz karakterli adlar), her birinde cari ve Kasa,
//      Tüm Şirketler / Yalnız yedek, otomatik yedek turu, ad ve kod değişikliği, şirket silme ve aynı kodla yeni şirket.
//   2. GERÇEK v2.0.19 koduyla üretilen veri (git etiketinden; uydurma düzen değil): o sürüm şirket açar, veri girer, kendi
//      yedeklerini kendi yerlerine alır ve 002 → 005 + yeni 002 hatasını yaşar; sonra güncel kod aynı klasörlerde açılır.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, test } from "node:test";
import { companyFolderName, readBackupIdentity } from "../server/lib/backup.mjs";
import { ADMIN_PASSWORD, createClient, loginAdmin, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data);
const today = new Date().toISOString().slice(0, 10);
const sqliteFiles = dir => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sqliteFiles(full));
    else if (entry.name.endsWith(".sqlite")) out.push(full);
  }
  return out;
};
async function fill(client, company, count) {
  for (let i = 1; i <= count; i += 1) {
    const response = await client.post(`/api/workspace/accounts?hofCompany=${company}`, { name: `${company} Müşteri ${i}`, type: "customer", phone: `0532${String(i).padStart(7, "0")}` });
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }
  assert.equal((await client.post(`/api/workspace/cash?hofCompany=${company}`, { kind: "in", amount: 1000 + count, date: today, description: "Açılış" })).status, 200);
}

describe("2.0.21 · yedek denetimi: güncel kodla gerçek iş akışı", () => {
  let server;
  let admin;
  const ids = {};
  before(async () => {
    server = await startTestServer({ maxCompanies: 10 }); // sınırdan (en fazla 2 şirket) önceki çok şirketli kurulum
    admin = await loginAdmin(server);
    assert.equal((await admin.put("/api/admin/office", { name: "Çetin Hukuk Bürosu" })).status, 200);
    await admin.put("/api/companies/sirket-001", { name: "Çetin Hukuk Bürosu" });
    ids.root = "sirket-001";
    ids.demir = data(await admin.post("/api/companies", { name: "Demir İnşaat A.Ş." })).company.id;
    ids.gayri = data(await admin.post("/api/companies", { name: "Gayri Resmî: Ş/Ç" })).company.id;
    ids.kucuk = data(await admin.post("/api/companies", { name: "demir inşaat a.ş." })).company.id;
    for (const [id, count] of [[ids.root, 25], [ids.demir, 15], [ids.gayri, 8], [ids.kucuk, 5]]) await fill(admin, id, count);
  });
  after(() => server.close());

  test("yedekler, ad/kod değişimi, silme, aynı kodla yeni şirket, otomatik tur → her yedek kendi şirketinin klasöründe", async () => {
    assert.equal((await admin.post("/api/admin/backups", { scope: "all" })).status, 200);
    assert.equal((await admin.post("/api/admin/backups", { scope: "one", companyId: ids.demir })).status, 200);
    // 002'nin adı ve kodu değişir (yedekleri yeni klasöre taşınır).
    assert.equal((await admin.put(`/api/companies/${ids.demir}`, { name: "Demir Yapı Ltd.", code: "005" })).status, 200);
    // 003 silinir (önce yedek; klasörü yerinde kalır); aynı kodla yeni şirket açılır.
    assert.equal((await admin.raw("DELETE", `/api/companies/${ids.gayri}`, { body: JSON.stringify({ confirm: "003", password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } })).status, 200);
    ids.yeni = data(await admin.post("/api/companies", { code: "003", name: "Gayri Resmî: Ş/Ç" })).company.id;
    await fill(admin, ids.yeni, 3);
    // Otomatik yedek turu (sunucu açıkken 6 saatte bir koşan tur).
    await server.app.runDueBackups();
    assert.equal((await admin.post("/api/admin/backups", { scope: "all" })).status, 200);

    const audit = await admin.get("/api/admin/backups/audit");
    assert.equal(audit.status, 200);
    const result = data(audit);
    assert.deepEqual(result.errors, [], result.errors.join("\n"));
    assert.equal(result.ok, true);
    const registry = data(await admin.get("/api/companies")).all;
    for (const company of registry) {
      const row = result.companies.find(item => item.id === company.id);
      assert.ok(row, company.code);
      assert.equal(row.folder.toUpperCase().startsWith(`${company.code} - `), true, `${row.folder} kodla başlar`);
      assert.ok(row.count >= 2, `${company.code}: ${row.count} yedek`);
      for (const file of row.files) {
        assert.equal(file.state, "ok", `${row.folder}\\${file.name}`);
        assert.equal(file.identity.id, company.id);
      }
    }
    // Klasör adları: Windows'ta geçersiz karakterler temizlenir; büyük/küçük harfle ayrılan adlar ayrı klasörde (kod farklı).
    const folders = Object.fromEntries(result.companies.map(item => [item.code, item.folder]));
    assert.equal(folders["001"], "001 - Çetin Hukuk Bürosu");
    assert.equal(folders["005"], "005 - Demir Yapı Ltd");
    assert.equal(folders["004"], "004 - demir inşaat a.ş");
    assert.notEqual(folders["003"].toUpperCase(), companyFolderName({ code: "003", name: "Gayri Resmî: Ş/Ç" }).toUpperCase(), "silinen 003'ün dolu klasörü yeni 003'e verilmez");
    // Silinen şirketin klasörü yerinde ve yalnız onun yedekleri (bilgi notu).
    const deletedFolder = path.join(server.backupDir, companyFolderName({ code: "003", name: "Gayri Resmî: Ş/Ç" }));
    assert.ok(existsSync(deletedFolder));
    for (const file of readdirSync(deletedFolder)) assert.equal(readBackupIdentity(path.join(deletedFolder, file))?.id, ids.gayri, file);
    assert.ok(result.notes.some(note => note.includes("Silinmiş bir şirketin")), result.notes.join("\n"));
    // Diskteki her yedek ya yaşayan şirketin klasöründe kendi kimliğiyle ya da silinen şirketin klasöründe.
    for (const file of sqliteFiles(server.backupDir)) {
      const identity = readBackupIdentity(file);
      const folder = path.basename(path.dirname(file));
      if (folder === path.basename(deletedFolder)) continue;
      const owner = result.companies.find(item => item.folder === folder);
      assert.ok(owner, `sahipsiz klasör: ${folder}`);
      assert.equal(identity?.id, owner.id, `${folder}\\${path.basename(file)}`);
    }
  });

  test("denetim yanlış yere konmuş yedeği bulur (elle kopyalanmış: 001'in yedeği 005'in klasöründe)", async () => {
    const result = data(await admin.get("/api/admin/backups/audit"));
    const root = result.companies.find(item => item.code === "001");
    const target = result.companies.find(item => item.code === "005");
    copyFileSync(path.join(server.backupDir, root.folder, root.files[0].name), path.join(server.backupDir, target.folder, root.files[0].name.replace("destekofis-001-", "destekofis-005-")));
    const after = data(await admin.get("/api/admin/backups/audit"));
    assert.equal(after.ok, false);
    assert.ok(after.errors.some(item => item.includes("005 - Demir Yapı Ltd") && item.includes("001 · Çetin Hukuk Bürosu")), after.errors.join("\n"));
  });

  test("yetkisiz kullanıcı denetimi göremez", async () => {
    const created = await admin.post("/api/admin/users", { username: "personel9", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    assert.equal(created.status, 200);
    const staff = createClient(server.base);
    assert.equal((await staff.login("personel9", "Personel-2026!")).status, 200);
    assert.equal((await staff.get("/api/admin/backups/audit")).status, 403);
  });
});

// Gerçek v2.0.19 kodu: git etiketinden geçici klasöre çıkarılır (CI'de etiket yoksa atlanır; yerelde koşar).
const hasTag = (() => {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "v2.0.19^{commit}"], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("2.0.21 · yedek denetimi: gerçek v2.0.19 verisinden güncelleme", { skip: hasTag ? false : "v2.0.19 etiketi yok (git fetch --tags)" }, () => {
  let work;
  let dataDir;
  let backupDir;
  const old = {};
  before(async () => {
    work = mkdtempSync(path.join(tmpdir(), "destekofis-v2019-"));
    const code = path.join(work, "kod");
    mkdirSync(code);
    const tarball = path.join(work, "v2.0.19.tar");
    execFileSync("git", ["archive", "--format=tar", "-o", tarball, "v2.0.19", "server", "package.json"], { cwd: ROOT });
    execFileSync("tar", ["-xf", tarball, "-C", code]);
    dataDir = path.join(work, "data");
    backupDir = path.join(work, "backups");
    const { createApp } = await import(pathToFileURL(path.join(code, "server", "app.mjs")).href);
    const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, maxCompanies: 10 });
    const { port } = await app.listen(0, "127.0.0.1");
    const client = createClient(`http://127.0.0.1:${port}`);
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    // v2.0.19 kullanıcısı: 001'de veri ve yedek; 002 açar, veri girer, yedek alır; 002'nin kodunu 005 yapar; 002 koduyla
    // yeni şirket açar (2.0.19 ona da sirketler/002'yi verir) ve onda da yedek alır.
    const select = async id => assert.equal((await client.post("/api/companies/select", { id })).status, 200);
    for (let i = 1; i <= 12; i += 1) await client.post("/api/workspace/accounts", { name: `Ana Müşteri ${i}`, type: "customer" });
    assert.equal((await client.post("/api/admin/backups")).status, 200);
    old.ikinci = data(await client.post("/api/companies", { name: "İkinci Şirket", select: true })).company.id;
    for (let i = 1; i <= 7; i += 1) await client.post("/api/workspace/accounts", { name: `İkinci Müşteri ${i}`, type: "customer" });
    assert.equal((await client.post("/api/admin/backups")).status, 200);
    assert.equal((await client.put(`/api/companies/${old.ikinci}`, { code: "005" })).status, 200);
    old.yeni = data(await client.post("/api/companies", { code: "002", name: "Yeni İki", select: true })).company.id;
    await client.post("/api/workspace/accounts", { name: "Yeni İki Müşterisi", type: "customer" });
    assert.equal((await client.post("/api/admin/backups")).status, 200);
    await select("sirket-001");
    await app.close();
    // Kanıt: veri gerçekten 2.0.19'un düzeninde (001'in yedeği kökte, adında kod yok; 002'ninki sirket-002 klasöründe).
    const rootFiles = readdirSync(backupDir).filter(name => name.endsWith(".sqlite"));
    assert.ok(rootFiles.length === 1 && /^destekofis-\d{4}-/.test(rootFiles[0]), `2.0.19 düzeni (kök): ${rootFiles.join(", ")}`);
    assert.equal(readdirSync(path.join(backupDir, "sirket-002")).filter(name => name.endsWith(".sqlite")).length, 2, "2.0.19 düzeni: sirket-002'de iki yedek (eski 002 ve aynı klasörü alan yeni 002)");
    assert.equal(readBackupIdentity(path.join(backupDir, rootFiles[0])), null, "2.0.19 yedeğinde kimlik yok");
  });
  after(() => rmSync(work, { recursive: true, force: true }));

  test("2.0.19'un bıraktığı yedekler: güncel kod açılınca her biri kendi şirketinin klasöründe; çakışma bildirilir", async () => {
    // Güncel kod, 2.0.19'un veri ve yedek klasörleriyle (sunucuda güncelleme sonrası açılış gibi).
    const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
    const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, maxCompanies: 10 });
    const { port } = await app.listen(0, "127.0.0.1");
    try {
      const client = createClient(`http://127.0.0.1:${port}`);
      assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
      const companies = data(await client.get("/api/companies"));
      assert.equal(companies.conflicts.length, 1, "2.0.19'un ürettiği çakışma bulunur");
      const result = data(await client.get("/api/admin/backups/audit"));
      assert.deepEqual(result.errors, [], result.errors.join("\n"));
      const byCode = Object.fromEntries(result.companies.map(item => [item.code, item]));
      assert.equal(byCode["001"].count, 1, "001'in 2.0.19 yedeği 001'in klasöründe");
      // 2.0.19 yedekleri kimliksizdir; 005'in (eski 002) yedekleri 005'in klasörüne taşınır, yeni 002'ye geçmez.
      assert.ok(byCode["005"].count >= 1, JSON.stringify(byCode["005"]));
      for (const row of result.companies) for (const file of row.files) assert.notEqual(file.state, "baska-sirket", `${row.folder}\\${file.name}`);
      // Ayır sonrası yeni yedekler kendi klasörüne, kimlikleriyle.
      assert.equal((await client.post(`/api/companies/${old.yeni}/separate`, { confirm: "002", password: ADMIN_PASSWORD })).status, 200);
      assert.equal((await client.post("/api/admin/backups", { scope: "all" })).status, 200);
      const final = data(await client.get("/api/admin/backups/audit"));
      assert.deepEqual(final.errors, [], final.errors.join("\n"));
      assert.equal(data(await client.get("/api/companies")).conflicts.length, 0);
      for (const row of final.companies) assert.ok(row.files.some(file => file.state === "ok" && file.identity.id === row.id), `${row.folder}: kimlikli yeni yedek`);
      // Kayıtlar kaybolmadı: 001'de 12, 005'te 7 (+ yeni 002'nin girdiği kayıt ortak dosyadaydı), yeni 002 kopyada.
      const names = async id => data(await client.get(`/api/workspace/accounts?hofCompany=${id}`)).accounts.length;
      assert.equal(await names("sirket-001"), 12);
      assert.equal(await names(old.ikinci), 8);
      assert.equal(await names(old.yeni), 8);
    } finally {
      await app.close();
    }
  });
});
