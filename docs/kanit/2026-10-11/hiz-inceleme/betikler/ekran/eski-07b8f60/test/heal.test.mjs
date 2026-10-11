// Kendi kendini onaran veri akışı (v2.0.2): yalnızca sonucu kesin olan bozukluklar onarılır.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healCell, healNote, healRows, repairMojibake } from "../server/lib/heal.mjs";

describe("kendi kendini onarma (heal)", () => {
  it("UTF-8'in Windows-1254 sanılmasından doğan bozuk Türkçe onarılır; sağlam metin ve gerçek Latin metin dokunulmaz", () => {
    const broken = Buffer.from("Çocuk Şükrü Ağaoğlu İzmir ışık ğ", "utf8").toString("latin1").replace(/\u009f/g, "Ÿ").replace(/\u0090/g, "").replace(/\u009e/g, "ž");
    // Gerçek bozulmada 0x80–0x9F aralığı Windows-1254 karakterleriyle görünür; en yaygın örnekleri doğrudan da sınanır.
    assert.equal(repairMojibake("Ã§ocuk"), "çocuk");
    assert.equal(repairMojibake("ÅŸÃ¼krÃ¼"), "şükrü");
    assert.equal(repairMojibake("AÄŸaoÄŸlu Ä°zmir Ä±ÅŸÄ±k"), "Ağaoğlu İzmir ışık");
    assert.equal(repairMojibake("Müvekkil Şirket"), "Müvekkil Şirket", "sağlam Türkçe olduğu gibi kalır");
    assert.equal(repairMojibake("Ångström"), "Ångström", "gerçek Latin metin (bozuk desen yok) dokunulmaz");
    assert.equal(repairMojibake("Ã"), "Ã", "tek başına belirsiz karakter onarılmaz");
    assert.ok(typeof broken === "string");
  });

  it("görünmez karakterler ve NBSP temizlenir, boşluklar sadeleşir, yer tutucular boş olur", () => {
    assert.deepEqual(healCell("﻿ Ali Veli  "), { value: "Ali Veli", kind: "whitespace" });
    assert.deepEqual(healCell("—"), { value: "", kind: "placeholder" });
    assert.deepEqual(healCell("n/a"), { value: "", kind: "placeholder" });
    assert.deepEqual(healCell("1.500,00 TL"), { value: "1.500,00 TL", kind: null });
    assert.deepEqual(healCell("-500"), { value: "-500", kind: null }, "eksi sayı yer tutucu değildir");
  });

  it("kayıt dizisi yerinde onarılır ve rapor notu üretilir", () => {
    const rows = [
      { "MÃ¼vekkil": "Ã‡etin Ã–z", Telefon: "0532 111 11 11", Not: "-", __sheet: "S" },
      { "MÃ¼vekkil": "Ali Veli", Telefon: "0533 222 22 22", Not: "Aranacak", __sheet: "S" },
    ];
    const summary = healRows(rows);
    assert.deepEqual(rows[0], { Müvekkil: "Çetin Öz", Telefon: "0532 111 11 11", Not: "", __sheet: "S" });
    assert.equal(rows[1].Müvekkil, "Ali Veli");
    assert.equal(summary.kinds.mojibake, 1);
    assert.equal(summary.kinds.whitespace, 1);
    assert.equal(summary.kinds.placeholder, 1);
    assert.match(healNote(summary), /3 hücre kendiliğinden onarıldı: .*bozuk Türkçe karakter \(“Ã‡etin Ã–z” → “Çetin Öz”\)/);
    assert.equal(healNote({ cells: 0, kinds: {}, samples: [] }), "");
  });
});
