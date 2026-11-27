// 2.5.1 D3 — devir ÖN DENETİMİ (saf; DEVIR-PLANI §5 + G4; S-2 / S-3 = A — plan.mjs DEVIR_DECISIONS). Okuyucunun ön denetim olgularından (plan-reader.mjs preflightFacts) ve
// devir planının kendi sorunlarından (plan.sorunlar — kapanış = açılış tutmuyorsa) DURDURUR / UYARIR listesi üretir. Her madde kullanıcının anlayacağı Türkçe cümle + gidilecek yer.
// Sihirbazın 2. adımı (D5) bu listeyi gösterir; DURDURUR varsa İleri pasif, nedeni görünür yazı (kalıcı ürün kararı). D4 başlamadan önce kopyada yeniden koşar.
import { DEVIR_DECISIONS } from "./plan.mjs";

const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tl = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100)} TL`;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthText = ym => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Gidilecek yerler (D5 ekran yönlendirmesi bu anahtarlardan; ad yazım düzenine uygun). */
export const PREFLIGHT_TARGETS = Object.freeze({
  gonderilecekler: { ekran: "Faturalar › Gönderilecekler", hedef: "invoices:waiting" },
  faturalar: { ekran: "Faturalar", hedef: "invoices" },
  gelenKutusu: { ekran: "Faturalar › Gelen e-Faturalar", hedef: "invoices:inbox" },
  bankaIsleri: { ekran: "Banka › Bekleyen İşler", hedef: "bank:jobs" },
  defterMutabakati: { ekran: "Raporlar › Ana Defter › Defter Mutabakatı", hedef: "ledger:reconcile" },
  acilisOlabilir: { ekran: "Yönetim › Sistem › Açılış Olabilir Kayıtlar", hedef: "admin:opening-review" },
  kuralFarki: { ekran: "Yönetim › Sistem › Kural Farkı Düzeltme Fişi", hedef: "admin:rule-diff" },
  kdvMahsup: { ekran: "Vergi › KDV Mahsup Fişi", hedef: "tax:vat-offset" },
  donemKilidi: { ekran: "Yönetim › Sistem › Dönem Kilidi", hedef: "admin:period-lock" },
  taksitler: { ekran: "Taksitler", hedef: "plans" },
  stok: { ekran: "Stok", hedef: "stock" },
  kasa: { ekran: "Kasa", hedef: "cash" },
  devirRaporu: { ekran: "Devir Raporu", hedef: "devir:report" },
});

/** Plan sorununun cümlesi (plan.mjs sorunlar[].kod). */
function problemText(problem) {
  switch (problem.kod) {
    case "yil-kapanmis":
      return `${problem.yil} yılı için Kapanış Fişi zaten var; bu yıl yeniden devredilemez.`;
    case "donem-sonucu-farki":
      return `${problem.yil} dönem sonucu Ana Defter'le tutmuyor (beklenen ${tl(problem.beklenenMinor)}, kapanış ${tl(problem.bulunanMinor)}). Plan dışı sonuç hesabı olabilir.`;
    case "onceki-yil-dengesiz":
      return `${problem.yil} yılının Önceki Yıl Sonucu Fişi dengede değil (fark ${tl(problem.farkMinor)}). Plan dışı sonuç hesabı olabilir.`;
    case "sonuc-hesabi-kaldi":
      return `Kapanıştan sonra sonuç hesaplarında bakiye kalıyor: ${problem.hesaplar.map(row => `${row.hesap} ${tl(row.minor)}`).join(", ")}.`;
    case "yedi-sinifi-kaldi":
      return `${problem.hesap}${problem.alt ? ` (${problem.alt})` : ""} hesabı 7/A yansıtmasıyla kapanmıyor (${tl(problem.minor)}).`;
    case "modul-farki":
      return `${problem.hesap}${problem.alt ? ` (${problem.alt})` : ""} hesabının Ana Defter bakiyesi (${tl(problem.beklenenMinor)}) modülün açılışıyla (${tl(problem.bulunanMinor)}) karşılanmıyor.`;
    case "cari-satir-farki":
      return `Bir carinin devir satırları K bakiyesini vermiyor (beklenen ${tl(problem.beklenenMinor)}, satırlar ${tl(problem.bulunanMinor)}).`;
    case "supheli-farki":
      return `Şüpheli alacak (${problem.hesap}) bakiyesi şüpheli kayıtlarıyla tutmuyor (Ana Defter ${tl(problem.beklenenMinor)}, kayıtlar ${tl(problem.bulunanMinor)}).`;
    case "siniflandirilmamis-tablo":
      return `Veri dosyasındaki “${problem.tablo}” tablosunun devirde ne olacağı tanımlı değil; program güncellemesi gerekir.`;
    case "degismez":
      return `Devir denetimi tutmadı: ${problem.ad} (beklenen ${tl(problem.beklenenMinor)}, bulunan ${tl(problem.bulunanMinor)}).`;
    default:
      return `Devir hesabında beklenmeyen durum (${problem.kod}).`;
  }
}

/**
 * Ön denetim. facts: readDevirFacts().preflight; plan: buildDevirPlan() çıktısı; context: { isRoot (001), today, readProblems }. decisions: test içindir (varsayılan DEVIR_DECISIONS).
 * Dönüş: { durdurur: [madde], uyarir: [madde], gecebilir: boolean } — madde: { kod, seviye, baslik, metin, adet?, git? }.
 */
export function devirPreflight(facts = {}, plan = null, { isRoot = false, today = "", readProblems = [], decisions = DEVIR_DECISIONS } = {}) {
  const stop = [];
  const warn = [];
  const item = (list, seviye, kod, baslik, metin, extra = {}) => list.push({ kod, seviye, baslik, metin, ...extra });
  const K = plan?.meta?.K || "";
  const Kt = dayText(K);
  const block = (kod, baslik, metin, extra) => item(stop, "durdurur", kod, baslik, metin, extra);
  const notice = (kod, baslik, metin, extra) => item(warn, "uyarir", kod, baslik, metin, extra);
  const count = value => Number(value?.adet) || 0;
  // ---- DURDURUR (§5 + G4) ----
  if (count(facts.eBelgeBekleyen)) block("e-belge-bekleyen", "Gönderilecek e-Belge", `${Kt} ve öncesi tarihli ${count(facts.eBelgeBekleyen)} belge Gönderilecekler'de bekliyor. Devirden önce gönderin.`, { adet: count(facts.eBelgeBekleyen), git: PREFLIGHT_TARGETS.gonderilecekler, ornek: facts.eBelgeBekleyen.ornek });
  if (count(facts.eBelgeListedenSilinen)) block("e-belge-listeden-silinen", "Listeden Silinen e-Belge", `${Kt} ve öncesi tarihli ${count(facts.eBelgeListedenSilinen)} belge Listeden Sil ile gönderilmeyecek olarak bırakılmış. Yeni yılda gönderilirse numara çakışabilir; devirden önce gönderin ya da iptal edin.`, { adet: count(facts.eBelgeListedenSilinen), git: PREFLIGHT_TARGETS.gonderilecekler, ornek: facts.eBelgeListedenSilinen.ornek });
  if (count(facts.eBelgeBelirsiz)) block("e-belge-belirsiz", "Sonucu Belirsiz e-Belge Gönderimi", `${count(facts.eBelgeBelirsiz)} belgenin gönderim sonucu henüz belli değil (İşleniyor). Sonucunu sorgulayın.`, { adet: count(facts.eBelgeBelirsiz), git: PREFLIGHT_TARGETS.faturalar, ornek: facts.eBelgeBelirsiz.ornek });
  if (count(facts.taslakFatura)) block("taslak-fatura", "Taslak Fatura", `${Kt} ve öncesi tarihli ${count(facts.taslakFatura)} taslak fatura var. Kaydedin ya da silin.`, { adet: count(facts.taslakFatura), git: PREFLIGHT_TARGETS.faturalar, ornek: facts.taslakFatura.ornek });
  if (count(facts.bankaIsi)) block("banka-isi", "Bekleyen Banka İşi", `${count(facts.bankaIsi)} banka / POS işi bekliyor (ör. ay sonu komisyon faturası). Tamamlayın ya da iptal edin.`, { adet: count(facts.bankaIsi), git: PREFLIGHT_TARGETS.bankaIsleri });
  if (facts.defterMutabakati && facts.defterMutabakati.ok === false) {
    const parts = (facts.defterMutabakati.farklar || []).map(row => `${row.hesap}: fark ${tl(Math.round(Number(row.fark) * 100))}`).join(", ");
    block("defter-mutabakati", "Defter Mutabakatı", `Ana Defter alt defterlerle tutmuyor${facts.defterMutabakati.dengeli === false ? " (defter dengesiz)" : ""}${parts ? `: ${parts}` : ""}. Önce farkı giderin.`, { git: PREFLIGHT_TARGETS.defterMutabakati });
  }
  // S-2 (KG-16): "Açılış Olabilir" onay bekleyen kayıt.
  if (count(facts.acilisOlabilir)) {
    const metin = `${Kt} ve öncesi tarihli ${count(facts.acilisOlabilir)} kayıt "Açılış Olabilir" listesinde onay bekliyor. Devirden sonra yalnız Devri Yenile ile değiştirilebilir; önce onaylayın ya da reddedin.`;
    if (decisions.S2 === "A") block("acilis-olabilir", "Açılış Olabilir Kayıtları Onaylayın", metin, { adet: count(facts.acilisOlabilir), git: PREFLIGHT_TARGETS.acilisOlabilir });
    else if (decisions.S2 === "B") notice("acilis-olabilir", "Açılış Olabilir Kayıtları", metin, { adet: count(facts.acilisOlabilir), git: PREFLIGHT_TARGETS.acilisOlabilir });
  }
  // S-3 (KG-15): düzeltilmemiş Kural Değişikliği Farkı.
  const rule = facts.kuralFarki || {};
  if (rule.dondurmaSuruyor) block("dondurma-suruyor", "Dönem Kilidi Dondurması Sürüyor", "Kilitli dönemin defteri dondurulurken devir başlatılamaz; dondurma bitince yeniden deneyin.", { git: PREFLIGHT_TARGETS.donemKilidi });
  if ((Number(rule.satir) || 0) + (Number(rule.altDefter) || 0) > 0) {
    const metin = `Kilitli dönemde düzeltilmemiş Kural Değişikliği Farkı var${rule.tutarMinor ? ` (${tl(rule.tutarMinor)})` : ""}. Önce Kural Farkı Düzeltme Fişi'ni yazın${rule.altDefter ? "; alt defter hesabındaki fark için Kilidi Aç → Yeniden Kilitle" : ""}.`;
    if (decisions.S3 === "A") block("kural-farki", "Kural Farkı Düzeltme Fişi'ni Yazın", metin, { git: PREFLIGHT_TARGETS.kuralFarki });
    else if (decisions.S3 === "B") notice("kural-farki", "Kural Değişikliği Farkı", metin, { git: PREFLIGHT_TARGETS.kuralFarki });
  }
  // Planın kendi sorunları (kapanış = açılış tutmuyor, sınıflandırılmamış tablo) ve değişmezleri.
  for (const problem of [...readProblems, ...(plan?.sorunlar || [])]) block(`plan-${problem.kod}`, "Devir Hesabı Tutmuyor", problemText(problem), { git: PREFLIGHT_TARGETS.devirRaporu, ayrinti: problem });
  for (const invariant of plan?.degismezler || []) if (!invariant.ok) block(`degismez-${invariant.kod}`, "Devir Hesabı Tutmuyor", problemText({ kod: "degismez", ...invariant }), { git: PREFLIGHT_TARGETS.devirRaporu, ayrinti: invariant });
  // ---- UYARIR (§5 + G4) ----
  const offset = facts.aralikMahsubu;
  if (offset && !offset.yapildi) {
    // B-11 (BAŞ MİMAR önerisi): Ocak başındaki devirlerin çoğu buna düşer — belirgin uyarı + bağlantı.
    notice("aralik-mahsubu", "Önce Aralık Mahsubunu Yapın", `${monthText(offset.ay)} KDV Mahsup Fişi yapılmamış. Devirden sonra yalnız Devri Yenile ile yapılabilir; ${monthText(offset.ay)} indirilecek ve hesaplanan KDV'si yeni yılın hiçbir mahsubuna girmez.`, { git: PREFLIGHT_TARGETS.kdvMahsup, belirgin: true });
  }
  if (count(facts.iceAktarma)) notice("ice-aktarma", "İçe Aktarmaların Geri Alınması Kapanacak", `${Kt} ve öncesinde yapılmış ${count(facts.iceAktarma)} içe aktarmanın Geri Al'ı devirden sonra kullanılamaz.`, { adet: count(facts.iceAktarma), git: PREFLIGHT_TARGETS.taksitler });
  const repeats = plan?.newYear?.sablonlar || [];
  if (repeats.length) notice("tekrarlayan-sablon", "Tekrarlayan Fatura Şablonu Taşınacak", `${repeats.length} etkin tekrarlayan faturanın ${Kt} ve öncesi tarihli şablonu yeni yıla taslak olarak taşınacak.`, { adet: repeats.length, git: PREFLIGHT_TARGETS.faturalar });
  if (count(facts.gelenKutusu)) notice("gelen-kutusu", "Alınmamış Gelen e-Fatura", `Gelen e-Faturalar'da ${Kt} ve öncesi tarihli ${count(facts.gelenKutusu)} belge alınmamış. Aralık faturaları devirden önce alınmalı; sonra yalnız Devri Yenile ile girilebilir.`, { adet: count(facts.gelenKutusu), git: PREFLIGHT_TARGETS.gelenKutusu });
  if (count(facts.iptalSuresi)) notice("iptal-suresi", "İptal Süresi Dolmamış e-Belge", `${Kt} ve öncesi tarihli ${count(facts.iptalSuresi)} e-Arşiv / e-SMM belgesinin iptal süresi dolmadı. Arşivde iptal yapılamaz; iptal edilecekse devirden önce iptal edin.`, { adet: count(facts.iptalSuresi), git: PREFLIGHT_TARGETS.faturalar });
  const negativeStock = plan?.sayilar?.stok?.eksi || 0;
  if (negativeStock) notice("eksi-stok", "Eksi Stokla Devreden Ürünler", `${negativeStock} ürün eksi miktarla devredecek (değeri 0). Ayrıntı Devir Raporu'nda.`, { adet: negativeStock, git: PREFLIGHT_TARGETS.stok });
  const cash = plan?.newYear?.kasa?.minor || 0;
  if (cash < 0) notice("eksi-kasa", "Eksi Kasa", `Kasa ${Kt} itibarıyla eksi bakiyede (${tl(cash)}).`, { git: PREFLIGHT_TARGETS.kasa });
  if (isRoot) notice("yeniden-baslatma", "Program Yeniden Başlatılacak", "İlk şirketin (001) devri programın yeniden başlatılmasını gerektirir; devir sırasında öbür kullanıcıların bağlantısı kesilir.", {});
  if (today && K) {
    const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${K}T00:00:00Z`)) / 86_400_000);
    if (gap < 60) notice("erken-devir", "Aralık Belgeleri Tamamlandı mı?", `Son işlem tarihinin üzerinden ${gap} gün geçti. Aralık faturaları geldi mi, Aralık beyannamesi verildi mi? Geç gelen belge devirden sonra yalnız Devri Yenile ile girilebilir.`, {});
  }
  return { durdurur: stop, uyarir: warn, gecebilir: stop.length === 0 };
}
