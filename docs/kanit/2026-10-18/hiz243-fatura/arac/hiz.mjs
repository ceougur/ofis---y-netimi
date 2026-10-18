// FATURA MODÜLÜ YÜK VE HIZ TESTİ (2.4.3, 17.10.2026). Ürün koduna dokunmaz; yalnız ölçüm aracıdır.
// Şablon: tools/olcek-210.mjs (ayrı süreç sunucu, veri hazırlama, yük üreticisi, ekran ölçümü, olay döngüsü) +
//         test/e2e/senaryo-ebelge-243.mjs ve docs/kanit/2026-10-16/edm-dayaniklilik (sahte EDM, fatura formu seçicileri).
// Kullanım:
//   node hiz.mjs veri                       → <KLASOR>/veri (programın API'siyle: 300 cari, 200 ürün, ≥10.000 fatura, 12 ay)
//   node hiz.mjs duzey <ad> <ekran> <api> <sn> [tohum]  → <KLASOR>/sonuc-<ad>.json (taze veri kopyasında)
// Ortam: KLASOR (varsayılan bu dosyanın klasörü/veri-kok), sunucu HUKUK_LICENSE_URL=http://127.0.0.1:9 (ders 30), sahte EDM (ağa çıkmaz).
import { fork } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const R = process.env.HIZ_KOD || "/home/user/ofis---y-netimi";
const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const KOK = process.env.KLASOR || path.join(HERE, "veri-kok");
const ADMIN_PASS = "Hiz-Fatura-Yonetici-1!";
const STAFF_PASS = "Hiz-Fatura-Personel-1!";
const EDM_USER = "edmkullanici";
const EDM_PASS = "Gizli-Parola-1";
const LICENSE_DEAD = "http://127.0.0.1:9";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unwrap = r => (r?.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r?.data);
const r2 = v => Math.round(v * 100) / 100;
const c2 = v => Math.round(v * 100); // kuruş
const pct = (list, p) => {
  const s = list.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null;
};
const stats = list => ({ n: list.length, p50: rnd(pct(list, 50)), p95: rnd(pct(list, 95)), p99: rnd(pct(list, 99)), max: rnd(list.length ? Math.max(...list) : null) });
const rnd = v => (v === null || v === undefined ? null : Math.round(v));
const appOptions = (dataDir, extra = {}) => ({
  dataDir,
  backupDir: path.join(path.dirname(dataDir), "backups"),
  logLevel: "warn",
  scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: LICENSE_DEAD },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false,
  // Üretim (server/server.mjs): yalnız edocEnabled + edocLive; geri kalanı createApp varsayılanı.
  edocEnabled: true,
  edocLive: true,
  ...extra,
});
// Tohumlu rastgele (mulberry32).
const rng = seed => {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: l => l[Math.floor(next() * l.length)], chance: p => next() < p };
};
// Bağımsız tutar hesabı (kâhin): satır net = yuvarla(miktar × fiyat); KDV = yuvarla(net × oran); ödenecek = Σ (iskonto/tevkifat yok).
// Tam sayı kuruşla (yarım yukarı): net = miktar × fiyat(kuruş); KDV = yuvarla(net × oran / 100).
const payableOf = lines => lines.reduce((sum, l) => { const net = Math.round(l.qty * Math.round(l.price * 100)); return sum + net + Math.round((net * l.vat) / 100); }, 0) / 100;

// ================================================================ SUNUCU (ayrı süreç) ================================================================
if (process.env.HIZ_SUNUCU) {
  const conf = JSON.parse(process.env.HIZ_SUNUCU);
  const { createApp } = await import(`${R}/server/app.mjs`);
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const app = createApp(appOptions(conf.dataDir));
  const { port } = await app.listen(0, "127.0.0.1");
  let cpu0 = process.cpuUsage();
  let t0 = performance.now();
  process.send({ cmd: "ready", port });
  process.on("message", async m => {
    if (m.cmd === "reset") {
      loop.reset();
      cpu0 = process.cpuUsage();
      t0 = performance.now();
      process.send({ cmd: "reset" });
    } else if (m.cmd === "stat") {
      const cpu = process.cpuUsage(cpu0);
      const wall = performance.now() - t0;
      process.send({ cmd: "stat", loop: { p50: loop.percentile(50) / 1e6, p95: loop.percentile(95) / 1e6, p99: loop.percentile(99) / 1e6, max: loop.max / 1e6, mean: loop.mean / 1e6 }, cpuPct: ((cpu.user + cpu.system) / 1000 / wall) * 100, rssMB: process.memoryUsage().rss / 1e6 });
    } else if (m.cmd === "close") {
      await app.close();
      process.send({ cmd: "closed" });
      process.exit(0);
    }
  });
} else {
  const stage = process.argv[2];
  if (stage === "veri") await buildData();
  else if (stage === "duzey") await runLevel(process.argv[3], Number(process.argv[4]), Number(process.argv[5]), Number(process.argv[6]), Number(process.argv[7] || 1));
  else console.log("kullanım: node hiz.mjs veri | duzey <ad> <ekran> <api> <sn> [tohum]");
}

function startServer(dataDir) {
  const child = fork(SELF, [], { env: { ...process.env, HIZ_SUNUCU: JSON.stringify({ dataDir }), HUKUK_LICENSE_URL: LICENSE_DEAD, HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "" }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  process.on("exit", () => { try { child.kill(); } catch {} });
  const waiters = new Map();
  child.on("message", m => { const l = waiters.get(m.cmd) || []; const n = l.shift(); if (n) n(m); });
  const ask = cmd => new Promise(resolve => { const reply = cmd === "close" ? "closed" : cmd; waiters.set(reply, [...(waiters.get(reply) || []), resolve]); child.send({ cmd }); });
  return new Promise((resolve, reject) => {
    waiters.set("ready", [m => resolve({ child, ask, pid: child.pid, base: `http://127.0.0.1:${m.port}` })]);
    child.once("exit", code => reject(new Error(`sunucu çıktı ${code}`)));
  });
}

// ================================================================ VERİ ================================================================
async function buildData() {
  const T = performance.now();
  const dir = path.join(KOK, "veri");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { createApp } = await import(`${R}/server/app.mjs`);
  const { createClient } = await import(`${R}/test/helpers.mjs`);
  const { startMockEdm, OUR_VKN, BUYER_VKN, vkn } = await import(`${R}/test/einvoice-mock.mjs`);
  const mock = await startMockEdm();
  const app = createApp(appOptions(path.join(dir, "data"), { logLevel: "silent" }));
  const { port } = await app.listen(0, "127.0.0.1");
  const api = createClient(`http://127.0.0.1:${port}`);
  const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return unwrap(r); };
  await must("giriş", api.login("admin", ADMIN_PASS));
  await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
  const today = unwrap(await api.get("/api/workspace/ledger/lock")).today;
  const addDays = (iso, d) => { const [y, m, dd] = iso.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, dd + d)); return x.toISOString().slice(0, 10); };
  const year = Number(today.slice(0, 4));
  await must("fatura ayarları", api.put("/api/workspace/invoices/settings", {
    seller: { name: "HIZ TEST TİCARET A.Ş.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@hiztest.com.tr" },
    efatura: true, earsiv: true,
    start: { [`TEF${year - 1}`]: 300000001, [`TEA${year - 1}`]: 300000001, [`TEF${year}`]: 400000001, [`TEA${year}`]: 400000001 },
    integrator: { env: "test", baseUrl: mock.url, username: EDM_USER, password: EDM_PASS, senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
  }));
  const R1 = rng(20261017);
  // ---- Cariler (300) ----
  const FIRST = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Emine", "Mustafa", "Ali", "Hüseyin", "Zeynep", "Elif", "Murat", "Selin", "Burak", "Deniz", "Canan", "Kemal", "Oya", "Serkan", "Gül", "Tuncay"];
  const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Öztürk", "Aydın", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Koç", "Kurt"];
  const SECT = ["Yapı", "Gıda", "Tekstil", "Elektrik", "Otomotiv", "Mobilya", "Kırtasiye", "Medikal", "Tarım", "Lojistik", "Turizm", "Bilişim"];
  const tckn = seed => { const d = [1 + (seed % 9), ...String(seed * 7919 + 12345678).padStart(8, "0").slice(-8).split("").map(Number)]; const odd = d[0] + d[2] + d[4] + d[6] + d[8]; const even = d[1] + d[3] + d[5] + d[7]; d.push((((odd * 7 - even) % 10) + 10) % 10); d.push(d.reduce((a, b) => a + b, 0) % 10); return d.join(""); };
  const accounts = { efatura: [], person: [], firm: [], perakende: [], supplier: [] };
  const addr = city => ({ taxOffice: "Merkez", address: "Cumhuriyet Cd. No: 5", district: "Merkez", city });
  for (let i = 0; i < 110; i += 1) {
    const name = `${SECT[i % SECT.length]} ${FIRST[i % FIRST.length]}oğlu ${String(i + 1).padStart(3, "0")} A.Ş.`;
    const a = await must("e-Fatura cari", api.post("/api/workspace/accounts", { name, type: "customer", taxNo: BUYER_VKN, ...addr("Ankara"), eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", registeredOn: addDays(today, -400) }));
    accounts.efatura.push({ id: a.id, name, query: name.split(" ").slice(0, 3).join(" ") });
  }
  for (let i = 0; i < 100; i += 1) {
    const f = FIRST[i % FIRST.length], l = LAST[Math.floor(i / FIRST.length) % LAST.length];
    const name = `${f} ${l} ${String(i + 1).padStart(3, "0")}`;
    const a = await must("şahıs cari", api.post("/api/workspace/accounts", { name, type: "customer", partyKind: "person", firstName: f, familyName: l, taxNo: tckn(1000 + i), ...addr("İzmir"), registeredOn: addDays(today, -400) }));
    accounts.person.push({ id: a.id, name, query: name });
  }
  {
    const a = await must("perakende", api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Nihai", familyName: "Tüketici", taxNo: "11111111111", ...addr("Ankara"), registeredOn: addDays(today, -400) }));
    accounts.perakende.push({ id: a.id, name: "Perakende Müşteri", query: "Perakende Müş" });
  }
  for (let i = 0; i < 49; i += 1) {
    const name = `${SECT[(i + 3) % SECT.length]} Ticaret ${String(i + 1).padStart(3, "0")} Ltd. Şti.`;
    const a = await must("firma cari", api.post("/api/workspace/accounts", { name, type: "customer", taxNo: vkn(300000000 + i * 7777), ...addr("Bursa"), registeredOn: addDays(today, -400) }));
    accounts.firm.push({ id: a.id, name, query: name.split(" ").slice(0, 3).join(" ") });
  }
  for (let i = 0; i < 40; i += 1) {
    const name = `${SECT[(i + 5) % SECT.length]} Tedarik ${String(i + 1).padStart(3, "0")} San. A.Ş.`;
    const a = await must("tedarikçi", api.post("/api/workspace/accounts", { name, type: "supplier", taxNo: vkn(600000000 + i * 3331), ...addr("İstanbul"), registeredOn: addDays(today, -400) }));
    accounts.supplier.push({ id: a.id, name, query: name.split(" ").slice(0, 3).join(" ") });
  }
  // ---- Ürünler (200) ----
  const PRODUCTS = [["Çimento 50 Kg", 285, 20], ["Demir Q12", 28.45, 20], ["Boya 15 Lt", 1450, 20], ["Seramik 60x60", 425.5, 20], ["Un Tip 550", 18.75, 1], ["Makarna 500 Gr", 22.9, 1], ["Ayçiçek Yağı 5 Lt", 399.95, 1], ["Pamuklu Gömlek", 450, 10], ["Havlu Takımı", 640, 10], ["LED Ampul", 49.9, 20], ["Kablo 2,5 mm", 17.35, 20], ["Vida M8", 1.25, 20], ["Defter A4", 34.5, 20], ["Toner Siyah", 1890, 20], ["Kahve 1 Kg", 649.9, 1], ["Çay 1 Kg", 289.75, 1], ["Masa Sandalye", 3250, 20], ["Monitör 24", 5499, 20], ["Laptop Çanta", 899, 20], ["Eldiven Nitril", 145.6, 10]];
  const items = [];
  for (let i = 0; i < 200; i += 1) {
    const [base, price, vat] = PRODUCTS[i % PRODUCTS.length];
    const code = `P${String(i + 1).padStart(3, "0")}`;
    const salePrice = r2(price * (1 + (i % 7) * 0.03));
    const name = `${code} ${base}`;
    const it = await must("stok", api.post("/api/workspace/stock", { name, code, unit: "Adet", kind: "goods", salePrice, unitPrice: r2(salePrice * 0.7), vatRate: vat, openingQty: 1_000_000, openingPay: "none" }));
    items.push({ id: it.id || it.item?.id, name, code, salePrice, cost: r2(salePrice * 0.7), vat });
  }
  const tCari = performance.now();
  // ---- Faturalar (12 ay, ≥10.000) ----
  const reg = { sales: [], purchases: [] };
  const counts = {};
  const fails = {};
  let purchaseNo = 0;
  const bump = k => (counts[k] = (counts[k] || 0) + 1);
  const linesFor = (n, sale) => Array.from({ length: n }, () => { const it = R1.pick(items); return { itemId: it.id, qty: sale ? R1.int(1, 20) : R1.int(10, 200), price: sale ? it.salePrice : it.cost, vat: it.vat }; });
  const body = l => ({ itemId: l.itemId, name: "", qty: l.qty, unitPrice: l.price, vatRate: l.vat });
  const one = async (date, roll) => {
    let r, kind;
    if (roll < 0.62) {
      const sale = R1.chance(0.8);
      const who = R1.chance(0.45) ? R1.pick(accounts.efatura) : R1.chance(0.6) ? R1.pick(accounts.person) : R1.chance(0.5) ? R1.pick(accounts.firm) : accounts.perakende[0];
      let lines = sale ? linesFor(R1.int(1, 5), true) : [{ name: `Hizmet Bedeli ${R1.int(1, 99)}`, qty: R1.int(1, 10), price: R1.int(100, 5000), vat: R1.pick([20, 10]) }];
      // GİB: 30.000 TL üstü e-Arşivde nihai tüketici (11111111111) yazılamaz — perakendede tutar küçük tutulur.
      if (who === accounts.perakende[0] && payableOf(lines) > 25000) lines = lines.slice(0, 1).map(l => ({ ...l, qty: 1 }));
      const payable = payableOf(lines);
      const p = R1.next();
      const payment = p < 0.45 ? { rest: "open" } : p < 0.65 ? { cash: [{ amount: payable, method: "cash" }], rest: "open" } : p < 0.85 ? { cash: [{ amount: r2(payable * 0.4), method: "cash" }], rest: "open" } : { cheques: [{ instrument: R1.chance(0.7) ? "cheque" : "note", amount: payable, dueDate: addDays(date, R1.int(30, 120)), serialNo: `S${R1.int(100000, 999999)}`, bank: "Örnek Bankası", drawer: "" }], rest: "open" };
      kind = sale ? "satış (stok)" : "satış (hizmet)";
      r = await api.post("/api/workspace/invoices", { kind: "sale", scenario: sale ? "goods_sale" : "service_sale", accountId: who.id, issueDate: date, lines: lines.map(l => (l.itemId ? body(l) : { name: l.name, qty: l.qty, unitPrice: l.price, vatRate: l.vat })), payment, force: true, cashForce: true, eSend: "now" });
      if (r.status === 200) reg.sales.push({ id: unwrap(r).id, date, lineId: unwrap(r).lines?.[0]?.id, goods: sale, profile: unwrap(r).profile });
    } else if (roll < 0.86) {
      const sup = R1.pick(accounts.supplier);
      const goods = R1.chance(0.8);
      const lines = goods ? linesFor(R1.int(1, 4), false) : [{ name: "Kira Bedeli", qty: 1, price: R1.int(2000, 20000), vat: 20 }];
      const payable = payableOf(lines);
      kind = goods ? "alış (stok)" : "alış (gider)";
      r = await api.post("/api/workspace/invoices", { kind: "purchase", scenario: goods ? "goods_purchase" : "expense_purchase", accountId: sup.id, number: `ALS${year}${String(++purchaseNo).padStart(9, "0")}`, issueDate: date, lines: lines.map(l => (l.itemId ? body(l) : { name: l.name, qty: l.qty, unitPrice: l.price, vatRate: l.vat, expenseCode: "rent" })), payment: R1.chance(0.3) ? { cash: [{ amount: r2(payable * 0.3), method: "cash" }], rest: "open" } : { rest: "open" }, force: true, cashForce: true });
      if (r.status === 200 && goods) reg.purchases.push({ id: unwrap(r).id, date, lineId: unwrap(r).lines?.[0]?.id });
    } else if (roll < 0.93 && reg.sales.length > 20) {
      const orig = R1.pick(reg.sales.filter(s => s.goods && !s.returned).slice(-300));
      if (!orig) return;
      orig.returned = true;
      kind = "satıştan iade";
      r = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: orig.id, issueDate: date, lines: [{ originLineId: orig.lineId, qty: 1 }], payment: {}, force: true, cashForce: true });
    } else if (roll < 0.965 && reg.purchases.length > 20) {
      const orig = R1.pick(reg.purchases.filter(s => !s.returned && !s.cancelled).slice(-300));
      if (!orig) return;
      orig.returned = true;
      kind = "alıştan iade (e-Belge)";
      r = await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: orig.id, issueDate: date, lines: [{ originLineId: orig.lineId, qty: 1 }], payment: {}, force: true, cashForce: true, eSend: "now" });
    } else if (reg.purchases.length > 20) {
      // İptal: alış (kâğıt) ya da son 7 günde kesilmiş e-Arşiv satış.
      const recentArchive = date >= addDays(today, -7) ? reg.sales.filter(s => s.profile === "EARSIVFATURA" && !s.cancelled && !s.returned && s.date >= addDays(today, -7)) : [];
      const target = recentArchive.length && R1.chance(0.6) ? R1.pick(recentArchive) : R1.pick(reg.purchases.filter(p => !p.returned && !p.cancelled));
      if (!target) return;
      target.cancelled = true;
      kind = target.profile ? "iptal (e-Arşiv)" : "iptal (alış)";
      if (target.profile) for (let i = 0; i < 3; i += 1) { const s = unwrap(await api.post(`/api/workspace/invoices/${target.id}/e-refresh`, {})); if (s?.eStatus && s.eStatus !== "processing") break; }
      r = await api.post(`/api/workspace/invoices/${target.id}/cancel`, { reason: "Hız testi hazırlık", force: true, cashForce: true });
    } else return;
    if (r.status === 200) bump(kind);
    else { const k = `${kind} ${r.status} ${r.data?.code || ""}`; fails[k] = (fails[k] || 0) + 1; if (Object.keys(fails).length < 12 && fails[k] === 1) console.log("RET", k, JSON.stringify(r.data).slice(0, 300)); if (r.status >= 500) throw new Error(`5xx ${JSON.stringify(r.data).slice(0, 300)}`); }
  };
  const start = addDays(today, -364);
  let total = 0;
  const DAYS = Number(process.env.GUN || 364);
  for (let d = 364 - DAYS; d < 364; d += 1) {
    const date = addDays(start, d);
    const n = R1.int(24, 33);
    // Gün içinde 3 eşzamanlı istek (aynı tarih: numara-tarih sırası bozulmaz).
    const rolls = Array.from({ length: n }, () => R1.next());
    for (let i = 0; i < rolls.length; i += 3) await Promise.all(rolls.slice(i, i + 3).map(roll => one(date, roll)));
    total += n;
    if (d % 30 === 0) console.log(`  ${date}: ${total} deneme, ${Object.values(counts).reduce((a, b) => a + b, 0)} 200 · ${Math.round((performance.now() - T) / 1000)} sn`);
  }
  const tFatura = performance.now();
  // ---- Kullanıcılar ----
  const users = [];
  for (const [prefix, count] of [["ekran", 8], ["api", 15]]) {
    for (let i = 1; i <= count; i += 1) {
      const username = `${prefix}${String(i).padStart(2, "0")}`;
      const u = await must(`kullanıcı ${username}`, api.post("/api/admin/users", { username, name: `Hız ${username}`, role: "muhasebe", password: STAFF_PASS, mustChangePassword: false }));
      const person = createClient(`http://127.0.0.1:${port}`);
      await must(`${username} giriş`, person.login(username, STAFF_PASS));
      await must(`${username} sihirbaz`, person.post("/api/workspace/bank/setup/dismiss", {}));
      users.push(username);
    }
  }
  const integrity = unwrap(await api.get("/api/workspace/ledger/integrity"));
  const invCount = app.store.get("SELECT COUNT(*) AS n, SUM(status='cancelled') AS c, SUM(e_status IN ('sent','accepted')) AS e FROM invoices");
  await app.close();
  await mock.close();
  const info = { tarih: new Date().toISOString(), today, accounts, items, users, counts, fails, faturaSayisi: invCount, mutabakat: integrity?.ok, edmGonderilen: mock.state.sent.length, sure: { cariUrunSn: Math.round((tCari - T) / 1000), faturaSn: Math.round((tFatura - tCari) / 1000), toplamSn: Math.round((performance.now() - T) / 1000) } };
  writeFileSync(path.join(dir, "hazir.json"), JSON.stringify(info, null, 1));
  console.log(JSON.stringify({ counts, fails, invCount, mutabakat: integrity?.ok, sure: info.sure }, null, 1));
}

// ================================================================ DÜZEY ================================================================
async function runLevel(name, screenUsers, apiUsers, seconds, seed) {
  const info = JSON.parse(readFileSync(path.join(KOK, "veri", "hazir.json"), "utf8"));
  const work = path.join(KOK, `calisma-${name}`);
  rmSync(work, { recursive: true, force: true });
  cpSync(path.join(KOK, "veri"), work, { recursive: true });
  const dataDir = path.join(work, "data");
  const { createClient } = await import(`${R}/test/helpers.mjs`);
  const { startMockEdm } = await import(`${R}/test/einvoice-mock.mjs`);
  const { DatabaseSync } = await import("node:sqlite");
  const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
  const mock = await startMockEdm();
  const tOpen = performance.now();
  const server = await startServer(dataDir);
  const openMs = performance.now() - tOpen;
  const BASE = server.base;
  const admin = createClient(BASE);
  const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return unwrap(r); };
  await must("yönetici", admin.login("admin", ADMIN_PASS));
  const userList = unwrap(await admin.get("/api/admin/users"));
  let granted = 0;
  for (const u of (Array.isArray(userList) ? userList : userList?.users || [])) if (/^(ekran|api)\d+$/.test(u.username || "") && ++granted) await must(`rapor yetkisi ${u.username}`, admin.patch(`/api/admin/users/${u.id}`, { grants: { add: ["overview.view"] } }));
  console.log(`rapor yetkisi (overview.view) verilen personel: ${granted}`);
  await must("entegratör adresi", admin.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: mock.url, username: EDM_USER, password: EDM_PASS, senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
  const today = unwrap(await admin.get("/api/workspace/ledger/lock")).today;
  const dbFile = (() => { const reg = JSON.parse(readFileSync(path.join(dataDir, "sirketler.json"), "utf8")); const c = reg.companies.find(x => !x.deletedAt); return path.join(c.dir ? path.join(dataDir, c.dir) : dataDir, "destekofis.sqlite"); })();
  const S = rng(seed * 7919 + screenUsers * 31 + apiUsers);
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

  // ---------- "Önce" (program okuması; karşılaştırma farkla: sonra − önce = bağımsız defter) ----------
  const snapshot = async () => {
    const acc = (unwrap(await admin.get("/api/workspace/accounts?status=all&limit=500")).accounts || []);
    const stock = (unwrap(await admin.get("/api/workspace/stock?limit=500")).items || []);
    const trial = unwrap(await admin.get("/api/workspace/ledger")).trial.accounts;
    return { acc: Object.fromEntries(acc.map(a => [a.id, c2(a.balance)])), stock: Object.fromEntries(stock.map(s => [s.id, Math.round(s.qty * 1000)])), gl100: c2(trial.find(t => t.code === "100")?.balance || 0) };
  };
  const before = await snapshot();
  const db0 = new DatabaseSync(dbFile, { readOnly: true });
  const invBefore = db0.prepare("SELECT COUNT(*) AS n FROM invoices").get().n;
  const maxRowid = db0.prepare("SELECT MAX(rowid) AS m FROM invoices").get().m;
  db0.close();

  // ---------- Bağımsız defter (yalnız 200 dönen yazımlar; tutar kâhinle) ----------
  const L = { acc: {}, stock: {}, cash: 0, created: [], payMismatch: [] };
  const effects = new Map(); // fatura id → etki (iptal için)
  const apply = (eff, sign = 1) => {
    L.acc[eff.accountId] = (L.acc[eff.accountId] || 0) + sign * eff.acc;
    L.cash += sign * eff.cash;
    for (const [id, q] of Object.entries(eff.stock)) L.stock[id] = (L.stock[id] || 0) + sign * q;
  };
  // kind: sale/purchase/sale_return; lines [{itemId, qty, price, vat}]; cash kuruş.
  const effectOf = (kind, accountId, lines, cash) => {
    const payable = c2(payableOf(lines));
    const stock = {};
    for (const l of lines) if (l.itemId) stock[l.itemId] = (stock[l.itemId] || 0) + (kind === "sale" ? -1 : 1) * Math.round(l.qty * 1000);
    if (kind === "sale") return { accountId, acc: payable - cash, cash, stock, payable };
    if (kind === "purchase") return { accountId, acc: -payable + cash, cash: -cash, stock, payable };
    return { accountId, acc: -payable, cash: 0, stock, payable }; // sale_return, ödemesiz
  };
  const book = (id, eff, programPayable, source) => {
    if (programPayable !== undefined && c2(programPayable) !== eff.payable) L.payMismatch.push({ id, source, kahin: eff.payable / 100, program: programPayable });
    apply(eff);
    effects.set(id, eff);
    L.created.push({ id, source });
  };
  const cancelBook = id => { const eff = effects.get(id); if (eff) { apply(eff, -1); effects.delete(id); } };

  // ---------- Ölçüm kayıtları ----------
  const ops = []; // {who:'ekran'|'api', kind, ms, status, code}
  const net = {}; // tarayıcı ağ süreleri: uç → [ms]
  const netBytes = {}; // 2.4.3 ölçümü: uç → toplam yanıt gövdesi (bayt)
  const issues = { karakterKaybi: [], ekranHata: [], sayfaHata: [], apiHata: [] };
  const rec = (who, kind, ms, status = 200, code = "") => ops.push({ who, kind, ms, status, code, t: Date.now() });
  const EXPECTED = new Set(["cash-negative", "stock-negative", "chronology", "einvoice-cancel-late", "invoice-has-returns", "similar"]);
  let stop = false;

  // ---------- API kullanıcıları ----------
  const all = info.accounts;
  const customers = [...all.efatura, ...all.person, ...all.firm, ...all.perakende];
  const apiWorker = async index => {
    const client = createClient(BASE);
    await must(`api${index}`, client.login(`api${String(index).padStart(2, "0")}`, STAFF_PASS));
    const W = rng(seed * 1000 + index);
    const mine = []; // kendi kestiği satışlar
    const call = async (kind, fn) => {
      const t = performance.now();
      let r = null;
      try { r = await fn(); } catch (e) { issues.apiHata.push(`${kind}: ${String(e.message).slice(0, 160)}`); rec("api", kind, performance.now() - t, 0, "ağ"); return null; }
      const code = r.data?.code || "";
      rec("api", kind, performance.now() - t, r.status, code);
      if (r.status >= 400 && !EXPECTED.has(code)) issues.apiHata.push(`${kind} ${r.status} ${code} ${JSON.stringify(r.data).slice(0, 200)}`);
      return r;
    };
    while (!stop) {
      const roll = W.next();
      if (roll < 0.30) {
        const who = W.pick(customers);
        const lines = Array.from({ length: W.int(1, 4) }, () => { const it = W.pick(info.items); return { itemId: it.id, qty: W.int(1, 10), price: it.salePrice, vat: it.vat }; });
        const payable = payableOf(lines);
        const cash = W.chance(0.3) ? r2(payable * 0.5) : 0;
        const later = W.chance(0.2);
        const r = await call(later ? "Satış (Kaydet, Sonra Gönder)" : "Satış (Kaydet ve Gönder)", () => client.post("/api/workspace/invoices", { kind: "sale", scenario: "goods_sale", accountId: who.id, issueDate: today, lines: lines.map(l => ({ itemId: l.itemId, name: "", qty: l.qty, unitPrice: l.price, vatRate: l.vat })), payment: { ...(cash ? { cash: [{ amount: cash, method: "cash" }] } : {}), rest: "open" }, eSend: later ? "later" : "now" }));
        if (r?.status === 200) {
          const d = unwrap(r);
          book(d.id, effectOf("sale", who.id, lines, c2(cash)), d.tryPayable, "api");
          mine.push({ id: d.id, profile: d.profile, lines, accountId: who.id });
          if (later) { await sleep(W.int(300, 1200)); await call("e-Belge Gönder (kart)", () => client.post(`/api/workspace/invoices/${d.id}/send`, {})); }
        }
      } else if (roll < 0.40) {
        const sup = W.pick(all.supplier);
        const lines = Array.from({ length: W.int(1, 3) }, () => { const it = W.pick(info.items); return { itemId: it.id, qty: W.int(5, 50), price: it.cost, vat: it.vat }; });
        const cash = W.chance(0.3) ? r2(payableOf(lines) * 0.3) : 0;
        const r = await call("Alış faturası", () => client.post("/api/workspace/invoices", { kind: "purchase", scenario: "goods_purchase", accountId: sup.id, number: `YUK${name}${index}${Date.now().toString(36)}${W.int(0, 999)}`, issueDate: today, lines: lines.map(l => ({ itemId: l.itemId, name: "", qty: l.qty, unitPrice: l.price, vatRate: l.vat })), payment: { ...(cash ? { cash: [{ amount: cash, method: "cash" }] } : {}), rest: "open" } }));
        if (r?.status === 200) { const d = unwrap(r); book(d.id, effectOf("purchase", sup.id, lines, c2(cash)), d.tryPayable, "api"); }
      } else if (roll < 0.45 && mine.some(m => !m.done)) {
        const m = W.pick(mine.filter(x => !x.done));
        m.done = true;
        const full = unwrap(await client.get(`/api/workspace/invoices/${m.id}`));
        const line = full?.lines?.[0];
        if (!line) continue;
        const r = await call("Satıştan iade", () => client.post("/api/workspace/invoices", { kind: "sale_return", originalId: m.id, issueDate: today, lines: [{ originLineId: line.id, qty: 1 }], payment: {} }));
        if (r?.status === 200) { const d = unwrap(r); book(d.id, effectOf("sale_return", m.accountId, [{ itemId: m.lines[0].itemId, qty: 1, price: m.lines[0].price, vat: m.lines[0].vat }], 0), d.tryPayable, "api"); }
      } else if (roll < 0.49 && mine.some(m => !m.done && m.profile === "EARSIVFATURA")) {
        const m = W.pick(mine.filter(x => !x.done && x.profile === "EARSIVFATURA"));
        m.done = true;
        for (let i = 0; i < 3; i += 1) { const st = await call("Durum Sorgula", () => client.post(`/api/workspace/invoices/${m.id}/e-refresh`, {})); if (unwrap(st)?.eStatus !== "processing") break; }
        const r = await call("İptal (e-Arşiv)", () => client.post(`/api/workspace/invoices/${m.id}/cancel`, { reason: "Yük testi" }));
        if (r?.status === 200) cancelBook(m.id);
      } else if (roll < 0.64) {
        await call("Liste açılışı (200 satır)", () => client.get(`/api/workspace/invoices?tab=${W.pick(["sale", "sale", "purchase", "all"])}&limit=200`));
      } else if (roll < 0.74) {
        const q = W.pick(customers).name.slice(0, W.int(4, 9));
        await call("Liste arama", () => client.get(`/api/workspace/invoices?tab=all&q=${encodeURIComponent(q)}&limit=200`));
      } else if (roll < 0.80) {
        await call("Liste sayfa çevirme", () => client.get(`/api/workspace/invoices?tab=sale&limit=200&offset=${W.pick([200, 400, 600, 1000])}`));
      } else if (roll < 0.86) {
        const q = W.pick(customers).query.slice(0, W.int(3, 8));
        await call("Cari arama (form)", () => client.get(`/api/workspace/accounts/search?q=${encodeURIComponent(q)}`));
        await call("Ürün arama (form)", () => client.get(`/api/workspace/invoices/items?q=${encodeURIComponent(W.pick(info.items).code)}`));
      } else if (roll < 0.91 && mine.length) {
        const m = W.pick(mine);
        await call("Fatura kartı", () => client.get(`/api/workspace/invoices/${m.id}`));
        const t = performance.now();
        const r = await client.raw("GET", `/api/workspace/invoices/${m.id}/fatura.pdf`).catch(() => null);
        rec("api", "PDF", performance.now() - t, r?.status || 0);
      } else if (roll < 0.95) {
        const y = today.slice(0, 4);
        await call("Rapor (Satış Faturaları)", () => client.get(`/api/workspace/report-center/fatura-satis?from=${y}-01-01&to=${today}`));
      } else {
        await call("Gönderilecekler listesi", () => client.get("/api/workspace/invoices?tab=pending&limit=200"));
      }
      await sleep(W.int(500, 1500));
    }
  };

  // ---------- Tarayıcı ----------
  const browser = await chromium.launch();
  const modal = ".hof-modal-backdrop.is-visible";
  const inv = `${modal} .hof-invoices-modal`;
  const last = `${modal}:last-of-type`;
  const normPath = url => { const u = new URL(url); return `${u.pathname.replace(/(invoice|account|stock|iline)-[0-9a-f-]{36}/g, ":id")}`; };
  const pageOf = async username => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    await context.addInitScript(() => {
      window.__perf = { longSum: 0, longN: 0, longMax: 0, cls: 0, clsBy: {} };
      // 2.4.3 ölçümü (H6): düzen kaymasının kaynağı (kayan düğümün etiketi + ilk sınıfı + en yakın pencere sınıfı), değer toplamı.
      const who = node => { if (!node || !node.tagName) return "?"; const own = `${node.tagName.toLowerCase()}${node.classList?.[0] ? `.${node.classList[0]}` : ""}`; const box = node.closest?.(".hof-modal, .hof-payment-promises, #hof-sidecard, .main-shell"); return `${own} @ ${box ? (box.id ? `#${box.id}` : `.${box.classList[0]}`) : "-"}`; };
      try {
        new PerformanceObserver(list => list.getEntries().forEach(e => { window.__perf.longSum += e.duration; window.__perf.longN += 1; window.__perf.longMax = Math.max(window.__perf.longMax, e.duration); })).observe({ type: "longtask", buffered: true });
        new PerformanceObserver(list => list.getEntries().forEach(e => { if (e.hadRecentInput) return; window.__perf.cls += e.value; const key = (e.sources || []).slice(0, 1).map(src => who(src.node)).join("") || "?"; window.__perf.clsBy[key] = (window.__perf.clsBy[key] || 0) + e.value; })).observe({ type: "layout-shift", buffered: true });
      } catch {}
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("dialog", d => d.accept());
    page.on("pageerror", e => issues.sayfaHata.push(`${username}: ${String(e.message).slice(0, 200)}`));
    page.on("requestfinished", req => {
      if (!req.url().includes("/api/")) return;
      const t = req.timing();
      if (t.responseEnd > 0) (net[`${req.method()} ${normPath(req.url())}`] ||= []).push(t.responseEnd);
      const key = `${req.method()} ${normPath(req.url())}`;
      req.sizes().then(size => { netBytes[key] = (netBytes[key] || 0) + (size.responseBodySize || 0); }, () => null);
    });
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", username);
    await page.fill("#hof-auth input[name=password]", STAFF_PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 90000 });
    await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 60000 });
    return { page, context, username };
  };
  const screenLoop = async (u, idx) => {
    const { page, username } = u;
    const step = name => (u.adim = name);
    const U = rng(seed * 5000 + idx);
    const pause = (a = 1000, b = 3000) => page.waitForTimeout(U.int(a, b));
    const typeHuman = async (text) => { for (const ch of String(text)) await page.keyboard.type(ch, { delay: 0 }), await page.waitForTimeout(U.int(40, 80)); };
    const fieldIs = async (sel, expected, what) => { const v = await page.$eval(sel, n => n.value).catch(() => null); if (v !== null && v !== String(expected)) issues.karakterKaybi.push(`${username} ${what}: yazılan "${expected}" alan "${v}"`); };
    const closeAll = async () => { for (let i = 0; i < 6 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) await yes.click().catch(() => {}); } };
    const ownSales = [];
    const openList = async () => {
      step("liste açılışı");
      if (await page.$(`${inv} tr[data-inv]`)) return;
      await closeAll();
      const t = performance.now();
      await page.click("#hof-sidecard [data-action=invoices]");
      await page.waitForSelector(`${inv} tr[data-inv], ${inv} td.hof-empty`, { timeout: 60000 });
      if (!(await page.$(`${inv} tr[data-inv]`))) {
        // Önceki adımdan kalan arama süzgeci: temizlenir (ölçüme girmez).
        await page.fill(`${inv} [data-filter="q"]`, "").catch(() => null);
        await page.press(`${inv} [data-filter="q"]`, "Enter").catch(() => null);
        await page.click(`${inv} [data-tab="sale"]`).catch(() => null);
        await page.waitForSelector(`${inv} tr[data-inv]`, { timeout: 60000 });
        return;
      }
      rec("ekran", "Liste açılışı (menü → satırlar)", performance.now() - t);
    };
    const moneyOf = text => Number(String(text).replace(/[^\d,-]/g, "").replace(",", "."));
    // Kaydet: onay sorusu → evet → yanıt (POST) → kart. Ek sorular (Kasa eksi, stok eksi) evetlenir.
    const save = async (act, kindLabel) => {
      step(`kaydet ${kindLabel}`);
      const t0 = performance.now();
      await page.click(`${inv} [data-act="${act}"]`);
      await page.waitForSelector(`${last} [data-answer="yes"]`, { timeout: 30000 });
      rec("ekran", "Kaydet tık → onay sorusu", performance.now() - t0);
      await pause(600, 1500);
      const respP = page.waitForResponse(r => r.request().method() === "POST" && /\/api\/workspace\/invoices(\?|$)/.test(r.url().replace(BASE, "")), { timeout: 60000 }).catch(() => null);
      const t1 = performance.now();
      await page.click(`${last} [data-answer="yes"]`);
      let resp = await respP;
      for (let i = 0; i < 3 && resp && resp.status() === 409; i += 1) {
        const yes = await page.waitForSelector(`${last} [data-answer="yes"]`, { timeout: 5000 }).catch(() => null);
        if (!yes) break;
        const again = page.waitForResponse(r => r.request().method() === "POST" && /\/api\/workspace\/invoices(\?|$)/.test(r.url().replace(BASE, "")), { timeout: 60000 }).catch(() => null);
        await yes.click();
        resp = await again;
      }
      const outcome = await Promise.race([
        page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 60000 }).then(() => "kart", () => "zaman"),
        page.waitForFunction(sel => [...document.querySelectorAll(sel)].some(n => n.offsetParent && n.textContent.trim()), `${inv} .hof-form-error`, { timeout: 60000, polling: 200 }).then(() => "hata", () => "zaman"),
      ]);
      const ms = performance.now() - t1;
      const data = resp ? await resp.json().catch(() => null) : null;
      rec("ekran", `${kindLabel} → kart`, ms, resp?.status() || 0, data?.code || "");
      if (outcome !== "kart") throw new Error(`${kindLabel}: ${outcome} ${await page.$eval(`${inv} .hof-form-error`, n => n.textContent).catch(() => "")}`);
      return data?.ok ? data.data : data;
    };
    const pickAccount = async acc => {
      await page.click(`${inv} [data-acc-query]`);
      await typeHuman(acc.query);
      const t = performance.now();
      await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${acc.id}"]`, { timeout: 30000 });
      rec("ekran", "Cari arama (son tuş → liste)", performance.now() - t);
      await fieldIs(`${inv} [data-acc-query]`, acc.query, "cari arama");
      await page.waitForTimeout(U.int(300, 700));
      await page.dispatchEvent(`${inv} .hof-acc-picker li[data-id="${acc.id}"]`, "mousedown");
      await page.waitForTimeout(400);
    };
    const fillLines = async (lines, priceField) => {
      for (const [i, l] of lines.entries()) {
        if (i > 0) { await page.click(`${inv} [data-act="add-line"]`); await page.waitForTimeout(300); }
        const f = x => `${inv} [data-l="${i}"][data-f="${x}"]`;
        await page.click(f("name"));
        await typeHuman(l.code);
        let t = performance.now();
        await page.waitForSelector(`${inv} li[data-item="${l.itemId}"]`, { timeout: 30000 });
        rec("ekran", "Ürün arama (son tuş → liste)", performance.now() - t);
        await page.waitForTimeout(U.int(200, 600));
        await page.click(`${inv} li[data-item="${l.itemId}"]`);
        await page.waitForTimeout(U.int(300, 800));
        for (const [field, value] of [["qty", String(l.qty)], [priceField, String(l.price).replace(".", ",")]]) {
          await page.click(f(field), { clickCount: 3 });
          await typeHuman(value);
          await fieldIs(f(field), value, field);
          await page.keyboard.press("Tab");
        }
        // KDV oranı satırda seçilir (stok kartında KDV oranı yok; form varsayılanı %20).
        if ((await page.$eval(f("vatRate"), n => n.value).catch(() => "20")) !== String(l.vat)) { await page.waitForTimeout(U.int(300, 700)); await page.selectOption(f("vatRate"), String(l.vat)); }
        // Toplam: son alandan (Tab) sonra Genel Toplam kâhinin değerine gelene kadar.
        const want = payableOf(lines.slice(0, i + 1));
        t = performance.now();
        const ok = await page.waitForFunction(({ sel, want }) => { const dd = document.querySelector(sel); if (!dd) return false; const v = Number(dd.textContent.replace(/[^\d,-]/g, "").replace(",", ".")); return Math.abs(v - want) < 0.005; }, { sel: `${inv} [data-totals] .is-total dd`, want }, { timeout: 15000, polling: 20 }).then(() => true, () => false);
        if (ok) rec("ekran", "Toplam güncellenmesi (Tab → Genel Toplam)", performance.now() - t);
        else issues.ekranHata.push(`${username}: toplam 15 sn'de ${want} olmadı (görülen ${await page.$eval(`${inv} [data-totals] .is-total dd`, n => n.textContent).catch(() => "?")})`);
        await page.waitForTimeout(U.int(400, 1200));
      }
    };
    const newDoc = async scenario => {
      step(`yeni belge ${scenario}`);
      await openList();
      await pause();
      let t = performance.now();
      await page.click(`${inv} [data-act="new"]`);
      await page.waitForSelector(`${inv} [data-scenario="${scenario}"]`, { timeout: 30000 });
      rec("ekran", "Yeni Fatura tık → senaryo ekranı", performance.now() - t);
      await pause(700, 1800);
      t = performance.now();
      await page.click(`${inv} [data-scenario="${scenario}"]`);
      await page.waitForSelector(`${inv} [data-acc-query]:not([disabled])`, { timeout: 30000 });
      await page.waitForSelector(`${inv} [data-l="0"][data-f="name"]`, { timeout: 30000 });
      rec("ekran", "Form açılışı (senaryo tık → form hazır)", performance.now() - t);
    };
    const sale = async () => {
      await newDoc("goods_sale");
      const acc = process.env.HATA_IPTAL ? U.pick(all.person) : U.pick(customers);
      await pickAccount(acc);
      const lines = Array.from({ length: U.int(3, 5) }, () => { const it = U.pick(info.items); return { itemId: it.id, code: `${it.code} `, qty: U.int(1, 12), price: r2(it.salePrice * (1 + U.int(1, 9) / 100)), vat: it.vat }; });
      await fillLines(lines, "unitPrice");
      const payable = payableOf(lines);
      let cash = 0;
      if (U.chance(0.35)) {
        cash = r2(Math.floor(payable * 0.4));
        await page.click(`${inv} [data-act="pay-add-cash"][data-method="cash"]`);
        const sel = `${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`;
        await page.waitForSelector(sel);
        await page.click(sel, { clickCount: 3 });
        await typeHuman(String(cash).replace(".", ","));
        await fieldIs(sel, String(cash).replace(".", ","), "peşin tutar");
        await page.keyboard.press("Tab");
        await pause(500, 1200);
      }
      const later = U.chance(0.2);
      const d = await save(later ? "issue-later" : "issue-now", later ? "Kaydet, Sonra Gönder" : "Kaydet ve Gönder");
      if (d?.id && process.env.HATA_AYIKLA) console.log("AYIKLA", JSON.stringify(lines.map(l => [l.code, l.qty, l.price, l.vat])), "→", JSON.stringify((d.lines || []).map(l => [l.name, l.qty, l.unitPrice, l.vatRate, l.discountRate])), d.tryPayable, payableOf(lines));
      if (d?.id) { book(d.id, effectOf("sale", acc.id, lines, c2(cash)), d.tryPayable, "ekran"); ownSales.push({ id: d.id, number: d.displayNo || d.number, profile: d.profile, lines, accountId: acc.id }); }
      await pause();
      if (d?.id && U.chance(0.4)) {
        const href = `/api/workspace/invoices/${d.id}/fatura.pdf`;
        const got = await page.evaluate(async url => { const t0 = performance.now(); const r = await fetch(url); const b = await r.arrayBuffer(); return { status: r.status, size: b.byteLength, ms: performance.now() - t0 }; }, href);
        rec("ekran", "PDF açılışı (indirme tamam)", got.ms, got.status);
        await pause();
      }
    };
    const purchase = async () => {
      await newDoc("goods_purchase");
      const sup = U.pick(all.supplier);
      await pickAccount(sup);
      const no = `EKR${username}${Date.now().toString(36)}`.toUpperCase();
      await page.click(`${inv} [data-f="number"]`);
      await typeHuman(no);
      await fieldIs(`${inv} [data-f="number"]`, no, "tedarikçi fatura no");
      const lines = Array.from({ length: U.int(2, 3) }, () => { const it = U.pick(info.items); return { itemId: it.id, code: `${it.code} `, qty: U.int(5, 40), price: r2(it.cost + U.int(1, 50) / 100), vat: it.vat }; });
      await fillLines(lines, "unitPrice");
      const d = await save("issue", "Alış Kaydet");
      if (d?.id) book(d.id, effectOf("purchase", sup.id, lines, 0), d.tryPayable, "ekran");
      await pause();
    };
    const openDoc = async id => {
      await closeAll();
      const t = performance.now();
      await page.evaluate(docId => window.HOF.invoices.openDoc(docId), id);
      await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 30000 });
      rec("ekran", "Fatura kartı açılışı", performance.now() - t);
      await pause(800, 1600);
    };
    const cancel = async () => {
      step("iptal");
      // Gönderilmiş e-Fatura ekrandan iptal edilmez (önce GİB/alıcı) — iptal yalnız kendi e-Arşiv belgesinde (8 gün içinde, EDM'de).
      const m = ownSales.find(s => !s.done && s.profile === "EARSIVFATURA");
      if (!m) return sale();
      m.done = true;
      await openDoc(m.id);
      // Kullanıcı "Durum Sorgula" ile EDM'nin sonucunu alır (işlenen e-Arşiv iptal edilemez); en çok 3 kez, durum İşleniyor olmayana dek.
      for (let i = 0; i < 3 && (await page.$(`${inv} [data-act="e-refresh"]`)) && (i === 0 || /İşleniyor/.test(await page.$eval(`${inv} .hof-inv-pills`, n => n.textContent).catch(() => ""))); i += 1) {
        const t = performance.now();
        const respP = page.waitForResponse(r => /e-refresh/.test(r.url()), { timeout: 30000 }).catch(() => null);
        await page.click(`${inv} [data-act="e-refresh"]`);
        await respP;
        await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 30000 });
        rec("ekran", "Durum Sorgula → kart", performance.now() - t);
        await pause(800, 1500);
      }
      if (!(await page.$(`${inv} [data-act="cancel"]`))) return;
      await page.click(`${inv} [data-act="cancel"]`);
      await page.waitForSelector(`${last} input[name="reason"]`);
      await page.click(`${last} input[name="reason"]`);
      await typeHuman("Müşteri vazgeçti");
      const respP = page.waitForResponse(r => /\/cancel(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
      const t = performance.now();
      await page.click(`${last} .hof-form button[type="submit"]`);
      if (process.env.HATA_IPTAL) { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(KOK, `iptal-${username}.png`) }); }
      const resp = await respP;
      const ok = resp?.status() === 200 ? await page.waitForSelector(`${inv} .hof-inv-banner.is-cancelled`, { timeout: 60000 }).then(() => true, () => false) : false;
      if (!ok) await closeAll();
      const data = resp ? await resp.json().catch(() => null) : null;
      rec("ekran", "İptal Et → kart (İptal Edildi)", performance.now() - t, resp?.status() || 0, data?.code || "");
      if (ok && resp?.status() === 200) cancelBook(m.id);
      else issues.ekranHata.push(`${username} iptal ${m.number}: ${resp?.status()} ${JSON.stringify(data).slice(0, 200)}`);
      await pause();
    };
    const ret = async () => {
      step("iade");
      const m = ownSales.find(s => !s.done);
      if (!m) return sale();
      m.done = true;
      await openDoc(m.id);
      if (!(await page.$(`${inv} [data-act="return"]`))) return;
      const t = performance.now();
      await page.click(`${inv} [data-act="return"]`);
      await page.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 30000 });
      rec("ekran", "İade tık → iade formu hazır", performance.now() - t);
      await pause();
      const act = (await page.$(`${inv} [data-act="issue"]`)) ? "issue" : "issue-now";
      const d = await save(act, "İade Kaydet");
      if (d?.id) book(d.id, effectOf("sale_return", m.accountId, m.lines, 0), d.tryPayable, "ekran");
      await pause();
    };
    const browseList = async () => {
      await openList();
      await pause();
      step("liste arama");
      const target = ownSales.filter(s => /^[A-Z]{3}\d{13}$/.test(s.number || "")).at(-1);
      const q = target ? target.number : U.pick(customers).name.slice(0, 6);
      await page.click(`${inv} [data-filter="q"]`, { clickCount: 3 });
      await typeHuman(q);
      await fieldIs(`${inv} [data-filter="q"]`, q, "liste arama");
      const prevNote = await page.$eval(`${inv} p.hof-rep-note`, n => n.textContent).catch(() => "");
      const t = performance.now();
      await page.keyboard.press("Enter");
      if (target) await page.waitForFunction(({ sel, q }) => { const rows = [...document.querySelectorAll(sel)]; return rows.length >= 1 && rows.every(r => r.textContent.includes(q)); }, { sel: `${inv} tr[data-inv]`, q }, { timeout: 30000, polling: 20 });
      else await page.waitForFunction(({ sel, prev }) => (document.querySelector(sel)?.textContent || "") !== prev, { sel: `${inv} p.hof-rep-note`, prev: prevNote }, { timeout: 30000, polling: 20 }).catch(() => null);
      rec("ekran", "Liste arama (Enter → sonuç)", performance.now() - t);
      await pause();
      step("liste aramayı temizle");
      await page.click(`${inv} [data-filter="q"]`, { clickCount: 3 });
      await page.keyboard.press("Backspace");
      const t2 = performance.now();
      await page.keyboard.press("Enter");
      await page.waitForFunction(sel => document.querySelectorAll(sel).length >= 200, `${inv} tr[data-inv]`, { timeout: 30000, polling: 20 });
      rec("ekran", "Liste aramayı temizle (Enter → 200 satır)", performance.now() - t2);
      await pause();
      for (let i = 0; i < U.int(1, 2); i += 1) {
        const n = await page.$$eval(`${inv} tr[data-inv]`, l => l.length);
        step("Daha Fazla Göster");
        if (!(await page.$(`${inv} [data-act="more"]`))) break;
        const t3 = performance.now();
        await page.click(`${inv} [data-act="more"]`);
        await page.waitForFunction(({ sel, n }) => document.querySelectorAll(sel).length > n, { sel: `${inv} tr[data-inv]`, n }, { timeout: 30000, polling: 20 });
        rec("ekran", "Daha Fazla Göster (sayfa çevirme)", performance.now() - t3);
        await pause();
      }
    };
    const pending = async () => {
      await openList();
      step("Gönderilecekler");
      const t = performance.now();
      await page.click(`${inv} [data-tab="pending"]`);
      await page.waitForFunction(sel => document.querySelector(`${sel} [data-tab="pending"]`)?.classList.contains("is-on") && (document.querySelector(`${sel} tr[data-inv]`) || document.querySelector(`${sel} .hof-empty`)), inv, { timeout: 30000, polling: 20 });
      rec("ekran", "Gönderilecekler sekmesi", performance.now() - t);
      await pause();
      if (await page.$(`${inv} [data-act="send-pending"]`)) {
        await page.click(`${inv} [data-act="send-pending"]`);
        await page.waitForSelector(`${last} [data-answer="yes"]`);
        await pause(500, 1200);
        const respP = page.waitForResponse(r => /send-pending/.test(r.url()), { timeout: 120000 }).catch(() => null);
        const t2 = performance.now();
        await page.click(`${last} [data-answer="yes"]`);
        const resp = await respP;
        const data = resp ? await resp.json().catch(() => null) : null;
        rec("ekran", "Tümünü Gönder → yanıt", performance.now() - t2, resp?.status() || 0);
        const failed = (data?.data?.results || []).filter(x => !x.ok);
        if (failed.length) issues.ekranHata.push(`${username} Tümünü Gönder: ${failed.length} gönderilemedi: ${failed[0].message?.slice(0, 160)}`);
        await pause();
      }
      await page.click(`${inv} [data-tab="sale"]`).catch(() => null);
      await page.waitForSelector(`${inv} tr[data-inv]`, { timeout: 30000 }).catch(() => null);
    };
    const report = async () => {
      step("rapor");
      await closeAll();
      let t = performance.now();
      await page.click('#hof-sidecard [data-action="analytics"]');
      await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 60000 });
      await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
      await page.waitForSelector(`${modal} [data-rc-list] [data-report="fatura-satis"]`, { timeout: 60000 });
      rec("ekran", "Raporlar açılışı", performance.now() - t);
      await pause();
      t = performance.now();
      await page.click(`${modal} [data-rc-list] [data-report="fatura-satis"]`);
      await page.waitForFunction(m => { const main = document.querySelector(`${m} [data-rc-main]`); return main && main.querySelector("tbody tr") && main.querySelector("tfoot tr"); }, modal, { timeout: 60000, polling: 50 });
      rec("ekran", "Rapor açılışı (Satış Faturaları, Bu Yıl)", performance.now() - t);
      await pause();
      await closeAll();
    };
    while (!stop) {
      const roll = U.next();
      try {
        if (process.env.HATA_IPTAL) { await sale(); await cancel(); } else if (process.env.HATA_AYIKLA || roll < 0.45) await sale();
        else if (roll < 0.55) await purchase();
        else if (roll < 0.62) await ret();
        else if (roll < 0.68) await cancel();
        else if (roll < 0.83) await browseList();
        else if (roll < 0.91) await pending();
        else await report();
      } catch (e) {
        const ekran = await page.evaluate(sel => ({ ara: document.querySelector(`${sel} [data-filter="q"]`)?.value ?? null, satir: document.querySelectorAll(`${sel} tr[data-inv]`).length, not: document.querySelector(`${sel} p.hof-rep-note`)?.textContent || "", sekme: document.querySelector(`${sel} [data-tab].is-on`)?.dataset.tab || "" }), inv).catch(() => null);
        issues.ekranHata.push(`${username} [${u.adim || "?"}]: ${String(e.message || e).split("\n")[0].slice(0, 220)}${ekran ? ` · ekran ${JSON.stringify(ekran)}` : ""}`);
        await page.screenshot({ path: path.join(KOK, `hata-${name}-${username}-${issues.ekranHata.length}.png`) }).catch(() => null);
        await closeAll().catch(() => null);
      }
      await pause();
    }
  };

  log(`düzey ${name}: ${screenUsers} ekran + ${apiUsers} API, ${seconds} sn; sunucu açılış ${Math.round(openMs)} ms`);
  const pages = [];
  for (let i = 1; i <= screenUsers; i += 1) pages.push(await pageOf(`ekran${String(i).padStart(2, "0")}`));
  const loginDone = Date.now();
  const mockSent0 = mock.state.sent.length;
  await server.ask("reset");
  const samples = [];
  const sampler = setInterval(async () => {
    const s = await server.ask("stat");
    const load = readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).map(Number);
    const mem = readFileSync("/proc/meminfo", "utf8");
    const avail = Number(/MemAvailable:\s+(\d+)/.exec(mem)[1]) / 1024;
    samples.push({ t: Date.now(), cpuPct: s.cpuPct, rssMB: s.rssMB, loop: s.loop, load1: load[0], memAvailMB: Math.round(avail) });
    await server.ask("reset");
  }, 15000);
  const t0 = Date.now();
  const tasks = [...pages.map((p, i) => screenLoop(p, i)), ...Array.from({ length: apiUsers }, (_, i) => apiWorker(i + 1))];
  const timer = setTimeout(() => (stop = true), seconds * 1000);
  const minute = setInterval(() => log(`  ${Math.round((Date.now() - t0) / 1000)} sn: ${ops.length} işlem, ${L.created.length} belge, ekran hata ${issues.ekranHata.length}, api hata ${issues.apiHata.length}`), 60000);
  await Promise.all(tasks.map(p => p.catch(e => issues.ekranHata.push(`döngü: ${e.message}`))));
  clearTimeout(timer);
  clearInterval(minute);
  clearInterval(sampler);
  const runMs = Date.now() - t0;
  const perf = {};
  for (const p of pages) perf[p.username] = await p.page.evaluate(() => window.__perf).catch(() => null);
  await browser.close();
  await sleep(1500);

  // ---------- Doğruluk ----------
  const checks = [];
  const check = (ok, what) => { checks.push({ ok: Boolean(ok), what }); console.log(`  ${ok ? "✓" : "✗"} ${what}`); };
  const after = await snapshot();
  const accBad = [];
  for (const id of new Set([...Object.keys(L.acc), ...Object.keys(after.acc)])) {
    const d = (after.acc[id] || 0) - (before.acc[id] || 0);
    if (d !== (L.acc[id] || 0)) accBad.push({ id, program: d / 100, defter: (L.acc[id] || 0) / 100 });
  }
  check(!accBad.length, `cari bakiyeleri: program farkı = bağımsız defter (${Object.keys(L.acc).length} cari değişti; uyuşmayan ${accBad.length}${accBad.length ? ` ${JSON.stringify(accBad.slice(0, 3))}` : ""})`);
  const stBad = [];
  for (const id of new Set([...Object.keys(L.stock), ...Object.keys(after.stock)])) {
    const d = (after.stock[id] || 0) - (before.stock[id] || 0);
    if (d !== (L.stock[id] || 0)) stBad.push({ id, program: d / 1000, defter: (L.stock[id] || 0) / 1000 });
  }
  check(!stBad.length, `stok miktarları: program farkı = bağımsız defter (${Object.keys(L.stock).length} ürün; uyuşmayan ${stBad.length}${stBad.length ? ` ${JSON.stringify(stBad.slice(0, 3))}` : ""})`);
  check(after.gl100 - before.gl100 === L.cash, `Kasa (100): program farkı ${(after.gl100 - before.gl100) / 100} = defter ${L.cash / 100}`);
  check(!L.payMismatch.length, `fatura tutarı: kâhin = program (${L.created.length} belge; uyuşmayan ${L.payMismatch.length}${L.payMismatch.length ? ` ${JSON.stringify(L.payMismatch.slice(0, 3))}` : ""})`);
  const integ = unwrap(await admin.get("/api/workspace/ledger/integrity"));
  check(integ?.ok === true, `Mutabakat Testi (ledger/integrity) ${integ?.ok ? "temiz" : JSON.stringify((integ?.checks || []).filter(c => !c.ok)).slice(0, 400)}`);
  await server.ask("close");
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const newRows = db.prepare("SELECT id, kind, status, number, series, year, seq, issue_date AS d, e_status AS e, profile FROM invoices WHERE rowid > ?").all(maxRowid);
  const createdIds = new Set(L.created.map(c => c.id));
  check(newRows.length === createdIds.size && newRows.every(r => createdIds.has(r.id)), `çift fatura yok: koşuda yazılan ${newRows.length} belge = 200 dönen kayıt ${createdIds.size}`);
  const seqRows = db.prepare("SELECT series, year, seq, number, issue_date AS d FROM invoices WHERE seq > 0 ORDER BY series, year, seq").all();
  const bySeries = {};
  for (const r of seqRows) (bySeries[`${r.series}${r.year}`] ||= []).push(r);
  const numBad = [];
  for (const [k, list] of Object.entries(bySeries)) {
    const numbers = new Set(list.map(r => r.number));
    if (numbers.size !== list.length) numBad.push(`${k}: yinelenen numara`);
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].seq !== list[i - 1].seq + 1) numBad.push(`${k}: boşluk/yineleme ${list[i - 1].seq} → ${list[i].seq}`);
      if (list[i].d < list[i - 1].d) numBad.push(`${k}: tarih sırası ${list[i - 1].number} ${list[i - 1].d} > ${list[i].number} ${list[i].d}`);
    }
  }
  check(!numBad.length, `numaralar: ${Object.keys(bySeries).length} seri/yıl, ${seqRows.length} numaralı belge — benzersiz + boşluksuz + tarih sırası (${numBad.length ? numBad.slice(0, 5).join("; ") : "sorun yok"})`);
  const dupAll = db.prepare("SELECT number, COUNT(*) n FROM invoices WHERE number <> '' AND kind IN ('sale','purchase_return','smm') GROUP BY number HAVING n > 1").all();
  check(!dupAll.length, `kendi numaramızla yinelenen belge yok (${dupAll.length})`);
  const sentIds = mock.state.sent.slice(mockSent0).map(s => s.id);
  check(new Set(sentIds).size === sentIds.length, `sahte EDM: koşuda ${sentIds.length} gönderim, yinelenen numara ${sentIds.length - new Set(sentIds).size}`);
  const waiting = newRows.filter(r => r.e === "waiting").length;
  const eDist = {};
  for (const r of newRows) eDist[`${r.kind}/${r.profile}/${r.status}/${r.e}`] = (eDist[`${r.kind}/${r.profile}/${r.status}/${r.e}`] || 0) + 1;
  db.close();
  await mock.close();

  // ---------- Özet ----------
  const group = who => { const out = {}; for (const o of ops.filter(x => x.who === who)) (out[o.kind] ||= []).push(o); return Object.fromEntries(Object.entries(out).map(([k, l]) => [k, { ...stats(l.map(x => x.ms)), durum: l.reduce((m, x) => ((m[`${x.status}${x.code ? ` ${x.code}` : ""}`] = (m[`${x.status}${x.code ? ` ${x.code}` : ""}`] || 0) + 1), m), {}) }])); };
  const netStats = Object.fromEntries(Object.entries(net).filter(([, l]) => l.length >= 3).map(([k, l]) => [k, stats(l)]).sort((a, b) => b[1].n - a[1].n));
  const writes = ops.filter(o => o.status === 200 && /Satış|Alış|İade Kaydet|Satıştan iade|Kaydet/.test(o.kind) && !/onay sorusu|kart açılışı/.test(o.kind)).length;
  const result = {
    duzey: name, ekran: screenUsers, api: apiUsers, sureSn: Math.round(runMs / 1000), tohum: seed, sunucuAcilisMs: Math.round(openMs),
    makine: { cpu: os.cpus()[0].model, cekirdek: os.cpus().length, bellekGB: Math.round(os.totalmem() / 1e9), node: process.version },
    veri: { faturaOnce: invBefore, cari: customers.length + all.supplier.length, urun: info.items.length },
    ekranOlcum: group("ekran"), apiOlcum: group("api"), ag: netStats, agBayt: Object.fromEntries(Object.entries(netBytes).sort((a, b) => b[1] - a[1])),
    belgeSaniyede: +(L.created.length / (runMs / 1000)).toFixed(2), belgeDakikada: +((L.created.length / runMs) * 60000).toFixed(1), belge: L.created.length, belgeKaynak: L.created.reduce((m, c) => ((m[c.source] = (m[c.source] || 0) + 1), m), {}), bekleyenGonderim: waiting, eDagilim: eDist,
    sunucu: { ornek: samples, cpuOrt: rnd(samples.reduce((a, s) => a + s.cpuPct, 0) / (samples.length || 1)), cpuMax: rnd(Math.max(0, ...samples.map(s => s.cpuPct))), rssMax: rnd(Math.max(0, ...samples.map(s => s.rssMB))), donguP99Max: rnd(Math.max(0, ...samples.map(s => s.loop.p99))), donguMax: rnd(Math.max(0, ...samples.map(s => s.loop.max))), load1Max: Math.max(0, ...samples.map(s => s.load1)) },
    tarayici: perf, issues, checks, gecti: checks.filter(c => c.ok).length, kaldi: checks.filter(c => !c.ok).length, girisBitti: loginDone,
  };
  writeFileSync(path.join(KOK, `sonuc-${name}.json`), JSON.stringify(result, null, 1));
  log(`bitti: ${result.belge} belge (${result.belgeDakikada}/dk), denetim ${result.gecti} geçti / ${result.kaldi} kaldı, ekran hata ${issues.ekranHata.length}, api hata ${issues.apiHata.length}, karakter kaybı ${issues.karakterKaybi.length}`);
  rmSync(work, { recursive: true, force: true });
}
