// 2.3.0 İz 1 — Şüpheli Ticari Alacaklar testlerinin ortak yardımcıları. (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)
import { must } from "./banka-210-ortak.mjs";
import { trialBalances } from "./banka-210-hesap-ortak.mjs";

export const ACC = "/api/workspace/accounts";
export const take = (api, accountId, body) => api.post(`${ACC}/${accountId}/doubtful`, body);
export const release = (api, accountId, did, body) => api.post(`${ACC}/${accountId}/doubtful/${did}/release`, body);
export const provision = (api, accountId, did, body) => api.post(`${ACC}/${accountId}/doubtful/${did}/provision`, body);
export const writeOff = (api, accountId, did, body) => api.post(`${ACC}/${accountId}/doubtful/${did}/write-off`, body);
export const listOf = (api, accountId) => must("şüpheli listesi", api.get(`${ACC}/${accountId}/doubtful`));
export const customer = (api, name, registeredOn = "2026-09-01") => must(`müşteri ${name}`, api.post(ACC, { name, type: "customer", registeredOn }));
export const debt = (api, accountId, amount, date, note = "Satış") => must("borç yaz", api.post(`${ACC}/${accountId}/entries`, { kind: "debt", amount, date, note }));
export const credit = (api, accountId, amount, date, note = "İskonto") => must("alacak yaz", api.post(`${ACC}/${accountId}/entries`, { kind: "credit", amount, date, note }));
export const collect = (api, accountId, amount, date, method = "cash") => must("tahsilat", api.post(`${ACC}/${accountId}/entries`, { kind: "in", amount, date, method, note: "Tahsilat" }));
export const balanceOf = async (api, accountId) => (await must("cari kartı", api.get(`${ACC}/${accountId}`))).totals.balance;
/** Mizan: hesap kodu → TL bakiye (borç artı); olmayan hesap 0. */
export const trial = async api => {
  const tb = await trialBalances(api);
  return code => tb[String(code)] ?? 0;
};
