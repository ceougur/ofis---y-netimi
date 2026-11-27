// 2.5.0 D2 — KALICI DEVİR YEDEĞİ ve "Yedekten Geri Yükle"nin arşiv kaydını bilmesi (docs/devir/D2-ALTYAPI-TASARIM.md §6–§7, §10; DEVIR-PLANI G5, G10.18).
// Nasıl bozulur: devir yedeği rutin yedeklerin budamasında silinir (30'luk / 20'lik kuyruklar — gerçek budama yolu, sahte zaman damgalarıyla 35 + 25 yedek; ders 13);
// şirket adı değişince devir yedeği kaybolur; yedek yarıda kalır; yedeğin bir dosyası değişir; devirden ÖNCE alınmış yedek geri yüklenir (K yılı iki dosyada);
// devir geri alındıktan sonra devir SONRASI yedek geri yüklenir; aynı yıl başka devir çalışmasıyla yeniden devredilmiş; 001'de hazırlanmış geri yükleme devirden
// sonra uygulanır; bakımdaki şirkete geri yükleme.
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { listBackups } from "../server/lib/backup.mjs";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { DEVIR_BACKUP_DIR, DEVIR_BACKUP_MANIFEST, DEVIR_YEARS_KEY, companyOf, makeArchive } from "./devir-d2-yardimci.mjs";

// D2 öncesi kodda modül yok: dosya yine yüklenir, devir yedeği testleri "işlev yok" nedeniyle kırmızı olur (ders 7 / 38).
const devirBackups = await import("../server/lib/devir/devir-backups.mjs").catch(() => ({}));
const listDevirBackups = (...args) => devirBackups.listDevirBackups(...args);
const verifyDevirBackup = (...args) => devirBackups.verifyDevirBackup(...args);
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const NOW = "2026-11-02T10:00:00+03:00";
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2-yedek-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const must = async (label, promise, status = 200) => {
  const response = await promise;
  assert.equal(response.status, status, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return unwrap(response);
};
const start = dir => startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
async function seed(server) {
  const admin = await loginAdmin(server);
  await must("kasa", admin.post("/api/workspace/cash", { kind: "in", amount: 100, date: "2026-11-02", description: "001 girişi" }));
  const second = (await must("002", admin.post("/api/companies", { name: "Yedek İkinci" }))).company;
  const q = `?hofCompany=${second.id}`;
  await must("002 kasa", admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 70, date: "2026-11-02", description: "002 girişi" }));
  return { admin, second, q };
}
// Şirket klasörünün yedeğe girecek dosyaları (belgeler, mesaj arşivi, gizli anahtar) — içerik önemsiz, yol ve özet önemli.
function companyFiles(dataDir) {
  mkdirSync(path.join(dataDir, "belgeler", "ab"), { recursive: true });
  writeFileSync(path.join(dataDir, "belgeler", "ab", "ab".padEnd(64, "0")), "belge içeriği");
  mkdirSync(path.join(dataDir, "mesaj-arsivi"), { recursive: true });
  writeFileSync(path.join(dataDir, "mesaj-arsivi", "2026-09.json"), "[]");
  writeFileSync(path.join(dataDir, "secret.key"), "x".repeat(44));
}
const stampOf = index => new Date(Date.UTC(2026, 0, 1, 3, 0, 0) + index * 86_400_000).toISOString().replace(/[:.]/g, "-");
const restore = (admin, item, company) => admin.post("/api/admin/backups/restore", { name: item.name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD });

describe("D2 kalıcı devir yedeği ve geri yüklemenin arşiv denetimi", () => {
  test("devir yedeği: veri tabanı + arşiv + belgeler + mesaj arşivi + gizli anahtar, her dosyanın özeti bildirgede; doğrulama değişen / eksik / fazla dosyayı bulur; liste ucu", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second } = await seed(server);
      const company = companyOf(server.app, second.id);
      const dataDir = server.app.companies.dirsOf(company).dataDir;
      companyFiles(dataDir);
      await makeArchive(server.app, second.id, { year: "2025" });
      const made = await server.app.backups.createDevirBackupFor(company, { label: "devir-oncesi-2026", year: "2026", runId: "devir-2026-t", by: { id: "u", display_name: "Test" } });
      assert.deepEqual(made.manifest.included.sort(), ["arsiv", "belgeler", "mesaj-arsivi", "secret.key"]);
      const paths = made.manifest.files.map(file => file.path);
      for (const expected of ["arsiv/2025/destekofis.sqlite", "arsiv/2025/arsiv-kaydi.json", "secret.key", "mesaj-arsivi/2026-09.json"]) assert.ok(paths.includes(expected), `${expected} yedekte (${paths.join(", ")})`);
      assert.ok(paths.some(item => /^destekofis-002-.*-devir-oncesi-2026\.sqlite$/.test(item)), "veri tabanı kopyası (şirket kodlu ad)");
      assert.ok(paths.some(item => item.startsWith("belgeler/ab/")));
      assert.equal((await verifyDevirBackup(made.path)).ok, true);
      const listed = await must("liste", admin.get("/api/admin/devir/backups"));
      assert.deepEqual(listed.backups.map(item => [item.companyId, item.label, item.state, item.files]), [[second.id, "devir-oncesi-2026", "tamam", made.files]]);
      assert.equal((await must("doğrula", admin.post("/api/admin/devir/backups/verify", { company: second.id, name: made.name }))).ok, true);
      appendFileSync(path.join(made.path, "secret.key"), "!");
      writeFileSync(path.join(made.path, "fazla.txt"), "x");
      const broken = await verifyDevirBackup(made.path);
      assert.deepEqual([broken.ok, broken.changed, broken.extra], [false, ["secret.key"], ["fazla.txt"]]);
      assert.equal((await admin.post("/api/admin/devir/backups/verify", { company: second.id, name: "../x" })).status, 400);
      await assert.rejects(server.app.backups.createDevirBackupFor(company, { label: "manuel" }), error => error.status === 400, "yalnız devir sınıfının etiketleri");
    } finally {
      await server.close();
    }
  });

  test("budanmaz: devir yedeği alındıktan sonra 35 rutin + 40 güvenlik yedeği (gerçek createBackup + pruneBackups; zaman damgaları sahte, 35 gün) ve zamanlayıcı turu — rutin 30, güvenlik 30 kalır, devir yedeği eksiksiz; ad değişince yedek klasörüyle taşınır", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second } = await seed(server);
      let company = companyOf(server.app, second.id);
      companyFiles(server.app.companies.dirsOf(company).dataDir);
      const made = await server.app.backups.createDevirBackupFor(company, { label: "devir-oncesi-2026", year: "2026" });
      for (let i = 0; i < 35; i += 1) server.app.backups.backup(company, { stamp: stampOf(i) });
      for (let i = 0; i < 40; i += 1) server.app.backups.backup(company, { label: `geri-yukleme-oncesi-${company.code}`, stamp: stampOf(100 + i) });
      server.app.runDueBackups();
      const folder = server.app.backups.folderOf(company);
      const files = listBackups(folder);
      assert.equal(files.filter(item => !/-geri-yukleme-oncesi-/.test(item.name)).length, 30, "rutin yedek budandı (30)");
      assert.equal(files.filter(item => /-geri-yukleme-oncesi-/.test(item.name)).length, 30, "güvenlik yedeği budandı (en çok max(SAFETY_KEEP 20, keep 30) = 30)");
      const kept = listDevirBackups(folder);
      assert.deepEqual(kept.map(item => [item.name, item.state]), [[made.name, "tamam"]], "devir yedeği budamada silinmedi");
      assert.equal((await verifyDevirBackup(kept[0].dir)).ok, true, "devir yedeğinin her dosyası yerinde");
      await must("ad değişikliği", admin.put(`/api/companies/${second.id}`, { name: "Yeni Unvan" }));
      company = companyOf(server.app, second.id);
      const moved = server.app.backups.listDevirBackupsFor(company);
      assert.equal(moved.length, 1, "devir yedeği yedek klasörüyle birlikte taşındı");
      assert.ok(moved[0].dir.includes("Yeni Unvan"));
      assert.equal((await verifyDevirBackup(moved[0].dir)).ok, true);
      // Yarım kalan devir yedeği "tamam" görünmez.
      mkdirSync(path.join(server.app.backups.folderOf(company), DEVIR_BACKUP_DIR, `${stampOf(300)}-devir-oncesi-2027.yaziliyor`), { recursive: true });
      assert.deepEqual(listDevirBackups(server.app.backups.folderOf(company)).map(item => item.state).sort(), ["tamam", "yarim"]);
      assert.ok(existsSync(path.join(moved[0].dir, DEVIR_BACKUP_MANIFEST)));
      assert.ok(!readdirSync(server.app.backups.folderOf(company)).some(name => name.endsWith(".yaziliyor")), "yarım devir yedeği şirket klasörünün kökünde değil (rutin yedeğin yarım temizliği ona dokunmaz)");
    } finally {
      await server.close();
    }
  });

  test("Yedekten Geri Yükle (002, hemen): devir ÖNCESİ yedek 409 devir-oncesi-yedek; devir sonrası yedek geri yüklenir; devir geri alınınca devir SONRASI yedek 409 devir-sonrasi-yedek; aynı yıl başka devir çalışması 409; bakımdaki şirkete 503", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second } = await seed(server);
      const company = () => companyOf(server.app, second.id);
      const beforeDevir = server.app.backups.backup(company(), { label: "manuel" });
      await must("arşivsiz şirkette eski yedek geri yüklenir (bugünkü davranış)", restore(admin, beforeDevir, company()));
      const archived = await makeArchive(server.app, second.id, { year: "2025", runId: "devir-2025-a" });
      const preDevir = await restore(admin, beforeDevir, company());
      assert.equal(preDevir.status, 409, JSON.stringify(preDevir.data));
      assert.equal(preDevir.data.code, "devir-oncesi-yedek");
      assert.match(preDevir.data.error, /2025 yıl sonu devrinden önce/);
      const afterDevir = server.app.backups.backup(company(), { label: "manuel" });
      await must("devir sonrası yedek geri yüklenir", restore(admin, afterDevir, company()));
      server.app.companies.removeArchive(second.id, "2025"); // Devri Geri Al benzetimi (D4)
      const postDevir = await restore(admin, afterDevir, company());
      assert.equal(postDevir.status, 409);
      assert.equal(postDevir.data.code, "devir-sonrasi-yedek");
      server.app.companies.addArchive(second.id, { year: "2025", runId: "devir-2025-b", sha256: archived.sha256 });
      const otherRun = await restore(admin, afterDevir, company());
      assert.equal(otherRun.status, 409, "aynı yıl başka devir çalışmasıyla");
      assert.equal(otherRun.data.code, "devir-oncesi-yedek");
      await server.app.maintenance.enter(second.id, { reason: "devir" });
      await assert.rejects(server.app.backups.restoreCompany({ file: afterDevir.path, target: company(), user: null }), error => error.status === 503 && error.extra?.code === "maintenance");
      assert.equal((await restore(admin, afterDevir, company())).status, 503, "bakımdayken uç da 503");
      const holder = await server.app.backups.restoreCompany({ file: beforeDevir.path, target: company(), user: null, devirCheck: false, allowPaused: true });
      assert.equal(holder.restored, true, "kipi tutan iş (Devri Geri Al yolu) bakımda geri yükleyebilir");
      await server.app.maintenance.exit(second.id);
      await must("Devri Geri Al'ın kendi yolu (devirCheck: false) engele takılmaz", server.app.backups.restoreCompany({ file: beforeDevir.path, target: company(), user: null, devirCheck: false }).then(value => ({ status: 200, data: { ok: true, data: value } })));
    } finally {
      await server.close();
    }
  });

  test("Şirket Verisini Sıfırla (Tümünü Sıfırla) devir işaretini (devir.years) korur: arşiv kayıtlı kalır, sıfırlamadan sonra alınan yedek geri yüklenebilir, sıfırlama öncesi yedeği yine denetlenir", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second } = await seed(server);
      const company = () => companyOf(server.app, second.id);
      await makeArchive(server.app, second.id, { year: "2025", runId: "devir-2025-s" });
      await must("Tümünü Sıfırla", admin.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: company().code, password: ADMIN_PASSWORD }));
      const years = JSON.parse(server.app.openCompany(second.id).store.setting(DEVIR_YEARS_KEY, "") || "[]");
      assert.deepEqual(years.map(item => [item.year, item.runId]), [["2025", "devir-2025-s"]], "sıfırlamadan sonra çalışma dosyası devrini bilir");
      const afterReset = server.app.backups.backup(company(), { label: "manuel" });
      await must("sıfırlama sonrası yedek geri yüklenir (arşivle tutarlı)", restore(admin, afterReset, company()));
    } finally {
      await server.close();
    }
  });

  test("Yedekten Geri Yükle (001, yeniden açılışta): devir öncesi yedek hazırlanmaz (409); devirden ÖNCE hazırlanıp devirden SONRA uygulanacak geri yükleme açılışta uygulanmaz, veri aynı kalır, neden Yedekler'de görünür", async () => {
    const dir = workDir();
    let server = await start(dir);
    let preparedName = "";
    try {
      const { admin } = await seed(server);
      const root = companyOf(server.app, ROOT_COMPANY_ID);
      const beforeDevir = server.app.backups.backup(root, { label: "manuel" });
      // Geri yükleme devirden önce hazırlanır (işaret dosyası); sonra devir olur (benzetim) — sunucu yeniden açılınca hazırlık uygulanmamalı.
      const staged = await must("001 hazırlandı", restore(admin, beforeDevir, root));
      assert.equal(staged.staged, true);
      preparedName = beforeDevir.name;
      await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2025" });
      const refused = await restore(admin, beforeDevir, root);
      assert.equal(refused.status, 409, "devirden sonra aynı yedek artık hazırlanmaz");
      assert.equal(refused.data.code, "devir-oncesi-yedek");
      await must("kasa (devirden sonra)", admin.post("/api/workspace/cash", { kind: "in", amount: 5, date: "2026-11-02", description: "devirden sonra" }));
    } finally {
      await server.app.close();
    }
    server = await start(dir);
    try {
      assert.equal(server.app.stagedRestore?.ok, false, "hazırlanmış geri yükleme uygulanmadı");
      assert.match(server.app.stagedRestore.error, /devrinden önce/);
      assert.equal(server.app.stagedRestore.name, preparedName);
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE description = 'devirden sonra'").n, 1, "001'in verisi aynı kaldı");
      assert.ok(server.app.store.setting(DEVIR_YEARS_KEY, ""), "çalışma dosyasının devir kaydı yerinde");
      const admin = await loginAdmin(server);
      const folders = await must("Yedekler", admin.get("/api/admin/backups/folders"));
      assert.equal(folders.lastRestore?.ok, false);
      assert.match(folders.lastRestore.error, /devrinden önce/, "neden Yedekler ekranında");
    } finally {
      await server.close();
    }
  });
});
