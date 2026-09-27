// Veri Sağlık Kontrolü — toplu düzeltme önerileri (v2.0.2).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalAmount, canonicalDate, canonicalPhone, proposeFixes, summarizeFix } from "../server/lib/insight/fixes.mjs";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";

describe("toplu düzeltme önerileri", () => {
  it("telefon, tarih ve tutar tek yazıma çevrilir; belirsiz yazım önerilmez", () => {
    assert.equal(canonicalPhone("5321112233"), "0532 111 22 33");
    assert.equal(canonicalPhone("+90 (532) 111-11-11"), "0532 111 11 11");
    assert.equal(canonicalPhone("0532 111 11 11"), "0532 111 11 11");
    assert.equal(canonicalPhone("0212 444 44 44"), null, "sabit hat cep biçimine çevrilmez");
    assert.equal(canonicalDate("5.3.2024"), "05.03.2024");
    assert.equal(canonicalDate("2024-03-05 14:30"), "05.03.2024 14:30");
    assert.equal(canonicalDate("5 Mart 2024"), "05.03.2024");
    assert.equal(canonicalDate("31.02.2026"), null);
    assert.equal(canonicalAmount("1,500.00"), "1.500,00");
    assert.equal(canonicalAmount("$12,345.60"), "$12.345,60");
    assert.equal(canonicalAmount("1.500"), null, "tek ayraçlı yazım belirsizdir");
    assert.equal(canonicalAmount("1.500,00 TL"), null, "zaten Türkçe");
  });

  it("analizden öneri üretir: telefon yazımı, tarih yazımı, durum yazımı, boşluk; değişiklikler kayıt anahtarıyla döner", () => {
    const rows = [
      { __hofKey: "1", Müvekkil: "Ali  Veli ", Telefon: "5321111111", Vade: "5.3.2027", Durum: "aktif" },
      { __hofKey: "2", Müvekkil: "Ayşe Kaya", Telefon: "0533 222 22 22", Vade: "06.03.2027", Durum: "Aktif" },
      { __hofKey: "3", Müvekkil: "Can Er", Telefon: "+90 534 333 33 33", Vade: "2027-03-07", Durum: "Aktif" },
      { __hofKey: "4", Müvekkil: "Deniz Ay", Telefon: "0535 444 44 44", Vade: "08.03.2027", Durum: "PASİF" },
      { __hofKey: "5", Müvekkil: "Ece Ak", Telefon: "0536 555 55 55", Vade: "09.03.2027", Durum: "Pasif" },
    ];
    const analyses = analyzeColumns(rows, ["Müvekkil", "Telefon", "Vade", "Durum"], { now: new Date("2026-09-27") });
    const fixes = proposeFixes({ rows, analyses });
    const byId = Object.fromEntries(fixes.map(fix => [fix.id, fix]));
    assert.deepEqual(Object.keys(byId).sort(), ["date:Vade", "phone:Telefon", "space:Müvekkil", "status:Durum"]);
    assert.equal(byId["phone:Telefon"].count, 2);
    assert.deepEqual(byId["phone:Telefon"].changes.map(item => [item.key, item.value]), [["1", "0532 111 11 11"], ["3", "0534 333 33 33"]]);
    assert.deepEqual(byId["date:Vade"].changes.map(item => [item.key, item.value]), [["1", "05.03.2027"], ["3", "07.03.2027"]]);
    // "Aktif" 2, "aktif" 1 → Aktif; "PASİF" 1, "Pasif" 1 → alfabetik "Pasif"
    assert.deepEqual(byId["status:Durum"].changes.map(item => [item.key, item.value]), [["1", "Aktif"], ["4", "Pasif"]]);
    assert.deepEqual(byId["space:Müvekkil"].changes, [{ key: "1", field: "Müvekkil", value: "Ali Veli", previous: "Ali  Veli " }]);
    const summary = summarizeFix(byId["phone:Telefon"]);
    assert.ok(!("changes" in summary) && summary.samples.length === 2 && /2 telefon/.test(summary.title));
  });

  it("Excel'de sayıya dönüşmüş telefon kolonuna yazım önerisi verilmez (rakamlar dosyada yok)", () => {
    const rows = [
      { __hofKey: "1", Öğrenci: "Ada", "Veli Telefon": "5.32E+09" },
      { __hofKey: "2", Öğrenci: "Efe", "Veli Telefon": "5.33E+09" },
      { __hofKey: "3", Öğrenci: "Zeynep", "Veli Telefon": "5324441122" },
    ];
    const analyses = analyzeColumns(rows, ["Öğrenci", "Veli Telefon"], { now: new Date("2026-09-27") });
    assert.equal(analyses[1].warning, "scientific");
    assert.deepEqual(proposeFixes({ rows, analyses }).map(fix => fix.id), []);
  });
});
