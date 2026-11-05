// 2.4.9 R2 — eşdeğerlik verisine ÇEŞİTLİ İADE BİÇİMLERİ, PROGRAMIN KENDİ API'SİYLE (yazım SQL'le yapılmaz; kimlikler yalnız okunur): B2'nin R2 kopyasının
// (test/b2-249/ek-hazirla.mjs iade — 1.000 cari, satış 1.200 + "mevcut borcu taksitlendir" kartı 600 + tam iade) TAZE kopyası açılır ve
//   iade iptali (50), iade silme (50), iade düzenleme 2 → 1 adet (50), kartı başka cariye taşıma (30), kart silme (20),
//   yeni 200 cari: iki kapsayan kart (300 + 300) + {tam iade (tek belgede iki kart) | kısmi iade | iki kısmi iade | taslak iade},
//   yeni 20 cari: iade → iptal → yeniden iade
// girilir. Saat AKAR (üretimdeki gibi; kartın kapsamı açılış anına göre). Kullanım: node test/r2-249/cesit-hazirla.mjs <kaynak hazır> <yeni hazır> <özet.json>
import { writeFileSync } from "node:fs";
import { kurulum, log } from "../isz-248/ortak.mjs";

const [VERI, HAZIR, OZET] = process.argv.slice(2);
if (!VERI || !HAZIR || !OZET) throw new Error("kullanım: cesit-hazirla.mjs <kaynak> <yeni> <özet.json>");
const SAAT = "2026-11-02T11:00:00+03:00";
const ctx = await kurulum({ veri: VERI, is: HAZIR, saat: { time: SAAT }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `r2c${Date.now().toString(36)}` });
const s = { veri: VERI, saat: SAAT, tamam: {}, reddedilen: {} };
try {
  const { admin, at } = ctx;
  const db = ctx.app.store;
  const iste = async (ad, yontem, yol, govde) => {
    const r = yontem === "get" || yontem === "del" ? await admin[yontem](at(yol)) : await admin[yontem](at(yol), govde);
    if (r.status === 200) s.tamam[ad] = (s.tamam[ad] || 0) + 1;
    else {
      s.reddedilen[ad] = (s.reddedilen[ad] || 0) + 1;
      if (s.reddedilen[ad] <= 2) log("reddedildi", ad, r.status, JSON.stringify(r.data).slice(0, 240));
    }
    return r;
  };
  // R2 kopyasının iade carileri (yalnız okuma): cari, satış, iade, kart.
  const iadeli = db.all(
    `SELECT a.id AS accountId, a.name, r.id AS returnId, r.original_id AS saleId, r.issue_date AS returnDate, (SELECT p.id FROM plans p WHERE p.account_id = a.id AND p.deleted_at IS NULL LIMIT 1) AS planId
     FROM accounts a JOIN invoices r ON r.account_id = a.id AND r.kind = 'sale_return' AND r.status = 'issued'
     WHERE a.name LIKE 'B2 İade Cari %' AND a.deleted_at IS NULL ORDER BY a.rowid`,
  );
  s.iadeliCari = iadeli.length;
  const satirOf = async saleId => (await admin.get(at(`/api/workspace/invoices/${saleId}`))).data.data.lines[0];
  for (const x of iadeli.slice(0, 50)) await iste("iadeIptal", "post", `/api/workspace/invoices/${x.returnId}/cancel`, {});
  for (const x of iadeli.slice(50, 100)) await iste("iadeSil", "del", `/api/workspace/invoices/${x.returnId}`);
  for (const x of iadeli.slice(100, 150)) {
    const satir = await satirOf(x.saleId);
    await iste("iadeDuzenle", "post", `/api/workspace/invoices/${x.returnId}/edit`, { originalId: x.saleId, issueDate: x.returnDate, lines: [{ originLineId: satir.id, qty: 1 }], payment: {} });
  }
  for (const [i, x] of iadeli.slice(150, 180).entries()) {
    const hedef = await iste("tasimaHedefi", "post", "/api/workspace/accounts", { name: `R2 Taşıma Hedef ${i + 1}`, phone: `0535${String(i + 1).padStart(7, "0")}`, registeredOn: "2026-10-01", openingBalance: "2000" });
    if (hedef.status === 200 && x.planId) await iste("kartTasima", "put", `/api/workspace/plans/${x.planId}`, { accountId: hedef.data.data.id });
  }
  for (const x of iadeli.slice(180, 200)) if (x.planId) await iste("kartSil", "del", `/api/workspace/plans/${x.planId}`);
  const yeniCari = async (ad, i, tur) => {
    const cari = await iste(tur, "post", "/api/workspace/accounts", { name: `${ad} ${i}`, phone: `0536${String(i).padStart(7, "0")}`, registeredOn: "2026-10-01" });
    return cari.status === 200 ? cari.data.data.id : null;
  };
  const satis = async id => {
    const r = await iste("satis", "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: id, issueDate: "2026-11-02", lines: [{ name: "R2 Hizmet", qty: 2, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
    return r.status === 200 ? r.data.data.id : null;
  };
  const kart = (id, total) => iste("kart", "post", "/api/workspace/plans", { accountId: id, name: `R2 Kart ${total}`, total: String(total), count: 2, firstDue: "2026-12-02", startDate: "2026-11-02", coversBalance: true });
  const iade = async (saleId, qty, ek = {}) => {
    const satir = await satirOf(saleId);
    return iste(ek.status === "draft" ? "taslakIade" : "iade", "post", "/api/workspace/invoices", { kind: "sale_return", originalId: saleId, issueDate: "2026-11-02", lines: [{ originLineId: satir.id, qty }], payment: { rest: "open" }, ...ek });
  };
  for (let i = 1; i <= 200; i += 1) {
    const id = await yeniCari("R2 Çeşit Cari", i, "cesitCari");
    if (!id) continue;
    const sale = await satis(id);
    if (!sale) continue;
    await kart(id, 300);
    await kart(id, 300);
    if (i % 4 === 0) await iade(sale, 2);
    else if (i % 4 === 1) await iade(sale, 1);
    else if (i % 4 === 2) {
      await iade(sale, 1);
      await iade(sale, 1);
    } else await iade(sale, 1, { status: "draft" });
  }
  for (let i = 1; i <= 20; i += 1) {
    const id = await yeniCari("R2 Yeniden İade Cari", 300 + i, "yenidenCari");
    if (!id) continue;
    const sale = await satis(id);
    if (!sale) continue;
    await kart(id, 600);
    const ilk = await iade(sale, 1);
    if (ilk.status === 200) await iste("iadeIptal2", "post", `/api/workspace/invoices/${ilk.data.data.id}/cancel`, {});
    await iade(sale, 2);
  }
  const n = sql => db.get(sql)?.n;
  s.cariSayisi = n("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
  s.iade = {
    toplam: n("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return'"),
    kesinlesmis: n("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'issued'"),
    iptal: n("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'cancelled'"),
    taslak: n("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'draft'"),
    coverCutsli: n("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'"),
    ikiKartliBelge: db.all("SELECT payment_json AS j FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'").filter(row => Object.keys(JSON.parse(row.j).coverCuts || {}).length > 1).length,
  };
  s.kart = { etkin: n("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL"), silinmis: n("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NOT NULL"), kartliCari: n("SELECT COUNT(DISTINCT account_id) AS n FROM plans WHERE deleted_at IS NULL") };
  log(JSON.stringify(s));
} finally {
  await ctx.kapat();
}
s.bitti = new Date().toISOString();
writeFileSync(OZET, `${JSON.stringify(s, null, 1)}\n`);
