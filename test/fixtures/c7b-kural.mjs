// 2.5.0 Ç7b (docs/erp/C7B-FATURA-TASARIM.md §11; kural kitabı K-01 / K-02, C-01 / C-02, KG-2, KG-3, KG-8 / F-08): Ç3'ün donmuş defter testleri için Ç7b KURAL KİMLİKLERİ.
// 2.4.9 kopyasının (lib/ledger-rule-249) maddesini güncel kuralın maddesine çevirir — yalnız kararlarla bilerek değişen satırlar; öbür her satır AYNEN. Testler "güncel türetme ↔
// 2.4.9 kopyası farkı yalnız karar numaralı kural kimliklerinde" denetimini bununla yapar (Ç5-A'nın açıklama kümesinin Ç7b eki). Ana hesap DEĞİŞMEYEN farklar (yalnız alt hesap) ile
// ana hesabı değişenler ayrı listelenir (C7B_IDS). KG-24 (ihracat 601) kalem bilgisi ister — madde tek başına çevrilemez: o sınıf burada YOK (Ç7b'nin kendi testleri sayar).
// B-6 (BAŞ MİMAR KARARI 19.11 04:35): KDV mahsubu bu güncellemeden ÖNCE yazılmış ayın iade KDV'si ESKİ yönde kalır — `oldVatMonths` (YYYY-AA kümesi) verilirse o aylardaki iade
// faturası çevrilmez.
const SUB = Object.freeze({
  "Kasa:in": ["649", "649.90"],
  "Kasa:out": ["770", "770.90"],
  "Cari (borç yaz)": ["602", "602.90"],
  "Cari (alacak yaz)": ["770", "770.90"],
});
/** Kural kimliği → kısa açıklama (rapor / ileti için). */
export const C7B_IDS = Object.freeze({
  "K-01": "carisiz Kasa girişi 649 → 649.90",
  "K-02": "carisiz Kasa çıkışı 770 → 770.90",
  "C-01": "Borç Yaz 602 → 602.90 (KG-4)",
  "C-02": "Alacak Yaz 770 → 770.90 (KG-4)",
  "KG-2": "belgesiz satış 600 → 600.90, iade 610 → 610.90, taksit Yeni Borç 602 → 600.90",
  "KG-3": "kayıt tahsilatı 602 → 336.90",
  "KG-8": "satıştan iade KDV'si 391 → 191",
  "F-08": "alıştan iade KDV'si 191 → 391",
});
const with_ = (line, account, sub) => {
  const out = { ...line, account };
  if (sub) out.sub = sub;
  else delete out.sub;
  return out;
};
/** Bir 2.4.9 maddesinin Ç7b kural kimliği ("" = değişmez). */
export function c7bRuleOf(entry) {
  const id = String(entry.id || "");
  const source = String(entry.source || "");
  if (id.startsWith("payment:")) return "KG-3";
  if (id.startsWith("cash:") && source === "Kasa") return entry.lines.some(line => line.account === "649") ? "K-01" : "K-02";
  if (source === "Cari (borç yaz)" && entry.lines.some(line => line.account === "602")) return "C-01";
  if (source === "Cari (alacak yaz)" && entry.lines.some(line => line.account === "770")) return "C-02";
  if (["Stok (veresiye satış)", "Stok (satış iadesi)", "Stok (peşin satış)", "Stok (peşin satış iadesi)"].includes(source)) return "KG-2";
  if (id.startsWith("plan:") && source === "Taksit kartı" && entry.lines.some(line => line.account === "602")) return "KG-2";
  if (source === "Satıştan iade faturası") return "KG-8";
  if (source === "Alıştan iade faturası") return "F-08";
  return "";
}
/** 2.4.9 kopyasının maddesi → Ç7b güncel kuralının maddesi (yeni nesne; girdi değişmez). */
export function c7bOf(entry, { oldVatMonths = null } = {}) {
  const rule = c7bRuleOf(entry);
  if (!rule) return entry;
  const source = String(entry.source || "");
  const month = String(entry.date || "").slice(0, 7);
  const lines = entry.lines.map(line => {
    if (rule === "KG-3" && line.account === "602") {
      const out = with_(line, "336", "336.90");
      delete out.party;
      return out;
    }
    if (rule === "K-01" && line.account === "649") return with_(line, ...SUB["Kasa:in"]);
    if (rule === "K-02" && line.account === "770") return with_(line, ...SUB["Kasa:out"]);
    if ((rule === "C-01" && line.account === "602") || (rule === "C-02" && line.account === "770")) return with_(line, ...SUB[source]);
    if (rule === "KG-2" && line.account === "600") return with_(line, "600", "600.90");
    if (rule === "KG-2" && line.account === "610") return with_(line, "610", "610.90");
    if (rule === "KG-2" && line.account === "602") return with_(line, "600", "600.90");
    if (oldVatMonths?.has?.(month)) return line;
    if (rule === "KG-8" && line.account === "391") return with_(line, "191", line.sub);
    if (rule === "F-08" && line.account === "191") return with_(line, "391", line.sub);
    return line;
  });
  return { ...entry, lines };
}
/** Madde listesinin hepsi (2.4.9 kopyası → güncel kural). */
export const c7bAll = (entries, options) => entries.map(entry => c7bOf(entry, options));
/**
 * Kural Farkı Düzeltme Fişi'nin Ç7b payı (elle; kural metninden): donmuş (2.4.9) maddelerin c7bOf farkı — fişin yılının 6 / 7 sınıfı farkı ve 1–5 sınıfı aynı hesapta; önceki yılın 6 / 7
 * sınıfı farkı (yıl, hesap, alt hesap) net yönüyle 681 (borç) / 671 (alacak) (EK-1 M7); alt defter hesabına (336 / 191 / 391 — Defter Mutabakatı'nın alt defteri) dokunan maddenin BÜTÜN
 * farkı fişin DIŞINDA (B14 (a)). Dönüş: [{ account, sub, debit, credit }] (kuruş), hesap + alt hesap başına net.
 */
export function c7bCorrectionLines(entries, { year, oldVatMonths = null } = {}) {
  const net = new Map();
  const prior = new Map();
  const add = (map, key, minor) => map.set(key, (map.get(key) || 0) + minor);
  for (const entry of entries) {
    if (!c7bRuleOf(entry)) continue;
    const next = c7bOf(entry, { oldVatMonths });
    const delta = new Map();
    for (const line of next.lines) add(delta, `${line.account}|${line.sub || ""}`, line.debit - line.credit);
    for (const line of entry.lines) add(delta, `${line.account}|${line.sub || ""}`, -(line.debit - line.credit));
    const moved = [...delta].filter(([, minor]) => minor);
    if (moved.some(([key]) => ["336", "191", "391"].includes(key.split("|")[0]))) continue;
    const entryYear = Number(String(entry.date).slice(0, 4));
    for (const [key, minor] of moved) {
      if (/^[67]/.test(key) && entryYear !== year) add(prior, `${entryYear}|${key}`, minor);
      else add(net, key, minor);
    }
  }
  for (const [, minor] of prior) if (minor) add(net, minor > 0 ? "681|" : "671|", minor);
  return toLines(net);
}
const toLines = net =>
  [...net]
    .filter(([, minor]) => minor)
    .map(([key, minor]) => {
      const [account, sub] = key.split("|");
      return { account, ...(sub ? { sub } : {}), debit: minor > 0 ? minor : 0, credit: minor < 0 ? -minor : 0 };
    });
/** Fiş satırı listelerinin hesap + alt hesap başına net toplamı (kuruş). */
export function mergeLines(...lists) {
  const net = new Map();
  for (const line of lists.flat()) net.set(`${line.account}|${line.sub || ""}`, (net.get(`${line.account}|${line.sub || ""}`) || 0) + line.debit - line.credit);
  return toLines(net);
}
