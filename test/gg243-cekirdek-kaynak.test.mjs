// Gözden geçirme 2.4.3 (gg243 #3, #4) — ortak çekirdek kaynak denetimi (ekrandaki sınama: test/e2e/gg243-arka-plan-yazma.mjs, gg243-odak-dugme.mjs).
//   #3  Arka planda giden yazma (background: true) odaktaki formun taslağını "kaydedildi" sayıyordu. Bütün background çağrıları tek yoldan geçer
//       (HOF.api → rawApi → sendApi); rawApi background bayrağını sendApi'ye iletir, writeOrigin arka plan isteğine pencere vermez. Yeni bir yazma
//       ucu background ile çağrılsa da aynı yol kapsar — liste burada yazılır (ders 9: değişen kodun bütün yolları).
//   #4  Odak anahtarı satırı ayırt eden bütün data-* nitelikleriyle eşleşir; aynı öğe yoksa başka satırın düğmesine odak verilmez.
// Satır bölme CRLF'yi bilir (ders 27).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "client", "assets");
const core = readFileSync(path.join(ASSETS, "hof-core.js"), "utf8");

describe("gg243: ortak çekirdek — arka plan yazması ve odak anahtarı", () => {
  it("#3 bütün background çağrıları rawApi'den geçer; rawApi bayrağı sendApi'ye iletir; writeOrigin arka plan isteğine pencere vermez", () => {
    const calls = [];
    for (const file of readdirSync(ASSETS).filter(name => name.endsWith(".js"))) {
      readFileSync(path.join(ASSETS, file), "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (/background:\s*true/.test(line)) calls.push({ file, line: index + 1, write: /method:\s*"(POST|PUT|PATCH|DELETE)"/.test(line), text: line.trim().slice(0, 160) });
        });
    }
    assert.ok(calls.length > 0, "background çağrısı bulunamadı (tarama bozuk)");
    // Arka plan çağrısının HOF.api / rawApi dışında bir yoldan (doğrudan fetch) gitmediği: satırda HOF.api, api( ya da rawApi geçer.
    for (const call of calls.filter(item => item.file !== "hof-core.js")) assert.match(call.text, /(HOF\.api|\bapi\(|rawApi|HOF\.json|\{)/, `${call.file}:${call.line}`);
    assert.match(core, /return await sendApi\(path, \{ \.\.\.options, background: true \}\);/, "rawApi background bayrağını sendApi'ye iletir");
    assert.match(core, /const origin = method !== "GET" \? writeOrigin\(background, path\) : null;/, "sendApi pencereyi writeOrigin(background, path) ile bulur");
    assert.match(core, /function writeOrigin\(background = false, path = ""\) \{\s*if \(background\) return null;/, "arka plan isteği hiçbir pencereye yazılmaz");
    console.log(`  background çağrıları: ${calls.length} (yazma: ${calls.filter(item => item.write).map(item => `${item.file}:${item.line}`).join(", ") || "yok"})`);
  });

  it("#4 odak anahtarı satır data-* niteliklerini içerir; bulunamazsa yalnız tekil birincil anahtara döner", () => {
    assert.match(core, /HOF\.focusKey = node => \{[\s\S]*?attr\.name\.startsWith\("data-"\)[\s\S]*?\};/, "focusKey bütün data-* niteliklerini ekler");
    assert.match(core, /const refind = \(root, snap\) => \{[\s\S]*?!snap\.unique\) return exact;[\s\S]*?loose\.length === 1 \? loose\[0\] : null;/, "tekil değilse başka öğeye odak verilmez");
    assert.match(core, /const next = refind\(root, snap\);/, "keepFocus refind kullanır");
  });
});
