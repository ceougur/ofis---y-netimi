// İŞ Z (2.4.8) — veri kopyasını programın kendi açılışıyla v44'e göç ettirir (ürün kodu değişmez; eski ve yeni kodun göçleri aynı — b2e7bf19'dan sonra göç yok)
// ve WhatsApp bağlantısı + onay + kanca kaydını yapar (T9 düzeneği). Sonuç <iş>/data göç edilmiş kopyadır; eşitlik hazırlığı (esitlik-hazirla.mjs) onun üzerinde çalışır.
// Kullanım: node test/isz-248/goc.mjs <veri> <iş> <saat ISO>
import { kurulum, log } from "./ortak.mjs";

const [VERI, IS, SAAT] = process.argv.slice(2);
if (!VERI || !IS || !SAAT) throw new Error("kullanım: goc.mjs <veri> <iş> <saat>");
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `goc${Date.now().toString(36)}` });
log("açılış (göç dahil) ms", ctx.acilisMs);
await ctx.kapat();
log("kapandı", IS);
