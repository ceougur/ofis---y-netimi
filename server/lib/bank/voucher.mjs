// Banka Fişi kurucu ve kuralları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §3.6, §3.7, §3.11 "Hesap eşlemesi beyaz listesi").
//
// Saf işlevler (veri tabanı yok): fişin satırları kurulur, denge ve beyaz liste denetlenir, olay kopyası (fin_events'in tutar/yön alanları)
// satırlardan türetilir. Yazımı bank.post'un çekirdeği yapar (lib/bank/post.mjs openVoucher); kapı aynı kuralları SQL'den bağımsız olarak
// yeniden denetler (lib/bank/checks.mjs voucherProblems → bank:voucher).
//
// Satır rolleri ve izinli THP kodları (beyaz liste, E2.10):
//   bank → 102 · pos → 108 · card → 309 · loan → 300 · opening/closing → 500
//   expense/tax → 653, 656, 659, 770, 780 · income → 642, 646, 649 · fx_gain → 646 · fx_loss → 656 · stoppage → 193
// Hiçbir rolde 100, 101, 103, 120, 127, 191, 320, 336, 360, 391 yazılamaz: cari etkisi her zaman cari satırından, KDV faturadan gelir.
// Para rolleri (bank, pos, card, loan) hesap/POS bağı (ref) ve alt hesap (sub) taşır; bağsız 102/108 satırı Hesabı Atanmamış kovasıdır
// (102.00 / 108.00). Para dışı roller bağ ve alt hesap taşımaz (kur farkı alt hesapları .01/.02 Aşama 13'te).
import { HttpError } from "../http.mjs";
import { mulDiv } from "../minor.mjs";

export const ROLE_GL = Object.freeze({
  bank: ["102"],
  pos: ["108"],
  card: ["309"],
  loan: ["300"],
  opening: ["500"],
  closing: ["500"],
  expense: ["653", "656", "659", "770", "780"],
  tax: ["653", "656", "659", "770", "780"],
  income: ["642", "646", "649"],
  fx_gain: ["646"],
  fx_loss: ["656"],
  stoppage: ["193"],
});
export const MONEY_ROLES = Object.freeze(new Set(["bank", "pos", "card", "loan"]));
/** Para rolünün yolu (fin_events.method; moneyLines'ın yol türetmesiyle aynı). */
export const ROLE_METHOD = Object.freeze({ bank: "bank", pos: "card", card: "card", loan: "loan" });
/** Hesabı atanmamış para rollerinin alt hesabı. */
export const UNASSIGNED_SUB = Object.freeze({ bank: "102.00", pos: "108.00" });
/** Hiçbir Banka Fişi satırının yazamadığı hesaplar (§3.11). */
export const FORBIDDEN_GL = Object.freeze(new Set(["100", "101", "103", "120", "127", "191", "320", "336", "360", "391"]));

const forbidden = (message, extra = {}) => new HttpError(400, message, { code: "bank-gl-forbidden", ...extra });

/** Satırların kuralları: rol tanınır, THP kodu beyaz listede, tutar artı tamsayı, taraf D/C, borç = alacak. Hata: 400. */
export function assertLines(lines) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const allowed = ROLE_GL[line.role];
    if (!allowed) throw forbidden(`Banka fişinde tanınmayan satır rolü (${line.role}).`);
    if (FORBIDDEN_GL.has(String(line.gl)) || !allowed.includes(String(line.gl))) throw forbidden(`${line.gl} hesabı bu satıra (${line.role}) yazılamaz. İzinli: ${allowed.join(", ")}.`, { gl: String(line.gl), role: line.role });
    if (!Number.isSafeInteger(line.tryMinor) || line.tryMinor <= 0) throw new HttpError(400, "Banka fişi satırının tutarı sıfırdan büyük olmalı.", { code: "amount-range" });
    if (line.side !== "D" && line.side !== "C") throw new HttpError(400, "Banka fişi satırının tarafı borç ya da alacak olmalı.", { code: "bank-voucher" });
    if (line.side === "D") debit += line.tryMinor;
    else credit += line.tryMinor;
  }
  if (debit !== credit) throw new HttpError(400, "Banka fişi dengede değil (borç ≠ alacak).", { code: "bank-voucher", debit, credit });
  return true;
}

/**
 * Olay kopyası (fin_events.direction, amount_minor, try_minor, currency, method) satırlardan: hesabın (bankRef) para satırlarının neti.
 * Hesap bağı yoksa (Devir Kapanışı gibi) tutar borç toplamıdır, yön boş.
 */
export function voucherCopy(lines, bankRef = "") {
  const money = bankRef ? lines.filter(line => MONEY_ROLES.has(line.role) && String(line.ref || "") === bankRef) : [];
  if (!money.length) {
    const total = lines.reduce((sum, line) => sum + (line.side === "D" ? line.tryMinor : 0), 0);
    return { direction: "", amountMinor: total, tryMinor: total, currency: "TRY", method: "" };
  }
  const sign = line => (line.side === "D" ? 1 : -1);
  const netTry = money.reduce((sum, line) => sum + sign(line) * line.tryMinor, 0);
  const netFx = money.reduce((sum, line) => sum + sign(line) * (line.fxMinor ?? line.tryMinor), 0);
  return { direction: netTry >= 0 ? "in" : "out", amountMinor: Math.abs(netFx), tryMinor: Math.abs(netTry), currency: money[0].currency || "TRY", method: ROLE_METHOD[money[0].role] || "" };
}

/** Hesabın para rolü: 102 ailesi → bank, kurumsal kart → card, kredi → loan. */
export const roleOfAccount = account => (account.kind === "card" ? "card" : account.kind === "loan" ? "loan" : "bank");

/**
 * Açılış fişi (§3.7/1): B 102.k / A 500 (KMH'de eksi açılış ters); kart borcu B 500 / A 309.k; kredi B 500 / A 300.k. amount: hesabın para
 * biriminde (kuruş/sent; vadesizde eksi olabilir), tryMinor: TL karşılığı (TL hesapta aynı), rateE6/rateSource: döviz hesabında kur.
 * Sıfır açılış satırsızdır.
 */
export function openingLines(account, { amount, tryMinor = amount, rateE6 = 1_000_000, rateSource = "" }) {
  if (!amount) return [];
  const role = roleOfAccount(account);
  // Varlık hesabında (102) artı açılış borç; borç hesabında (309/300) artı açılış (borç tutarı) alacak.
  const intoAccount = role === "bank" ? amount > 0 : false;
  const money = { role, gl: account.gl, sub: account.glSub, ref: account.id, side: intoAccount ? "D" : "C", tryMinor: Math.abs(tryMinor), currency: account.currency, fxMinor: Math.abs(amount), rateE6, rateSource };
  const equity = { role: "opening", gl: "500", side: intoAccount ? "C" : "D", tryMinor: Math.abs(tryMinor), currency: "TRY", fxMinor: Math.abs(tryMinor) };
  return intoAccount ? [money, equity] : [equity, money];
}

/** Devir Kapanışı (§10.3): Hesabı Atanmamış 102.00 / 108.00'ın açılış gününden önceki bakiyesi 500'e kapanır. bank/card: kuruş (işaretli). */
export function carryLines({ bank = 0, card = 0 }) {
  const out = [];
  for (const [role, amount] of [["bank", bank], ["pos", card]]) {
    if (!amount) continue;
    const gl = ROLE_GL[role][0];
    const money = { role, gl, sub: UNASSIGNED_SUB[role], ref: "", side: amount > 0 ? "C" : "D", tryMinor: Math.abs(amount), currency: "TRY", fxMinor: Math.abs(amount) };
    const equity = { role: "closing", gl: "500", side: amount > 0 ? "D" : "C", tryMinor: Math.abs(amount), currency: "TRY", fxMinor: Math.abs(amount) };
    out.push(equity, money);
  }
  return out;
}

/**
 * Hesabı atanmamış POS/kart bakiyesinin aktarımı (§10.3): "Bankaya Geçmiş Say" B 102.k / A 108.00 ya da "Kart Borcuna Aktar" B 108.00 / A 309.k.
 */
export function reclassLines(mode, account, amount) {
  const pos = { role: "pos", gl: "108", sub: UNASSIGNED_SUB.pos, ref: "", currency: "TRY", tryMinor: amount, fxMinor: amount };
  const target = { role: roleOfAccount(account), gl: account.gl, sub: account.glSub, ref: account.id, currency: "TRY", tryMinor: amount, fxMinor: amount };
  return mode === "card" ? [{ ...pos, side: "D" }, { ...target, side: "C" }] : [{ ...target, side: "D" }, { ...pos, side: "C" }];
}

// ---------- Aşama 4: Banka Fişi kurucuları (§3.7 #12, #14–18; K2) ----------
// Hepsi saf: satırları kuruş tamsayısıyla kurar; denge ve beyaz liste assertLines'tadır (çağıran ayrıca denetler, kapı bank:voucher yeniden).
// account/bank/card/loan: { id, kind, gl, glSub, currency } (hesap kartı). Para satırı hesabın alt hesabını ve bağını (ref) taşır.
const moneyLine = (account, side, tryMinor) => ({ role: roleOfAccount(account), gl: account.gl, sub: account.glSub, ref: account.id, side, tryMinor, currency: "TRY", fxMinor: tryMinor });
const plainLine = (role, gl, side, tryMinor, memo = "") => ({ role, gl: String(gl), side, tryMinor, currency: "TRY", fxMinor: tryMinor, ...(memo ? { memo } : {}) });

/**
 * Banka masrafı (BSMV ya da vergisiz; KDV'li masraf faturayla yazılır, bu kurucuya gelmez). Hesabı masraf türü belirler (gl: 770 / 653),
 * vergi kipi yalnız vergi satırını değiştirir (Ek A.1/24). tax: bsmv_incl (girilen tutar BSMV dahil: matrah = tutar / (1 + oran)),
 * bsmv_excl (girilen tutar matrah: BSMV = matrah × oran), none. ratePpm: BSMV oranı (varsayılan %5 = 50.000 ppm).
 * Dönüş: { lines, base, tax, total } (kuruş).
 */
export function feeLines({ account, amountMinor, tax = "bsmv_incl", ratePpm = 50_000, gl = "770", feeName = "" }) {
  const { base, taxMinor, total } = feeSplit({ amountMinor, tax, ratePpm });
  const lines = [plainLine("expense", gl, "D", base, feeName)];
  if (taxMinor > 0) lines.push(plainLine("tax", gl, "D", taxMinor, bsmvMemo(ratePpm)));
  lines.push(moneyLine(account, "C", total));
  return { lines, base, tax: taxMinor, total };
}
const bsmvMemo = ratePpm => `BSMV %${String(ratePpm / 10_000).replace(".", ",")}`;
/**
 * Masraf tutarının matrah ve BSMV'si (kuruş): bsmv_incl → matrah = tutar / (1 + oran), BSMV = tutar − matrah; bsmv_excl → BSMV = tutar × oran;
 * none → BSMV 0. Masraf fişi ve transfer ücreti aynı kuralı kullanır.
 */
export function feeSplit({ amountMinor, tax = "bsmv_incl", ratePpm = 50_000 }) {
  let base = amountMinor;
  let taxMinor = 0;
  if (tax === "bsmv_incl") {
    base = mulDivRound(amountMinor, 1_000_000, 1_000_000 + ratePpm);
    taxMinor = amountMinor - base;
  } else if (tax === "bsmv_excl") {
    taxMinor = mulDivRound(amountMinor, ratePpm, 1_000_000);
  }
  return { base, taxMinor, total: base + taxMinor };
}
/**
 * Bankalar arası transfer (§3.7 #11): B 102.alıcı tutar · (ücret varsa) B 770 matrah · B 770 BSMV (rol tax) / A 102.gönderen tutar + ücret.
 * Ücretsiz: B 102.02 20.000 / A 102.01 20.000. Ücretli (EFT 5,00 + BSMV 0,25): B 102.02 20.000 · B 770 5,00 · B 770 0,25 / A 102.01 20.005,25.
 * Tek borç ve tek alacak para satırı (kapı bank:transfer); iki hesap aynı para biriminde (TL). fee: { base, tax, gl, name, ratePpm } | null.
 */
export function transferLines({ from, to, amountMinor, fee = null }) {
  const lines = [moneyLine(to, "D", amountMinor)];
  const feeTotal = fee ? fee.base + fee.tax : 0;
  if (fee?.base > 0) lines.push(plainLine("expense", fee.gl, "D", fee.base, fee.name));
  if (fee?.tax > 0) lines.push(plainLine("tax", fee.gl, "D", fee.tax, bsmvMemo(fee.ratePpm)));
  lines.push(moneyLine(from, "C", amountMinor + feeTotal));
  return lines;
}
// round(a × b / c), artı tamsayılar: çarpım BigInt'te (1e12 TL × 1e6 güvenli tamsayıyı aşar), yarım birim yukarı (sıfırdan uzağa).
function mulDivRound(a, b, c) {
  return mulDiv(a, b, c);
}

/** Faiz geliri (§3.7 #14): B 102.k net · B 193 stopaj / A 642 brüt. Stopaj tutarı çağırandan (oran kullanıcıdan; koda gömülmez). */
export function interestInLines({ account, grossMinor, stoppageMinor = 0, gl = "642" }) {
  const lines = [moneyLine(account, "D", grossMinor - stoppageMinor)];
  if (stoppageMinor > 0) lines.push(plainLine("stoppage", "193", "D", stoppageMinor));
  lines.push(plainLine("income", gl, "C", grossMinor));
  return lines;
}
/** Faiz / KMH gideri (§3.7 #15): B 780 faiz · B 780 BSMV/KKDF (rol tax) / A 102.k. */
export function interestOutLines({ account, amountMinor, taxMinor = 0, gl = "780" }) {
  const lines = [plainLine("expense", gl, "D", amountMinor)];
  if (taxMinor > 0) lines.push(plainLine("tax", gl, "D", taxMinor, "BSMV / KKDF"));
  lines.push(moneyLine(account, "C", amountMinor + taxMinor));
  return lines;
}
/** Diğer gelir / gider (§3.7 #18): giriş B 102.k / A gelir (642, 646, 649); çıkış B gider (653, 656, 659, 770, 780) / A 102.k. */
export function otherLines({ account, direction, amountMinor, gl }) {
  return direction === "in" ? [moneyLine(account, "D", amountMinor), plainLine("income", gl, "C", amountMinor)] : [plainLine("expense", gl, "D", amountMinor), moneyLine(account, "C", amountMinor)];
}
/** Kurumsal kart borcu ödemesi (§3.7 #16): B 309.k / A 102.k (iç hareket). */
export function cardPaymentLines({ bank, card, amountMinor }) {
  return [moneyLine(card, "D", amountMinor), moneyLine(bank, "C", amountMinor)];
}
/** Kredi kullanımı (§3.7 #17): B 102.k / A 300.k. */
export function loanDrawLines({ bank, loan, amountMinor }) {
  return [moneyLine(bank, "D", amountMinor), moneyLine(loan, "C", amountMinor)];
}
/** Kredi geri ödemesi (§3.7 #17): B 300.k anapara · B 780 faiz / A 102.k toplam. */
export function loanRepayLines({ bank, loan, principalMinor, interestMinor = 0, gl = "780" }) {
  const lines = [moneyLine(loan, "D", principalMinor)];
  if (interestMinor > 0) lines.push(plainLine("expense", gl, "D", interestMinor, "Kredi Faizi"));
  lines.push(moneyLine(bank, "C", principalMinor + interestMinor));
  return lines;
}
