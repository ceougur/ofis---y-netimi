// 2.4.9 B2 (tasarım notu §6 bütçe, §7 ölçüm planı; ders 15, 24, 47) — elle toplu WhatsApp alıcı listesi (POST /api/workspace/whatsapp/targets) ölçümü: süre + OLAY DÖNGÜSÜ
// EN ÇOK (10 ms sayaç, yanıttan sonra 60 ms) + ofisteki BAŞKA kullanıcının (ayrı süreç, 200 ms'de bir cari listesi) en uzun beklemesi. Tasarım ajanının ön ölçüm betiğinin
// (not defteri b2-tasarim-e3f7/olc-b2.mjs) kalıcı hâli. Eski kodun ayrı kopyasında (git archive e3f74093) ve yeni kodda AYNI betik, aynı hazır verinin TAZE kopyası, aynı sahte
// saat; flock altında tek tek koşulur. Ürün kodu DEĞİŞMEZ. Dış istek YOK (ders 30: düzenek test/isz-248/ortak.mjs).
// Kullanım: node test/b2-249/olcum.mjs <hazır veri> <iş klasörü> <çıktı.json> <set: taban|bes-bin|gecmis|iade> [tekrar=2]
import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { surum, kurulum, PASS, log } from "../isz-248/ortak.mjs";

const [VERI, IS, CIKTI, SET = "taban", TEKRAR = "2"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: olcum.mjs <veri> <iş> <çıktı.json> <set> [tekrar]");
const BURA = path.dirname(fileURLToPath(import.meta.url));
const SAAT = "2026-11-03T15:00:00+03:00";
const sonuc = { commit: surum(), node: process.version, veri: VERI, set: SET, saat: SAAT, basladi: new Date().toISOString(), olcum: {} };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `b2o${Date.now().toString(36)}` });
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
  const secilen = tum.filter(a => a.phone).slice(0, 2000).map(a => a.id);
  sonuc.cariSayisi = { toplam: tum.length, telefonlu: tum.filter(a => a.phone).length, secilen: secilen.length };
  const olc = async govde => {
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
    const r = await admin.post(at("/api/workspace/whatsapp/targets"), govde);
    const ms = Math.round(performance.now() - t);
    await new Promise(res => setTimeout(res, 60));
    clearInterval(sayac);
    await new Promise(res => setTimeout(res, 250));
    const b = await yokla("dur");
    return { durum: r.status, ms, olayDongusuEnCokMs: Math.round(enUzun), baskaEnCokMs: b.enCokMs, baskaIstek: b.n, baskaHata: b.hata, alici: r.data?.data?.recipients?.length, gecerli: r.data?.data?.recipients?.filter(x => x.valid).length };
  };
  const setler = {
    taban: {
      ekstreBuAy2000: { kind: "statement", ids: secilen, preset: "thisMonth" },
      ekstreGecenAy2000: { kind: "statement", ids: secilen, preset: "lastMonth" },
      ekstreSon3Ay2000: { kind: "statement", ids: secilen, preset: "last3" },
      ekstreTum2000: { kind: "statement", ids: secilen, preset: "all" },
      mesaj2000: { kind: "message", ids: secilen },
      tumuneEkstreHepsi: { kind: "statement", all: true, status: "all", preset: "thisMonth" },
      tumuneMesajAktif: { kind: "message", all: true },
    },
    "bes-bin": {
      tumuneEkstreHepsi5000: { kind: "statement", all: true, status: "all", preset: "all" },
      tumuneMesajHepsi5000: { kind: "message", all: true, status: "all" },
    },
    gecmis: {
      ekstreBuAy2000: { kind: "statement", ids: secilen, preset: "thisMonth" },
      ekstreTum2000: { kind: "statement", ids: secilen, preset: "all" },
      mesaj2000: { kind: "message", ids: secilen },
    },
    iade: {
      ekstreBuAy2000: { kind: "statement", ids: secilen, preset: "thisMonth" },
      tumuneEkstreHepsi: { kind: "statement", all: true, status: "all", preset: "thisMonth" },
    },
  };
  for (const [ad, govde] of Object.entries(setler[SET])) {
    const liste = [];
    for (let i = 0; i < Number(TEKRAR); i += 1) liste.push(await olc(govde));
    sonuc.olcum[ad] = liste;
    log("targets", SET, ad, JSON.stringify(liste));
  }
} finally {
  yoklayici?.kill();
  await ctx.kapat();
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
  console.log("yazıldı", CIKTI);
}
