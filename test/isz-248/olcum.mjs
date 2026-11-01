// İŞ Z (2.4.8) — SÜRE önce / sonra: T9 Ölçüm 1'in B (önizleme) ve C (başlatma) aşamaları AYNI gövdelerle (wt-t9-248 test/t9-248/wa-gonderim-olcum.mjs: 2.000 telefonlu
// cari, Geçen Ay / Bu Ay / Son 3 Ay / Tüm Hareketler / Özel (yıl-07-01 – yıl-09-30) / Ödeme Hatırlatma / Tümünü Seç Geçen Ay, her biri 2 kez) + başlatma 2.000 ve Tümünü
// Seç 3.014. Her istekte olay döngüsünün en uzun kesintisi (10 ms'lik sayaç; yanıttan sonra 60 ms beklenir ki gecikmiş örnek de sayılsın) ve istek sürerken ofisteki
// BAŞKA bir kullanıcının istekleri (AYRI SÜREÇ test/isz-248/yoklayici.mjs: kendi oturumuyla her 200 ms'de cari listesi; en uzun bekleme) ölçülür.
// (İlk sürüm "başka kullanıcı"yı aynı süreçten 100 ms sonra gönderiyordu — program kilitliyken aynı süreç istek de gönderemez; o ölçüm geçersizdi, bu sürümle yinelendi.)
// Ürün kodu değişmez; eski kod kopyasında ve yeni kodda aynı betik. Kullanım: node test/isz-248/olcum.mjs <veri> <iş> <json> [saat]
import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { KOK, surum, PASS, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI, SAAT = "2026-11-02T10:00:00+03:00"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: olcum.mjs <veri> <iş> <json> [saat]");
const W = "/api/workspace/whatsapp";
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const sonuc = { commit: surum(), node: process.version, veri: VERI, saat: SAAT, basladi: new Date().toISOString(), onizleme: {}, baslatma: {} };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `olc${Date.now().toString(36)}` });
let yoklayici = null;
try {
  const { admin, at } = ctx;
  // Başka kullanıcı: ayrı süreç (ölçülen programın olay döngüsünden bağımsız).
  yoklayici = fork(path.join(KOK, "test/isz-248/yoklayici.mjs"), [ctx.server.base, "admin", PASS, ctx.s1], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  const bekleyen = new Map();
  let sira = 0;
  const hazir = await new Promise((resolve, reject) => {
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
  const yokla = tur => new Promise(resolve => {
    sira += 1;
    bekleyen.set(sira, resolve);
    yoklayici.send({ kimlik: sira, tur });
  });
  denetle("başka kullanıcı (ayrı süreç) girişi", hazir.giris === 200, String(hazir.giris));
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts;
  const secilen = tum.filter(a => a.phone).slice(0, 2000).map(a => a.id);
  sonuc.cariSayisi = { toplam: tum.length, secilen: secilen.length };
  const yil = SAAT.slice(0, 4);
  // İstek + olay döngüsünün en uzun kesintisi (10 ms'lik sayaç) + aynı pencerede başka kullanıcının (ayrı süreç) en uzun beklemesi.
  const olc = async (yol, govde) => {
    await yokla("basla");
    await new Promise(r => setTimeout(r, 250)); // başka kullanıcının ilk isteği yolda
    let son = performance.now();
    let enUzun = 0;
    const sayac = setInterval(() => {
      const n = performance.now();
      enUzun = Math.max(enUzun, n - son);
      son = n;
    }, 10);
    const t = performance.now();
    const r = await admin.post(at(yol), govde);
    const ms = Math.round(performance.now() - t);
    await new Promise(res => setTimeout(res, 60));
    clearInterval(sayac);
    await new Promise(res => setTimeout(res, 250)); // kilitte bekleyen başka kullanıcı isteği yanıtlansın
    const b = await yokla("dur");
    return { durum: r.status, ms, olayDongusuEnCokMs: Math.round(enUzun), baskaKullaniciEnCokMs: b.enCokMs, baskaKullaniciP50Ms: b.p50Ms, baskaKullaniciIstek: b.n, baskaKullaniciHata: b.hata, toplam: r.data?.data?.total ?? r.data?.data?.summary?.total, gonderilecek: r.data?.data?.sendable ?? r.data?.data?.summary?.sendable, id: r.data?.data?.batch?.id, hata: r.status === 200 ? undefined : String(r.data?.error || "").slice(0, 200) };
  };
  const govdeler = {
    ekstreGecenAy: { kind: "statement", ids: secilen, preset: "lastMonth" },
    ekstreBuAy: { kind: "statement", ids: secilen, preset: "thisMonth" },
    ekstreSon3Ay: { kind: "statement", ids: secilen, preset: "last3" },
    ekstreTumHareketler: { kind: "statement", ids: secilen, preset: "all" },
    ekstreOzelAralik: { kind: "statement", ids: secilen, from: `${yil}-07-01`, to: `${yil}-09-30` },
    hatirlatma: { kind: "reminder", ids: secilen },
    tumunuSecGecenAy: { kind: "statement", all: true, status: "all", preset: "lastMonth" },
  };
  for (const [ad, govde] of Object.entries(govdeler)) {
    const liste = [];
    for (let i = 0; i < 2; i += 1) liste.push(await olc(`${W}/batches/preview`, govde));
    sonuc.onizleme[ad] = liste;
    log("önizleme", ad, JSON.stringify(liste.map(x => ({ ms: x.ms, dongu: x.olayDongusuEnCokMs, baska: x.baskaKullaniciEnCokMs, baskaIstek: x.baskaKullaniciIstek, gonderilecek: x.gonderilecek }))));
    denetle(`önizleme ${ad}: 200`, liste.every(x => x.durum === 200), JSON.stringify(liste.map(x => x.durum)));
  }
  // Başlatma: 2.000 kişi (Geçen Ay), iptal; sonra Tümünü Seç (3.014), iptal — her biri kendi başına (kuyrukta öbürü yokken).
  for (const [ad, govde] of [["ekstreGecenAy2000", { ...govdeler.ekstreGecenAy, requestId: "isz-olcum-0001" }], ["tumunuSec3014", { ...govdeler.tumunuSecGecenAy, requestId: "isz-olcum-0002" }]]) {
    const r = await olc(`${W}/batches`, govde);
    sonuc.baslatma[ad] = r;
    log("başlatma", ad, JSON.stringify({ ms: r.ms, dongu: r.olayDongusuEnCokMs, baska: r.baskaKullaniciEnCokMs, baskaIstek: r.baskaKullaniciIstek, toplam: r.toplam, gonderilecek: r.gonderilecek }));
    denetle(`başlatma ${ad}: 200 ve iş açıldı`, r.durum === 200 && Boolean(r.id), `${r.durum} ${r.hata || ""}`);
    if (r.id) denetle(`başlatma ${ad}: iptal`, (await admin.post(at(`${W}/batches/${r.id}/cancel`), {})).status === 200);
  }
} finally {
  yoklayici?.kill();
  await ctx.kapat();
  sonuc.bitti = new Date().toISOString();
  sonuc.denetimler = denetimler;
  writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
  const g = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${g}\n# fail ${denetimler.length - g}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = g === denetimler.length ? 0 : 1;
}
