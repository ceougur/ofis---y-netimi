// Doğrulanmış özet kartları (v1.7.0): hücre okuma, sabit seçenek süzgeçleri, kart doğrulaması (tutar, tarih, dağılım),
// veri sağlığındaki hücre denetimleri, sekmelere göre kapsam ve uygulamada eklenen kayıtların sekmesi.
// Genel ilke: kart, kapsamındaki her hücre tek tek okunup söylediği şey kesinleşmedikçe gösterilmez.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeDataset } from "../server/lib/insight/analyze.mjs";
import { buildCards, verifyDates, verifyMoney, verifyVocabulary } from "../server/lib/insight/cards.mjs";
import { embeddedDates, isTotalRow, phonesIn, readCell } from "../server/lib/insight/cells.mjs";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { assessQuality } from "../server/lib/insight/quality.mjs";
import { percentOf, withPossessive } from "../server/lib/insight/text.mjs";
import { assessVocabulary, overlapReason } from "../server/lib/insight/vocabulary.mjs";
import { columnOrder } from "../server/lib/sources.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = new Date(2026, 9, 10, 15, 0); // 10.10.2026
const day = offset => {
  const date = new Date(2026, 9, 10 + offset);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};
const repeat = (list, length) => Array.from({ length }, (_, index) => list[index % list.length]);
const column = (name, values, extra = {}) => values.map((value, index) => ({ __sheet: "Sekme", __hofKey: `K${index}`, ...extra, [name]: value }));
const cardsOf = (rows, now = NOW) => buildCards(rows, analyzeColumns(rows, columnOrder(rows), { now }), { now });

describe("hücre okuma", () => {
  it("tek tarih, tarih + not, birden çok tarih, tutar, tutar + not, telefon, etiket ve not ayrılır", () => {
    assert.equal(readCell("15.10.2026").kind, "date");
    assert.equal(readCell("2026-10-15 14:30").kind, "date");
    assert.equal(readCell("31.02.2026").kind, "mixed", "takvimde olmayan tarih tarih sayılmaz");
    assert.equal(readCell("12.03.2025 tebliğ").kind, "mixed");
    assert.equal(readCell("12.03.2025 tebliğ").dates.length, 1);
    assert.equal(embeddedDates("1.12.2025 - 5.12.2025").length, 2);
    assert.equal(embeddedDates("1.500.000 TL").length, 0, "binlik ayraçlı tutar tarih değildir");
    assert.equal(readCell("40.000,00 TL").kind, "amount");
    assert.equal(readCell("40.000,00 TL").currency, "TRY");
    assert.equal(readCell("1.500 TL + faiz").kind, "mixed");
    assert.equal(readCell("12345678901").identifier, true, "ayraçsız 11 hane tutar değil kimliktir");
    assert.equal(readCell("0532 101 11 11").kind, "phone");
    assert.equal(readCell("Tebliğ edildi").kind, "label");
    assert.equal(readCell("Borçlu adreste bulunamadı, komşuya bırakıldı ve iade edildi").kind, "text");
    for (const empty of ["", " ", "-", "—", "?", "..."]) assert.equal(readCell(empty).kind, "empty", JSON.stringify(empty));
  });

  it("telefon: birden çok numara ve numaranın yanındaki not geçerli; eksik haneli numara geçersiz", () => {
    assert.deepEqual(phonesIn("0532 101 11 11 / 0212 555 44 33"), { valid: 2, invalid: 0 });
    assert.deepEqual(phonesIn("0532 101 11 11 - 0212 555 44 33"), { valid: 2, invalid: 0 });
    assert.deepEqual(phonesIn("0532 101 11 11 (eşi)"), { valid: 1, invalid: 0 });
    assert.deepEqual(phonesIn("0532 101 11"), { valid: 0, invalid: 1 });
  });

  it("toplam satırı tanınır", () => {
    assert.equal(isTotalRow({ A: "GENEL TOPLAM", TUTAR: "10.000" }, "TUTAR"), true);
    assert.equal(isTotalRow({ A: "Toplam", TUTAR: "10.000" }, "TUTAR"), true);
    assert.equal(isTotalRow({ A: "Toplam 3 dosya", TUTAR: "10.000" }, "TUTAR"), false);
    assert.equal(isTotalRow({ A: "Ayşe Kaya", TUTAR: "10.000" }, "TUTAR"), false);
  });

  it("Türkçe yüzde ekleri", () => {
    assert.equal(percentOf(83, 100), "%83'ü");
    assert.equal(percentOf(17, 100), "%17'si");
    assert.equal(percentOf(40, 100), "%40'ı");
    assert.equal(percentOf(1, 1), "%100'ü");
    assert.equal(percentOf(199, 200), "%99,5'i");
    assert.equal(percentOf(1999, 2000), "%99,9'u", "yuvarlama yukarı değil: kesin olmayan varken %100 yazılmaz");
    assert.equal(withPossessive("6"), "6'sı");
  });
});

describe("sabit seçenek süzgeçleri", () => {
  const ok = (values, options) => assessVocabulary(values, options);

  it("serbest yazılmış kolon (aynı anlam farklı biçimlerde, tarih ve notlarla) dağılım olarak kabul edilmez", () => {
    const messy = repeat(["tebliğ", "Tebliğ edildi", "her ikisinde tebliğ", "12.03.2025", "bila", "iade", "tebliğ", "12.03.2025 tebliğ", "tebliğ"], 90);
    const verdict = ok(messy);
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /sabit seçeneklerin dışında/);
    assert.match(verdict.reason, /tarih/);
    assert.match(verdict.reason, /birbirini içeriyor/, "somut örnek: bir seçenek diğerini içeriyor");
    const noDates = ok(repeat(["tebliğ", "Tebliğ edildi", "her ikisinde tebliğ", "bila"], 80));
    assert.equal(noDates.ok, false);
    assert.equal(noDates.code, "overlap");
  });

  it("birbirini içeren, aynı kökten, yazım farklı ve eş anlamlı seçenekler örtüşür", () => {
    assert.equal(overlapReason("teblig", "her ikisinde teblig"), "içeriyor");
    assert.equal(overlapReason("acik", "acik dosya"), "içeriyor");
    assert.equal(overlapReason("haciz", "hacizli"), "kök");
    assert.equal(overlapReason("kapandi", "kapali"), "kök");
    assert.equal(overlapReason("derdest", "derdset"), "yazım");
    assert.equal(overlapReason("beklemede", "bekliyor"), "eş anlam");
    assert.equal(overlapReason("acik", "aktif"), "eş anlam");
  });

  it("olumsuzluk ve sayı farkı bir ayrımdır: seçenekler ayrı sayılır", () => {
    for (const [a, b] of [
      ["odendi", "odenmedi"],
      ["teblig edildi", "teblig edilemedi"],
      ["teblig edildi", "teblig edilmedi"],
      ["uygun", "uygun degil"],
      ["teblig", "bila teblig"],
      ["ilamli", "ilamsiz"],
      ["onaylandi", "onaylanmadi"],
      ["1 asama", "2 asama"],
      ["istanbul 5 icra dairesi", "istanbul 6 icra dairesi"],
      ["satildi", "satista"],
      ["odeme bekliyor", "evrak bekliyor"],
      ["takip devam ediyor", "haciz asamasinda"],
    ]) {
      assert.equal(overlapReason(a, b), null, `${a} / ${b}`);
    }
  });

  it("temiz seçenek listesi kabul edilir; büyük/küçük harf, Türkçe karakter ve noktalama aynı seçenektir", () => {
    const verdict = ok(repeat(["Derdest", "DERDEST", "derdest.", "Haciz aşamasında", "Kapandı", "Ödeme sözü alındı"], 60));
    assert.equal(verdict.ok, true, verdict.reason);
    assert.equal(verdict.labels.length, 4);
    assert.equal(verdict.labels[0].count, 30, "üç yazım tek seçenek");
    assert.ok(["Derdest", "DERDEST", "derdest."].includes(verdict.labels[0].value));
  });

  it("kesinlik: hücrelerin en az %98'i bir seçenek olmalı (fazlası 'diğer' olarak yazılır)", () => {
    const base = repeat(["Açık", "Kapalı"], 99);
    const one = ok([...base, "bilinmiyor 12.03"]);
    assert.equal(one.ok, true);
    assert.equal(one.other, 1);
    const three = ok([...repeat(["Açık", "Kapalı"], 97), "x1 not", "y2 not", "z3 not"]);
    assert.equal(three.ok, false);
    assert.equal(three.code, "freetext");
  });

  it("tek değer, az hücre, çok fazla seçenek ve sayı kodları dağılım değildir", () => {
    assert.equal(ok(repeat(["Açık"], 20)).code, "single");
    assert.equal(ok(["Açık", "Kapalı", "Açık"]).code, "few");
    assert.equal(ok(Array.from({ length: 60 }, (_, i) => `Şube ${String.fromCharCode(65 + (i % 20))}`)).code, "many");
    assert.equal(ok(repeat(["Şube A", "Şube B", "Şube C"], 30)).ok, true, "tek harf farkı bir yazım hatası değil, ayrı seçenek");
    assert.equal(ok(repeat(["1", "2", "3"], 30)).code, "numeric");
  });

  it("sorumlu kişiler: unvanlı/unvansız ve kısaltılmış adlar aynı kişi olabilir; birden çok kişi yazılmış hücre kişi değildir", () => {
    const person = { maxLabels: 40, singletons: true, person: true };
    const clean = ok(repeat(["Av. Ayşe Kaya", "Av. Mehmet Öz", "Stj. Av. Can Demir", "Zeynep Arslan"], 40), person);
    assert.equal(clean.ok, true, clean.reason);
    assert.equal(clean.labels.length, 4);
    const titled = ok(repeat(["Av. Ayşe Kaya", "Ayşe Kaya", "Mehmet Öz"], 30), person);
    assert.equal(titled.ok, false);
    assert.equal(titled.code, "overlap");
    const initials = ok(repeat(["Ayşe Kaya", "A. Kaya", "Mehmet Öz"], 30), person);
    assert.equal(initials.ok, false);
    const multi = ok(repeat(["Ayşe Kaya", "Mehmet Öz", "Ayşe Kaya / Mehmet Öz"], 30), person);
    assert.equal(multi.ok, false);
    assert.match(multi.reason, /kişi adı olmayan değer/);
  });
});

describe("kart doğrulaması", () => {
  it("tutar: yalnız tutarlar toplanır; not hücreleri ve toplam satırı katılmaz, açıklamada yazar", () => {
    const rows = column("TUTAR", [...Array.from({ length: 20 }, (_, i) => `${(i + 1) * 100},00 TL`), "ödendi", ""]);
    rows.push({ __sheet: "Sekme", __hofKey: "T", AD: "GENEL TOPLAM", TUTAR: "21.000,00 TL" });
    const result = verifyMoney(rows, "TUTAR");
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.card.sum, 21000);
    assert.equal(result.card.count, 20);
    assert.equal(result.card.text, 1);
    assert.equal(result.card.totals, 1);
    assert.equal(result.card.empty, 1);
    assert.equal(result.card.currency, "TRY");
    assert.ok(result.card.explain.some(line => /tutar yerine yazı var/.test(line) && /“ödendi”/.test(line)));
    assert.ok(result.card.explain.some(line => /Toplam” satırı/.test(line)));
  });

  it("tutar: tutarı başka bilgiyle karışık hücreler %2'yi aşarsa toplam gösterilmez; kimlik gibi değer toplanmaz", () => {
    const mixed = column("TUTAR", [...Array.from({ length: 30 }, (_, i) => `${1000 + i} TL`), "1.500 TL + faiz", "2.000 / 3.000", "yaklaşık 5 bin"]);
    const rejected = verifyMoney(mixed, "TUTAR");
    assert.equal(rejected.ok, false);
    assert.match(rejected.reason, /başka bilgiyle karışık/);
    assert.ok(rejected.examples.includes("1.500 TL + faiz"));
    const withId = column("TUTAR", [...Array.from({ length: 60 }, (_, i) => `${1000 + i} TL`), "12345678901"]);
    const accepted = verifyMoney(withId, "TUTAR");
    assert.equal(accepted.ok, true, "tek kimlik benzeri değer %2'nin altında: kesin okunamayan olarak yazılır");
    assert.equal(accepted.card.unclear, 1);
    assert.equal(accepted.card.sum, Array.from({ length: 60 }, (_, i) => 1000 + i).reduce((a, b) => a + b, 0), "kimlik tutar diye toplanmadı");
  });

  it("tutar: para birimi yazılı değilse birimsiz; başlıkta yazıyorsa başlıktan", () => {
    assert.equal(verifyMoney(column("TUTAR", ["100", "200", "300"]), "TUTAR").card.currency, null);
    assert.equal(verifyMoney(column("TUTAR (USD)", ["100", "200", "300"]), "TUTAR (USD)").card.currency, "USD");
  });

  it("son tarih: not hücreleri sayılmaz; tarih + not ya da iki tarihli hücreler %2'yi aşarsa kart gösterilmez", () => {
    const item = { column: "SON ÖDEME TARİHİ", strong: true };
    const clean = verifyDates(column(item.column, [day(0), day(3), day(6), day(20), day(-4), "belli değil", ""]), item, NOW, "deadline");
    assert.equal(clean.ok, true, clean.reason);
    assert.deepEqual([clean.card.today, clean.card.next7, clean.card.next30, clean.card.passed, clean.card.notes, clean.card.empty], [1, 3, 4, 1, 1, 1]);
    const messy = verifyDates(column(item.column, [...Array.from({ length: 20 }, (_, i) => day(i)), `${day(2)} ertelendi`, `${day(1)} ve ${day(9)}`]), item, NOW, "deadline");
    assert.equal(messy.ok, false);
    assert.match(messy.reason, /hangi tarihin esas alınacağı kesin değil/);
    const impossible = verifyDates(column(item.column, [day(1), day(2), day(3), "31.02.2026"]), item, NOW, "deadline");
    assert.equal(impossible.ok, false, "takvimde olmayan tarih kesin değildir");
  });

  it("dağılım kartı: temiz durum kolonu gösterilir, serbest yazılmış kolon gösterilmez ve nedeni yazılır", () => {
    const statuses = repeat(["Takip devam ediyor", "Haciz aşamasında", "Kapandı"], 30);
    const clean = verifyVocabulary(column("DURUM", statuses), "DURUM", "status");
    assert.equal(clean.ok, true);
    assert.deepEqual(clean.card.labels.map(label => label.count), [10, 10, 10]);
    const messy = verifyVocabulary(column("TEBLİĞ DURUMU", repeat(["tebliğ", "Tebliğ edildi", "her ikisinde tebliğ", "12.03.2025"], 40)), "TEBLİĞ DURUMU", "status");
    assert.equal(messy.ok, false);
  });

  it("kapsamın kartları: kolon adıyla, öncelik sırasıyla; doğrulanamayan aday reddedilenlere yazılır", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      __sheet: "İcra",
      __hofKey: `2026/${i}`,
      "DOSYA NO": `2026/${i}`,
      BORÇLU: `Borçlu ${i} Kişi`,
      TUTAR: `${1000 + i},00 TL`,
      "ÖDEME SÖZÜ": i % 2 ? day(i % 9) : "",
      "TEBLİĞ DURUMU": ["tebliğ", "Tebliğ edildi", "her ikisinde tebliğ", "12.03.2025 tebliğ", "bila"][i % 5],
      "DOSYA DURUMU": ["Derdest", "Haciz aşamasında", "Kapandı"][i % 3],
    }));
    const { cards, rejected, month } = cardsOf(rows);
    assert.deepEqual(cards.map(card => [card.id, card.column]), [["money", "TUTAR"], ["deadline", "ÖDEME SÖZÜ"], ["status", "DOSYA DURUMU"]]);
    const teblig = rejected.find(item => item.column === "TEBLİĞ DURUMU");
    assert.ok(teblig, "tebliğ kolonu değerlendirildi ve reddedildi");
    assert.ok(teblig.reason.length > 20);
    assert.deepEqual(month, { column: "ÖDEME SÖZÜ", count: 15, card: "deadline" });
    for (const card of cards) assert.ok(card.explain.length >= 2, `${card.id} açıklaması`);
  });

  it("her sekme kendi kolonlarıyla: bir sekmede temiz olan kolon diğer sekmedeki karışık değerlerden etkilenmez", () => {
    const clean = Array.from({ length: 20 }, (_, i) => ({ __sheet: "Aktif", __hofKey: `A${i}`, "DOSYA NO": `2026/${i}`, DURUM: ["Açık", "Kapalı"][i % 2], TUTAR: `${100 + i} TL` }));
    const messy = Array.from({ length: 20 }, (_, i) => ({ __sheet: "Arşiv", __hofKey: `B${i}`, "ÇEK NO": `Ç-${i}`, DURUM: [`${day(-i)} kapandı`, "kapandı sayılır", "?"][i % 3], "KARŞILIKSIZ TUTAR": `${500 + i} TL` }));
    const analysis = analyzeDataset({ rows: [...clean, ...messy], tabs: ["Aktif", "Arşiv"], now: NOW });
    const { scopes } = analysis.kpis;
    assert.ok(scopes.Aktif.cards.some(card => card.id === "status" && card.column === "DURUM"));
    assert.ok(!scopes["Arşiv"].cards.some(card => card.column === "DURUM"));
    assert.equal(scopes.Aktif.columnCount, 3, "Aktif sekmesi yalnızca kendi kolonlarıyla");
    assert.equal(scopes["Arşiv"].columnCount, 3);
    assert.equal(analysis.quality.checked, scopes.Aktif.quality.checked + scopes["Arşiv"].quality.checked, "genel veri sağlığı sekmelerin toplamı");
  });
});

describe("veri sağlığı: hücre denetimleri", () => {
  it("not yazılmış tarih/tutar/telefon hücresi hata sayılmaz; iki numaralı telefon ve notlu T.C. geçerlidir", () => {
    const special = {
      0: { TELEFON: "0532 101 11 11 / 0212 555 44 33" },
      1: { TELEFON: "0532 101 11 12 (eşi)" },
      2: { TELEFON: "numara yok" },
      3: { TELEFON: "0532 12" },
      4: { "SON ÖDEME TARİHİ": "ertelendi" },
      5: { "SON ÖDEME TARİHİ": "31.02.2026" },
      6: { TUTAR: "ödendi" },
      7: { TUTAR: "1.500 TL + faiz" },
      8: { "T.C. KİMLİK NO": "10000000146 (eşi)" },
      9: { "T.C. KİMLİK NO": "10000000147" },
    };
    const rows = Array.from({ length: 30 }, (_, i) => ({
      __sheet: "S",
      __hofKey: `K${i}`,
      "DOSYA NO": `2026/${i}`,
      TELEFON: `0532 101 ${String(10 + (i % 80)).padStart(2, "0")} ${String(10 + i).padStart(2, "0")}`,
      "SON ÖDEME TARİHİ": day(i % 20),
      TUTAR: `${1000 + i} TL`,
      "T.C. KİMLİK NO": "10000000146",
      ...special[i],
    }));
    const analyses = analyzeColumns(rows, columnOrder(rows), { now: NOW });
    assert.deepEqual(["TELEFON", "SON ÖDEME TARİHİ", "TUTAR", "T.C. KİMLİK NO"].map(name => analyses.find(item => item.column === name).role), ["phone", "date", "money", "tckn"]);
    const quality = assessQuality(rows, analyses, { id: "DOSYA NO", person: null });
    const itemsOf = prefix => quality.issues.find(issue => issue.id.startsWith(prefix))?.items.map(item => item.key) || [];
    assert.deepEqual(itemsOf("invalid-phone"), ["K3"]);
    assert.deepEqual(itemsOf("invalid-date"), ["K5"]);
    assert.deepEqual(itemsOf("invalid-money"), ["K7"]);
    assert.deepEqual(itemsOf("invalid-tckn"), ["K9"]);
  });

  it("bir kaydı birden çok satırda tutan tablo (taraflar alt alta) tekrar eden kimlik hatası vermez", () => {
    const rows = [];
    for (let file = 1; file <= 10; file += 1) for (const role of ["Asıl borçlu", "Kefil"]) rows.push({ __sheet: "S", __hofKey: `2025/${file}`, "DOSYA NO": `2025/${file}`, TARAF: role, "AD SOYAD": `Kişi ${file} ${role}` });
    const analyses = analyzeColumns(rows, columnOrder(rows));
    const quality = assessQuality(rows, analyses, { id: "DOSYA NO", person: "AD SOYAD" });
    assert.ok(!quality.issues.some(issue => issue.id === "duplicate-id"));
    assert.ok(quality.issues.some(issue => issue.id === "repeated-id" && issue.severity === "info"));
    assert.equal(quality.score, 100);
  });
});

describe("sekmeler ve uygulamada eklenen kayıtlar", () => {
  const view = async client => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`)).data.result.data.json;

  it("kayıt eklendiği sekmede; sekmesiz eski kayıt alanlarının örtüştüğü sekmede; hiçbiriyle örtüşmeyen ayrı sekmede görünür", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const icra = [["DOSYA NO", "BORÇLU", "İCRA DAİRESİ"], ["2026/1", "Ali Veli", "İstanbul 1. İcra"], ["2026/2", "Ayşe Kaya", "İstanbul 2. İcra"]];
      const cek = [["ÇEK NO", "MÜVEKKİL", "KARŞILIKSIZ TUTAR"], ["Ç-1", "Örnek A.Ş.", "10.000 TL"]];
      const staged = (await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "ofis.xlsx", sheets: [{ name: "İcra", matrix: icra }, { name: "Çek", matrix: cek }] })).data.data;
      assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" })).status, 200);

      const columns = (await admin.get(`/api/workspace/sources/columns?tab=${encodeURIComponent("Çek")}`)).data.data;
      assert.deepEqual(columns.columns, ["ÇEK NO", "MÜVEKKİL", "KARŞILIKSIZ TUTAR"], "yeni kayıt formu yalnızca o sekmenin kolonları");
      assert.equal((await admin.get("/api/workspace/sources/columns")).data.data.columns.length, 6);

      const inTab = await admin.post("/api/workspace/records", { values: { "ÇEK NO": "Ç-2", MÜVEKKİL: "Deneme Ltd." }, caseKey: "Ç-2", sheet: "Çek" });
      assert.equal(inTab.status, 200);
      assert.equal(inTab.data.data.sheet, "Çek");
      // 1.6 ve öncesinde sekmesiz eklenmiş kayıtlar (sheet gönderilmeden):
      await admin.post("/api/workspace/records", { values: { "DOSYA NO": "2026/3", BORÇLU: "Can Demir" }, caseKey: "2026/3" });
      await admin.post("/api/workspace/records", { values: { "NOT": "Genel hatırlatma" }, caseKey: "N-1" });

      const data = await view(admin);
      const tabOf = key => data.rows.find(row => row.__hofKey === key)?.__sheet;
      assert.equal(tabOf("Ç-2"), "Çek");
      assert.equal(tabOf("2026/3"), "İcra", "alanları İcra sekmesiyle örtüşüyor");
      assert.equal(tabOf("N-1"), "Uygulamada eklenenler");
      assert.deepEqual(data.tabs.map(tab => tab.title), ["İcra", "Çek", "Uygulamada eklenenler"]);

      const analysis = (await admin.get("/api/workspace/insight")).data.data.analysis;
      assert.deepEqual(analysis.kpis.order, ["İcra", "Çek", "Uygulamada eklenenler"]);
      assert.equal(analysis.kpis.scopes["Çek"].total, 2);
    } finally {
      await server.close();
    }
  });

  it("sekmesiz veride kayıtlar sekmesiz kalır", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      await admin.post("/api/workspace/records", { values: { AD: "Ali", TELEFON: "0532 101 11 11" }, caseKey: "A-1" });
      const data = await view(admin);
      assert.equal(data.rows.length, 1);
      assert.equal(data.rows[0].__sheet, undefined);
      assert.deepEqual(data.tabs, []);
    } finally {
      await server.close();
    }
  });
});
