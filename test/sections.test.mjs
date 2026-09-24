// Sekme içindeki alt tabloların (bölümlerin) tanınması: sayfaya özgü değil, yapıya göre.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SECTION_SEPARATOR, hasHeaderWord, matrixToRecords } from "../server/lib/sections.mjs";

const S = SECTION_SEPARATOR;
const labels = result => [...new Set(result.rows.map(row => row.__sheet))];

// Gerçek bir ofis sayfasının yapısı (kişisel bilgiler uydurma): birleşik gri başlıklar, her birinin altında kendi
// kolon başlıkları; üçüncü tablonun kolonları farklı; tarih kolonunda metin (RPÇY), çok satırlı "son durum" hücreleri.
const ONEMLI = [
  ["GAYRİMENKUL SATIŞ DOSYALARI AŞAMALARI", "", "", "", "", "", "", "", "", ""],
  ["SIRA", "ALACAKLI", "BORÇLU", "İCRA", "DOSYA NO", "HACİZ TARİHİ", "SATIŞ TALEBİ TARİHİ", "YATIRILAN AVANS VE TARİHİ", "KIYMET TAKDİRİ TARİHİ", "DOSYANIN SON DURUMU"],
  ["1", "ALACAKLI A", "BORÇLU A", "KONYA 3.MD", "2018/10236", "8.11.2022", "13.01.2023", "800 TL satış avansı yatırıldı.", "YOK", "Borçlunun babasından kalan malların satışı için izale-i şuyu davası açıldı."],
  ["2", "ALACAKLI B", "BORÇLU B", "KONYA 5.MD", "2017/12039", "19.01.2023", "30.11.2023", "Yatırılmadı", "YOK", "Dosya bekletici mesele\nyapıldı"],
  ["3", "ALACAKLI C", "BORÇLU C", "KONYA 7.MD", "2023/9586", "25.08.2023", "17.10.2023", "25.000,00 TL Satış avansı yatırıldı", "15.11.2023", "İHALESİ YAPILDI."],
  ["MENKUL SATIŞ DOSYALARI AŞAMALARI", "", "", "", "", "", "", "", "", ""],
  ["SIRA", "ALACAKLI", "BORÇLU", "İCRA", "DOSYA NO", "HACİZ TARİHİ", "SATIŞ TALEBİ TARİHİ", "YATIRILAN AVANS VE TARİHİ", "KIYMET TAKDİRİ TARİHİ", "DOSYANIN SON DURUMU"],
  ["1", "ALACAKLI D", "BORÇLU D", "KONYA 10.MD", "2022/11263", "RPÇY", "22.12.2022", "3.000,00TL", "", "Rehin paraya çevirilmesi takibi var."],
  ["2", "ALACAKLI E", "BORÇLU E", "KONYA 7.MD", "2023/11023", "26.09.2023", "6.10.2023", "6.300,00TL", "", "Satışına engel durum yok"],
  ["ÇEK CEZASI ÇIKMIŞ ANCAK ÖDEMESİ YAPILMAMIŞ DOSYALAR", "", "", "", "", "", "", "", "", ""],
  ["SIRA", "DOSYA NO", "MÜVEKKİL", "KARŞI TARAF", "T.C.", "MAHKEME", "ESAS", "KARŞILIKSIZ T.", "", "SON DURUM"],
  ["1", "8916", "MÜVEKKİL F", "KARŞI F", "50914526530", "KONYA 2 İCM", "2024/170", "648.000,00", "", "ARANMASI VAR."],
  ["2", "8742", "MÜVEKKİL G", "KARŞI G", "49120856814", "SERİK İCM", "2023/35", "164.000,00", "", "İNFAZA YAZILDI."],
];

describe("alt tablolar (bölümler)", () => {
  it("başlık + kolon başlığı düzenindeki alt tabloları kendi kolonlarıyla ayırır", () => {
    const result = matrixToRecords(ONEMLI, "ÖNEMLİ İCRA DOSYALARI");
    assert.deepEqual(result.sections.map(section => [section.label, section.count]), [
      [`ÖNEMLİ İCRA DOSYALARI${S}GAYRİMENKUL SATIŞ DOSYALARI AŞAMALARI`, 3],
      [`ÖNEMLİ İCRA DOSYALARI${S}MENKUL SATIŞ DOSYALARI AŞAMALARI`, 2],
      [`ÖNEMLİ İCRA DOSYALARI${S}ÇEK CEZASI ÇIKMIŞ ANCAK ÖDEMESİ YAPILMAMIŞ DOSYALAR`, 2],
    ]);
    assert.deepEqual(result.tabs, result.sections.map(section => section.label));
    assert.equal(result.rows.length, 7, "başlık satırları kayıt sayılmamalı");
    assert.ok(result.rows.every(row => row.SIRA !== "SIRA"));
    const menkul = result.rows.find(row => row["DOSYA NO"] === "2022/11263");
    assert.equal(menkul["HACİZ TARİHİ"], "RPÇY", "tarih kolonundaki metin kaybolmamalı");
    const cek = result.rows.find(row => row.ESAS === "2024/170");
    assert.equal(cek.MÜVEKKİL, "MÜVEKKİL F");
    assert.equal(cek["SON DURUM"], "ARANMASI VAR.");
    assert.equal(cek.BORÇLU, undefined, "üçüncü tablonun kolonları farklıdır");
    assert.deepEqual(result.sections[2].columns, ["SIRA", "DOSYA NO", "MÜVEKKİL", "KARŞI TARAF", "T.C.", "MAHKEME", "ESAS", "KARŞILIKSIZ T.", "SON DURUM"]);
    assert.equal(result.rows[1]["DOSYANIN SON DURUMU"], "Dosya bekletici mesele\nyapıldı", "çok satırlı hücre korunur");
  });

  it("tek tablolu sekmede davranış değişmez: ilk satır kolon başlığı, sekme adı aynı", () => {
    const result = matrixToRecords([["DOSYA NO", "BORÇLU", "TUTAR"], ["2026/1", "Ali", "1.000"], ["2026/2", "Ayşe", "2.500"]], "AKTİF");
    assert.deepEqual(labels(result), ["AKTİF"]);
    assert.deepEqual(result.rows[0], { "DOSYA NO": "2026/1", BORÇLU: "Ali", TUTAR: "1.000", __sheet: "AKTİF" });
    assert.deepEqual(result.tabs, ["AKTİF"]);
  });

  it("en üstteki başlık satırı kolon başlığı sanılmaz; tek bölümde sekme adı korunur", () => {
    const result = matrixToRecords([["AKTİF İCRA DOSYALARI", ""], [], ["SIRA", "DOSYA NO"], ["1", "2026/7"], ["2", "2026/8"]], "AKTİF");
    assert.deepEqual(labels(result), ["AKTİF"]);
    assert.deepEqual(result.rows.map(row => row["DOSYA NO"]), ["2026/7", "2026/8"]);
    assert.equal(result.sections[0].title, "AKTİF İCRA DOSYALARI");
  });

  it("aynı kolonlar içindeki grup satırlarını alt başlık yapar", () => {
    const matrix = [
      ["NO", "AD SOYAD", "TUTAR"],
      ["MUHASEBE"],
      ["1", "Ali Kaya", "1.000"],
      ["2", "Veli Can", "2.000"],
      ["HUKUK"],
      ["3", "Ayşe Nur", "500"],
    ];
    const result = matrixToRecords(matrix, "PERSONEL");
    assert.deepEqual(labels(result), [`PERSONEL${S}MUHASEBE`, `PERSONEL${S}HUKUK`]);
    assert.deepEqual(result.rows.map(row => row["AD SOYAD"]), ["Ali Kaya", "Veli Can", "Ayşe Nur"]);
  });

  it("tek bir yarım kaydı veya adla başlayan satırı grup başlığı sanmaz", () => {
    const matrix = [
      ["AD SOYAD", "TELEFON", "DOSYA NO"],
      ["Ali Kaya", "0532 000 00 00", "2026/1"],
      ["Veli Can"],
      ["Ayşe Nur", "0533 000 00 00", "2026/3"],
    ];
    const result = matrixToRecords(matrix, "LİSTE");
    assert.deepEqual(labels(result), ["LİSTE"]);
    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[1]["AD SOYAD"], "Veli Can");
  });

  it("araya yeniden konmuş aynı kolon başlığını kayıt saymaz, tabloyu bölmez", () => {
    const matrix = [["SIRA", "DOSYA NO", "BORÇLU"], ["1", "2026/1", "A"], ["SIRA", "DOSYA NO", "BORÇLU"], ["2", "2026/2", "B"]];
    const result = matrixToRecords(matrix, "AKTİF");
    assert.deepEqual(labels(result), ["AKTİF"]);
    assert.deepEqual(result.rows.map(row => row.SIRA), ["1", "2"]);
  });

  it("İngilizce ve genel başlıklarla da çalışır (sayfaya özgü değil)", () => {
    const matrix = [
      ["Accounting"],
      ["Name", "Email", "Phone", "Due date"],
      ["John Smith", "john@example.com", "555 0101", "01.10.2026"],
      ["Legal"],
      ["Name", "Email", "Phone", "Due date"],
      ["Jane Roe", "jane@example.com", "555 0102", "02.10.2026"],
    ];
    const result = matrixToRecords(matrix, "Contacts");
    assert.deepEqual(labels(result), [`Contacts${S}Accounting`, `Contacts${S}Legal`]);
    assert.equal(result.rows[1].Email, "jane@example.com");
  });

  it("emin olunamayan düzende (tanıdık başlık yok, veri yok) tabloyu bölmez", () => {
    const matrix = [["Alfa", "Beta", "Gama"], ["x", "y", "z"], ["Başka"], ["q", "w", "e"]];
    const result = matrixToRecords(matrix, "Sekme");
    assert.deepEqual(labels(result), ["Sekme"]);
    assert.equal(result.rows.length, 3);
  });

  it("başlığı boş ama verisi olan kolonu kaybetmez, aynı adlı kolonları ayırır", () => {
    const result = matrixToRecords([["DOSYA NO", "", "TARİH", "TARİH"], ["2026/1", "not", "01.01.2026", "02.01.2026"]], "A");
    assert.deepEqual(result.rows[0], { "DOSYA NO": "2026/1", "Kolon 2": "not", TARİH: "01.01.2026", "TARİH (2)": "02.01.2026", __sheet: "A" });
  });

  it("sekme adı yoksa bölüm adları tek başına etiket olur; başlıksız bölüm numaralanır", () => {
    const matrix = [
      ["SIRA", "DOSYA NO", "BORÇLU"],
      ["1", "2026/1", "A"],
      ["ÖDEMELER"],
      ["SIRA", "ÖDEME TARİHİ", "TUTAR"],
      ["1", "01.02.2026", "1.500,00"],
    ];
    const result = matrixToRecords(matrix, "");
    assert.deepEqual(labels(result), ["Bölüm 1", "ÖDEMELER"]);
  });

  it("başlık kelimesi tanıma Türkçe ekleri ve harf farklarını kapsar", () => {
    for (const text of ["HACİZ TARİHİ", "DOSYANIN SON DURUMU", "T.C.", "Borclu", "KARŞILIKSIZ T.", "Customer names"]) assert.ok(hasHeaderWord(text), text);
    for (const text of ["AYÇA SÜT", "KONYA", "Hızır Usta"]) assert.ok(!hasHeaderWord(text), text);
  });

  it("çok satırlı sekmede çağrı yığını taşmaz ve süre makul kalır", () => {
    const matrix = [["DOSYA NO", "BORÇLU", "DURUM"]];
    for (let index = 0; index < 150_000; index += 1) matrix.push([`2024/${index}`, `Borçlu ${index}`, index % 2 ? "Derdest" : "Kapalı"]);
    const started = performance.now();
    const result = matrixToRecords(matrix, "Büyük");
    assert.equal(result.rows.length, 150_000);
    assert.deepEqual(result.tabs, ["Büyük"]);
    assert.ok(performance.now() - started < 10_000, "150.000 satır 10 sn içinde ayrıştırılır");
  });

  it("boş veya bozuk girdide hata vermez", () => {
    assert.deepEqual(matrixToRecords([], "X"), { rows: [], tabs: ["X"], sections: [] });
    assert.deepEqual(matrixToRecords(null, "").rows, []);
    assert.equal(matrixToRecords([["TEK BAŞLIK"], ["veri"]], "X").rows.length, 1);
  });
});
