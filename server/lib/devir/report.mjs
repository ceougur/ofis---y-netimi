// 2.5.1 D3 — DEVİR RAPORU (docs/devir/D3-D4-TASARIM.md §3.4; kitap §6). Satırlar devir planından (plan.mjs) gelir; ekran (D5), PDF ve Excel AYNI satırlardır (tek tablo —
// lib/report-files.mjs TEK ÜRETİCİ; kalıcı ürün kararı: her bölümün alt TOPLAM satırı ekranda / PDF'te / Excel'de aynı). D4 aynı işlevi iki dosyanın ÖLÇÜLMÜŞ bakiyeleriyle çağırır
// (measured): rapor = plan ↔ ölçüm; verilmezse (ön izleme) yeni yıl sütunu planın yazacağıdır.
import { CHART, OPENING_GL, PLAN_SUBS, UNASSIGNED_SUBS } from "../general-ledger.mjs";
import { BOOK_TYPES } from "../book-type.mjs";
import { DOCUMENT_SUB_NAMES } from "../cheque-gl.mjs";
import { reportPdf, reportXlsx } from "../report-files.mjs";

const money = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tl = minor => `${money.format((Number(minor) || 0) / 100)} TL`;
const count = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const subName = sub => PLAN_SUBS[sub] || UNASSIGNED_SUBS[sub] || DOCUMENT_SUB_NAMES[sub] || "";
const accountName = code => CHART[code] || code;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthText = ym => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : "");
const STATES = Object.freeze({ portfolio: "Portföyde", bank: "Tahsilde", endorsed: "Ciro Edildi", bounced: "Karşılıksız", pending: "Ödenmedi" });
const TABLE_CLASS = Object.freeze({ B: "Budanır", A: "Açık Olan Kalır", D: "Dokunulmaz" });

/** Rapor tablosunun kolonları (ekran = PDF = Excel). */
export const REPORT_HEADERS = Object.freeze(["Bölüm", "Kod", "Ad", "Arşiv (Kesim Günü)", "Yeni Yıl (Açılış Günü)", "Fark"]);
export const REPORT_TYPES = Object.freeze(["", "", "", "money", "money", "money"]);

/** Planın yazacağı açılış bakiyeleri (hesap|alt|cari → kuruş): modül açılışları + N-13 fişi (rapor = plan; D4 ölçümü verince ölçüm). */
export function plannedOpenings(plan) {
  const out = new Map();
  const add = (account, sub, party, minor) => {
    if (!minor) return;
    const key = `${account}|${sub || ""}|${party || ""}`;
    out.set(key, (out.get(key) || 0) + minor);
  };
  const ny = plan.newYear;
  add("100", "", "", ny.kasa.minor);
  for (const row of ny.banka) add(row.hesap, row.alt, "", row.minor);
  for (const row of ny.cariler) add(row.hesap, "", row.cari, row.satirlar.reduce((sum, line) => sum + (line.yon === "debt" ? line.tutarMinor : -line.tutarMinor), 0));
  for (const row of ny.supheli) {
    add("128", "", row.cari, row.kalanMinor);
    add("129", "", row.cari, -row.karsilikMinor);
  }
  for (const row of ny.kartlar) if (!row.cari) add("127", "", `plan:${row.kart}`, row.durum === "acik" ? row.kalanMinor : 0);
  for (const row of ny.evraklar) if (row.hesap) add(row.hesap, row.alt, "", row.yon === "in" ? row.minor : -row.minor);
  add("153", "", "", ny.stok.reduce((sum, row) => sum + row.degerMinor, 0));
  for (const row of ny.vergi) add(row.hesap, "", "", row.minor);
  for (const row of ny.digerAltDefter || []) add(row.hesap, row.alt, "", row.minor);
  let opening = 0;
  for (const [key, minor] of out) if (!key.startsWith(`${OPENING_GL}|`)) opening -= minor;
  for (const line of ny.acilisFisi?.lines || []) {
    if (line.account === OPENING_GL) opening += line.debit - line.credit;
    else add(line.account, line.sub, line.party, line.debit - line.credit);
  }
  add(OPENING_GL, "", "", opening);
  return out;
}

/**
 * Devir Raporu. plan: buildDevirPlan(); preflight: devirPreflight() (UYARIR listesi rapora yazılır); options: { companyLabel, partyName: (kimlik) → ad, measured: Map(hesap|alt|cari → kuruş) — D4 }.
 * Dönüş: { title, subtitle, headers, types, rows (metin), footers, summary, sections: [{ kod, ad, satirSayisi }] } — lib/report-files.mjs reportPdf / reportXlsx biçimi.
 */
export function devirReport(plan, preflight = null, { companyLabel = "", measured = null } = {}) {
  const rows = [];
  const sections = [];
  const names = new Map(plan.newYear.cariler.map(row => [row.cari, row.ad]));
  const partyLabel = party => (party.startsWith("plan:") ? "Taksit Kartı" : names.get(party) || "Cari");
  let current = null;
  const open = (kod, ad) => {
    current = { kod, ad, satirSayisi: 0 };
    sections.push(current);
  };
  const row = (kod, ad, arsiv, yeni, fark, money3 = true) => {
    rows.push([current.ad, kod, ad, money3 ? tl(arsiv) : count(arsiv), money3 ? tl(yeni) : count(yeni), money3 ? tl(fark) : count(fark)]);
    current.satirSayisi += 1;
  };
  const total = (ad, arsiv, yeni, money3 = true) => row("TOPLAM", ad, arsiv, yeni, arsiv - yeni, money3);
  const opening = measured || plannedOpenings(plan);
  // 1. Hesap hesap (kuruşu kuruşuna): arşiv K kapanışı ↔ yeni yıl K+1 açılışı; fark ≠ 0 → devir durur (değişmez kitap §6.2).
  open("hesaplar", "Hesaplar");
  const keys = new Set([...plan.archive.kapanisBakiyeleri.map(item => `${item.hesap}|${item.alt}|${item.cari}`), ...[...opening.entries()].filter(([, minor]) => minor !== 0).map(([key]) => key)]);
  const closingOf = new Map(plan.archive.kapanisBakiyeleri.map(item => [`${item.hesap}|${item.alt}|${item.cari}`, item.minor]));
  let debitA = 0;
  let creditA = 0;
  let debitN = 0;
  let creditN = 0;
  for (const key of [...keys].sort()) {
    const [account, sub, party] = key.split("|");
    const a = closingOf.get(key) || 0;
    const n = opening.get(key) || 0;
    if (a > 0) debitA += a;
    else creditA -= a;
    if (n > 0) debitN += n;
    else creditN -= n;
    row(`${account}${sub ? ` · ${sub}` : ""}`, `${accountName(account)}${sub && subName(sub) ? ` (${subName(sub)})` : ""}${party ? ` · ${partyLabel(party)}` : ""}`, a, n, a - n);
  }
  total("Borç Bakiyeli Hesaplar", debitA, debitN);
  total("Alacak Bakiyeli Hesaplar", creditA, creditN);
  total(`${OPENING_GL} ${accountName(OPENING_GL)}`, closingOf.get(`${OPENING_GL}||`) || 0, opening.get(`${OPENING_GL}||`) || 0);
  // 2. Kapanış: fişlerin dokunduğu hesaplar (kapanış öncesi ↔ sonrası); 590 / 591 = Ç6 Dönem Net Kârı; önceki yıl sonuçları.
  open("kapanis", "Kapanış");
  for (const item of plan.archive.kapanisEtkisi) row(`${item.hesap}${item.alt ? ` · ${item.alt}` : ""}`, `${accountName(item.hesap)} — Kapanış Öncesi / Sonrası`, item.onceMinor, item.sonraMinor, item.onceMinor - item.sonraMinor);
  for (const item of plan.archive.oncekiYillar) row(`Önceki Yıl ${item.yil}`, `Önceki Yıl Sonucu Fişi (${item.yil}) — ${item.tutarMinor >= 0 ? "570 Geçmiş Yıllar Kârları" : "580 Geçmiş Yıllar Zararları"}`, item.tutarMinor, item.tutarMinor, 0);
  const result = plan.archive.donemSonucuMinor ?? 0;
  const expected = plan.degismezler.find(item => item.kod === "donem-sonucu")?.beklenenMinor ?? result;
  total(`Dönem Net Kârı (Zararı) ${plan.meta.yil} — Vergi Öncesi`, expected, result);
  // 3. Modül modül (K'de iki dosyada eşit — kitap §6.4).
  open("moduller", "Modüller");
  const moduleRow = (kod, ad, minor) => row(kod, ad, minor, minor, 0);
  moduleRow("Kasa", "Kasa (Nakit)", plan.newYear.kasa.minor);
  for (const item of plan.newYear.banka) moduleRow(`${item.hesap} · ${item.alt}`, item.ad, item.minor);
  for (const item of plan.newYear.cariler) {
    if (!item.satirlar.length && !item.supheliMinor) continue;
    moduleRow(`Cari · ${item.hesap}`, `${item.ad || "Cari"} — ${count(item.acikKalemSayisi)} Açık Kalem (${tl(item.acikBorcMinor - item.acikAlacakMinor)})${item.supheliMinor ? ` · Şüpheli ${tl(item.supheliMinor)}` : ""}`, item.kBakiyeMinor);
  }
  for (const item of plan.newYear.kartlar) if (item.durum === "acik" && item.kalanMinor) moduleRow("Taksit Kartı", `Kalan ${count(item.taksitler.filter(inst => inst.kalanMinor > 0).length)} Taksit`, item.kalanMinor);
  const byState = new Map();
  for (const item of plan.newYear.evraklar) {
    const key = `${item.tur === "senet" ? "Senet" : "Çek"} · ${item.yon === "in" ? "Alınan" : "Verilen"} · ${STATES[item.durum] || item.durum}`;
    const acc = byState.get(key) || { adet: 0, minor: 0 };
    acc.adet += 1;
    acc.minor += item.minor;
    byState.set(key, acc);
  }
  for (const [key, acc] of [...byState.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) moduleRow("Çek / Senet", `${key} (${count(acc.adet)} Adet)`, acc.minor);
  for (const item of plan.newYear.stok) moduleRow(`Stok · ${item.kod || item.urun}`, `${item.ad} — ${String(item.miktar).replace(".", ",")} ${item.birim}${item.eksi ? " (Eksi Stok)" : ""}`, item.degerMinor);
  for (const item of plan.newYear.vergi) moduleRow(item.hesap, `${accountName(item.hesap)}${item.donem ? ` — ${monthText(item.donem)}` : ""}`, item.minor);
  for (const item of plan.newYear.supheli) moduleRow("Şüpheli Alacak", `${partyLabel(item.cari)} — Karşılık ${tl(item.karsilikMinor)}`, item.kalanMinor);
  for (const item of plan.newYear.digerAltDefter || []) moduleRow(`${item.hesap}${item.alt ? ` · ${item.alt}` : ""}`, item.neden === "kayit-tahsilati" ? "Kayıt Tahsilatları (Carisiz)" : `${accountName(item.hesap)} (Carisiz)`, item.minor);
  // 4. Hareket sayıları: devir öncesi = arşiv ≤K + yeni yıl >K (kitap §6.6).
  open("hareketler", "Hareketler");
  let le = 0;
  let gt = 0;
  for (const item of plan.newYear.budama) {
    if (item.sinif === "D") continue;
    row(item.table, `${TABLE_CLASS[item.sinif] || item.sinif} — Devir Öncesi ${count(item.toplam)}`, item.kOncesi, item.kSonrasi, item.toplam - item.kOncesi - item.kSonrasi, false);
    le += item.kOncesi;
    gt += item.kSonrasi;
  }
  row("TOPLAM", "Kesim Günü ve Öncesi / Sonrası", le, gt, 0, false);
  // 5. Listeler: UYARIR maddeleri, arşiv başvurusuna çevrilen bağlar, taşınan şablonlar, eksi stoklu ürünler.
  open("listeler", "Listeler");
  const textRow = (kod, ad) => {
    rows.push([current.ad, kod, ad, "", "", ""]);
    current.satirSayisi += 1;
  };
  for (const item of preflight?.uyarir || []) textRow(item.baslik, item.metin);
  for (const item of preflight?.durdurur || []) textRow(`Durdurur · ${item.baslik}`, item.metin);
  for (const link of plan.newYear.baglar) textRow(link.tur === "arsiv-basvurusu" ? "Bağı Arşiv Başvurusuna Çevrilen Ödeme" : "Bağı Açık Kaleme Yönelen Ödeme", `${link.tablo} ${link.satir} (${dayText(link.tarih)}) → ${link.tur === "arsiv-basvurusu" ? `${link.arsiv.yil} Arşivi ${link.arsiv.no} (${dayText(link.arsiv.tarih)})` : link.yeniHedef}`);
  for (const item of plan.newYear.sablonlar) textRow("Taşınan Tekrarlayan Fatura Şablonu", `${item.sablonNo || item.sablon} — sonraki ${dayText(item.sonrakiTarih)}`);
  for (const item of plan.newYear.stok.filter(stock => stock.eksi)) textRow("Eksi Stokla Devreden Ürün", `${item.ad}: ${String(item.miktar).replace(".", ",")} ${item.birim} (değer 0)`);
  textRow("Bilgi", "590 Dönem Net Kârı / 591 Dönem Net Zararı vergi öncesi dönem sonucudur; vergi karşılığı ve kâr dağıtımı mali müşavirin işidir.");
  const meta = plan.meta;
  const title = "Devir Raporu";
  const subtitle = `${dayText(meta.K)} Kesim · ${dayText(meta.acilisGunu)} Açılış · ${meta.secenekAd}${measured ? "" : " · Ön İzleme"}`;
  const summary = [
    ["Şirket", companyLabel || meta.sirket?.label || ""],
    ["Devir İçin Son İşlem Tarihi", dayText(meta.K)],
    ["Yeni Yılın Açılış Günü", dayText(meta.acilisGunu)],
    ["Cari Bakiye Tipi", meta.secenekAd],
    ["Defter Türü (Arşivin)", BOOK_TYPES[meta.defterTuru] || meta.defterTuru],
    ["Devir Çalışma Kimliği", meta.calismaKimligi],
    ["Veri Sürümü", meta.veriSurumu],
    ["Dönem Net Kârı (Zararı)", tl(result)],
    ["Not", "590 / 591 vergi öncesi dönem sonucudur."],
  ];
  return { title, subtitle, headers: [...REPORT_HEADERS], types: [...REPORT_TYPES], rows, footers: null, summary, sections };
}

/** PDF ve Excel (ekran = PDF = Excel: aynı satırlar). ctx: lib/report-files.mjs reportPdf / reportXlsx bağlamı ({ now, companyLabel, userName, header }). */
export const devirReportPdf = (data, ctx) => reportPdf(data, ctx);
export const devirReportXlsx = (data, ctx) => reportXlsx(data, ctx);
