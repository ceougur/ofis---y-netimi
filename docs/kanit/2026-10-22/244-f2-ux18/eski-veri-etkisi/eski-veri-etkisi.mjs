// 31a F3 eski veri etkisi ölçümü (göç yok: fatura durumu okunurken hesaplanır). Veri v2.4.3 GERÇEK koduyla, API'den üretilir (ders 17);
// aynı verinin kopyaları 2b71fea (aday 4: UX18 + F2 öncesi) ve güncel kodla (F2 + F3) açılıp her faturanın durumu/açığı ve carinin bakiyesi okunur.
// Kullanım: node eski-veri-etkisi.mjs <depo kökü (güncel kod)> <çıktı klasörü> [tohum] [cari sayısı]
import assert from "node:assert/strict";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repo, outDir, seedArg = "7", countArg = "300"] = process.argv.slice(2);
const { CURRENT, bootVersion } = await import(pathToFileURL(path.join(repo, "test", "guvenilirlik", "surumler.mjs")).href);
const SEED = Number(seedArg);
const CUSTOMERS = Number(countArg);
let state = SEED >>> 0;
const rnd = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const cents = value => Math.round(Number(value || 0) * 100);

const root = path.join(outDir, "veri");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const dirs = name => ({ dataDir: path.join(root, name, "data"), backupDir: path.join(root, name, "backups") });

// 1. v2.4.3 ile veri üret.
const facts = { accounts: [], bouncedFree: new Set(), bouncedOwn: new Set(), endorsedBounced: new Set(), counts: {} };
const count = key => (facts.counts[key] = (facts.counts[key] || 0) + 1);
{
  const old = await bootVersion("v2.4.3", dirs("v2.4.3"));
  try {
    const api = await old.login();
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const item = await must("ürün", api.post("/api/workspace/stock", { kind: "service", code: "OLCUM-1", name: "Ölçüm Hizmet", unit: "Adet", salePrice: "100" }));
    const customers = [];
    for (let i = 0; i < CUSTOMERS; i += 1) customers.push(await must("cari", api.post("/api/workspace/accounts", { name: `Ölçüm Müşteri ${i + 1}`, type: "customer", phone: `0500 7${pad(Math.floor(i / 100))} ${pad(Math.floor(i / 10) % 10)}${i % 10} 00` })));
    const suppliers = [];
    for (let i = 0; i < 4; i += 1) suppliers.push(await must("tedarikçi", api.post("/api/workspace/accounts", { name: `Ölçüm Tedarikçi ${i + 1}`, type: "supplier", phone: `0500 800 00 0${i}` })));
    // Faturalar tarih sırasında (seri kronolojisi): 12+ ay, müşteri başına 1–5; bazıları kendi çekiyle (faturanın kendi evrakı).
    const plan = [];
    for (const account of customers) for (let n = int(1, 5); n > 0; n -= 1) plan.push({ account, offset: -int(20, 400), amount: int(5, 60) * 100, own: rnd() < 0.08 });
    for (const account of suppliers) for (let n = int(4, 8); n > 0; n -= 1) plan.push({ account, offset: -int(20, 400), amount: int(5, 40) * 100, purchase: true });
    plan.sort((a, b) => a.offset - b.offset);
    const invoicesOf = new Map();
    let serial = 0;
    for (const entry of plan) {
      const date = day(entry.offset);
      const payment = entry.own ? { cheques: [{ instrument: "cheque", amount: entry.amount, dueDate: day(entry.offset + 60), serialNo: `OWN-${(serial += 1)}`, bank: "Z" }], rest: "open" } : { rest: "open" };
      const body = entry.purchase
        ? { kind: "purchase", scenario: "expense_purchase", accountId: entry.account.id, issueDate: date, number: `OLC-A${(serial += 1)}`, lines: [{ name: "Gider", qty: 1, unitPrice: entry.amount, vatRate: 0, expenseCode: "general" }], payment }
        : { kind: "sale", scenario: "service_sale", accountId: entry.account.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: entry.amount, vatRate: 0 }], payment };
      const doc = await must("fatura", api.post("/api/workspace/invoices", body));
      count(entry.purchase ? "alış faturası" : entry.own ? "satış faturası (kendi çekiyle)" : "satış faturası");
      if (!invoicesOf.has(entry.account.id)) invoicesOf.set(entry.account.id, []);
      invoicesOf.get(entry.account.id).push({ id: doc.id, date, amount: entry.amount, own: entry.own ? `OWN-${serial}` : "" });
    }
    // Tahsilat, bağsız çek/senet, ciro, karşılıksız (2.4.3'te carinin "+ Tahsilat → Çek / Senet" yolu bağsızdı).
    for (const account of customers) {
      const list = invoicesOf.get(account.id) || [];
      const total = list.reduce((sum, inv) => sum + inv.amount, 0);
      const first = Math.min(...list.map(inv => -Math.round((Date.now() - Date.parse(inv.date)) / 864e5)), -1);
      if (rnd() < 0.45) {
        await must("nakit", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: Math.round(total * (0.2 + rnd() * 0.5)), date: day(int(first, -1)), method: "cash", cashForce: true }));
        count("bağsız nakit tahsilat");
      }
      if (rnd() < 0.5) {
        const issue = int(first, -2);
        const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: rnd() < 0.8 ? "cheque" : "note", accountId: account.id, amount: Math.round(total * (0.3 + rnd() * 0.6)), issueDate: day(issue), dueDate: day(issue + 60), serialNo: `FREE-${(serial += 1)}`, bank: "Ziraat" }));
        count("bağsız alınan evrak");
        if (rnd() < 0.15) {
          const supplier = suppliers[int(0, suppliers.length - 1)];
          await must("ciro", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "endorse", accountId: supplier.id, date: day(int(issue, -1)), method: "cash" }));
          count("ciro edilen bağsız evrak");
          if (rnd() < 0.4) {
            await must("karşılıksız", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: day(0), method: "cash" }));
            facts.bouncedFree.add(account.id);
            facts.endorsedBounced.add(supplier.id);
            count("ciro edilmişken karşılıksız (bağsız)");
          }
        } else if (rnd() < 0.15) {
          await must("karşılıksız", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: day(int(issue, 0)), method: "cash" }));
          facts.bouncedFree.add(account.id);
          count("karşılıksız bağsız evrak");
        }
      }
      for (const inv of list.filter(entry => entry.own)) {
        if (rnd() < 0.25) {
          const own = (await must("evrak", api.get(`/api/workspace/cheques?q=${inv.own}`))).cheques.find(row => row.serialNo === inv.own);
          await must("karşılıksız", api.post(`/api/workspace/cheques/${own.id}/actions`, { action: "bounce", date: day(0), method: "cash" }));
          facts.bouncedOwn.add(account.id);
          count("karşılıksız faturanın kendi evrakı");
        }
      }
    }
    facts.accounts = [...customers, ...suppliers].map(account => account.id);
  } finally {
    await old.close();
  }
}
cpSync(path.join(root, "v2.4.3"), path.join(root, "2b71fea"), { recursive: true });
cpSync(path.join(root, "v2.4.3"), path.join(root, "guncel"), { recursive: true });
const snapshot = {};
for (const [name, version] of [["v2.4.3", "v2.4.3"], ["2b71fea", "2b71fea"], ["guncel", CURRENT]]) {
  const server = await bootVersion(version, dirs(name));
  try {
    const api = await server.login();
    const list = (await must("faturalar", api.get("/api/workspace/invoices?limit=5000"))).invoices;
    const balances = {};
    for (const id of facts.accounts) balances[id] = cents((await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    snapshot[name] = { invoices: Object.fromEntries(list.map(row => [row.id, { account: row.accountId, kind: row.kind, open: cents(row.open), payState: row.payState }])), balances, integrity: integrity.ok };
  } finally {
    await server.close();
  }
}
// Karşılaştırma.
const base = snapshot["v2.4.3"];
const report = { tohum: SEED, cari: CUSTOMERS, uretilen: facts.counts, faturaSayisi: Object.keys(base.invoices).length, mutabakat: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, v.integrity])), surumler: {} };
const sideOf = kind => (kind === "purchase" ? -1 : 1);
for (const name of ["2b71fea", "guncel"]) {
  const now = snapshot[name];
  const row = { bakiyeDegisen: 0, acikDegisen: 0, odendidenAciga: 0, aciktanOdendiye: 0, sigmaAcikArtis: 0, kategori: { "bağsız karşılıksız": 0, "kendi evrakı karşılıksız": 0, "ikisi": 0, "ciro edilen tedarikçi": 0, "diğer": 0 } };
  for (const id of facts.accounts) if (base.balances[id] !== now.balances[id]) row.bakiyeDegisen += 1;
  for (const [id, before] of Object.entries(base.invoices)) {
    const after = now.invoices[id];
    if (!after || before.open === after.open) continue;
    row.acikDegisen += 1;
    row.sigmaAcikArtis += (after.open - before.open) * sideOf(before.kind);
    if (before.payState === "paid" && after.payState !== "paid") row.odendidenAciga += 1;
    if (before.payState !== "paid" && after.payState === "paid") row.aciktanOdendiye += 1;
    const a = before.account;
    const key = facts.bouncedFree.has(a) && facts.bouncedOwn.has(a) ? "ikisi" : facts.bouncedFree.has(a) ? "bağsız karşılıksız" : facts.bouncedOwn.has(a) ? "kendi evrakı karşılıksız" : facts.endorsedBounced.has(a) ? "ciro edilen tedarikçi" : "diğer";
    row.kategori[key] += 1;
  }
  row.sigmaAcikArtis = row.sigmaAcikArtis / 100;
  // Σ açık = bakiye denetimi (müşteri: bakiye ≥ 0 iken; faturasız borç yalnız karşılıksız satırı olduğundan eşitlik beklenir).
  let equal = 0;
  let differ = 0;
  for (const id of facts.accounts) {
    const sum = Object.values(now.invoices).filter(inv => inv.account === id && inv.kind === "sale").reduce((total, inv) => total + inv.open, 0);
    const balance = now.balances[id];
    if (!Object.values(now.invoices).some(inv => inv.account === id && inv.kind === "sale") || balance < 0) continue;
    if (sum === balance) equal += 1;
    else differ += 1;
  }
  row.sigmaAcikEsitBakiye = { esit: equal, farkli: differ };
  report.surumler[name] = row;
}
{
  let equal = 0;
  let differ = 0;
  for (const id of facts.accounts) {
    const sum = Object.values(base.invoices).filter(inv => inv.account === id && inv.kind === "sale").reduce((total, inv) => total + inv.open, 0);
    const balance = base.balances[id];
    if (!Object.values(base.invoices).some(inv => inv.account === id && inv.kind === "sale") || balance < 0) continue;
    if (sum === balance) equal += 1;
    else differ += 1;
  }
  report.v243SigmaAcikEsitBakiye = { esit: equal, farkli: differ };
}
writeFileSync(path.join(outDir, `etki-tohum-${SEED}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
rmSync(root, { recursive: true, force: true });
