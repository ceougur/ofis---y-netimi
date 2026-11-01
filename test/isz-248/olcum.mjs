// İŞ Z (2.4.8) — SÜRE önce / sonra: T9 Ölçüm 1'in B (önizleme) ve C (başlatma) aşamaları AYNI gövdelerle (wt-t9-248 test/t9-248/wa-gonderim-olcum.mjs: 2.000 telefonlu
// cari, Geçen Ay / Bu Ay / Son 3 Ay / Tüm Hareketler / Özel (yıl-07-01 – yıl-09-30) / Ödeme Hatırlatma / Tümünü Seç Geçen Ay, her biri 2 kez) + başlatma 2.000 ve Tümünü
// Seç 3.014. Her istekte olay döngüsünün en uzun kesintisi ve istek sürerken ofisteki BAŞKA bir kullanıcının isteği (cari listesi; 100 ms sonra gönderilir) ölçülür.
// Ürün kodu değişmez; eski kod kopyasında ve yeni kodda aynı betik. Kullanım: node test/isz-248/olcum.mjs <veri> <iş> <json> [saat]
import { writeFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { execSync } from "node:child_process";
import { KOK, PASS, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI, SAAT = "2026-11-02T10:00:00+03:00"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: olcum.mjs <veri> <iş> <json> [saat]");
const W = "/api/workspace/whatsapp";
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const sonuc = { commit: execSync("git rev-parse HEAD", { cwd: KOK }).toString().trim(), node: process.version, veri: VERI, saat: SAAT, basladi: new Date().toISOString(), onizleme: {}, baslatma: {} };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `olc${Date.now().toString(36)}` });
try {
  const { admin, at } = ctx;
  const baska = ctx.server.client();
  denetle("başka kullanıcı (ikinci oturum) girişi", (await baska.login("admin", PASS)).status === 200);
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts;
  const secilen = tum.filter(a => a.phone).slice(0, 2000).map(a => a.id);
  sonuc.cariSayisi = { toplam: tum.length, secilen: secilen.length };
  const yil = SAAT.slice(0, 4);
  // İstek + olay döngüsü + başka kullanıcının isteği (istek başladıktan 100 ms sonra; olay döngüsü kilitliyse ancak istek bitince yanıtlanır).
  const olc = async (yol, govde) => {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    const t = performance.now();
    const istek = admin.post(at(yol), govde);
    const baskaSure = new Promise(resolve => {
      setTimeout(async () => {
        const t2 = performance.now();
        const r = await baska.get(at("/api/workspace/accounts?status=all&limit=50"));
        resolve({ ms: Math.round(performance.now() - t2), durum: r.status });
      }, 100);
    });
    const r = await istek;
    const ms = Math.round(performance.now() - t);
    const b = await baskaSure;
    h.disable();
    return { durum: r.status, ms, olayDongusuEnCokMs: Math.round(h.max / 1e6), baskaKullaniciMs: b.ms, baskaKullaniciDurum: b.durum, toplam: r.data?.data?.total ?? r.data?.data?.summary?.total, gonderilecek: r.data?.data?.sendable ?? r.data?.data?.summary?.sendable, id: r.data?.data?.batch?.id, hata: r.status === 200 ? undefined : String(r.data?.error || "").slice(0, 200) };
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
    log("önizleme", ad, JSON.stringify(liste.map(x => ({ ms: x.ms, dongu: x.olayDongusuEnCokMs, baska: x.baskaKullaniciMs, gonderilecek: x.gonderilecek }))));
    denetle(`önizleme ${ad}: 200`, liste.every(x => x.durum === 200), JSON.stringify(liste.map(x => x.durum)));
  }
  // Başlatma: 2.000 kişi (Geçen Ay), iptal; sonra Tümünü Seç (3.014), iptal — her biri kendi başına (kuyrukta öbürü yokken).
  for (const [ad, govde] of [["ekstreGecenAy2000", { ...govdeler.ekstreGecenAy, requestId: "isz-olcum-0001" }], ["tumunuSec3014", { ...govdeler.tumunuSecGecenAy, requestId: "isz-olcum-0002" }]]) {
    const r = await olc(`${W}/batches`, govde);
    sonuc.baslatma[ad] = r;
    log("başlatma", ad, JSON.stringify({ ms: r.ms, dongu: r.olayDongusuEnCokMs, baska: r.baskaKullaniciMs, toplam: r.toplam, gonderilecek: r.gonderilecek }));
    denetle(`başlatma ${ad}: 200 ve iş açıldı`, r.durum === 200 && Boolean(r.id), `${r.durum} ${r.hata || ""}`);
    if (r.id) denetle(`başlatma ${ad}: iptal`, (await admin.post(at(`${W}/batches/${r.id}/cancel`), {})).status === 200);
  }
} finally {
  await ctx.kapat();
  sonuc.bitti = new Date().toISOString();
  sonuc.denetimler = denetimler;
  writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
  const g = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${g}\n# fail ${denetimler.length - g}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = g === denetimler.length ? 0 : 1;
}
