// Veri dosyası paylaşan şirketi ayırma (v2.0.21).
//
// 2.0.17–2.0.19'da bir şirketin kodu değiştirilip (002 → 005) eski kodla yeni şirket açılınca ikisi kayıtta aynı veri
// klasörünü gösteriyordu: iki şirket AYNI veri tabanına yazıyordu. 2.0.20 yeni açılışları önler; bu modül o sırayı yaşamış
// kurulumu düzeltir. Kayıtlar o güne kadar zaten ortaktı (iki şirket de aynı kayıtları görüyordu); hangi kaydın hangi
// şirkete ait olduğu dosyadan bilinemez. Bu yüzden hiçbir kayıt silinmez ve hiçbir şey tahmin edilmez:
//   1. Ortak dosyanın yedeği ayrılan şirketin yedek klasörüne alınır ("ayirma-oncesi-<kod>").
//   2. Ortak veri tabanının tutarlı kopyası (VACUUM INTO) ve şirket dosyaları (belgeler, mesaj arşivi, gizli anahtar) hiçbir
//      şirketin kullanmadığı yeni klasöre kopyalanır; kopyanın veri tabanı kimliği yenilenir.
//   3. Kayıt defterinde şirket yeni klasöre bağlanır. Dosyayı koruyan şirket (001 ya da en eski) yerinde kalır.
// Sonuç: iki şirket bundan sonra ayrı; ayırma anındaki kayıtlar ikisinde de durur, kullanıcı her şirkette o şirkete ait
// olmayanları siler (Silinenler'den geri alınabilir). Bir adım başarısız olursa yeni klasör silinir, kayıt değişmez.
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createStore, openDatabase } from "./db.mjs";
import { DB_FILE, resolveDbPath } from "./db-path.mjs";
import { HttpError } from "./http.mjs";

// Şirket klasöründe veri tabanı dışında şirkete ait olanlar (001'in kök klasöründeki ortak dosyalar — şirket listesi,
// makine kimliği, öbür şirketlerin klasörleri — kopyalanmaz).
const COMPANY_FILES = ["belgeler", "mesaj-arsivi", "secret.key"];

export async function separateCompany({ registry, backups, withDb, closeCompany = async () => false, busy = new Map(), dataDir, id, log = null }) {
  const company = registry.require(id);
  const group = registry.conflictOf(company.id);
  if (!group) throw new HttpError(409, `“${company.label}” başka bir şirketle veri dosyası paylaşmıyor; ayırmaya gerek yok.`);
  if (group.keeper === company.id) {
    const others = group.companies.filter(item => !item.keeper).map(item => item.label).join(", ");
    throw new HttpError(409, `“${company.label}” ortak dosyayı koruyan şirket; ayırmak için öbür şirketi (${others}) seçin.`);
  }
  for (const member of group.companies) {
    if (busy.has(member.id)) throw new HttpError(409, busy.get(member.id) || "Bu şirkette başka bir işlem sürüyor; birkaç saniye sonra yeniden deneyin.");
  }
  const message = `“${company.label}” ayrılıyor; birkaç saniye sonra yeniden deneyin.`;
  busy.set(company.id, message);
  const from = registry.dirsOf(company).dataDir;
  const dir = registry.freeDataDir(company.code);
  const target = path.join(dataDir, dir);
  let created = false;
  try {
    // Ayrılan şirketin açık örneği kapatılır (bu sırada istekleri 503 alır); dosyayı koruyan şirket çalışmaya devam eder.
    await closeCompany(company.id);
    let backup = "";
    try {
      backup = backups.backup(company, { label: `ayirma-oncesi-${company.code}`, keep: 100 })?.name || "";
    } catch (error) {
      throw new HttpError(500, `Ayırma öncesi yedek alınamadı; şirket ayrılmadı (${error.message}).`);
    }
    if (!backup) throw new HttpError(500, "Ortak veri dosyası bulunamadı; şirket ayrılmadı.");
    mkdirSync(target, { recursive: true });
    created = true;
    const file = path.join(target, DB_FILE);
    withDb(company, db => db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`));
    if (!existsSync(file)) throw new Error("veri tabanı kopyalanamadı");
    for (const name of COMPANY_FILES) {
      const source = path.join(from, name);
      if (existsSync(source)) cpSync(source, path.join(target, name), { recursive: true, errorOnExist: false });
    }
    // Kopyanın veri tabanı kimliği yenilenir: iki şirket artık ayrı soydan (kimliksiz eski yedekler ortak dosyanındır).
    const copy = openDatabase(resolveDbPath(target));
    try {
      createStore(copy).setSetting("meta.instanceId", randomUUID());
    } finally {
      copy.close();
    }
    registry.setDataDir(company.id, dir);
    log?.info?.(`Şirket ayrıldı: ${company.label} → ${target} (önceki ortak klasör: ${from}; yedek: ${backup})`);
    return { company: registry.get(company.id), from, to: target, backup, sharedWith: group.companies.filter(item => item.id !== company.id).map(item => item.label) };
  } catch (error) {
    if (created) {
      try {
        rmSync(target, { recursive: true, force: true });
      } catch {
        // yeni klasör silinemedi; kayıt değişmediği için kullanılmaz
      }
    }
    if (error instanceof HttpError) throw error;
    log?.error?.(`Şirket ayrılamadı (${company.label})`, error);
    throw new HttpError(500, `Şirket ayrılamadı; hiçbir şey değişmedi (${error.message}).`);
  } finally {
    busy.delete(company.id);
  }
}
