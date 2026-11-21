// Dar kontrol Ç6-HESAP — senaryo 5: KİLİTLİ yılın Gelir Tablosu / Bilanço'su, kilitten SONRA ürün kartında yapılan değişiklikle (kart alış fiyatı — KG-10 dayanağı; ürün türü
// Ürün → Hizmet) değişiyor mu? Kitap / Ç3: kilitli dönem değişmez. ELLE: K ürünü 2025'te yalnız miktar girişi 10 Adet (alış yok, dönem başı yok → KG-10 A kart alış fiyatı 50,00):
// DSS_2025 = 500,00; 2025 satışların maliyeti (tahmini) = 0 + 0 − 500 = −500,00. H ürünü: 2025 alış 4 × 25 = 100,00 (açık hesap), satış yok → DSS 100,00, SMM 0.
// ROOT=<kod> node s5.mjs
import path from "node:path";
const ROOT = process.env.ROOT;
const { boot, must } = await import(path.join(ROOT, "test/banka-210-ortak.mjs"));
const { lockAndWait } = await import(path.join(ROOT, "test/fixtures/donma-bekle.mjs"));
const FS = "/api/workspace/financial-statements";
const ctx = await boot({ now: { time: "2026-03-10T12:00:00+03:00", fixed: true } });
const api = ctx.api;
try {
  const sup = (await must("t", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier" }))).id;
  const K = await must("K", api.post("/api/workspace/stock", { name: "Ürün K", unit: "Adet", unitPrice: "50" }));
  const H = await must("H", api.post("/api/workspace/stock", { name: "Ürün H", unit: "Adet", unitPrice: "25" }));
  await must("K miktar girişi", api.post(`/api/workspace/stock/${K.id}/moves`, { kind: "in", qty: "10", unitPrice: "0", pay: "none", date: "2025-03-01" }));
  await must("H alış", api.post(`/api/workspace/stock/${H.id}/moves`, { kind: "in", qty: "4", unitPrice: "25", pay: "account", accountId: sup, date: "2025-04-01" }));
  await lockAndWait(api.client, "2025-12-31");
  const read = async label => {
    const gt = await must("gt", api.get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`));
    const bs = await must("bs", api.get(`${FS}/balance-sheet?date=2025-12-31`));
    const bsNow = await must("bs", api.get(`${FS}/balance-sheet?date=2026-03-10`));
    const stock = bs.aktif.gruplar.flatMap(g => g.kalemler).flatMap(k => k.hesaplar).find(h => h.hesap === "153");
    console.log(`${label}: kilitli 2025 GT satışların maliyeti ${gt.items.find(i => i.kod === "D").tutarMinor} · dönem net kârı ${gt.subtotals.donemNetKari} · Bilanço 31.12.2025 153 ${stock?.tutarMinor} · Aktif−Pasif ${bs.toplamlar.farkMinor} · bugün Bilanço geçmiş yıl ${JSON.stringify(bsNow.hesaplanmis.gecmisYillar.map(r => [r.yil, r.tutarMinor]))} · GT Kesin Değil ${gt.kesinDegil.map(r => r.kod).join(",")} · uyarı ${gt.warnings.map(w => `${w.name}:${w.type}`).join(",")}`);
    return gt;
  };
  await read("kilit sonrası");
  const k1 = await api.get(`/api/workspace/stock/${K.id}`);
  const r1 = await api.put(`/api/workspace/stock/${K.id}`, { unitPrice: "80", updatedAt: k1.data.item?.updatedAt ?? k1.data.updatedAt });
  console.log(`K kart alış fiyatı 50 → 80 (2026-03-10, kilit 31.12.2025): ${r1.status} ${r1.status !== 200 ? JSON.stringify(r1.data).slice(0, 300) : ""}`);
  await read("kart fiyatı değişince");
  const h1 = await api.get(`/api/workspace/stock/${H.id}`);
  const r2 = await api.put(`/api/workspace/stock/${H.id}`, { kind: "service", updatedAt: h1.data.item?.updatedAt ?? h1.data.updatedAt });
  console.log(`H türü Ürün → Hizmet: ${r2.status} ${r2.status !== 200 ? JSON.stringify(r2.data).slice(0, 300) : ""}`);
  await read("tür değişince");
  const integ = await api.get("/api/workspace/ledger/integrity");
  console.log(`Mutabakat Testi: ok ${integ.data?.ok} · başarısız ${JSON.stringify((integ.data?.failures || []).map(f => f.code || f.name)).slice(0, 300)}`);
} finally {
  await ctx.server.close();
}
