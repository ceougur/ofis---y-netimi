// 2.1.0 — Aşama 2, Dilim 4: npm run mutabakat -- --sirket <kod|tümü> (docs/BANKA-MODULU-PLAN.md §10.7).
//
// ÇALIŞIYOR MU: araç seçilen şirketin (ya da bütün şirketlerin) veri dosyasının salt okunur kopyasında mutabakatı çalıştırır; her
// sonuç şirketin kodu ve adıyla; --json çıktısında şirket listesi. Bayraksız çağrı eskisi gibi 001'i denetler (çıktı biçimi aynı).
// NASIL BOZARIM: 007'nin dosyasında kuruş küsuratı (bozuk veri) → yalnız 007 sapmalı, çıkış kodu 1; 002 tek başına denetlenince
// tutarlı (çıkış 0); bilinmeyen şirket kodu → çıkış 2; araç veri dosyalarına dokunmaz.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(ROOT, "tools", "mutabakat.mjs");
const run = (dataDir, args) => {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", TOOL, ...args], { cwd: ROOT, env: { ...process.env, HUKUK_DATA_DIR: dataDir }, encoding: "utf8", timeout: 300_000 });
  return { code: result.status, out: result.stdout, err: result.stderr };
};
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("mutabakat aracı --sirket", { skip: fixtureExists("surum-2.0.26-zincir") ? false : "fikstür yok" }, () => {
  let fixture;
  let files;
  before(() => {
    fixture = unpackFixture("surum-2.0.26-zincir");
    const registry = readRegistry(fixture.dataDir);
    files = Object.fromEntries(registry.map(company => [company.code, companyDbFile(fixture.dataDir, company)]));
    // 007'de bozuk veri: kuruş küsuratlı Kasa hareketi (eski bir sürümün ya da elle düzenlemenin bırakacağı gibi).
    const db = new DatabaseSync(files["007"]);
    db.prepare("UPDATE cash_entries SET amount = amount + 0.001 WHERE rowid = (SELECT MIN(rowid) FROM cash_entries)").run();
    db.close();
  });
  after(() => fixture?.cleanup());

  it("--sirket 002 --json: yalnız 002, kodu ve adıyla; tutarlı (çıkış 0)", () => {
    const result = run(fixture.dataDir, ["--sirket", "002", "--json"]);
    assert.equal(result.code, 0, result.err || result.out.slice(0, 800));
    const json = JSON.parse(result.out);
    assert.ok(Array.isArray(json.companies), "çıktıda şirket listesi");
    assert.deepEqual(json.companies.map(item => item.code), ["002"]);
    assert.equal(json.companies[0].name, "Şahin İnşaat ve Ticaret Ltd. Şti.");
    assert.equal(json.companies[0].ok, true);
    assert.ok(json.companies[0].checks.length > 10);
  });

  it("--sirket 007: bozuk veri yakalanır (kuruş), çıkış 1; sapma 007'nin adıyla yazılır", () => {
    const result = run(fixture.dataDir, ["--sirket", "007"]);
    assert.equal(result.code, 1, result.out.slice(0, 800));
    assert.match(result.out, /007 · Mavi Gıda A\.Ş\./);
    assert.match(result.out, /Kuruş ve işaret \(Kasa Hareketleri\)/);
  });

  it("--sirket tümü --json: dört şirket; yalnız bozuk olan (007) ve eski sapması olan (001) tutarsız; dosyalara dokunulmaz", () => {
    const before = Object.fromEntries(Object.entries(files).map(([code, file]) => [code, sha(file)]));
    const result = run(fixture.dataDir, ["--sirket", "tümü", "--json"]);
    assert.equal(result.code, 1);
    const json = JSON.parse(result.out);
    assert.deepEqual(json.companies.map(item => item.code).sort(), ["001", "002", "004", "007"]);
    const bad = json.companies.filter(item => !item.ok).map(item => item.code).sort();
    assert.ok(bad.includes("007"), `007 tutarsız olmalı: ${bad}`);
    assert.ok(!bad.includes("002") && !bad.includes("004"), `002 ve 004 tutarlı olmalı: ${bad}`);
    const after = Object.fromEntries(Object.entries(files).map(([code, file]) => [code, sha(file)]));
    assert.deepEqual(after, before, "araç veri dosyalarını değiştirmez (salt okunur kopya)");
  });

  it("bilinmeyen şirket kodu: çıkış 2 ve açık hata", () => {
    const result = run(fixture.dataDir, ["--sirket", "999"]);
    assert.equal(result.code, 2);
    assert.match(result.err, /999/);
  });

  it("bayraksız çağrı eskisi gibi 001'i denetler (JSON biçimi değişmez)", () => {
    const result = run(fixture.dataDir, ["--json"]);
    const json = JSON.parse(result.out);
    assert.ok(Array.isArray(json.checks) && json.source, "eski biçim: { source, today, ok, checks … }");
    assert.equal(json.companies, undefined);
  });
});

