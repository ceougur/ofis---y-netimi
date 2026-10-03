// Yedek ve çoklu şirket (2.0.20, CLAUDE.md 2.0.20 madde 9 — kullanıcı: "her şirketin yedeği kendi isminde klasör açılıp
// buna girmeli"). Her şirketin yedeği <yedek kökü>/<kod> - <ad>/ klasöründe, adında şirket kodu, içinde şirket kimliği;
// Yedek Al "Tüm Şirketler" / "Yalnız <kod · ad>"; liste bütün şirketler + Şirket; otomatik yedek ve Drive bütün
// şirketler (açılmamış olsa da); eski yerlerden taşıma; ad/kod değişince klasör; yanlış şirkete geri yükleme 409.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { BACKUP_NAME, companyFolderName, createBackup, parseBackupName, readBackupIdentity } from "../server/lib/backup.mjs";
import { companiesOnDisk } from "../server/lib/company-backups.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { startSupervisor } from "../server/supervisor.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : {} })),
});
const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };

// Aynı klasörlerle yeniden açılabilen sunucu (yeniden başlatma, göç ve 001 geri yüklemesi için).
async function boot(dirs, { env = {}, ...overrides } = {}) {
  const app = createApp({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", ...env }, license: LICENSE, startLicenseTimers: false, ...overrides });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const login = async (username = "admin", password = ADMIN_PASSWORD) => {
    const client = createClient(base);
    const result = await client.login(username, password);
    assert.equal(result.status, 200, `${username} girişi: ${JSON.stringify(result.data)}`);
    return { client, api: apiOf(client) };
  };
  return { app, base, login };
}
const freshDirs = () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-yedek-"));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
};
const countAccounts = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").get().n;
  } finally {
    db.close();
  }
};
const filesIn = dir => (existsSync(dir) ? readdirSync(dir).filter(name => BACKUP_NAME.test(name)) : []);
const addAccounts = async (api, names) => {
  for (const name of names) assert.equal((await api.post("/api/workspace/accounts", { name, type: "customer" })).status, 200);
};
const accountsNow = async api => (await api.get("/api/workspace/accounts")).data.accounts.length;

describe("yedek klasörü ve dosya adı kuralları", () => {
  test("klasör adı: '<kod> - <ad>'; Windows'ta geçersiz karakterler temizlenir, Türkçe harfler kalır", () => {
    assert.equal(companyFolderName({ code: "001", name: "Şirket 1" }), "001 - Şirket 1");
    assert.equal(companyFolderName({ code: "002", name: 'A/B\\C:D*E?F"G<H>I|J' }), "002 - A B C D E F G H I J");
    assert.equal(companyFolderName({ code: "003", name: "İçel Gıda Ltd. Şti.  " }), "003 - İçel Gıda Ltd. Şti", "sondaki nokta/boşluk atılır");
    assert.equal(companyFolderName({ code: "004", name: "Çağ\u0000Öz\tÜnal\nĞüneş" }), "004 - Çağ Öz Ünal Ğüneş", "denetim karakterleri");
    assert.equal(companyFolderName({ code: "005", name: "..." }), "005", "ad boş kalırsa yalnız kod");
    assert.equal(companyFolderName({ code: "006", name: "x".repeat(200) }).length, "006 - ".length + 80, "uzun ad kısaltılır");
    assert.equal(companyFolderName({ code: "../x", name: "Kötü" }), "000 - Kötü", "kod yalnız üç rakam");
  });

  test("ad: destekofis-<kod>-<zaman>-<etiket>; eski adlar tanınır; yol geçişi reddedilir", () => {
    assert.deepEqual(parseBackupName("destekofis-002-2026-10-03T09-15-00-000Z-manuel.sqlite"), { code: "002", stamp: "2026-10-03T09-15-00-000Z", label: "manuel" });
    assert.deepEqual(parseBackupName("destekofis-2026-10-03T09-15-00-000Z.sqlite"), { code: null, stamp: "2026-10-03T09-15-00-000Z", label: "" });
    assert.deepEqual(parseBackupName("hukuk-ofisi-2026-09-21T10-00-00-000Z-guncelleme-oncesi.sqlite"), { code: null, stamp: "2026-09-21T10-00-00-000Z", label: "guncelleme-oncesi" });
    for (const bad of ["../destekofis-001-2026-10-03T09-15-00-000Z.sqlite", "destekofis-001-2026-10-03T09-15-00-000Z/x.sqlite", "destekofis-001-x.sqlite.exe", "destekofis-001-2026-10-03T09-15-00-000Z-Manuel.sqlite"]) {
      assert.equal(BACKUP_NAME.test(bad), false, bad);
      assert.equal(parseBackupName(bad), null, bad);
    }
  });
});

describe("iki şirket: Tüm Şirketler / Yalnız, liste, indirme, Drive, otomatik yedek, ad değişimi, sıfırlama, silme, yetki", () => {
  const dirs = freshDirs();
  let server;
  let admin;
  let staff;
  let second;
  before(async () => {
    server = await boot(dirs);
    admin = (await server.login()).api;
    await addAccounts(admin, ["Ali Veli", "Ayşe Kaya", "Mehmet Demir"]);
    const created = await admin.post("/api/companies", { name: "İkinci Şirket", select: true });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = created.data.company;
    await addAccounts(admin, ["Zeynep Ak", "Can Er"]);
    assert.equal(await accountsNow(admin), 2);
    assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
    assert.equal(await accountsNow(admin), 3);
    assert.equal((await admin.post("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false })).status, 200);
    staff = (await server.login("personel1", "Personel-2026!")).api;
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  const folder1 = () => path.join(dirs.backupDir, "001 - Şirket 1");
  const folder2 = () => path.join(dirs.backupDir, companyFolderName(second));

  test("Yedek Al (varsayılan Tüm Şirketler): her şirket kendi klasöründe, adında kodu, içinde doğru veri ve kimlik", async () => {
    const result = await admin.post("/api/admin/backups", {});
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.scope, "all");
    assert.equal(result.data.backups.length, 2);
    const byCode = Object.fromEntries(result.data.backups.map(item => [item.code, item]));
    assert.match(byCode["001"].name, /^destekofis-001-\d{4}-\d{2}-\d{2}T[\d-]+Z-manuel\.sqlite$/);
    assert.match(byCode["002"].name, /^destekofis-002-\d{4}-\d{2}-\d{2}T[\d-]+Z-manuel\.sqlite$/);
    assert.equal(parseBackupName(byCode["001"].name).stamp, parseBackupName(byCode["002"].name).stamp, "aynı turda aynı zaman");
    assert.equal(byCode["001"].folder, folder1());
    assert.equal(byCode["002"].folder, folder2());
    assert.equal(path.basename(folder2()), "002 - İkinci Şirket");
    assert.equal(countAccounts(path.join(folder1(), byCode["001"].name)), 3, "001'in yedeğinde 001'in carileri");
    assert.equal(countAccounts(path.join(folder2(), byCode["002"].name)), 2, "002'nin yedeğinde 002'nin carileri");
    assert.deepEqual(readBackupIdentity(path.join(folder2(), byCode["002"].name)), { ...readBackupIdentity(path.join(folder2(), byCode["002"].name)), id: second.id, code: "002", name: "İkinci Şirket" });
    assert.equal(readBackupIdentity(path.join(folder1(), byCode["001"].name)).id, "sirket-001");
    assert.equal(result.data.name, byCode["001"].name, "seçili şirketin (001) yedeği öne çıkar");
    assert.deepEqual(filesIn(dirs.backupDir), [], "yedek kökünde dosya yok");
    assert.ok(!existsSync(path.join(dirs.backupDir, "sirket-002")), "eski düzen klasörü açılmaz");
  });

  test("Yalnız <kod · ad>: yalnız seçili şirket (ya da verilen şirket) yedeklenir", async () => {
    const before1 = filesIn(folder1()).length;
    const before2 = filesIn(folder2()).length;
    const only = await admin.post("/api/admin/backups", { scope: "one" });
    assert.equal(only.status, 200);
    assert.equal(only.data.backups.length, 1);
    assert.equal(only.data.backups[0].code, "001");
    assert.equal(filesIn(folder1()).length, before1 + 1);
    assert.equal(filesIn(folder2()).length, before2);
    const other = await admin.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.equal(other.status, 200);
    assert.deepEqual(other.data.backups.map(item => item.code), ["002"]);
    assert.equal(filesIn(folder2()).length, before2 + 1);
    assert.equal((await admin.post("/api/admin/backups", { scope: "one", companyId: "sirket-yok" })).status, 404);
  });

  test("liste bütün şirketleri Şirket bilgisiyle, yeniden eskiye gösterir; indirme şirketiyle ve kodla bulunur", async () => {
    const list = (await admin.get("/api/admin/backups")).data;
    assert.equal(list.length, 4, "2 (Tüm Şirketler) + 1 (Yalnız 001) + 1 (Yalnız 002)");
    assert.deepEqual([...new Set(list.map(item => item.company))].sort(), ["001 · Şirket 1", "002 · İkinci Şirket"]);
    for (const item of list) {
      assert.ok(item.companyId && item.companyCode && item.folder, JSON.stringify(item));
      assert.equal(item.legacy, false);
      assert.equal(path.basename(item.folder), item.companyCode === "001" ? "001 - Şirket 1" : "002 - İkinci Şirket");
    }
    const stamps = list.map(item => parseBackupName(item.name).stamp);
    assert.deepEqual(stamps, [...stamps].sort().reverse(), "yeniden eskiye");
    const folders = (await admin.get("/api/admin/backups/folders")).data;
    assert.equal(folders.root, dirs.backupDir);
    assert.deepEqual(folders.companies.map(item => [item.code, path.basename(item.folder), item.current]), [["001", "001 - Şirket 1", true], ["002", "002 - İkinci Şirket", false]]);
    const two = list.find(item => item.companyCode === "002");
    const withCompany = await fetch(`${server.base}/api/admin/backups/${two.name}?company=${encodeURIComponent(second.id)}`, { headers: { cookie: (await server.login()).client.cookie } });
    assert.equal(withCompany.status, 200);
    const bytes = Buffer.from(await withCompany.arrayBuffer());
    assert.equal(bytes.subarray(0, 15).toString(), "SQLite format 3");
    const loginCookie = (await server.login()).client.cookie;
    const byCode = await fetch(`${server.base}/api/admin/backups/${two.name}`, { headers: { cookie: loginCookie } });
    assert.equal(byCode.status, 200, "şirket verilmezse adındaki koddan bulunur");
    await byCode.arrayBuffer();
    const wrong = await fetch(`${server.base}/api/admin/backups/${two.name}?company=sirket-001`, { headers: { cookie: loginCookie } });
    assert.equal(wrong.status, 404, "başka şirketin klasöründe aranmaz");
    await wrong.arrayBuffer();
    assert.equal((await admin.get("/api/admin/backups/..%2F..%2Fdata%2Fdestekofis.sqlite")).status, 400);
  });

  test("Yönetim → Şirketler: veri dosyası, boyutu, cari/kayıt sayısı, son yedek ve yedek klasörü", async () => {
    const info = (await admin.get("/api/companies/storage")).data;
    assert.equal(info.backupRoot, dirs.backupDir);
    const [one, two] = info.companies;
    assert.equal(one.dataFile, path.join(dirs.dataDir, "destekofis.sqlite"));
    assert.equal(two.dataFile, path.join(dirs.dataDir, "sirketler", "002", "destekofis.sqlite"));
    assert.ok(one.dataSize > 0 && two.dataSize > 0);
    assert.deepEqual([one.accounts, two.accounts], [3, 2]);
    assert.equal(one.backupFolder, folder1());
    assert.equal(two.backupFolder, folder2());
    assert.ok(one.lastBackup?.name.startsWith("destekofis-001-"));
    assert.ok(two.lastBackup?.name.startsWith("destekofis-002-"));
    assert.equal(two.backupCount, filesIn(folder2()).length);
  });

  test("Drive klasörü: bütün şirketlerin kopyası, her biri kendi klasöründe", async () => {
    const drive = mkdtempSync(path.join(tmpdir(), "drive-220-"));
    try {
      assert.equal((await admin.post("/api/admin/backups/cloud", { target: drive })).status, 200);
      const result = await admin.post("/api/admin/backups", {});
      assert.equal(result.status, 200);
      for (const item of result.data.backups) {
        assert.equal(item.cloud?.ok, true, JSON.stringify(item));
        assert.ok(existsSync(path.join(drive, "DestekOfis Yedekleri", path.basename(item.folder), item.name)), item.name);
      }
      assert.equal((await admin.post("/api/admin/backups/cloud", { target: "" })).status, 200);
    } finally {
      rmSync(drive, { recursive: true, force: true });
    }
  });

  test("yetki: personel yedekleri göremez/alamaz/indiremez/geri yükleyemez (403); yetkisi olmayan şirketin yedeği listede yok", async () => {
    for (const [method, url] of [["get", "/api/admin/backups"], ["get", "/api/admin/backups/folders"], ["post", "/api/admin/backups"], ["post", "/api/admin/backups/restore"], ["get", "/api/companies/storage"]]) {
      assert.equal((await staff[method](url, {})).status, 403, `${method} ${url}`);
    }
    const name = (await admin.get("/api/admin/backups")).data[0].name;
    assert.equal((await staff.get(`/api/admin/backups/${name}`)).status, 403);
    // Şirket bazında süzme (yönetici her şirketi görür; kural yine de uygulanır): personel yalnız 002'yi görürse.
    const staffId = (await staff.get("/api/auth/me")).data.id;
    assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: [second.id] })).status, 200);
    const user = { id: staffId, role: "personel" };
    const visible = server.app.backups.list(user);
    assert.ok(visible.length > 0);
    assert.deepEqual([...new Set(visible.map(item => item.companyCode))], ["002"]);
    const oneName = server.app.backups.listFor(server.app.companies.get("sirket-001"))[0].name;
    assert.throws(() => server.app.backups.locate(user, oneName), /Yedek bulunamadı/);
    assert.throws(() => server.app.backups.locate(user, oneName, "sirket-001"), /yetkiniz yok/);
    assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001"] })).status, 200);
  });

  test("ad ve kod değişince klasör yeniden adlandırılır, yedekler korunur; özel karakterler temizlenir", async () => {
    const beforeNames = filesIn(folder2()).sort();
    const renamed = await admin.put(`/api/companies/${second.id}`, { name: 'Gayri/Resmi: "Ç*Ş?"' });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.data));
    second = renamed.data.company;
    const newFolder = path.join(dirs.backupDir, "002 - Gayri Resmi Ç Ş");
    assert.ok(existsSync(newFolder), readdirSync(dirs.backupDir).join(", "));
    assert.ok(!existsSync(path.join(dirs.backupDir, "002 - İkinci Şirket")), "eski adlı klasör kalmaz");
    assert.deepEqual(filesIn(newFolder).sort(), beforeNames, "bütün yedekler yeni klasörde");
    // Kod değişir: klasör yeniden adlandırılır; eski kodlu dosya adları kalır ama listede şirketiyle görünür.
    const recoded = await admin.put(`/api/companies/${second.id}`, { code: "007" });
    assert.equal(recoded.status, 200);
    second = recoded.data.company;
    const coded = path.join(dirs.backupDir, "007 - Gayri Resmi Ç Ş");
    assert.deepEqual(filesIn(coded).sort(), beforeNames);
    const list = (await admin.get("/api/admin/backups")).data.filter(item => item.companyId === second.id);
    assert.equal(list.length, beforeNames.length);
    assert.ok(list.every(item => item.company === "007 · Gayri/Resmi: \"Ç*Ş?\"" && item.folder === coded));
    const download = await fetch(`${server.base}/api/admin/backups/${list[0].name}`, { headers: { cookie: (await server.login()).client.cookie } });
    assert.equal(download.status, 200, "eski kodlu ad da bulunur");
    await download.arrayBuffer();
    const fresh = await admin.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.match(fresh.data.backups[0].name, /^destekofis-007-/);
    assert.equal(fresh.data.backups[0].folder, coded);
  });

  // v2.0.20 (gözden geçirme sonrası): yeni adın klasörü İÇİNDE YEDEK olan başka bir klasörse (ör. silinmiş şirketten kalma)
  // yedekler ona karışmaz — klasör ek alır ("007 - Çakışma (2)"). Yarım taşıma (dosya açık/çakışan yedek olmayan dosya)
  // eski klasörü kayda yazar; yedekler yeni klasörde, eski klasör sonraki açılışta temizlenir.
  test("ad değişince dolu klasörle çakışma: ek alır, karışmaz; yarım kalan taşıma kayda yazılır ve tamamlanır", async () => {
    const folderOf = () => server.app.companies.dirsOf(server.app.companies.get(second.id)).backupDir;
    const current = folderOf();
    const sample = filesIn(current)[0];
    const foreign = path.join(dirs.backupDir, "007 - Çakışma");
    mkdirSync(foreign, { recursive: true });
    copyFileSync(path.join(current, sample), path.join(foreign, "destekofis-007-2026-01-01T00-00-00-000Z-manuel.sqlite"));
    const renamed = await admin.put(`/api/companies/${second.id}`, { name: "Çakışma" });
    assert.equal(renamed.status, 200);
    second = renamed.data.company;
    assert.equal(path.basename(folderOf()), "007 - Çakışma (2)", "dolu klasöre karışmaz");
    assert.deepEqual(filesIn(foreign), ["destekofis-007-2026-01-01T00-00-00-000Z-manuel.sqlite"], "yabancı klasör olduğu gibi");
    assert.ok(filesIn(folderOf()).includes(sample), "şirketin yedekleri yeni klasörde");
    assert.ok(!existsSync(current), "eski klasör kalktı");
    // Yarım taşıma: hedefte aynı adlı (yedek olmayan) dosya → o dosya eski klasörde kalır, eski klasör kayda yazılır.
    const before = folderOf();
    const next = path.join(dirs.backupDir, "007 - Yeni Ad");
    mkdirSync(next, { recursive: true });
    writeFileSync(path.join(before, "notlar.txt"), "a");
    writeFileSync(path.join(next, "notlar.txt"), "b");
    const again = await admin.put(`/api/companies/${second.id}`, { name: "Yeni Ad" });
    assert.equal(again.status, 200);
    second = again.data.company;
    assert.equal(folderOf(), next);
    assert.deepEqual(server.app.companies.get(second.id).oldBackupDirs, [path.basename(before)]);
    assert.ok(filesIn(next).includes(sample), "yedekler yeni klasöre taşındı");
    const listed = (await admin.get("/api/admin/backups")).data.filter(item => item.companyId === second.id);
    assert.ok(listed.some(item => item.name === sample && item.folder === next));
    server.app.backups.migrate();
    assert.equal(server.app.companies.get(second.id).oldBackupDirs, undefined, "eski klasörde yedek kalmayınca kayıttan düşer");
  });

  test("şirket meşgulken (geri yükleniyor/siliniyor) o şirkete gelen istek 503 alır; başka şirketin verisi gösterilmez", async () => {
    await admin.post("/api/companies/select", { id: second.id });
    server.app.context.busyCompanies.set(second.id, "Şirket yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
    try {
      const busy = await admin.get("/api/workspace/accounts");
      assert.equal(busy.status, 503);
      assert.match(busy.data.error, /geri yükleniyor/);
    } finally {
      server.app.context.busyCompanies.delete(second.id);
    }
    assert.equal(await accountsNow(admin), 2);
    await admin.post("/api/companies/select", { id: "sirket-001" });
  });

  test("sıfırlama ve silme öncesi yedekler şirketin klasörüne; şirket silinince yedek klasörü yerinde kalır", async () => {
    const folder = server.app.companies.dirsOf(server.app.companies.get(second.id)).backupDir;
    const reset = await admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD });
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    assert.match(reset.data.backup, /^destekofis-007-.*-sifirlama-oncesi-007\.sqlite$/);
    assert.ok(existsSync(path.join(folder, reset.data.backup)));
    assert.equal(readBackupIdentity(path.join(folder, reset.data.backup)).id, second.id);
    const count = filesIn(folder).length;
    const removed = await admin.del(`/api/companies/${second.id}`, { confirm: second.code, password: ADMIN_PASSWORD });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    assert.match(removed.data.backup, /^destekofis-007-.*-silme-oncesi-007\.sqlite$/);
    assert.ok(existsSync(path.join(folder, removed.data.backup)), "silme öncesi yedek şirketin klasöründe");
    assert.equal(filesIn(folder).length, count + 1, "klasör ve içindeki yedekler yerinde");
    assert.equal(countAccounts(path.join(folder, removed.data.backup)), 2);
    assert.deepEqual(server.app.openCompanyIds(), [], "silinen şirketin örneği kapandı");
    assert.equal((await admin.get("/api/companies")).data.companies.length, 1);
    // Ortak katman çalışmaya devam eder (şirket kapanınca lisans/oturum servisleri durmaz).
    assert.equal((await admin.get("/api/license")).status, 200);
    assert.equal((await server.login("personel1", "Personel-2026!")).client.cookie !== "", true);
  });
});

describe("otomatik yedek: bu açılışta hiç açılmamış şirket de yedeklenir; npm run backup bütün şirketler", () => {
  const dirs = freshDirs();
  let server;
  let secondId;
  before(async () => {
    const first = await boot(dirs);
    const { api } = await first.login();
    await addAccounts(api, ["Bir", "İki"]);
    const created = await api.post("/api/companies", { code: "002", name: "Açılmayan Şirket", select: true });
    secondId = created.data.company.id;
    await addAccounts(api, ["Üç", "Dört", "Beş"]);
    await first.app.close();
    // Yeniden açılış: 002 hiç açılmaz (zamanlayıcı süresi çok kısa: her şirket "zamanı gelmiş").
    server = await boot(dirs, { env: { HUKUK_BACKUP_INTERVAL_HOURS: "0.000001" } });
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("zamanlayıcı turu bütün şirketleri yedekler; 002'nin örneği açılmaz, veri tabanı bağlantısı kalmaz", async () => {
    assert.deepEqual(server.app.openCompanyIds(), []);
    const results = server.app.runDueBackups();
    assert.deepEqual(results.map(item => item.company.code).sort(), ["001", "002"]);
    assert.deepEqual(server.app.openCompanyIds(), [], "şirket açılmadan yedeklendi");
    const two = results.find(item => item.company.code === "002");
    assert.equal(path.dirname(two.path), path.join(dirs.backupDir, "002 - Açılmayan Şirket"));
    assert.equal(countAccounts(two.path), 3);
    assert.equal(readBackupIdentity(two.path).id, secondId);
    // Bağlantı kalmadı: veri dosyası başka bir süreçten yazılabilir açılabilir, WAL kilidi yok.
    const db = new DatabaseSync(path.join(dirs.dataDir, "sirketler", "002", "destekofis.sqlite"));
    db.exec("BEGIN IMMEDIATE; ROLLBACK;");
    db.close();
  });

  test("gerçek zamanlayıcı (açılıştan kısa süre sonra) ve npm run backup aracı", async () => {
    const timed = freshDirs();
    try {
      const first = await boot(timed);
      const { api } = await first.login();
      await api.post("/api/companies", { code: "002", name: "Zamanlı" });
      await first.app.close();
      const app = createApp({ dataDir: timed.dataDir, backupDir: timed.backupDir, logLevel: "silent", scheduleBackups: true, backupOnStartDelayMs: 20, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: LICENSE, startLicenseTimers: false });
      try {
        for (let tries = 0; tries < 100 && filesIn(path.join(timed.backupDir, "002 - Zamanlı")).length === 0; tries += 1) await new Promise(resolve => setTimeout(resolve, 30));
        assert.equal(filesIn(path.join(timed.backupDir, "001 - Şirket 1")).length, 1);
        assert.equal(filesIn(path.join(timed.backupDir, "002 - Zamanlı")).length, 1);
        assert.deepEqual(app.openCompanyIds(), []);
      } finally {
        await app.close();
      }
      const output = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT, "tools", "backup.mjs")], { env: { ...process.env, HUKUK_DATA_DIR: timed.dataDir, HUKUK_BACKUP_DIR: timed.backupDir }, encoding: "utf8" })
        .trim()
        .split(/\r?\n/);
      assert.equal(output.length, 2, output.join("\n"));
      assert.equal(path.basename(path.dirname(output[0])), "001 - Şirket 1");
      assert.equal(path.basename(path.dirname(output[1])), "002 - Zamanlı");
      assert.ok(output.every(file => /destekofis-00[12]-.*-manuel\.sqlite$/.test(file) && existsSync(file)));
      assert.deepEqual(companiesOnDisk({ dataDir: timed.dataDir, backupRoot: timed.backupDir }).map(item => path.basename(item.backupDir)), ["001 - Şirket 1", "002 - Zamanlı"]);
    } finally {
      rmSync(timed.root, { recursive: true, force: true });
    }
  });
});

describe("göç: eski yedekler (kök ve sirket-002) şirket klasörlerine taşınır; tekrar açılışta iş yapmaz", () => {
  const dirs = freshDirs();
  let server;
  const DAY = 86_400_000;
  const old = (stamp, label = "") => `destekofis-${stamp}${label ? `-${label}` : ""}.sqlite`;
  let realOld;
  before(async () => {
    const first = await boot(dirs);
    const { api } = await first.login();
    await addAccounts(api, ["Eski Cari"]);
    await api.post("/api/companies", { code: "002", name: "Şirket 2" });
    // Gerçek bir eski (kodsuz, kimliksiz) yedek: 2.0.19 düzeni gibi kökte.
    realOld = old("2026-09-01T10-00-00-000Z", "manuel");
    createBackup(first.app.db, dirs.backupDir, { label: "manuel", keep: 100 });
    const made = readdirSync(dirs.backupDir).find(name => /^destekofis-\d{4}-.*-manuel\.sqlite$/.test(name));
    copyFileSync(path.join(dirs.backupDir, made), path.join(dirs.backupDir, realOld));
    rmSync(path.join(dirs.backupDir, made));
    await first.app.close();
    // Gerçek kurulumda 002 eski yedeklerinden ÖNCE açılmıştır (v2.0.20: şirketin kuruluşundan eski "sirket-<klasör>"
    // dosyaları silinmiş eski bir şirketindir, taşınmaz) — kuruluş tarihi yedeklerden önceye alınır.
    const registryFile = path.join(dirs.dataDir, "sirketler.json");
    const registry = JSON.parse(readFileSync(registryFile, "utf8"));
    for (const company of registry.companies) if (company.code === "002") company.createdAt = "2026-08-15T09:00:00.000Z";
    writeFileSync(registryFile, JSON.stringify(registry, null, 2));
    // 2.0.19 düzeni: kökte 001'in yedekleri, sirket-002/ altında 002'ninkiler; yanlarında yedek olmayan dosyalar.
    rmSync(path.join(dirs.backupDir, "001 - Şirket 1"), { recursive: true, force: true });
    rmSync(path.join(dirs.backupDir, "002 - Şirket 2"), { recursive: true, force: true });
    writeFileSync(path.join(dirs.backupDir, "hukuk-ofisi-2026-08-01T10-00-00-000Z.sqlite"), "eski");
    writeFileSync(path.join(dirs.backupDir, "notlar.txt"), "yedek değil");
    // Taze güncelleme yedeği (eski servis yöneticisi geri dönüşte kökte arar) kökte kalır; 7 günden eskisi taşınır.
    writeFileSync(path.join(dirs.backupDir, old("2026-10-02T10-00-00-000Z", "guncelleme-oncesi-2-0-19")), "taze");
    const stale = path.join(dirs.backupDir, old("2026-09-10T10-00-00-000Z", "guncelleme-oncesi-2-0-18"));
    writeFileSync(stale, "eski güncelleme");
    utimesSync(stale, new Date(Date.now() - 10 * DAY), new Date(Date.now() - 10 * DAY));
    mkdirSync(path.join(dirs.backupDir, "sirket-002"), { recursive: true });
    writeFileSync(path.join(dirs.backupDir, "sirket-002", old("2026-09-02T10-00-00-000Z", "manuel")), "002 eski");
    writeFileSync(path.join(dirs.backupDir, "sirket-002", old("2026-09-03T10-00-00-000Z", "sifirlama-oncesi-002")), "002 eski");
    // Silinmiş bir şirketin eski klasörü: kimseye ait değil, dokunulmaz.
    mkdirSync(path.join(dirs.backupDir, "sirket-003"), { recursive: true });
    writeFileSync(path.join(dirs.backupDir, "sirket-003", old("2026-09-04T10-00-00-000Z")), "003");
    server = await boot(dirs);
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("açılışta taşınır (silinmez); yedek olmayan dosya, taze güncelleme yedeği ve sahipsiz klasör yerinde kalır", async () => {
    const one = path.join(dirs.backupDir, "001 - Şirket 1");
    const two = path.join(dirs.backupDir, "002 - Şirket 2");
    assert.deepEqual(filesIn(one).sort(), [old("2026-09-10T10-00-00-000Z", "guncelleme-oncesi-2-0-18"), realOld, "hukuk-ofisi-2026-08-01T10-00-00-000Z.sqlite"].sort());
    assert.deepEqual(filesIn(two).sort(), [old("2026-09-02T10-00-00-000Z", "manuel"), old("2026-09-03T10-00-00-000Z", "sifirlama-oncesi-002")]);
    assert.deepEqual(readdirSync(dirs.backupDir).filter(name => !name.includes(" - ")).sort(), [old("2026-10-02T10-00-00-000Z", "guncelleme-oncesi-2-0-19"), "notlar.txt", "sirket-003"].sort());
    assert.ok(!existsSync(path.join(dirs.backupDir, "sirket-002")), "boşalan eski klasör kalkar");
    assert.ok(existsSync(path.join(dirs.backupDir, "sirket-003", old("2026-09-04T10-00-00-000Z"))));
    // Kökte kalan taze güncelleme yedeği 001'in listesinde "eski yerde" görünür.
    const { api } = await server.login();
    const list = (await api.get("/api/admin/backups")).data;
    const held = list.find(item => item.name === old("2026-10-02T10-00-00-000Z", "guncelleme-oncesi-2-0-19"));
    assert.deepEqual([held?.companyCode, held?.legacy, held?.folder], ["001", true, dirs.backupDir]);
    assert.equal(list.filter(item => item.companyCode === "002").length, 2);
  });

  test("tekrar açılışta iş yapmaz; taşınan eski yedek kendi şirketine geri yüklenebilir, öbürüne yüklenemez (409)", async () => {
    const snapshot = () => readdirSync(dirs.backupDir, { recursive: true }).sort();
    const before = snapshot();
    await server.app.close();
    server = await boot(dirs);
    assert.deepEqual(snapshot(), before, "ikinci açılışta değişiklik yok");
    const report = server.app.backups.migrate();
    assert.deepEqual([report.moved, report.left], [0, 0]);
    assert.equal(report.held, 1);
    const { api } = await server.login();
    // Kimliksiz eski yedek (001'in klasöründe): 002'ye yüklenemez.
    const wrong = await api.post("/api/admin/backups/restore", { name: realOld, company: "sirket-001", target: server.app.companies.byCode("002").id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(wrong.status, 409);
    assert.equal(wrong.data.code, "company-unknown");
    assert.match(wrong.data.error, /yalnız bulunduğu klasörün şirketine \(001 · Şirket 1\)/);
  });
});

describe("geri yükleme: doğru şirkete; yanlış şirkete 409; 002 hemen, 001 yeniden açılışta; ortak katman korunur", () => {
  const dirs = freshDirs();
  let server;
  let api;
  let second;
  let backup001;
  let backup002;
  before(async () => {
    server = await boot(dirs);
    api = (await server.login()).api;
    await addAccounts(api, ["Bir", "İki", "Üç"]);
    second = (await api.post("/api/companies", { code: "002", name: "Şirket 2", select: true })).data.company;
    await addAccounts(api, ["Dört", "Beş"]);
    await api.post("/api/companies/select", { id: "sirket-001" });
    const taken = (await api.post("/api/admin/backups", {})).data.backups;
    backup001 = taken.find(item => item.code === "001");
    backup002 = taken.find(item => item.code === "002");
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("yanlış şirkete geri yükleme reddedilir (409): hedef farklı, ya da yedek elle başka şirketin klasörüne konmuş", async () => {
    const mismatch = await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, target: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.data.code, "company-mismatch");
    assert.match(mismatch.data.error, /“002 · Şirket 2” şirketine ait; “001 · Şirket 1” şirketine geri yüklenemez/);
    // Kullanıcı 002'nin yedeğini elle 001'in klasörüne kopyaladı: içindeki kimlik yine 002 → reddedilir.
    copyFileSync(path.join(backup002.folder, backup002.name), path.join(backup001.folder, backup002.name));
    const copied = await api.post("/api/admin/backups/restore", { name: backup002.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(copied.status, 409);
    assert.equal(copied.data.code, "company-mismatch");
    rmSync(path.join(backup001.folder, backup002.name));
    assert.equal(existsSync(path.join(dirs.dataDir, "geri-yukleme.json")), false, "hiçbir şey hazırlanmadı");
  });

  test("onay ve parola: yanlış kod 400, yanlış parola 403; daha yeni sürümün yedeği 409", async () => {
    assert.equal((await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "999", password: ADMIN_PASSWORD })).status, 400);
    assert.equal((await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "002", password: "yanlış" })).status, 403);
    const future = backup002.name.replace("-manuel.sqlite", "-gelecek.sqlite");
    copyFileSync(path.join(backup002.folder, backup002.name), path.join(backup002.folder, future));
    const db = new DatabaseSync(path.join(backup002.folder, future));
    db.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
    db.close();
    const newer = await api.post("/api/admin/backups/restore", { name: future, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(newer.status, 409);
    assert.match(newer.data.error, /daha yeni bir sürümünde/);
    rmSync(path.join(backup002.folder, future));
  });

  test("002: hemen geri yüklenir; önce bugünkü veri yedeklenir; 001 ve kullanıcılar etkilenmez", async () => {
    await api.post("/api/companies/select", { id: second.id });
    await addAccounts(api, ["Altı (yedekten sonra)"]);
    assert.equal(await accountsNow(api), 3);
    const restored = await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.equal(restored.data.restored, true);
    assert.match(restored.data.safety, /^destekofis-002-.*-geri-yukleme-oncesi-002\.sqlite$/);
    assert.equal(countAccounts(path.join(backup002.folder, restored.data.safety)), 3, "önceki veri yedekte");
    assert.equal(await accountsNow(api), 2, "002 yedekteki hâline döndü");
    await api.post("/api/companies/select", { id: "sirket-001" });
    assert.equal(await accountsNow(api), 3, "001 aynı");
    // Geri yüklenen dosyada yedek kimliği tablosu kalmaz.
    const live = new DatabaseSync(path.join(dirs.dataDir, "sirketler", "002", "destekofis.sqlite"), { readOnly: true });
    assert.equal(live.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'backup_meta'").get().n, 0);
    live.close();
    const events = (await api.get("/api/admin/audit?type=system.backup")).data.map(item => item.type);
    assert.ok(events.includes("system.backup_restored"), events.join(","));
  });

  test("001: geri yükleme hazırlanır, sunucu yeniden açılınca uygulanır; kullanıcılar, lisans ve şirket listesi korunur", async () => {
    await addAccounts(api, ["Dört (yedekten sonra)"]);
    assert.equal((await api.post("/api/admin/users", { username: "yeni.kisi", name: "Yeni Kişi", role: "personel", password: "Yeni-Kisi-2026!", mustChangePassword: false })).status, 200);
    const licenseBefore = server.app.store.setting("license.machine", "");
    const staged = await api.post("/api/admin/backups/restore", { name: backup001.name, company: "sirket-001", confirm: "Şirket 1", password: ADMIN_PASSWORD });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.deepEqual([staged.data.staged, staged.data.restarting, staged.data.restartRequired], [true, false, true]);
    assert.equal((await api.get("/api/admin/backups/folders")).data.pending?.name, backup001.name);
    // Vazgeç → yeniden hazırla.
    assert.equal((await api.del("/api/admin/backups/restore")).data.cancelled, true);
    assert.equal((await api.get("/api/admin/backups/folders")).data.pending, null);
    assert.equal((await api.post("/api/admin/backups/restore", { name: backup001.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD })).status, 200);
    assert.equal(await accountsNow(api), 4, "sunucu kapanana kadar veri aynı");
    await server.app.close();
    server = await boot(dirs);
    assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
    assert.match(server.app.stagedRestore.safety, /^destekofis-001-.*-geri-yukleme-oncesi-001\.sqlite$/);
    assert.ok(!existsSync(path.join(dirs.dataDir, "geri-yukleme.json")), "işaret dosyası kalktı");
    assert.ok(!existsSync(path.join(dirs.dataDir, "geri-yukleme")), "hazırlık kopyası kalktı");
    api = (await server.login()).api;
    assert.equal(await accountsNow(api), 3, "001 yedekteki hâline döndü");
    assert.equal(countAccounts(path.join(backup001.folder, server.app.stagedRestore.safety)), 4, "önceki veri yedekte");
    await server.login("yeni.kisi", "Yeni-Kisi-2026!"); // yedekten sonra açılan kullanıcı korunur
    assert.equal(server.app.store.setting("license.machine", ""), licenseBefore, "lisans kaydı korunur");
    assert.deepEqual((await api.get("/api/companies")).data.companies.map(item => item.code), ["001", "002"]);
    await api.post("/api/companies/select", { id: second.id });
    assert.equal(await accountsNow(api), 2, "002 etkilenmedi");
    await api.post("/api/companies/select", { id: "sirket-001" });
    const events = (await api.get("/api/admin/audit?type=system.backup")).data.map(item => item.type);
    assert.ok(events.includes("system.backup_restored"), events.join(","));
  });

  test("servis yöneticisi altında: 001 geri yüklemesinde uygulama kendini yeniden başlatır, veri yedekteki hâline döner", async () => {
    const installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-yedek-sup-"));
    // Veri süreç içinde hazırlanır (servis altındaki yeni kurulum lisanssız salt okunurdur; Yönetim uçları yine açıktır).
    const seed = await boot({ dataDir: path.join(installRoot, "data"), backupDir: path.join(installRoot, "backups") });
    const seedApi = (await seed.login()).api;
    await addAccounts(seedApi, ["Bir", "İki"]);
    const taken = (await seedApi.post("/api/admin/backups", {})).data;
    await addAccounts(seedApi, ["Üç (yedekten sonra)"]);
    await seed.app.close();
    const silent = { info() {}, warn() {}, error() {}, debug() {} };
    const supervisor = await startSupervisor({ installRoot, appDir: ROOT, port: 0, host: "127.0.0.1", discoveryPort: 0, log: silent, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_LOG_LEVEL: "silent", HUKUK_DATASET_AUTOSYNC: "0" } });
    const base = `http://127.0.0.1:${supervisor.port}`;
    const health = async () => (await fetch(`${base}/__supervisor/health`)).json();
    const until = async (check, timeoutMs = 30_000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await check().catch(() => false)) return true;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error("Beklenen durum oluşmadı");
    };
    try {
      await until(async () => (await health()).phase === "ready");
      const login = async () => {
        const client = createClient(base);
        assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
        return apiOf(client);
      };
      let sup = await login();
      assert.equal(await accountsNow(sup), 3);
      const restartsBefore = (await health()).restarts;
      const staged = await sup.post("/api/admin/backups/restore", { name: taken.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      assert.deepEqual([staged.data.staged, staged.data.restarting, staged.data.restartRequired], [true, true, false]);
      await until(async () => {
        const state = await health();
        return state.phase === "ready" && state.restarts > restartsBefore;
      });
      sup = await login();
      assert.equal(await accountsNow(sup), 2, "yedekteki hâline döndü");
      assert.ok(!existsSync(path.join(installRoot, "data", "geri-yukleme.json")));
      assert.ok(filesIn(path.join(installRoot, "backups", "001 - Şirket 1")).some(name => /geri-yukleme-oncesi-001/.test(name)));
    } finally {
      await supervisor.stop();
      rmSync(installRoot, { recursive: true, force: true });
    }
  });

  test("bozuk işaret ya da kaybolmuş yedek: sunucu mevcut veriyle açılır", async () => {
    writeFileSync(path.join(dirs.dataDir, "geri-yukleme.json"), JSON.stringify({ source: path.join(dirs.dataDir, "geri-yukleme", "destekofis-001-2026-01-01T00-00-00-000Z.sqlite") }));
    await server.app.close();
    server = await boot(dirs);
    assert.equal(server.app.stagedRestore?.ok, false);
    assert.ok(!existsSync(path.join(dirs.dataDir, "geri-yukleme.json")));
    api = (await server.login()).api;
    assert.equal(await accountsNow(api), 3);
  });
});

// Ana mühendis incelemesi (birleştirmede eklendi): değiştirme sırasında canlı dosyanın WAL günlüğü silinmeden önce ana
// dosyaya işlenir; yeniden adlandırma başarısız olsa (Windows'ta dosya açık) son işlem kaybolmaz.
describe("geri yükleme dosya değiştirme: WAL'daki son işlem kaybolmaz", () => {
  test("rename başarısız olsa da canlı veri (WAL'daki satır dahil) yerinde", async () => {
    const { swapInRestoredFile } = await import("../server/lib/company-backups.mjs");
    const dir = mkdtempSync(path.join(tmpdir(), "swap-wal-"));
    try {
      const dbPath = path.join(dir, "destekofis.sqlite");
      const writer = new DatabaseSync(dbPath);
      writer.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('eski');");
      writer.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      const mainOnly = `${dbPath}.ana`;
      copyFileSync(dbPath, mainOnly); // ana dosyada yalnız 'eski'
      writer.exec("INSERT INTO t VALUES ('son-islem')"); // yalnız WAL'da
      const walCopy = `${dbPath}-wal.kopya`;
      copyFileSync(`${dbPath}-wal`, walCopy);
      writer.close();
      // Disk durumu: ana dosya son işlemi içermiyor, işlem yalnız WAL günlüğünde (kapanmadan önceki an).
      copyFileSync(mainOnly, dbPath);
      copyFileSync(walCopy, `${dbPath}-wal`);
      rmSync(`${dbPath}-shm`, { force: true });
      assert.throws(() => swapInRestoredFile(path.join(dir, "olmayan-hazirlik-dosyasi"), dbPath));
      const reader = new DatabaseSync(dbPath, { readOnly: true });
      const rows = reader.prepare("SELECT v FROM t ORDER BY rowid").all().map(row => row.v);
      reader.close();
      assert.deepEqual(rows, ["eski", "son-islem"], "WAL'daki son işlem ana dosyaya işlendi, kaybolmadı");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
