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

// Uzun Doğrulama iş akışı (10.10.2026): matris (os × taban × tohum + include) açılınca çıkan kayıt adları "Uzun Doğrulama Kapısı"nın
// beklenen listesiyle aynı olmalı; yoksa bir tohum hiç koşmasa da kapı fark etmez.
describe("Uzun Doğrulama Kapısı — beklenen liste ↔ matris", () => {
  const uzun = readFileSync(path.join(ROOT, ".github", "workflows", "uzun-dogrulama.yml"), "utf8").replace(/\r/g, "");
  const blockOf = job => {
    const start = uzun.indexOf(`\n  ${job}:\n`);
    assert.ok(start >= 0, `iş bulunamadı: ${job}`);
    const rest = uzun.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[a-z_]+:\n/);
    return next < 0 ? rest : rest.slice(0, next + 1);
  };
  const namesOf = job => {
    const block = blockOf(job);
    const arr = key => (block.match(new RegExp(`^ {8}${key}:\\s*\\[([^\\]]*)\\]`, "m"))?.[1] || "").split(",").map(item => item.trim()).filter(Boolean);
    const keys = ["os", "taban", "tohum"].filter(key => arr(key).length);
    let combos = [{}];
    for (const key of keys) combos = combos.flatMap(combo => arr(key).map(value => ({ ...combo, [key]: value })));
    // include listesi: "include:" satırından sonra girintisi 10 ve üstü olan satırlar; her "- " yeni bir birleşim.
    const after = (block.split(/\n {8}include:\n/)[1] || "").split("\n");
    const stop = after.findIndex(line => line.trim() && line.search(/\S/) < 10);
    const include = `\n${after.slice(0, stop < 0 ? after.length : stop).join("\n")}`;
    for (const item of include.split(/\n {10}- /).slice(1)) {
      const combo = {};
      for (const line of `  ${item}`.split("\n")) {
        const kv = line.match(/^\s*([a-z]+):\s*(\S+)\s*$/);
        if (kv) combo[kv[1]] = kv[2];
      }
      combos.push(combo);
    }
    const template = block.match(/kanit\.mjs kos ((?:\$\{\{[^}]*\}\}|\S)+)/)?.[1];
    assert.ok(template, `${job}: kanıt aracıyla koşan adım`);
    return combos.map(combo => template.replace(/\$\{\{\s*matrix\.([a-z]+)\s*\}\}/g, (_, key) => {
      assert.ok(key in combo, `${job}: matriste ${key} yok (${JSON.stringify(combo)})`);
      return combo[key];
    }));
  };
  it("mutabakat ve güvenilirlik matrislerinin her kaydı kapıda bekleniyor, fazlası yok; plan alt sınırı karşılanıyor", () => {
    const ran = new Set([...namesOf("mutabakat"), ...namesOf("guvenilirlik")]);
    const expected = new Set((uzun.match(/--beklenen (\S+)/)?.[1] || "").split(","));
    assert.deepEqual([...ran].filter(name => !expected.has(name)), [], "koşuyor ama kapı beklemiyor");
    assert.deepEqual([...expected].filter(name => !ran.has(name)), [], "kapı bekliyor ama koşmuyor");
    assert.ok([...ran].filter(name => name.startsWith("mutabakat-ubuntu")).length >= 10, "mutabakat en az 10 tohum (plan §10.7)");
    assert.ok([...ran].filter(name => name.startsWith("guvenilirlik-ubuntu")).length >= 10, "güvenilirlik 5 tohum × 2 taban");
    assert.match(uzun, /MUTABAKAT_ISLEM: \$\{\{ inputs\.mutabakat_islem \|\| '5000' \}\}/, "mutabakat varsayılanı 5.000 işlem");
    assert.match(uzun, /GUVENILIRLIK_ISLEM: \$\{\{ inputs\.guvenilirlik_islem \|\| '10000' \}\}/, "güvenilirlik varsayılanı 10.000 işlem");
  });
});
