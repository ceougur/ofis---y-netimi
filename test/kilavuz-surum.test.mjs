// Kullanım kılavuzunun kapağındaki ve dip notundaki sürüm, programın sürümüyle (package.json) aynı olmalı.
// (13.10.2026: yayımlanan 2.2.0 kılavuzunun kapağında "Sürüm 2.1.0" kaldı — sürüm elle yazılıyordu, denetim yoktu.)
//
// NASIL BOZARIM: (1) sürüm yükseltilir, kılavuz kaynağı unutulur; (2) kapak güncellenir, dip not unutulur; (3) kaynak güncellenir, PDF
// yeniden üretilmez. (1) ve (2) burada (kaynak HTML) yakalanır; (3) test/kilavuz-pdf-surum.test.mjs (CI, Linux + Windows) ve docs/kilavuz/pdf-denetle.mjs (PDF metni).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const html = readFileSync(path.join(ROOT, "docs", "kilavuz", "DestekOfis-Kullanim-Kilavuzu.html"), "utf8");

describe("Kullanım kılavuzu sürümü", () => {
  it("kapakta “Sürüm <program sürümü>” yazar", () => {
    const kapak = [...html.matchAll(/Sürüm (\d+\.\d+\.\d+)/g)].map(m => m[1]);
    assert.ok(kapak.length >= 1, "kapakta sürüm yazısı bulunamadı");
    assert.deepEqual([...new Set(kapak)], [version]);
  });
  it("dip notta “DestekOfis <program sürümü> · Kısa Kullanım Kılavuzu” yazar", () => {
    const dip = [...html.matchAll(/DestekOfis (\d+\.\d+\.\d+) · Kısa Kullanım Kılavuzu/g)].map(m => m[1]);
    assert.ok(dip.length >= 1, "dip notta sürüm yazısı bulunamadı");
    assert.deepEqual([...new Set(dip)], [version]);
  });
});
