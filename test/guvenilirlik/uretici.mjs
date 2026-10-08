// Sürüm verisi üreticisi (2.0.21 güvenilirlik). Verilen sürüm zincirini (ör. v2.0.16 → v2.0.17 → … → v2.0.20) AYNI veri ve
// yedek klasörlerinde sırayla çalıştırır; her sürümün KENDİ kodunu açar (surumler.mjs) ve kullanıcı gibi KENDİ HTTP API'sinden
// veri girer: şirket açar, adını/kodunu değiştirir, siler; Excel'den REHBER tablosu ve cari yükler; satış/gider faturası
// (açık, peşin, taksitli), tahsilat, borç, ödeme, Kasa ve taksit kartı girer; o sürümün yedek ucuyla yedek alır.
// Tarihler 15 aylık bir zaman çizelgesine yayılır (eski sürüm eski ayları girer). Rastgelelik tohumludur (tekrarlanabilir).
//
// Çıktı: manifest — her sürümün işlem kimliği, her şirketin son hâli (veri tabanı olguları + API'de görünen cari özeti) ve
// alınan HER yedeğin o anki olguları. Güncel sürüm bu manifestle karşılaştırılır (guvenilirlik-221-goc/tatbikat testleri).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { addDays, rng } from "../mutabakat/motor.mjs";
import { CITY, EXPENSE, FIRST, LAST, SERVICE, SUPPLIER } from "./adlar.mjs";
import { unpackFixture } from "./fikstur.mjs";
import { apiFacts, dbFacts, sha256File } from "./olgular.mjs";
import { bootProcess, bootVersion } from "./surumler.mjs";

// Hacim: "kucuk" depoya konan fikstürler için (birkaç MB); "buyuk" yerel/CLI koşusu için (gerçek müşteri tablosu ~9.200 satır).
export const VOLUMES = {
  kucuk: { rehber: { root: 240, other: 60 }, rehberStep: { root: 20, other: 6 }, caris: { root: 120, other: 40 }, cariStep: { root: 12, other: 5 }, suppliers: 4, invoices: 12, collections: 14, debts: 4, payments: 3, cash: 5, plans: 2, planPays: 2 },
  buyuk: { rehber: { root: 9200, other: 1500 }, rehberStep: { root: 150, other: 40 }, caris: { root: 2500, other: 600 }, cariStep: { root: 120, other: 40 }, suppliers: 10, invoices: 70, collections: 110, debts: 25, payments: 20, cash: 25, plans: 15, planPays: 3 },
};

// Zincirler. Şirketler mantıksal anahtarla (A = 001) izlenir; kod ve ad sürümler boyunca değişebilir.
export const CHAINS = {
  // Gerçek güncelleme yolu: 2.0.16 (tek şirket) → 2.0.17 (çoklu şirket) → 2.0.18 → 2.0.19 → 2.0.20.
  zincir: [
    { version: "v2.0.16", actions: [{ do: "office", name: "Merkez Danışmanlık Ltd. Şti." }, { do: "work" }, { do: "backup" }] },
    { version: "v2.0.17", actions: [{ do: "create", key: "B", code: "002", name: "Şahin İnşaat Ltd. Şti." }, { do: "create", key: "C", code: "003", name: "Mavi Gıda A.Ş." }, { do: "work" }, { do: "recode", key: "C", code: "007" }, { do: "backup" }] },
    { version: "v2.0.18", actions: [{ do: "create", key: "D", code: "004", name: "Çağdaş Eğitim Kurumları" }, { do: "work" }, { do: "backup" }] },
    { version: "v2.0.19", actions: [{ do: "rename", key: "B", name: "Şahin İnşaat ve Ticaret Ltd. Şti." }, { do: "work" }, { do: "backup" }] },
    { version: "v2.0.20", actions: [{ do: "work" }, { do: "backup" }, { do: "delete", key: "D" }, { do: "create", key: "E", code: "004", name: "Işık Turizm ve Seyahat" }, { do: "work", keys: ["E"] }, { do: "backup", keys: ["E"] }] },
    // v2.1.0 banka göçü (docs/BANKA-MODULU-PLAN.md §10.5): 2.0.21 → 2.0.26 aynı kurulumda sürer (4 şirket: 2.0.25'ten beri sınır 2,
    // eski kurulumdakiler kalır). Para işi 001 ve 002'de: her modülde havale/EFT ve POS/kredi kartı satırı, Kasa ↔ Banka,
    // silinip geri yüklenen tahsilat, iade ve iptal, yalnız Borç Yaz satırı olan cari; 2.0.21'de özel rol ve kişiye özel yetkili
    // kullanıcılar (yetki göçü K4), 2.0.24'te dönem kilidi, 2.0.25'te o sürümün kabul ettiği ileri tarihli çek.
    // Kaldığı yerden devam: node tools/surum-verisi.mjs --fikstur zincir --devam v2.0.20 (2.0.16–2.0.20 fikstürleri değişmez).
    { version: "v2.0.21", actions: [{ do: "people" }, { do: "finance", keys: ["A", "B"] }, { do: "backup", keys: ["A", "B"] }] },
    { version: "v2.0.22", actions: [{ do: "finance", keys: ["A", "B"] }] },
    { version: "v2.0.23", actions: [{ do: "finance", keys: ["A", "B"] }, { do: "backup", keys: ["A"] }] },
    { version: "v2.0.24", actions: [{ do: "finance", keys: ["A", "B"] }, { do: "lock", keys: ["A"], daysBefore: 1 }] },
    { version: "v2.0.25", actions: [{ do: "finance", keys: ["A", "B"] }, { do: "future", keys: ["A"] }, { do: "backup", keys: ["A", "B"] }] },
    { version: "v2.0.26", actions: [{ do: "finance", keys: ["A", "B"] }, { do: "backup", keys: ["A", "B"] }] },
  ],
  // 2.0.17–2.0.19 hatası, GERÇEK v2.0.19 koduyla: 002'nin kodu 005 yapılır, sonra 002 koduyla yeni şirket açılır — eski kod
  // yeni şirkete aynı veri klasörünü (sirketler/002) verir; iki şirketin carileri aynı veri tabanına yazılır.
  // Çok eski kurulum: v1.3.1 (tek dosyalık sunucu, veri dosyası "hukuk-ofisi.sqlite", yedek "hukuk-ofisi-<zaman>.sqlite",
  // kendi yedek aracıyla) → v2.0.16 (göçler) → v2.0.19 (çoklu şirket). Eski adlı dosya hiç yeniden adlandırılmaz.
  eski: [
    { version: "v1.3.1", actions: [{ do: "kayit1x" }, { do: "backup" }] },
    { version: "v2.0.16", actions: [{ do: "office", name: "Eski Hukuk Bürosu" }, { do: "work" }, { do: "backup" }] },
    { version: "v2.0.19", actions: [{ do: "create", key: "B", code: "002", name: "Yeni Büro Ltd. Şti." }, { do: "work" }, { do: "backup" }] },
  ],
  cakisma: [
    { version: "v2.0.19", actions: [{ do: "office", name: "Merkez Ofis" }, { do: "create", key: "B", code: "002", name: "Resmi Şirket" }, { do: "work" }, { do: "backup" }] },
    { version: "v2.0.19", actions: [{ do: "recode", key: "B", code: "005" }, { do: "create", key: "C", code: "002", name: "Gayri Resmi Şirket", refStart: 500 }, { do: "work", keys: ["C"] }, { do: "backup", keys: ["B", "C"] }] },
  ],
};

const SPAN_DAYS = 456; // ~15 ay
const must = (response, what) => {
  if (response.status !== 200) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data;
};
const amount = (R, min, max) => Math.round((min + R.next() * (max - min)) * 100) / 100;
const money = value => Math.round(value * 100) / 100;

/** Şirketin canlı veri tabanı dosyası (sirketler.json'a göre; eski ad "hukuk-ofisi.sqlite" tanınır). */
export function companyDbFile(dataDir, company) {
  const dir = !company || company.id === "sirket-001" || !company.dir ? dataDir : path.join(dataDir, company.dir);
  const legacy = path.join(dir, "hukuk-ofisi.sqlite");
  return existsSync(legacy) ? legacy : path.join(dir, "destekofis.sqlite");
}
export const readRegistry = dataDir => {
  const file = path.join(dataDir, "sirketler.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).companies : null;
};
// Yedek klasöründe adı verilen dosyayı bulur (sürüme göre kök, sirket-<klasör> ya da "<kod> - <ad>").
export function findBackup(backupDir, name) {
  const stack = [backupDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === name) return full;
    }
  }
  return null;
}

/**
 * resume: zinciri bir fikstürün kesitinden sürdürür (ör. "surum-2.0.20-zincir"): fikstür dataDir/backupDir'in üst klasörüne
 * açılır, manifest ve şirketler oradan alınır, kesit sürümüne kadarki adımlar atlanır. Önceki fikstürler değişmez.
 */
export async function runChain({ chain, dataDir, backupDir, seed = 1, volume = "kucuk", log = () => {}, stopAfter = null, onPhaseEnd = null, resume = null }) {
  const steps = typeof chain === "string" ? CHAINS[chain] : chain;
  const V = VOLUMES[volume];
  if (!steps || !V) throw new Error(`Bilinmeyen zincir/hacim: ${chain}/${volume}`);
  let R = rng(seed);
  let manifest = { chain: typeof chain === "string" ? chain : "ozel", seed, volume, node: process.version, versions: [], backups: [], deleted: [], timings: {} };
  // Mantıksal şirketler: { key, id, code, name, rehber: [satırlar], accounts: [{ id, name, type, registeredOn }], refSeq, phoneSeq, supplierNo }
  const companies = new Map();
  const ensureCompany = (key, init) => {
    if (!companies.has(key)) companies.set(key, { key, rehber: [], accounts: [], refSeq: 0, supplierNo: 0, ...init });
    return companies.get(key);
  };
  ensureCompany("A", { id: "sirket-001", code: "001", name: "" });
  let today = new Date().toISOString().slice(0, 10);
  const totalPhases = steps.length;
  // Kaldığı yerden devam: fikstürün kesiti ve şirketleri; atlanan adımlar; yeni adımların günleri kesitten sonra (aşağıda).
  let resumeAt = -1;
  if (resume) {
    const root = path.dirname(dataDir);
    if (path.dirname(backupDir) !== root || path.basename(dataDir) !== "data" || path.basename(backupDir) !== "backups") throw new Error("Devam için veri ve yedek klasörleri aynı kökte data/ ve backups/ olmalı.");
    const base = unpackFixture(resume, { root });
    const { files, name, final, registry, cut, generator, ...rest } = base.fixture;
    manifest = { ...rest, chain: manifest.chain, seed, volume, node: process.version, resumedFrom: resume };
    resumeAt = steps.findIndex(item => item.version === cut);
    if (resumeAt < 0) throw new Error(`${resume}: kesit ${cut} zincirde yok.`);
    for (const item of final) Object.assign(ensureCompany(item.key, {}), { id: item.id, code: item.code, name: item.name, resumed: true });
    for (const item of manifest.deleted || []) {
      const key = [...companies.values()].find(company => company.id === item.id)?.key;
      if (key) companies.get(key).deleted = item.version;
    }
    R = rng(seed * 1000 + resumeAt + 1);
    log(`— ${resume} kesitinden (${cut}) devam: ${final.map(item => `${item.code} · ${item.name}`).join(", ")}`);
  }

  for (const [phaseIndex, step] of steps.entries()) {
    if (phaseIndex <= resumeAt) continue;
    const started = performance.now();
    // 1.x ayrı süreç (kendi ortam değişkenleriyle); 2.x aynı süreçte kendi createApp'i.
    const legacy = /^v1\./.test(step.version);
    const server = legacy ? await bootProcess(step.version, { dataDir, backupDir }) : await bootVersion(step.version, { dataDir, backupDir, maxCompanies: 10 }); // eski sürümler sınırsızdı; bugünkü kod için sınır yükseltilir
    manifest.versions.push({ version: step.version, commit: server.commit });
    const api = await server.login();
    const multi = !legacy && step.version !== "v2.0.16";
    let closed = false;
    try {
      const probe = await api.get("/api/workspace/accounts?limit=1");
      today = probe.data?.today || today;
    } catch {
      // bugünü sunucudan okuyamazsa yerel tarih
    }
    // Sürümün iş günleri: zincir baştan üretilirken 15 aylık çizelgenin payı; devamda kesitten sonraki son günler (her sürüme
    // bir gün, son sürüm bugün): faturalar seri sırasıyla kesilir, kesitteki son faturadan önceki güne fatura yazılamaz.
    const windowStart = resumeAt >= 0 ? addDays(today, phaseIndex - totalPhases + 1) : addDays(today, -SPAN_DAYS + Math.floor((SPAN_DAYS * phaseIndex) / totalPhases));
    const windowEnd = resumeAt >= 0 ? windowStart : addDays(today, -SPAN_DAYS + Math.floor((SPAN_DAYS * (phaseIndex + 1)) / totalPhases) - 1);
    const live = () => [...companies.values()].filter(item => !item.deleted && (multi || item.key === "A"));
    const pick = keys => (keys ? keys.map(key => companies.get(key)) : live());
    const select = async company => {
      if (!multi) return;
      must(await api.post("/api/companies/select", { id: company.id }), `${step.version} şirket seç ${company.code}`);
    };
    const registryEntry = company => (readRegistry(dataDir) || []).find(item => item.id === company.id) || { id: company.id, dir: "" };
    log(`— ${step.version} (${server.commit?.slice(0, 7) || "güncel"}) · ${windowStart} … ${windowEnd}`);

    for (const action of step.actions) {
      if (action.do === "office") {
        must(await api.put("/api/admin/office", { name: action.name }), "ofis adı");
        companies.get("A").name = action.name;
      } else if (action.do === "create") {
        const created = must(await api.post("/api/companies", { code: action.code, name: action.name }), `${step.version} şirket aç ${action.code}`);
        ensureCompany(action.key, { id: created.company.id, code: created.company.code, name: created.company.name, createdIn: step.version, refSeq: action.refStart || 0 });
        log(`  şirket açıldı ${created.company.code} · ${created.company.name} → ${registryEntry(created.company).dir}`);
      } else if (action.do === "recode" || action.do === "rename") {
        const company = companies.get(action.key);
        const body = action.do === "recode" ? { code: action.code } : { name: action.name };
        const updated = must(await api.put(`/api/companies/${company.id}`, body), `${step.version} şirket güncelle ${company.code}`);
        log(`  şirket ${company.code} · ${company.name} → ${updated.company.code} · ${updated.company.name}`);
        Object.assign(company, { code: updated.company.code, name: updated.company.name });
      } else if (action.do === "delete") {
        const company = companies.get(action.key);
        const facts = dbFacts(companyDbFile(dataDir, registryEntry(company)));
        const removed = must(await api.del(`/api/companies/${company.id}`, { confirm: company.code, password: "Test-Admin-2026!" }), `${step.version} şirket sil ${company.code}`);
        company.deleted = step.version;
        manifest.deleted.push({ id: company.id, code: company.code, name: company.name, version: step.version, facts, backup: removed.backup || "" });
        log(`  şirket silindi ${company.code} · ${company.name} (silme öncesi yedek ${removed.backup})`);
      } else if (action.do === "work") {
        for (const company of pick(action.keys)) {
          // Kesitten sürdürülen şirketin REHBER satırları ve carileri bellekte yok: "work" tabloyu baştan yazardı (replace).
          if (company.resumed) throw new Error(`${step.version}: devam eden zincirde ${company.code} için "work" kullanılamaz ("finance" kullanın).`);
          await select(company);
          const t = performance.now();
          await work({ api, R, V, company, windowStart, windowEnd, today, version: step.version });
          log(`  ${company.code} · ${company.name}: veri girildi (${Math.round(performance.now() - t)} ms)`);
        }
      } else if (action.do === "finance") {
        for (const company of pick(action.keys)) {
          await select(company);
          const t = performance.now();
          await workFinance({ api, R, company, windowStart, windowEnd, version: step.version });
          log(`  ${company.code} · ${company.name}: para işleri girildi (${Math.round(performance.now() - t)} ms)`);
        }
      } else if (action.do === "people") {
        await workPeople({ api, version: step.version, manifest });
        log(`  özel roller ve kişiye özel yetkili kullanıcılar açıldı (${manifest.people.users.length} kullanıcı)`);
      } else if (action.do === "lock") {
        for (const company of pick(action.keys)) {
          await select(company);
          const lockedUntil = addDays(windowStart, -(action.daysBefore || 1));
          must(await api.put("/api/admin/period-lock", { lockedUntil }), `${step.version} dönem kilidi ${company.code}`);
          log(`  ${company.code}: dönem kilidi ${lockedUntil}`);
        }
      } else if (action.do === "future") {
        // O sürümün kabul ettiği ileri tarihli hareket (2.0.26 A6 bunu reddeder): çek alış tarihi. (İleri tarihli kayıt tahsilatı
        // 2.0.25'te de girilemiyordu: kapı 409 veriyordu; A1 yalnız yanıtı 400'e çevirdi.)
        for (const company of pick(action.keys)) {
          await select(company);
          // Cariye işlenmemiş evrak (yalnız keşideci adı): 2.0.25'te ileri tarihli cari satırı kapıda reddedilir, evrakın kendisi girer.
          must(await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", issueDate: addDays(today, 5), dueDate: addDays(today, 40), drawer: "İleri Tarihli Keşideci", serialNo: `ILERI-${company.code}`, bank: "Vakıfbank" }), `${step.version} ileri tarihli çek`);
          log(`  ${company.code}: ileri tarihli çek (${addDays(today, 5)})`);
        }
      } else if (action.do === "kayit1x") {
        // v1.3.1: tabloya elle kayıt (Kayıtlar) ve görev. O sürümde cari/fatura yoktu.
        const t = performance.now();
        const count = V.rehber.root;
        for (let i = 1; i <= count; i += 1) must(await api.post("/api/workspace/records", { sourceName: "REHBER.xlsx", values: { "DOSYA NO": `2024/${String(i).padStart(4, "0")}`, "Ad Soyad": `${R.pick(FIRST)} ${R.pick(LAST)}`, Telefon: `05${R.int(30, 59)} ${R.int(100, 999)} ${R.int(10, 99)} ${R.int(10, 99)}`, Şehir: R.pick(CITY) } }), `${step.version} kayıt`);
        for (let i = 1; i <= 12; i += 1) must(await api.post("/api/workspace/tasks", { title: `Duruşma hazırlığı ${i}`, dueDate: addDays(windowStart, i * 5) }), `${step.version} görev`);
        log(`  001: ${count} kayıt, 12 görev girildi (${Math.round(performance.now() - t)} ms)`);
      } else if (action.do === "backup" && legacy) {
        // 1.x: yedek, servis durdurulup o sürümün kendi aracıyla (npm run backup) alınır.
        await server.close();
        closed = true;
        const company = companies.get("A");
        const live = companyDbFile(dataDir, null);
        const file = server.runBackupTool();
        const facts = dbFacts(file);
        manifest.backups.push({ version: step.version, companyKey: "A", companyId: company.id, code: "001", name: company.name, file: path.basename(file), pathAtCreation: path.relative(backupDir, file).split(path.sep).join("/"), sha256: sha256File(file), dataDir: "", facts, api: null, fileFacts: facts, matchesLive: JSON.stringify(dbFacts(live)) === JSON.stringify(facts) });
        log(`  yedek 001 (araçla): ${path.relative(backupDir, file)} (${facts.records} kayıt)`);
      } else if (action.do === "backup") {
        for (const company of pick(action.keys)) {
          await select(company);
          const entry = registryEntry(company);
          const live = companyDbFile(dataDir, entry);
          const facts = dbFacts(live);
          const seen = await apiFacts(api);
          const body = step.version === "v2.0.16" || step.version === "v2.0.17" || step.version === "v2.0.18" || step.version === "v2.0.19" ? {} : { scope: "one", companyId: company.id };
          const result = must(await api.post("/api/admin/backups", body), `${step.version} yedek ${company.code}`);
          const file = findBackup(backupDir, result.name);
          if (!file) throw new Error(`${step.version}: alınan yedek diskte bulunamadı (${result.name})`);
          const inFile = dbFacts(file);
          manifest.backups.push({ version: step.version, companyKey: company.key, companyId: company.id, code: company.code, name: company.name, file: result.name, pathAtCreation: path.relative(backupDir, file).split(path.sep).join("/"), sha256: sha256File(file), dataDir: entry.dir || "", facts, api: seen, fileFacts: inFile, matchesLive: JSON.stringify(inFile) === JSON.stringify(facts) });
          log(`  yedek ${company.code}: ${path.relative(backupDir, file)} (${facts.accounts} cari, ${facts.invoices} fatura)`);
        }
      } else throw new Error(`Bilinmeyen adım: ${action.do}`);
    }

    // Sürümün son hâli: her şirketin olguları (dosya + API).
    const state = [];
    if (legacy && !closed) await server.close();
    for (const company of live()) {
      if (!legacy) await select(company);
      const entry = registryEntry(company);
      state.push({ key: company.key, id: company.id, code: company.code, name: company.name || "", dir: entry.dir || "", facts: dbFacts(companyDbFile(dataDir, entry)), api: legacy ? null : await apiFacts(api) });
    }
    manifest.versions.at(-1).state = state;
    if (multi) must(await api.post("/api/companies/select", { id: "sirket-001" }), "001'e dön");
    if (!legacy) await server.close();
    manifest.timings[step.version] = Math.round(performance.now() - started);
    // Kesit: bu sürüm kapandıktan hemen sonraki disk hâli (fikstür). Manifest o ana kadarki hâliyle verilir.
    if (onPhaseEnd) await onPhaseEnd({ version: step.version, last: phaseIndex === totalPhases - 1, manifest: { ...structuredClone(manifest), final: state, registry: readRegistry(dataDir), cut: step.version } });
    if (stopAfter && step.version === stopAfter) break;
  }
  manifest.final = manifest.versions.at(-1).state;
  manifest.registry = readRegistry(dataDir);
  return manifest;
}

// Bir şirkette bir dönemlik iş: REHBER tablosu (Excel), cariler (Excel), tedarikçiler, faturalar, tahsilat/borç/ödeme,
// Kasa ve taksit kartları. Her çağrı o sürümün API'sinden; her yanıt 200 olmalı.
async function work({ api, R, V, company, windowStart, windowEnd, version }) {
  const root = company.key === "A";
  const first = !company.accounts.length;
  const span = Math.max(1, Math.round((Date.parse(windowEnd) - Date.parse(windowStart)) / 86_400_000));
  const dayIn = () => addDays(windowStart, R.int(0, span));
  const sortedDays = n => Array.from({ length: n }, dayIn).sort();
  const person = () => `${R.pick(FIRST)} ${R.pick(LAST)}`;
  const phone = () => `05${R.int(30, 59)} ${R.int(100, 999)} ${String(R.int(0, 99)).padStart(2, "0")} ${String(R.int(0, 99)).padStart(2, "0")}`;
  const tr = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

  // 1) REHBER tablosu (müşterinin Excel'i): her dönem eskisinin devamı olarak yeni satırlar eklenir.
  const addRows = first ? (root ? V.rehber.root : V.rehber.other) : root ? V.rehberStep.root : V.rehberStep.other;
  for (let i = 0; i < addRows; i += 1) {
    const no = company.rehber.length + 1;
    company.rehber.push([String(no), person(), phone(), R.pick(CITY), `${2025 + (no % 2)}/${String(no).padStart(4, "0")}`, tr(dayIn()), String(R.int(5, 500) * 100)]);
  }
  const matrix = [["Sıra", "Ad Soyad", "Telefon", "Şehir", "Dosya No", "Kayıt Tarihi", "Tutar"], ...company.rehber];
  const staged = must(await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "REHBER.xlsx", sheets: [{ name: "REHBER", matrix }] }), `${version} REHBER önizleme`);
  must(await api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: first ? "replace" : "merge" }), `${version} REHBER kaydet`);

  // 2) Cariler (Excel'den yükle): kayıt tarihi bu dönemin başı; bir kısmında açılış bakiyesi.
  const addCaris = first ? (root ? V.caris.root : V.caris.other) : root ? V.cariStep.root : V.cariStep.other;
  const cariRows = [];
  for (let i = 0; i < addCaris; i += 1) {
    company.refSeq += 1;
    cariRows.push([String(company.refSeq), person(), phone(), R.pick(CITY), tr(windowStart), R.chance(0.3) ? String(R.int(1, 50) * 100) : ""]);
  }
  const imported = must(await api.post("/api/workspace/accounts/import", { matrix: [["Cari No", "Ad Soyad / Unvan", "Telefon", "Şehir", "Kayıt Tarihi", "Açılış Bakiyesi"], ...cariRows], headerAt: 0, roles: { 0: "seq", 1: "name", 2: "phone", 3: "city", 4: "registered", 5: "balance" }, mode: "skip", fileName: "cariler.xlsx" }), `${version} cari yükle`);
  if (imported.created !== cariRows.length) throw new Error(`${version}: ${cariRows.length} cariden ${imported.created} açıldı (${JSON.stringify(imported.skipped).slice(0, 300)})`);
  // Yeni açılan carilerin kimlikleri (Cari No ile).
  const byRef = new Map();
  for (let offset = 0; ; offset += 5000) {
    const page = must(await api.get(`/api/workspace/accounts?status=all&limit=5000&offset=${offset}`), "cari listesi");
    for (const item of page.accounts) byRef.set(item.refNo, item);
    if (!page.hasMore) break;
  }
  for (const row of cariRows) {
    const found = byRef.get(row[0]);
    if (found) company.accounts.push({ id: found.id, name: found.name, type: "customer", registeredOn: windowStart });
  }
  if (first) {
    for (let i = 0; i < V.suppliers; i += 1) {
      const created = must(await api.post("/api/workspace/accounts", { name: `${R.pick(SUPPLIER)}${i >= SUPPLIER.length ? ` ${i}` : ""}`, type: "supplier", registeredOn: windowStart }), `${version} tedarikçi`);
      company.accounts.push({ id: created.id, name: created.name, type: "supplier", registeredOn: windowStart });
    }
  }
  const customers = () => company.accounts.filter(item => item.type === "customer");
  const suppliers = () => company.accounts.filter(item => item.type === "supplier");

  // 3) Faturalar (tarih sırasıyla; seride eski tarih kesilmez): satış (açık / peşin kısmi / taksitli / tam peşin) ve gider alışı.
  for (const day of sortedDays(V.invoices)) {
    if (R.chance(0.75)) {
      const lines = Array.from({ length: R.int(1, 3) }, () => ({ name: R.pick(SERVICE), qty: R.int(1, 5), unitPrice: R.int(5, 400) * 10, vatRate: R.pick([20, 20, 10, 1]) }));
      const gross = lines.reduce((sum, line) => sum + line.qty * line.unitPrice * (1 + line.vatRate / 100), 0);
      const roll = R.next();
      const payment = roll < 0.4 ? { rest: "open" } : roll < 0.7 ? { cash: [{ amount: money(Math.floor(gross * 0.3)), method: R.pick(["cash", "bank"]) }], rest: "open" } : roll < 0.9 ? { rest: "installments", installments: { count: R.int(2, 6), firstDue: addDays(day, 30), everyMonths: 1 } } : { cash: [{ amount: money(gross), method: "cash" }], rest: "open" };
      must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: R.pick(customers()).id, issueDate: day, lines, payment }), `${version} satış faturası ${day}`);
    } else {
      company.supplierNo += 1;
      must(await api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: R.pick(suppliers()).id, number: `ALS-${company.code}-${company.supplierNo}`, issueDate: day, lines: [{ name: R.pick(EXPENSE), qty: 1, unitPrice: R.int(10, 300) * 10, vatRate: 20, expenseCode: "other" }], payment: R.chance(0.5) ? { rest: "open" } : { cash: [{ amount: R.int(1, 9) * 10, method: "cash" }], rest: "open" }, cashForce: true }), `${version} gider faturası ${day}`);
    }
  }
  // 4) Cari hareketleri: tahsilat (nakit/havale), borç yazma, tedarikçiye ödeme.
  for (const day of sortedDays(V.collections)) must(await api.post(`/api/workspace/accounts/${R.pick(customers()).id}/entries`, { kind: "in", amount: amount(R, 50, 4000), date: day, method: R.pick(["cash", "cash", "bank"]), note: "Tahsilat" }), `${version} tahsilat`);
  for (const day of sortedDays(V.debts)) must(await api.post(`/api/workspace/accounts/${R.pick(customers()).id}/entries`, { kind: "debt", amount: amount(R, 100, 6000), date: day, note: "Borç kaydı" }), `${version} borç`);
  for (const day of sortedDays(V.payments)) must(await api.post(`/api/workspace/accounts/${R.pick(suppliers()).id}/entries`, { kind: "out", amount: amount(R, 50, 900), date: day, method: "cash", note: "Tedarikçiye ödeme", cashForce: true }), `${version} ödeme`);
  // 5) Kasa (yalnız nakit).
  for (const day of sortedDays(V.cash)) {
    const kind = R.chance(0.6) ? "in" : "out";
    must(await api.post("/api/workspace/cash", { kind, amount: amount(R, 20, 1500), date: day, description: kind === "in" ? "Elden tahsilat" : "Ofis gideri", cashForce: true }), `${version} Kasa`);
  }
  // 6) Taksit kartları ve taksit tahsilatı.
  for (const day of sortedDays(V.plans)) {
    const owner = R.pick(customers());
    const total = R.int(6, 60) * 1000;
    const plan = must(await api.post("/api/workspace/plans", { accountId: owner.id, name: owner.name, total: String(total), mode: "auto", count: R.int(3, 12), firstDue: addDays(day, 30), registeredOn: day }), `${version} taksit kartı`);
    const pays = sortedDays(V.planPays).map(pay => (pay < day ? day : pay));
    for (const pay of pays) must(await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: String(Math.round(total / 10)), date: pay, method: "cash" }), `${version} taksit tahsilatı`);
  }
}

// Banka göçünün kaynak verisi (v2.0.21+; §10.5): bir şirkette bir günlük para işi, o sürümün kendi API'sinden. Her modülde
// havale/EFT ve POS/kredi kartı satırı; Kasa ↔ Banka; silinip geri yüklenen tahsilat; satıştan iade ve fatura iptali; yalnız
// Borç Yaz satırı olan cari; kayıt tahsilatı; taksit; stoktan POS'lu satış; bankaya tahsil edilen çek.
async function workFinance({ api, R, company, windowStart, windowEnd, version }) {
  const day = windowEnd;
  const tag = `${version.slice(1)}-${company.code}`;
  const person = () => `${R.pick(FIRST)} ${R.pick(LAST)}`;
  const open = async (name, type) => must(await api.post("/api/workspace/accounts", { name, type, registeredOn: windowStart, phone: `05${R.int(30, 59)} ${R.int(100, 999)} ${R.int(10, 99)} ${R.int(10, 99)}` }), `${version} cari aç`);
  const c1 = await open(`${person()} (${tag})`, "customer");
  const c2 = await open(`${person()} (${tag})`, "customer");
  const s1 = await open(`${R.pick(SUPPLIER)} ${tag}`, "supplier");
  const debtOnly = await open(`${person()} Yalnız Borç (${tag})`, "customer");
  must(await api.post(`/api/workspace/accounts/${debtOnly.id}/entries`, { kind: "debt", amount: String(R.int(3, 30) * 100), date: day, note: "Borç kaydı" }), `${version} yalnız borç`);
  // Stok: ürün, girişi (parasız) ve POS'la peşin satış.
  const item = must(await api.post("/api/workspace/stock", { name: `Ürün ${tag}`, code: `STK-${tag}`, unit: "Adet", unitPrice: "100", salePrice: "150" }), `${version} stok kartı`);
  must(await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "20", unitPrice: "100", pay: "none", date: day }), `${version} stok girişi`);
  must(await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "150", pay: "cash", method: "card", date: day, force: true }), `${version} POS'la stok satışı`);
  // Faturalar: mal satışı (havale peşin + açık) → satıştan iade; hizmet satışı POS'la tam peşin; gider alışı kredi kartıyla;
  // taksitli hizmet satışı; havale peşinli fatura → iptal.
  const goods = must(await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: c1.id, issueDate: day, lines: [{ itemId: item.id, qty: 2, unitPrice: 150, vatRate: 20 }], payment: { cash: [{ amount: 100, method: "bank" }], rest: "open" }, force: true }), `${version} mal satışı`);
  must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: c2.id, issueDate: day, lines: [{ name: R.pick(SERVICE), qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "card" }], rest: "open" } }), `${version} POS'lu satış`);
  must(await api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: s1.id, number: `ALS-${tag}`, issueDate: day, lines: [{ name: R.pick(EXPENSE), qty: 1, unitPrice: 500, vatRate: 20, expenseCode: "other" }], payment: { cash: [{ amount: 600, method: "card" }], rest: "open" }, cashForce: true }), `${version} kredi kartıyla alış`);
  must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: c1.id, issueDate: day, lines: [{ name: R.pick(SERVICE), qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: addDays(day, 30), everyMonths: 1 } } }), `${version} taksitli satış`);
  const toCancel = must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: c2.id, issueDate: day, lines: [{ name: R.pick(SERVICE), qty: 1, unitPrice: 500, vatRate: 20 }], payment: { cash: [{ amount: 600, method: "bank" }], rest: "open" } }), `${version} iptal edilecek fatura`);
  must(await api.post(`/api/workspace/invoices/${toCancel.id}/cancel`, { reason: "Göç verisi: iptal", force: true, cashForce: true }), `${version} fatura iptali`);
  must(await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: goods.id, issueDate: day, lines: [{ originLineId: goods.lines[0].id, qty: 1 }], payment: {}, force: true }), `${version} satıştan iade`);
  // Cari tahsilat/ödeme: havale, POS; tedarikçiye havale.
  must(await api.post(`/api/workspace/accounts/${c1.id}/entries`, { kind: "in", amount: "300", date: day, method: "bank", note: "Havale tahsilatı" }), `${version} havale tahsilatı`);
  must(await api.post(`/api/workspace/accounts/${c2.id}/entries`, { kind: "in", amount: "200", date: day, method: "card", note: "POS tahsilatı" }), `${version} POS tahsilatı`);
  must(await api.post(`/api/workspace/accounts/${s1.id}/entries`, { kind: "out", amount: "150", date: day, method: "bank", note: "Tedarikçiye havale", cashForce: true }), `${version} havale ödemesi`);
  // Silinip Silinenler'den geri yüklenen havale tahsilatı.
  const removed = must(await api.post(`/api/workspace/accounts/${c2.id}/entries`, { kind: "in", amount: "77", date: day, method: "bank", note: "Silinip geri yüklenecek" }), `${version} silinecek tahsilat`);
  must(await api.del(`/api/workspace/accounts/${c2.id}/entries/${removed.entryId || removed.id}?cashForce=1`), `${version} tahsilat sil`);
  const trash = must(await api.get("/api/admin/trash"), `${version} Silinenler`);
  const item77 = (Array.isArray(trash) ? trash : trash.items || []).find(entry => entry.kind === "account-entry" && /77/.test(entry.detail || ""));
  if (!item77) throw new Error(`${version}: silinen tahsilat Silinenler'de yok`);
  must(await api.post("/api/admin/trash/restore", { id: item77.id }), `${version} tahsilatı geri yükle`);
  // Kasa (nakit) ve Kasa ↔ Banka.
  must(await api.post("/api/workspace/cash", { kind: "in", amount: "500", date: day, description: "Elden tahsilat" }), `${version} Kasa girişi`);
  must(await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "200", date: day, description: "Kasadan bankaya", cashForce: true }), `${version} Kasadan bankaya`);
  must(await api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "100", date: day, description: "Bankadan kasaya" }), `${version} bankadan kasaya`);
  // Taksit kartı: havale ve POS tahsilatı.
  const plan = must(await api.post("/api/workspace/plans", { accountId: c1.id, name: c1.name, total: "3000", mode: "auto", count: 3, firstDue: addDays(day, 30), registeredOn: windowStart }), `${version} taksit kartı`);
  must(await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "500", date: day, method: "bank" }), `${version} taksit havale`);
  must(await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "250", date: day, method: "card" }), `${version} taksit POS`);
  // Çek: alınan çek bankadan tahsil.
  const cheque = must(await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "400", issueDate: day, dueDate: day, accountId: c1.id, serialNo: `C-${tag}`, bank: "Ziraat" }), `${version} çek alındı`);
  must(await api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: day, method: "bank" }), `${version} çek bankadan tahsil`);
  // Kayıt tahsilatı (kişi kartından) havaleyle.
  must(await api.post(`/api/workspace/cases/${encodeURIComponent(`DOSYA-${tag}`)}/payments`, { amount: "250", date: day, method: "bank", note: "Kayıt tahsilatı (havale)" }), `${version} kayıt tahsilatı`);
}

// Özel roller ve kişiye özel yetkili kullanıcılar (ortak katman; yetki göçü K4, §9.1). Beklenen banka yetkileri test tarafında
// kuraldan hesaplanır; manifestte yalnız ne açıldığı durur.
const PEOPLE_PASSWORD = "Personel-2026!";
async function workPeople({ api, version, manifest }) {
  const roles = [
    { name: "Tahsilat Sorumlusu", permissions: ["accounts.view", "accounts.collect", "accounts.manage", "plans.view", "plans.collect", "cash.view"] },
    { name: "Kasa Görevlisi", permissions: ["cash.view", "cash.manage", "payments.create", "records.create"] },
  ];
  const created = [];
  for (const role of roles) created.push({ ...role, id: must(await api.post("/api/admin/roles", { ...role, description: "Göç verisi" }), `${version} rol ${role.name}`).id });
  const users = [
    { username: "ayse", name: "Ayşe Fatura", role: "personel", grants: { add: ["invoices.view", "invoices.manage"], remove: [] } },
    { username: "mehmet", name: "Mehmet Muhasebe", role: "muhasebe", grants: { add: [], remove: ["cash.view"] } },
    { username: "zeynep", name: "Zeynep Tahsilat", role: created[0].id, grants: { add: [], remove: [] } },
    { username: "ali", name: "Ali Personel", role: "personel", grants: { add: [], remove: [] } },
    { username: "fatma", name: "Fatma Avukat", role: "avukat", grants: { add: [], remove: ["accounts.manage", "invoices.manage", "stock.manage", "stock.sell", "cheques.manage", "plans.manage"] } },
    { username: "kasa1", name: "Kasa Görevlisi Bir", role: created[1].id, grants: { add: ["stock.sell"], remove: [] } },
  ];
  for (const user of users) must(await api.post("/api/admin/users", { ...user, password: PEOPLE_PASSWORD, mustChangePassword: false }), `${version} kullanıcı ${user.username}`);
  manifest.people = { version, roles: created, users };
}

/** Yedek klasöründeki her dosya (göreli yol, sha256, boyut, değişme zamanı). */
export function backupInventory(backupDir) {
  const out = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push({ path: path.relative(backupDir, full).split(path.sep).join("/"), sha256: sha256File(full), size: statSync(full).size });
    }
  };
  if (existsSync(backupDir)) walk(backupDir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
