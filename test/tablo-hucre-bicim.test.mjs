// 2.4.5 madde 6b (2.4.3 A18 gerilemesi): kayıt tablosunun hücre biçimleyicisi (derlenmiş arayüz paketi client/assets/app-*.js; kaynak kodu yok,
// tools/patch-bundle.mjs) başlıkta "borç" görünce "Borçlu Telefon" / "Borçlu TC Kimlik No" kolonunu para sayıp 5367715055 → "5.367.715.055,00"
// yazıyordu; hücreden WhatsApp açılmıyordu (hof-workspace.js telefonu hücre metninden okur). Kimlik / iletişim başlığı para kalıbından ÖNCE metindir
// (sunucudaki IDENTIFIER_HEADER ile aynı liste), tutar kolonunda da 10 haneden uzun ayraçsız rakam dizisi para biçimine çevrilmez.
// Paketteki işlevler kaynaktan çıkarılıp yalıtılmış ortamda çalıştırılır (sT tarih sezgisi devre dışı: başlıklar tarih sözcüğü taşımaz).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as debtColumn from "../server/lib/insight/debt-column.mjs";

const ROOT = new URL("../", import.meta.url);
const bundleName = readdirSync(new URL("client/assets/", ROOT)).find(name => /^app-[0-9a-f]{10}\.js$/.test(name));
const bundle = readFileSync(new URL(`client/assets/${bundleName}`, ROOT), "utf8");

const functionSource = name => {
  const start = bundle.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `pakette function ${name} yok`);
  let depth = 0;
  for (let index = bundle.indexOf("{", start); index < bundle.length; index += 1) {
    if (bundle[index] === "{") depth += 1;
    else if (bundle[index] === "}" && --depth === 0) return bundle.slice(start, index + 1);
  }
  throw new Error(`function ${name} kapanmıyor`);
};
const idHeaderSource = (bundle.match(/const hofIdHeader=.*?;(?=function cT\()/) || [""])[0];

const sandbox = vm.createContext({ Intl, String, Number, Math });
vm.runInContext(
  `${idHeaderSource}${["od", "oT", "hf", "hfCell", "cT"].map(functionSource).join("\n")}\nfunction sT(){return false}\nthis.cT=cT;this.hfCell=hfCell;`,
  sandbox,
);
const { cT, hfCell } = sandbox;
const cell = (header, value) => hfCell(value, cT(header, [value]));

test("6b: kimlik / iletişim başlıklı kolon metindir; hücre ham değeri gösterir (telefon WhatsApp için okunur)", () => {
  for (const [header, value] of [
    ["Borçlu Telefon", "5367715055"],
    ["BORÇLU TELEFON", "5367715055"],
    ["Borçlu TC Kimlik No", "12345678950"],
    ["Alacaklı Cep Tel.", "5321112233"],
    ["Borçlu GSM", "05321112233"],
    ["Borç IBAN", "330006100519786457841326"],
    ["Ödeme No", "2026001"],
    ["Borçlu VKN", "1234567890"],
    ["Alacak Kodu", "250000"],
  ]) {
    assert.equal(cT(header, [value]), "text", `${header} kolon türü`);
    assert.equal(cell(header, value), value, `${header} hücresi ham kalır`);
  }
});

test("6b: tutar kolonları para kalır ve biçimlenir (komşular: Alacak Tutarı, Kalan Borç, Toplam Borç, Bakiye, TUTAR)", () => {
  for (const [header, value, shown] of [
    ["Alacak Tutarı", "25000,00", "25.000,00"],
    ["Kalan Borç", "1250,5", "1.250,50"],
    ["Toplam Borç", "1.234.567,89", "1.234.567,89"],
    ["Bakiye", "-300", "-300,00"],
    ["TUTAR", "25000.00", "25.000,00"],
    ["Notlar Tutarı", "100", "100,00"],
    ["Cephe Bedeli", "750", "750,00"],
  ]) {
    assert.equal(cT(header, [value]), "money", `${header} kolon türü`);
    assert.equal(cell(header, value), shown, `${header} hücresi`);
  }
});

test("6b: tutar kolonunda 10 haneden uzun ayraçsız rakam dizisi para biçimine çevrilmez; 10 hane ve ayraçlı tutar biçimlenir", () => {
  assert.equal(hfCell("12345678950", "money"), "12345678950");
  assert.equal(hfCell("-12345678901", "money"), "-12345678901");
  assert.equal(hfCell("1234567890", "money"), "1.234.567.890,00");
  assert.equal(hfCell("12.345.678.901,00", "money"), "12.345.678.901,00");
});

test("6b: paketteki kimlik başlığı listesi sunucunun IDENTIFIER_HEADER'ı ile aynı (tek liste)", () => {
  const literal = (idHeaderSource.match(/\/(\\b\(no\|.*?\)\\b)\//) || [])[1];
  assert.ok(literal, "pakette kimlik başlığı kuralı (hofIdHeader) yok");
  assert.ok(debtColumn.IDENTIFIER_HEADER, "sunucu IDENTIFIER_HEADER dışa açılmamış");
  assert.equal(literal, debtColumn.IDENTIFIER_HEADER.source);
});
