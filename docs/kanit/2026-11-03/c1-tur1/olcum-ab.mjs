// C1 TUR 1 hız ölçümü — AYNI SÜREÇTE A/B (ders 15, 47). olcum-c1-tur1.mjs süreçler arası ayrı koşuldu; 50–80 ms'lik banka carisi kartında süreç
// gürültüsü (JIT/GC, makinedeki öbür yük) ±20 ms veriyordu (olcum-karsilastirma: tur 1 +22 ms, tur 2 +18 ms; aynı veride sayaç ayrıntısı +0,1 ms detail).
// Burada iki kod kopyası (A = C1 öncesi 35e90e47, B = düzeltilmiş kod) aynı süreçte, AYNI verinin iki taze kopyasıyla açılır; istekler sırayla ve
// dönüşümlü (ABAB… / BABA…) gönderilir, böylece makine yükü iki tarafa eşit düşer. Ürün kodu DEĞİŞMEZ; yalnız ölçer.
// Olay döngüsü: 1 ms aralıklı setInterval — istek süresince iki tetik arası en uzun boşluk.
// Kullanım: flock <kilit> node olcum-ab.mjs --a <kopya A> --b <kopya B> --taban <veri-taban> --is <iş klasörü> --json <çıktı> [--n 60]
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const arg = (name, fallback = "") => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const kodA = path.resolve(arg("a"));
const kodB = path.resolve(arg("b"));
const taban = path.resolve(arg("taban"));
const is = path.resolve(arg("is"));
const jsonOut = path.resolve(arg("json"));
const N = Number(arg("n", "60"));
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const veri = JSON.parse(readFileSync(path.join(taban, "veri.json"), "utf8"));
const yuzdelik = (l, p) => {
  const s = l.slice().sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 100) / 100 : null;
};
const ozet = l => ({ n: l.length, p50: yuzdelik(l, 50), p95: yuzdelik(l, 95), enCok: l.length ? Math.round(Math.max(...l) * 100) / 100 : null });
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));

rmSync(is, { recursive: true, force: true });
mkdirSync(is, { recursive: true });
let last = performance.now();
let gap = 0;
const timer = setInterval(() => {
  const t = performance.now();
  gap = Math.max(gap, t - last);
  last = t;
}, 1);

async function open(ad, kod) {
  const dir = path.join(is, ad);
  cpSync(path.join(taban, "data"), path.join(dir, "data"), { recursive: true });
  const { startTestServer, createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(kod, "test/helpers.mjs")).href);
  const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-10-09T12:00:00+03:00", fixed: true }, gateVerify: false, moneyStrict: false, reportWorker: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = createClient(server.base);
  const giris = await client.login("admin", ADMIN_PASSWORD);
  if (giris.status !== 200) throw new Error(`${ad} giriş: ${giris.status}`);
  return { ad, kod, server, client };
}
const sides = [await open("A", kodA), await open("B", kodB)];
const sonuc = { A: kodA, B: kodB, N, node: process.version, yukBasta: loadavg().map(v => Math.round(v * 100) / 100), evreler: {} };
async function istek(side, url) {
  await tick(3);
  gap = 0;
  last = performance.now();
  const s = performance.now();
  const res = await side.client.get(url);
  const ms = performance.now() - s;
  await tick(15);
  if (res.status !== 200) throw new Error(`${side.ad} ${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 160)}`);
  return { ms, dongu: gap };
}
async function evre(ad, url) {
  for (const side of sides) for (let i = 0; i < 3; i += 1) await istek(side, url); // ısınma
  const olcum = { A: { sure: [], dongu: [] }, B: { sure: [], dongu: [] } };
  for (let i = 0; i < N; i += 1) {
    const order = i % 2 ? [sides[1], sides[0]] : [sides[0], sides[1]];
    for (const side of order) {
      const m = await istek(side, url);
      olcum[side.ad].sure.push(m.ms);
      olcum[side.ad].dongu.push(m.dongu);
    }
  }
  const row = { A: { sure: ozet(olcum.A.sure), dongu: ozet(olcum.A.dongu) }, B: { sure: ozet(olcum.B.sure), dongu: ozet(olcum.B.dongu) } };
  row.farkP50 = Math.round((row.B.sure.p50 - row.A.sure.p50) * 100) / 100;
  row.farkP95 = Math.round((row.B.sure.p95 - row.A.sure.p95) * 100) / 100;
  // Eşleşik fark: aynı turdaki A ve B isteklerinin farkının ortancası (yük dalgalanmasını iki tarafa eşit böler).
  const pairs = olcum.A.sure.map((a, i) => olcum.B.sure[i] - a);
  row.eslesikFarkP50 = yuzdelik(pairs, 50);
  sonuc.evreler[ad] = row;
  console.log(ad, JSON.stringify({ A: row.A.sure, B: row.B.sure, farkP50: row.farkP50, farkP95: row.farkP95, eslesikFarkP50: row.eslesikFarkP50, donguEnCokA: row.A.dongu.enCok, donguEnCokB: row.B.dongu.enCok }));
}
try {
  const { bankParty, posCustomers, cancelCustomers } = veri.ids;
  await evre("bankaKarti", `/api/workspace/accounts/${bankParty}`);
  await evre("faturaListesiAlis", "/api/workspace/invoices?kind=purchase&limit=200");
  await evre("faturaListesiHepsi", "/api/workspace/invoices?limit=200");
  await evre("iptalIadeliKart", `/api/workspace/accounts/${cancelCustomers[0]}`);
  await evre("posMusteriKarti", `/api/workspace/accounts/${posCustomers[0]}`);
  // detail() doğrudan (HTTP/JSON yok), aynı süreçte dönüşümlü: kartın sunucu tarafı.
  const detailOf = side => {
    const store = side.server.app.store;
    const admin = store.get("SELECT * FROM users WHERE username = 'admin'");
    return () => side.server.app.context.accounts.detail(bankParty, admin);
  };
  const fns = { A: detailOf(sides[0]), B: detailOf(sides[1]) };
  for (let i = 0; i < 5; i += 1) {
    fns.A();
    fns.B();
  }
  const d = { A: [], B: [] };
  for (let i = 0; i < N; i += 1) {
    for (const ad of i % 2 ? ["B", "A"] : ["A", "B"]) {
      const s = performance.now();
      fns[ad]();
      d[ad].push(performance.now() - s);
    }
  }
  sonuc.bankaKartiDetail = { A: ozet(d.A), B: ozet(d.B), farkP50: Math.round((ozet(d.B).p50 - ozet(d.A).p50) * 100) / 100 };
  console.log("bankaKartiDetail", JSON.stringify(sonuc.bankaKartiDetail));
} finally {
  clearInterval(timer);
  for (const side of sides) await side.server.close();
  rmSync(is, { recursive: true, force: true });
}
sonuc.yukSonda = loadavg().map(v => Math.round(v * 100) / 100);
const butce = 5;
const lines = [];
for (const ad of ["bankaKarti", "iptalIadeliKart", "posMusteriKarti"]) {
  const row = sonuc.evreler[ad];
  lines.push(`${row.farkP50 <= butce && row.farkP95 <= butce ? "✓" : "✗"} ${ad}: kart açılışı C1 öncesine göre p50 ${row.farkP50} ms, p95 ${row.farkP95} ms, eşleşik ${row.eslesikFarkP50} ms (bütçe ≤ +${butce} ms)`);
}
for (const ad of ["faturaListesiAlis", "faturaListesiHepsi"]) {
  const row = sonuc.evreler[ad];
  lines.push(`${row.farkP50 <= butce ? "✓" : "✗"} ${ad}: fatura listesi C1 öncesine döndü — p50 ${row.A.sure.p50} → ${row.B.sure.p50} ms (fark ${row.farkP50} ms, p95 ${row.farkP95} ms)`);
}
lines.push(`${sonuc.bankaKartiDetail.farkP50 <= butce ? "✓" : "✗"} bankaKartiDetail (sunucu tarafı, HTTP'siz): p50 ${sonuc.bankaKartiDetail.A.p50} → ${sonuc.bankaKartiDetail.B.p50} ms`);
sonuc.hukum = lines;
writeFileSync(jsonOut, `${JSON.stringify(sonuc, null, 1)}\n`);
console.log(`yük başta ${sonuc.yukBasta} · sonda ${sonuc.yukSonda}`);
for (const line of lines) console.log(line);
const fail = lines.filter(line => line.startsWith("✗")).length;
console.log(`# tests ${lines.length}\n# pass ${lines.length - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
