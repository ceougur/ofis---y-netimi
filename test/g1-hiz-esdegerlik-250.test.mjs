// 2.5.0 tek aday düzeltme turu — G1 hız 3 EŞDEĞERLİK testi (ders 47: hız düzeltmesi eşdeğerlik testiyle; ders 53 (a)).
//
// Düzeltme bir yeniden düzenlemedir: davranış DEĞİŞMEZ, yalnız okuma sayısı. Banka ve POS Hareketleri'nin Tüm Hesaplar seçimi "açılışta sayılmış" payı (moneyLines.coveredWays)
// için Kasa raporunun (cash().report → moneyLines.balances) taramasına ek olarak bütün para satırlarını bir kez daha tarıyordu; artık ikisi TEK saklı okumadan (coverGroups:
// yol × hesap toplamı + sayılmış satırların gün başına payı) türer. Bu dosya iki yolu, programın BAŞKA iki okumasıyla karşılaştırır (kendi kodlarıyla bağımsız):
//   1. balances() ≡ balances(rawGroups()) — Kasa'nın eski okuması (sayılmış ayrımı yok, yalnız yol × hesap toplamı).
//   2. coveredWays({ before: g }) ≡ JS koşulu (lib/bank/opening-cover.mjs isCovered — Ana Defter türetmesinin ve rapor işaretinin TEK kaynağı) ile sınıflanmış bağsız satırların
//      yol başına toplamı ve g'den öncekiler — verideki her gün, ilk günden önce, '' (öncesi yok) ve uzak gelecek için; Σ yol = coveredTotal() (Ana Defter 519'unun SQL'i).
// Dört durumda (hesap yok · havale + kart hesabı açıldı · Devir Kapanışı · Geri Al — ters kaydın satırları tarihinden bağımsız sayılır, bugünün tarihinde) ve HER DURUMDA önce
// saklı değer okunup sonra yazılarak (veri damgası değişince saklı değer kullanılmaz; ESKİ değer dönerse 2 kırılır).
// NASIL BOZARIM: sayılmış satırın günü gruplanmaz (before = toplam); saklı değer damgasız (yazımdan sonra eski toplam); COVER_SQL yerine yalnız 'ref = ""' (hesapsız bütün havale /
// POS sayılır); Kasa toplamı sayılmış satırları düşer (balances ≠ rawGroups).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";
import { coverBounds, isCovered } from "../server/lib/bank/opening-cover.mjs";

const money = ctx => ctx.server.app.context?.money || null;

describe("G1 hız 3 — coveredWays / balances tek saklı okumadan: eski okumalarla ve JS koşuluyla birebir", () => {
  let ctx;
  let lines;
  let party;
  const add = (label, body) => must(label, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { cashForce: true, ...body }));
  // Bağımsız beklenen: sınıflanmış bağsız satırlar (light) + JS koşulu (rapor işaretinin markCounted'ı ile aynı girdi).
  const expected = day => {
    const bounds = coverBounds(ctx.server.app.store);
    const out = {};
    for (const line of lines.classified({ ways: ["bank", "card"], unbound: true, light: true })) {
      if (line.ref) continue;
      const bankLine = Number(line.src) === 9;
      const counted = isCovered({ way: line.way === "bank" ? "bank" : "card", kind: line.kind, date: line.date, bankLine, carry: bankLine && line.base_type === "carry_close" }, bounds);
      if (!counted) continue;
      const signed = (line.kind === "in" ? 1 : -1) * Number(line.cents);
      const item = (out[line.way] ||= { cents: 0, before: 0 });
      item.cents += signed;
      if (line.date < day) item.before += signed;
    }
    return out;
  };
  const days = () => {
    const list = ctx.server.app.store.all(
      "SELECT DISTINCT date FROM (SELECT date FROM account_entries UNION SELECT date FROM fin_events UNION SELECT date FROM cash_entries) WHERE date <> '' ORDER BY date",
    ).map(row => row.date);
    // gün sınırları: verideki her gün + bir sonraki gün (eşitlik '<'), ilk günden önce, '' (öncesi yok), uzak gelecek
    return ["", "1900-01-01", "9999-12-31", ...list, ...list.map(day => `${day}~`)];
  };
  const check = (tag, { counted }) => {
    const ways = lines.coveredWays({ before: "" });
    const total = Object.values(ways).reduce((sum, item) => sum + item.cents, 0);
    assert.equal(total, lines.coveredTotal().cents, `${tag}: Σ yol = coveredTotal (519)`);
    assert.equal(lines.coveredTotal().count > 0, counted, `${tag}: sayılmış satır ${counted ? "var" : "yok"} (karşılaştırma boşa çalışmaz)`);
    for (const day of days()) assert.deepEqual(lines.coveredWays({ before: day }), expected(day), `${tag}: coveredWays before ${JSON.stringify(day)}`);
    assert.deepEqual(lines.balances(), lines.balances(lines.rawGroups()), `${tag}: balances = rawGroups toplamı`);
  };
  // Saklı değeri doldur (iki çağrı: ikincisi saklıdan), sonra yaz — sonraki check eski saklı değeri görürse kırılır.
  const warm = () => {
    lines.coveredWays({ before: "2026-01-01" });
    lines.balances();
    lines.coveredWays({ before: "2026-01-01" });
  };

  before(async () => {
    ctx = await bootBank();
    lines = money(ctx);
    assert.ok(lines?.coveredWays && lines.balances && lines.rawGroups, "moneyLines bağlamda");
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await add("20.09 havale", { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" });
    await add("25.09 ödeme", { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" });
    await add("22.09 POS", { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" });
    await add("15.09 kartla ödeme", { kind: "out", amount: "400", method: "card", date: "2026-09-15" });
    await add("01.10 havale", { kind: "in", amount: "700", method: "bank", date: "2026-10-01" });
    await add("03.10 havale", { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" });
    await must("Kasa", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "250", method: "cash", date: "2026-09-21", description: "nakit" }));
  });
  after(() => ctx.server.close());

  let ziraat;
  let run;
  it("1. hesap yok: sayılmış satır yok; balances = rawGroups", () => {
    check("hesap yok", { counted: false });
    warm();
  });
  it("2. Ziraat (havale) ve Şirket Kartı (kart) 01.10'da açıldı: havale ve kart ÇIKIŞI sayılır, POS girişi sayılmaz", async () => {
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    check("hesaplar", { counted: true });
    const ways = lines.coveredWays({ before: "" });
    assert.deepEqual(ways, { bank: { cents: 400_000, before: 0 }, card: { cents: -40_000, before: 0 } }, "elle: havale 5.000 − 1.000; kart çıkışı −400");
    warm();
  });
  it("3. Devir Kapanışı (D = 01.10): POS girişi de ve kapanış satırları sayılır", async () => {
    run = await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "none" }));
    assert.ok(ctx.server.app.store.get("SELECT 1 AS x FROM fin_events WHERE type = 'carry_close' AND status = 'active'"), "Devir Kapanışı yazıldı");
    check("Devir Kapanışı", { counted: true });
    warm();
  });
  it("4. Geri Al: ters kaydın satırları (bugünün tarihinde) tarihinden bağımsız sayılır; her gün sınırında birebir", async () => {
    await must("geri al", ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}));
    check("Geri Al", { counted: true });
    const reversal = ctx.server.app.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'reversal'").n;
    assert.ok(reversal > 0, "ters kayıt var");
  });
});
