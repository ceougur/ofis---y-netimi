// S3: S1'in iki çeşidi + onarım.
//  (a) S-M1K3-1 (b) çizgisi: Şubat fişi DEVREDEN yönde, sonra Şubat'a İ artışı (güncel değil, devreden büyür), Mart fişi zincirde kalırsa Mart alışı İptal Et; Nisan mahsupsuz.
//  (b) S1 aynen + onarım: Mart ve Şubat geri alınır, Şubat ve Mart sırayla yeniden mahsup → Ocak–Nisan beklenen 391 − 191.
import { program, show, monthRange } from "./ortak.mjs";
{
  const h = await program("2026-05-15T12:00:00+03:00", "S3A");
  try {
    await h.buy("2026-01-10", 5000); // Ocak İ 1000
    console.log("(a) Ocak fişi", await h.offset("2026-01"));
    await h.sell("2026-02-10", 2500); // Şubat 391 500
    await h.buy("2026-02-11", 1000); // Şubat İ 200 → Şubat devreden 1000 + 200 − 500 = 700
    console.log("(a) Şubat fişi", await h.offset("2026-02"));
    await h.sell("2026-03-10", 10000); // Mart 391 2000
    const marBuy = await h.buy("2026-03-11", 1000); // Mart İ 200
    await h.buy("2026-03-12", 500); // Mart İ 100
    console.log("(a) Mart fişi", await h.offset("2026-03"));
    await h.sell("2026-04-10", 2500); // Nisan 391 500
    // Şubat'a İ +300 (devreden 700 → 1000; S-M1K3-1 = A: Mart'a bugünkü 1000 taşınır → Mart fişi (700 ile) zincirle uyuşmaz → Mart zincirle hesaplanır).
    await h.buy("2026-02-20", 1500);
    await h.cancel(marBuy);
    console.log("(a) etkin fişler", JSON.stringify(await h.offsets()));
    show("(a) Ocak–Nisan", await h.report({ from: "2026-01-01", to: "2026-04-30" }));
  } finally {
    await h.ctx.server.close();
  }
}
{
  const h = await program("2026-05-15T12:00:00+03:00", "S3B");
  try {
    await h.buy("2026-01-10", 5000);
    await h.offset("2026-01");
    await h.sell("2026-02-10", 10000);
    await h.buy("2026-02-11", 2500);
    await h.offset("2026-02");
    await h.sell("2026-03-10", 5000);
    const marBuy = await h.buy("2026-03-11", 1000);
    await h.buy("2026-03-12", 500);
    await h.offset("2026-03");
    await h.sell("2026-04-10", 2500);
    await h.buy("2026-02-20", 1500);
    await h.cancel(marBuy);
    show("(b) onarım öncesi Ocak–Nisan", await h.report({ from: "2026-01-01", to: "2026-04-30" }));
    console.log("(b) Nisan ön izleme (onarım öncesi)", JSON.stringify(await h.preview("2026-04")));
    await h.reverse("2026-03");
    await h.reverse("2026-02");
    console.log("(b) Şubat yeniden", await h.offset("2026-02"));
    console.log("(b) Mart yeniden", await h.offset("2026-03"));
    show("(b) onarım sonrası Ocak–Nisan", await h.report({ from: "2026-01-01", to: "2026-04-30" }));
    console.log("(b) Nisan ön izleme (onarım sonrası)", JSON.stringify(await h.preview("2026-04")));
  } finally {
    await h.ctx.server.close();
  }
}
