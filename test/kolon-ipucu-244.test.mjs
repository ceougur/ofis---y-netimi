// Kolon eşleme ipucu (Excel/Sheets "Yeni veri" penceresi): durum/kategori/sorumlu kolonlarında ipucu
// değerlerin KENDİSİNİ yazar; topValues() {value, count} nesnelerinin "[object Object]" metni çıkmaz (2.0.2'den kalan hata).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";

const evidenceOf = (rows, column) => {
  const item = analyzeColumns(rows, [column]).find(entry => entry.column === column);
  return { item, text: (item.evidence || []).join(" · ") };
};

describe("kolon eşleme ipucu değer adlarını yazar", () => {
  it("kategori kolonu (Yerel Mahkeme): değer adları var, [object Object] yok", () => {
    const daireler = Array.from({ length: 50 }, (_, i) => `KONYA ${i + 1}.İCRA DAİRESİ`);
    const rows = [];
    for (let i = 0; i < 300; i += 1) rows.push({ "Yerel Mahkeme": daireler[i < 60 ? 0 : i % 50] });
    const { item, text } = evidenceOf(rows, "Yerel Mahkeme");
    assert.ok(item.role === "category" || item.role === "status", `rol kategori/durum değil: ${item.role}`);
    assert.doesNotMatch(text, /\[object Object\]/, `ipucu nesne metni taşıyor: ${text}`);
    assert.match(text, /50 farklı değer: KONYA 1\.İCRA DAİRESİ, /, `ipucu: ${text}`);
    assert.match(text, /…/);
  });

  it("durum kolonu: değer adları sayılarıyla değil adıyla, sıklık sırasıyla", () => {
    const rows = [...Array(6).fill("Açık"), ...Array(3).fill("Kapalı"), ...Array(2).fill("Beklemede")].map(value => ({ Durum: value }));
    const { item, text } = evidenceOf(rows, "Durum");
    assert.equal(item.role, "status");
    assert.doesNotMatch(text, /\[object Object\]/);
    assert.match(text, /3 farklı değer: Açık, Kapalı, Beklemede(?!…)/, `ipucu: ${text}`);
  });

  it("sorumlu kolonu: tekrar eden kişi adları yazılır", () => {
    const names = ["Ahmet Yılmaz", "Ayşe Demir", "Mehmet Kaya"];
    const rows = Array.from({ length: 30 }, (_, i) => ({ Sorumlu: names[i % 3] }));
    const { item, text } = evidenceOf(rows, "Sorumlu");
    if (item.role !== "responsible") return assert.doesNotMatch(text, /\[object Object\]/);
    assert.doesNotMatch(text, /\[object Object\]/, `ipucu: ${text}`);
    assert.match(text, /az sayıda kişi tekrar ediyor: (Ahmet Yılmaz|Ayşe Demir|Mehmet Kaya), /, `ipucu: ${text}`);
  });

  it("değer metni olduğu gibi gelir (kaçırma istemcide esc ile)", () => {
    const rows = [...Array(5).fill("<b>x</b>"), ...Array(5).fill("Normal")].map(value => ({ Kategori: value }));
    const { text } = evidenceOf(rows, "Kategori");
    assert.match(text, /<b>x<\/b>/);
    assert.doesNotMatch(text, /\[object Object\]/);
  });
});
