// 2.5.0 Ç7a tur 2b — KG-6 POS komisyonu SATIŞ (çekim) günü (kural kitabı §9 KG-6 "Tarih: satış (çekim) günü (B komisyon hesabı / A 108; valörde net)"; 3-D D-01 "Komisyon tarihi ve
// hesabı KG-6"; KG-20 "POS iadesinde komisyon iadesi: yalnız banka iade ederse (B 108 / A komisyon hesabı)"; KULLANICI KARARI 05.11 17:16 (5) KG-6 = A; S177 = A "komisyon farkı
// değişikliğin / valörün gününde"; S178 = A "KG-6 yalnız BSMV / vergisiz kipte; KDV kipi bugünkü gibi"). docs/erp/C7A-BANKA-TASARIM.md §14. Beklenenler testin KENDİ elle hesabı
// (kitap satırı + karar metni + POS kartının oranı), programın çıktısından değil. Kuruş.
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026 Perşembe; Ziraat 100.000; Ziraat Fiziki POS: Banka, BSMV Dahil, Tek Çekim %2,5, 3 Taksit %3,5, valör 2 iş günü → 12.10):
//   1. 08.10 POS tahsilatı 10.000 → 08.10 B 108.01 10.000 / A 120 · 08.10 B 653 250 / A 108.01 250 (satış günü). 08.10–11.10: 108.01 = 9.750, 653 = 250. 12.10 gün fişi
//      B 102.01 9.750 / A 108.01 9.750 (653 satırı yok); 108.01 = 0, 653 = 250, Ziraat 109.750. POS raporlarının sayıları değişmez (gün fişinin saklı satırları aynen).
//   2. 3 Taksit 12.000 (%3,5 = 420; 140 × 3) → satış günü B 653 420 / A 108.01 420 (BÜTÜN taksitler); 108.01 = 11.580. İade Edilmez iade 3.000 → komisyon maddesi yok; 108.01 = 8.580.
//   3. Oransal iade (İadede Komisyon): satış 10.000 (250), valörden önce iade 4.000 → iade günü B 108.01 100 / A 653 100; 12.10 gün fişi B 102.01 5.850 / A 108.01 5.850; 653 = 150.
//   4. Elle Onay (Komisyon Farkı, S177 = A): satış 10.000, 13.10'da net 9.740 onaylanır → 08.10 B 653 250 / A 108.01 250; 13.10 B 102.01 9.740 · B 653 10 / A 108.01 9.750.
//   5. BSMV Hariç (kesinti = komisyon + BSMV: 250 + 12,50) ve sabit ücret (oran 0, ücret 15): satış günü 653 = 262,50 / 15.
//   6. KDV kipi (Ödeme Kuruluşu, KDV Hariç; S178 = A): satış günü komisyon maddesi YOK; 108.01 = brüt 10.000 valöre kadar; valörde B 320 300 / A 108.01 (bugünkü gibi).
//   7. Düzeltme (yeniden planlama): bankaya geçmiş 10.000 satış 8.000'e düzeltilir → eski gün fişi ters kaydedilir, eski satışın maddesi kalkar; yeni satış 08.10 B 653 200 / A 108.01 200;
//      12.10 yeni gün fişi B 102.01 7.800 / A 108.01 7.800. 653 = 200, 108.01 = 0.
//   8. Yıl dönümü: 30.12.2026 satış 10.000 (valör 04.01.2027) → komisyon 2026'da (30.12), 2027'nin gün fişinde 653 yok.
// Her adımda Mutabakat Testi temiz (108 / bank:sub:108.01 / denge) — süzgeçli kapı her yazımda (409 olmaz).
// NASIL BOZARIM: komisyonu valöre geri al (1: 08.10'da 653 yok); taksitli satışta yalnız ilk kalem (2: 140); KDV kipini de satış gününe al (6: madde var); iade işaretini çevir (3: 653 = 350);
//   gün fişinin 108'ini netlememek (1: 108.01 = −250 / Mutabakat 108 sapması); beklenende bekleyeni düşmemek (1: bank:sub:108.01 sapması). Reddedilen istek başarı sayılmaz (ders 3).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, integrityOk, kurus, must, openAcceptanceAccounts, openPos, settle, subBalances, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";

async function world(posExtra = {}) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, posExtra));
  return { ctx, api: ctx.api, acc, abc, pos };
}
const collect = (w, body) => must(`POS tahsilatı ${body.amount}`, w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "in", method: "card", date: TODAY, posId: w.pos.id, ...body }));
const refund = (w, body) => must(`POS iadesi ${body.amount}`, w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "out", method: "card", date: TODAY, posId: w.pos.id, ...body }));
const setClock = (w, iso) => w.ctx.server.clock.set(`${iso}T10:00:00+03:00`);
const entries = w => w.ctx.server.app.ledger.build();
const lineSet = entry => entry.lines.map(line => `${line.account}${line.sub ? `/${line.sub}` : ""}:${line.debit}:${line.credit}`).sort();
const commissionEntries = w => entries(w).filter(entry => entry.id.startsWith("pos-commission:")).map(entry => ({ date: entry.date, lines: lineSet(entry) }));
const dayVouchers = w => {
  const ids = new Set(w.ctx.store.all("SELECT id FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'").map(row => `bank:${row.id}`));
  return entries(w).filter(entry => ids.has(entry.id)).map(entry => ({ date: entry.date, lines: lineSet(entry) }));
};
const sub = async (w, code) => kurus((await subBalances(w.api))[code]?.balance || 0);
const gl = async (w, code) => kurus((await trialBalances(w.api))[code] || 0);
const sales = w => w.ctx.store.all("SELECT id, kind FROM pos_sales WHERE status = 'active' ORDER BY rowid");

describe("Ç7a KG-6 — POS komisyonu satış (çekim) günü; valörde net (KG-6 = A, S177 = A, S178 = A)", () => {
  it("1. tek çekim: satış günü B 653 / A 108.01; valöre kadar 108.01 = net; gün fişi net (653 satırı yok)", async () => {
    const w = await world();
    try {
      await collect(w, { amount: "10.000" });
      assert.deepEqual(commissionEntries(w), [{ date: "2026-10-08", lines: ["108/108.01:0:25000", "653:25000:0"] }], "08.10 B 653 250 / A 108.01 250");
      assert.equal(await sub(w, "108.01"), 975_000, "108.01 = bankaya geçmemiş NET alacak 9.750");
      assert.equal(await gl(w, "108"), 975_000);
      assert.equal(await gl(w, "653"), 25_000, "653 satış gününde 250");
      await integrityOk(w.api, "satış günü");
      setClock(w, "2026-10-12");
      assert.equal((await settle(w.api)).settled, 1);
      assert.deepEqual(dayVouchers(w), [{ date: "2026-10-12", lines: ["102/102.01:975000:0", "108/108.01:0:975000"] }], "12.10 B 102.01 9.750 / A 108.01 9.750");
      // Gün fişinin SAKLI satırları (POS raporları, Banka Masraf Raporu bunları okur) değişmedi: B 102 9.750 · B 653 250 / A 108 10.000.
      const stored = w.ctx.store.all("SELECT l.gl, l.side, l.try_minor AS m FROM bank_lines l JOIN fin_events e ON e.id = l.event_id WHERE e.type = 'pos_settlement' ORDER BY l.gl").map(row => `${row.gl}:${row.side}:${row.m}`);
      assert.deepEqual(stored, ["102:D:975000", "108:C:1000000", "653:D:25000"]);
      assert.equal(await sub(w, "108.01"), 0);
      assert.equal(await gl(w, "653"), 25_000, "653 değişmez");
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), 10_975_000, "Ziraat 109.750");
      await integrityOk(w.api, "valör");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("2. taksitli satış: BÜTÜN taksitlerin kesintisi satış gününde; İade Edilmez iade komisyon maddesi doğurmaz", async () => {
    const w = await world();
    try {
      await collect(w, { amount: "12.000", posInstallments: 3 });
      assert.deepEqual(commissionEntries(w), [{ date: "2026-10-08", lines: ["108/108.01:0:42000", "653:42000:0"] }], "420 = 3 × 140");
      assert.equal(await sub(w, "108.01"), 1_158_000);
      const [sale] = sales(w);
      setClock(w, "2026-10-09");
      await refund(w, { amount: "3.000", date: "2026-10-09", posRefundOf: sale.id });
      assert.equal(commissionEntries(w).length, 1, "İade Edilmez: iade günü komisyon maddesi yok");
      assert.equal(await sub(w, "108.01"), 858_000, "12.000 − 3.000 − 420");
      assert.equal(await gl(w, "653"), 42_000);
      await integrityOk(w.api, "taksitli + iade");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("3. Oransal iade: iade edilen kesinti iade gününde ters (B 108.01 / A 653); gün fişi net", async () => {
    const w = await world({ refundCommission: "proportional" });
    try {
      await collect(w, { amount: "10.000" });
      const [sale] = sales(w);
      setClock(w, "2026-10-09");
      await refund(w, { amount: "4.000", date: "2026-10-09", posRefundOf: sale.id });
      assert.deepEqual(commissionEntries(w), [
        { date: "2026-10-08", lines: ["108/108.01:0:25000", "653:25000:0"] },
        { date: "2026-10-09", lines: ["108/108.01:10000:0", "653:0:10000"] },
      ], "iade günü B 108.01 100 / A 653 100");
      assert.equal(await sub(w, "108.01"), 585_000, "10.000 − 4.000 − 250 + 100");
      await integrityOk(w.api, "oransal iade");
      setClock(w, "2026-10-12");
      await settle(w.api);
      assert.deepEqual(dayVouchers(w), [{ date: "2026-10-12", lines: ["102/102.01:585000:0", "108/108.01:0:585000"] }]);
      assert.equal(await gl(w, "653"), 15_000);
      assert.equal(await sub(w, "108.01"), 0);
      await integrityOk(w.api, "oransal iade valör");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("4. Elle Onay: Komisyon Farkı valörün (onayın) gününde (S177 = A); satış günü maddesi değişmez", async () => {
    const w = await world({ settleMode: "manual" });
    try {
      await collect(w, { amount: "10.000" });
      setClock(w, "2026-10-13");
      await must("onayla", w.api.post(`${BANK}/pos/items/confirm`, { posId: w.pos.id, valueDate: "2026-10-12", date: "2026-10-13", netAmount: "9.740" }));
      assert.deepEqual(commissionEntries(w), [{ date: "2026-10-08", lines: ["108/108.01:0:25000", "653:25000:0"] }]);
      assert.deepEqual(dayVouchers(w), [{ date: "2026-10-13", lines: ["102/102.01:974000:0", "108/108.01:0:975000", "653:1000:0"] }], "13.10 B 102.01 9.740 · B 653 10 / A 108.01 9.750");
      assert.equal(await gl(w, "653"), 26_000);
      assert.equal(await sub(w, "108.01"), 0);
      await integrityOk(w.api, "onay");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("5. BSMV Hariç (kesinti = komisyon + BSMV) ve sabit işlem ücreti satış gününde", async () => {
    const w = await world({ tax: "bsmv_excl" });
    try {
      await collect(w, { amount: "10.000" });
      assert.deepEqual(commissionEntries(w), [{ date: "2026-10-08", lines: ["108/108.01:0:26250", "653:26250:0"] }], "250 + 12,50");
      await integrityOk(w.api, "BSMV Hariç");
    } finally {
      await w.ctx.server.close();
    }
    const f = await world({ fixedFee: "15", rates: [{ installments: 1, rate: "0" }] });
    try {
      await collect(f, { amount: "1.000" });
      assert.deepEqual(commissionEntries(f), [{ date: "2026-10-08", lines: ["108/108.01:0:1500", "653:1500:0"] }], "sabit ücret 15");
      await integrityOk(f.api, "sabit ücret");
    } finally {
      await f.ctx.server.close();
    }
  });

  it("6. KDV kipi (Ödeme Kuruluşu): satış günü maddesi yok; kesinti valörde sağlayıcıya (bugünkü gibi — S178 = A)", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
      const w = { ctx, api: ctx.api, acc, abc, pos };
      await collect(w, { amount: "10.000" });
      assert.deepEqual(commissionEntries(w), [], "KDV kipinde satış günü maddesi yok");
      assert.equal(await sub(w, "108.01"), 1_000_000, "108.01 = brüt valöre kadar");
      setClock(w, "2026-10-12");
      await settle(w.api);
      assert.equal(await sub(w, "108.01"), 0);
      assert.equal(await gl(w, "653"), 0, "653 yok");
      await integrityOk(w.api, "KDV kipi");
    } finally {
      await ctx.server.close();
    }
  });

  it("7. bankaya geçmiş satış düzeltilir (yeniden planlama): eski maddeler kalkar, yeni satışın komisyonu satış gününde", async () => {
    const w = await world();
    try {
      await collect(w, { amount: "10.000" });
      setClock(w, "2026-10-12");
      await settle(w.api);
      const entry = w.ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND method = 'card' ORDER BY rowid DESC LIMIT 1", w.abc.id);
      await must("düzelt", w.api.put(`/api/workspace/accounts/${w.abc.id}/entries/${entry.id}`, { kind: "in", amount: "8.000", method: "card", posId: w.pos.id, posInstallments: 1, date: TODAY }));
      await settle(w.api);
      assert.deepEqual(commissionEntries(w), [{ date: "2026-10-08", lines: ["108/108.01:0:20000", "653:20000:0"] }], "yalnız yeni satış (200)");
      assert.deepEqual(dayVouchers(w), [{ date: "2026-10-12", lines: ["102/102.01:780000:0", "108/108.01:0:780000"] }]);
      assert.equal(await gl(w, "653"), 20_000);
      assert.equal(await sub(w, "108.01"), 0);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), 10_780_000);
      await integrityOk(w.api, "düzeltme");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("8. yıl dönümü: 30.12 satışın komisyonu 2026'da; 2027'deki gün fişinde 653 yok", async () => {
    const w = await world();
    try {
      setClock(w, "2026-12-30");
      await collect(w, { amount: "10.000", date: "2026-12-30" });
      setClock(w, "2027-01-05");
      await settle(w.api);
      assert.deepEqual(commissionEntries(w), [{ date: "2026-12-30", lines: ["108/108.01:0:25000", "653:25000:0"] }]);
      const [voucher] = dayVouchers(w);
      assert.ok(voucher.date >= "2027-01-01", `valör 2027'de (${voucher.date})`);
      assert.deepEqual(voucher.lines, ["102/102.01:975000:0", "108/108.01:0:975000"]);
      const y2026 = await must("2026 mizanı", w.api.get("/api/workspace/ledger?from=2026-01-01&to=2026-12-31"));
      const row = code => y2026.trial.accounts.find(item => item.code === code);
      assert.equal(kurus(row("653")?.balance || 0), 25_000, "2026 653 = 250");
      assert.equal(kurus(row("108")?.balance || 0), 975_000, "2026 sonu 108 = 9.750 (bekleyen net)");
      await integrityOk(w.api, "yıl dönümü");
    } finally {
      await w.ctx.server.close();
    }
  });

  // Tek aday düzeltme turu (dar kontrol t3c7a DÜŞÜK — N7): Banka Ayarları'ndaki komisyon hesabı OKUNUR. S187 = A (KULLANICI KURALIYLA ÖNERİ, 14.11 12:13): "POS komisyon hesabı sonradan
  // değiştirilirse, bankaya henüz geçmemiş (bekleyen) POS kaleminin satış günü komisyon maddesi YENİ hesaba geçer …; bankaya geçmiş kalem eski hesabında kalır."
  it("9. komisyon hesabı ayarı (S187 = A): bankaya geçmiş satış 653'te kalır; bekleyen ve yeni satışların satış günü maddesi yeni hesapta (770)", async () => {
    const w = await world();
    try {
      await collect(w, { amount: "10.000" });
      setClock(w, "2026-10-12");
      assert.equal((await settle(w.api)).settled, 1, "08.10 satışı 12.10'da bankaya geçti");
      await collect(w, { amount: "4.000", date: "2026-10-12" });
      await must("komisyon hesabı 770", w.api.put(`${BANK}/settings`, { values: { gl: { commission: "770" } } }));
      await collect(w, { amount: "2.000", date: "2026-10-12" });
      assert.deepEqual(commissionEntries(w).map(entry => `${entry.date} ${entry.lines.join(" ")}`).sort(), [
        "2026-10-08 108/108.01:0:25000 653:25000:0",
        "2026-10-12 108/108.01:0:10000 770:10000:0",
        "2026-10-12 108/108.01:0:5000 770:5000:0",
      ], "geçmiş 250 653'te; bekleyen 100 (ayar değişmeden önce girilmiş) ve yeni 50 770'te");
      assert.equal(await gl(w, "653"), 25_000);
      assert.equal(await gl(w, "770"), 15_000);
      assert.equal(await sub(w, "108.01"), 585_000, "bekleyen net: 4.000 − 100 + 2.000 − 50");
      await integrityOk(w.api, "komisyon hesabı değişti");
    } finally {
      await w.ctx.server.close();
    }
  });
});
