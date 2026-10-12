// POS hesapları — saf işlevler (v2.2.0; docs/BANKA-MODULU-PLAN.md §4.2, §4.3, §4.4, §4.6). Veri tabanı ve saat yok; tutarlar kuruş
// tamsayısı (BigInt ile çarpılır/bölünür, yarım birim sıfırdan uzağa; lib/minor.mjs). Takvim (iş günü servisi) dışarıdan verilir.
//
// Komisyon (§4.3): kom = round(brüt × oran_ppm / 10^6) + sabit ücret. Vergi kipine göre kesinti:
//   bsmv_incl (Banka; varsayılan)   kesinti = kom; BSMV bilgi için kom − round(kom / 1,05)          10.000 @ %2,5 → 250 (BSMV 11,90) → net 9.750
//   bsmv_excl                       kesinti = kom + round(kom × %5)                                 → 262,50 → 9.737,50
//   vat_excl (Ödeme Kuruluşu; vars.) kesinti = kom + round(kom × %20)                               → 300 → 9.700
//   vat_incl                        kesinti = kom; matrah round(kom / 1,2), KDV = kom − matrah       → 250 (208,33 + 41,67) → 9.750
//   none                            kesinti = kom                                                   → 250 → 9.750
// BSMV ve vergisiz kipte kesinti Komisyon Giderleri'ne (653) gider (gün fişinde); KDV kipinde sağlayıcı carisine kesinti satırı olur (§4.3/1).
//
// Valör takvimi (§4.2): tek çekim ya da "Tek Seferde" ödenen taksitli satış tek kalem (valör = POS'un valör kuralı ve günü; oran satırında gün
// varsa o); "Taksit Taksit (Her Ay)" her taksit bir kalem, i. kalem satıştan i ay sonra (ay sonu güvenli; tatile düşerse sonraki iş günü);
// "İlki Valör Gününde" ilk kalem valör gününde, sonrakiler satıştan (i−1) ay sonra. Blokeli POS'ta valör en erken satış + bloke günü (takvim
// günü, tatilde sonraki iş günü) ve kalem "blocked". Brüt, kesinti ve vergi kalemlere ağırlıkla bölünür; kuruş artığı son kaleme.
//
// İade (§4.6): iade tutarı önce bekleyen satış kalemlerinden SONDAN BAŞA düşülür — iade, düştüğü kalemin valör gününe kendi "refund" kalemiyle
// yazılır (o günün gün fişinde B 108 iade / A 108 satış netleşir); bekleyen kalem kalmazsa artan tutar iadenin kendi valörüne yazılır (o gün
// B 108.T / A 102.x). Komisyon iadesi POS'un "İadede Komisyon" kuralıyla: İade Edilmez (0), Oransal (kesintinin oran kısmı + vergisi, iade /
// brüt oranında), Tam (sabit ücret dahil bütün kesinti, iade / brüt oranında); birikimli hesaplanır (iadeler toplamı kuruş kaçırmaz) ve iade
// kalemlerine brütleriyle ağırlıklı bölünür.
//
// Gün fişi (§4.4/1): (POS, valör günü, bağlı hesap) başına net TEK fiş. G = Σ satış brütü − Σ iade brütü (108'den çıkan), E = BSMV/vergisiz
// kesinti − iade edilen kesinti (653), V(sağlayıcı) = KDV kipindeki kesinti − iadesi (sağlayıcı carisi). Banka = G − E − ΣV. Net eksiyse
// banka hesaptan çeker ("Komisyon Tahsili"); KDV kipinde 108'de kalmayan kesinti bağlı hesaptan tahsil edilir (§4.6 "Net eksiye düşerse").
import { PPM_SCALE, mulDiv, mulPpm, splitMinor } from "../minor.mjs";

export const TAX_CHOICES = Object.freeze({
  bsmv_incl: { taxKind: "bsmv", taxMode: "included", taxPpm: 50_000 },
  bsmv_excl: { taxKind: "bsmv", taxMode: "excluded", taxPpm: 50_000 },
  vat_incl: { taxKind: "vat", taxMode: "included", taxPpm: 200_000 },
  vat_excl: { taxKind: "vat", taxMode: "excluded", taxPpm: 200_000 },
  none: { taxKind: "none", taxMode: "included", taxPpm: 0 },
});
export const TAX_LABELS = Object.freeze({ bsmv_incl: "BSMV Dahil", bsmv_excl: "BSMV Hariç", vat_incl: "KDV Dahil (Faturalı)", vat_excl: "KDV Hariç (Faturalı)", none: "Yok" });
/** Sağlayıcı türüne göre varsayılan vergi kipi (K2): Banka → BSMV Dahil, Ödeme Kuruluşu → KDV Hariç. */
export const defaultTaxFor = providerKind => (providerKind === "payment_institution" ? "vat_excl" : "bsmv_incl");
/** Satırdaki (POS kartı ya da satış kopyası) vergi kolonlarından kip anahtarı. */
export function taxChoiceOf({ tax_kind: kind, tax_mode: mode } = {}) {
  if (kind === "none") return "none";
  if (kind === "vat") return mode === "excluded" ? "vat_excl" : "vat_incl";
  return mode === "excluded" ? "bsmv_excl" : "bsmv_incl";
}
/** KDV kipi mi (kesinti sağlayıcı carisine; 653'e değil)? */
export const isVatKind = kind => kind === "vat";

/**
 * Bir tutarın komisyonu: { commission (oran + sabit), tax (hariçte eklenen, dahilde içindeki bilgi), deduction (bankanın kestiği), net }.
 * fixedMinor yalnız satışın tamamına bir kez eklenir.
 */
export function commissionOf({ gross, ratePpm, fixedMinor = 0, taxKind = "bsmv", taxMode = "included", taxPpm = 50_000 }) {
  const rate = mulPpm(gross, ratePpm);
  const commission = rate + fixedMinor;
  let tax = 0;
  let deduction = commission;
  if (taxKind !== "none" && taxPpm > 0) {
    if (taxMode === "excluded") {
      tax = mulPpm(commission, taxPpm);
      deduction = commission + tax;
    } else tax = commission - mulDiv(commission, PPM_SCALE, PPM_SCALE + taxPpm);
  }
  return { rate, commission, tax, deduction, net: gross - deduction };
}

/** Kalemin kesintisi (bankanın kestiği): hariçte komisyon + vergi, dahilde komisyon. */
export const deductionOf = (item, taxMode) => item.commission + (taxMode === "excluded" ? item.tax : 0);

/**
 * Satışın valör takvimi (pos_items, rol "sale"). calendar: lib/business-days.mjs createCalendar.
 * @param {{ date, gross, installments, payout: 'monthly'|'single'|'first_valor', ratePpm, fixedMinor, taxKind, taxMode, taxPpm,
 *   valorRule: 'business'|'calendar'|'same_day', valorDays, rateValorDays: number|null, blockDays, calendar }} input
 * @returns {{ totals: { commission, tax, deduction, net }, items: Array<{ seq, valueDate, blocked, gross, commission, tax, deduction, plannedNet, net }> }}
 */
export function saleSchedule(input) {
  const { date, gross, installments = 1, payout = "monthly", ratePpm, fixedMinor = 0, taxKind, taxMode, taxPpm, valorRule = "business", valorDays = 1, rateValorDays = null, blockDays = 0, calendar } = input;
  const totals = commissionOf({ gross, ratePpm, fixedMinor, taxKind, taxMode, taxPpm });
  const days = Number.isInteger(rateValorDays) && rateValorDays >= 0 ? rateValorDays : valorDays;
  const valor = () => valueDateOf(calendar, date, valorRule, days);
  let dates;
  if (installments <= 1 || payout === "single") dates = [valor()];
  else if (payout === "first_valor") dates = Array.from({ length: installments }, (_, i) => (i === 0 ? valor() : calendar.adjust(calendar.addMonths(date, i), "following")));
  else dates = Array.from({ length: installments }, (_, i) => calendar.adjust(calendar.addMonths(date, i + 1), "following"));
  const blocked = blockDays > 0;
  const blockDate = blocked ? calendar.adjust(calendar.addCalendarDays(date, blockDays), "following") : "";
  if (blocked) dates = dates.map(day => (day < blockDate ? blockDate : day));
  const grossParts = splitMinor(gross, dates.length);
  const commissionParts = dates.length > 1 ? splitMinor(totals.commission, grossParts) : [totals.commission];
  const taxParts = dates.length > 1 && totals.tax ? splitMinor(totals.tax, grossParts) : dates.map((_, i) => (i === dates.length - 1 ? totals.tax : 0));
  const items = dates.map((valueDate, index) => {
    const item = { seq: index + 1, valueDate, blocked: blocked ? 1 : 0, gross: grossParts[index], commission: commissionParts[index], tax: taxParts[index] };
    item.deduction = deductionOf(item, taxMode);
    item.plannedNet = item.gross - item.deduction;
    item.net = Math.max(0, item.plannedNet);
    return item;
  });
  return { totals, items };
}

/** Valör günü (POS'un kuralı): İş Günü (n iş günü), Takvim Günü (n gün, tatilde sonraki iş günü), Aynı Gün (iş günü değilse sonraki). */
export function valueDateOf(calendar, date, rule = "business", days = 1) {
  if (rule === "same_day") return calendar.adjust(date, "following");
  if (rule === "calendar") return calendar.valueDate(date, "calendar", days);
  return calendar.valueDate(date, "business", days);
}

/**
 * İadenin kalemleri (rol "refund"). pending: asıl satışın BEKLEYEN kalemleri [{ seq, valueDate, blocked, capacity }] (capacity = kalemin
 * brütünden daha önceki iadelerle düşülmemiş kalan); refundValueDate: iadenin kendi valörü (bekleyen kalem yetmezse). Komisyon iadesi:
 * policy none | proportional | full; sale: asıl satış { gross, commission, tax, fixedMinor, taxMode }; before: asıl satışa daha önce yapılmış
 * iadelerin toplamı { gross, commission, tax } (birikimli yuvarlama).
 * @returns {{ items: Array<{ seq, valueDate, blocked, gross, commission, tax, deduction, plannedNet, net }>, commission, tax }}
 */
export function refundSchedule({ amount, pending = [], refundValueDate, policy = "none", sale, before = { gross: 0, commission: 0, tax: 0 } }) {
  let left = amount;
  const parts = [];
  for (const item of [...pending].sort((a, b) => b.seq - a.seq)) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, item.capacity));
    if (take <= 0) continue;
    parts.push({ seq: item.seq, valueDate: item.valueDate, blocked: item.blocked ? 1 : 0, gross: take });
    left -= take;
  }
  if (left > 0) parts.push({ seq: 0, valueDate: refundValueDate, blocked: 0, gross: left });
  // Komisyon iadesi (birikimli): iade sonrası toplam iade − öncesi.
  let commission = 0;
  let tax = 0;
  if (policy !== "none" && sale.gross > 0) {
    const base = policy === "full" ? sale.commission : sale.commission - (sale.fixedMinor || 0);
    const after = before.gross + amount;
    commission = mulDiv(Math.max(0, base), after, sale.gross) - mulDiv(Math.max(0, base), before.gross, sale.gross);
    const taxBase = policy === "full" || !sale.commission ? sale.tax : mulDiv(sale.tax, Math.max(0, base), sale.commission);
    tax = mulDiv(taxBase, after, sale.gross) - mulDiv(taxBase, before.gross, sale.gross);
    // İade edilen kesinti iadenin tutarını aşamaz (sabit ücret satıştan büyükse).
    const cap = amount;
    const ded = commission + (sale.taxMode === "excluded" ? tax : 0);
    if (ded > cap) {
      commission = Math.max(0, commission - (ded - cap));
      if (commission + (sale.taxMode === "excluded" ? tax : 0) > cap) tax = Math.max(0, cap - commission);
    }
  }
  const weights = parts.map(part => part.gross);
  const commissionParts = parts.length > 1 ? splitMinor(commission, weights) : [commission];
  const taxParts = parts.length > 1 ? splitMinor(tax, weights) : [tax];
  const items = parts.map((part, index) => {
    const item = { ...part, commission: commissionParts[index] || 0, tax: taxParts[index] || 0 };
    item.deduction = deductionOf(item, sale.taxMode);
    // İade kaleminin planlanan neti bankadan ÇIKIŞTIR (eksi): iade edilen brüt − iade edilen kesinti.
    item.plannedNet = -(item.gross - item.deduction);
    item.net = Math.max(0, item.gross - item.deduction);
    return item;
  });
  return { items, commission, tax };
}

/**
 * Gün grubunun (POS, valör günü, bağlı hesap) bekleyen kalemlerinden gün fişinin tutarları (kuruş, işaretli):
 *   g108: 108.T'den çıkacak (satış − iade brütü), e653: 653'e yazılacak (BSMV/vergisiz kipte kesinti − iadesi), vat: sağlayıcı → KDV kipindeki
 *   kesinti − iadesi, bank: bankaya geçecek net (= g108 − e653 − Σvat).
 * items: [{ role: 'sale'|'refund', gross, deduction, taxKind, provider }]
 */
export function dayTotals(items) {
  let g108 = 0;
  let e653 = 0;
  const vat = new Map();
  for (const item of items) {
    const sign = item.role === "refund" ? -1 : 1;
    g108 += sign * item.gross;
    if (isVatKind(item.taxKind)) vat.set(item.provider || "", (vat.get(item.provider || "") || 0) + sign * item.deduction);
    else e653 += sign * item.deduction;
  }
  const vatTotal = [...vat.values()].reduce((sum, value) => sum + value, 0);
  return { g108, e653, vat, bank: g108 - e653 - vatTotal };
}

/**
 * KDV kipindeki kesintinin satırları: 108'de yeterli tutar varsa kesinti POS'tan (kart yolu), kalmazsa kalanı bağlı hesaptan (havale yolu;
 * "Komisyon Tahsili"); eksi (iade edilen kesinti fazlası) sağlayıcıdan POS'a giriş (komisyon iadesi). Dönüş: [{ provider, fromPos, fromBank,
 * toPos }] ve 108 fiş satırının tutarı (l108, işaretli: artı = 108'den çıkış).
 */
export function vatSplit({ g108, vat }) {
  let available = Math.max(0, g108);
  const rows = [];
  let fromPosTotal = 0;
  let toPosTotal = 0;
  for (const [provider, value] of vat) {
    if (value > 0) {
      const fromPos = Math.min(value, available);
      available -= fromPos;
      fromPosTotal += fromPos;
      rows.push({ provider, fromPos, fromBank: value - fromPos, toPos: 0 });
    } else if (value < 0) {
      toPosTotal += -value;
      rows.push({ provider, fromPos: 0, fromBank: 0, toPos: -value });
    }
  }
  return { rows, l108: g108 - fromPosTotal + toPosTotal };
}
