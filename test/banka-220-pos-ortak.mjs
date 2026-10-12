// 2.2.0 POS (plan Aşama 10–11) testlerinin ortak yardımcıları. (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)
//
// Kâhin: plan §12.5 kabul 17–28 ve §4.2–§4.6 tablolarının ÖNCEDEN yazılmış sayıları (program kodundan türetilmez). Sahte saat 08.10.2026
// Perşembe (kabul ön koşulu; ders 13: tarihe bağlı test yok — saat server.clock ile ilerletilir).
import assert from "node:assert/strict";
import { after } from "node:test";
import { BANK, NOW, TODAY, ZIRAAT_IBAN, bootBank as bootBase, expectStatus, must, openAcceptanceAccounts, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { integrityOk } from "./banka-210-ortak.mjs";

export { BANK, NOW, TODAY, ZIRAAT_IBAN, expectStatus, must, openAcceptanceAccounts, subBalances, trialBalances, integrityOk };

// Açık kalan sunucu test sürecini asılı bırakır (ör. eski kodda kurulum adımı düşünce kapanış satırına gelinmez). Her açılan sunucu
// izlenir; dosyanın sonunda kapanmamış olanlar kapatılır. close() bir kez çalışır.
const openServers = new Set();
after(async () => {
  for (const server of [...openServers]) {
    try {
      await server.close();
    } catch {
      // kapanış hatası asıl test hatasını ezmez (ders 21)
    }
  }
});
export async function bootBank(options = {}) {
  const ctx = await bootBase(options);
  const close = ctx.server.close.bind(ctx.server);
  let closing = null;
  ctx.server.close = () => {
    openServers.delete(ctx.server);
    closing ||= close();
    return closing;
  };
  openServers.add(ctx.server);
  return ctx;
}
export const kurus = value => Math.round(Number(value) * 100);

/** Kabul 17–19: "Ziraat Fiziki POS" — Banka, BSMV Dahil, Tek Çekim %2,5, 3 Taksit %3,5, valör 2 iş günü, taksitli ödeme her ay, provizyon aynı gün. */
export const ziraatPos = (bankAccountId, extra = {}) => ({
  name: "Ziraat Fiziki POS", bankAccountId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01",
  rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }],
  ...extra,
});
export const openPos = (api, body) => must(`POS aç ${body.name}`, api.post(`${BANK}/pos`, body)).then(data => data.pos);

/** Kabul ön koşulu + 1–4: stok, iki banka hesabı, ABC Ltd. */
export async function acceptanceBase(ctx) {
  const urunA = await must("Ürün A", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "A", name: "Ürün A", unit: "Adet", openingQty: "10" }));
  const urunB = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01", iban: ZIRAAT_IBAN }));
  return { urunA, urunB, acc, abc };
}

/** Satış faturası (KDV %20 dahil) peşin POS. */
export const posInvoice = (api, { accountId, itemId, name = "Ürün B", qty, unitPrice, date, posId, installments, authCode, cardLast4, extra = {} }) =>
  api.post("/api/workspace/invoices", {
    kind: "sale", accountId, issueDate: date, pricesIncludeVat: true, lines: [{ itemId, name, qty, unitPrice, discountRate: 0, vatRate: 20 }],
    payment: { cash: [{ amount: qty * unitPrice, method: "card", ...(posId ? { posId } : {}), ...(installments ? { installments } : {}), ...(authCode ? { authCode } : {}), ...(cardLast4 ? { cardLast4 } : {}) }], cheques: [], endorse: [], rest: "open" },
    force: true, ...extra,
  });

export const balanceOf = async (api, accountId) => (await must("hesap", api.get(`${BANK}/accounts/${accountId}`))).balanceMinor;
export const summaryOf = api => must("özet", api.get(`${BANK}/summary`));
export const settle = api => must("Şimdi Aktar", api.post(`${BANK}/settle`, {}));
export const calendarOf = (api, query = "") => must("POS Ödeme Takvimi", api.get(`${BANK}/pos/calendar${query}`));
export const salesOf = (api, query = "") => must("POS İşlemleri", api.get(`${BANK}/pos/sales${query}`)).then(data => data.sales);
export const qtyOf = async (api, itemId) => (await must("stok", api.get(`/api/workspace/stock/${itemId}`))).qty;
export async function posCheck(api, label) {
  const result = await integrityOk(api, label);
  const pos = result.checks.filter(item => item.code.startsWith("pos:") || item.code === "bank:party");
  assert.ok(pos.length >= 5, `${label}: POS denetimleri görünür (${pos.map(item => item.code).join(", ")})`);
  for (const item of pos) assert.ok(item.ok, `${label}: ${item.code} ${JSON.stringify(item).slice(0, 300)}`);
  return result;
}
