// Yetkiye göre görünürlük (v2.0.15 bulgusu): sol menüde ve ekranlarda data-requires taşıyan her öğe, o yetki yoksa CSS
// ile gizlenir (client/assets/hof-ui.css "Yetkiye göre görünürlük"). Yeni modül eklenip kural unutulursa yetkisiz
// kullanıcı düğmeyi görür (Fatura'da senaryo-215 yakaladı). Kaynakta kullanılan her yetki için kural olmalı.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "client", "assets");
const css = fs.readFileSync(path.join(assets, "hof-ui.css"), "utf8");

describe("yetkiye göre görünürlük", () => {
  it("data-requires / requires ile kullanılan her yetkinin gizleme kuralı var", () => {
    const used = new Set();
    for (const file of fs.readdirSync(assets).filter(name => /^hof-.*\.js$/.test(name))) {
      const text = fs.readFileSync(path.join(assets, file), "utf8");
      for (const match of text.matchAll(/data-requires="([a-zA-Z.]+)"/g)) used.add(match[1]);
      for (const match of text.matchAll(/requires: "([a-zA-Z.]+)"/g)) used.add(match[1]);
    }
    assert.ok(used.has("invoices.view"), "Fatura menüsü yetki istiyor");
    const missing = [...used].filter(permission => !css.includes(`[data-requires="${permission}"]`));
    assert.deepEqual(missing, [], `CSS gizleme kuralı eksik: ${missing.join(", ")}`);
  });
});
