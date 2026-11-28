// S1: 'güncel değil' (İ ARTTI, ödenecek yönde kalan) ay, ARKASINDAN fişi zincirde kalan ve İ'si AZALAN ('reduced') ay, sonra mahsupsuz ay.
// Kararlar: S-DKM1-1 = A (azalan ayın sonucu fişten, azalma yalnız sonraki ayda görünür), S-M1-3 = C / S-M1K3-1 = A (güncel değil ay bugünkü kayıtlardan; her değişiklik bir kez;
// aralık toplamı 391 − 191). Elle beklenen: 391 = 2000 + 1000 + 500 = 3500; 191 = 1000 + 800 + 100 = 1900 → Ocak–Nisan Ödenecek − Sonraki = 1600.
import { program, show, monthRange } from "./ortak.mjs";
const h = await program("2026-05-15T12:00:00+03:00", "S1");
try {
  await h.buy("2026-01-10", 5000); // Ocak İ 1000
  console.log("Ocak fişi", await h.offset("2026-01"));
  await h.sell("2026-02-10", 10000); // Şubat 391 2000
  await h.buy("2026-02-11", 2500); // Şubat İ 500
  console.log("Şubat fişi", await h.offset("2026-02"));
  await h.sell("2026-03-10", 5000); // Mart 391 1000
  const marBuy = await h.buy("2026-03-11", 1000); // Mart İ 200
  await h.buy("2026-03-12", 500); // Mart İ 100
  console.log("Mart fişi", await h.offset("2026-03"));
  await h.sell("2026-04-10", 2500); // Nisan 391 500 (fiş yok)
  // Fişlerden SONRA: Şubat'a geç gelen alış (İ +300 → Şubat 'güncel değil', ödenecek yönde kalır), Mart alışı İptal Et (Mart İ −200 → 'reduced').
  await h.buy("2026-02-20", 1500);
  await h.cancel(marBuy);
  console.log("etkin fişler", JSON.stringify(await h.offsets()));
  for (const m of ["2026-02", "2026-03", "2026-04"]) console.log(`ön izleme ${m}`, JSON.stringify(await h.preview(m)).replace(/,"(blocks|warnings)".*/, ""));
  show("Ocak–Nisan", await h.report({ from: "2026-01-01", to: "2026-04-30" }));
  for (const m of ["2026-02", "2026-03", "2026-04"]) show(m, await h.report(monthRange(m)));
} finally {
  await h.ctx.server.close();
}
