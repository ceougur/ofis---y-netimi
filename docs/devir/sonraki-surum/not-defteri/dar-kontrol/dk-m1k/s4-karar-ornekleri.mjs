// S4: kararların örnekleri AYNEN, karar metninden elle beklenen (programın kodundan değil). KDV %20 → net = KDV × 5.
import { program, show, monthRange } from "./ortak.mjs";
const run = async (label, now, body) => {
  const h = await program(now, label);
  try { await body(h); } finally { await h.ctx.server.close(); }
};
await run("DKM1", "2026-04-15T12:00:00+03:00", async h => {
  // S-DKM1-1 = A: beklenen Ocak 500 / Şubat 700 / Mart 400, Ocak–Mart Ödenecek 1.600.
  await h.sell("2026-01-05", 5000);
  const b = await h.buy("2026-01-10", 2500);
  console.log("DKM1 Ocak fişi", await h.offset("2026-01"));
  await h.cancel(b);
  await h.sell("2026-02-05", 1000);
  console.log("DKM1 Şubat fişi", await h.offset("2026-02"));
  await h.sell("2026-03-05", 2000);
  console.log("DKM1 Mart fişi", await h.offset("2026-03"));
  show("DKM1 Ocak–Mart (beklenen 0/160000/0; ay 50000/70000/40000)", await h.report({ from: "2026-01-01", to: "2026-03-31" }));
});
await run("K3A", "2026-05-15T12:00:00+03:00", async h => {
  // S-M1K3-1 (a) = A: beklenen Nisan 30000/0/10000; Mart–Nisan 0/0/10000.
  const big = await h.sell("2026-03-05", 4000); // 800
  await h.sell("2026-03-06", 1000); // 200
  await h.buy("2026-03-10", 2500); // 500
  console.log("K3A Mart fişi", await h.offset("2026-03"));
  await h.cancel(big);
  await h.sell("2026-04-05", 1000); // 200
  console.log("K3A Nisan fişi", await h.offset("2026-04"));
  show("K3A Nisan (beklenen 30000/0/10000)", await h.report(monthRange("2026-04")));
  show("K3A Mart–Nisan (beklenen 0/0/10000)", await h.report({ from: "2026-03-01", to: "2026-04-30" }));
  show("K3A Bu Yıl", await h.report({ from: "2026-01-01", to: "2026-12-31" }));
});
await run("K3B", "2026-05-15T12:00:00+03:00", async h => {
  // S-M1K3-1 (b) = A: Mart fişi devreden 800, sonra Mart alış KDV 100; Nisan satış 1.000 → Nisan fişi 200. Beklenen Nisan 90000/10000/0, Mart–Nisan 0/10000/0.
  await h.buy("2026-03-05", 5000); // 1000
  await h.sell("2026-03-06", 1000); // 200
  console.log("K3B Mart fişi", await h.offset("2026-03"));
  await h.buy("2026-03-20", 500); // +100
  await h.sell("2026-04-05", 5000); // 1000
  console.log("K3B Nisan fişi", await h.offset("2026-04"));
  show("K3B Nisan (beklenen 90000/10000/0)", await h.report(monthRange("2026-04")));
  show("K3B Mart–Nisan (beklenen 0/10000/0)", await h.report({ from: "2026-03-01", to: "2026-04-30" }));
});
await run("K2", "2026-05-15T12:00:00+03:00", async h => {
  // S-M1K2-1 = A: beklenen Mart–Nisan Ödenecek 300, Nisan önceki 700.
  await h.buy("2026-03-05", 5000);
  await h.sell("2026-03-10", 1000);
  console.log("K2 Mart fişi", await h.offset("2026-03"));
  await h.sell("2026-03-20", 500);
  await h.sell("2026-04-10", 5000);
  console.log("K2 Nisan fişi", await h.offset("2026-04"));
  show("K2 Nisan (beklenen 70000/30000/0)", await h.report(monthRange("2026-04")));
  show("K2 Mart–Nisan (beklenen 0/30000/0)", await h.report({ from: "2026-03-01", to: "2026-04-30" }));
});
