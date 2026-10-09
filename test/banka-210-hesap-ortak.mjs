// 2.1.0 Aşama 3 (Banka Hesapları) testlerinin ortak yardımcıları. (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)
//
// Sahte saat 08.10.2026 Perşembe (plan §12.5 kabul testinin ön koşulu). Banka uçları /api/workspace/bank/* altında.
import assert from "node:assert/strict";
import { boot, must } from "./banka-210-ortak.mjs";

export const NOW = "2026-10-08T12:00:00+03:00";
export const TODAY = "2026-10-08";
export const BANK = "/api/workspace/bank";

/** Geçerli bir Türkiye IBAN'ı (ISO 13616 mod 97): TR + 2 denetim hanesi + 5 hane banka kodu + 0 + 16 hane hesap. */
export function trIban(bankCode, account) {
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  let rest = 0;
  for (const digit of `${bban}292700`) rest = (rest * 10 + Number(digit)) % 97;
  return `TR${String(98 - rest).padStart(2, "0")}${bban}`;
}
export const ZIRAAT_IBAN = trIban(10, 1234567);
export const GARANTI_IBAN = trIban(62, 7654321);

export const bootBank = (options = {}) => boot({ now: NOW, ...options });

/** Hesap açar (açılış dahil); 200 bekler. */
export const openAccount = (api, body) => must(`hesap aç ${body.bankName || ""} ${body.name || ""}`, api.post(`${BANK}/accounts`, body));

/** Kabul 1–4: Ziraat Bankası · Ana TL Hesabı (100.000) ve Garanti BBVA · Ana TL Hesabı (50.000), ikisi de 01.10.2026, Bakiye Doğrulandı. */
export async function openAcceptanceAccounts(api) {
  const ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  const garanti = await openAccount(api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: GARANTI_IBAN, opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  return { ziraat, garanti };
}

/** Hesap planı mizanı: hesap kodu → bakiye (TL, borç artı). */
export async function trialBalances(api, query = "") {
  const ledger = await must("mizan", api.get(`/api/workspace/ledger${query}`));
  return Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
}
/** Alt Hesap Mizanı: alt hesap kodu → { balance, name }. */
export async function subBalances(api, query = "") {
  const data = await must("alt hesap mizanı", api.get(`${BANK}/sub-trial${query}`));
  return Object.fromEntries(data.rows.map(row => [row.sub, { balance: row.balance, name: row.name, debit: row.debit, credit: row.credit }]));
}
export const subBalance = async (api, sub) => (await subBalances(api))[sub]?.balance ?? 0;

/** Mutabakat Testi'ndeki banka denetimleri (kod öneki → kalemler). */
export async function bankChecks(api) {
  const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  return { result, checks: result.checks.filter(item => /^(bank:|money:|gl:10[28]|gl:30[09]|gl:500)/.test(item.code)) };
}

/** Yanıt beklenen durumda ve kodda mı? */
export function expectStatus(res, status, code, label) {
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data ?? res.error).slice(0, 400)} ${res.error || ""}`);
  if (code) assert.equal(res.code, code, `${label}: kod ${res.code} (${res.error || ""})`);
}

/** Dönem kilidi (yönetici). */
export const lockPeriod = (api, lockedUntil) => must(`kilit ${lockedUntil}`, api.put("/api/admin/period-lock", { lockedUntil }));

export { boot, must };
