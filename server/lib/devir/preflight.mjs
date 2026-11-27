// 2.5.1 D3 — devir ÖN DENETİMİ (saf; DEVIR-PLANI §5 + G4; S-2 / S-3 = A — plan.mjs DEVIR_DECISIONS). Okuyucunun ön denetim olgularından (plan-reader.mjs preflightFacts) ve
// devir planının kendi sorunlarından (plan.sorunlar — kapanış = açılış tutmuyorsa) DURDURUR / UYARIR listesi üretir. Sihirbazın 2. adımı (D5) bu listeyi gösterir; DURDURUR varsa
// İleri pasif, nedeni görünür yazı (kalıcı ürün kararı). D4 başlamadan önce kopyada yeniden koşar.
// D3 tur 3 (DEVİR NEDEN DURDU — kullanıcı 27.11 11:39): HER madde iletiler.mjs devirIletisi'nden geçer (dört alan: ne oldu, neden duruyor, ne yapmalı, nereye); ilk durdurmada
// kesilmez — bütün nedenler birlikte, sıra kararlı (bu dosyadaki denetim sırası); uyarılar ayrı listede. S-KD-1 / S-KD-2 (kullanıcı 27.11, öneri A) kural farkı maddelerinde.
import { CHART, PLAN_SUBS, UNASSIGNED_SUBS } from "../general-ledger.mjs";
import { DEVIR_DECISIONS } from "./plan.mjs";
import { DEVIR_TARGETS, countText, dayText, devirIletisi, listText, monthText, sideText, tlText } from "./iletiler.mjs";

/** Gidilecek yerler (D5 ekran yönlendirmesi bu anahtarlardan; ad yazım düzenine uygun) — iletiler.mjs DEVIR_TARGETS. */
export const PREFLIGHT_TARGETS = DEVIR_TARGETS;

const accountText = (code, sub = "") => `${code}${sub ? `.${sub.split(".").at(-1)}` : ""} ${CHART[code] || "Hesabı"}${sub && (PLAN_SUBS[sub] || UNASSIGNED_SUBS[sub]) ? ` (${PLAN_SUBS[sub] || UNASSIGNED_SUBS[sub]})` : ""}`;
const dayBefore = iso => {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
};
const RESTART = "Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın";
const sampleText = (rows = [], max = 3) => {
  // Belgenin numarası (yoksa "numarasız"), carisi, tarihi ve tutarı — kullanıcı belgeyi listede bulabilsin.
  const shown = rows.slice(0, max).map(row => `${row.number || "numarasız belge"} — ${[row.cari, dayText(row.date), Number.isFinite(row.tutarMinor) ? tlText(row.tutarMinor) : ""].filter(Boolean).join(", ")}`);
  return shown.length ? ` (ör. ${listText(shown)}${rows.length > max ? " …" : ""})` : "";
};
const TEST_SERIES = /^(TEF|TEA|TES)/;

/** Plan sorununun iletisi (plan.mjs sorunlar[].kod; okuyucunun sınıflandırılmamış tablosu). names: cari kimliği → ad. */
export function problemIletisi(problem, { names = new Map(), K = "" } = {}) {
  const party = id => (!id ? "" : String(id).startsWith("plan:") ? "carisiz taksit kartı" : names.get(id) || "adı okunamayan cari");
  const year = problem.yil || (K ? K.slice(0, 4) : "");
  const base = { kod: `plan-${problem.kod}`, seviye: "durdurur", nereye: DEVIR_TARGETS.devirRaporu, ayrinti: problem };
  const support = "Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin";
  const neden = "Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar";
  switch (problem.kod) {
    case "yil-kapanmis":
      return devirIletisi({ ...base, baslik: "Bu Yıl Zaten Devredilmiş", neOldu: `${year} yılı için Kapanış Fişi zaten yazılmış`, neden: "Bir yıl yalnız bir kez devredilir; ikinci devir bakiyeleri iki kez taşır", neYapmali: ["Devir İçin Son İşlem Tarihi olarak henüz devredilmemiş yılın 31 Aralık'ını seçin", "Bu yılın devrini değiştirmek istiyorsanız Devri Yenile'yi kullanın"], nereye: DEVIR_TARGETS.yilSonuDevri });
    case "donem-sonucu-farki":
      return devirIletisi({ ...base, baslik: "Dönem Sonucu Tutmuyor", neOldu: `${year} yılının dönem sonucu Gelir Tablosu'nda ${tlText(problem.beklenenMinor)}, kapanışta ${tlText(problem.bulunanMinor)} (fark ${tlText(problem.beklenenMinor - problem.bulunanMinor)})`, neden, neYapmali: ["Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun", "Hesap planında olmayan bir gelir / gider hesabına kayıt varsa kaydı düzeltin", support], nereye: DEVIR_TARGETS.defterMutabakati });
    case "onceki-yil-dengesiz":
      return devirIletisi({ ...base, baslik: "Önceki Yıl Sonucu Tutmuyor", neOldu: `${problem.yil} yılının Önceki Yıl Sonucu Fişi dengede değil (fark ${tlText(problem.farkMinor)})`, neden, neYapmali: ["Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun", support], nereye: DEVIR_TARGETS.defterMutabakati });
    case "sonuc-hesabi-kaldi":
      return devirIletisi({ ...base, baslik: "Gelir ve Gider Hesapları Kapanmıyor", neOldu: `Kapanıştan sonra gelir / gider hesaplarında bakiye kalıyor: ${listText((problem.hesaplar || []).map(row => `${accountText(row.hesap)} ${tlText(row.minor)}`))}`, neden, neYapmali: ["Defter Mutabakatı'nı açıp bu hesapların kayıtlarını denetleyin", support], nereye: DEVIR_TARGETS.defterMutabakati });
    case "yedi-sinifi-kaldi":
      return devirIletisi({ ...base, baslik: "Maliyet Hesabı Kapanmıyor", neOldu: `${accountText(problem.hesap, problem.alt)} yansıtmayla kapanmıyor (${tlText(problem.minor)})`, neden, neYapmali: ["Defter Mutabakatı'nı açıp bu hesabın kayıtlarını denetleyin", support], nereye: DEVIR_TARGETS.defterMutabakati });
    case "modul-farki":
      return devirIletisi({ ...base, baslik: "Hesap Bakiyesi Modülle Tutmuyor", neOldu: `${accountText(problem.hesap, problem.alt)}${problem.cari ? ` (${party(problem.cari)})` : ""} hesabının ${dayText(K)} bakiyesi Ana Defter'de ${tlText(problem.beklenenMinor)}, modülün açılışında ${tlText(problem.bulunanMinor)} (fark ${tlText(problem.beklenenMinor - problem.bulunanMinor)})`, neden, neYapmali: ["Defter Mutabakatı'nı açıp bu hesabın farkını giderin", "Mutabakat Testi'ni çalıştırın; kırmızı madde kalmasın", RESTART], nereye: DEVIR_TARGETS.defterMutabakati });
    case "cari-satir-farki":
      return devirIletisi({ ...base, baslik: "Cari Bakiyesi Tutmuyor", neOldu: `${party(problem.cari)} carisinin devir satırları ${dayText(K)} bakiyesini vermiyor (bakiye ${tlText(problem.beklenenMinor)}, satırların toplamı ${tlText(problem.bulunanMinor)})`, neden, neYapmali: ["Carinin ekstresini açıp kesim günü bakiyesini denetleyin", "Mutabakat Testi'ni çalıştırın", support], nereye: { ...DEVIR_TARGETS.cari, ...(problem.cari && !String(problem.cari).startsWith("plan:") ? { kayit: { tur: "cari", kimlik: problem.cari } } : {}) } });
    case "supheli-farki":
      return devirIletisi({ ...base, baslik: "Şüpheli Alacak Tutmuyor", neOldu: `${accountText(problem.hesap)}${problem.cari ? ` (${party(problem.cari)})` : ""} bakiyesi Ana Defter'de ${tlText(problem.beklenenMinor)}, şüpheli alacak kayıtlarında ${tlText(problem.bulunanMinor)}`, neden, neYapmali: ["Defter Mutabakatı'nı açıp şüpheli alacak hesabının farkını giderin", "Mutabakat Testi'ni çalıştırın", support], nereye: DEVIR_TARGETS.defterMutabakati });
    case "siniflandirilmamis-tablo":
      return devirIletisi({ ...base, baslik: "Program Güncellemesi Gerekiyor", neOldu: "Veri dosyasında devirde ne olacağı bu sürümde tanımlı olmayan bir tablo var", neden: "Tanımsız tablonun kayıtları devirde kaybolabilir ya da iki yılda birden kalabilir", neYapmali: ["Programı en son sürüme güncelleyin", support], nereye: DEVIR_TARGETS.yilSonuDevri });
    case "degismez":
      return devirIletisi({ ...base, kod: `degismez-${problem.kod2 || "denetim"}`, baslik: "Devir Denetimi Tutmuyor", neOldu: invariantText(problem), neden, neYapmali: ["Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun", "Mutabakat Testi'ni çalıştırın", support], nereye: DEVIR_TARGETS.defterMutabakati });
    default:
      return devirIletisi({ ...base, baslik: "Devir Hesabı Tutmuyor", neOldu: "Devir hesabında beklenmeyen bir tutarsızlık bulundu", neden, neYapmali: ["Mutabakat Testi'ni çalıştırın", support], nereye: DEVIR_TARGETS.mutabakatTesti });
  }
}

/** Değişmezin kullanıcı cümlesi (plan.mjs degismezler[].kod). */
function invariantText(row) {
  const a = tlText(row.beklenenMinor);
  const b = tlText(row.bulunanMinor);
  switch (row.kod2) {
    case "donem-sonucu":
      return `Kapanışta 590 / 591'e yazılacak dönem sonucu (${b}) Gelir Tablosu'nun dönem net kârıyla (${a}) tutmuyor`;
    case "onceki-yillar":
      return `Kapanmamış önceki yılların sonucu (${b}) Bilanço'daki geçmiş yıllar tutarıyla (${a}) tutmuyor`;
    case "stok-dss":
      return `Kapanıştan sonra 153 Ticari Mallar bakiyesi (${b}) dönem sonu stok değeriyle (${a}) tutmuyor`;
    case "stok-acilis":
      return `Stok açılış değerlerinin toplamı (${b}) arşivdeki 153 Ticari Mallar bakiyesiyle (${a}) tutmuyor`;
    case "sonuc-sifir":
      return `Kapanıştan sonra gelir / gider hesaplarında toplam ${b} bakiye kalıyor`;
    case "gecici-hesap":
      return `Yeni yılın 519 Eşleştirilecek Açılış Bakiyeleri (${b}) arşivdeki bakiyesiyle (${a}) tutmuyor`;
    case "denge":
      return `Arşivin kapanış bilançosu dengede değil (fark ${b})`;
    default:
      if (/^vergi-\d{3}$/.test(row.kod2 || "")) return `${accountText(row.kod2.slice(6))} açılışı (${b}) arşivdeki bakiyesiyle (${a}) tutmuyor`;
      return `Devir denetimi tutmadı (beklenen ${a}, bulunan ${b})`;
  }
}

/**
 * Ön denetim. facts: readDevirFacts().preflight; plan: buildDevirPlan() çıktısı; context: { isRoot (001), today, readProblems, names (cari kimliği → ad) }. decisions: test içindir (varsayılan
 * DEVIR_DECISIONS). Dönüş: { durdurur: [ileti], uyarir: [ileti], gecebilir: boolean } — ileti: iletiler.mjs devirIletisi (kod, seviye, baslik, neOldu, neden, neYapmali, nereye, git, metin,
 * adet?, ornek?, belirgin?, ayrinti?). Sıra kararlı: aşağıdaki denetim sırası (aynı olgu → aynı liste).
 */
export function devirPreflight(facts = {}, plan = null, { isRoot = false, today = "", readProblems = [], names = new Map(), decisions = DEVIR_DECISIONS } = {}) {
  const stop = [];
  const warn = [];
  const K = plan?.meta?.K || facts.K || "";
  const Kt = dayText(K);
  const year = K ? K.slice(0, 4) : "";
  const block = spec => stop.push(devirIletisi({ ...spec, seviye: "durdurur" }));
  const notice = spec => warn.push(devirIletisi({ ...spec, seviye: "uyarir" }));
  // S-2 / S-3 kararının TEK dalı (A DURDURUR · B UYARIR · C söylenmez — plan.mjs DEVIR_DECISIONS).
  const byDecision = (decision, spec) => (decision === "A" ? block(spec) : decision === "B" ? notice(spec) : null);
  const count = value => Number(value?.adet) || 0;
  // ---- DURDURUR (§5 + G4) ----
  if (count(facts.eBelgeBekleyen)) {
    const n = count(facts.eBelgeBekleyen);
    const tests = (facts.eBelgeBekleyen.ornek || []).filter(row => TEST_SERIES.test(row.number || ""));
    block({
      kod: "e-belge-bekleyen", baslik: "Gönderilecek e-Belge",
      neOldu: `${Kt} ve öncesi tarihli ${countText(n)} e-Belge Gönderilecekler'de bekliyor${sampleText(facts.eBelgeBekleyen.ornek)}`,
      neden: "Gönderilmemiş belge yeni yılda gönderilirse arşivdeki kaydıyla ayrışır; bu belgeler gönderilmeden ya da iptal edilmeden devir başlatılmaz",
      neYapmali: ["Faturalar › Gönderilecekler'i açın", "Gönderilecek belgeleri Gönder ile gönderin", "Gönderilmeyecek belgeyi iptal edin", ...(tests.length ? [`Test serisi numaralı belgeleri (${listText(tests.slice(0, 3).map(row => row.number))}) göndermeyin, iptal edin`] : []), RESTART],
      nereye: DEVIR_TARGETS.gonderilecekler, adet: n, ornek: facts.eBelgeBekleyen.ornek,
    });
  }
  if (count(facts.eBelgeListedenSilinen)) {
    const n = count(facts.eBelgeListedenSilinen);
    block({
      kod: "e-belge-listeden-silinen", baslik: "Listeden Silinen e-Belge",
      neOldu: `${Kt} ve öncesi tarihli ${countText(n)} e-Belge Listeden Sil ile gönderilmeyecek olarak bırakılmış${sampleText(facts.eBelgeListedenSilinen.ornek)}`,
      neden: "Bu belgeler yeni yılda gönderilirse numara sırası çakışabilir",
      neYapmali: ["Faturalar › Gönderilecekler'de bu belgeleri bulun", "Belgeyi gönderin ya da iptal edin", RESTART],
      nereye: DEVIR_TARGETS.gonderilecekler, adet: n, ornek: facts.eBelgeListedenSilinen.ornek,
    });
  }
  if (count(facts.eBelgeBelirsiz)) {
    const n = count(facts.eBelgeBelirsiz);
    block({
      kod: "e-belge-belirsiz", baslik: "Sonucu Belirsiz e-Belge Gönderimi",
      neOldu: `${countText(n)} e-Belgenin gönderim sonucu henüz belli değil${sampleText(facts.eBelgeBelirsiz.ornek)}`,
      neden: "Belgenin gidip gitmediği bilinmeden devredilirse yeni yılda ikinci kez gönderilebilir ya da hiç gönderilmemiş kalabilir",
      neYapmali: ["Faturalar'da belgeyi açın", "Durum Sorgula ile sonucunu öğrenin", "Gitmediyse yeniden gönderin; gittiyse başka bir şey yapmanız gerekmez", RESTART],
      nereye: DEVIR_TARGETS.faturalar, adet: n, ornek: facts.eBelgeBelirsiz.ornek,
    });
  }
  if (count(facts.taslakFatura)) {
    const n = count(facts.taslakFatura);
    block({
      kod: "taslak-fatura", baslik: "Taslak Fatura",
      neOldu: `${Kt} ve öncesi tarihli ${countText(n)} taslak fatura var${sampleText(facts.taslakFatura.ornek)}`,
      neden: "Taslak fatura devirde ne arşive ne yeni yıla kesin kayıt olarak geçer",
      neYapmali: ["Faturalar'da taslakları açın", "Taslağı kaydedin ya da silin", RESTART],
      nereye: DEVIR_TARGETS.faturalar, adet: n, ornek: facts.taslakFatura.ornek,
    });
  }
  if (count(facts.bankaIsi)) {
    const n = count(facts.bankaIsi);
    block({
      kod: "banka-isi", baslik: "Bekleyen Banka İşi",
      neOldu: `${countText(n)} banka / POS işi bekliyor (ör. ay sonu komisyon faturası)`,
      neden: "Bekleyen iş devirden sonra tamamlanırsa kaydı yanlış yıla düşer",
      neYapmali: ["Banka › Bekleyen İşler'i açın", "İşleri tamamlayın ya da iptal edin", RESTART],
      nereye: DEVIR_TARGETS.bankaIsleri, adet: n,
    });
  }
  if (facts.defterMutabakati && facts.defterMutabakati.ok === false) {
    const farklar = (facts.defterMutabakati.farklar || []).map(row => `${accountText(row.hesap)}: fark ${tlText(Math.round(Number(row.fark) * 100))}`);
    block({
      kod: "defter-mutabakati", baslik: "Defter Mutabakatı",
      neOldu: `Ana Defter alt defterlerle tutmuyor${facts.defterMutabakati.dengeli === false ? " (defter dengesiz)" : ""}${farklar.length ? `: ${listText(farklar)}` : ""}`,
      neden: "Tutmayan defterle devredilirse yeni yılın açılış bakiyeleri yanlış olur",
      neYapmali: ["Raporlar › Ana Defter › Defter Mutabakatı'nı açın", "Farkı gösteren hesabın kayıtlarını düzeltin", RESTART],
      nereye: DEVIR_TARGETS.defterMutabakati, ayrinti: facts.defterMutabakati.farklar,
    });
  }
  // S-2 (KG-16): "Açılış Olabilir" onay bekleyen kayıt.
  if (count(facts.acilisOlabilir)) {
    const n = count(facts.acilisOlabilir);
    byDecision(decisions.S2, {
      kod: "acilis-olabilir", baslik: decisions.S2 === "A" ? "Açılış Olabilir Kayıtları Onaylayın" : "Açılış Olabilir Kayıtları",
      neOldu: `${Kt} ve öncesi tarihli ${countText(n)} kayıt "Açılış Olabilir" listesinde onay bekliyor`,
      neden: "Bu kayıtların açılış mı olağan hareket mi olduğu devirden sonra yalnız Devri Yenile ile değiştirilebilir",
      neYapmali: ["Yönetim › Sistem › Açılış Olabilir Kayıtlar'ı açın", "Her kaydı onaylayın ya da reddedin", RESTART],
      nereye: DEVIR_TARGETS.acilisOlabilir, adet: n,
    });
  }
  // S-3 (KG-15): düzeltilmemiş Kural Değişikliği Farkı. D3 tur 3: S-KD-1 (alt defter farkı ayrı madde, çare Kilidi Aç → Yeniden Kilitle) ve S-KD-2 (düzeltme fişi kilit yüzünden
  // K'den sonraya düşüyorsa ya da düşmüşse ayrı madde, çare kilidi geri al → fişi eski yılda yaz → yeniden kilitle). Üçü de S-3'ün dalıyla (A DURDURUR).
  const rule = facts.kuralFarki || {};
  if (rule.dondurmaSuruyor) {
    block({
      kod: "dondurma-suruyor", baslik: "Dönem Kilidi Dondurması Sürüyor",
      neOldu: "Kilitli dönemin defteri şu anda donduruluyor",
      neden: "Dondurma bitmeden kilitli dönemin kesin bakiyeleri okunamaz",
      neYapmali: ["Yönetim › Sistem › Dönem Kilidi'nde dondurmanın bitmesini bekleyin", RESTART],
      nereye: DEVIR_TARGETS.donemKilidi,
    });
  }
  const lineText = (rule.fisSatirlari || []).map(line => `${accountText(line.hesap, line.alt)} ${line.borc ? `borç ${tlText(line.borc)}` : `alacak ${tlText(line.alacak)}`}`);
  const sourceText = rule.kaynakSayisi ? `${countText(rule.kaynakSayisi)} kayıtta ` : "";
  const cover = rule.kapsam ? `${dayText(rule.kapsam)} ve öncesi` : "kilitli dönem";
  const old = rule.eskiYil || null;
  const profitText = old && old.karEtkisiMinor ? `${year} yılının dönem sonucu ${tlText(Math.abs(old.karEtkisiMinor))} ${old.karEtkisiMinor < 0 ? "azalır" : "artar"}` : "";
  const lockSteps = (lockBack, fixSteps = []) => [
    `Yönetim › Sistem › Dönem Kilidi'nde kilidi ${dayText(lockBack)} gününe alın`,
    ...(old && old.tutarMinor ? [`Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi ${dayText(K)}, tutarı ${tlText(old.tutarMinor)})`] : []),
    ...fixSteps,
    `Dönem Kilidi'ni yeniden ${dayText(rule.kilit || K)} gününe alın`,
    "Dondurma bitince Ön İzleme'yi yeniden başlatın",
  ];
  if ((Number(rule.satir) || 0) > 0) {
    if (K && rule.fisTarihi && rule.fisTarihi > K && rule.kOncesiFark) {
      // S-KD-2 = A: fiş kilit yüzünden K+1'e (yeni yıla) düşecek — devir DURUR, fark ait olduğu yılda düzeltilir.
      byDecision(decisions.S3, {
        kod: "kural-farki-kilit", baslik: "Kural Farkı Eski Yılda Düzeltilmeli",
        neOldu: `Dönem Kilidi ${dayText(rule.kilit)} gününde; kilitli dönemde (${cover}) ${sourceText}Kural Değişikliği Farkı var ve Kural Farkı Düzeltme Fişi kilit yüzünden ${dayText(rule.fisTarihi)} tarihine, yani yeni yıla düşüyor${lineText.length ? ` (bugünkü fiş: ${listText(lineText)})` : ""}`,
        neden: `Fark ${year} ve öncesindeki kayıtlara ait; fiş yeni yılda yazılırsa ${year} yılının kârı yanlış devreder${profitText ? `. Fiş ${year} içinde yazılınca ${profitText}` : ""}`,
        neYapmali: lockSteps(dayBefore(K)),
        nereye: DEVIR_TARGETS.donemKilidi, ayrinti: { fisTarihi: rule.fisTarihi, eskiYil: old },
      });
    } else {
      byDecision(decisions.S3, {
        kod: "kural-farki", baslik: decisions.S3 === "A" ? "Kural Farkı Düzeltme Fişi'ni Yazın" : "Kural Değişikliği Farkı",
        neOldu: `Kilitli dönemde (${cover}) ${sourceText}düzeltilmemiş Kural Değişikliği Farkı var${rule.tutarMinor ? `; Kural Farkı Düzeltme Fişi'nin yazacağı tutar ${tlText(rule.tutarMinor)}` : ""}${lineText.length ? ` (${listText(lineText)})` : ""}`,
        neden: "Kilitli dönemin defteri eski kuralla donmuş; fark düzeltilmeden devredilirse arşivin kapanışı güncel kuralla tutmaz",
        neYapmali: ["Yönetim › Sistem › Kural Farkı Düzeltme Fişi'ni açın", `Ön izlemedeki fişi kaydedin${rule.fisTarihi ? ` (tarihi ${dayText(rule.fisTarihi)})` : ""}`, RESTART],
        nereye: DEVIR_TARGETS.kuralFarki,
      });
    }
  }
  if ((Number(rule.altDefter) || 0) > 0) {
    // S-KD-1 = A: fişin düzeltemediği alt defter farkı (cari / alt hesap başına; toplamı 0 olsa da) — devir DURUR, çare Kilidi Aç → Yeniden Kilitle.
    const rows = rule.altDefterSatirlari || [];
    const shown = rows.slice(0, 6).map(row => `${row.cari ? `${row.cariAd || "adı okunamayan cari"} — ` : ""}${accountText(row.hesap, row.alt)}: ${sideText(row.minor)}`);
    const byParty = new Map();
    for (const row of rows) if (row.cari) byParty.set(row.cari, (byParty.get(row.cari) || 0) + row.minor);
    const zero = [...byParty.values()].some(sum => sum === 0) ? " Carinin toplamı 0,00 TL görünse de hesaplar ayrı ayrı tutmuyor." : "";
    byDecision(decisions.S3, {
      kod: "kural-farki-alt-defter", baslik: "Kilidi Açıp Yeniden Kilitleyin",
      neOldu: `Kilitli dönemde (${cover}) alt defter hesaplarında Kural Değişikliği Farkı var: ${shown.length ? listText(shown) : `${countText(rule.altDefter)} hesap`}${rows.length > 6 ? ` ve ${countText(rows.length - 6)} satır daha` : ""}.${zero}`,
      neden: "Alt defter hesabının (cari, banka, kasa, evrak) farkı Kural Farkı Düzeltme Fişi'yle düzeltilemez; düzeltilmeden devredilirse yeni yılın açılışı alt defterle tutmaz",
      neYapmali: ["Yönetim › Sistem › Dönem Kilidi'nde Kilidi Aç'ı seçin", `Kilidi yeniden ${dayText(rule.kilit || rule.kapsam || K)} gününe koyun (Yeniden Kilitle); kilitli dönem güncel kuralla yeniden donar`, "Dondurma bitince Ön İzleme'yi yeniden başlatın"],
      nereye: DEVIR_TARGETS.donemKilidi, ayrinti: rows,
    });
  }
  if (K && rule.kOncesiFark && (rule.yeniYilFisleri || []).length) {
    // S-KD-2 = A: düzeltme fişi yeni yılın içinde yazılmış (kilit K'deyken) — fark ait olduğu yılda olmalı.
    const vouchers = rule.yeniYilFisleri;
    byDecision(decisions.S3, {
      kod: "kural-farki-fis-yeni-yilda", baslik: "Kural Farkı Fişi Yeni Yılda",
      neOldu: `Kural Farkı Düzeltme Fişi ${listText(vouchers.map(row => `${row.no} (${dayText(row.tarih)}, ${tlText(row.tutarMinor)})`))} yeni yılın içinde yazılmış; düzelttiği fark ${year} ve öncesindeki kayıtlara ait`,
      neden: `Fark ait olduğu yılda olmalı; fiş yeni yılda kalırsa ${year} yılının kârı yanlış devreder${profitText ? `. Fiş ${year} içinde yazılınca ${profitText}` : ""}`,
      neYapmali: ["Yönetim › Sistem › Kural Farkı Düzeltme'de bu fişi Ters Kaydet ile geri alın", ...lockSteps(dayBefore(K)).filter(step => !step.startsWith("Dondurma")), "Dondurma bitince Ön İzleme'yi yeniden başlatın"].filter((step, index, all) => all.indexOf(step) === index),
      nereye: DEVIR_TARGETS.kuralFarki, ayrinti: { fisler: vouchers, eskiYil: old },
    });
  }
  // Planın kendi sorunları (kapanış = açılış tutmuyor, sınıflandırılmamış tablo) ve değişmezleri.
  for (const problem of [...readProblems, ...(plan?.sorunlar || [])]) stop.push(problemIletisi(problem, { names, K }));
  for (const invariant of plan?.degismezler || []) if (!invariant.ok) stop.push(problemIletisi({ ...invariant, kod: "degismez", kod2: invariant.kod }, { names, K }));
  // ---- UYARIR (§5 + G4) ----
  const offset = facts.aralikMahsubu;
  if (offset && !offset.yapildi) {
    // B-11 (BAŞ MİMAR önerisi): Ocak başındaki devirlerin çoğu buna düşer — belirgin uyarı + bağlantı.
    notice({
      kod: "aralik-mahsubu", baslik: "Önce Aralık Mahsubunu Yapın",
      neOldu: `${monthText(offset.ay)} KDV Mahsup Fişi yapılmamış`,
      neden: `Devirden sonra yalnız Devri Yenile ile yapılabilir; ${monthText(offset.ay)} indirilecek ve hesaplanan KDV'si yeni yılın hiçbir mahsubuna girmez`,
      neYapmali: ["Vergi › KDV Mahsup Fişi'nde Aralık mahsubunu yapın", RESTART],
      nereye: DEVIR_TARGETS.kdvMahsup, belirgin: true,
    });
  }
  if (count(facts.iceAktarma)) {
    const n = count(facts.iceAktarma);
    notice({
      kod: "ice-aktarma", baslik: "İçe Aktarmaların Geri Alınması Kapanacak",
      neOldu: `${Kt} ve öncesinde yapılmış ${countText(n)} içe aktarma var`,
      neden: "Devirden sonra bu içe aktarmaların Geri Al'ı kullanılamaz",
      neYapmali: ["Geri almak istediğiniz içe aktarma varsa devirden önce Taksitler'de Geri Al'ı kullanın"],
      nereye: DEVIR_TARGETS.taksitler, adet: n,
    });
  }
  const repeats = plan?.newYear?.sablonlar || [];
  if (repeats.length) {
    notice({
      kod: "tekrarlayan-sablon", baslik: "Tekrarlayan Fatura Şablonu Taşınacak",
      neOldu: `${countText(repeats.length)} etkin tekrarlayan faturanın ${Kt} ve öncesi tarihli şablonu var`,
      neden: "Şablon yeni yıla taslak olarak taşınır; tekrar yeni yılda bu taslaktan sürer",
      neYapmali: ["Devirden sonra Faturalar'da taşınan şablonları gözden geçirin"],
      nereye: DEVIR_TARGETS.faturalar, adet: repeats.length,
    });
  }
  if (count(facts.gelenKutusu)) {
    const n = count(facts.gelenKutusu);
    notice({
      kod: "gelen-kutusu", baslik: "Alınmamış Gelen e-Fatura",
      neOldu: `Gelen e-Faturalar'da ${Kt} ve öncesi tarihli ${countText(n)} belge alınmamış`,
      neden: "Aralık faturaları devirden önce alınmalı; sonra yalnız Devri Yenile ile girilebilir",
      neYapmali: ["Faturalar › Gelen e-Faturalar'da belgeleri alın", RESTART],
      nereye: DEVIR_TARGETS.gelenKutusu, adet: n,
    });
  }
  if (count(facts.iptalSuresi)) {
    const n = count(facts.iptalSuresi);
    notice({
      kod: "iptal-suresi", baslik: "İptal Süresi Dolmamış e-Belge",
      neOldu: `${Kt} ve öncesi tarihli ${countText(n)} e-Arşiv / e-SMM belgesinin iptal süresi dolmadı`,
      neden: "Arşivde iptal yapılamaz",
      neYapmali: ["İptal edilecek belge varsa devirden önce Faturalar'da iptal edin"],
      nereye: DEVIR_TARGETS.faturalar, adet: n,
    });
  }
  const negativeStock = plan?.sayilar?.stok?.eksi || 0;
  if (negativeStock) {
    notice({
      kod: "eksi-stok", baslik: "Eksi Stokla Devreden Ürünler",
      neOldu: `${countText(negativeStock)} ürün eksi miktarla devredecek (değeri 0,00 TL)`,
      neden: "Eksi miktar yeni yıla aynen geçer; ortalama maliyet yeni yılda sıfırdan başlar",
      neYapmali: ["Ürün listesini Devir Raporu'nda görün", "Eksik alış faturası varsa devirden önce girin"],
      nereye: DEVIR_TARGETS.stok, adet: negativeStock,
    });
  }
  const cash = plan?.newYear?.kasa?.minor || 0;
  if (cash < 0) {
    notice({
      kod: "eksi-kasa", baslik: "Eksi Kasa",
      neOldu: `Kasa ${Kt} itibarıyla eksi bakiyede (${tlText(cash)})`,
      neden: "Eksi kasa yeni yıla eksi açılışla geçer",
      neYapmali: ["Kasa hareketlerini denetleyin; eksik giriş varsa devirden önce girin"],
      nereye: DEVIR_TARGETS.kasa,
    });
  }
  const wa = facts.whatsapp || null;
  if (wa && wa.isSayisi > 0) {
    // S-C5C-9 = A (kullanıcı 27.11 12:01, ilke taslağı §8.1) + BAŞ MİMAR EKİ: devir başlarken o şirketin süren / duraklatılmış toplu işleri "Durduruldu (Devir)" olur (D4) — ön denetimde
    // UYARI (durdurmaz), sayılar şirketin gönderim kuyruğundan.
    const parts = [wa.suren ? `${countText(wa.suren)} süren` : "", wa.duraklatilmis ? `${countText(wa.duraklatilmis)} duraklatılmış` : ""].filter(Boolean);
    notice({
      kod: "whatsapp-gonderim", baslik: "WhatsApp Gönderimi Durdurulacak",
      neOldu: `${countText(wa.isSayisi)} toplu WhatsApp gönderimi bitmedi (${listText(parts)}); ${countText(wa.kisiSayisi)} kişiye ileti henüz gitmedi${wa.sinirda ? `, bunların ${countText(wa.sinirda)} kişisi sınır nedeniyle bekliyor` : ""}`,
      neden: "Devir başlarken bu gönderimler Durduruldu (Devir) olur ve kendiliğinden sürmez; iletisi gitmemiş kişiler almamış sayılır",
      neYapmali: ["Gönderimin bitmesini istiyorsanız devirden önce bitmesini bekleyin", "Devirden sonra gerekirse yeni gönderim başlatın"],
      nereye: DEVIR_TARGETS.whatsapp, adet: wa.kisiSayisi, ayrinti: wa,
    });
  }
  if (isRoot) {
    notice({
      kod: "yeniden-baslatma", baslik: "Program Yeniden Başlatılacak",
      neOldu: "İlk şirketin (001) devri programın yeniden başlatılmasını gerektirir",
      neden: "Devir sırasında öbür kullanıcıların bağlantısı kesilir",
      neYapmali: ["Devirden önce öbür kullanıcılara haber verin"],
      nereye: DEVIR_TARGETS.yilSonuDevri,
    });
  }
  if (today && K) {
    const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${K}T00:00:00Z`)) / 86_400_000);
    if (gap < 60) {
      notice({
        kod: "erken-devir", baslik: "Aralık Belgeleri Tamamlandı mı?",
        neOldu: `Son işlem tarihinin üzerinden ${gap} gün geçti`,
        neden: "Geç gelen Aralık belgesi devirden sonra yalnız Devri Yenile ile girilebilir",
        neYapmali: ["Aralık faturalarının geldiğini ve Aralık beyannamesinin verildiğini denetleyin"],
        nereye: DEVIR_TARGETS.faturalar,
      });
    }
  }
  return { durdurur: stop, uyarir: warn, gecebilir: stop.length === 0 };
}
