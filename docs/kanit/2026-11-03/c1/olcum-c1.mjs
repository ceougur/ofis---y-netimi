// 2.4.9 C1 — hız ölçümü (ders 47; tasarım notu §7 "kart açılışına ≤ 5 ms ek", §10.1 ölçüm satırı). Ürün kodu DEĞİŞMEZ; yalnız ölçer.
// VERİ: programın KENDİ API'siyle üretilmiş 2.4.7 verisi (tools/olcek-210.mjs --asama veri, 29.10.2026; 001'de 3.014 cari / ~100.000 para satırı) — her koşu
// verinin TAZE kopyasında (önce/sonra AYNI veri; ders 15). Kod: --kod ile verilen ayrı kopya (git archive; ders 23) — eski (35e90e47) ya da yeni (C1).
// Sunucu üretime yakın ayarlarla (gateVerify / moneyStrict kapalı, rapor iş parçacığı açık), lisans servisi ölü adres (ders 30). Ölçüm tek başına: flock ile sarılır.
// Evreler: A cari kartı (GET /accounts/:id; deleteBlock dahil) — örnek: en çok satırlı 200 cari + kalanın her 10.'su; B (yalnız yeni kod) accountMovements
// doğrudan, bütün cariler; C Sil (DELETE /accounts/:id) aynı örnekte; D Taksit aktarımını Geri Al (Excel'den 2.000 kişilik taksit yüklemesi → Geri Al).
// Her evrede süre p50/p95/en çok ve olay döngüsü gecikmesi en çok (monitorEventLoopDelay; sunucu aynı süreçte — tek ağır istek döngüyü kilitler).
// Kullanım: flock /tmp/destekofis-olcum.lock node olcum-c1.mjs --kod <kopya> --taban <veri klasörü (data/, backups/)> --is <iş klasörü> --json <çıktı> --etiket <ad>
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const arg = (name, fallback = "") => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const kod = path.resolve(arg("kod"));
const taban = path.resolve(arg("taban"));
const is = path.resolve(arg("is"));
const jsonOut = arg("json");
const etiket = arg("etiket", path.basename(kod));
const PASS = "Olcek-210-Yonetici!";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const yuzdelik = (l, p) => {
  const s = l.slice().sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 100) / 100 : null;
};
const ozet = l => ({ n: l.length, p50: yuzdelik(l, 50), p95: yuzdelik(l, 95), enCok: l.length ? Math.round(Math.max(...l) * 100) / 100 : null, toplam: Math.round(l.reduce((a, b) => a + b, 0)) });
// Son isteğin döngüyü kilitlediği süre, gecikmiş zamanlayıcı bir kez daha çalışınca ölçüme girer (yoksa yanıtın devamı disable()'ı önce çalıştırır).
const tick = () => new Promise(resolve => setTimeout(resolve, 25));
let denetimGecti = 0;
let denetimKaldi = 0;
const denetim = (kosul, ne) => {
  if (kosul) denetimGecti += 1;
  else denetimKaldi += 1;
  log(`${kosul ? "✓" : "✗"} ${ne}`);
};

rmSync(is, { recursive: true, force: true });
mkdirSync(is, { recursive: true });
cpSync(path.join(taban, "data"), path.join(is, "data"), { recursive: true });
if (existsSync(path.join(taban, "backups"))) cpSync(path.join(taban, "backups"), path.join(is, "backups"), { recursive: true });
const { startTestServer, createClient } = await import(pathToFileURL(path.join(kod, "test/helpers.mjs")).href);
const lib = path.join(kod, "server/lib/account-movements.mjs");
const movements = existsSync(lib) ? await import(pathToFileURL(lib).href) : null;
const t0 = performance.now();
const server = await startTestServer({ dataDir: path.join(is, "data"), backupDir: path.join(is, "backups"), adminPassword: PASS, gateVerify: false, moneyStrict: false, reportWorker: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const acilisMs = Math.round(performance.now() - t0);
const client = createClient(server.base);
const giris = await client.login("admin", PASS);
if (giris.status !== 200) throw new Error(`giriş: ${giris.status} ${JSON.stringify(giris.data).slice(0, 200)}`);
const store = server.app.store;
const sonuc = { etiket, kod, acilisMs, node: process.version };
try {
  const rows = store.all("SELECT a.id, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = a.id) AS n FROM accounts a WHERE a.deleted_at IS NULL ORDER BY n DESC, a.id");
  const ornek = [...rows.slice(0, 200), ...rows.slice(200).filter((_, i) => i % 10 === 0)].map(row => row.id);
  sonuc.veri = { cari: rows.length, cariSatiri: store.get("SELECT COUNT(*) AS n FROM account_entries").n, enCokSatirliCari: rows[0]?.n ?? 0, ornek: ornek.length, fatura: store.get("SELECT COUNT(*) AS n FROM invoices").n, cek: store.get("SELECT COUNT(*) AS n FROM cheques").n, kart: store.get("SELECT COUNT(*) AS n FROM plans").n, finEvents: store.get("SELECT COUNT(*) AS n FROM fin_events").n };
  log("veri", JSON.stringify(sonuc.veri), "açılış", acilisMs, "ms");
  for (const id of ornek.slice(0, 20)) await client.get(`/api/workspace/accounts/${id}`); // ısınma (ölçülmez)

  const evre = async (ad, ids, istek) => {
    const sureler = [];
    const durumlar = {};
    const kodlar = {};
    const dongu = monitorEventLoopDelay({ resolution: 5 });
    dongu.enable();
    for (const id of ids) {
      const t = performance.now();
      const res = await istek(id);
      sureler.push(performance.now() - t);
      durumlar[res.status] = (durumlar[res.status] || 0) + 1;
      if (res.status !== 200) kodlar[res.data?.code || "?"] = (kodlar[res.data?.code || "?"] || 0) + 1;
    }
    await tick();
    dongu.disable();
    const out = { ...ozet(sureler), durumlar, kodlar,olayDongusuEnCokMs: Math.round(dongu.max / 1e6), olayDongusuP99Ms: Math.round(dongu.percentile(99) / 1e6) };
    log(ad, JSON.stringify(out));
    return out;
  };
  // A: cari kartı (Sil'in nedeni kartta hesaplanır: deleteBlock).
  sonuc.kartAcilisi = await evre("A kart", ornek, id => client.get(`/api/workspace/accounts/${id}`));
  denetim(sonuc.kartAcilisi.durumlar[200] === ornek.length, `A: ${ornek.length} kartın hepsi 200`);
  // B: hareket sayımının kendisi (yalnız C1 kodunda), bütün cariler, doğrudan çağrı.
  if (movements) {
    const sureler = [];
    let hareketli = 0;
    const dongu = monitorEventLoopDelay({ resolution: 5 });
    dongu.enable();
    for (const row of rows) {
      const t = performance.now();
      const found = movements.accountMovements(store, row.id);
      sureler.push(performance.now() - t);
      if (found.total > 0) hareketli += 1;
    }
    dongu.disable();
    sonuc.hareketSayimi = { ...ozet(sureler), hareketli, hareketsiz: rows.length - hareketli, olayDongusuEnCokMs: Math.round(dongu.max / 1e6) };
    log("B accountMovements", JSON.stringify(sonuc.hareketSayimi));
  }
  // C: Sil (aynı örnek). Eski kodda hareketli carilerin çoğu silinir (200) — süre karşılaştırması içindir; veri bu kopyada değişir, sonraki evre ayrıdır.
  const beklenen = movements ? new Map(ornek.map(id => [id, movements.accountMovements(store, id).total > 0 ? 409 : 200])) : null;
  sonuc.sil = await evre("C sil", ornek, async id => {
    const res = await client.del(`/api/workspace/accounts/${id}`);
    if (beklenen && res.status !== beklenen.get(id)) denetim(false, `C: ${id} beklenen ${beklenen.get(id)}, gelen ${res.status} ${JSON.stringify(res.data).slice(0, 120)}`);
    return res;
  });
  if (beklenen) denetim([...beklenen.values()].filter(code => code === 409).length === (sonuc.sil.durumlar[409] || 0), `C: hareketli ${sonuc.sil.durumlar[409] || 0} cari 409, hareketsiz ${sonuc.sil.durumlar[200] || 0} cari 200 (yardımcıyla aynı)`);
  // D: Taksit aktarımını Geri Al — 2.000 kişilik Excel taksit yüklemesi (aktarım 2.000 cari açar) → Geri Al (her cari için kalıcı silme denetimi).
  const ilkVade = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return `01.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  })();
  const matrix = [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade"], ...Array.from({ length: 2000 }, (_, i) => [`C1 Ölçüm Kişi ${String(i + 1).padStart(4, "0")}`, "1200", "3", ilkVade])];
  let t = performance.now();
  const yuk = await client.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue" }, fileName: "c1-olcum.xlsx", linkRecords: false });
  const yukMs = Math.round(performance.now() - t);
  const yukData = yuk.data?.data || yuk.data;
  denetim(yuk.status === 200 && yukData.created === 2000, `D: Excel taksit yüklemesi ${yuk.status}, ${yukData?.created} kart (${yukMs} ms)`);
  const dongu = monitorEventLoopDelay({ resolution: 5 });
  dongu.enable();
  t = performance.now();
  const geri = await client.post(`/api/workspace/plans/imports/${yukData.importId}/undo`, {});
  const geriMs = Math.round(performance.now() - t);
  await tick();
  dongu.disable();
  const geriData = geri.data?.data || geri.data;
  sonuc.geriAl = { durum: geri.status, sureMs: geriMs, olayDongusuEnCokMs: Math.round(dongu.max / 1e6), rapor: geriData };
  log("D geri al", JSON.stringify(sonuc.geriAl));
  denetim(geri.status === 200 && geriData.accounts + geriData.accountsKept === 2000, `D: Geri Al ${geri.status}; kalıcı silinen ${geriData?.accounts} + kalan ${geriData?.accountsKept} = 2.000`);
} finally {
  await server.close();
  rmSync(is, { recursive: true, force: true });
}
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(sonuc, null, 2)}\n`);
console.log(`\n${denetimGecti} denetim geçti, ${denetimKaldi} başarısız`);
process.exit(denetimKaldi ? 1 : 0);
