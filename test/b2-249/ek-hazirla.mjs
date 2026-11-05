// 2.4.9 B2 (tasarım notu §7 adım 3, §11 R2) — ölçüm verisinin ek hazırlığı, PROGRAMIN KENDİ API'SİYLE (SQL yok): esitlik-hazirla.mjs çıktısının taze kopyası açılır ve
//   bes-bin: "+ Yeni Cari" ucuyla 5.000 cariye tamamlanır (MAX_TARGETS sınırındaki "Tümüne" ölçümü);
//   iade:    R2 — plans().forAccount kişi başı returnCuts() bütün satıştan iade faturalarını tarar: 1.000 yeni cariye hizmet satış faturası + "mevcut borcu taksitlendir" kartı +
//            satıştan TAM iade faturası (borç kalmaz → kartın kapsamından düşer = coverCuts) girilir → iade sayısı ~27'den ~1.000'e.
// Kullanım: node test/b2-249/ek-hazirla.mjs <kaynak hazır> <yeni hazır> <bes-bin|iade> <özet.json>
import { writeFileSync } from "node:fs";
import { kurulum, log } from "../isz-248/ortak.mjs";

const [VERI, HAZIR, TUR, OZET] = process.argv.slice(2);
if (!VERI || !HAZIR || !["bes-bin", "iade"].includes(TUR) || !OZET) throw new Error("kullanım: ek-hazirla.mjs <kaynak> <yeni> <bes-bin|iade> <özet.json>");
const SAAT = "2026-11-02T10:00:00+03:00";
const ctx = await kurulum({ veri: VERI, is: HAZIR, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `b2k${Date.now().toString(36)}` });
const s = { veri: VERI, tur: TUR, saat: SAAT, reddedilen: {} };
try {
  const { admin, at } = ctx;
  const say = ad => {
    s[ad] = (s[ad] || 0) + 1;
  };
  const iste = async (ad, yontem, yol, govde) => {
    const r = yontem === "get" ? await admin.get(at(yol)) : await admin[yontem](at(yol), govde);
    if (r.status === 200) say(ad);
    else {
      s.reddedilen[ad] = (s.reddedilen[ad] || 0) + 1;
      if (s.reddedilen[ad] <= 2) log("reddedildi", ad, r.status, JSON.stringify(r.data).slice(0, 240));
    }
    return r;
  };
  const L = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
  if (TUR === "bes-bin") {
    for (let i = 1; L.length + (s.cari || 0) < 5000; i += 1) {
      await iste("cari", "post", "/api/workspace/accounts", { name: `B2 Ek Cari ${i}`, phone: `0533${String(i).padStart(7, "0")}`, ...(i % 2 ? { openingBalance: String(100 + (i % 7) * 10), registeredOn: "2026-09-01" } : {}) });
      if (s.reddedilen.cari > 20) throw new Error("cari açılamıyor");
    }
  } else {
    // Mevcut cariler çoğunlukla alacaklı (T9) → kapsayan kart reddedilir; iade cariler YENİ müşteri olarak açılır (satış borcu → kart borcun yarısını taksitlendirir → iade).
    for (let i = 1; i <= 1000; i += 1) {
      const cari = await iste("iadeCarisi", "post", "/api/workspace/accounts", { name: `B2 İade Cari ${i}`, phone: `0534${String(i).padStart(7, "0")}`, registeredOn: "2026-10-01" });
      if (cari.status !== 200) continue;
      const id = cari.data.data.id;
      const satis = await iste("satis", "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: id, issueDate: "2026-11-02", lines: [{ name: "B2 Hizmet", qty: 2, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
      if (satis.status !== 200) continue;
      await iste("kartMevcutBorc", "post", "/api/workspace/plans", { accountId: id, name: "B2 İade Kartı", total: "600", count: 2, firstDue: "2026-12-02", startDate: "2026-11-02", coversBalance: true });
      const satir = (await admin.get(at(`/api/workspace/invoices/${satis.data.data.id}`))).data.data.lines[0];
      await iste("iade", "post", "/api/workspace/invoices", { kind: "sale_return", originalId: satis.data.data.id, issueDate: "2026-11-02", lines: [{ originLineId: satir.id, qty: 2 }], payment: { rest: "open" } });
    }
  }
  s.cariSayisi = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.length;
  const db = ctx.app.store;
  s.iadeFaturasi = db.get("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return'")?.n;
  s.coverCutsliIade = db.get("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'")?.n;
  log(JSON.stringify(s));
} finally {
  await ctx.kapat();
}
s.bitti = new Date().toISOString();
writeFileSync(OZET, `${JSON.stringify(s, null, 1)}\n`);
