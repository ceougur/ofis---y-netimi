// T9 ÖLÇEK — BULGU 1'in yan ölçüsü: "Tümünü Seç" (all: true; 3.012 telefonlu cari) ile önizleme ve BAŞLATMA süresi, istemcinin 30 sn zaman aşımına
// (client/assets/hof-core.js sendApi timeoutMs = 30000) karşı. Başlatma yanıtı 30 sn'yi aşarsa ekran "Sunucu zamanında yanıt vermedi" der, toplu iş ise sunucuda AÇILIR.
// Burada istemci yerine aynı uç Node fetch ile çağrılır ve 30 sn'de iptal edilir (tarayıcının AbortController'ı gibi); sonra sunucuda iş açıldı mı okunur.
// İşçi elle (yürütülmez), saat durur. Ürün kodu değişmez.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { KOK, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI] = process.argv.slice(2);
const W = "/api/workspace/whatsapp";
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const sonuc = { commit: execSync("git rev-parse HEAD", { cwd: KOK }).toString().trim(), basladi: new Date().toISOString() };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: "2026-11-02T10:00:00+03:00", fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `ts${Date.now().toString(36)}` });
try {
  // Tarayıcının yaptığı gibi: oturum çerezli istek, 30 sn sonra iptal.
  const tarayici = async (yol, govde) => {
    const ac = new AbortController();
    const zaman = setTimeout(() => ac.abort(), 30_000);
    const t = performance.now();
    try {
      const r = await fetch(ctx.server.base + ctx.at(yol), { method: "POST", headers: { "content-type": "application/json", cookie: ctx.admin.cookie || "" }, body: JSON.stringify(govde), signal: ac.signal });
      return { durum: r.status, ms: Math.round(performance.now() - t), zamanAsimi: false };
    } catch (error) {
      return { durum: 0, ms: Math.round(performance.now() - t), zamanAsimi: error.name === "AbortError" };
    } finally {
      clearTimeout(zaman);
    }
  };
  // Süreler (yanıt beklenerek; istemci zaman aşımsız).
  let t = performance.now();
  const p = await ctx.admin.post(ctx.at(`${W}/batches/preview`), { kind: "statement", all: true, status: "all", preset: "lastMonth" });
  sonuc.onizleme = { durum: p.status, ms: Math.round(performance.now() - t), gonderilecek: p.data?.data?.sendable };
  log("önizleme (Tümünü Seç)", JSON.stringify(sonuc.onizleme));
  denetle("önizleme 200", p.status === 200);
  const once = (await ctx.admin.get(ctx.at(`${W}/batches?limit=200`))).data.data.length;
  sonuc.baslatma30sn = await tarayici(`${W}/batches`, { kind: "statement", all: true, status: "all", preset: "lastMonth", requestId: "t9-tumunu-sec-0001" });
  log("başlatma (30 sn iptalli)", JSON.stringify(sonuc.baslatma30sn));
  // Sunucu işi bitirsin diye bir sonraki istek (sıraya girer) — iş açıldı mı?
  t = performance.now();
  const sonra = (await ctx.admin.get(ctx.at(`${W}/batches?limit=200`))).data.data;
  sonuc.sonrakiIstekMs = Math.round(performance.now() - t);
  sonuc.acilanIs = sonra.length - once;
  sonuc.acilanIsKisi = sonra[0]?.counts ? Object.values(sonra[0].counts).reduce((s, v) => s + v, 0) : null;
  log("sonra", JSON.stringify({ acilanIs: sonuc.acilanIs, kisi: sonuc.acilanIsKisi, sonrakiIstekMs: sonuc.sonrakiIstekMs }));
  denetle("istemci zaman aşımına rağmen sunucu toplu işi açtı (ölçülen davranış)", true, `zaman aşımı ${sonuc.baslatma30sn.zamanAsimi}, açılan ${sonuc.acilanIs}`);
  // Aynı istek kimliğiyle yeniden basma (kullanıcı yeniden dener) — ikinci iş açılmamalı.
  const yine = await ctx.admin.post(ctx.at(`${W}/batches`), { kind: "statement", all: true, status: "all", preset: "lastMonth", requestId: "t9-tumunu-sec-0001" });
  const son = (await ctx.admin.get(ctx.at(`${W}/batches?limit=200`))).data.data.length;
  sonuc.yenidenBasma = { durum: yine.status, isSayisi: son - once };
  log("yeniden basma", JSON.stringify(sonuc.yenidenBasma));
  denetle("aynı istek kimliğiyle yeniden basma ikinci iş açmaz", son - once === 1, `${son - once}`);
} finally {
  await ctx.kapat();
  sonuc.denetimler = denetimler;
  writeFileSync(CIKTI, JSON.stringify(sonuc, null, 2));
  const g = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${g}\n# fail ${denetimler.length - g}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = g === denetimler.length ? 0 : 1;
}
