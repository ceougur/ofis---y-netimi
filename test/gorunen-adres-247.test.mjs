// 2.4.7 G1 (kullanıcı, 26.10.2026): kullanıcıya GÖRÜNEN destek e-postası destekofis@proton.me → destek@destekofis.net, görünen site adresi
// destek-ofis.vercel.app → destekofis.net. LİSANS ve GÜNCELLEME adresi DEĞİŞMEZ (kullanıcı: "vercel adreside açık kalsın … mevcut durum devam
// etsin"): kurulu sürümler https://destek-ofis.vercel.app/api/lisans'ı kullanır. Bu test ürün dosyalarını (server/, client/, packaging/,
// tools/build-windows.mjs, kılavuz HTML) satır satır tarar; eski adres yalnız aşağıdaki İSTİSNA satırlarında kalabilir.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { SUPPORT_CONTACT, DEFAULT_LICENSE_SERVICES } from "../server/lib/license.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW_EMAIL = "destek@destekofis.net";
const NEW_SITE = "destekofis.net";
const OLD_EMAIL = /destekofis@proton\.me/i;
// "destekofis.vercel.app" de yakalanır (setup.iss'te yanlış yazılmış site adresi vardı).
const OLD_SITE = /destek-?ofis\.vercel\.app/i;
const TEXT_EXT = /\.(m?js|cjs|html?|css|json|iss|txt|md|svg|webmanifest|xml)$/i;

// İSTİSNALAR: lisans/güncelleme adres sabitleri (değişmez). Anahtar dosya, değer satırda bulunması gereken işaret.
export const EXCEPTIONS = Object.freeze([
  { file: "server/lib/license.mjs", marker: "export const DEFAULT_LICENSE_SERVICES", why: "lisans servisi adresi; kurulu sürümler bunu kullanır, değişmez" },
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(name)) out.push(full);
  }
  return out;
}
const rel = file => path.relative(ROOT, file).split(path.sep).join("/");
const read = file => readFileSync(path.join(ROOT, file), "utf8");
const productFiles = () => [
  ...walk(path.join(ROOT, "server")),
  ...walk(path.join(ROOT, "client")),
  ...walk(path.join(ROOT, "packaging")),
  path.join(ROOT, "tools/build-windows.mjs"),
  path.join(ROOT, "docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html"),
].map(rel);

test("ürün dosyalarında görünen eski e-posta ve site adresi kalmaz (istisnalar dışında)", () => {
  const files = productFiles();
  assert.ok(files.length > 50, `taranan dosya sayısı az: ${files.length}`);
  const hits = [];
  const usedExceptions = new Set();
  for (const file of files) {
    read(file).split(/\r?\n/).forEach((line, i) => {
      if (!OLD_EMAIL.test(line) && !OLD_SITE.test(line)) return;
      const ex = EXCEPTIONS.find(e => e.file === file && line.includes(e.marker));
      if (ex && !OLD_EMAIL.test(line)) { usedExceptions.add(ex); return; }
      hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 160)}`);
    });
  }
  assert.deepEqual(hits, [], `eski görünen adres kaldı:\n${hits.join("\n")}`);
  // İstisna boşa düşmesin: listedeki her istisna gerçekten bir satırda kullanılıyor.
  for (const ex of EXCEPTIONS) assert.ok(usedExceptions.has(ex), `istisna kullanılmıyor (listeden çıkarın): ${ex.file} — ${ex.marker}`);
});

test("destek e-postası destek@destekofis.net; lisans adresi DEĞİŞMEDİ", () => {
  assert.equal(SUPPORT_CONTACT.email, NEW_EMAIL);
  assert.deepEqual([...DEFAULT_LICENSE_SERVICES], ["https://destek-ofis.vercel.app/api/lisans"]);
  const license = read("client/assets/hof-license.js");
  assert.match(license, /FALLBACK_CONTACT = \{[^}]*email: "destek@destekofis\.net"/);
  assert.ok(license.includes(`href="https://${NEW_SITE}/kvkk.html"`), "KVKK bağlantısı destekofis.net/kvkk.html olmalı");
  const admin = read("client/admin.html");
  assert.ok(admin.includes(`href="mailto:${NEW_EMAIL}"`), "Yönetim'de mailto bağlantısı");
  assert.ok(read("docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html").includes(`E-posta: <b>${NEW_EMAIL}</b>`), "kılavuzda destek e-postası");
  const iss = read("packaging/windows/setup.iss");
  assert.match(iss, /^AppContact=destek@destekofis\.net\r?$/m);
  assert.match(iss, /^#define AppURL "https:\/\/destekofis\.net"\r?$/m);
  assert.ok(read("tools/build-windows.mjs").includes(NEW_EMAIL), "kurulum belgesi başlığında destek e-postası");
  assert.ok(read("server/lib/updater.mjs").includes(`(+https://${NEW_SITE})`), "güncelleyici kullanıcı aracısında site adresi");
});
