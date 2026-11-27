#!/usr/bin/env node
// 2.5.1 D3 — GERÇEK VERİ (CLAUDE.md test kuralı: "eski sürüm verisi, o sürümün GERÇEK kodu çalıştırılıp API'sinden girilerek üretilir"; ders 17; tasarım §3.12 (c)).
// v2.5.0'ın GERÇEK kodu (`git worktree add --detach … v2.5.0`; ders 23, 54) 14 aylık veriyi (Aralık 2025 – Ocak 2027; 001 + 002) programın kendi API'siyle üretir; sonra YENİ kod
// aynı veri klasörünü açar (bekleyen göç varsa koşar) ve devir ön izlemesini (iş parçacığı) iki seçenekle hesaplar. Denetlenen:
//   - planın sorunları boş, bütün değişmezler tutar (kitap §6; 590 = Ç6 Dönem Net Kârı; 519 = 519; 153 = DSS; modül = defter);
//   - plan belirlenimli (iki koşu bayt bayt); iki seçenekte açık kalemler ve kuyruğa giren net aynı;
//   - DEVİRSİZ EŞDEĞER: her cari için gecikmiş(t) ve borç tarafı açık kalemleri (vade, kalan) devirli = devirsiz (t = K+1, K+2, 15.01, 20.01, 01.02, 01.03; test/fixtures/devir-d3-esdeger.mjs);
//   - hareket sayıları: ≤K + >K = toplam; 002'nin planı 001'in verisini saymaz.
// Kullanım: node test/devir-d3-gercek-veri.mjs --eski <v2.5.0 kopyası> [--tohum 7] [--cari 300]   (HUKUK_LICENSE_URL=http://127.0.0.1:9 — ders 30)
// Çıktı TAP benzeri ("ok N - …" / "not ok N - …") + sonunda "# tests / pass / fail"; çıkış kodu başarısızlıkta 1.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const OLD = path.resolve(arg("--eski", ""));
const SEED = Number(arg("--tohum", "7"));
const PARTIES = Number(arg("--cari", "300"));
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-20T12:00:00+03:00";
const K = "2026-12-31";
const root = mkdtempSync(path.join(tmpdir(), "d3-gercek-veri-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
// Tohumlu üreteç (mulberry32): aynı tohum → aynı veri.
let state = SEED >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = list => list[Math.floor(rand() * list.length)];
const between = (low, high) => low + Math.floor(rand() * (high - low + 1));
const pad = value => String(value).padStart(2, "0");
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const months = [];
for (let y = 2025, m = 12; y < 2027 || m <= 1; m += 1) {
  if (m > 12) {
    m = 1;
    y += 1;
  }
  months.push([y, m]);
  if (y === 2027 && m === 1) break;
}
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function generate(client, { q = "", parties = PARTIES, suppliers = 40, items = 20, perMonth = 1 }) {
  const ok = async (label, promise) => {
    const res = await promise;
    if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return unwrap(res);
  };
  const customers = [];
  const vendors = [];
  const stock = [];
  for (let i = 0; i < parties; i += 1) customers.push((await ok("cari", client.post(`/api/workspace/accounts${q}`, { name: `Müşteri ${i + 1}`, type: "customer" }))).id);
  for (let i = 0; i < suppliers; i += 1) vendors.push((await ok("tedarikçi", client.post(`/api/workspace/accounts${q}`, { name: `Tedarikçi ${i + 1}`, type: "supplier" }))).id);
  for (let i = 0; i < items; i += 1) stock.push((await ok("ürün", client.post(`/api/workspace/stock${q}`, { name: `Ürün ${i + 1}`, unit: "Adet", unitPrice: String(between(20, 200)), openingQty: String(between(50, 400)), openingDate: "2025-12-01" }))).id);
  const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
  let sales = 0;
  let lines = 0;
  for (const [y, m] of months) {
    const days = Array.from({ length: 28 }, (_, index) => `${y}-${pad(m)}-${pad(index + 1)}`).filter(day => day <= "2027-01-20");
    const events = [];
    for (let i = 0; i < Math.round(parties * 0.4 * perMonth); i += 1) events.push({ kind: "sale", day: pick(days) });
    for (let i = 0; i < Math.round(suppliers * 0.5 * perMonth); i += 1) events.push({ kind: "purchase", day: pick(days) });
    for (let i = 0; i < Math.round(parties * 0.3 * perMonth); i += 1) events.push({ kind: "in", day: pick(days) });
    for (let i = 0; i < Math.round(suppliers * 0.3 * perMonth); i += 1) events.push({ kind: "out", day: pick(days) });
    for (let i = 0; i < Math.round(parties * 0.08 * perMonth); i += 1) events.push({ kind: "debt", day: pick(days) });
    for (let i = 0; i < 6; i += 1) events.push({ kind: "cash", day: pick(days) });
    // Satış belgeleri tarih sırasıyla (numara ↔ tarih kronolojisi); aynı gün içinde üretim sırası.
    events.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    for (const event of events) {
      const day = event.day;
      if (event.kind === "sale") {
        const due = rand() < 0.2 ? "" : addDays(day, pick([0, 15, 30, 45, 60, 90]));
        await ok("satış", client.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: pick(customers), issueDate: day, lines: [{ itemId: pick(stock), name: "", qty: between(1, 5), unitPrice: between(50, 400), discountRate: 0, vatRate: pick([1, 10, 20]) }], payment: due ? { ...pay, dueDate: due } : pay, force: true, stockForce: true }));
        sales += 1;
      } else if (event.kind === "purchase") {
        await ok("alış", client.post(`/api/workspace/invoices${q}`, { kind: "purchase", accountId: pick(vendors), number: `AL-${y}${pad(m)}-${lines}`, issueDate: day, lines: [{ itemId: pick(stock), name: "", qty: between(5, 30), unitPrice: between(15, 150), discountRate: 0, vatRate: 20 }], payment: rand() < 0.7 ? { ...pay, dueDate: addDays(day, pick([10, 30, 60])) } : pay, force: true }));
      } else if (event.kind === "in") {
        await ok("tahsilat", client.post(`/api/workspace/accounts/${pick(customers)}/entries${q}`, { kind: "in", amount: String(between(50, 1500)), date: day, note: "Tahsilat" }));
      } else if (event.kind === "out") {
        await ok("ödeme", client.post(`/api/workspace/accounts/${pick(vendors)}/entries${q}`, { kind: "out", amount: String(between(100, 2500)), date: day, note: "Ödeme", cashForce: true }));
      } else if (event.kind === "debt") {
        const due = rand() < 0.5 ? addDays(day, pick([10, 40, 70])) : "";
        await ok("borç yaz", client.post(`/api/workspace/accounts/${pick(customers)}/entries${q}`, { kind: "debt", amount: String(between(30, 600)), date: day, note: "Hizmet", ...(due ? { dueDate: due, ...(rand() < 0.5 ? { expectedDate: addDays(day, 5) } : {}) } : {}) }));
      } else {
        await ok("kasa", client.post(`/api/workspace/cash${q}`, { kind: rand() < 0.6 ? "in" : "out", amount: String(between(20, 300)), description: "Kasa", date: day, force: true }));
      }
      lines += 1;
    }
  }
  return { customers, vendors, stock, sales, lines };
}

const oldHelpers = await import(pathToFileURL(path.join(OLD, "test/helpers.mjs")).href);
const newHelpers = await import(pathToFileURL(path.join(NEW, "test/helpers.mjs")).href);
const started = Date.now();
let server = await oldHelpers.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
let admin = await oldHelpers.loginAdmin(server);
const first = await generate(admin, {});
const created = unwrap(await admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
const secondId = created?.id || created?.company?.id;
const second = await generate(admin, { q: `?hofCompany=${encodeURIComponent(secondId)}`, parties: Math.round(PARTIES / 3), suppliers: 10, items: 8 });
console.log(`# v2.5.0 verisi: 001 ${first.customers.length} müşteri + ${first.vendors.length} tedarikçi, ${first.lines} işlem; 002 ${second.lines} işlem; ${Math.round((Date.now() - started) / 1000)} sn`);
server.close();
await new Promise(resolve => setTimeout(resolve, 500));

// ---- YENİ kod ----
server = await newHelpers.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
admin = await newHelpers.loginAdmin(server);
const fixture = await import(pathToFileURL(path.join(NEW, "test/fixtures/devir-d3-esdeger.mjs")).href);
async function preview(body) {
  const res = await admin.post("/api/admin/devir/preview", body);
  if (res.status !== 200) return { state: "failed", error: res.data };
  for (;;) {
    const job = unwrap(await admin.get(`/api/admin/devir/preview/${unwrap(res).id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
for (const [company, label, store] of [["sirket-001", "001", () => server.app.store], [secondId, "002", null]]) {
  const a = await preview({ company, cutoff: K, option: "borc-alacak" });
  const b = await preview({ company, cutoff: K, option: "borc-alacak" });
  const c = await preview({ company, cutoff: K, option: "sadece-bakiye" });
  check(a.state === "done" && b.state === "done" && c.state === "done", `${label}: üç ön izleme bitti (${a.state}/${b.state}/${c.state}) ${JSON.stringify(a.error || "").slice(0, 300)}`);
  if (a.state !== "done") continue;
  const plan = a.result.plan;
  check(plan.sorunlar.length === 0, `${label}: planın sorunu yok ${JSON.stringify(plan.sorunlar).slice(0, 400)}`);
  const broken = plan.degismezler.filter(row => !row.ok);
  check(broken.length === 0, `${label}: bütün değişmezler tutar (${plan.degismezler.length}) ${JSON.stringify(broken)}`);
  check(JSON.stringify(plan) === JSON.stringify(b.result.plan), `${label}: iki koşu bayt bayt aynı plan`);
  const stop = a.result.onDenetim.durdurur.map(row => row.kod);
  check(stop.length === 0, `${label}: ön denetimde DURDURUR yok (${stop.join(", ")})`);
  const sameOpen = plan.newYear.cariler.every(row => {
    const other = c.result.plan.newYear.cariler.find(item => item.cari === row.cari && item.hesap === row.hesap);
    return other && JSON.stringify(other.satirlar.filter(line => line.tur === "acik-kalem")) === JSON.stringify(row.satirlar.filter(line => line.tur === "acik-kalem")) && other.netMinor === row.netMinor;
  });
  check(sameOpen, `${label}: iki seçenekte açık kalemler ve net aynı`);
  const counts = plan.newYear.budama.filter(row => row.sinif === "B").every(row => row.kOncesi + row.kSonrasi === row.toplam);
  check(counts, `${label}: B tablolarında ≤K + >K = devir öncesi`);
  const s = plan.sayilar;
  console.log(`# ${label}: cari ${s.cariKarti} kart / ${s.cariAcilis} açılış · açık fatura satış ${s.acikFatura.satis} (${s.acikFatura.satisMinor / 100}) alış ${s.acikFatura.alis} · açık kalem ${s.acikKalem.borc} · stok ${s.stok.urun} ürün ${s.stok.degerMinor / 100} · kasa ${s.kasaMinor / 100} · Dönem Net Kârı ${plan.archive.donemSonucuMinor / 100} · hareket ≤K ${s.hareket.budanacak} >K ${s.hareket.tasinacak} · süre ${JSON.stringify(a.result.zamanlama)}`);
  if (!store) {
    check(!plan.newYear.cariler.some(row => first.customers.includes(row.cari)), "002: 001'in carileri planda yok");
    continue;
  }
  const eq = fixture.createEquivalence(store());
  const days = ["2027-01-01", "2027-01-02", "2027-01-15", "2027-01-20", "2027-02-01", "2027-03-01"];
  let compared = 0;
  const diffs = [];
  for (const option of [a, c]) {
    for (const row of option.result.plan.newYear.cariler) {
      for (const out of eq.compare(row.cari, row, K, days)) {
        compared += 1;
        if (out.devirli !== out.devirsiz || JSON.stringify(out.kalemDevirli) !== JSON.stringify(out.kalemDevirsiz) || out.sinceDevirli !== out.sinceDevirsiz) diffs.push({ cari: row.cari, ...out });
      }
    }
  }
  check(diffs.length === 0, `${label}: devirsiz eşdeğer — ${compared} karşılaştırma (cari × gün × seçenek), fark ${diffs.length} ${JSON.stringify(diffs.slice(0, 3)).slice(0, 600)}`);
}
server.close();
console.log(`# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
