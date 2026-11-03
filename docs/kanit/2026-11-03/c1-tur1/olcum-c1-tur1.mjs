// C1 TUR 1 hız ölçümü (ders 47; dar kontrol ORTA-1). Ürün kodu DEĞİŞMEZ; yalnız ölçer. Veri: olcum-veri-uret.mjs (programın kendi API'si, 35e90e47 kodu;
// 600 KDV'li EFT masraf fişi, 2.000 POS tahsilatı, 3 POS İptal İadesi; pos_sales ham satırla 100.000). Her koşu verinin TAZE kopyasında (ders 15).
// Kod: --kod ile verilen ayrı kopya (git archive; ders 23): 35e90e47 (C1 öncesi), eaf6b988 (C1, düzeltmesiz), fe5bcf27 (C1 tur 1).
// Sunucu üretime yakın (gateVerify / moneyStrict kapalı, rapor iş parçacığı açık), sahte duran saat 09.10.2026 12:00, lisans servisi ölü adres (ders 30).
// Olay döngüsü: aynı süreçte 1 ms aralıklı setInterval — iki tetik arası en uzun boşluk (monitorEventLoopDelay'e güvenilmez; C1 dar kontrol DÜŞÜK-4).
// Eşdeğerlik: her carinin kartı (GET /accounts/:id) ve fatura listeleri SHA-256 özeti + hareket sayacının çıktısı (modül varsa) JSON'a yazılır; sürümler
// arası karşılaştırma olcum-karsilastir.mjs ile.
// Kullanım: flock <kilit> node olcum-c1-tur1.mjs --kod <kopya> --taban <veri-taban> --is <iş klasörü> --json <çıktı> --etiket <ad> [--n 10]
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const arg = (name, fallback = "") => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const kod = path.resolve(arg("kod"));
const taban = path.resolve(arg("taban"));
const is = path.resolve(arg("is"));
const jsonOut = path.resolve(arg("json"));
const etiket = arg("etiket", path.basename(kod));
const N = Number(arg("n", "10"));
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const yuzdelik = (l, p) => {
  const s = l.slice().sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 100) / 100 : null;
};
const ozet = l => ({ n: l.length, p50: yuzdelik(l, 50), p95: yuzdelik(l, 95), enCok: l.length ? Math.round(Math.max(...l) * 100) / 100 : null });
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const veri = JSON.parse(readFileSync(path.join(taban, "veri.json"), "utf8"));
rmSync(is, { recursive: true, force: true });
mkdirSync(is, { recursive: true });
cpSync(path.join(taban, "data"), path.join(is, "data"), { recursive: true });
if (existsSync(path.join(taban, "backups"))) cpSync(path.join(taban, "backups"), path.join(is, "backups"), { recursive: true });
const { startTestServer, createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(kod, "test/helpers.mjs")).href);
const lib = path.join(kod, "server/lib/account-movements.mjs");
const movements = existsSync(lib) ? await import(pathToFileURL(lib).href) : null;

// Olay döngüsü ölçer: 1 ms'lik tetikler arasındaki en uzun boşluk (ms).
let last = performance.now();
let gap = 0;
const timer = setInterval(() => {
  const t = performance.now();
  gap = Math.max(gap, t - last);
  last = t;
}, 1);
async function olc(fn) {
  await tick(5);
  gap = 0;
  last = performance.now();
  const s = performance.now();
  const r = await fn();
  const ms = performance.now() - s;
  await tick(25); // döngüyü kilitleyen son işin boşluğu, gecikmiş tetik bir kez daha çalışınca ölçüme girer
  return { ms, dongu: gap, r };
}
async function evre(ad, fn) {
  for (let i = 0; i < 2; i += 1) await fn(); // ısınma (ölçüme girmez)
  const sure = [];
  const dongu = [];
  let ilk = null;
  for (let i = 0; i < N; i += 1) {
    const m = await olc(fn);
    sure.push(m.ms);
    dongu.push(m.dongu);
    ilk ??= m.r;
  }
  log(ad, "süre", JSON.stringify(ozet(sure)), "döngü en çok", Math.round(Math.max(...dongu) * 100) / 100);
  return { sure: ozet(sure), donguEnCok: Math.round(Math.max(...dongu) * 100) / 100, dongu: ozet(dongu), ilk };
}

const t0 = performance.now();
const server = await startTestServer({ dataDir: path.join(is, "data"), backupDir: path.join(is, "backups"), now: { time: "2026-10-09T12:00:00+03:00", fixed: true }, gateVerify: false, moneyStrict: false, reportWorker: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const acilisMs = Math.round(performance.now() - t0);
const client = createClient(server.base);
const giris = await client.login("admin", ADMIN_PASSWORD);
if (giris.status !== 200) throw new Error(`giriş: ${giris.status} ${JSON.stringify(giris.data).slice(0, 200)}`);
const store = server.app.store;
const sonuc = { etiket, kod, acilisMs, node: process.version, yuk: loadavg().map(v => Math.round(v * 100) / 100), veri: veri.facts, N };
const get = async (label, url) => {
  const res = await client.get(url);
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return res.data?.data ?? res.data;
};
try {
  const { bankParty, posCustomers, cancelCustomers } = veri.ids;
  const A = await evre("A banka carisi kartı (600 masraf fişi + 600 fatura)", () => get("kart", `/api/workspace/accounts/${bankParty}`));
  const B = await evre("B fatura listesi (Alış)", () => get("fatura listesi alış", "/api/workspace/invoices?kind=purchase&limit=200"));
  const B2 = await evre("B2 fatura listesi (hepsi)", () => get("fatura listesi", "/api/workspace/invoices?limit=200"));
  const C = await evre("C POS İptal İadeli cari kartı", () => get("kart", `/api/workspace/accounts/${cancelCustomers[0]}`));
  const D = await evre("D POS müşterisi kartı (100 POS tahsilatı)", () => get("kart", `/api/workspace/accounts/${posCustomers[0]}`));
  sonuc.evreler = {
    bankaKarti: { sure: A.sure, donguEnCok: A.donguEnCok, deleteBlock: A.ilk.deleteBlock },
    faturaListesiAlis: { sure: B.sure, donguEnCok: B.donguEnCok, satir: (B.ilk.items || B.ilk.rows || []).length, toplam: B.ilk.total },
    faturaListesiHepsi: { sure: B2.sure, donguEnCok: B2.donguEnCok, toplam: B2.ilk.total },
    iptalIadeliKart: { sure: C.sure, donguEnCok: C.donguEnCok, deleteBlock: C.ilk.deleteBlock },
    posMusteriKarti: { sure: D.sure, donguEnCok: D.donguEnCok, deleteBlock: D.ilk.deleteBlock },
  };
  // Eşdeğerlik: her carinin kartı (tam çıktı özeti) ve fatura listeleri; hareket sayacı (modül varsa) her cari için tam çıktı.
  const ids = store.all("SELECT id FROM accounts ORDER BY id").map(row => row.id);
  sonuc.esdegerlik = { kart: {}, sayac: {}, faturaListesiAlis: sha(B.ilk), faturaListesiHepsi: sha(B2.ilk) };
  for (const id of ids) sonuc.esdegerlik.kart[id] = sha(await get("kart", `/api/workspace/accounts/${id}`));
  if (movements) {
    const s = performance.now();
    for (const id of ids) sonuc.esdegerlik.sayac[id] = movements.accountMovements(store, id);
    sonuc.sayacTumCarilerMs = Math.round((performance.now() - s) * 100) / 100;
    const s2 = performance.now();
    const index = movements.openTrashAccounts(store);
    for (const id of ids) movements.accountMovements(store, id, { includeDeleted: true, trashIndex: index });
    sonuc.sayacKaliciSilmeTumCarilerMs = Math.round((performance.now() - s2) * 100) / 100;
  }
} finally {
  clearInterval(timer);
  await server.close();
  rmSync(is, { recursive: true, force: true });
}
writeFileSync(jsonOut, `${JSON.stringify(sonuc, null, 1)}\n`);
log("yazıldı", jsonOut);
console.log(`# tests 1\n# pass 1\n# fail 0`);
