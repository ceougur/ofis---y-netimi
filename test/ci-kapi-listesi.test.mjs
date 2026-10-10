// Doğrulama Kapısı'nın beklenen kayıt listesi CI'nin gerçekten koştuğu adımlarla aynı mı (10.10.2026). Kapı yalnız --beklenen listesindeki
// kayıtların VARLIĞINI arar; listeye yazılmamış bir adım hiç koşmasa (silinse, adı değişse, atlansa) kapı bunu görmez. Liste elle tutulduğu
// için kayar: senaryo-banka-210b CI'ye eklendiğinde listeye eklenmemişti. Bu test ci.yml'deki her `kanit.mjs kos <ad>` adımını (matrisli
// adlar açılarak) kapının listesiyle iki yönlü karşılaştırır; yayın iş akışı da CI'nin koştuğu her arayüz senaryosunu koşmalıdır.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ci = readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
const release = readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");

const listOf = (text, key) => {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]`, "m"));
  assert.ok(match, `ci.yml matrisinde ${key} listesi`);
  return match[1].split(",").map(item => item.trim()).filter(Boolean);
};

/** ci.yml'de kanıt aracıyla koşan adların tamamı; matris değişkenleri her birleşimle açılır. */
function recordNames(text) {
  const os = listOf(text, "os");
  const node = listOf(text, "node");
  const names = new Set();
  // Ad "${{ matrix.os }}" gibi boşluklu ifadeler içerebilir; ifade bütün olarak alınır.
  for (const [, name] of text.matchAll(/kanit\.mjs kos ((?:\$\{\{[^}]*\}\}|\S)+)/g)) {
    if (!name.includes("${{")) {
      names.add(name);
      continue;
    }
    for (const o of os) for (const n of node) names.add(name.replaceAll("${{ matrix.os }}", o).replaceAll("${{ matrix.node }}", n));
  }
  return names;
}

describe("Doğrulama Kapısı — beklenen liste ↔ CI adımları", () => {
  it("ci.yml'de koşan her kanıt kaydı kapının --beklenen listesinde, listede koşmayan ad yok", () => {
    const match = ci.match(/--beklenen (\S+)/);
    assert.ok(match, "kapı adımında --beklenen");
    const expected = new Set(match[1].split(","));
    const ran = recordNames(ci);
    for (const name of ran) assert.ok(!name.includes("${{"), `açılmamış matris değişkeni: ${name}`);
    const missing = [...ran].filter(name => !expected.has(name));
    const extra = [...expected].filter(name => !ran.has(name));
    assert.deepEqual(missing, [], `CI'de koşuyor ama kapı beklemiyor (koşmasa fark edilmez): ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `kapı bekliyor ama CI'de koşan adım yok: ${extra.join(", ")}`);
    assert.ok(ran.size >= 16, `en az 4 platform + 12 arayüz kaydı (bulunan ${ran.size})`);
  });

  it("yayın iş akışı CI'nin koştuğu her arayüz senaryosunu koşar", () => {
    const scripts = [...ci.matchAll(/kanit\.mjs kos e2e-\S+ npm run (test:\S+)/g)].map(match => match[1]);
    assert.ok(scripts.length >= 12, `CI arayüz senaryoları (${scripts.length})`);
    const missing = scripts.filter(script => !release.includes(`npm run ${script}`));
    assert.deepEqual(missing, [], `release.yml'de koşmayan arayüz senaryosu: ${missing.join(", ")}`);
  });
});
