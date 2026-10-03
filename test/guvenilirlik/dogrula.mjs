// Güncelleme doğrulaması (2.0.21): eski sürümlerin gerçek koduyla üretilmiş veri/yedek klasörlerinde GÜNCEL sürüm açılır ve
// manifestle (eski sürümün o anki olguları) karşılaştırılır. Fikstür testi (guvenilirlik-221-goc) ve büyük hacimli yerel koşu
// (tools/surum-verisi.mjs --dogrula) aynı denetimleri kullanır.
//   1. Şirket listesi aynı (kimlik, kod, ad); veri dosyası çakışması yok.
//   2. Her şirketin verisi aynı: veri tabanı olguları (kayıt sayıları, tutar toplamları) ve kullanıcının gördüğü cari listesi
//      (her carinin bakiyesi) — eski sürümün gösterdiğiyle bire bir.
//   3. Her eski yedek dosyası duruyor (silinmedi; içerik sha256 ile) ve Yedekler listesinde YALNIZ kendi şirketinin altında.
//   4. Eski sürümün aldığı her yedek kendi şirketine geri yüklenebilir; geri yüklenen veri, o sürümün yedek anındaki verisiyle
//      bire bir; başka şirkete yükleme 409.
//   5. Geri yüklemelerden sonra çalışmaya devam: her şirkete yeni cari, yalnız kendi şirketinde görünür; Tüm Şirketler yedeği.
import path from "node:path";
import { existsSync } from "node:fs";
import { BACKUP_NAME, parseBackupName, readBackupIdentity } from "../../server/lib/backup.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { expectedOwners } from "./fikstur.mjs";
import { apiFacts, dbFacts, treeHashes } from "./olgular.mjs";
import { CURRENT, bootVersion } from "./surumler.mjs";
import { companyDbFile, readRegistry } from "./uretici.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function verifyUpgrade({ dataDir, backupDir, manifest, files = null, log = () => {}, restore = true }) {
  const started = performance.now();
  const failures = [];
  let checks = 0;
  const expect = (condition, message) => {
    checks += 1;
    if (!condition) failures.push(message);
    return Boolean(condition);
  };
  const cut = manifest.cut || manifest.versions.at(-1).version;
  // Açmadan önceki envanter: yedek dosyaları (içerik) ve beklenen sahipleri; veri tabanı dosyaları.
  const before = treeHashes(backupDir);
  const backupFiles = Object.keys(before).filter(rel => BACKUP_NAME.test(path.basename(rel)));
  const owners = new Map(
    backupFiles.map(rel => {
      const fromFixture = files?.find(item => item.path === `yedek/${rel}`)?.owners;
      return [rel, fromFixture || expectedOwners({ version: cut, registry: manifest.registry, backupDir, file: path.join(backupDir, ...rel.split("/")) })];
    }),
  );
  const dataFiles = Object.keys(treeHashes(dataDir)).filter(rel => /\.sqlite$/.test(rel));

  let server = await bootVersion(CURRENT, { dataDir, backupDir });
  let api = await server.login();
  const select = async id => expect((await api.post("/api/companies/select", { id })).status === 200, `şirket seçilemedi: ${id}`);
  const restart = async () => {
    await server.close();
    server = await bootVersion(CURRENT, { dataDir, backupDir });
    api = await server.login();
  };
  try {
    // 1. Şirket listesi
    const listed = (await api.get("/api/companies")).data;
    const expected = manifest.final.map(item => `${item.id}|${item.code}|${item.name}`).sort();
    expect(same(listed.all.map(item => `${item.id}|${item.code}|${item.name}`).sort(), expected), `şirket listesi farklı: ${JSON.stringify(listed.all.map(item => item.label))} ≠ ${JSON.stringify(manifest.final.map(item => `${item.code} · ${item.name}`))}`);
    expect((listed.conflicts || []).length === 0, `veri dosyası çakışması bildirildi: ${JSON.stringify(listed.conflicts)}`);

    // 2. Her şirketin verisi (eski sürümün son gösterdiğiyle)
    const factsNow = async company => {
      await select(company.id);
      const registry = readRegistry(dataDir);
      return { db: dbFacts(companyDbFile(dataDir, registry.find(item => item.id === company.id))), api: await apiFacts(api) };
    };
    for (const company of manifest.final) {
      const now = await factsNow(company);
      expect(same(now.db, company.facts), `${company.code} · ${company.name}: veri tabanı olguları farklı\n    eski: ${JSON.stringify(company.facts)}\n    yeni: ${JSON.stringify(now.db)}`);
      expect(same(now.api, company.api), `${company.code} · ${company.name}: ekrandaki cari listesi farklı\n    eski: ${JSON.stringify(company.api)}\n    yeni: ${JSON.stringify(now.api)}`);
    }

    // 3. Yedekler: hiçbiri silinmedi; listede yalnız kendi şirketinin altında
    const after = treeHashes(backupDir);
    const shaCount = map => Object.values(map).reduce((acc, item) => acc.set(item.sha, (acc.get(item.sha) || 0) + 1), new Map());
    const beforeCount = shaCount(before);
    const afterCount = shaCount(after);
    for (const [sha, count] of beforeCount) expect((afterCount.get(sha) || 0) >= count, `yedek dosyası kayboldu (sha ${sha.slice(0, 12)})`);
    for (const rel of dataFiles) expect(existsSync(path.join(dataDir, ...rel.split("/"))), `veri dosyası kayboldu: ${rel}`);
    const listing = (await api.get("/api/admin/backups")).data;
    const bySha = new Map(Object.entries(after).map(([rel, item]) => [path.join(backupDir, ...rel.split("/")), item.sha]));
    const liveIds = new Set(manifest.final.map(item => item.id));
    for (const rel of backupFiles) {
      const sha = before[rel].sha;
      const where = listing.filter(item => item.name === path.basename(rel) && bySha.get(path.join(item.folder, item.name)) === sha).map(item => item.companyId);
      const want = owners.get(rel).filter(id => liveIds.has(id));
      if (want.length <= 1) expect(same(where.sort(), want.sort()), `yedek ${rel}: listede ${JSON.stringify(where)} altında, beklenen ${JSON.stringify(want)}`);
      else expect(where.length >= 1 && where.every(id => want.includes(id)), `ortak dosyalı şirketlerin yedeği ${rel}: listede ${JSON.stringify(where)}, beklenen ${JSON.stringify(want)} içinden`);
    }
    const knownShas = new Set(Object.values(before).map(item => item.sha));
    for (const item of listing) {
      const sha = bySha.get(path.join(item.folder, item.name));
      if (knownShas.has(sha)) continue;
      // Güncel sürümün açılışta aldığı yeni yedek yalnız göç öncesi yedeği olabilir; kimliği kendi şirketi.
      expect(/^pre-migration/.test(parseBackupName(item.name)?.label || "") && readBackupIdentity(path.join(item.folder, item.name))?.id === item.companyId, `beklenmeyen yedek listede: ${item.company} ${item.name}`);
    }
    log(`  ✓ ${manifest.final.length} şirket, ${backupFiles.length} eski yedek denetlendi`);

    // 4. Eski sürümlerin aldığı yedekler kendi şirketine geri yüklenir; veri yedek anındaki gibi
    if (restore) {
      const records = manifest.backups.filter(item => liveIds.has(item.companyId));
      const finalOf = id => manifest.final.find(item => item.id === id);
      for (const record of records) {
        const company = finalOf(record.companyId);
        const others = manifest.final.filter(item => item.id !== company.id);
        if (others.length) {
          const wrong = await api.post("/api/admin/backups/restore", { name: record.file, company: company.id, target: others[0].id, confirm: others[0].code, password: ADMIN_PASSWORD });
          expect(wrong.status === 409, `${record.version} yedeği ${record.file} başka şirkete (${others[0].code}) yüklenebildi: ${wrong.status}`);
        }
      }
      // Hepsi, eskiden yeniye: 002 ve sonrası hemen; 001 yeniden açılışta uygulanır (her biri için sunucu yeniden açılır).
      const byStamp = (a, b) => (parseBackupName(a.file)?.stamp || "").localeCompare(parseBackupName(b.file)?.stamp || "");
      const sorted = [...records.filter(item => item.companyId !== "sirket-001").sort(byStamp), ...records.filter(item => item.companyId === "sirket-001").sort(byStamp)];
      for (const record of sorted) {
        const company = finalOf(record.companyId);
        const response = await api.post("/api/admin/backups/restore", { name: record.file, company: company.id, confirm: company.code, password: ADMIN_PASSWORD });
        if (!expect(response.status === 200, `${record.version} yedeği ${record.file} (${company.code}) geri yüklenemedi: ${response.status} ${JSON.stringify(response.data).slice(0, 200)}`)) continue;
        if (response.data.staged) {
          await restart();
          expect(server.app.stagedRestore?.ok === true, `001 geri yüklemesi açılışta uygulanmadı: ${JSON.stringify(server.app.stagedRestore)}`);
        }
        const now = await factsNow(company);
        expect(same(now.db, record.facts), `${record.version} yedeği ${record.file} geri yüklendi ama veri yedek anındaki gibi değil\n    yedek anı: ${JSON.stringify(record.facts)}\n    şimdi:     ${JSON.stringify(now.db)}`);
        expect(same(now.api, record.api), `${record.version} yedeği ${record.file}: ekrandaki cari listesi yedek anındaki gibi değil`);
        // Öbür şirketler değişmedi.
        for (const other of manifest.final.filter(item => item.id !== company.id)) {
          const registry = readRegistry(dataDir);
          const live = dbFacts(companyDbFile(dataDir, registry.find(item => item.id === other.id)));
          checks += 1;
          if (other.lastRestored ? !same(live, other.lastRestored) : !same(live, other.facts)) failures.push(`${company.code} geri yüklenirken ${other.code} şirketinin verisi değişti`);
        }
        company.lastRestored = now.db;
      }
      log(`  ✓ ${sorted.length} eski yedek geri yüklendi, ${records.length} yanlış şirkete yükleme denendi`);
    }

    // 5. Çalışmaya devam: her şirkete bir cari; yalnız kendinde görünür. Tüm Şirketler yedeği kendi klasörlerine, kimlikleriyle.
    for (const company of manifest.final) {
      await select(company.id);
      expect((await api.post("/api/workspace/accounts", { name: `Güncelleme Sonrası ${company.code}`, type: "customer" })).status === 200, `${company.code}: güncellemeden sonra cari eklenemedi`);
    }
    for (const company of manifest.final) {
      await select(company.id);
      const names = (await api.get("/api/workspace/accounts?status=all&limit=5000&q=G%C3%BCncelleme%20Sonras%C4%B1")).data.accounts.map(item => item.name);
      expect(same(names, [`Güncelleme Sonrası ${company.code}`]), `${company.code}: güncelleme sonrası cariler ${JSON.stringify(names)}`);
    }
    const all = await api.post("/api/admin/backups", { scope: "all" });
    expect(all.status === 200 && all.data.backups.length === manifest.final.length, `Tüm Şirketler yedeği: ${all.status} ${JSON.stringify(all.data).slice(0, 200)}`);
    for (const item of all.data.backups || []) expect(readBackupIdentity(path.join(item.folder, item.name))?.id === item.companyId, `yeni yedeğin kimliği yanlış: ${item.company} ${item.name}`);
    const folders = new Set((all.data.backups || []).map(item => item.folder.toUpperCase()));
    expect(folders.size === manifest.final.length, "iki şirketin yedeği aynı klasöre gitti");
    if (api.client.cookie) await select("sirket-001");
  } finally {
    await server.close();
  }
  return { checks, failures, ms: performance.now() - started };
}
