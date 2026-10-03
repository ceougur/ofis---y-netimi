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
import { apiFacts, dbFacts, sha256File } from "./olgular.mjs";
import { bootVersion } from "./surumler.mjs";

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
  ],
  // 2.0.17–2.0.19 hatası, GERÇEK v2.0.19 koduyla: 002'nin kodu 005 yapılır, sonra 002 koduyla yeni şirket açılır — eski kod
  // yeni şirkete aynı veri klasörünü (sirketler/002) verir; iki şirketin carileri aynı veri tabanına yazılır.
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

export async function runChain({ chain, dataDir, backupDir, seed = 1, volume = "kucuk", log = () => {}, stopAfter = null, onPhaseEnd = null }) {
  const steps = typeof chain === "string" ? CHAINS[chain] : chain;
  const V = VOLUMES[volume];
  if (!steps || !V) throw new Error(`Bilinmeyen zincir/hacim: ${chain}/${volume}`);
  const R = rng(seed);
  const manifest = { chain: typeof chain === "string" ? chain : "ozel", seed, volume, node: process.version, versions: [], backups: [], deleted: [], timings: {} };
  // Mantıksal şirketler: { key, id, code, name, rehber: [satırlar], accounts: [{ id, name, type, registeredOn }], refSeq, phoneSeq, supplierNo }
  const companies = new Map();
  const ensureCompany = (key, init) => {
    if (!companies.has(key)) companies.set(key, { key, rehber: [], accounts: [], refSeq: 0, supplierNo: 0, ...init });
    return companies.get(key);
  };
  ensureCompany("A", { id: "sirket-001", code: "001", name: "" });
  let today = new Date().toISOString().slice(0, 10);
  const totalPhases = steps.length;

  for (const [phaseIndex, step] of steps.entries()) {
    const started = performance.now();
    const server = await bootVersion(step.version, { dataDir, backupDir });
    manifest.versions.push({ version: step.version, commit: server.commit });
    const api = await server.login();
    const multi = step.version !== "v2.0.16";
    try {
      const probe = await api.get("/api/workspace/accounts?limit=1");
      today = probe.data?.today || today;
    } catch {
      // bugünü sunucudan okuyamazsa yerel tarih
    }
    const windowStart = addDays(today, -SPAN_DAYS + Math.floor((SPAN_DAYS * phaseIndex) / totalPhases));
    const windowEnd = addDays(today, -SPAN_DAYS + Math.floor((SPAN_DAYS * (phaseIndex + 1)) / totalPhases) - 1);
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
          await select(company);
          const t = performance.now();
          await work({ api, R, V, company, windowStart, windowEnd, today, version: step.version });
          log(`  ${company.code} · ${company.name}: veri girildi (${Math.round(performance.now() - t)} ms)`);
        }
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
    for (const company of live()) {
      await select(company);
      const entry = registryEntry(company);
      state.push({ key: company.key, id: company.id, code: company.code, name: company.name, dir: entry.dir || "", facts: dbFacts(companyDbFile(dataDir, entry)), api: await apiFacts(api) });
    }
    manifest.versions.at(-1).state = state;
    if (multi) must(await api.post("/api/companies/select", { id: "sirket-001" }), "001'e dön");
    await server.close();
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
