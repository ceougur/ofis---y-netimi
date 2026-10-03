// Yedek denetimi (v2.0.21, kullanıcı: "her şirketin yedeğini sunucuda kendi adıyla klasör açıp yedeklediğini kontrol et").
//
// Yedek kökünü (backups\) baştan sona tarar ve şirket kayıt defteriyle karşılaştırır. Hiçbir dosyayı değiştirmez, taşımaz,
// silmez; yalnız rapor verir. Kurallar (docs/2.0.21-BOZULMA-LISTESI.md → D3):
//   - Her şirketin yedek klasörü "<kod> - <ad>" (ya da kayıttaki ekli ad, ör. "002 - Ad (2)") ve diskte o adla duruyor.
//   - İki şirket aynı yedek klasörünü kullanmıyor (Windows gibi büyük/küçük harf ayrımsız).
//   - Şirketin klasöründeki her yedeğin içindeki kimlik o şirket. Başka şirketin kimliğini taşıyan yedek HATA.
//   - Kimliksiz yedek (2.0.19 ve öncesi) yalnız uyarı: hangi şirketin olduğu dosyadan bilinemez.
//   - Kayıtta olmayan klasör (silinmiş şirketin yedekleri bilerek yerinde bırakılır) ve kökte kalan yedek bilgi olarak
//     listelenir; içindeki kimlik yaşayan bir şirketinse o şirketin klasörüne ait olduğu söylenir.
//   - Yarıda kalmış yedek dosyası (.yaziliyor) bilgi olarak listelenir (sonraki yedekte temizlenir).
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { BACKUP_NAME, parseBackupName, readBackupIdentity } from "./backup.mjs";

const key = value => String(value).toUpperCase();

export function auditBackups({ registry, backupRoot }) {
  const companies = registry.list();
  const byId = new Map(companies.map(company => [company.id, company]));
  const errors = [];
  const warnings = [];
  const notes = [];
  const owned = new Map(); // klasör adı (büyük harf) → şirket
  const report = [];

  for (const company of companies) {
    const folderPath = registry.dirsOf(company).backupDir;
    const folder = path.basename(folderPath);
    const label = `${company.code} · ${company.name}`;
    const clash = owned.get(key(folder));
    if (clash) errors.push(`${label} ve ${clash.code} · ${clash.name} aynı yedek klasörünü kullanıyor: ${folder}`);
    else owned.set(key(folder), company);
    const files = [];
    if (existsSync(folderPath)) {
      for (const name of readdirSync(folderPath)) {
        if (!BACKUP_NAME.test(name)) {
          if (name.endsWith(".yaziliyor")) notes.push(`${folder}\\${name}: yarıda kalmış yedek (sonraki yedekte temizlenir).`);
          continue;
        }
        const file = path.join(folderPath, name);
        const identity = readBackupIdentity(file);
        const parsed = parseBackupName(name);
        let state = "ok";
        if (!identity) {
          state = "kimliksiz";
          warnings.push(`${folder}\\${name}: içinde şirket kimliği yok (2.0.19 ve öncesinden); ${label} klasörüne taşınmış eski yedek.`);
        } else if (identity.id !== company.id) {
          state = "baska-sirket";
          const owner = byId.get(identity.id);
          errors.push(`${folder}\\${name}: ${label} klasöründe ama içinde ${owner ? `${owner.code} · ${owner.name}` : `${identity.code || "?"} · ${identity.name || "?"} (kayıtta yok)`} şirketinin kimliği var.`);
        }
        files.push({ name, code: parsed?.code || null, label: parsed?.label || "", identity: identity ? { id: identity.id, code: identity.code, name: identity.name } : null, state, size: statSync(file).size });
      }
    }
    report.push({ id: company.id, code: company.code, name: company.name, folder, exists: existsSync(folderPath), count: files.length, files });
  }

  // Kökte kalanlar ve kayıtta olmayan klasörler.
  const stray = [];
  if (existsSync(backupRoot)) {
    for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (owned.has(key(entry.name))) continue;
        const dir = path.join(backupRoot, entry.name);
        const names = readdirSync(dir).filter(name => BACKUP_NAME.test(name));
        if (!names.length) continue;
        const owners = new Set(names.map(name => readBackupIdentity(path.join(dir, name))?.id).filter(Boolean));
        const living = [...owners].map(id => byId.get(id)).filter(Boolean);
        const where = living.length ? ` İçindeki yedekler ${living.map(item => `${item.code} · ${item.name}`).join(", ")} şirketinin; Yedekler listesinde o şirketin altında görünmüyor olabilir.` : " Silinmiş bir şirketin yedekleri olabilir (bilerek yerinde bırakılır).";
        (living.length ? warnings : notes).push(`${entry.name}: kayıtta hiçbir şirketin klasörü değil (${names.length} yedek).${where}`);
        stray.push({ folder: entry.name, count: names.length, owners: [...owners] });
      } else if (BACKUP_NAME.test(entry.name)) {
        const identity = readBackupIdentity(path.join(backupRoot, entry.name));
        const owner = identity ? byId.get(identity.id) : null;
        notes.push(`${entry.name}: yedek kökünde (eski yer)${owner ? `; ${owner.code} · ${owner.name} şirketinin` : ""}. Güncelleme sonrası geri dönüş için kısa süre bekletilir.`);
        stray.push({ file: entry.name, owner: owner?.id || null });
      } else if (entry.name.endsWith(".yaziliyor")) notes.push(`${entry.name}: yarıda kalmış yedek.`);
    }
  }
  return { ok: errors.length === 0, backupRoot, companies: report, stray, errors, warnings, notes, checkedAt: new Date().toISOString() };
}
