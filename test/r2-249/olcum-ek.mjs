// 2.4.9 R2 (ders 15, 24, 47) — B2 ölçümünün (test/b2-249/olcum.mjs "iade" kümesi: listenin İLK 2.000 kişisi + Tümüne) R2'ye özgü eki: iade carilerini kapsayan
// SON 2.000 kişi (1.000 iade carisi kartlı) için elle alıcı listesi ve OTOMATİK ÖNİZLEME (POST /whatsapp/batches/preview), önizleme Tümüne (bütün telefonlu cariler)
// ve tek tek CARİ KARTI (GET /accounts/:id, 200 iade carisi). Her ölçümde süre + OLAY DÖNGÜSÜ EN ÇOK (10 ms sayaç) + ofisteki BAŞKA kullanıcının (ayrı süreç) en uzun
// beklemesi. Eski kodun ayrı kopyasında ve yeni kodda AYNI betik, aynı hazır verinin TAZE kopyası, aynı sahte saat; flock altında tek tek. Ürün kodu DEĞİŞMEZ.
// Kullanım: node test/r2-249/olcum-ek.mjs <hazır veri> <iş klasörü> <çıktı.json> [tekrar=2]
import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { surum, kurulum, PASS, log } from "../isz-248/ortak.mjs";

const [VERI, IS, CIKTI, TEKRAR = "2"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: olcum-ek.mjs <veri> <iş> <çıktı.json> [tekrar]");
const BURA = path.dirname(fileURLToPath(import.meta.url));
const SAAT = "2026-11-03T15:00:00+03:00";
const sonuc = { commit: surum(), node: process.version, veri: VERI, saat: SAAT, basladi: new Date().toISOString(), olcum: {} };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `r2o${Date.now().toString(36)}` });
let yoklayici = null;
try {
  const { admin, at } = ctx;
  yoklayici = fork(path.join(BURA, "../isz-248/yoklayici.mjs"), [ctx.server.base, "admin", PASS, ctx.s1], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  const bekleyen = new Map();
  let sira = 0;
  await new Promise((resolve, reject) => {
    yoklayici.once("error", reject);
    yoklayici.on("message", m => {
      if (m.hazir) return resolve(m);
      const cb = bekleyen.get(m.kimlik);
      if (cb) {
        bekleyen.delete(m.kimlik);
        cb(m.deger);
      }
    });
  });
  const yokla = tur =>
    new Promise(resolve => {
      sira += 1;
      bekleyen.set(sira, resolve);
      yoklayici.send({ kimlik: sira, tur });
    });
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts;
  const telefonlu = tum.filter(a => a.phone).map(a => a.id);
  const iadeCarileri = tum.filter(a => /^B2 İade Cari /.test(a.name)).map(a => a.id);
  sonuc.cariSayisi = { toplam: tum.length, telefonlu: telefonlu.length, iadeCarisi: iadeCarileri.length };
  const pencere = async fn => {
    await yokla("basla");
    await new Promise(r => setTimeout(r, 250));
    let son = performance.now();
    let enUzun = 0;
    const sayac = setInterval(() => {
      const n = performance.now();
      enUzun = Math.max(enUzun, n - son);
      son = n;
    }, 10);
    const t = performance.now();
    const ek = await fn();
    const ms = Math.round(performance.now() - t);
    await new Promise(res => setTimeout(res, 60));
    clearInterval(sayac);
    await new Promise(res => setTimeout(res, 250));
    const b = await yokla("dur");
    return { ms, olayDongusuEnCokMs: Math.round(enUzun), baskaEnCokMs: b.enCokMs, baskaIstek: b.n, baskaHata: b.hata, ...ek };
  };
  const post = (yol, govde) => async () => {
    const r = await admin.post(at(yol), govde);
    const d = r.data?.data;
    return { durum: r.status, kalem: (d?.recipients || d?.people || [])?.length ?? null, ...(r.status === 200 ? {} : { hata: JSON.stringify(r.data).slice(0, 200) }) };
  };
  const olcumler = {
    targetsSon2000: post("/api/workspace/whatsapp/targets", { kind: "statement", ids: telefonlu.slice(-2000), preset: "thisMonth" }),
    onizlemeSon2000: post("/api/workspace/whatsapp/batches/preview", { kind: "statement", ids: telefonlu.slice(-2000), preset: "thisMonth" }),
    onizlemeTumune: post("/api/workspace/whatsapp/batches/preview", { kind: "statement", ids: telefonlu, preset: "thisMonth" }),
    cariKarti200: async () => {
      const l = [];
      let durum = 200;
      for (const id of iadeCarileri.slice(0, 200)) {
        const t = performance.now();
        const r = await admin.get(at(`/api/workspace/accounts/${id}`));
        l.push(performance.now() - t);
        if (r.status !== 200) durum = r.status;
      }
      l.sort((a, b) => a - b);
      return { durum, kalem: l.length, istekP50Ms: Math.round(l[Math.floor(l.length / 2)] * 10) / 10, istekEnCokMs: Math.round(l.at(-1) * 10) / 10 };
    },
  };
  for (const [ad, fn] of Object.entries(olcumler)) {
    const liste = [];
    for (let i = 0; i < Number(TEKRAR); i += 1) liste.push(await pencere(fn));
    sonuc.olcum[ad] = liste;
    log("ölçüm", ad, JSON.stringify(liste));
  }
} finally {
  yoklayici?.kill();
  await ctx.kapat();
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
  console.log("yazıldı", CIKTI);
}
