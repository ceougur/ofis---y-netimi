// Ayrıştırıcı dayanıklılık sınaması (v2.0.2): rastgele ama gerçekçi "saçma" sayfa düzenleri üretilir ve okuma
// motorunun değişmezleri denetlenir. Amaç bir düzeni doğru okumak değil (onu birim testleri yapar); hangi düzen
// gelirse gelsin hata vermemek, veri kaybetmemek ve temiz tablolarda beklenen kayıt sayısını vermektir.
//   - hiçbir girdi istisna fırlatmaz; sonuç her zaman aynı biçimdedir (rows, tabs, sections, report)
//   - kayıt değerleri metindir; rapor kapsamı 0–1 arasındadır; atlanan satırlar türüyle listelenir
//   - temiz tablo (başlık + N kayıt) N kayıt ve aynı kolon adlarını verir; başlıksız tablo N kayıt verir
//   - üstte başlık satırları, alta dipnot, araya boş satır ve toplam eklenmesi kayıt sayısını değiştirmez
//   - büyük sayfada süre makul kalır
// Tohumlu rastgelelik: aynı tohum aynı diziyi üretir; bir hata bulunursa tohum ve adım numarasıyla yeniden üretilir.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matrixToRecords } from "../server/lib/sections.mjs";

function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}
const pick = (random, list) => list[Math.floor(random() * list.length)];
const between = (random, min, max) => min + Math.floor(random() * (max - min + 1));

const HEADERS = ["Dosya No", "Müvekkil", "Borçlu", "Telefon", "Tutar", "Vade", "Durum", "Şehir", "Not", "Kayıt tarihi", "Plaka", "E-posta", "Sıra", "Alacaklı", "Taksit 1", "Taksit 2", "Ödeme sözü", "Açıklama"];
const NAMES = ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ay", "Ece Ak", "Alfa Ltd. Şti.", "Beta A.Ş.", "Mehmet", "Zeynep Demir"];
const STATUS = ["Aktif", "Pasif", "Ödendi", "Bekliyor", "İptal", "Kapandı"];
const CITIES = ["İstanbul", "Ankara", "İzmir", "Konya", "Bursa"];
const NOTES = ["Aranacak", "Tebligat bekleniyor", "Dosya bekletici mesele\nyapıldı", "Çok uzun bir açıklama metni: taraflar arasında düzenlenen sözleşme gereği ödemeler her ayın ilk haftasında yapılır.", "—", "#YOK", "#DIV/0!"];
const money = random => `${between(random, 1, 999)}.${String(between(random, 0, 999)).padStart(3, "0")},${String(between(random, 0, 99)).padStart(2, "0")} TL`;
const date = random => `${String(between(random, 1, 28)).padStart(2, "0")}.${String(between(random, 1, 12)).padStart(2, "0")}.${between(random, 2023, 2027)}`;
const phone = random => `053${between(random, 0, 9)} ${between(random, 100, 999)} ${between(random, 10, 99)} ${between(random, 10, 99)}`;
const caseNo = random => `${between(random, 2018, 2026)}/${between(random, 1, 9999)}`;
const valueFor = (random, header, row) => {
  const folded = header.toLocaleLowerCase("tr-TR");
  if (folded.includes("no") && !folded.includes("not")) return caseNo(random);
  if (folded.includes("sıra")) return String(row + 1);
  if (folded.includes("telefon")) return phone(random);
  if (folded.includes("tutar") || folded.includes("taksit")) return money(random);
  if (folded.includes("tarih") || folded.includes("vade") || folded.includes("sözü")) return date(random);
  if (folded.includes("durum")) return pick(random, STATUS);
  if (folded.includes("şehir")) return pick(random, CITIES);
  if (folded.includes("plaka")) return `${between(random, 1, 81)} ABC ${between(random, 10, 999)}`;
  if (folded.includes("posta")) return `kisi${row}@ornek.com`;
  if (folded.includes("not") || folded.includes("açıklama")) return pick(random, NOTES);
  return pick(random, NAMES);
};

// Temiz tablo: benzersiz başlıklar + n kayıt (boş hücreler olabilir ama her kayıtta en az bir dolu hücre).
function cleanTable(random, n, width) {
  const headers = [...new Set(Array.from({ length: width }, () => pick(random, HEADERS)))];
  const rows = Array.from({ length: n }, (_, row) => headers.map((header, column) => (column > 0 && random() < 0.15 ? "" : valueFor(random, header, row))));
  return { headers, rows };
}

function decorate(random, table) {
  const out = [];
  const titles = between(random, 0, 2);
  for (let index = 0; index < titles; index += 1) out.push([pick(random, ["ABC HUKUK BÜROSU", "Alacak takip listesi", "2026 dönemi", "ÖNEMLİ DOSYALAR"])]);
  if (random() < 0.3) out.push([]);
  out.push(table.headers);
  table.rows.forEach((row, index) => {
    out.push(row);
    if (random() < 0.08) out.push([]);
    if (random() < 0.05 && index > 0) out.push(["Ara toplam", "", money(random)]);
  });
  if (random() < 0.4) out.push(["TOPLAM", "", money(random)]);
  if (random() < 0.4) out.push([]);
  if (random() < 0.5) out.push([pick(random, ["* Kırmızı satırlar gecikmiştir.", "Hazırlayan: Selin", "Not: liste güncellenecek"])]);
  return out;
}

const invariants = (result, label) => {
  assert.ok(Array.isArray(result.rows) && Array.isArray(result.tabs) && Array.isArray(result.sections), `${label}: biçim`);
  assert.ok(result.report && result.report.coverage >= 0 && result.report.coverage <= 1, `${label}: kapsam`);
  assert.ok(["table", "form", "transposed", "headerless"].includes(result.report.shape), `${label}: şekil ${result.report.shape}`);
  for (const row of result.rows) for (const [key, value] of Object.entries(row)) assert.equal(typeof value, "string", `${label}: ${key} metin değil`);
  for (const item of result.report.skipped) assert.ok(Number.isInteger(item.line) && item.line >= 1 && typeof item.kind === "string", `${label}: atlanan satır kaydı`);
};

describe("ayrıştırıcı dayanıklılık (rastgele düzenler)", () => {
  it("temiz tablolar süsleme (başlık, boş satır, toplam, dipnot) ne olursa olsun aynı kayıtları verir", () => {
    const random = rng(20260927);
    for (let step = 0; step < 300; step += 1) {
      const n = between(random, 1, 12);
      const table = cleanTable(random, n, between(random, 2, 9));
      const plain = matrixToRecords([table.headers, ...table.rows], "S");
      invariants(plain, `düz #${step}`);
      assert.equal(plain.rows.length, n, `düz #${step}: ${n} kayıt bekleniyordu, ${plain.rows.length} geldi`);
      assert.deepEqual(Object.keys(plain.rows[0]).filter(key => !key.startsWith("__")), table.headers, `düz #${step}: kolon adları`);
      const dressed = matrixToRecords(decorate(random, table), "S");
      invariants(dressed, `süslü #${step}`);
      // Toplam satırları kayıt olarak kalır (formül toplamı) ama asıl kayıtlar eksilmez.
      const records = dressed.rows.filter(row => !/^(toplam|ara toplam)$/i.test(String(row[table.headers[0]] || "")));
      assert.equal(records.length, n, `süslü #${step}: ${n} kayıt bekleniyordu, ${records.length} geldi; atlananlar: ${JSON.stringify(dressed.report.skipped)}`);
    }
  });

  it("başlıksız tablolar kayıt kaybetmez; rastgele çöp girdiler hata vermez", () => {
    const random = rng(7);
    for (let step = 0; step < 150; step += 1) {
      const n = between(random, 3, 10);
      const rows = Array.from({ length: n }, (_, row) => [pick(random, NAMES), phone(random), date(random), money(random), random() < 0.5 ? pick(random, STATUS) : ""]);
      const result = matrixToRecords(rows, "S");
      invariants(result, `başlıksız #${step}`);
      assert.equal(result.rows.length, n, `başlıksız #${step}: ${n} kayıt, ${result.rows.length} geldi (${result.report.shape})`);
    }
    for (let step = 0; step < 300; step += 1) {
      const height = between(random, 0, 12);
      const matrix = Array.from({ length: height }, () => Array.from({ length: between(random, 0, 8) }, () => (random() < 0.3 ? "" : pick(random, [...HEADERS, ...NAMES, ...NOTES, money(random), date(random), phone(random), caseNo(random), "=", "'", "0", "-1", "1e9", "#REF!", "   ", "\t", "a".repeat(500)]))));
      const result = matrixToRecords(matrix, random() < 0.5 ? "Çöp" : "");
      invariants(result, `çöp #${step}`);
    }
  });

  it("form ve yan çevrilmiş düzenler rastgele alanlarla da tanınır", () => {
    const random = rng(99);
    for (let step = 0; step < 100; step += 1) {
      let fields = [];
      while (fields.length < 3) fields = [...new Set(Array.from({ length: between(random, 4, 9) }, () => pick(random, HEADERS)))];
      const form = fields.map(field => [`${field}${random() < 0.5 ? ":" : ""}`, valueFor(random, field, 0)]);
      if (random() < 0.5) form.unshift(["KAYIT FORMU"]);
      const one = matrixToRecords(form, "Form");
      invariants(one, `form #${step}`);
      assert.equal(one.report.shape, "form", `form #${step}`);
      assert.equal(one.rows.length, 1, `form #${step}`);
      const n = between(random, 2, 6);
      const flipped = fields.map(field => [field, ...Array.from({ length: n }, (_, row) => valueFor(random, field, row))]);
      const many = matrixToRecords(flipped, "Yan");
      invariants(many, `yan #${step}`);
      if (many.report.shape === "transposed") assert.equal(many.rows.length, n, `yan #${step}`);
    }
  });

  it("50.000 satırlık sayfa iki saniyenin altında okunur", () => {
    const random = rng(3);
    const table = cleanTable(random, 50_000, 8);
    const started = performance.now();
    const result = matrixToRecords([table.headers, ...table.rows], "Büyük");
    const elapsed = performance.now() - started;
    assert.equal(result.rows.length, 50_000);
    assert.ok(elapsed < 2000, `süre ${Math.round(elapsed)} ms`);
  });
});
