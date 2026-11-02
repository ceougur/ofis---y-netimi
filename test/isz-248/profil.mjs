// İŞ Z (2.4.8, T9 ORTA bulgusu: 2.000 carili şirkette WhatsApp önizleme ~23 sn, olay döngüsü kilitli) — PROFİL: önizlemenin (POST …/whatsapp/batches/preview)
// süresi nereye gidiyor? Ürün kodu DEĞİŞMEZ; yalnız ölçer. npm test'e girmez (*.test.mjs değil). Ağır koşu: `flock /tmp/destekofis-olcum.lock` ile (ders 15).
// GERÇEK program (test/isz-248/ortak.mjs = T9 düzeneğinin kopyası; sahte Meta ayrı süreçte, lisans/kapıcı yerel sahte; HUKUK_LICENSE_URL ölü adres — ders 30).
// Her durum için V8 profilcisi (node:inspector) yalnız o önizlemenin çevresinde açılır; işlev başına KAPSAYICI süre (çağrı ağacında altındakiler dahil) yazılır.
// Kullanım: node test/isz-248/profil.mjs <veri klasörü> <iş klasörü> <json çıktısı> [kişi=2000] [durumlar=lastMonth,thisMonth,last3,all,reminder,tumu]
import { writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { KOK, surum, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI, KISI = "2000", DURUMLAR = "lastMonth,thisMonth,last3,all,reminder,tumu"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: profil.mjs <veri> <iş> <json> [kişi] [durumlar]");
const ILGI = ["preview", "plan", "selection", "load", "detail", "accountRow", "entriesOf", "forAccount", "returnCuts", "shape", "accountLedger", "openingEntryOf", "refundablesOf", "entryStates", "deleteBlock", "summary", "queued", "sentBefore", "unsettledBefore", "movedSentBefore", "movedUnsettled", "dropSettledSources", "eligibility", "summarize", "repairPending", "checkTemplate", "dailyLimit", "list", "summariesByAccount", "get", "all"];

function kapsayici(prof) {
  const byId = new Map(prof.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const dt = new Map();
  prof.samples.forEach((id, i) => dt.set(id, (dt.get(id) || 0) + (prof.timeDeltas[i] || 0)));
  const ad = n => `${n.callFrame.functionName || "(anonim)"} ${n.callFrame.url.replace(/^.*\/(server|test)\//, "$1/")}:${n.callFrame.lineNumber + 1}`;
  const incl = new Map();
  const self = new Map();
  let toplam = 0;
  for (const [id, us] of dt) {
    toplam += us;
    const n = byId.get(id);
    self.set(ad(n), (self.get(ad(n)) || 0) + us);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const k = ad(byId.get(cur));
      if (seen.has(k)) continue;
      seen.add(k);
      incl.set(k, (incl.get(k) || 0) + us);
    }
  }
  const ms = us => Math.round(us / 1000);
  const ilgi = [...incl].filter(([k]) => k.includes("server/") && ILGI.includes(k.split(" ")[0])).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, ms(v)]);
  const oz = [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, ms(v)]);
  return { toplamMs: ms(toplam), kapsayici: Object.fromEntries(ilgi), ozIlk12: Object.fromEntries(oz) };
}

const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: "2026-11-02T10:00:00+03:00", fixed: true }, isci: "manual", aralik: 0, tier: "TIER_2K", onEk: `isz${Date.now().toString(36)}` });
const sonuc = { commit: surum(), node: process.version, veri: VERI, kisi: Number(KISI), basladi: new Date().toISOString(), durumlar: {} };
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 500 });
try {
  const tum = (await ctx.admin.get(ctx.at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts;
  const ids = tum.filter(a => a.phone).slice(0, Number(KISI)).map(a => a.id);
  sonuc.cariSayisi = { toplam: tum.length, secilen: ids.length };
  const govde = durum => (durum === "reminder" ? { kind: "reminder", ids } : durum === "tumu" ? { kind: "statement", all: true, status: "all", preset: "lastMonth" } : { kind: "statement", ids, preset: durum });
  for (const durum of DURUMLAR.split(",")) {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    await session.post("Profiler.start");
    const t = performance.now();
    const r = await ctx.admin.post(ctx.at("/api/workspace/whatsapp/batches/preview"), govde(durum));
    const ms = Math.round(performance.now() - t);
    const { profile } = await session.post("Profiler.stop");
    h.disable();
    const d = r.data?.data || {};
    sonuc.durumlar[durum] = { durum: r.status, ms, olayDongusuEnCokMs: Math.round(h.max / 1e6), toplam: d.total, gonderilecek: d.sendable, elenen: d.skipped, profil: kapsayici(profile) };
    log(durum, r.status, `${ms} ms`, `gönderilecek ${d.sendable}/${d.total}`, JSON.stringify(d.skipped || {}));
  }
} finally {
  session.disconnect();
  await ctx.kapat();
}
writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 2)}\n`);
log("yazıldı", CIKTI);
