// Hakem K7 (10.10.2026; docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → ACILIS-EKSI-KMH, yan bulgular Y1/Y2; sonda
// test/bagimsiz/cikti/hakem-ACILIS-EKSI-KMH/canli.mjs P6/P7/P8). Plan §3.5: "KMH Limiti alanı" yalnız Vadesiz satırında (Kurumsal Kredi Kartı'nda
// kart limiti — §3.9 "KMH ya da kart limiti"; Kredi Hesabı'nda ekranın "Kredi Limiti" bilgi alanı, eksi bakiye denetimine girmez).
//   (a) API, KMH limitini Ticari, Diğer, Vadeli (ve Döviz) hesapta da kabul edip saklıyor, eksi bakiye denetimi de sayıyordu (P6: Ticari hesap API'den
//       verilen KMH ile −11.529,50'ye uyarısız düştü);
//   (b) KMH'li Vadesiz hesap Düzenle'de Ticari'ye çevrilince KMH sıfırlanmıyordu (istemci Ticari'de creditLimit göndermez; hof-bank.js:779) →
//       gizli KMH Engelle'yi atlatıyordu (P7c 200; KMH'siz Ticari'de aynı işlem P8b 409).
//
// Nasıl bozarım (önce yazıldı):
//   N1 Ticari / Diğer / Vadeli / Döviz hesaba API'den KMH ver → saklanır ve denetimde sayılır mı? (400 bank-limit; limit 0)
//   N2 Var olan Ticari hesabı PUT ile KMH'li yap (400; limit 0 kalır)
//   N3 Vadesiz + KMH → Düzenle'de Ticari (ekranın gönderdiği gövde: creditLimit yok) → KMH kalır mı? (sıfırlanır; Engelle'de eksiye çıkış 409)
//   N4 Vadesiz → Ticari çevrilirken creditLimit de gönder (400)
//   N5 Karşı deney: Vadesiz KMH, Kurumsal Kredi Kartı limiti, Kredi Hesabı limiti, Ticari'de 0 limit → 200
// Tür değişimi yalnız hareketsiz ve açılışı sıfır hesapta yapılır (plan §3.5 "Para birimi ve tür ilk hareketten sonra değiştirilemez (409)"):
// çevrilen hesabın bakiyesi her zaman 0'dır, KMH'ye dayanan eksi bakiye oluşamaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const accountOf = async (api, id) => must("hesap", api.get(`${BANK}/accounts/${id}`));
const open = (api, body) => api.post(`${BANK}/accounts`, { bankName: "Denizbank", currency: "TRY", ...body });

describe("K7 (a) — KMH limiti yalnız Vadesiz'de (kart ve kredi limiti kendi türünde)", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true });
  });
  after(() => ctx.server.close());

  it("N1: Ticari, Diğer, Vadeli ve Döviz hesaba KMH → 400 bank-limit; hesap açılmaz", async () => {
    const count = () => ctx.store.get("SELECT COUNT(*) AS n FROM bank_accounts").n;
    const start = count();
    for (const [kind, extra] of [["commercial", {}], ["other", {}], ["time", {}], ["demand", { currency: "USD" }]]) {
      const res = await open(ctx.api, { name: `KMH ${kind}${extra.currency || ""}`, kind, creditLimit: "23.059", opening: { date: "2026-10-01", amount: "1.000", confirmed: true }, ...extra });
      expectStatus(res, 400, "bank-limit", `${kind}${extra.currency ? ` ${extra.currency}` : ""} KMH`);
    }
    assert.equal(count(), start, "hiçbir hesap açılmadı");
  });

  it("N2: var olan Ticari hesabı PUT ile KMH'li yapmak → 400; limit 0 kalır", async () => {
    const commercial = await openAccount(ctx.api, { bankName: "Denizbank", name: "Ticari Hesap", kind: "commercial", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    expectStatus(await ctx.api.put(`${BANK}/accounts/${commercial.id}`, { creditLimit: "5.000" }), 400, "bank-limit", "Ticari'ye KMH");
    assert.equal((await accountOf(ctx.api, commercial.id)).creditLimitMinor, 0);
    await must("Ticari'de 0 limit serbest", ctx.api.put(`${BANK}/accounts/${commercial.id}`, { creditLimit: "0" }));
  });

  it("N5: Vadesiz KMH, Kurumsal Kredi Kartı limiti ve Kredi Hesabı limiti → 200 (limit saklanır)", async () => {
    const demand = await openAccount(ctx.api, { bankName: "Denizbank", name: "Vadesiz KMH", kind: "demand", creditLimit: "23.059", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const card = await openAccount(ctx.api, { bankName: "Denizbank", name: "Kart", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0" } });
    const loan = await openAccount(ctx.api, { bankName: "Denizbank", name: "Kredi", kind: "loan", creditLimit: "100.000", opening: { date: "2026-10-01", amount: "0" } });
    assert.equal((await accountOf(ctx.api, demand.id)).creditLimitMinor, 2_305_900);
    assert.equal((await accountOf(ctx.api, card.id)).creditLimitMinor, 5_000_000);
    assert.equal((await accountOf(ctx.api, loan.id)).creditLimitMinor, 10_000_000);
  });
});

describe("K7 (b) — Vadesiz → Ticari çevrilince KMH sıfırlanır (gizli KMH Engelle'yi atlatmaz)", () => {
  let ctx;
  let account;
  before(async () => {
    ctx = await bootBank();
    account = await openAccount(ctx.api, { bankName: "Denizbank", name: "Ticari Hesap B5", kind: "demand", creditLimit: "23.059", negativePolicy: "block", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("N4: tür Ticari + creditLimit birlikte → 400 bank-limit; hesap Vadesiz ve KMH'li kalır", async () => {
    expectStatus(await ctx.api.put(`${BANK}/accounts/${account.id}`, { kind: "commercial", creditLimit: "23.059" }), 400, "bank-limit", "Ticari + KMH");
    const card = await accountOf(ctx.api, account.id);
    assert.equal(card.kind, "demand");
    assert.equal(card.creditLimitMinor, 2_305_900);
  });

  it("N3: Düzenle'de tür Ticari (ekranın gövdesi: creditLimit yok) → KMH 0; Engelle'de 12.529,50 Diğer Gider → 409, hesap 0 kalır", async () => {
    await must("Ticari'ye çevir", ctx.api.put(`${BANK}/accounts/${account.id}`, { kind: "commercial", name: "Ticari Hesap B5" }));
    const card = await accountOf(ctx.api, account.id);
    assert.equal(card.kind, "commercial");
    assert.equal(card.creditLimitMinor, 0, "Ticari'de KMH yok");
    const spend = await ctx.api.post(`${BANK}/vouchers`, { type: "other_out", amount: "12.529,50", accountId: account.id, date: TODAY, gl: "659" });
    assert.equal(spend.status, 409, `Engelle'deki KMH'siz hesap eksiye düşmez: ${spend.status} ${spend.error || ""}`);
    assert.equal(spend.data?.accountId, account.id, "ret hesabın kimliğini taşır");
    assert.equal((await accountOf(ctx.api, account.id)).balanceMinor, 0);
  });
});
