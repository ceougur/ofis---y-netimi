// Şemaya esnek uyum — kolon eşleme (v2.0.2).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchColumns, renameKeys } from "../server/lib/schema-map.mjs";

describe("kolon eşleme", () => {
  it("yeniden adlandırılan, eklenen ve kaldırılan kolonları ayırır; aynı adlar aynen eşlenir", () => {
    const result = matchColumns(["Dosya No", "Müvekkil", "Tel", "Tutar", "Not"], ["Dosya No", "Müvekkil Adı", "Telefon", "Tutar", "E-posta"]);
    assert.deepEqual(result.same, ["Dosya No", "Tutar"]);
    assert.deepEqual(result.renamed.map(item => [item.from, item.to]), [["Müvekkil", "Müvekkil Adı"]]);
    assert.deepEqual(result.added, ["Telefon", "E-posta"]);
    assert.deepEqual(result.removed, ["Tel", "Not"]);
  });

  it("değer örtüşmesi ad benzemese de eşler; yazım düzeltmesi ve büyük/küçük harf farkı eşlenir", () => {
    const prevValues = new Map([["Müvekkil", ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ay"]], ["Şehir", ["İstanbul", "Ankara", "İzmir"]]]);
    const nextValues = new Map([["Cari", ["Ali Veli", "Ayşe Kaya", "Can Er", "Ece Ak"]], ["İl", ["İstanbul", "Ankara", "Bursa"]]]);
    const result = matchColumns(["Müvekkil", "Şehir"], ["Cari", "İl"], { prevValues, nextValues });
    assert.deepEqual(result.renamed.map(item => [item.from, item.to, item.why]), [["Müvekkil", "Cari", "aynı değerler"], ["Şehir", "İl", "aynı değerler"]]);
    const typo = matchColumns(["Müvekil", "TUTAR"], ["Müvekkil", "Tutar"]);
    assert.deepEqual(typo.same, ["Tutar"].filter(() => false), "büyük/küçük harf farkı 'aynı ad' değil katlanmış ad eşlemesidir");
    assert.deepEqual(typo.renamed.map(item => [item.from, item.to]).sort(), [["Müvekil", "Müvekkil"], ["TUTAR", "Tutar"]]);
  });

  it("her kolon en çok bir kolonla eşlenir; benzemeyenler eşlenmez", () => {
    const result = matchColumns(["Ad", "Soyad"], ["Ad Soyad", "Doğum tarihi"]);
    assert.deepEqual(result.renamed.map(item => [item.from, item.to]), [["Soyad", "Ad Soyad"]], "kapsayan ad eşlenir; öteki kolon kalkar");
    assert.deepEqual(result.removed, ["Ad"]);
    assert.deepEqual(result.added, ["Doğum tarihi"]);
    assert.deepEqual(matchColumns(["Tutar"], ["Vade"]).renamed, []);
  });

  it("kayıt anahtarları eşlemeye göre yeniden adlandırılır; hedef ad zaten varsa dokunulmaz", () => {
    const renamed = [{ from: "Müvekkil", to: "Müvekkil Adı" }];
    assert.deepEqual(renameKeys({ Müvekkil: "Ali", Tutar: "1", __sheet: "S" }, renamed), { "Müvekkil Adı": "Ali", Tutar: "1", __sheet: "S" });
    assert.deepEqual(renameKeys({ Müvekkil: "Ali", "Müvekkil Adı": "Ayşe" }, renamed), { Müvekkil: "Ali", "Müvekkil Adı": "Ayşe" });
  });
});
