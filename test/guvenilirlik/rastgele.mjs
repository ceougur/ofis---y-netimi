// Rastgele sıra testi (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 2) — durumlu, modele dayalı özellik testi.
//
// Programı GERÇEK HTTP API'sinden (arayüzün kullandığı uçlar), tohumlu ve tekrarlanabilir rastgele işlemlerle sürer:
// şirket aç (sıradaki kod / silinmiş ya da değişmiş şirketin eski kodu / dolu kod → 409 / geçersiz → 400; Türkçe, büyük-küçük
// harf farklı adlar), kod değiştir (ilk şirket dahil), ad değiştir, sil (yanlış onay → 400, 001 → 409), şirket seç, cari aç,
// cari hareketi (borç / alacak / tahsilat / ödeme; nakit eksiye düşecekse 409), Kasa (giriş/çıkış), yedek (tek / Tüm
// Şirketler), geri yükle (002+ hemen; 001 yeniden açılışta), yanlış şirkete geri yükleme (hedef farklı ya da dosya elle öbür
// şirketin klasörüne kopyalanmış → 409), şirket verisini sıfırla (hareketler / tümü), sunucuyu yeniden başlat; v2.1.0: banka hesabı
// aç (açılış bakiyesiyle), Banka Fişi (Diğer Gelir / Gider, Banka Masrafı BSMV Dahil / Yok), Ters Kaydet ve başka şirketin banka
// hesabına fiş denemesi (404; şirketler ayrı).
//
// Yanında programdan BAĞIMSIZ bir model tutar: her şirketin (iç kimliğiyle) carileri, bakiyeleri, nakit Kasa'sı ve alınan
// her yedeğin o anki kopyası. HER işlemden sonra değişmez kurallar denetlenir (ikinci bir yönetici hesabıyla — işlemi yapanın
// seçili şirketi bozulmasın):
//   1. Kayıt defterinde iki şirket aynı veri klasörünü göstermez (Windows gibi büyük/küçük harf ayrımsız); 001 dışı hiçbir
//      şirket kök klasörü göstermez; program çakışma bildirmez.
//   2. Her şirketin carileri (kimlik, ad, bakiye), nakit Kasa'sı ve banka hesapları (kimlik, bakiye) modelle BİRE BİR — bir şirkete girilen kayıt öbüründe
//      görünmez; silinen şirketin verisi aynı kodla açılan yeni şirkette görünmez.
//   3. Her yedek kendi şirketinin klasöründe, içindeki kimlik o şirket; Yedekler listesinde her şirketin altında yalnız onun
//      yedekleri; modelin bildiği ve diskte duran her yedek listede; iki şirket aynı yedek klasörünü kullanmaz; silinen
//      şirketin dolu klasörü yeni şirkete verilmez.
//   4. Geri yüklemeden sonra şirketin verisi yedek anındaki kopyayla bire bir, öbür şirketler değişmez (2. kural) ve çalışmaya
//      devam edilebilir.
//   5. Yanlış şirkete geri yükleme her zaman 409.
// Uyuşmazlıkta tohum ve işlem günlüğüyle hata fırlatır (aynı tohumla aynı sıra yeniden üretilir).
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BACKUP_NAME, readBackupIdentity } from "../../server/lib/backup.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { rng } from "../mutabakat/motor.mjs";
import { FIRST, LAST } from "./adlar.mjs";
import { unpackFixture } from "./fikstur.mjs";
import { accountsDigest, apiAccounts, dbFacts, sameFacts } from "./olgular.mjs";
import { CURRENT, bootVersion } from "./surumler.mjs";
import { companyDbFile } from "./uretici.mjs";

const ROOT_ID = "sirket-001";
// Şirket adları: Türkçe harfler, yalnız büyük/küçük harfi farklı adlar ("MAVİ GIDA" / "Mavi Gıda" / "mavi gıda"), Windows'ta
// klasör adına giremeyen karakterler, sonda nokta.
const COMPANY_NAMES = ["Mavi Gıda", "MAVİ GIDA", "mavi gıda", "İstanbul Ticaret A.Ş.", "istanbul ticaret a.ş.", "Şahin İnşaat", "ŞAHİN İNŞAAT", "Çağ/Öz: Ltd*", "Ağaoğlu Yapı?", "Işık Turizm", "ışık turizm", "Gayri Resmi", "Resmi Şirket", "Ünal & Öztürk Hukuk", "Doğu \"Batı\" Lojistik", "Nokta Ltd.", "Eğitim Kurumları <Merkez>", "Iğdır Tarım|Hayvancılık"];
const CHECKER = { username: "denetci", password: "Denetci-2026!" };
const cents = value => Math.round(Number(value || 0) * 100);
const tl = c => `${(c / 100).toFixed(2)}`;
// Günlükte şirket: kod + iç kimliğin sonu (kod/ad değişse de hangi şirket olduğu izlenir).
const tag = company => `${company.code}[${company.id === "sirket-001" ? "kök" : company.id.slice(-4)}]`;

export async function runRandom({ seed = 1, operations = 200, base = "bos", log = () => {}, maxCompanies = 6, verifyEvery = 1 } = {}) {
  const R = rng(seed);
  const started = performance.now();
  let fixture = null;
  let dirs;
  if (base === "bos") {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-rastgele-"));
    dirs = { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  } else if (existsSync(path.join(base, "manifest.json"))) {
    // tools/surum-verisi.mjs çıktısı (ör. büyük hacimli gerçek sürüm verisi): kopyası üzerinde çalışılır, asıl klasöre dokunulmaz.
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-rastgele-taban-"));
    cpSync(path.join(base, "data"), path.join(root, "data"), { recursive: true });
    cpSync(path.join(base, "backups"), path.join(root, "backups"), { recursive: true });
    dirs = { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    fixture = { fixture: JSON.parse(readFileSync(path.join(base, "manifest.json"), "utf8")), cleanup: () => rmSync(root, { recursive: true, force: true }) };
  } else {
    fixture = unpackFixture(base);
    dirs = fixture;
  }
  const opLog = [];
  const report = { seed, base, operations: 0, byKind: {}, checks: 0, restarts: 0, restores: 0, wrongRestores: 0, backups: 0, limitRefusals: 0, ms: 0 };
  const count = kind => (report.byKind[kind] = (report.byKind[kind] || 0) + 1);
  let server;
  let actor;
  let checker;
  const boot = async () => {
    // Program en fazla 2 şirkete izin verir (05.10.2026); bu test sınırdan önce çok şirket açmış kurulumu canlandırır.
    server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, maxCompanies });
    actor = await server.login();
    checker = await server.login(CHECKER.username, CHECKER.password).catch(() => null);
  };
  const fail = message => {
    const error = new Error(`Rastgele sıra testi başarısız (tohum ${seed}, taban ${base}, işlem ${report.operations}): ${message}\nSon işlemler:\n${opLog.slice(-40).join("\n")}`);
    error.opLog = opLog;
    throw error;
  };
  const expectStatus = (response, want, what) => {
    const wants = Array.isArray(want) ? want : [want];
    if (!wants.includes(response.status)) fail(`${what}: beklenen ${wants.join("/")} ama ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
    return response.data;
  };

  // ---------- Model ----------
  // companies: kimlik → { id, code, name, accounts: Map(kimlik → { name, cents }), cash, banks: Map(kimlik → { name, cents }),
  //   vouchers: [{ id, bankId, cents, status }] } (v2.1.0: banka hesapları ve Banka Fişleri)
  const M = { companies: new Map(), deleted: [], freedCodes: new Set(), backups: new Map(), actorSelected: ROOT_ID };
  const copyMap = map => new Map([...map].map(([id, item]) => [id, { ...item }]));
  const snapshotOf = company => ({ accounts: copyMap(company.accounts), cash: company.cash, banks: copyMap(company.banks), vouchers: company.vouchers.map(item => ({ ...item })) });
  const live = () => [...M.companies.values()];
  const nonRoot = () => live().filter(item => item.id !== ROOT_ID);
  const registryFile = () => JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
  const folderOf = id => server.app.backups.folderOf(server.app.companies.get(id));
  const backupKey = (companyId, name) => `${companyId}/${name}`;
  const remember = (company, name, kind, snapshot = snapshotOf(company)) => {
    if (name) M.backups.set(backupKey(company.id, name), { companyId: company.id, name, kind, snapshot });
  };
  const codeTaken = code => live().some(item => item.code === code);

  const observe = async (client, id) => {
    expectStatus(await client.post("/api/companies/select", { id }), 200, `denetçi şirket seçimi ${id}`);
    const accounts = await apiAccounts(client);
    const cash = await client.get("/api/workspace/cash");
    expectStatus(cash, 200, "Kasa");
    const bank = await client.get("/api/workspace/bank/accounts?status=all");
    expectStatus(bank, 200, "Banka hesapları");
    return {
      accounts: new Map(accounts.map(item => [item.id, { name: item.name, cents: cents(item.balance) }])),
      cash: cents(cash.data.totals.balance),
      banks: new Map(bank.data.accounts.map(item => [item.id, { name: item.label, cents: Number(item.balanceMinor), confirmed: Boolean(item.balanceConfirmed) }])),
    };
  };

  await boot();
  // Denetçi: ikinci yönetici (seçimi ayrı tutulur).
  if (!checker) {
    expectStatus(await actor.post("/api/admin/users", { username: CHECKER.username, name: "Denetçi", role: "admin", password: CHECKER.password, mustChangePassword: false }), 200, "denetçi hesabı");
    checker = await server.login(CHECKER.username, CHECKER.password);
  }
  // Başlangıç durumu (boş kurulum ya da eski sürüm verisi): modele gözlemlenen hâl yazılır; yedekler sahipleriyle.
  const preexisting = new Map(); // ad → şirket kimliği (eski sürümden gelen ve açılışta taşınan yedekler)
  {
    const listed = (await actor.get("/api/companies")).data;
    if ((listed.conflicts || []).length) fail(`başlangıçta veri dosyası çakışması: ${JSON.stringify(listed.conflicts)}`);
    for (const company of listed.all) {
      const seen = await observe(checker, company.id);
      M.companies.set(company.id, { id: company.id, code: company.code, name: company.name, ...seen, vouchers: [] });
    }
    for (const item of (await checker.get("/api/admin/backups")).data) preexisting.set(item.name, item.companyId);
    // Eski sürümün aldığı yedekler: geri yükleme sonrası beklenen hâl manifestte (ekrandaki cari özeti).
    for (const record of fixture?.fixture.backups || []) {
      if (M.companies.has(record.companyId) && preexisting.get(record.file) === record.companyId) M.backups.set(backupKey(record.companyId, record.file), { companyId: record.companyId, name: record.file, kind: "eski-surum", digest: record.api?.accounts || null, facts: record.facts });
    }
  }

  // ---------- Değişmez kurallar ----------
  async function verify(label) {
    report.checks += 1;
    // 1. Veri klasörleri
    const registry = registryFile();
    const rootKey = path.resolve(dirs.dataDir).toUpperCase();
    const keys = new Map();
    for (const item of registry) {
      const dir = item.id === ROOT_ID || !item.dir ? dirs.dataDir : path.join(dirs.dataDir, item.dir);
      const key = path.resolve(dir).toUpperCase();
      if (item.id !== ROOT_ID && key === rootKey) fail(`${label}: ${item.code} kök veri klasörünü gösteriyor`);
      if (keys.has(key)) fail(`${label}: ${keys.get(key)} ile ${item.code} aynı veri klasöründe (${dir})`);
      keys.set(key, item.code);
    }
    const ids = registry.map(item => `${item.id}|${item.code}|${item.name}`).sort();
    const modelIds = live().map(item => `${item.id}|${item.code}|${item.name}`).sort();
    if (JSON.stringify(ids) !== JSON.stringify(modelIds)) fail(`${label}: şirket listesi modelden farklı\n  kayıt: ${ids.join(", ")}\n  model: ${modelIds.join(", ")}`);
    const conflicts = (await checker.get("/api/companies")).data.conflicts || [];
    if (conflicts.length) fail(`${label}: çakışma bildirildi ${JSON.stringify(conflicts)}`);
    // 2. Her şirketin verisi
    for (const company of live()) {
      const seen = await observe(checker, company.id);
      const want = [...company.accounts].map(([id, item]) => `${id}|${item.name}|${item.cents}`).sort();
      const got = [...seen.accounts].map(([id, item]) => `${id}|${item.name}|${item.cents}`).sort();
      if (JSON.stringify(want) !== JSON.stringify(got)) {
        const extra = got.filter(line => !want.includes(line)).slice(0, 5);
        const missing = want.filter(line => !got.includes(line)).slice(0, 5);
        fail(`${label}: ${company.code} · ${company.name} carileri modelden farklı (model ${want.length}, ekranda ${got.length})\n  fazla: ${extra.join("; ")}\n  eksik: ${missing.join("; ")}`);
      }
      if (seen.cash !== company.cash) fail(`${label}: ${company.code} · ${company.name} nakit Kasa ${tl(seen.cash)} ≠ model ${tl(company.cash)}`);
      const wantBanks = [...company.banks].map(([id, item]) => `${id}|${item.cents}`).sort();
      const gotBanks = [...seen.banks].map(([id, item]) => `${id}|${item.cents}`).sort();
      if (JSON.stringify(wantBanks) !== JSON.stringify(gotBanks)) fail(`${label}: ${company.code} · ${company.name} banka hesapları modelden farklı\n  model: ${wantBanks.join("; ")}\n  ekranda: ${gotBanks.join("; ")}`);
    }
    // 3. Yedekler
    const folders = new Map();
    for (const company of live()) {
      const folder = folderOf(company.id);
      const key = path.resolve(folder).toUpperCase();
      if (folders.has(key)) fail(`${label}: ${folders.get(key)} ile ${company.code} aynı yedek klasörünü kullanıyor (${folder})`);
      folders.set(key, company.code);
      for (const gone of M.deleted) if (path.resolve(gone.folder) === path.resolve(folder)) fail(`${label}: silinen ${gone.code} · ${gone.name} şirketinin yedek klasörü ${company.code} şirketine verildi`);
    }
    const listing = (await checker.get("/api/admin/backups")).data;
    const listed = new Set();
    for (const item of listing) {
      const company = M.companies.get(item.companyId);
      if (!company) fail(`${label}: listede bilinmeyen şirketin yedeği ${item.company} ${item.name}`);
      const file = path.join(item.folder, item.name);
      if (!existsSync(file)) fail(`${label}: listedeki yedek diskte yok ${file}`);
      const known = M.backups.get(backupKey(item.companyId, item.name));
      const old = preexisting.get(item.name);
      if (!known && old !== item.companyId) fail(`${label}: ${company.code} listesinde modelin bilmediği yedek ${item.name} (klasör ${item.folder})`);
      if (!old && path.resolve(item.folder) !== path.resolve(folderOf(company.id))) fail(`${label}: ${company.code} yedeği kendi klasöründe değil: ${item.folder} ≠ ${folderOf(company.id)}`);
      const identity = readBackupIdentity(file);
      if (identity && identity.id !== item.companyId) fail(`${label}: ${company.code} altında listelenen ${item.name} içindeki kimlik ${identity.code} · ${identity.name}`);
      if (!identity && !old) fail(`${label}: yeni yedek kimliksiz ${item.name}`);
      listed.add(backupKey(item.companyId, item.name));
    }
    for (const company of live()) {
      const folder = folderOf(company.id);
      for (const name of existsSync(folder) ? readdirSync(folder).filter(entry => BACKUP_NAME.test(entry)) : []) {
        const identity = readBackupIdentity(path.join(folder, name));
        if (identity && identity.id !== company.id) fail(`${label}: ${company.code} klasöründe başka şirketin yedeği ${name} (${identity.code} · ${identity.name})`);
        if (!listed.has(backupKey(company.id, name)) && !preexisting.has(name)) fail(`${label}: ${company.code} klasöründeki ${name} listede yok`);
      }
    }
    for (const [key, record] of M.backups) {
      if (!M.companies.has(record.companyId) || listed.has(key)) continue;
      // Listede yoksa budanmış olmalı (diskte de yok).
      if (existsSync(path.join(folderOf(record.companyId), record.name))) fail(`${label}: ${record.name} diskte duruyor ama listede yok`);
      M.backups.delete(key);
    }
  }

  // ---------- İşlemler ----------
  const name = () => `${R.pick(FIRST)} ${R.pick(LAST)}`;
  const companyName = () => R.pick(COMPANY_NAMES);
  const pickCompany = list => (list.length ? list[R.int(0, list.length - 1)] : null);
  const randomCode = () => String(R.int(2, 60)).padStart(3, "0");
  const selected = () => M.companies.get(M.actorSelected) || M.companies.get(ROOT_ID);
  const amountCents = () => R.int(1, 500_000);

  const ops = {
    async create() {
      const roll = R.next();
      const freed = [...M.freedCodes].filter(code => !codeTaken(code));
      let code = roll < 0.35 ? "" : roll < 0.7 && freed.length ? R.pick(freed) : roll < 0.8 ? R.pick(live()).code : roll < 0.85 ? R.pick(["12", "abc", "1000", ""]) || "x" : randomCode();
      const invalid = code !== "" && !/^\d{3}$/.test(code);
      // Şirket sınırı (2.0.25): sınırdayken her açma denemesi (geçerli, geçersiz ya da dolu kodla) 409 company-limit alır;
      // sınır denetimi kod denetiminden önce gelir. Yarısında sınır denenir, yarısında bir şirket silinir.
      if (live().length >= maxCompanies) {
        if (R.chance(0.5)) return ops.remove();
        opLog.push(`#${report.operations} sınırda şirket aç: kod "${code || "(sıradaki)"}" → 409 beklenir`);
        const refused = await actor.post("/api/companies", { code, name: companyName() });
        expectStatus(refused, 409, `sınırda (${live().length}/${maxCompanies}) şirket aç`);
        if (refused.data?.code !== "company-limit") fail(`sınır yanıtının kodu company-limit değil: ${JSON.stringify(refused.data).slice(0, 200)}`);
        report.limitRefusals += 1;
        return;
      }
      const label = companyName();
      opLog.push(`#${report.operations} şirket aç: kod "${code || "(sıradaki)"}" ad "${label}"`);
      const response = await actor.post("/api/companies", { code, name: label });
      if (invalid) return expectStatus(response, 400, "geçersiz kodla şirket");
      if (code && codeTaken(code)) return expectStatus(response, 409, `dolu kodla (${code}) şirket`);
      const data = expectStatus(response, 200, "şirket aç");
      if (code && data.company.code !== code) fail(`istenen kod ${code}, açılan ${data.company.code}`);
      M.companies.set(data.company.id, { id: data.company.id, code: data.company.code, name: data.company.name, accounts: new Map(), cash: 0, banks: new Map(), vouchers: [] });
      M.freedCodes.delete(data.company.code);
      opLog[opLog.length - 1] += ` → ${tag(data.company)}`;
    },
    async recode() {
      const company = R.chance(0.08) ? M.companies.get(ROOT_ID) : pickCompany(nonRoot());
      if (!company) return ops.create();
      const freed = [...M.freedCodes].filter(code => !codeTaken(code));
      const roll = R.next();
      const code = roll < 0.4 && freed.length ? R.pick(freed) : roll < 0.55 ? R.pick(live()).code : roll < 0.6 ? "7a7" : randomCode();
      opLog.push(`#${report.operations} kod değiştir: ${tag(company)} · ${company.name} → ${code}`);
      const response = await actor.put(`/api/companies/${company.id}`, { code });
      if (!/^\d{3}$/.test(code)) return expectStatus(response, 400, "geçersiz kod");
      if (codeTaken(code) && code !== company.code) return expectStatus(response, 409, `dolu kod ${code}`);
      expectStatus(response, 200, "kod değiştir");
      if (code !== company.code) M.freedCodes.add(company.code);
      M.freedCodes.delete(code);
      company.code = code;
    },
    async rename() {
      const company = pickCompany(live());
      const next = R.chance(0.08) ? "   " : companyName();
      opLog.push(`#${report.operations} ad değiştir: ${tag(company)} · ${company.name} → "${next}"`);
      const response = await actor.put(`/api/companies/${company.id}`, { name: next });
      if (!next.trim()) return expectStatus(response, 400, "boş ad");
      company.name = expectStatus(response, 200, "ad değiştir").company.name;
    },
    async remove() {
      if (R.chance(0.1)) {
        opLog.push(`#${report.operations} 001'i sil (reddedilmeli)`);
        return expectStatus(await actor.del(`/api/companies/${ROOT_ID}`, { confirm: "001", password: ADMIN_PASSWORD }), 409, "001 silme");
      }
      const company = pickCompany(nonRoot());
      if (!company) return ops.create();
      const wrong = R.chance(0.15);
      opLog.push(`#${report.operations} sil: ${tag(company)} · ${company.name}${wrong ? " (yanlış onay)" : ""}`);
      const folder = folderOf(company.id);
      const response = await actor.del(`/api/companies/${company.id}`, { confirm: wrong ? "999" : company.code, password: ADMIN_PASSWORD });
      if (wrong) return expectStatus(response, 400, "yanlış onayla silme");
      const data = expectStatus(response, 200, "sil");
      if (!data.backup) fail("silme öncesi yedek alınmadı");
      const file = path.join(folder, data.backup);
      if (readBackupIdentity(file)?.id !== company.id) fail(`silme öncesi yedeğin kimliği yanlış: ${file}`);
      M.companies.delete(company.id);
      M.deleted.push({ id: company.id, code: company.code, name: company.name, folder });
      M.freedCodes.add(company.code);
      for (const key of [...M.backups.keys()]) if (key.startsWith(`${company.id}/`)) M.backups.delete(key);
      if (M.actorSelected === company.id) M.actorSelected = ROOT_ID;
    },
    async select() {
      const company = pickCompany(live());
      opLog.push(`#${report.operations} seç: ${tag(company)} · ${company.name}`);
      expectStatus(await actor.post("/api/companies/select", { id: company.id }), 200, "seç");
      M.actorSelected = company.id;
    },
    async account() {
      const company = selected();
      const label = name();
      opLog.push(`#${report.operations} cari aç (${tag(company)}): ${label}`);
      const data = expectStatus(await actor.post("/api/workspace/accounts", { name: label, type: "customer" }), 200, "cari aç");
      company.accounts.set(data.id, { name: data.name, cents: 0 });
    },
    async entry() {
      const company = selected();
      if (!company.accounts.size) return ops.account();
      const [id, account] = R.pick([...company.accounts]);
      const kind = R.pick(["debt", "debt", "credit", "in", "in", "out"]);
      const value = amountCents();
      opLog.push(`#${report.operations} cari hareketi (${tag(company)}): ${account.name} ${kind} ${tl(value)}`);
      const response = await actor.post(`/api/workspace/accounts/${id}/entries`, { kind, amount: value / 100, method: "cash", note: "Rastgele" });
      if (kind === "out" && company.cash - value < 0) {
        expectStatus(response, 409, "nakdi eksiye düşüren ödeme");
        if (response.data.code !== "cash-negative") fail(`eksiye düşüren ödemede kod ${response.data.code}`);
        return;
      }
      expectStatus(response, 200, "cari hareketi");
      account.cents += kind === "debt" || kind === "out" ? value : -value;
      if (kind === "in") company.cash += value;
      if (kind === "out") company.cash -= value;
    },
    async cash() {
      const company = selected();
      const kind = R.chance(0.6) ? "in" : "out";
      const value = amountCents();
      opLog.push(`#${report.operations} Kasa (${tag(company)}): ${kind} ${tl(value)}`);
      const response = await actor.post("/api/workspace/cash", { kind, amount: value / 100, description: kind === "in" ? "Elden tahsilat" : "Ofis gideri" });
      if (kind === "out" && company.cash - value < 0) return expectStatus(response, 409, "nakdi eksiye düşüren Kasa çıkışı");
      expectStatus(response, 200, "Kasa");
      company.cash += kind === "in" ? value : -value;
    },
    async backupOne() {
      const company = pickCompany(live());
      opLog.push(`#${report.operations} yedek (yalnız ${tag(company)} · ${company.name})`);
      const data = expectStatus(await actor.post("/api/admin/backups", { scope: "one", companyId: company.id }), 200, "yedek");
      const [item] = data.backups;
      if (item.companyId !== company.id || path.resolve(item.folder) !== path.resolve(folderOf(company.id))) fail(`yedek yanlış yere: ${JSON.stringify(item)}`);
      checkBackupContent(company, path.join(item.folder, item.name));
      remember(company, item.name, "manuel");
      report.backups += 1;
    },
    async backupAll() {
      opLog.push(`#${report.operations} yedek (Tüm Şirketler)`);
      const data = expectStatus(await actor.post("/api/admin/backups", { scope: "all" }), 200, "Tüm Şirketler yedeği");
      if (data.backups.length !== live().length || data.failed.length) fail(`Tüm Şirketler: ${data.backups.length} yedek, ${live().length} şirket, hata ${JSON.stringify(data.failed)}`);
      for (const item of data.backups) {
        const company = M.companies.get(item.companyId);
        if (path.resolve(item.folder) !== path.resolve(folderOf(company.id))) fail(`${company.code} yedeği yanlış klasörde: ${item.folder}`);
        checkBackupContent(company, path.join(item.folder, item.name));
        remember(company, item.name, "manuel");
      }
      report.backups += data.backups.length;
    },
    async restore() {
      const records = [...M.backups.values()].filter(item => item.companyId !== ROOT_ID && M.companies.has(item.companyId));
      if (!records.length) return ops.backupOne();
      const record = R.pick(records);
      const company = M.companies.get(record.companyId);
      const before = snapshotOf(company);
      opLog.push(`#${report.operations} geri yükle: ${tag(company)} · ${company.name} ← ${record.name} (${record.kind})`);
      const data = expectStatus(await actor.post("/api/admin/backups/restore", { name: record.name, company: company.id, confirm: R.chance(0.5) ? company.code : company.name, password: ADMIN_PASSWORD }), 200, "geri yükle");
      if (!data.restored) fail(`002+ geri yüklemesi hemen uygulanmadı: ${JSON.stringify(data)}`);
      remember(company, data.safety, "geri-yukleme-oncesi", before);
      await applyRestored(company, record);
      report.restores += 1;
    },
    async restoreRoot() {
      const records = [...M.backups.values()].filter(item => item.companyId === ROOT_ID);
      if (!records.length) return ops.backupOne();
      const record = R.pick(records);
      const company = M.companies.get(ROOT_ID);
      const before = snapshotOf(company);
      opLog.push(`#${report.operations} 001 geri yükle (yeniden açılışta) ← ${record.name} (${record.kind})`);
      const data = expectStatus(await actor.post("/api/admin/backups/restore", { name: record.name, company: ROOT_ID, confirm: company.code, password: ADMIN_PASSWORD }), 200, "001 geri yükle");
      if (!data.staged) fail(`001 geri yüklemesi hazırlanmadı: ${JSON.stringify(data)}`);
      await restart();
      const result = server.app.stagedRestore;
      if (!result?.ok) fail(`001 geri yüklemesi açılışta uygulanmadı: ${JSON.stringify(result)}`);
      remember(company, result.safety, "geri-yukleme-oncesi", before);
      await applyRestored(company, record);
      report.restores += 1;
    },
    async wrongRestore() {
      const records = [...M.backups.values()].filter(item => M.companies.has(item.companyId));
      const record = records.length ? R.pick(records) : null;
      const others = record ? live().filter(item => item.id !== record.companyId) : [];
      if (!record || !others.length) return ops.backupOne();
      const source = M.companies.get(record.companyId);
      const target = R.pick(others);
      const copy = R.chance(0.4);
      opLog.push(`#${report.operations} YANLIŞ geri yükleme: ${tag(source)} yedeği ${record.name} → ${tag(target)}${copy ? " (dosya elle hedefin klasörüne kopyalandı)" : ""}`);
      let response;
      if (copy) {
        const folder = folderOf(target.id);
        mkdirSync(folder, { recursive: true });
        const from = (await checker.get("/api/admin/backups")).data.find(item => item.companyId === source.id && item.name === record.name);
        if (!from) fail(`kopyalanacak yedek listede yok: ${record.name}`);
        const placed = path.join(folder, record.name);
        const existed = existsSync(placed);
        if (!existed) copyFileSync(path.join(from.folder, from.name), placed);
        response = await actor.post("/api/admin/backups/restore", { name: record.name, company: target.id, confirm: target.code, password: ADMIN_PASSWORD });
        if (!existed) rmSync(placed, { force: true });
        // Kimliksiz eski yedek başka şirketin klasörüne elle konursa programın sahibini bilmesi beklenemez: o durumda
        // veri tabanı soyu (meta.instanceId) farklı olduğu için yine 409 olmalı.
      } else response = await actor.post("/api/admin/backups/restore", { name: record.name, company: source.id, target: target.id, confirm: target.code, password: ADMIN_PASSWORD });
      expectStatus(response, 409, "yanlış şirkete geri yükleme");
      report.wrongRestores += 1;
    },
    async reset() {
      const company = pickCompany(live());
      const mode = R.chance(0.6) ? "movements" : "all";
      const before = snapshotOf(company);
      opLog.push(`#${report.operations} sıfırla (${mode}): ${tag(company)} · ${company.name}`);
      const data = expectStatus(await actor.post(`/api/companies/${company.id}/reset`, { mode, confirm: company.code, password: ADMIN_PASSWORD }), 200, "sıfırla");
      const file = path.join(folderOf(company.id), data.backup);
      if (readBackupIdentity(file)?.id !== company.id) fail(`sıfırlama öncesi yedek kendi klasöründe/kimliğinde değil: ${file}`);
      remember(company, data.backup, "sifirlama-oncesi", before);
      if (mode === "all") company.accounts.clear();
      else for (const account of company.accounts.values()) account.cents = 0;
      company.cash = 0;
      // v2.1.0 (§5.6): "Tüm Hareketleri Sil" hesap kartlarını bırakır (açılış dahil hareketler silinir, bakiye 0); "Tümünü Sıfırla" siler.
      if (mode === "all") company.banks.clear();
      // "Tüm Hareketleri Sil" Bakiye Doğrulandı işaretini de kaldırır (açılış silindi; K7 Kontrol Yok'a döner).
      else for (const bank of company.banks.values()) Object.assign(bank, { cents: 0, confirmed: false });
      company.vouchers = [];
    },
    // ---------- v2.1.0 banka ----------
    async bankAccount() {
      const company = selected();
      const opening = R.int(0, 2_000_000);
      const today = expectStatus(await actor.get("/api/workspace/ledger/lock"), 200, "bugün").today;
      const bankName = R.pick(["Ziraat Bankası", "Garanti BBVA", "İş Bankası", "Yapı Kredi"]);
      opLog.push(`#${report.operations} banka hesabı aç (${tag(company)}): ${bankName} açılış ${tl(opening)}`);
      const data = expectStatus(await actor.post("/api/workspace/bank/accounts", { bankName, name: `Hesap ${report.operations}`, kind: "demand", currency: "TRY", opening: { date: today, amount: tl(opening).replace(".", ","), confirmed: true } }), 200, "banka hesabı aç");
      company.banks.set(data.id, { name: data.label, cents: opening, confirmed: true });
    },
    async bankVoucher() {
      const company = selected();
      if (!company.banks.size) return ops.bankAccount();
      const [bankId, bank] = R.pick([...company.banks]);
      const type = R.pick(["other_in", "other_out", "fee"]);
      const value = amountCents();
      const tax = type === "fee" ? R.pick(["none", "bsmv_incl"]) : "";
      const today = expectStatus(await actor.get("/api/workspace/ledger/lock"), 200, "bugün").today;
      opLog.push(`#${report.operations} Banka Fişi (${tag(company)}): ${bank.name} ${type}${tax ? ` ${tax}` : ""} ${tl(value)}`);
      const signed = type === "other_in" ? value : -value;
      const body = { type, accountId: bankId, date: today, amount: tl(value).replace(".", ","), ...(tax ? { tax } : {}), similarOk: true };
      // K7 (2.1.0 GG2): Bakiye Doğrulandı hesapta (açılış "confirmed") bakiyeyi eksiye düşüren çıkış önce 409 bank-negative ("Uyar"),
      // sonra "Yine de Kaydet" (negativeOk) ile tek fiş.
      if (bank.confirmed && bank.cents + signed < 0) {
        const warned = await actor.post("/api/workspace/bank/vouchers", body);
        expectStatus(warned, 409, "Banka Fişi eksi bakiye");
        if (warned.data?.code !== "bank-negative") fail(`Banka Fişi eksi bakiye: kod ${warned.data?.code}`);
        body.negativeOk = true;
      }
      const data = expectStatus(await actor.post("/api/workspace/bank/vouchers", body), 200, "Banka Fişi");
      const got = (data.lines || []).filter(line => line.role === "bank").reduce((sum, line) => sum + (line.side === "D" ? 1 : -1) * Number(line.tryMinor), 0);
      if (got !== signed) fail(`Banka Fişi ${data.no}: banka etkisi ${tl(got)} ≠ model ${tl(signed)}`);
      bank.cents += signed;
      company.vouchers.push({ id: data.id, bankId, cents: signed, status: "active" });
    },
    async bankReverse() {
      const company = selected();
      const voucher = R.pick(company.vouchers.filter(item => item.status === "active" && company.banks.has(item.bankId)));
      if (!voucher) return ops.bankVoucher();
      opLog.push(`#${report.operations} Ters Kaydet (${tag(company)}): ${voucher.id}`);
      const bank = company.banks.get(voucher.bankId);
      const body = {};
      if (bank.confirmed && bank.cents - voucher.cents < 0) {
        // K7: gelir fişinin ters kaydı da hesabı eksiye düşürebilir.
        const warned = await actor.post(`/api/workspace/bank/events/${encodeURIComponent(voucher.id)}/reverse`, {});
        expectStatus(warned, 409, "Ters Kaydet eksi bakiye");
        if (warned.data?.code !== "bank-negative") fail(`Ters Kaydet eksi bakiye: kod ${warned.data?.code}`);
        body.negativeOk = true;
      }
      expectStatus(await actor.post(`/api/workspace/bank/events/${encodeURIComponent(voucher.id)}/reverse`, body), 200, "Ters Kaydet");
      voucher.status = "reversed";
      company.banks.get(voucher.bankId).cents -= voucher.cents;
    },
    // 2.1.0 Aşama 5–8: modül formundan havale (cari tahsilat/ödeme) seçilen banka hesabına bağlanır; tek hesapta seçimsiz de o hesaba, birden
    // çokta seçimsiz 400 bank-account-required; başka şirketin hesabı 404; Bakiye Doğrulandı hesabı eksiye düşüren ödeme 409 bank-negative →
    // "Yine de Kaydet". Değişmez: hesap bakiyesi = model (açılış + fiş + bağlı modül havaleleri); şirketler ayrı.
    async bankModule() {
      const company = selected();
      if (!company.banks.size) return ops.bankAccount();
      if (!company.accounts.size) return ops.account();
      const [id, account] = R.pick([...company.accounts]);
      const [bankId, bank] = R.pick([...company.banks]);
      const kind = R.pick(["in", "in", "out"]);
      const value = amountCents();
      const today = expectStatus(await actor.get("/api/workspace/ledger/lock"), 200, "bugün").today;
      const url = `/api/workspace/accounts/${id}/entries`;
      const body = { kind, amount: value / 100, method: "bank", date: today, note: "Rastgele havale", similarOk: true };
      if (company.banks.size > 1 && R.chance(0.15)) {
        opLog.push(`#${report.operations} HESAPSIZ havale (${tag(company)}): ${account.name} ${kind} ${tl(value)}`);
        const response = await actor.post(url, body);
        expectStatus(response, 400, "çok hesapta hesapsız havale");
        if (response.data?.code !== "bank-account-required") fail(`hesapsız havalede kod ${response.data?.code}`);
        return;
      }
      const other = R.chance(0.1) ? R.pick(live().filter(item => item.id !== company.id && item.banks.size)) : null;
      if (other) {
        opLog.push(`#${report.operations} YANLIŞ şirket hesabına havale: seçili ${tag(company)}, hesap ${tag(other)}`);
        expectStatus(await actor.post(url, { ...body, bankAccountId: R.pick([...other.banks])[0] }), 404, "başka şirketin banka hesabına havale");
        return;
      }
      const auto = company.banks.size === 1 && R.chance(0.4);
      if (!auto) body.bankAccountId = bankId;
      opLog.push(`#${report.operations} havale (${tag(company)}): ${account.name} ${kind} ${tl(value)} → ${bank.name}${auto ? " (tek hesap, seçimsiz)" : ""}`);
      const signed = kind === "in" ? value : -value;
      if (bank.confirmed && bank.cents + signed < 0) {
        const warned = await actor.post(url, body);
        expectStatus(warned, 409, "havale eksi bakiye");
        if (warned.data?.code !== "bank-negative") fail(`havale eksi bakiye: kod ${warned.data?.code}`);
        body.negativeOk = true;
      }
      expectStatus(await actor.post(url, body), 200, "havale");
      bank.cents += signed;
      account.cents += kind === "out" ? value : -value;
    },
    async bankWrongCompany() {
      // Başka şirketin banka hesabına (seçili şirket bu değilken) fiş: 404, hiçbir şirkette iz yok.
      const company = selected();
      const other = R.pick(live().filter(item => item.id !== company.id && item.banks.size));
      if (!other) return ops.bankAccount();
      const [bankId] = R.pick([...other.banks]);
      const today = expectStatus(await actor.get("/api/workspace/ledger/lock"), 200, "bugün").today;
      opLog.push(`#${report.operations} YANLIŞ şirket Banka Fişi: seçili ${tag(company)}, hesap ${tag(other)}`);
      const response = await actor.post("/api/workspace/bank/vouchers", { type: "other_in", accountId: bankId, date: today, amount: "100,00", similarOk: true });
      expectStatus(response, 404, "başka şirketin banka hesabına fiş");
    },
    async restart() {
      opLog.push(`#${report.operations} sunucuyu yeniden başlat`);
      await restart();
    },
  };
  // Yedek dosyasının içeriği o anki modelle aynı mı (yedek kendi şirketinin verisini taşır)?
  function checkBackupContent(company, file) {
    const identity = readBackupIdentity(file);
    if (identity?.id !== company.id) fail(`${company.code} yedeğinin kimliği ${JSON.stringify(identity)}`);
    const facts = dbFacts(file);
    if (facts.accounts !== company.accounts.size) fail(`${company.code} yedeğinde ${facts.accounts} cari, modelde ${company.accounts.size}`);
  }
  async function applyRestored(company, record) {
    if (record.snapshot) {
      company.accounts = copyMap(record.snapshot.accounts);
      company.cash = record.snapshot.cash;
      company.banks = copyMap(record.snapshot.banks || new Map());
      company.vouchers = (record.snapshot.vouchers || []).map(item => ({ ...item }));
      return;
    }
    // Eski sürümün yedeği: manifestteki ekran özeti ve veri tabanı olguları tutmalı; sonra model gözlemden kurulur.
    const seen = await observe(checker, company.id);
    const digest = accountsDigest([...seen.accounts].map(([id, item]) => ({ id, name: item.name, balance: item.cents / 100 })));
    if (record.digest && JSON.stringify(digest) !== JSON.stringify(record.digest)) fail(`eski sürüm yedeği ${record.name} geri yüklendi ama cari listesi yedek anındaki gibi değil: ${JSON.stringify(digest)} ≠ ${JSON.stringify(record.digest)}`);
    const registry = registryFile();
    const facts = dbFacts(companyDbFile(dirs.dataDir, registry.find(item => item.id === company.id)));
    if (!sameFacts(facts, record.facts)) fail(`eski sürüm yedeği ${record.name}: veri tabanı olguları yedek anındaki gibi değil`);
    company.accounts = seen.accounts;
    company.cash = seen.cash;
    company.banks = seen.banks;
    company.vouchers = [];
  }
  async function restart() {
    await server.close();
    await boot();
    report.restarts += 1;
  }

  const WEIGHTS = [
    ["account", 14], ["entry", 18], ["cash", 7], ["select", 8], ["create", 7], ["rename", 5], ["recode", 5], ["remove", 4],
    ["backupOne", 7], ["backupAll", 3], ["restore", 7], ["restoreRoot", 2], ["wrongRestore", 4], ["reset", 3], ["restart", 2],
    ["bankAccount", 3], ["bankVoucher", 6], ["bankReverse", 2], ["bankWrongCompany", 2], ["bankModule", 6],
  ];
  const total = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  const choose = () => {
    let roll = R.next() * total;
    for (const [kind, weight] of WEIGHTS) if ((roll -= weight) < 0) return kind;
    return WEIGHTS[0][0];
  };
  try {
    await verify("başlangıç");
    for (let n = 1; n <= operations; n += 1) {
      report.operations = n;
      const kind = choose();
      count(kind);
      await ops[kind]();
      if (n % verifyEvery === 0 || n === operations) await verify(`#${n} ${kind}`);
      if (n % 100 === 0) log(`  ${n} işlem · ${live().length} şirket · ${report.backups} yedek · ${report.restores} geri yükleme · ${((performance.now() - started) / 1000).toFixed(1)} sn`);
    }
  } finally {
    await server.close().catch(() => {});
    if (fixture) fixture.cleanup();
    else rmSync(dirs.root, { recursive: true, force: true });
  }
  report.ms = performance.now() - started;
  report.companies = live().map(item => `${item.code} · ${item.name} (${item.accounts.size} cari)`);
  report.opLog = opLog;
  return report;
}
