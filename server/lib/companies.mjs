// Çoklu şirket (v2.0.17, müşteri: "001 kodlu şirket, 002 kodlu şirket diye datada ayırır").
//
// Her şirket AYRI bir veri tabanı dosyasıdır (yaygın muhasebe programlarındaki "firma" gibi; veri karışması imkânsız,
// yedek/geri yükleme şirket bazında). Ortak katman: lisans, kullanıcılar, roller, şirket listesi — ilk (kök) veri
// tabanında. Mevcut kurulumun verisi göçte ilk şirket (001) olur; hiçbir kayıt taşınmaz, dosya yerinde kalır.
//   - Kayıt defteri: <dataDir>/sirketler.json  { companies: [{ id, code, name, dir, createdAt, createdBy }] }
//   - 001: dir "" (kök veri klasörü); diğerleri: <dataDir>/sirketler/<kod>/ (veri). Kod sonradan değişse de veri klasörü ve
//     iç kimlik aynı kalır (veri aynı şirkette).
//   - Yedek (v2.0.20, kullanıcı kararı): her şirketin yedekleri kendi adını taşıyan klasörde, <backupDir>/<kod> - <ad>/
//     (ör. "001 - Şirket 1"); ad ya da kod değişince klasör yeniden adlandırılır. 2.0.19'a kadarki yerler (001: <backupDir>
//     kökü, diğerleri <backupDir>/sirket-<klasör>/) "eski yer" olarak tanınır; açılışta yedekler yeni klasöre taşınır.
//   - Kullanıcı seçimi ve yetkisi ortak ayarlarda: company.user.<kullanıcı> (seçili şirket), company.access.<kullanıcı>
//     (görebildiği şirket kimlikleri; yönetici hepsini görür; kayıt yoksa yalnız 001).
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKUP_NAME, companyFolderName, moveBackupFolder, parseBackupName, readBackupIdentity } from "./backup.mjs";
import { DatabaseSync } from "node:sqlite";
import { HttpError } from "./http.mjs";

export const ROOT_COMPANY_ID = "sirket-001";
const CODE = /^\d{3}$/;
const REGISTRY = "sirketler.json";
// Kayıt defterinin ikinci kopyası (v2.0.21): asıl dosya bozulursa (elektrik kesintisi, elle düzenleme) şirket listesi
// buradan, o da yoksa ortak katmanın veri tabanındaki kopyadan geri kurulur. Bozuk dosya silinmez, yanına alınır.
export const REGISTRY_COPY = "sirketler.yedek.json";
const REGISTRY_SETTING = "company.registry";
// Şirket sayısı sınırı (kullanıcı kararı, 05.10.2026): en fazla 2 şirket açılır; Standart ve Pro aynı. Sınırdan önce açılmış
// şirketler (3 ve üstü) kalır, hiçbiri silinmez; yalnız yenisi açılmaz. Silinen şirket sayılmaz (silince yenisi açılabilir).
export const MAX_COMPANIES = 2;
// 3+ şirketi olan eski kurulumda "bir şirketi silin" yanıltırdı (bir silme yetmez): kaç şirket kaldığı söylenir.
export const companyLimitMessage = (max, count = max) =>
  count > max
    ? `En fazla ${max} şirket kurulabilir. Şu an ${count} şirket var; yeni şirket açmak için şirket sayısının ${max}'nin altına inmesi gerekir.`
    : `En fazla ${max} şirket kurulabilir. Yeni şirket açmak için önce bir şirketi silin.`;
/** Kayıt defteri dosyasını okur: geçerli ({ companies: [...] }, en az bir şirket) ise döner, yoksa null. */
export function readRegistryFile(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const list = Array.isArray(parsed?.companies) ? parsed.companies.filter(item => item && typeof item.id === "string" && CODE.test(String(item.code)) && typeof item.dir === "string") : [];
    return list.length && list.some(item => item.id === ROOT_COMPANY_ID) ? { ...parsed, companies: list } : null;
  } catch {
    return null;
  }
}

const now = () => new Date().toISOString();
const text = value => String(value ?? "").replace(/\s+/g, " ").trim();

export function createCompanyRegistry({ dataDir, backupDir, hubStore, log = { info() {}, warn() {} }, maxCompanies = MAX_COMPANIES }) {
  const file = path.join(dataDir, REGISTRY);
  let registry = { companies: [] };
  registry = load();
  // Açılışta kopyalar asıl listeyle eşitlenir (v2.0.21): güncellemeden sonra liste hiç değişmeden asıl dosya bozulursa da
  // ikinci kopya ve ortak veri tabanındaki kopya hazırdır.
  try {
    const body = JSON.stringify(registry, null, 2);
    const copy = path.join(dataDir, REGISTRY_COPY);
    if (!existsSync(copy) || readFileSync(copy, "utf8") !== body) {
      writeFileSync(`${copy}.tmp`, body);
      renameSync(`${copy}.tmp`, copy);
    }
    if (hubStore.setting(REGISTRY_SETTING, "") !== JSON.stringify(registry)) hubStore.setSetting(REGISTRY_SETTING, JSON.stringify(registry));
  } catch {
    // ilk kurulumda ayar tablosu henüz yok; dosya kopyası yeter
  }

  function load() {
    const main = existsSync(file) ? readRegistryFile(file) : null;
    if (main) return main;
    // v2.0.21 (arıza testi bulgusu): okunamayan liste yerine yalnız 001'li yeni liste yazılıyordu; 002 ve sonraki şirketler
    // listeden düşüyor, bozuk dosya da üzerine yazıldığı için kurtarılamıyordu. Artık bozuk dosya yanına alınır ve liste
    // sırayla ikinci kopyadan, ortak veri tabanındaki kopyadan, o da yoksa diskteki şirket klasörlerinden kurulur.
    if (existsSync(file)) {
      const aside = `${file}.bozuk-${now().replace(/[:.]/g, "-")}`;
      try {
        copyFileSync(file, aside);
      } catch {
        // kopyalanamadı; aşağıdaki kurtarma yine denenir
      }
      log.warn?.(`Şirket listesi okunamadı; bozuk dosya ${path.basename(aside)} adıyla saklandı, liste kopyasından kuruluyor.`);
    }
    const fromCopy = readRegistryFile(path.join(dataDir, REGISTRY_COPY));
    let fromHub = null;
    try {
      const raw = hubStore.setting(REGISTRY_SETTING, "");
      const parsed = raw ? JSON.parse(raw) : null;
      fromHub = parsed && Array.isArray(parsed.companies) && parsed.companies.some(item => item?.id === ROOT_COMPANY_ID) ? parsed : null;
    } catch {
      fromHub = null;
    }
    const recovered = fromCopy || fromHub || (existsSync(file) ? fromDisk() : null);
    if (recovered) {
      log.warn?.(`Şirket listesi ${fromCopy ? "ikinci kopyadan" : fromHub ? "ortak veri tabanındaki kopyadan" : "diskteki şirket klasörlerinden"} geri kuruldu (${recovered.companies.length} şirket).`);
      save(recovered);
      return recovered;
    }
    // Göç: mevcut veri ilk şirkettir (001). Unvan ofis adından gelir; yoksa "Şirket 1". (v2.0.20: kayıt defteri veritabanı
    // göçlerinden önce kurulur ki göç öncesi yedek de şirketin klasörüne gitsin; yeni kurulumda ayar tablosu henüz yoktur.)
    let office = "";
    try {
      office = text(hubStore.setting("office.name", ""));
    } catch {
      office = "";
    }
    const name = office || "Şirket 1";
    const fresh = { companies: [{ id: ROOT_COMPANY_ID, code: "001", name, dir: "", createdAt: now(), createdBy: "" }] };
    save(fresh);
    return fresh;
  }
  // Son çare: kopyalar da yoksa sirketler/<klasör> altındaki veri tabanlarından liste kurulur. Yedek, şirket veri tabanının
  // kopyası olduğundan içinde aynı veri tabanı kimliği (meta.instanceId) vardır: şirketin asıl kimliği, kodu ve adı en
  // yeni kimlikli yedeğinden (backup_meta) alınır (kullanıcı yetkileri ve yedeklerle bağ korunur); yedeği yoksa klasör
  // adından ve şirketin unvan ayarından.
  function instanceOf(file) {
    try {
      const handle = new DatabaseSync(file, { readOnly: true });
      try {
        return { instance: handle.prepare("SELECT value FROM settings WHERE key = 'meta.instanceId'").get()?.value || "", office: handle.prepare("SELECT value FROM settings WHERE key = 'office.name'").get()?.value || "" };
      } finally {
        handle.close();
      }
    } catch {
      return { instance: "", office: "" };
    }
  }
  function identitiesFromBackups() {
    const found = new Map(); // instanceId → { identity, stamp }
    let folders = [];
    try {
      folders = readdirSync(backupDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(backupDir, entry.name));
    } catch {
      folders = [];
    }
    for (const folder of folders) {
      let names = [];
      try {
        names = readdirSync(folder).filter(name => BACKUP_NAME.test(name));
      } catch {
        names = [];
      }
      for (const name of names) {
        const file = path.join(folder, name);
        // "ayirma-oncesi" yedeği ortak dosyadan, ayrılan şirketin kimliğiyle alınır; içindeki veri tabanı kimliği dosyayı
        // koruyan şirketinkidir — kimlik eşleşmesinde sayılmaz (gözden geçirme bulgusu).
        const parsed = parseBackupName(name);
        if (/^ayirma-oncesi(?:-|$)/.test(parsed?.label || "")) continue;
        const identity = readBackupIdentity(file);
        if (!identity) continue;
        const { instance } = instanceOf(file);
        const stamp = parsed?.stamp || "";
        if (instance && (!found.has(instance) || found.get(instance).stamp < stamp)) found.set(instance, { identity, stamp, folder: path.basename(folder) });
      }
    }
    return found;
  }
  function fromDisk() {
    const companies = [{ id: ROOT_COMPANY_ID, code: "001", name: text(hubStore.setting?.("office.name", "") || "") || "Şirket 1", dir: "", createdAt: now(), createdBy: "" }];
    const base = path.join(dataDir, "sirketler");
    let dirs = [];
    try {
      dirs = readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    } catch {
      dirs = [];
    }
    const used = new Set(["001"]);
    const known = identitiesFromBackups();
    const ids = new Set([ROOT_COMPANY_ID]);
    for (const name of dirs) {
      const db = ["destekofis.sqlite", "hukuk-ofisi.sqlite"].map(item => path.join(base, name, item)).find(item => existsSync(item));
      if (!db) continue;
      const { instance, office } = instanceOf(db);
      const identity = instance ? known.get(instance)?.identity : null;
      const guess = identity && CODE.test(String(identity.code)) ? String(identity.code) : /^\d{3}/.exec(name)?.[0];
      let code = guess && !used.has(guess) ? guess : "";
      for (let n = 2; !code && n < 1000; n += 1) if (!used.has(String(n).padStart(3, "0"))) code = String(n).padStart(3, "0");
      used.add(code);
      const id = identity?.id && !ids.has(identity.id) ? identity.id : `sirket-kurtarilan-${name}`;
      ids.add(id);
      const entry = { id, code, name: text(identity?.name || office) || `Şirket ${code}`, dir: path.join("sirketler", name), createdAt: "", createdBy: "", recovered: true };
      // Yedek klasörü: yedeğin bulunduğu klasör (ekli ad, ör. "002 - Ad (2)", korunur).
      const folder = id === identity?.id ? known.get(instance)?.folder : "";
      if (folder && folder.toUpperCase() !== companyFolderName(entry).toUpperCase()) entry.backupFolder = folder;
      companies.push(entry);
    }
    return { companies };
  }
  function save(value = registry) {
    mkdirSync(dataDir, { recursive: true });
    const body = JSON.stringify(value, null, 2);
    // Önce ikinci kopya, sonra asıl dosya (gözden geçirme bulgusu): yazım yarıda kalırsa asıl dosya eski hâlinde kalır,
    // bellekteki liste de değişmez (atlanan hata çağırana gider); açılışta kopya asıl dosyayla yeniden eşitlenir.
    for (const target of [path.join(dataDir, REGISTRY_COPY), file]) {
      const tmp = `${target}.tmp`;
      writeFileSync(tmp, body);
      renameSync(tmp, target);
    }
    try {
      hubStore.setSetting(REGISTRY_SETTING, JSON.stringify(value));
    } catch {
      // ilk kurulumda ayar tablosu henüz yok; dosya ve ikinci kopya yeter
    }
    registry = value;
  }

  const list = () => registry.companies.map(item => ({ ...item, root: item.id === ROOT_COMPANY_ID, label: `${item.code} · ${item.name}` }));
  const get = id => list().find(item => item.id === id) || null;
  const require = id => {
    const found = get(id);
    if (!found) throw new HttpError(404, "Şirket bulunamadı; silinmiş olabilir.");
    return found;
  };
  const byCode = code => list().find(item => item.code === code) || null;
  function nextCode() {
    const used = new Set(list().map(item => Number(item.code)));
    let n = 1;
    while (used.has(n)) n += 1;
    return String(n).padStart(3, "0");
  }
  // Şirketin klasörleri: veri 001'de kök klasörde (dosya yerinde kalır), diğerlerinde sirketler/<kod>; yedek her şirkette
  // <backupDir>/<kod> - <ad>. legacyBackupDirs: 2.0.19'a kadarki yer + taşıması yarım kalmış eski adlı klasörler.
  const isRoot = company => company.id === ROOT_COMPANY_ID || !company.dir;
  const legacyBackupDirsOf = company => {
    const dirs = [isRoot(company) ? backupDir : path.join(backupDir, `sirket-${path.basename(company.dir)}`)];
    for (const folder of Array.isArray(company.oldBackupDirs) ? company.oldBackupDirs : []) {
      const safe = path.basename(String(folder || ""));
      if (safe && safe !== "." && safe !== "..") dirs.push(path.join(backupDir, safe));
    }
    return dirs;
  };
  // Yedek klasörünün adı: "<kod> - <ad>"; aynı adlı klasör başka bir (ör. silinmiş) şirketin yedekleriyle doluysa kayıtta
  // "backupFolder" olarak ek almış ad tutulur ("002 - Ad (2)") — iki şirketin yedekleri asla aynı klasöre düşmez (v2.0.20).
  const backupFolderOf = company => (company.backupFolder ? path.basename(String(company.backupFolder)) : companyFolderName(company));
  const dirsOf = company => ({
    dataDir: isRoot(company) ? dataDir : path.join(dataDir, company.dir),
    backupDir: path.join(backupDir, backupFolderOf(company)),
    backupRoot: backupDir,
    legacyBackupDirs: legacyBackupDirsOf(company),
  });

  const codeInput = (value, exceptId = "") => {
    const code = text(value);
    if (!CODE.test(code)) throw new HttpError(400, "Şirket kodu üç haneli olmalı (ör. 001, 002).");
    const taken = byCode(code);
    if (taken && taken.id !== exceptId) throw new HttpError(409, `${code} kodu "${taken.name}" şirketinde kullanılıyor.`);
    return code;
  };
  const nameInput = value => {
    const name = text(value).slice(0, 120);
    if (!name) throw new HttpError(400, "Şirketin adını (unvanını) yazın.");
    return name;
  };

  // Windows dosya sistemi büyük/küçük harfe duyarsızdır (yerel ayarsız büyük harfle karşılaştırılır; "İ" ile "i" ayrıdır).
  const sameName = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();
  const hasBackups = folder => {
    try {
      return readdirSync(path.join(backupDir, folder)).some(name => BACKUP_NAME.test(name));
    } catch {
      return false;
    }
  };
  // Veri klasörü (v2.0.20 düzeltmesi, 2.0.17'den kalan hata): kodu sonradan değişen bir şirket "sirketler/002"yi tutarken
  // yeni şirkete 002 kodu verilince ikisi AYNI veri tabanını açıyordu. Artık hiçbir şirketin kullanmadığı ve diskte
  // bulunmayan klasör seçilir: sirketler/002, sirketler/002-2, sirketler/002-3…
  function freeDataDir(code) {
    for (let n = 1; n < 1000; n += 1) {
      const dir = path.join("sirketler", n === 1 ? code : `${code}-${n}`);
      if (registry.companies.some(item => item.dir && sameName(path.normalize(item.dir), dir))) continue;
      if (existsSync(path.join(dataDir, dir))) continue;
      return dir;
    }
    return path.join("sirketler", `${code}-${randomUUID().slice(0, 8)}`);
  }
  // Veri dosyası çakışması (v2.0.21): 2.0.17–2.0.19'da "kod değiştir + eski kodla yeni şirket aç" sırasını yaşamış kurulumda
  // iki şirket kayıtta AYNI veri klasörünü gösterir (2.0.20 yalnız yenisini önler). Klasörler tam yol ve Windows gibi
  // büyük/küçük harf ayrımsız karşılaştırılır; 001 dışı bir şirketin kök klasörü göstermesi (bozuk kayıt) de çakışmadır.
  // Gruptaki ilk şirket (001 ya da en eski) dosyayı korur; öbürleri Yönetim → Şirketler → Ayır ile kendi klasörüne alınır.
  const dataKey = company => path.resolve(dirsOf(company).dataDir).toUpperCase();
  function conflicts() {
    const groups = new Map();
    for (const company of list()) {
      const key = dataKey(company);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(company);
    }
    return [...groups.values()]
      .filter(group => group.length > 1)
      .map(group => {
        const sorted = [...group].sort((a, b) => Number(b.root) - Number(a.root) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.code.localeCompare(b.code));
        return { dataDir: dirsOf(sorted[0]).dataDir, keeper: sorted[0].id, companies: sorted.map(item => ({ id: item.id, code: item.code, name: item.name, label: item.label, root: item.root, keeper: item.id === sorted[0].id })) };
      });
  }
  const conflictOf = id => conflicts().find(group => group.companies.some(item => item.id === id)) || null;
  // 001 dışı şirket kök veri klasörünü gösteriyorsa açılmaz: açılışta ortak kullanıcı tablosunu yeniden yazardı.
  const sharesRoot = company => Boolean(company) && company.id !== ROOT_COMPANY_ID && dataKey(company) === path.resolve(dataDir).toUpperCase();
  // Ayırma: şirkete hiçbir şirketin kullanmadığı, diskte olmayan yeni veri klasörü verilir (kopyalama company-separate.mjs'de).
  function setDataDir(id, dir) {
    require(id);
    if (id === ROOT_COMPANY_ID) throw new HttpError(409, "İlk şirketin (001) veri klasörü değiştirilemez.");
    save({ companies: registry.companies.map(item => (item.id === id ? { ...item, dir, updatedAt: now() } : item)) });
    return get(id);
  }

  // Yedek klasörü: başka şirketin kullandığı ya da içinde (silinmiş şirketten kalma) yedek bulunan ad verilmez.
  function freeBackupFolder(base, exceptId = "") {
    for (let n = 1; n < 1000; n += 1) {
      const folder = n === 1 ? base : `${base} (${n})`;
      if (registry.companies.some(item => item.id !== exceptId && sameName(backupFolderOf(item), folder))) continue;
      if (hasBackups(folder)) continue;
      return folder;
    }
    return `${base} (${randomUUID().slice(0, 8)})`;
  }

  // Sınır durumu: sayı, üst sınır ve yenisi açılabilir mi (arayüz düğmeyi buna göre pasif yapar, nedenini yazar).
  function limit() {
    const count = registry.companies.length;
    return { max: maxCompanies, count, canCreate: count < maxCompanies, reason: count < maxCompanies ? "" : companyLimitMessage(maxCompanies, count) };
  }
  function create(user, { code, name }) {
    const state = limit();
    if (!state.canCreate) throw new HttpError(409, state.reason, { code: "company-limit" });
    const safeCode = codeInput(code || nextCode());
    const safeName = nameInput(name);
    const dir = freeDataDir(safeCode);
    const base = companyFolderName({ code: safeCode, name: safeName });
    const folder = freeBackupFolder(base);
    const company = { id: `sirket-${randomUUID()}`, code: safeCode, name: safeName, dir, createdAt: now(), createdBy: user?.id || "", ...(folder !== base ? { backupFolder: folder } : {}) };
    mkdirSync(path.join(dataDir, dir), { recursive: true });
    save({ companies: [...registry.companies, company] });
    log.info?.(`Yeni şirket açıldı: ${safeCode} · ${safeName}`);
    return get(company.id);
  }
  function update(user, id, { name, code }) {
    const company = require(id);
    const next = { ...company };
    if (name !== undefined) next.name = nameInput(name);
    if (code !== undefined) next.code = codeInput(code, id);
    const entry = { id: next.id, code: next.code, name: next.name, dir: next.dir, createdAt: next.createdAt, createdBy: next.createdBy, updatedAt: now(), updatedBy: user?.id || "" };
    if (Array.isArray(company.oldBackupDirs) && company.oldBackupDirs.length) entry.oldBackupDirs = company.oldBackupDirs;
    // Yeni yedek klasörü adı başka şirketin klasörüyle ya da içinde yedek olan eski bir klasörle çakışırsa ek alır.
    const base = companyFolderName(entry);
    const current = backupFolderOf(company);
    const target = sameName(base, current) && !company.backupFolder ? base : sameName(base, current) ? current : freeBackupFolder(base, id);
    if (target !== base) entry.backupFolder = target;
    save({ companies: registry.companies.map(item => (item.id === id ? entry : item)) });
    // Ad ya da kod değişti (v2.0.20): yedek klasörü yeni adına taşınır, içindekiler korunur. Taşınamayan dosya kalırsa
    // (ör. klasör Windows Gezgini'nde açık) eski klasör kayda yazılır: yedekler listede görünmeye devam eder, taşıma
    // sonraki açılışta yeniden denenir.
    const from = path.join(backupDir, backupFolderOf(company));
    const to = path.join(backupDir, backupFolderOf(entry));
    if (from !== to) {
      let result;
      try {
        result = moveBackupFolder(from, to);
      } catch (error) {
        result = { left: 1 };
        log.warn?.(`Yedek klasörü yeniden adlandırılamadı (${from} → ${to}): ${error.message}`);
      }
      if (result.left) {
        settleOldBackupDirs(id, [...(entry.oldBackupDirs || []), path.basename(from)]);
        log.warn?.(`Yedek klasöründen ${result.left} dosya eski yerinde kaldı (${from}); listede görünür, sonraki açılışta yeniden taşınır.`);
      } else log.info?.(`Yedek klasörü yeniden adlandırıldı: ${path.basename(from)} → ${path.basename(to)}`);
    }
    return get(id);
  }
  // Eski adlı yedek klasörleri (taşıması yarım kalanlar) kayda yazılır; taşıma tamamlanınca kayıttan düşülür.
  // (save her alanı korur: backupFolder dahil.)
  function settleOldBackupDirs(id, remaining) {
    const clean = [...new Set((remaining || []).map(folder => path.basename(String(folder || ""))).filter(folder => folder && folder !== "." && folder !== ".."))];
    save({
      companies: registry.companies.map(item => {
        if (item.id !== id) return item;
        const { oldBackupDirs, ...rest } = item;
        return clean.length ? { ...rest, oldBackupDirs: clean } : rest;
      }),
    });
  }
  // Silme: klasör silinmez, "silinen-sirketler/<kod>-<zaman>" altına taşınır (geri getirilebilir; önce yedek alınmıştır).
  // Yedek klasörüne (<backupDir>/<kod> - <ad>) dokunulmaz: şirketin bütün yedekleri orada kalır (v2.0.20).
  function remove(user, id) {
    const company = require(id);
    if (company.id === ROOT_COMPANY_ID) throw new HttpError(409, "001 kodlu ilk şirket silinemez; verisini sıfırlayabilirsiniz.");
    const from = path.join(dataDir, company.dir);
    const archive = path.join(dataDir, "silinen-sirketler");
    mkdirSync(archive, { recursive: true });
    const stamp = now().replace(/[:.]/g, "-");
    const to = path.join(archive, `${company.code}-${stamp}`);
    if (existsSync(from)) renameSync(from, to);
    save({ companies: registry.companies.filter(item => item.id !== id) });
    // O şirketi seçmiş kullanıcılar ilk şirkete döner.
    for (const row of hubStore.all("SELECT key FROM settings WHERE key LIKE 'company.user.%' AND value = ?", id)) hubStore.setSetting(row.key, ROOT_COMPANY_ID);
    log.info?.(`Şirket silindi: ${company.code} · ${company.name} (klasör: ${to})`);
    return { ...company, archivedTo: to };
  }

  // ---------- Kullanıcı seçimi ve yetkisi ----------
  const userKey = userId => `company.user.${userId}`;
  const accessKey = userId => `company.access.${userId}`;
  function accessOf(user) {
    if (!user) return [];
    if (user.role === "admin") return list().map(item => item.id);
    const raw = hubStore.setting(accessKey(user.id), "");
    let ids = [];
    try {
      ids = raw ? JSON.parse(raw) : [];
    } catch {
      ids = [];
    }
    const known = new Set(list().map(item => item.id));
    const allowed = ids.filter(id => known.has(id));
    return allowed.length ? allowed : [ROOT_COMPANY_ID];
  }
  const canAccess = (user, id) => accessOf(user).includes(id);
  function selectedFor(user) {
    if (!user) return ROOT_COMPANY_ID;
    const chosen = hubStore.setting(userKey(user.id), "");
    return chosen && get(chosen) && canAccess(user, chosen) ? chosen : accessOf(user)[0] || ROOT_COMPANY_ID;
  }
  function select(user, id) {
    require(id);
    if (!canAccess(user, id)) throw new HttpError(403, "Bu şirketi görme yetkiniz yok; yönetici yetki verebilir.");
    hubStore.setSetting(userKey(user.id), id, user.id);
    return get(id);
  }
  function setAccess(admin, userId, ids) {
    const known = new Set(list().map(item => item.id));
    const clean = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(id => known.has(id)))];
    hubStore.setSetting(accessKey(userId), JSON.stringify(clean), admin?.id || "");
    const chosen = hubStore.setting(userKey(userId), "");
    if (chosen && clean.length && !clean.includes(chosen)) hubStore.setSetting(userKey(userId), clean[0], admin?.id || "");
    return clean;
  }
  const listFor = user => {
    const current = selectedFor(user);
    return list()
      .filter(item => canAccess(user, item.id))
      .map(item => ({ id: item.id, code: item.code, name: item.name, label: item.label, root: item.root, current: item.id === current }));
  };

  for (const group of conflicts()) {
    log.warn?.(`DİKKAT: ${group.companies.map(item => item.label).join(" ve ")} şirketleri aynı veri klasörünü kullanıyor (${group.dataDir}); kayıtları ortak. Yönetim → Şirketler → Ayır ile ayırın.`);
  }

  return { file, list, get, require, byCode, nextCode, limit, dirsOf, create, update, settleOldBackupDirs, remove, accessOf, canAccess, selectedFor, select, setAccess, listFor, conflicts, conflictOf, sharesRoot, freeDataDir, setDataDir, ROOT_COMPANY_ID };
}

// Kullanıcı tablosunun şirket veri tabanına aynası (işlem geçmişi, Silinenler, "Kaydeden" gibi adlar için). Kimlik
// doğrulama ve yetki her zaman ortak katmandadır; bu kopya yalnız ad/rol gösterimi içindir.
export function mirrorUsers(hubStore, companyStore) {
  const columns = companyStore.all("PRAGMA table_info(users)").map(column => column.name);
  const hubColumns = new Set(hubStore.all("PRAGMA table_info(users)").map(column => column.name));
  const shared = columns.filter(name => hubColumns.has(name));
  const rows = hubStore.all(`SELECT ${shared.join(", ")} FROM users`);
  companyStore.tx(() => {
    companyStore.run("DELETE FROM users");
    for (const row of rows) companyStore.run(`INSERT INTO users (${shared.join(", ")}) VALUES (${shared.map(() => "?").join(", ")})`, ...shared.map(name => row[name]));
  });
  return rows.length;
}
export const usersFingerprint = store => {
  const row = store.get("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS at, COUNT(deleted_at) AS d FROM users");
  return `${row.n}/${row.at}/${row.d}`;
};
