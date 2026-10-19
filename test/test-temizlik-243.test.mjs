// Uzun Doğrulama run 39045380135 (2.4.3): Windows'ta mutabakat 5.000 işlem tutarlı bittiği hâlde test sunucusunun geçici klasörünü silmek EPERM verdi ve
// koşu kırmızıya döndü (temizlik asıl sonucu ezdi — ders 21). Zorla üretme (ders 20): silme işlevi EPERM fırlatır.
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { removeTestDir } from "./helpers.mjs";

const eperm = () => {
  throw Object.assign(new Error("EPERM, Permission denied"), { code: "EPERM" });
};

test("Windows'ta EPERM: temizlik uyarı yazar, hata yükseltmez", () => {
  const warnings = [];
  assert.equal(removeTestDir("C:\\\\tmp\\\\destekofis-test-x", { rm: eperm, platform: "win32", warn: text => warnings.push(text) }), false);
  assert.match(warnings[0], /EPERM/);
});

test("Başka platformda ve başka hatada hata yükselir (gerçek sorun gizlenmez)", () => {
  assert.throws(() => removeTestDir("/tmp/x", { rm: eperm, platform: "linux", warn: () => {} }), /EPERM/);
  const other = () => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  };
  assert.throws(() => removeTestDir("C:\\\\x", { rm: other, platform: "win32", warn: () => {} }), /ENOENT/);
});

test("Yeniden deneme ayarı verilir ve gerçek klasör silinir", () => {
  let seen;
  removeTestDir("x", { rm: (dir, options) => (seen = options) });
  assert.equal(seen.maxRetries, 10);
  assert.equal(seen.retryDelay, 200);
  const dir = mkdtempSync(path.join(tmpdir(), "temizlik-243-"));
  assert.equal(removeTestDir(dir), true);
  assert.equal(existsSync(dir), false);
});
