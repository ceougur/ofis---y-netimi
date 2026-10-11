// Ölçek testi (v2.1.0 son doğrulaması; docs/BANKA-MODULU-PLAN.md §10.7 / Aşama 16; CLAUDE.md "ÖLÇEK: temel sürümde son adayda bir kez 10 ve 20
// eşzamanlı kullanıcı, 100.000 para satırı, 2 şirket, yedekleme sırasında yük (sunucu + ekran)"; kullanıcı 05.10.2026: "ölçümü sadece koddan
// yapma, arayüz kaldırıyor mu ona da bak"). Ürün kodu DEĞİŞMEZ; bu yalnız ölçüm aracıdır.
//
// 1) VERİ (programın KENDİ ürettiği veri): gerçek sunucu (bu dalın kodu, gerçek dosya veri tabanı) gerçek HTTP API'si üzerinden mutabakat motoruyla
//    (test/mutabakat/motor.mjs: cari, Kasa, stok, taksit, fatura — peşin/vadeli/taksitli/iade/iptal —, çek/senet, banka hesapları, Banka Fişleri,
//    bankalar arası transfer, kurumsal kart; 365 günlük zaman çizelgesi) iki şirkette sürülür. Kopyalama YOK: her satır bir API isteğinin
//    sonucudur. Motor koşu sonunda programı kendi BAĞIMSIZ modeliyle karşılaştırır (uyuşmazlık = veri reddedilir). Sahte saat motorNow()
//    (ders 22: koşu gece yarısını geçemez).
// 2) YÜK: sunucu AYRI süreçte (yük üreticisi ve tarayıcı sunucunun iş parçacığını paylaşmasın) üretim ayarlarıyla açılır; veri her düzey için
//    taze kopyadan. U eşzamanlı personel (her biri kendi oturumu, rol Muhasebe, iki şirkette yetkili; %80 001, %20 002) gerçekçi karışımla
//    çalışır: cari tahsilat (nakit / havale + hesap), cari ödeme (nakit), peşin satış faturası, Banka Fişi (masraf), bankalar arası transfer,
//    rapor açma (Banka Bakiye / Banka Hareket / Banka ve POS Hareketleri), cari arama, Banka Hareketleri listesi. Bekleme her işlem arasında
//    0,5–1,5 sn (yoğun ofis). Aynı sırada: otomatik yedek (zamanlayıcının bir turu, app.runDueBackups) ve elle "Şimdi Yedek Al — Tüm Şirketler"
//    (POST /api/admin/backups). Chromium'da 3 gerçek pencere (ayrı personel): Cari araması (tuş → harf, son tuş → sonuç), Banka → Hareketler
//    (açılış, hesap süzgeci, Daha Fazla, ekrandan + Masraf Kaydet → listede görünme, başkasının kaydı açık listede görünme), Raporlar → Banka
//    Bakiye Raporu (ön izleme + PDF + Excel); her pencerede uzun görev (donma) toplamı ve JS belleği.
// 3) SONUÇ: her işlem türünde p50/p95/en çok, durum kodları (beklenen 409'lar ayrı), sunucunun olay döngüsü gecikmesi, yedek süresi + her yedek
//    dosyasında integrity_check, sonunda Mutabakat Testi (GET /ledger/integrity) iki şirkette, para toplamları BAĞIMSIZ hesapla: önce = motorun
//    bağımsız modeli (koşu sonunda programla kuruşu kuruşuna aynı), sonra = önce + yük üreticisinin kendi defteri (yalnız 200 dönen yazımlar).
//
// Kullanım (ders 15: ölçüm tek başına — flock /tmp/destekofis-olcum.lock ile sarın):
//   node tools/olcek-210.mjs --asama veri [--klasor <dir>] [--islem-001 30000] [--islem-002 6000]
//   node tools/olcek-210.mjs --asama yuk  [--klasor <dir>] [--kullanici 10,20] [--sure 240] [--pencere 3] [--json <dosya>]
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const STAGE = opt("asama", "hepsi");
const DIR = path.resolve(opt("klasor", path.join(os.tmpdir(), "destekofis-olcek-210")));
// Motor tohumu çeşit içindir (hacim doldurmadan gelir). 001 tohum 2101 8.000 işlemde Kasa ~4,2 milyon TL'yi aşınca motorun "fatura-acid/kasa"
// adımı (birim fiyat ≈ Kasa bakiyesi) ürünün kayan noktalı ondalık denetimine takıldı (yanlış 400; docs/kanit/2026-10-11/olcek/birim-fiyat-sonda.mjs).
// İlk yanlış ret işlem 2.518'de; bu yüzden 2.000 işlem (aynı tohum, aynı sıra).
const OPS1 = Number(opt("islem-001", "2000"));
const OPS2 = Number(opt("islem-002", "1000"));
// Doldurma hedefi (para satırı, şirket başına): motor tohumundan sonra gerçek API'den yazılır (kopyalama yok).
const FILL1 = Number(opt("hedef-001", "100000"));
const FILL2 = Number(opt("hedef-002", "12000"));
const FILL_ACCOUNTS = Number(opt("cari", "3000"));
const LEVELS = String(opt("kullanici", "10,20")).split(",").map(Number).filter(n => n > 0);
const SECONDS = Number(opt("sure", "240"));
const WINDOWS = Number(opt("pencere", "3"));
const THINK = String(opt("bekleme", "500-1500")).split("-").map(Number);
const JSON_OUT = opt("json", "");
const PASS = "Olcek-210-Yonetici!";
const STAFF_PASS = "Olcek-210-Personel!";
const STAFF = 20;
const SCREEN_USERS = ["ekran1", "ekran2", "ekran3"];
const log = (...items) => console.log(...items);
const pct = (list, p) => {
  const sorted = list.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
};
const r0 = value => (value === null || value === undefined ? null : Math.round(value));
const tl = cents => `${(cents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amountText = cents => `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const motorNowOf = async () => (await import(pathToFileURL(path.join(ROOT, "test", "mutabakat", "motor.mjs")).href)).motorNow;

function baseOptions(dataDir, extra = {}) {
  return {
    dataDir,
    backupDir: path.join(path.dirname(dataDir), "backups"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
    moneyStrict: false,
    gateVerify: false,
    ...extra,
  };
}
function companyFiles(dataDir) {
  const registry = JSON.parse(readFileSync(path.join(dataDir, "sirketler.json"), "utf8"));
  return registry.companies.filter(company => !company.deletedAt).map(company => ({ id: company.id, code: String(company.code), file: path.join(company.dir ? path.join(dataDir, company.dir) : dataDir, "destekofis.sqlite") }));
}
// Para satırı sayısı (moneyLines'ın kaynak tabloları; programın kendi tanımı) — salt okunur bağlantıyla.
async function countMoney(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
    const { MONEY_SOURCES, moneyWhere } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "bank", "money-lines.mjs")).href);
    let money = 0;
    const by = {};
    for (const table of new Set(MONEY_SOURCES.map(source => source.table))) {
      if (!tables.has(table)) continue;
      const n = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${moneyWhere(table)}`).get().n;
      by[table] = n;
      money += n;
    }
    return { money, by };
  } finally {
    db.close();
  }
}

// ======================================================================== SUNUCU (ayrı süreç) ========================================================================
if (process.env.OLCEK_SUNUCU) {
  const conf = JSON.parse(process.env.OLCEK_SUNUCU);
  const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const app = createApp(baseOptions(conf.dataDir, { now: conf.now, ...(conf.extra || {}) }));
  const { port } = await app.listen(0, "127.0.0.1");
  process.send({ cmd: "ready", port });
  process.on("message", async message => {
    if (message.cmd === "auto-backup") {
      const at = performance.now();
      let results = [];
      let error = "";
      try {
        results = app.runDueBackups().map(item => ({ name: item.name, path: item.path, size: item.size }));
      } catch (caught) {
        error = String(caught?.message || caught);
      }
      process.send({ cmd: "auto-backup", ms: performance.now() - at, results, error });
    } else if (message.cmd === "loop-reset") {
      loop.reset();
      process.send({ cmd: "loop-reset" });
    } else if (message.cmd === "loop") {
      process.send({ cmd: "loop", p50: loop.percentile(50) / 1e6, p95: loop.percentile(95) / 1e6, p99: loop.percentile(99) / 1e6, max: loop.max / 1e6, mean: loop.mean / 1e6, rss: process.memoryUsage().rss });
    } else if (message.cmd === "close") {
      await app.close();
      process.send({ cmd: "closed" });
      process.exit(0);
    }
  });
} else {
  await main();
}

function startServer(dataDir, now) {
  const child = fork(SELF, [], { env: { ...process.env, OLCEK_SUNUCU: JSON.stringify({ dataDir, now }) }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  const waiters = new Map();
  child.on("message", message => {
    const list = waiters.get(message.cmd) || [];
    const next = list.shift();
    if (next) next(message);
  });
  const ask = (cmd, payload = {}) => new Promise(resolve => {
    const reply = cmd === "close" ? "closed" : cmd;
    waiters.set(reply, [...(waiters.get(reply) || []), resolve]);
    child.send({ cmd, ...payload });
  });
  return new Promise((resolve, reject) => {
    waiters.set("ready", [message => resolve({ child, port: message.port, ask, base: `http://127.0.0.1:${message.port}` })]);
    child.once("exit", code => reject(new Error(`sunucu süreci çıktı (${code})`)));
  });
}

// Programın hesap bakiyeleri (motor koşu sonunda bunları kendi bankNet modeliyle karşılaştırdı: uyuşmazlık 0 → bağımsız doğrulanmış).
async function bankBalances(api) {
  const accounts = unwrap(await api.get("/api/workspace/bank/accounts?status=all")).accounts || [];
  return Object.fromEntries(accounts.map(account => [account.id, Number(account.balanceMinor)]));
}
// Doldurma: gerçek API (8 eşzamanlı istek), tarihler son 360 güne yayılır. Karışım: cari tahsilat nakit / havale (hesaplı), cari ödeme nakit,
// Banka Fişi masraf, bankalar arası transfer. Yalnız 200 dönen yazım deftere girer; ret (eksi bakiye vb.) sayılır.
async function fill(code, api, file, target, accountCount) {
  const started = performance.now();
  const today = unwrap(await api.get("/api/workspace/ledger/lock")).today;
  const addDays = (iso, days) => {
    const [y, m, d] = iso.split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + days));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  };
  const from = addDays(today, -360);
  const L = { cash: 0, bank: 0, accounts: {}, writes: {}, rejected: {} };
  // Binlerce cari (açılış tarihi 360 gün önce; eski tarihli hareket kronolojiye takılmasın).
  const created = [];
  for (let i = 0; i < accountCount; i += 1) {
    const response = await api.post("/api/workspace/accounts", { name: `Ölçek Carisi ${code}-${String(i + 1).padStart(5, "0")} ${["Ticaret", "Ltd. Şti.", "A.Ş.", "Gıda", "İnşaat"][i % 5]}`, type: i % 7 === 0 ? "supplier" : "customer", registeredOn: from, phone: `0532${String(1000000 + i).slice(-7)}` });
    if (response.status !== 200) throw new Error(`${code} cari ${i}: ${response.status} ${JSON.stringify(response.data).slice(0, 200)}`);
    created.push(unwrap(response).id);
  }
  const banks = (unwrap(await api.get("/api/workspace/bank/accounts?status=all")).accounts || []).filter(bank => bank.kind === "demand" && bank.status === "active");
  if (banks.length < 2) throw new Error(`${code}: doldurma için iki vadesiz hesap yok`);
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const book = (kind, cents, bankId = "") => {
    if (kind === "cash") L.cash += cents;
    else {
      L.bank += cents;
      L.accounts[bankId] = (L.accounts[bankId] || 0) + cents;
    }
  };
  const one = async () => {
    const date = addDays(from, rand(1, 360));
    const roll = Math.random();
    let kind = "";
    let response;
    let effect = () => {};
    if (roll < 0.30) {
      kind = "cari tahsilat nakit";
      const amount = rand(1000, 80000);
      effect = () => book("cash", amount);
      response = await api.post(`/api/workspace/accounts/${pick(created)}/entries`, { kind: "in", amount: amountText(amount), method: "cash", date, note: "Doldurma" });
    } else if (roll < 0.62) {
      kind = "cari tahsilat havale";
      const amount = rand(5000, 300000);
      const bank = pick(banks);
      effect = () => book("bank", amount, bank.id);
      response = await api.post(`/api/workspace/accounts/${pick(created)}/entries`, { kind: "in", amount: amountText(amount), method: "bank", bankAccountId: bank.id, date, note: "Doldurma", similarOk: true });
    } else if (roll < 0.72) {
      kind = "cari ödeme nakit";
      const amount = rand(100, 2000);
      effect = () => book("cash", -amount);
      response = await api.post(`/api/workspace/accounts/${pick(created)}/entries`, { kind: "out", amount: amountText(amount), method: "cash", date, note: "Doldurma" });
    } else if (roll < 0.84) {
      kind = "banka masrafı";
      const amount = rand(500, 4000);
      const bank = pick(banks);
      effect = () => book("bank", -amount, bank.id);
      response = await api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: bank.id, date, amount: amountText(amount), feeType: pick(["eft", "havale"]), tax: "bsmv_incl", description: "Doldurma", similarOk: true });
    } else {
      kind = "bankalar arası transfer";
      const amount = rand(1000, 50000);
      const [a, b] = Math.random() < 0.5 ? [banks[0], banks[1]] : [banks[1], banks[0]];
      effect = () => {
        book("bank", -amount, a.id);
        book("bank", amount, b.id);
      };
      response = await api.post("/api/workspace/bank/transfers", { accountId: a.id, toAccountId: b.id, amount: amountText(amount), date, description: "Doldurma", similarOk: true });
    }
    if (response.status === 200) {
      effect();
      L.writes[kind] = (L.writes[kind] || 0) + 1;
    } else {
      const key = `${kind} ${response.status} ${response.data?.code || ""}`.trim();
      L.rejected[key] = (L.rejected[key] || 0) + 1;
      if (response.status >= 500) throw new Error(`${code} doldurma 5xx: ${JSON.stringify(response.data).slice(0, 300)}`);
    }
  };
  let rows = (await countMoney(file)).money;
  let total = 0;
  while (rows < target) {
    const batch = Math.min(4000, Math.max(200, Math.ceil((target - rows) / 1.1)));
    for (let i = 0; i < batch; i += 8) await Promise.all(Array.from({ length: Math.min(8, batch - i) }, one));
    total += batch;
    rows = (await countMoney(file)).money;
    log(`  [${code}] doldurma: ${total} istek, para satırı ${rows.toLocaleString("tr-TR")} / ${target.toLocaleString("tr-TR")} (${Math.round((performance.now() - started) / 1000)} sn)`);
  }
  log(`[${code}] doldurma bitti: ${JSON.stringify(L.writes)} · ret ${JSON.stringify(L.rejected)} · ${Math.round((performance.now() - started) / 1000)} sn`);
  return { ...L, seconds: Math.round((performance.now() - started) / 1000), cariler: created.length };
}

// ======================================================================== VERİ ========================================================================
async function buildData() {
  const dir = path.join(DIR, "veri");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const motorNow = await motorNowOf();
  const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
  const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
  const { runReconciliation } = await import(pathToFileURL(path.join(ROOT, "test", "mutabakat", "motor.mjs")).href);
  // Motorun bir kısım havalesi eski sürüm gibi hesapsız (Hesabı Atanmamış) yazılır — gerçek göç verisinin görünümü (test:mutabakat ile aynı).
  const app = createApp(baseOptions(path.join(dir, "data"), { now: motorNow(), bankPickLegacy: true, integrityScan: false, analysisWorker: false }));
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  const info = { tarih: new Date().toISOString(), kod: ROOT, commit: "", companies: {} };
  try {
    const login = await client.login("admin", PASS);
    if (login.status !== 200) throw new Error(`giriş ${login.status}`);
    const scoped = companyId => {
      const at = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(companyId)}`;
      return { ...client, get: url => client.get(at(url)), post: (url, body) => client.post(at(url), body), put: (url, body) => client.put(at(url), body), del: url => client.del(at(url)), patch: (url, body) => client.patch(at(url), body) };
    };
    const run = async (code, api, seed, operations) => {
      const started = performance.now();
      const report = await runReconciliation({ client: api, seed, operations, verifyEvery: Math.max(1, Math.floor(operations / 4)), reportEvery: 0, burst: 40, span: 365, log: line => log(`  [${code}] ${line}`) });
      const seconds = (performance.now() - started) / 1000;
      log(`[${code}] motor: ${report.operations} işlem, ${report.checks} doğrulama, ${report.rejectedAsExpected} beklenen ret, ${seconds.toFixed(0)} sn; uyuşmazlık ${report.mismatches.length}`);
      if (report.mismatches.length) throw new Error(`[${code}] motor uyuşmazlığı (veri reddedildi): ${JSON.stringify(report.mismatches.slice(0, 3)).slice(0, 1500)}`);
      return { seed, operations: report.operations, checks: report.checks, rejectedAsExpected: report.rejectedAsExpected, seconds: Math.round(seconds), model: report.model, byKind: report.byKind, invoices: report.invoices };
    };
    info.companies["001"] = await run("001", client, 2101, OPS1);
    info.companies["001"].motorHesaplari = await bankBalances(client);
    const second = unwrap(await client.post("/api/companies", { name: "Ölçek İkinci Şirket" }));
    if (!second?.company?.id) throw new Error(`002 açılamadı: ${JSON.stringify(second).slice(0, 300)}`);
    info.companies["002"] = await run("002", scoped(second.company.id), 2102, OPS2);
    info.companies["002"].motorHesaplari = await bankBalances(scoped(second.company.id));
    // Doldurma: gerçek API, gerçekçi karışım, 12 aya yayılmış tarihler; doldurucunun kendi defteri (yalnız 200 dönenler).
    const files = Object.fromEntries(companyFiles(path.join(dir, "data")).map(company => [company.code, company.file]));
    info.companies["001"].doldurma = await fill("001", client, files["001"], FILL1, FILL_ACCOUNTS);
    info.companies["002"].doldurma = await fill("002", scoped(second.company.id), files["002"], FILL2, Math.round(FILL_ACCOUNTS / 5));
    // Personel (Muhasebe rolü, iki şirkette yetkili) ve ekran kullanıcıları.
    const ids = (unwrap(await client.get("/api/companies")).companies || []).map(company => company.id);
    for (const username of [...Array.from({ length: STAFF }, (_, i) => `olcek${String(i + 1).padStart(2, "0")}`), ...SCREEN_USERS]) {
      const created = await client.post("/api/admin/users", { username, name: `Ölçek ${username}`, role: "muhasebe", password: STAFF_PASS, mustChangePassword: false });
      if (created.status !== 200) throw new Error(`kullanıcı ${username}: ${created.status} ${JSON.stringify(created.data).slice(0, 200)}`);
      const user = unwrap(created);
      const access = await client.put(`/api/companies/access/${user.id || user.user?.id}`, { companies: ids });
      if (access.status !== 200) throw new Error(`şirket yetkisi ${username}: ${access.status} ${JSON.stringify(access.data).slice(0, 200)}`);
      // Kurulum Sihirbazı kişi ve şirket bazında bir kez önerilir; ofiste her personel bunu çoktan kapatmıştır (ölçüm sihirbazı değil, işi ölçer).
      const person = createClient(`http://127.0.0.1:${port}`);
      if ((await person.login(username, STAFF_PASS)).status !== 200) throw new Error(`${username} girişi`);
      for (const id of ids) {
        const dismissed = await person.post(`/api/workspace/bank/setup/dismiss?hofCompany=${encodeURIComponent(id)}`, {});
        if (dismissed.status !== 200) throw new Error(`sihirbaz ${username}: ${dismissed.status}`);
      }
    }
  } finally {
    await app.close();
  }
  for (const company of companyFiles(path.join(dir, "data"))) {
    const counts = await countMoney(company.file);
    info.companies[company.code] = { ...(info.companies[company.code] || {}), id: company.id, moneyRows: counts.money, moneyBy: counts.by, bytes: statSync(company.file).size };
    log(`[${company.code}] para satırı ${counts.money.toLocaleString("tr-TR")} (${JSON.stringify(counts.by)}), dosya ${(statSync(company.file).size / 1e6).toFixed(1)} MB`);
  }
  writeFileSync(path.join(dir, "hazir.json"), JSON.stringify(info, null, 2));
  return info;
}

// ======================================================================== YÜK ========================================================================
async function main() {
  mkdirSync(DIR, { recursive: true });
  let info = null;
  if (STAGE === "veri" || STAGE === "hepsi") {
    info = await buildData();
    // Veri denetimleri (kanıt aracı için sayılı): motor iki şirkette uyuşmazlıksız (yoksa buildData durur), hedef para satırı aşıldı.
    const checks = [
      ["001 motor bağımsız modelle uyuşmazlıksız", true],
      ["002 motor bağımsız modelle uyuşmazlıksız", true],
      [`001 para satırı ${info.companies["001"].moneyRows} ≥ ${FILL1}`, info.companies["001"].moneyRows >= FILL1],
      [`002 para satırı ${info.companies["002"].moneyRows} ≥ ${FILL2}`, info.companies["002"].moneyRows >= FILL2],
    ];
    for (const [name, ok] of checks) log(`${ok ? "✓" : "✗"} ${name}`);
    log(`${checks.filter(item => item[1]).length} denetim geçti, ${checks.filter(item => !item[1]).length} başarısız`);
    if (checks.some(item => !item[1])) process.exitCode = 1;
  }
  if (STAGE === "veri") return;
  info ||= JSON.parse(readFileSync(path.join(DIR, "veri", "hazir.json"), "utf8"));
  const out = { veri: info, duzeyler: [] };
  for (const users of LEVELS) {
    const result = await level(users, info);
    out.duzeyler.push(result);
    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  const failed = out.duzeyler.some(item => item.sonuc.hatalar.length);
  const total = out.duzeyler.reduce((sum, item) => sum + item.sonuc.denetim, 0);
  const bad = out.duzeyler.reduce((sum, item) => sum + item.sonuc.hatalar.length, 0);
  log(`\n${total - Math.min(total, bad)} denetim geçti, ${bad} başarısız`);
  log(`SONUÇ: ${failed ? "BAŞARISIZ" : "GEÇTİ"} — ${out.duzeyler.map(item => `${item.kullanici} kullanıcı: ${item.sonuc.hatalar.length ? item.sonuc.hatalar.join("; ") : "tamam"}`).join(" · ")}`);
  process.exitCode = failed ? 1 : 0;
}

async function level(users, info) {
  const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
  const motorNow = await motorNowOf();
  const work = path.join(DIR, `calisma-${users}`);
  rmSync(work, { recursive: true, force: true });
  cpSync(path.join(DIR, "veri"), work, { recursive: true });
  const dataDir = path.join(work, "data");
  const backupDir = path.join(work, "backups");
  log(`\n===== ${users} eşzamanlı kullanıcı · ${SECONDS} sn · ${WINDOWS} pencere =====`);
  const openAt = performance.now();
  const server = await startServer(dataDir, motorNow());
  const openMs = performance.now() - openAt;
  const BASE = server.base;
  const hatalar = [];
  const checks = [];
  // Her denetim sayılır (kanıt aracı: "n denetim geçti, m başarısız"); başarısızı hatalar listesine.
  const check = (ok, message) => {
    checks.push({ ok: Boolean(ok), message });
    if (!ok) hatalar.push(message);
  };
  const result = { kullanici: users, sure: SECONDS, pencere: WINDOWS, acilisMs: r0(openMs) };
  const admin = createClient(BASE);
  if ((await admin.login("admin", PASS)).status !== 200) throw new Error("yönetici girişi");
  const companies = unwrap(await admin.get("/api/companies")).companies;
  const C = Object.fromEntries(companies.map(company => [company.code, company]));
  const at = (url, companyId) => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(companyId)}`;
  const today = unwrap(await admin.get("/api/workspace/ledger/lock")).today;

  // ---------- Bağımsız "önce": motorun modeli (koşu sonunda programla kuruşu kuruşuna aynıydı) + programdan hesap kimlikleri ----------
  const cents = text => Math.round(Number(String(text).replace(/\./g, "").replace(",", ".")) * 100);
  const ctx = {};
  for (const code of ["001", "002"]) {
    const id = C[code].id;
    const model = info.companies[code].model;
    const banks = unwrap(await admin.get(at("/api/workspace/bank/accounts?status=all", id))).accounts;
    const trial = Object.fromEntries(unwrap(await admin.get(at("/api/workspace/ledger", id))).trial.accounts.map(row => [row.code, Math.round(row.balance * 100)]));
    const accounts = (unwrap(await admin.get(at("/api/workspace/accounts?status=all&limit=500", id))).accounts || []).filter(account => !account.deletedAt);
    const items = (unwrap(await admin.get(at("/api/workspace/stock?limit=200", id))).items || []).filter(item => item.kind === "product" && !item.deletedAt);
    const demand = banks.filter(bank => bank.kind === "demand" && bank.status === "active");
    ctx[code] = {
      id,
      // Bağımsız önce: motor modeli (Kasa nakit = 100, havale = 102); hesap bakiyeleri motorun hesap denetiminden geçti (bankNet).
      // + doldurmanın kendi defteri. Hesap bakiyesi: motor sonundaki program bakiyesi (motor bankNet modeliyle doğruladı) + doldurma defteri.
      expect: {
        cash: cents(model.kasa.cash) + (info.companies[code].doldurma?.cash || 0),
        bank: cents(model.kasa.bank) + (info.companies[code].doldurma?.bank || 0),
        accounts: Object.fromEntries(banks.map(bank => [bank.id, (info.companies[code].motorHesaplari?.[bank.id] ?? 0) + (info.companies[code].doldurma?.accounts?.[bank.id] || 0)])),
      },
      programBefore: { gl100: trial["100"] ?? 0, gl102: trial["102"] ?? 0 },
      accounts,
      items,
      demand,
    };
    check(!(ctx[code].programBefore.gl100 !== ctx[code].expect.cash || ctx[code].programBefore.gl102 !== ctx[code].expect.bank), `${code} önce: program 100=${tl(ctx[code].programBefore.gl100)} 102=${tl(ctx[code].programBefore.gl102)} ≠ motor modeli ${tl(ctx[code].expect.cash)} / ${tl(ctx[code].expect.bank)}`);
    if (demand.length < 2 || !accounts.length || !items.length) throw new Error(`${code}: yük için veri eksik (hesap ${demand.length}, cari ${accounts.length}, ürün ${items.length})`);
  }
  result.once = Object.fromEntries(Object.entries(ctx).map(([code, c]) => [code, { kasa: tl(c.expect.cash), banka102: tl(c.expect.bank), hesaplar: c.demand.map(bank => `${bank.bankName} ${tl(c.expect.accounts[bank.id])}`) }]));
  const moneyBefore = {};
  for (const company of companyFiles(dataDir)) moneyBefore[company.code] = (await countMoney(company.file)).money;

  // ---------- Bağımsız defter: yalnız 200 dönen yazımlar ----------
  const ledger = { "001": { cash: 0, bank: 0, accounts: {} }, "002": { cash: 0, bank: 0, accounts: {} } };
  const book = (code, kind, centsValue, accountId = "") => {
    const L = ledger[code];
    if (kind === "cash") L.cash += centsValue;
    if (kind === "bank") {
      L.bank += centsValue;
      L.accounts[accountId] = (L.accounts[accountId] || 0) + centsValue;
    }
  };
  const marker = `OLCEK-${users}-${Date.now().toString(36)}`;
  const samples = [];
  const statuses = {};
  const EXPECTED_409 = new Set(["cash-negative", "cash-blocked", "bank-negative", "bank-blocked", "bank-similar", "stock-negative", "similar"]);
  let stop = false;
  let backupWindow = null;
  const record = (kind, ms, response, startedAt, companyOf = "") => {
    const code = response?.data?.code || response?.data?.data?.code || "";
    const key = response ? `${response.status}${response.status === 200 ? "" : ` ${code || "—"}`}` : "ağ hatası";
    statuses[kind] ||= {};
    statuses[kind][key] = (statuses[kind][key] || 0) + 1;
    samples.push({ kind, ms, status: response?.status ?? 0, code, company: companyOf, startedAt, inBackup: Boolean(backupWindow && startedAt >= backupWindow.from && startedAt <= (backupWindow.to ?? Infinity)) });
  };
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];

  // Rapor uçları: katalogdan, bugün 200 dönenler.
  const reportIds = [];
  const probe = createClient(BASE);
  await probe.login("olcek01", STAFF_PASS);
  result.raporDisi = {};
  for (const id of ["banka-bakiye", "banka-hareket", "banka-pos-hareketleri", "banka-masraf", "kasa-hareketleri", "cari-mizan"]) {
    const response = await probe.get(at(`/api/workspace/report-center/${id}?from=${today.slice(0, 4)}-01-01&to=${today}`, C["001"].id));
    if (response.status === 200) reportIds.push(id);
    else result.raporDisi[id] = `${response.status} ${String(response.data?.error || "").slice(0, 120)}`;
  }
  result.raporlar = reportIds;
  log(`raporlar (Muhasebe rolüyle 200): ${reportIds.join(", ")} · dışında: ${JSON.stringify(result.raporDisi)}`);

  async function worker(index) {
    const client = createClient(BASE);
    const username = `olcek${String(index + 1).padStart(2, "0")}`;
    const login = await client.login(username, STAFF_PASS);
    if (login.status !== 200) throw new Error(`${username} girişi ${login.status}`);
    while (!stop) {
      const code = Math.random() < 0.8 ? "001" : "002";
      const c = ctx[code];
      const id = c.id;
      const roll = Math.random();
      const startedAt = performance.now();
      let kind = "";
      let response = null;
      let effect = null;
      try {
        if (roll < 0.14) {
          kind = "Cari tahsilat (nakit)";
          const amount = rand(1000, 50000);
          effect = () => book(code, "cash", amount);
          response = await client.post(at(`/api/workspace/accounts/${pick(c.accounts).id}/entries`, id), { kind: "in", amount: amountText(amount), method: "cash", date: today, note: marker, requestId: randomUUID() });
        } else if (roll < 0.26) {
          kind = "Cari tahsilat (havale)";
          const amount = rand(5000, 200000);
          const bank = pick(c.demand);
          effect = () => book(code, "bank", amount, bank.id);
          response = await client.post(at(`/api/workspace/accounts/${pick(c.accounts).id}/entries`, id), { kind: "in", amount: amountText(amount), method: "bank", bankAccountId: bank.id, date: today, note: marker, requestId: randomUUID(), similarOk: true });
        } else if (roll < 0.33) {
          kind = "Cari ödeme (nakit)";
          const amount = rand(100, 3000);
          effect = () => book(code, "cash", -amount);
          response = await client.post(at(`/api/workspace/accounts/${pick(c.accounts).id}/entries`, id), { kind: "out", amount: amountText(amount), method: "cash", date: today, note: marker, requestId: randomUUID() });
        } else if (roll < 0.43) {
          kind = "Satış faturası (peşin nakit)";
          const price = rand(1, 40) * 5;
          const total = price * 120;
          effect = () => book(code, "cash", total);
          response = await client.post(at("/api/workspace/invoices", id), { kind: "sale", accountId: pick(c.accounts).id, issueDate: today, note: marker, lines: [{ itemId: pick(c.items).id, name: "", qty: 1, unitPrice: price, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: total / 100, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true, requestId: randomUUID() });
        } else if (roll < 0.50) {
          kind = "Banka Fişi (masraf)";
          const amount = rand(500, 5000);
          const bank = pick(c.demand);
          effect = () => book(code, "bank", -amount, bank.id);
          response = await client.post(at("/api/workspace/bank/vouchers", id), { type: "fee", accountId: bank.id, date: today, amount: amountText(amount), feeType: "eft", tax: "bsmv_incl", description: marker, similarOk: true, requestId: randomUUID() });
        } else if (roll < 0.56) {
          kind = "Bankalar arası transfer";
          const amount = rand(1000, 100000);
          const [from, to] = Math.random() < 0.5 ? [c.demand[0], c.demand[1]] : [c.demand[1], c.demand[0]];
          effect = () => {
            book(code, "bank", -amount, from.id);
            book(code, "bank", amount, to.id);
          };
          response = await client.post(at("/api/workspace/bank/transfers", id), { accountId: from.id, toAccountId: to.id, amount: amountText(amount), date: today, description: marker, similarOk: true, requestId: randomUUID() });
        } else if (roll < 0.72) {
          kind = "Rapor açma";
          const report = pick(reportIds);
          response = await client.get(at(`/api/workspace/report-center/${report}?from=${today.slice(0, 4)}-01-01&to=${today}`, id));
        } else if (roll < 0.88) {
          kind = "Cari arama";
          const name = pick(c.accounts).name || "a";
          response = await client.get(at(`/api/workspace/accounts/search?q=${encodeURIComponent(name.slice(0, rand(2, 5)))}`, id));
        } else {
          kind = "Banka Hareketleri listesi";
          response = await client.get(at(`/api/workspace/bank/movements?limit=50${Math.random() < 0.5 ? `&account=${pick(c.demand).id}` : ""}`, id));
        }
      } catch (error) {
        response = null;
        record(kind || "?", performance.now() - startedAt, null, startedAt, code);
        await sleep(rand(THINK[0], THINK[1]));
        continue;
      }
      const ms = performance.now() - startedAt;
      record(kind, ms, response, startedAt, code);
      if (response.status === 200 && effect) effect();
      await sleep(rand(THINK[0], THINK[1]));
    }
  }

  // ---------- Tarayıcı pencereleri ----------
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const MODAL = ".hof-modal-backdrop.is-visible";
  const bankWin = ".hof-bank-modal";
  const screen = { cari: [], banka: [], rapor: [], bellek: {}, donma: {}, hatalar: [] };
  const openPage = async username => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", acceptDownloads: true });
    const page = await context.newPage();
    page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", error => screen.hatalar.push(`${username}: ${String(error.message || error).slice(0, 200)}`));
    const t = performance.now();
    await page.goto(`${BASE}/?hofCompany=${C["001"].id}`);
    await page.fill("#hof-auth input[name=username]", username);
    await page.fill("#hof-auth input[name=password]", STAFF_PASS);
    await page.click('#hof-auth button[type="submit"]');
    await page.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 90000 });
    const loginMs = performance.now() - t;
    await page.evaluate(() => {
      window.__longTasks = 0;
      window.__longest = 0;
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__longTasks += entry.duration;
        window.__longest = Math.max(window.__longest, entry.duration);
      })).observe({ type: "longtask", buffered: false });
    });
    return { page, loginMs };
  };
  // JS belleği: CDP Performance.getMetrics (performance.memory başlıksız Chromium'da kaba nicelenir).
  const cdps = new Map();
  const heap = async page => {
    try {
      if (!cdps.has(page)) {
        const session = await page.context().newCDPSession(page);
        await session.send("Performance.enable");
        cdps.set(page, session);
      }
      const { metrics } = await cdps.get(page).send("Performance.getMetrics");
      const get = name => metrics.find(item => item.name === name)?.value ?? 0;
      return { jsHeapMB: +(get("JSHeapUsedSize") / 1e6).toFixed(1), nodes: get("Nodes"), listeners: get("JSEventListeners") };
    } catch {
      return null;
    }
  };
  const closeTop = async page => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  };
  const answerConfirms = async page => {
    for (let i = 0; i < 3; i += 1) {
      const yes = await page.waitForSelector(`${MODAL}:last-of-type [data-answer="yes"]`, { timeout: 1200 }).catch(() => null);
      if (!yes) return;
      await yes.click().catch(() => null);
    }
  };
  // Tıklama: öğe yeniden çizildiği için "kararsız/ayrıldı" olursa 5 sn'lik denemelerle en çok 6 kez; deneme sayısı kaydedilir (ekranın
  // yük altında yeniden çizilmesi kullanıcıya da tıklanamayan düğme olarak yansır).
  const unstable = {};
  const clickRetry = async (page, selector, label) => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        await page.locator(selector).first().click({ timeout: 5000 });
        if (attempt > 1) unstable[label] = (unstable[label] || 0) + attempt - 1;
        return;
      } catch (error) {
        if (attempt === 6) throw error;
      }
    }
  };
  const windows = [];
  for (let i = 0; i < Math.min(WINDOWS, SCREEN_USERS.length); i += 1) windows.push({ user: SCREEN_USERS[i], ...(await openPage(SCREEN_USERS[i])) });
  result.ekranGiris = windows.map(item => r0(item.loginMs));

  // Pencere 1: Cari penceresi, arama.
  const cariLoop = async page => {
    const input = `${MODAL} input[data-filter=q]`;
    const t = performance.now();
    await clickRetry(page, "#hof-sidecard [data-action=accounts]", "Cari menüsü");
    await page.waitForSelector(`${MODAL} tr[data-account]`, { timeout: 60000 });
    screen.cariAcilisMs = r0(performance.now() - t);
    const names = ctx["001"].accounts.map(account => account.name).filter(name => name && name.length >= 4);
    while (!stop) {
      const target = pick(names);
      const term = target.slice(0, 4);
      try {
        await page.locator(input).click({ timeout: 10000 });
        await page.fill(input, "");
        await page.waitForTimeout(400);
        const lags = [];
        for (const ch of term) {
          await page.evaluate(sel => {
            window.__k = performance.now();
            window.__len = (document.querySelector(sel)?.value || "").length;
          }, input);
          await page.keyboard.type(ch, { delay: 0 });
          lags.push(await page.evaluate(async sel => {
            const t0 = window.__k;
            while (performance.now() - t0 < 30000) {
              if ((document.querySelector(sel)?.value || "").length > window.__len) return Math.round(performance.now() - t0);
              await new Promise(r => setTimeout(r, 5));
            }
            return -1;
          }, input));
          await page.waitForTimeout(120);
        }
        const searchMs = await page.evaluate(async ({ modal, start, needle }) => {
          while (performance.now() - start < 30000) {
            const rows = [...document.querySelectorAll(`${modal} tr[data-account]`)];
            if (rows.length && rows.every(row => row.textContent.toLocaleLowerCase("tr-TR").includes(needle))) return Math.round(performance.now() - start);
            await new Promise(r => setTimeout(r, 10));
          }
          return -1;
        }, { modal: MODAL, start: await page.evaluate(() => window.__k), needle: term.toLocaleLowerCase("tr-TR") });
        screen.cari.push({ term, lags, searchMs, inBackup: Boolean(backupWindow && backupWindow.to === null) });
      } catch (error) {
        screen.hatalar.push(`cari: ${String(error.message || error).split("\n")[0].slice(0, 200)}`);
        for (let i = 0; i < 4 && (await page.$(MODAL)); i += 1) await closeTop(page);
        await page.click("#hof-sidecard [data-action=accounts]").catch(() => null);
        await page.waitForSelector(`${MODAL} tr[data-account]`, { timeout: 60000 }).catch(() => null);
      }
      await page.waitForTimeout(2500);
    }
  };
  // Pencere 2: Banka → Hareketler; süzgeç, Daha Fazla, ekrandan + Masraf → listede, başkasının kaydı listede.
  const bankaLoop = async page => {
    const rowsSel = `${bankWin} .hof-bank-moves tbody tr[data-event]`;
    let t = performance.now();
    await clickRetry(page, '#hof-sidecard [data-action="bank"]', "Banka menüsü");
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
    screen.bankaAcilisMs = r0(performance.now() - t);
    t = performance.now();
    await clickRetry(page, `${bankWin} .hof-bank-tabs [data-tab="movements"]`, "Hareketler sekmesi");
    await page.waitForSelector(rowsSel, { timeout: 60000 });
    screen.hareketlerIlkMs = r0(performance.now() - t);
    const demand = ctx["001"].demand;
    let n = 0;
    while (!stop) {
      n += 1;
      const item = { n, inBackup: Boolean(backupWindow && backupWindow.to === null) };
      try {
        // Hesap süzgeci
        const account = n % 3 === 0 ? "" : demand[n % 2].id;
        t = performance.now();
        await page.selectOption(`${bankWin} [data-mv="account"]`, account);
        await page.waitForFunction(id => {
          const rows = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
          return rows.length > 0 && (document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account || "") === id;
        }, account, { timeout: 30000 });
        item.suzgecMs = r0(performance.now() - t);
        // Kaydırma + Daha Fazla
        const more = await page.$(`${bankWin} [data-act="mv-more"]`);
        if (more) {
          const before = await page.$$eval(rowsSel, list => list.length);
          t = performance.now();
          await clickRetry(page, `${bankWin} [data-act="mv-more"]`, "Daha Fazla Göster");
          await page.waitForFunction(count => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length > count, before, { timeout: 30000 });
          item.dahaFazlaMs = r0(performance.now() - t);
        }
        // Ekrandan + Masraf → Kaydet → listede görünme (hesap süzgeci Tüm Hesaplar).
        if (n % 2 === 1) {
          await page.selectOption(`${bankWin} [data-mv="account"]`, "");
          await page.waitForTimeout(400);
          const own = `${marker}-E${n}`;
          const amount = rand(500, 3000);
          await clickRetry(page, `${bankWin} [data-act="v-fee"]`, "+ Masraf");
          await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 15000 });
          const bank = demand[n % 2];
          await page.selectOption('form.hof-bank-voucher [name="accountId"]', bank.id).catch(() => null);
          await page.selectOption('form.hof-bank-voucher [name="feeType"]', "eft").catch(() => null);
          await page.fill('form.hof-bank-voucher [name="amount"]', amountText(amount));
          await page.fill('form.hof-bank-voucher [name="description"]', own);
          t = performance.now();
          await page.click('form.hof-bank-voucher button[type="submit"]');
          await answerConfirms(page);
          const seen = await page.waitForFunction(needle => [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].some(row => row.textContent.includes(needle)), own, { timeout: 30000 }).then(() => true).catch(() => false);
          item.kaydetListedeMs = seen ? r0(performance.now() - t) : -1;
          item.kaydetHesap = bank.id;
          item.kaydetTutar = amount;
          item.kaydetIz = own;
          if (await page.$("form.hof-bank-voucher")) await closeTop(page);
        } else {
          // Başka personelin (API) kaydı açık listede görünme süresi.
          await page.selectOption(`${bankWin} [data-mv="account"]`, "");
          await page.waitForTimeout(400);
          const other = `${marker}-B${n}`;
          const amount = rand(500, 3000);
          const bank = demand[(n + 1) % 2];
          const posted = performance.now();
          const response = await admin.post(at("/api/workspace/bank/vouchers", ctx["001"].id), { type: "fee", accountId: bank.id, date: today, amount: amountText(amount), feeType: "eft", tax: "bsmv_incl", description: other, similarOk: true, requestId: randomUUID() });
          const apiMs = performance.now() - posted;
          item.baskasininDurum = response.status;
          if (response.status === 200) book("001", "bank", -amount, bank.id);
          else screen.hatalar.push(`başkasının masrafı ${response.status} ${JSON.stringify(response.data).slice(0, 160)}`);
          const seen = await page.waitForFunction(needle => [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].some(row => row.textContent.includes(needle)), other, { timeout: 30000 }).then(() => true).catch(() => false);
          item.baskasininKaydiMs = seen ? r0(performance.now() - posted) : -1;
          item.baskasininApiMs = r0(apiMs);
        }
      } catch (error) {
        item.hata = String(error.message || error).split("\n")[0].slice(0, 200);
        screen.hatalar.push(`banka: ${item.hata}`);
        for (let i = 0; i < 4 && (await page.$("form.hof-bank-voucher")); i += 1) await closeTop(page);
      }
      screen.banka.push(item);
      await page.waitForTimeout(2000);
    }
  };
  // Pencere 3: Raporlar → Banka Bakiye Raporu ön izleme + PDF + Excel.
  const raporLoop = async page => {
    let n = 0;
    while (!stop) {
      n += 1;
      const item = { n, inBackup: Boolean(backupWindow && backupWindow.to === null) };
      try {
        for (let i = 0; i < 4 && (await page.$(MODAL)); i += 1) await closeTop(page);
        let t = performance.now();
        await clickRetry(page, '#hof-sidecard [data-action="analytics"]', "Raporlar menüsü");
        await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`, { timeout: 60000 });
        await clickRetry(page, `${MODAL} .hof-rep-tab[data-tab="all"]`, "Tüm Raporlar");
        await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="banka-bakiye"]`, { timeout: 60000 });
        item.raporlarAcilisMs = r0(performance.now() - t);
        t = performance.now();
        await clickRetry(page, `${MODAL} [data-rc-list] [data-report="banka-bakiye"]`, "Banka Bakiye Raporu");
        await page.waitForFunction(modal => {
          const main = document.querySelector(`${modal} [data-rc-main]`);
          return main && main.querySelector("tbody tr") && main.querySelector("tfoot tr") && main.querySelectorAll(".hof-rep-out").length >= 2;
        }, MODAL, { timeout: 60000 });
        item.onIzlemeMs = r0(performance.now() - t);
        const links = await page.$$eval(`${MODAL} [data-rc-main] .hof-rep-out`, list => list.map(link => link.getAttribute("href")));
        for (const [label, href] of [["pdf", links.find(link => link.includes("/pdf"))], ["excel", links.find(link => link.includes("/xlsx"))]]) {
          if (!href) continue;
          const got = await page.evaluate(async url => {
            const t0 = performance.now();
            const response = await fetch(window.HOF?.apiUrl ? window.HOF.apiUrl(url) : url);
            const size = (await response.arrayBuffer()).byteLength;
            return { status: response.status, size, ms: Math.round(performance.now() - t0) };
          }, href);
          item[`${label}Ms`] = got.ms;
          item[`${label}Durum`] = got.status;
          item[`${label}Bayt`] = got.size;
        }
      } catch (error) {
        item.hata = String(error.message || error).split("\n")[0].slice(0, 200);
        screen.hatalar.push(`rapor: ${item.hata}`);
      }
      screen.rapor.push(item);
      await page.waitForTimeout(3000);
    }
  };

  // ---------- Koşu ----------
  for (const w of windows) screen.bellek[w.user] = { bas: await heap(w.page) };
  await server.ask("loop-reset");
  const t0 = performance.now();
  const loops = [];
  if (windows[0]) loops.push(cariLoop(windows[0].page).catch(error => screen.hatalar.push(`cari döngüsü: ${error.message}`)));
  if (windows[1]) loops.push(bankaLoop(windows[1].page).catch(error => screen.hatalar.push(`banka döngüsü: ${error.message}`)));
  if (windows[2]) loops.push(raporLoop(windows[2].page).catch(error => screen.hatalar.push(`rapor döngüsü: ${error.message}`)));
  const workers = Array.from({ length: users }, (_, i) => worker(i).catch(error => hatalar.push(`personel ${i + 1}: ${error.message}`)));
  const backups = [];
  const backupTask = (async () => {
    await sleep(SECONDS * 300);
    if (stop) return;
    // Otomatik yedek: zamanlayıcının bir turu (bütün şirketler; sunucu sürecinde, eşzamanlı).
    backupWindow = { from: performance.now(), to: null, kind: "otomatik" };
    const auto = await server.ask("auto-backup");
    backupWindow.to = performance.now();
    backups.push({ tur: "otomatik (zamanlayıcı turu)", ms: r0(auto.ms), hata: auto.error, dosyalar: auto.results, pencere: { ...backupWindow } });
    await sleep(SECONDS * 350);
    if (stop) return;
    backupWindow = { from: performance.now(), to: null, kind: "elle" };
    const manualAt = performance.now();
    const response = await admin.post("/api/admin/backups", { scope: "all" });
    backupWindow.to = performance.now();
    const data = unwrap(response);
    backups.push({ tur: "elle (Şimdi Yedek Al — Tüm Şirketler)", ms: r0(performance.now() - manualAt), durum: response.status, hata: response.status === 200 ? "" : JSON.stringify(response.data).slice(0, 300), dosyalar: (data?.backups || []).map(item => ({ name: item.name, path: path.join(item.folder || "", item.name), size: item.size })), pencere: { ...backupWindow } });
  })();
  await sleep(SECONDS * 1000);
  stop = true;
  await Promise.all(workers);
  await backupTask;
  await Promise.all(loops);
  const elapsed = (performance.now() - t0) / 1000;
  const loop = await server.ask("loop");
  for (const w of windows) {
    screen.bellek[w.user].son = await heap(w.page);
    screen.donma[w.user] = await w.page.evaluate(() => ({ toplamMs: Math.round(window.__longTasks || 0), enUzunMs: Math.round(window.__longest || 0) })).catch(() => null);
  }
  await browser.close();
  // Ekrandan yazılan masraflar: bağımsız deftere (listede göründüyse kaydedilmiştir; görünmeyenler veri tabanından denetlenir).
  for (const item of screen.banka.filter(row => row.kaydetIz)) {
    const found = unwrap(await admin.get(at(`/api/workspace/bank/movements?status=all&limit=5&q=${encodeURIComponent(item.kaydetIz)}`, ctx["001"].id)));
    const rows = (found?.rows || []).filter(row => JSON.stringify(row).includes(item.kaydetIz));
    item.veritabaninda = rows.length;
    if (rows.length === 1) book("001", "bank", -item.kaydetTutar, item.kaydetHesap);
    else if (rows.length > 1) hatalar.push(`ekrandan masraf ${item.kaydetIz} veritabanında ${rows.length} kez (çift kayıt)`);
    if (item.kaydetListedeMs === -1 && rows.length === 1) screen.hatalar.push(`ekrandan masraf ${item.kaydetIz} kaydedildi ama 30 sn'de listede görünmedi`);
  }

  // ---------- Yedek bütünlüğü ----------
  for (const backup of backups) {
    for (const file of backup.dosyalar || []) {
      const full = path.isAbsolute(file.path) ? file.path : findBackup(backupDir, file.name);
      try {
        const db = new DatabaseSync(full, { readOnly: true });
        try {
          file.integrity = db.prepare("PRAGMA integrity_check").all().map(row => Object.values(row)[0]).join(",");
        } finally {
          db.close();
        }
        file.paraSatiri = (await countMoney(full)).money;
        file.klasor = path.basename(path.dirname(full));
      } catch (error) {
        file.integrity = `açılamadı: ${error.message}`;
      }
      check(!(file.integrity !== "ok"), `yedek ${file.name} integrity_check: ${file.integrity}`);
    }
    check(!(backup.hata), `${backup.tur}: ${backup.hata}`);
    check(!(!(backup.dosyalar || []).length), `${backup.tur}: dosya yok`);
  }

  // ---------- Sonra: Mutabakat Testi + bağımsız toplamlar ----------
  const after = {};
  for (const code of ["001", "002"]) {
    const c = ctx[code];
    const integrityAt = performance.now();
    const integrity = unwrap(await admin.get(at("/api/workspace/ledger/integrity", c.id)));
    const integrityMs = performance.now() - integrityAt;
    const trial = Object.fromEntries(unwrap(await admin.get(at("/api/workspace/ledger", c.id))).trial.accounts.map(row => [row.code, Math.round(row.balance * 100)]));
    const banks = unwrap(await admin.get(at("/api/workspace/bank/accounts?status=all", c.id))).accounts;
    const L = ledger[code];
    const want = { cash: c.expect.cash + L.cash, bank: c.expect.bank + L.bank };
    const got = { cash: trial["100"] ?? 0, bank: trial["102"] ?? 0 };
    const accountRows = banks.filter(bank => bank.kind === "demand").map(bank => ({ hesap: `${bank.bankName} · ${bank.name}`, program: Number(bank.balanceMinor), bagimsiz: (c.expect.accounts[bank.id] ?? 0) + (L.accounts[bank.id] || 0) }));
    after[code] = {
      mutabakatTesti: integrity?.ok === true ? "TAMAM" : `SORUN: ${JSON.stringify(integrity?.failures || integrity).slice(0, 400)}`,
      mutabakatTestiMs: r0(integrityMs),
      kasa: { program: tl(got.cash), bagimsiz: tl(want.cash), fark: tl(got.cash - want.cash) },
      banka102: { program: tl(got.bank), bagimsiz: tl(want.bank), fark: tl(got.bank - want.bank) },
      hesaplar: accountRows.map(row => ({ ...row, program: tl(row.program), bagimsiz: tl(row.bagimsiz), fark: tl(row.program - row.bagimsiz) })),
      yukDefteri: { kasa: tl(L.cash), banka: tl(L.bank) },
    };
    check(!(integrity?.ok !== true), `${code} Mutabakat Testi: ${after[code].mutabakatTesti}`);
    check(!(got.cash !== want.cash), `${code} Kasa (100): program ${tl(got.cash)} ≠ bağımsız ${tl(want.cash)}`);
    check(!(got.bank !== want.bank), `${code} Banka (102): program ${tl(got.bank)} ≠ bağımsız ${tl(want.bank)}`);
    for (const row of accountRows) check(row.program === row.bagimsiz, `${code} ${row.hesap}: program ${tl(row.program)} ≠ bağımsız ${tl(row.bagimsiz)}`);
  }
  await server.ask("close");
  const moneyAfter = {};
  for (const company of companyFiles(dataDir)) moneyAfter[company.code] = (await countMoney(company.file)).money;
  // İzli (marker) yazımların veri tabanındaki sayısı = yük üreticisinin 200 saydığı yazımlar (kayıp/çift kayıt yok).
  const marks = {};
  for (const company of companyFiles(dataDir)) {
    const db = new DatabaseSync(company.file, { readOnly: true });
    try {
      const columns = table => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
      const live = table => (columns(table).has("deleted_at") ? " AND deleted_at IS NULL" : "");
      marks[company.code] = {
        cariHareketi: db.prepare(`SELECT COUNT(*) AS n FROM account_entries WHERE note = ?${live("account_entries")}`).get(marker).n,
        fatura: db.prepare(`SELECT COUNT(*) AS n FROM invoices WHERE note = ? AND status = 'issued'${live("invoices")}`).get(marker).n,
        bankaOlayi: db.prepare("SELECT COUNT(*) AS n FROM fin_events WHERE description LIKE ? AND status = 'active'").get(`${marker}%`).n,
      };
    } catch (error) {
      marks[company.code] = { hata: error.message };
    } finally {
      db.close();
    }
  }
  // İzli kayıt ↔ yük üreticisinin 200 saydığı yazımlar (kayıp ya da çift kayıt yok).
  const okOf = (code, list) => samples.filter(sample => list.includes(sample.kind) && sample.status === 200 && sample.company === code).length;
  for (const code of ["001", "002"]) {
    const m = marks[code] || {};
    const want = {
      cariHareketi: okOf(code, ["Cari tahsilat (nakit)", "Cari tahsilat (havale)", "Cari ödeme (nakit)"]),
      fatura: okOf(code, ["Satış faturası (peşin nakit)"]),
      bankaOlayi: okOf(code, ["Banka Fişi (masraf)", "Bankalar arası transfer"]) + (code === "001" ? screen.banka.filter(item => item.veritabaninda === 1).length + screen.banka.filter(item => item.baskasininDurum === 200).length : 0),
    };
    m.beklenen = want;
    for (const key of Object.keys(want)) check(m[key] === want[key], `${code} izli ${key}: veri tabanında ${m[key]} ≠ 200 dönen ${want[key]}`);
  }

  // ---------- Özet ----------
  const kinds = [...new Set(samples.map(sample => sample.kind))];
  const table = kinds.map(kind => {
    const list = samples.filter(sample => sample.kind === kind);
    const ok = list.filter(sample => sample.status === 200).map(sample => sample.ms);
    return { tur: kind, adet: list.length, p50: r0(pct(ok, 50)), p95: r0(pct(ok, 95)), enCok: r0(Math.max(0, ...ok)), durum: statuses[kind] };
  });
  const all = samples.filter(sample => sample.status === 200).map(sample => sample.ms);
  const inBackup = samples.filter(sample => sample.inBackup && sample.status === 200).map(sample => sample.ms);
  const outBackup = samples.filter(sample => !sample.inBackup && sample.status === 200).map(sample => sample.ms);
  const unexpected = samples.filter(sample => sample.status !== 200 && !(sample.status === 409 && EXPECTED_409.has(sample.code)));
  const expected409 = samples.filter(sample => sample.status === 409 && EXPECTED_409.has(sample.code));
  const writesOk = samples.filter(sample => sample.status === 200 && !["Rapor açma", "Cari arama", "Banka Hareketleri listesi"].includes(sample.kind)).length;
  result.sunucu = {
    istek: samples.length,
    istekSn: +(samples.length / elapsed).toFixed(1),
    yazimBasarili: writesOk,
    genel: { p50: r0(pct(all, 50)), p95: r0(pct(all, 95)), enCok: r0(Math.max(0, ...all)) },
    yedekSirasinda: { adet: inBackup.length, p50: r0(pct(inBackup, 50)), p95: r0(pct(inBackup, 95)), enCok: r0(Math.max(0, ...inBackup)) },
    yedekDisinda: { p50: r0(pct(outBackup, 50)), p95: r0(pct(outBackup, 95)), enCok: r0(Math.max(0, ...outBackup)) },
    turler: table,
    beklenen409: expected409.reduce((o, sample) => ((o[sample.code] = (o[sample.code] || 0) + 1), o), {}),
    beklenmeyen: unexpected.reduce((o, sample) => ((o[`${sample.status} ${sample.code || ""}`.trim()] = (o[`${sample.status} ${sample.code || ""}`.trim()] || 0) + 1), o), {}),
    olayDongusu: { p50: +loop.p50.toFixed(1), p95: +loop.p95.toFixed(1), p99: +loop.p99.toFixed(1), enCok: r0(loop.max), rssMB: Math.round(loop.rss / 1e6) },
  };
  check(!(unexpected.length), `beklenmeyen yanıt: ${JSON.stringify(result.sunucu.beklenmeyen)}`);
  const cariLags = screen.cari.flatMap(item => item.lags);
  const cariSearch = screen.cari.map(item => item.searchMs);
  const field = (list, key) => list.map(item => item[key]).filter(value => Number.isFinite(value) && value >= 0);
  const stat = list => ({ adet: list.length, p50: r0(pct(list, 50)), p95: r0(pct(list, 95)), enCok: list.length ? r0(Math.max(...list)) : null });
  result.ekran = {
    girisMs: result.ekranGiris,
    cariPencereAcilisMs: screen.cariAcilisMs ?? null,
    bankaPencereAcilisMs: screen.bankaAcilisMs ?? null,
    hareketlerIlkMs: screen.hareketlerIlkMs ?? null,
    cariTusHarf: stat(cariLags.filter(value => value >= 0)),
    cariAramaSonucu: stat(cariSearch.filter(value => value >= 0)),
    cariAramaZamanAsimi: cariSearch.filter(value => value < 0).length + cariLags.filter(value => value < 0).length,
    hareketSuzgec: stat(field(screen.banka, "suzgecMs")),
    hareketDahaFazla: stat(field(screen.banka, "dahaFazlaMs")),
    kaydetListede: stat(field(screen.banka, "kaydetListedeMs")),
    kaydetGorunmedi: screen.banka.filter(item => item.kaydetListedeMs === -1).length,
    baskasininKaydiListede: stat(field(screen.banka, "baskasininKaydiMs")),
    baskasininKaydiGorunmedi: screen.banka.filter(item => item.baskasininKaydiMs === -1).length,
    raporlarAcilis: stat(field(screen.rapor, "raporlarAcilisMs")),
    bankaBakiyeOnIzleme: stat(field(screen.rapor, "onIzlemeMs")),
    pdf: { ...stat(field(screen.rapor, "pdfMs")), durumlar: [...new Set(screen.rapor.map(item => item.pdfDurum).filter(Boolean))], bayt: screen.rapor.find(item => item.pdfBayt)?.pdfBayt ?? null },
    excel: { ...stat(field(screen.rapor, "excelMs")), durumlar: [...new Set(screen.rapor.map(item => item.excelDurum).filter(Boolean))], bayt: screen.rapor.find(item => item.excelBayt)?.excelBayt ?? null },
    yedekSirasindaCari: stat(screen.cari.filter(item => item.inBackup).map(item => item.searchMs).filter(value => value >= 0)),
    yedekSirasindaRapor: stat(field(screen.rapor.filter(item => item.inBackup), "onIzlemeMs")),
    donma: screen.donma,
    bellekMB: screen.bellek,
    kararsizTiklama: unstable,
    hatalar: screen.hatalar,
  };
  check(!(screen.rapor.some(item => item.pdfDurum && item.pdfDurum !== 200) || screen.rapor.some(item => item.excelDurum && item.excelDurum !== 200)), "ekran: PDF/Excel 200 dönmedi");
  check(!(result.ekran.kaydetGorunmedi || result.ekran.baskasininKaydiGorunmedi), `ekran: kayıt listede görünmedi (kendi ${result.ekran.kaydetGorunmedi}, başkası ${result.ekran.baskasininKaydiGorunmedi})`);
  result.yedekler = backups;
  result.sonra = after;
  result.paraSatiri = { once: moneyBefore, sonra: moneyAfter };
  result.izliKayit = marks;
  result.sureSn = +elapsed.toFixed(1);
  result.sonuc = { hatalar, denetim: checks.length, gecen: checks.filter(item => item.ok).length };
  log(JSON.stringify({ kullanici: users, sunucu: { ...result.sunucu, turler: undefined }, ekran: { ...result.ekran, hatalar: result.ekran.hatalar.length } }, null, 1));
  log(`turler: ${table.map(row => `${row.tur} n=${row.adet} p50=${row.p50} p95=${row.p95} max=${row.enCok} ${JSON.stringify(row.durum)}`).join("\n        ")}`);
  log(`yedek: ${backups.map(item => `${item.tur} ${item.ms} ms ${item.dosyalar?.map(file => `${file.klasor}/${file.name} ${file.integrity} ${file.paraSatiri}`).join(", ")}`).join(" | ")}`);
  log(`sonra: ${JSON.stringify(after)}`);
  log(`izli kayıt: ${JSON.stringify(marks)} · para satırı önce ${JSON.stringify(moneyBefore)} sonra ${JSON.stringify(moneyAfter)}`);
  log(`hatalar: ${hatalar.length ? hatalar.join(" | ") : "yok"}`);
  rmSync(work, { recursive: true, force: true });
  return result;
}

function findBackup(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBackup(full, name);
      if (found) return found;
    } else if (entry.name === name) return full;
  }
  return "";
}

