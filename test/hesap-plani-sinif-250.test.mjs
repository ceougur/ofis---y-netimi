// 2.5.0 Ç1 — hesap planı ve sınıflama denetimi (docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §2, §13; docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md §2, §7).
// Ana Defter'in hesap planındaki (CHART) HER hesap tam bir yere düşer: bir MSUGT bilanço kalemi YA DA bir MSUGT gelir tablosu kalemi; yansıtma (761 / 771 /
// 781) ve kapanış (690 / 692) hesaplarının mali tablo kalemi yoktur. Sınıfsız ya da çift sınıflı hesap → kırmızı. Mali tablolar (Ç6) bu sınıflamayı okur;
// sınıfsız bir hesap Bilanço'da / Gelir Tablosu'nda sessizce kaybolur ya da yanlış satıra düşer (Aktif = Pasif tutmaz).
// Beklenen kalemler kural kitabının §2 tablosundan (kodu görmeden yazılmış) BURAYA ELLE yazıldı; programın sınıflamasından türetilmez (ders 5).
// 2.4.9'da (taban 1c0e4e9e) sınıflama yoktur → "sınıfsız" nedeniyle kırmızı (ders 38).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as gl from "../server/lib/general-ledger.mjs";
import { DOCUMENT_GL, DOCUMENT_SUB_NAMES } from "../server/lib/cheque-gl.mjs";
import { DOUBTFUL_GL } from "../server/lib/doubtful-gl.mjs";
import { FORBIDDEN_GL, ROLE_GL, UNASSIGNED_SUB } from "../server/lib/bank/voucher.mjs";
import { EXPENSES, lineAccount } from "../server/lib/invoice-math.mjs";

const KINDS = ["aktif", "pasif", "gelir", "gider", "yansitma", "kapanis"];
const STATEMENT_FREE = new Set(["yansitma", "kapanis"]);
const plan = () => gl.ACCOUNT_PLAN || {};
const itemOf = code => (Object.hasOwn(plan(), code) ? plan()[code] : null);
const sheetItems = () => gl.BALANCE_SHEET_ITEMS || {};
const incomeItems = () => gl.INCOME_STATEMENT_ITEMS || {};
const codesOf = object => Object.keys(object).sort();

// Kural kitabı §2 (Tür, MSUGT kalemi). 127 / 646 / 656 kitapta yok: 127 Tekdüzen 12 grubu (Ticari Alacaklar), 646 ve 656 §7.1 aralıkları (F 640–649, G 653–659).
// 691: kitapta tür KP ama MSUGT gelir tablosunda K satırı (§7.1) — gelir tablosu kalemi K. 671 / 681: kural kitabı EK-1 E2 (M7, Kural Farkı Düzeltme Fişi) — GT I / J.
const EXPECTED = {
  100: ["aktif", "I.A"], 101: ["aktif", "I.A"], 102: ["aktif", "I.A"], 103: ["aktif", "I.A"], 108: ["aktif", "I.A"],
  120: ["aktif", "I.C"], 121: ["aktif", "I.C"], 127: ["aktif", "I.C"], 128: ["aktif", "I.C"], 129: ["aktif", "I.C"],
  136: ["aktif", "I.D"], 153: ["aktif", "I.E"], 159: ["aktif", "I.E"],
  190: ["aktif", "I.H"], 191: ["aktif", "I.H"], 193: ["aktif", "I.H"], 198: ["aktif", "I.H"], 255: ["aktif", "II.D"],
  300: ["pasif", "III.A"], 309: ["pasif", "III.A"], 320: ["pasif", "III.B"], 321: ["pasif", "III.B"], 336: ["pasif", "III.C"], 340: ["pasif", "III.D"],
  360: ["pasif", "III.F"], 391: ["pasif", "III.I"],
  // 2.5.0 Ç5-A (C5-ACILIS-TASARIM §2.1; G3: M-11 hedefleri planda): 501–503 Ödenmiş Sermaye kalemi, 52x Sermaye Yedekleri, 54x Kâr Yedekleri.
  500: ["pasif", "V.A"], 501: ["pasif", "V.A"], 502: ["pasif", "V.A"], 503: ["pasif", "V.A"], 519: ["pasif", "V.G"],
  520: ["pasif", "V.B"], 521: ["pasif", "V.B"], 522: ["pasif", "V.B"], 523: ["pasif", "V.B"], 529: ["pasif", "V.B"],
  540: ["pasif", "V.C"], 541: ["pasif", "V.C"], 542: ["pasif", "V.C"], 548: ["pasif", "V.C"], 549: ["pasif", "V.C"], 570: ["pasif", "V.D"], 580: ["pasif", "V.E"], 590: ["pasif", "V.F"], 591: ["pasif", "V.F"],
  600: ["gelir", "A"], 602: ["gelir", "A"], 610: ["gider", "B"], 621: ["gider", "D"], 631: ["gider", "E"], 632: ["gider", "E"],
  642: ["gelir", "F"], 644: ["gelir", "F"], 646: ["gelir", "F"], 649: ["gelir", "F"],
  653: ["gider", "G"], 654: ["gider", "G"], 656: ["gider", "G"], 659: ["gider", "G"], 660: ["gider", "H"], 671: ["gelir", "I"], 681: ["gider", "J"], 689: ["gider", "J"],
  690: ["kapanis", null], 691: ["gider", "K"], 692: ["kapanis", null],
  760: ["gider", "E"], 761: ["yansitma", null], 770: ["gider", "E"], 771: ["yansitma", null], 780: ["gider", "H"], 781: ["yansitma", null],
};
// Kural kitabı §2 "Tür" kolonunda (−) işaretli bilanço hesapları.
// 2.5.0 Ç5-A (§2.1, G3): Tek Düzen 501 / 503 "(−)" hesaplarıdır.
const CONTRA = ["103", "129", "501", "503", "580", "591"];
// Çekirdek §13 / kural kitabı §7.3: brütleştirilen ters bakiyeler.
const GROSS = {
  102: { bilanco: "III.A", hesap: "300", boyut: "altHesap", kesinDegil: false },
  120: { bilanco: "III.D", hesap: "340", boyut: "cari", kesinDegil: false },
  309: { bilanco: "I.D", hesap: "136", boyut: "altHesap", kesinDegil: false },
  320: { bilanco: "I.E", hesap: "159", boyut: "cari", kesinDegil: false },
  336: { bilanco: "I.D", hesap: "136", boyut: "cari", kesinDegil: false },
  360: { bilanco: "I.H", hesap: "198", boyut: "hesap", kesinDegil: true },
};
// Kural kitabı §2 / §7.3: ters bakiyesi kendi kaleminde eksi + "Kesin Değil".
const NOT_FINAL = ["100", "101", "103", "108", "121", "128", "129", "153", "300", "321"];
// Kural kitabı §2 "Ters bakiyede (§7.3)" sütunu "—" olan bilanço hesapları: ters bakiye kendi kaleminde işaretli kalır (brütleştirme / Kesin Değil yok).
// 519'un sütunu "aynı satır, eksi" — aynı kural. (Kitap satırları: 136, 159, 190, 191, 193, 198, 255, 340, 391, 500, 519, 570, 580, 590, 591.)
// 2.5.0 Ç5-A (§2.1, G3): eklenen öz kaynak hesapları (501–503, 52x, 54x) — ters bakiyede aynı satır (500 / 570 gibi).
const SAME = ["136", "159", "190", "191", "193", "198", "255", "340", "391", "500", "501", "502", "503", "519", "520", "521", "522", "523", "529", "540", "541", "542", "548", "549", "570", "580", "590", "591"];
// Kural kitabında ters kuralı olmayan bilanço hesapları — KARAR GEREKİYOR (liste ancak bilerek büyür).
const UNDECIDED = ["127"];
// Ç1'de eklenen hesapların adları — kural kitabı §2 "Ad (Tek Düzen)" sütunundan (671 / 681: EK-1 M7 / E2) ELLE yazıldı. Karşılaştırmada iki yazım farkı yok sayılır
// (sameName): (a) gelir tablosu ve kapanış hesaplarının (kitapta Gİ / KP) adındaki "(−)" MSUGT işaretidir — programda gelir tablosu kaleminin `eksi`
// alanıyla taşınır, 2.4.9'dan beri adda yazılmaz (kitap "610 Satıştan İadeler (−)", "689 … (−)" ↔ aşağıdaki 2.4.9 adları); bilanço hesaplarında (580 / 591)
// "(−)" adın parçasıdır, yok sayılmaz; (b) virgül (kitap "Pazarlama Satış ve Dağıtım", 2.4.9'un 760'ı "Pazarlama, Satış ve Dağıtım"). 761 / 771 / 781:
// kitabın "… / Yansıtma" kısaltmasının Tekdüzen tam adı "… Yansıtma Hesabı". 519 burada yok: kitapta "(Geçici)" ekiyle — aşağıdaki ayrı denetim.
const NEW_NAMES = {
  136: "Diğer Çeşitli Alacaklar", 159: "Verilen Sipariş Avansları", 198: "Diğer Çeşitli Dönen Varlıklar", 340: "Alınan Sipariş Avansları",
  570: "Geçmiş Yıllar Kârları", 580: "Geçmiş Yıllar Zararları (−)", 590: "Dönem Net Kârı", 591: "Dönem Net Zararı (−)",
  621: "Satılan Ticari Mallar Maliyeti (−)", 631: "Pazarlama Satış ve Dağıtım Giderleri (−)", 632: "Genel Yönetim Giderleri (−)", 660: "Kısa Vadeli Borçlanma Giderleri (−)",
  671: "Önceki Dönem Gelir ve Kârları", 681: "Önceki Dönem Gider ve Zararları",
  690: "Dönem Kârı veya Zararı", 691: "Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)", 692: "Dönem Net Kârı veya Zararı",
  761: "Pazarlama Satış ve Dağıtım Giderleri Yansıtma Hesabı", 771: "Genel Yönetim Giderleri Yansıtma Hesabı", 781: "Finansman Giderleri Yansıtma Hesabı",
  // 2.5.0 Ç5-A (C5-ACILIS-TASARIM §2.1; Tek Düzen Hesap Planı adları — mali müşavir A'da doğrulanır): öz kaynak hesapları.
  500: "Sermaye", 501: "Ödenmemiş Sermaye (−)", 502: "Sermaye Düzeltmesi Olumlu Farkları", 503: "Sermaye Düzeltmesi Olumsuz Farkları (−)",
  520: "Hisse Senedi İhraç Primleri", 521: "Hisse Senedi İptal Kârları", 522: "Maddi Duran Varlık Yeniden Değerleme Artışları", 523: "İştirakler Yeniden Değerleme Artışları",
  529: "Diğer Sermaye Yedekleri", 540: "Yasal Yedekler", 541: "Statü Yedekleri", 542: "Olağanüstü Yedekler", 548: "Diğer Kâr Yedekleri", 549: "Özel Fonlar",
};
// Dar kontrol DÜŞÜK (Ç4 turu): "(−)" YALNIZ kitabın adından silinir; programın adı olduğu gibi karşılaştırılır — programda gelir tablosu / kapanış hesabının
// adına "(−)" eklenirse (2.4.9'dan beri adda yazılmaz) kırmızı olur.
const sameName = (code, got, want) => {
  const statement = !itemOf(code)?.bilanco;
  const norm = text => String(text ?? "").replace(/,/g, "").replace(/\s+/g, " ").trim();
  const book = statement ? norm(want).replace(/\s*\(−\)$/, "") : norm(want);
  return norm(got) === book;
};
// 2.4.9'daki (taban 1c0e4e9e) hesap adları: Ç1 yalnız 770'in adını değiştirir.
const NAMES_249 = {
  100: "Kasa (Nakit)", 101: "Alınan Çekler", 102: "Bankalar (Havale / EFT)", 103: "Verilen Çekler ve Ödeme Emirleri (−)", 108: "Kredi Kartı Tahsilatları (POS)",
  120: "Alıcılar (Müşteri Carileri)", 121: "Alacak Senetleri", 127: "Carisiz Taksit Kartları", 128: "Şüpheli Ticari Alacaklar", 129: "Şüpheli Ticari Alacaklar Karşılığı (−)",
  153: "Ticari Mallar (Stok Alımları)", 190: "Devreden KDV", 191: "İndirilecek KDV", 193: "Peşin Ödenen Vergiler (Stopaj)", 255: "Demirbaşlar", 300: "Banka Kredileri",
  309: "Diğer Mali Borçlar (Kredi Kartları)", 320: "Satıcılar (Tedarikçi Carileri)", 321: "Borç Senetleri", 336: "Diğer Cariler (Personel vb.)",
  360: "Ödenecek Vergi ve Fonlar (Tevkifat, Stopaj)", 391: "Hesaplanan KDV", 600: "Yurt İçi Satışlar (Stok)",
  602: "Diğer Gelirler (Hizmet, Taksitli Satış, Kayıt Tahsilatları)", 610: "Satıştan İadeler", 642: "Faiz Gelirleri", 644: "Konusu Kalmayan Karşılıklar",
  646: "Kambiyo Kârları", 649: "Diğer Olağan Gelir ve Kârlar", 653: "Komisyon Giderleri", 654: "Karşılık Giderleri", 656: "Kambiyo Zararları",
  659: "Diğer Olağan Gider ve Zararlar", 689: "Diğer Olağandışı Gider ve Zararlar", 760: "Pazarlama, Satış ve Dağıtım Giderleri", 780: "Finansman Giderleri",
};

/** Hesabın düştüğü yer(ler) ve kural ihlalleri — boş dizi: tam bir yere, kurala uygun. */
function problemsOf(code) {
  const item = itemOf(code);
  if (!item) return [`${code} ${gl.CHART[code]}: sınıfsız (hesap planında sınıflama kaydı yok)`];
  const out = [];
  const say = text => out.push(`${code} ${gl.CHART[code]}: ${text}`);
  if (!KINDS.includes(item.tur)) say(`tür tanımsız (${item.tur})`);
  const places = [item.bilanco ? `bilanço ${item.bilanco}` : "", item.gelirTablosu ? `gelir tablosu ${item.gelirTablosu}` : "", STATEMENT_FREE.has(item.tur) ? `tür ${item.tur}` : ""].filter(Boolean);
  if (places.length === 0) say("sınıfsız (ne bilanço ne gelir tablosu kalemi, ne yansıtma / kapanış türü)");
  if (places.length > 1) say(`çift sınıflı (${places.join(" + ")})`);
  if (item.bilanco && !Object.hasOwn(sheetItems(), item.bilanco)) say(`bilanço kalemi katalogda yok (${item.bilanco})`);
  if (item.gelirTablosu && !Object.hasOwn(incomeItems(), item.gelirTablosu)) say(`gelir tablosu kalemi katalogda yok (${item.gelirTablosu})`);
  const side = sheetItems()[item.bilanco]?.taraf;
  if (item.tur === "aktif" && item.bilanco && side !== "aktif") say(`aktif hesap pasif kaleminde (${item.bilanco})`);
  if (item.tur === "pasif" && item.bilanco && side !== "pasif") say(`pasif hesap aktif kaleminde (${item.bilanco})`);
  if (["aktif", "pasif"].includes(item.tur) && !item.bilanco) say("bilanço hesabının bilanço kalemi yok");
  if (["gelir", "gider"].includes(item.tur) && !item.gelirTablosu) say("gelir / gider hesabının gelir tablosu kalemi yok");
  const minus = incomeItems()[item.gelirTablosu]?.eksi;
  if (item.tur === "gelir" && item.gelirTablosu && minus !== false) say(`gelir hesabı (−) kaleminde (${item.gelirTablosu})`);
  if (item.tur === "gider" && item.gelirTablosu && minus !== true) say(`gider hesabı (+) kaleminde (${item.gelirTablosu})`);
  if (typeof item.duzenleyici !== "boolean") say("düzenleyici alanı yok");
  if (item.duzenleyici && !item.bilanco) say("düzenleyici işareti bilanço dışı hesapta");
  // Ters bakiye: yalnız bilanço hesabında; brütleştirmenin hedefi planda ve hedef hesabın kendi kalemi aynı, karşı tarafta.
  if (!item.bilanco && item.ters !== null) say(`bilanço dışı hesapta ters bakiye kuralı (${JSON.stringify(item.ters)})`);
  if (item.ters !== null && typeof item.ters === "object") {
    const target = itemOf(item.ters.hesap);
    if (!target) say(`ters bakiye hedefi planda yok (${item.ters.hesap})`);
    else if (target.bilanco !== item.ters.bilanco) say(`ters bakiye kalemi hedef hesabın kalemi değil (${item.ters.bilanco} ≠ ${target.bilanco})`);
    if (sheetItems()[item.ters.bilanco]?.taraf === side) say("ters bakiye aynı tarafta (brütleştirme karşı tarafa gider)");
    if (!["cari", "altHesap", "hesap"].includes(item.ters.boyut)) say(`ters bakiye boyutu tanımsız (${item.ters.boyut})`);
  } else if (![null, "kesinDegil", "karar"].includes(item.ters)) say(`ters bakiye kuralı tanımsız (${item.ters})`);
  // 7/A: gider hesabının yansıtması ↔ yansıtma hesabının kaynağı; hedef aynı gelir tablosu kaleminde.
  if (item.yansitma) {
    const mirror = itemOf(item.yansitma);
    const target = itemOf(item.hedef);
    if (mirror?.tur !== "yansitma" || mirror.kaynak !== code || mirror.hedef !== item.hedef) say(`yansıtma hesabı tutarsız (${item.yansitma})`);
    if (!target || target.gelirTablosu !== item.gelirTablosu || target.yansitma) say(`yansıtma hedefi tutarsız (${item.hedef})`);
  }
  if (item.tur === "yansitma" && itemOf(item.kaynak)?.yansitma !== code) say(`yansıtma kaynağı tutarsız (${item.kaynak})`);
  return out;
}

describe("2.5.0 Ç1 — hesap planı sınıflaması", () => {
  it("CHART'taki her hesap tam bir yere düşer (bilanço kalemi ya da gelir tablosu kalemi ya da yansıtma / kapanış türü); sınıfsız ya da çift sınıflı yok", () => {
    const problems = codesOf(gl.CHART).flatMap(problemsOf);
    assert.deepEqual(problems, [], `sınıflama sorunları:\n${problems.join("\n")}`);
    assert.deepEqual(codesOf(plan()), codesOf(gl.CHART), "hesap planının kayıtları = CHART'ın hesapları (tek kaynak)");
    for (const code of codesOf(gl.CHART)) assert.equal(gl.CHART[code], itemOf(code)?.ad, `${code}: CHART adı plan kaydının adı`);
  });

  it("tür ve MSUGT kalemi kural kitabı §2 tablosuyla aynı (eksik hesaplar eklendi)", () => {
    const wrong = [];
    for (const [code, [kind, place]] of Object.entries(EXPECTED)) {
      const item = itemOf(code);
      if (!item) {
        wrong.push(`${code}: planda yok`);
        continue;
      }
      const got = item.bilanco || item.gelirTablosu || null;
      if (item.tur !== kind || got !== place) wrong.push(`${code}: beklenen ${kind} ${place ?? "-"}, program ${item.tur} ${got ?? "-"}`);
    }
    const extra = codesOf(gl.CHART).filter(code => !Object.hasOwn(EXPECTED, code));
    assert.deepEqual(wrong, [], wrong.join("\n"));
    assert.deepEqual(extra, [], "kural kitabı beklentisi olmayan hesap (yeni hesap bu teste de yazılır)");
    const contra = codesOf(gl.CHART).filter(code => itemOf(code)?.duzenleyici);
    assert.deepEqual(contra, CONTRA, "düzenleyici (−) hesaplar");
  });

  it("ters bakiye kuralları (çekirdek §13, kural kitabı §7.3): brütleştirme, Kesin Değil, KARAR GEREKİYOR", () => {
    for (const [code, want] of Object.entries(GROSS)) assert.deepEqual(gl.reverseBalanceOf?.(code), { kural: "brut", ...want }, `${code} ters bakiyesi`);
    for (const code of NOT_FINAL) assert.deepEqual(gl.reverseBalanceOf?.(code), { kural: "kesinDegil" }, `${code} ters bakiyesi kendi kaleminde eksi + Kesin Değil`);
    for (const code of SAME) assert.deepEqual(gl.reverseBalanceOf?.(code), { kural: "ayni" }, `${code} ters bakiyesi kendi kaleminde işaretli (kitap §2 "—")`);
    // Her bilanço hesabı tam bir listede: brütleştirme, Kesin Değil, aynı ya da KARAR GEREKİYOR (yeni bilanço hesabı kitaptan bu listelere yazılır).
    const listed = new Set([...Object.keys(GROSS), ...NOT_FINAL, ...SAME, ...UNDECIDED]);
    const unlisted = codesOf(gl.CHART).filter(code => itemOf(code)?.bilanco && !listed.has(code));
    assert.deepEqual(unlisted, [], "ters bakiye beklentisi yazılmamış bilanço hesabı");
    const undecided = codesOf(gl.CHART).filter(code => gl.reverseBalanceOf?.(code)?.kural === "karar");
    assert.deepEqual(undecided, UNDECIDED, "KARAR GEREKİYOR listesi");
    assert.equal(gl.reverseBalanceOf?.("600"), null, "gelir tablosu hesabının ters bakiye kuralı yok");
    assert.deepEqual(gl.reverseBalanceOf?.("102.01"), gl.reverseBalanceOf?.("102"), "alt hesap ana hesabın kuralını alır");
  });

  it("7/A yansıtma: 760 → 761 / 631, 770 → 771 / 632, 780 → 781 / 660; gelir tablosunda yansıtıldığı hesabın satırında", () => {
    for (const [cost, mirror, target, place] of [["760", "761", "631", "E"], ["770", "771", "632", "E"], ["780", "781", "660", "H"]]) {
      assert.equal(itemOf(cost)?.yansitma, mirror, `${cost} yansıtma hesabı`);
      assert.equal(itemOf(cost)?.hedef, target, `${cost} yansıtıldığı hesap`);
      assert.deepEqual({ kod: gl.incomeStatementItemOf?.(cost)?.kod, hesap: gl.incomeStatementItemOf?.(cost)?.hesap }, { kod: place, hesap: target }, `${cost} gelir tablosu satırı`);
      assert.deepEqual({ kod: gl.incomeStatementItemOf?.(target)?.kod, hesap: gl.incomeStatementItemOf?.(target)?.hesap }, { kod: place, hesap: target }, `${target} gelir tablosu satırı`);
      assert.equal(gl.incomeStatementItemOf?.(mirror), null, `${mirror} yansıtma hesabının mali tablo kalemi yok`);
      assert.equal(gl.balanceSheetItemOf?.(mirror), null, `${mirror} bilançoda yok`);
    }
    for (const code of ["690", "692"]) assert.equal(gl.incomeStatementItemOf?.(code) ?? gl.balanceSheetItemOf?.(code) ?? null, null, `${code} kapanış hesabının mali tablo kalemi yok`);
  });

  it("yardımcılar: alt hesap ana hesabın sınıfını alır; planda olmayan kod null", () => {
    assert.equal(gl.accountOf?.("770.90"), itemOf("770"));
    assert.equal(gl.accountOf?.("102.01"), itemOf("102"));
    for (const missing of ["", "999", "constructor", "toString", null, undefined]) assert.equal(gl.accountOf?.(missing) ?? null, null, `${missing}: planda yok`);
    assert.deepEqual(gl.balanceSheetItemOf?.("580"), { kod: "V.E", taraf: "pasif", grup: "V", grupAd: "Özkaynaklar", ad: "Geçmiş Yıllar Zararları (−)", duzenleyici: true });
    assert.deepEqual(gl.balanceSheetItemOf?.("519"), { kod: "V.G", taraf: "pasif", grup: "V", grupAd: "Özkaynaklar", ad: "Eşleştirilecek Açılış Bakiyeleri (Geçici)", duzenleyici: false });
    assert.equal(gl.balanceSheetItemOf?.("600"), null);
    assert.deepEqual(gl.incomeStatementItemOf?.("610"), { kod: "B", ad: "Satış İndirimleri (−)", eksi: true, hesap: "610" });
  });

  it("adlar: 770 Tekdüzen adıyla; geri kalan 2.4.9 adları değişmedi; yeni hesaplar planda", () => {
    assert.equal(gl.CHART["770"], "Genel Yönetim Giderleri");
    assert.equal(gl.CHART["519"], "Eşleştirilecek Açılış Bakiyeleri");
    assert.equal(gl.CHART["671"], "Önceki Dönem Gelir ve Kârları");
    assert.equal(gl.CHART["681"], "Önceki Dönem Gider ve Zararları");
    const renamed = Object.entries(NAMES_249).filter(([code, name]) => gl.CHART[code] !== name).map(([code, name]) => `${code}: ${name} → ${gl.CHART[code]}`);
    assert.deepEqual(renamed, [], "2.4.9 adı değişen hesap (yalnız 770 ve 500 değişir)");
    // 2.5.0 Ç5-A (C5-ACILIS-TASARIM §2.1, G3): 500 Tek Düzen adıyla (2.4.9 "Açılış ve Devir Bakiyeleri"; açılışlar 519'a geçti).
    assert.equal(gl.CHART["500"], "Sermaye");
    for (const code of ["519", "570", "580", "590", "591", "690", "691", "692", "621", "631", "632", "660", "671", "681", "761", "771", "781", "340", "159", "136", "198"]) assert.ok(gl.CHART[code], `${code} planda yok`);
    const wrongNames = Object.entries(NEW_NAMES).filter(([code, name]) => !sameName(code, gl.CHART[code], name)).map(([code, name]) => `${code}: kitap "${name}", program "${gl.CHART[code]}"`);
    assert.deepEqual(wrongNames, [], "eklenen hesabın adı kural kitabı §2'deki Tek Düzen adı değil");
  });

  it("alt hesap tanımları (yalnız tanım): 600.90 / 610.90 Belgesiz, 602.90 / 770.90 Sınıflandırılmamış, 336.90 Sınıflandırılmamış Tahsilatlar", () => {
    const subs = gl.PLAN_SUBS || {};
    assert.equal(subs["600.90"], "Belgesiz");
    assert.equal(subs["770.90"], "Sınıflandırılmamış");
    assert.equal(subs["336.90"], "Sınıflandırılmamış Tahsilatlar");
    // Kitap §2 "602 Diğer Gelirler (.90 Sınıflandırılmamış)" (KG-4 Borç Yaz); KG-2 "600.90 / 610.90" belgesiz satış / müşteri iadesi — 600.90 ile aynı ad.
    assert.equal(subs["602.90"], "Sınıflandırılmamış", "602.90 alt hesap tanımı");
    assert.equal(subs["610.90"], "Belgesiz", "610.90 alt hesap tanımı");
    // 2.5.0 Ç5-A (S49 = A): formdan carisiz alınan evrak 649.90.
    assert.equal(subs["649.90"], "Sınıflandırılmamış", "649.90 alt hesap tanımı (S49)");
    assert.equal(itemOf("336")?.tur, "pasif", "Sınıflandırılmamış Tahsilatlar pasif hesabın altında (KG-3: gelir değil)");
    const taken = new Set([...Object.keys(DOCUMENT_SUB_NAMES), ...Object.keys(gl.UNASSIGNED_SUBS || {}), ...Object.values(UNASSIGNED_SUB)]);
    for (const sub of Object.keys(subs)) {
      assert.match(sub, /^\d{3}\.\d{2}$/, `${sub}: alt hesap biçimi`);
      assert.ok(itemOf(sub.slice(0, 3)), `${sub}: ana hesabı planda`);
      assert.equal(gl.accountOf(sub), itemOf(sub.slice(0, 3)), `${sub}: sınıfı ana hesabınınki`);
      assert.ok(!taken.has(sub), `${sub}: başka bir alt hesap tanımıyla çakışıyor`);
    }
  });

  it("defterin yazabildiği her hesap planda (sınıflanabilir): banka fişi rolleri, evrak, şüpheli alacak, fatura gider türleri, yevmiye kaynağı", () => {
    const used = new Set([
      ...Object.values(ROLE_GL).flat(),
      ...FORBIDDEN_GL,
      ...Object.values(DOCUMENT_GL).flatMap(item => [item.received, item.given]),
      ...Object.values(DOUBTFUL_GL),
      ...Object.values(EXPENSES).map(item => item.account),
      ...["sale", "smm", "sale_return", "purchase", "purchase_return"].flatMap(kind => [lineAccount(kind), lineAccount(kind, { goods: true })]),
    ]);
    // Kaynak taraması: yevmiyeyi kuran iki dosyadaki hesap kodu sabitleri (tırnak içinde üç hane). Bütün metin üzerinde (satır bölünmez; CRLF fark etmez).
    for (const file of ["server/lib/general-ledger.mjs", "server/routes/ledger.mjs"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      for (const [, code] of source.matchAll(/"(\d{3})"/g)) used.add(code);
    }
    const missing = [...used].map(String).filter(code => !Object.hasOwn(gl.CHART, code)).sort();
    assert.deepEqual(missing, [], "defterin yazabildiği ama planda olmayan hesap");
  });
});
