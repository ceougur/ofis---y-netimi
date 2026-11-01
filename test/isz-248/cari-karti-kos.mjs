// İŞ Z (2.4.8) — CARİ KARTI EŞİTLİĞİ (ana oturum ek şartı 1): taksit özeti eşlemesi ortak yardımcıya (routes/accounts.mjs planSummaryOf) taşındığı için GET cari
// detayının çıktısı ESKİ ↔ YENİ birebir aynı olmalı. Bu betik verilen kodda (eski kopya ya da yeni) BÜTÜN carilerin (iki şirket, silinmemiş hepsi — pasifler dahil)
// GET /api/workspace/accounts/:id yanıtını sırayla toplar; esitlik-karsilastir.mjs iki çıktıyı derin eşitlikle karşılaştırır. Ürün kodu değişmez; yalnız okur.
// Kullanım: node test/isz-248/cari-karti-kos.mjs <veri> <iş> <json> <saat ISO>
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { KOK, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI, SAAT] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI || !SAAT) throw new Error("kullanım: cari-karti-kos.mjs <veri> <iş> <json> <saat>");
const sonuc = { kok: KOK, commit: execSync("git rev-parse HEAD", { cwd: KOK }).toString().trim(), veri: VERI, saat: SAAT, kip: "cari-karti", yurutulen: null, adimlar: [] };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `kart${Date.now().toString(36)}`, baglan: false });
try {
  for (const sirket of ctx.sirketler) {
    const at = u => `${u}${u.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(sirket.id)}`;
    const ids = (await ctx.admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
    const t = performance.now();
    for (const id of ids) {
      const r = await ctx.admin.get(at(`/api/workspace/accounts/${id}`));
      sonuc.adimlar.push({ adim: `${sirket.code} ${id}`, durum: r.status, govde: r.data });
    }
    log(`şirket ${sirket.code}: ${ids.length} cari kartı`, Math.round(performance.now() - t), "ms");
  }
} finally {
  await ctx.kapat();
}
writeFileSync(CIKTI, `${JSON.stringify(sonuc)}\n`);
log("yazıldı", CIKTI, sonuc.adimlar.length, "kart");
