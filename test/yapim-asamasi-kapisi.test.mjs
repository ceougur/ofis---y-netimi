// YAPIM AŞAMASI kapısı (S100 = A, KULLANICI KARARI 10.11.2026 17:54 UTC; docs/2.5.0-IS-LISTESI.md D): cari kâhini ↔ program adımının YAPIM AŞAMASI listesi
// (test/bagimsiz/cari/YAPIM-ASAMASI.json) yayın adayında BOŞ olmak zorunda — tools/release.mjs dolu listeyle imzalı paket üretmez. Okunamayan / bozuk dosya
// boş SAYILMAZ (ders 4). Dosyalar CRLF de olabilir (ders 27); dosya adı Windows'ta açılır (ders 33; test/platform-tasinabilirlik.test.mjs).
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { yapimAsamasiGate, YAPIM_ASAMASI_YOLU } = await import(pathToFileURL(path.join(ROOT, "tools", "kanit.mjs")).href);
const DIR = mkdtempSync(path.join(os.tmpdir(), "yapim-asamasi-kapisi-"));
after(() => rmSync(DIR, { recursive: true, force: true }));
const yaz = (ad, metin) => {
  const yol = path.join(DIR, ad);
  writeFileSync(yol, metin);
  return yol;
};
const kayit = (anahtar, paket) => ({ senaryo: "d4-c5-s50-tek-kuyruk", anahtar, beklenen: 1, program: 2, sinif: "BULGU KULLANICI", kural: "deneme", paket });

describe("YAPIM AŞAMASI kapısı (yapimAsamasiGate)", () => {
  it("dolu liste → ret; ileti kayıt sayısını ve paket dağılımını söyler", () => {
    const yol = yaz("dolu.json", JSON.stringify({ kayitlar: [kayit("k1:mizan:519", "Ç5-A"), kayit("k1:mizan:500", "Ç5-A"), kayit("k1:cari:A:gecikmis", "Ç5-B tur 2")] }, null, 1));
    const r = yapimAsamasiGate(yol);
    assert.equal(r.ok, false);
    assert.equal(r.sayi, 3);
    assert.deepEqual(r.paketler, { "Ç5-A": 2, "Ç5-B tur 2": 1 });
    assert.match(r.problems.join("\n"), /YAPIM AŞAMASI listesi boş değil: 3 kayıt \(paketlere göre: Ç5-A 2, Ç5-B tur 2 1\)/);
  });
  it("CRLF satır sonlu dolu liste de ret (ders 27)", () => {
    const metin = JSON.stringify({ kayitlar: [kayit("k1:mizan:519", "Ç5-A")] }, null, 1).split("\n").join("\r\n");
    assert.match(metin, /\r\n/);
    const r = yapimAsamasiGate(yaz("crlf.json", metin));
    assert.equal(r.ok, false);
    assert.equal(r.sayi, 1);
  });
  it("boş liste → geçer (LF ve CRLF)", () => {
    const lf = JSON.stringify({ aciklama: "deneme", kayitlar: [] }, null, 1);
    for (const [ad, metin] of [["bos.json", lf], ["bos-crlf.json", lf.split("\n").join("\r\n")]]) {
      const r = yapimAsamasiGate(yaz(ad, metin));
      assert.equal(r.ok, true, ad);
      assert.equal(r.sayi, 0, ad);
      assert.deepEqual(r.problems, [], ad);
    }
  });
  it("dosya yok / bozuk JSON / kayitlar dizisi yok → ret (okunamayan boş sayılmaz, ders 4)", () => {
    const yok = path.join(DIR, "olmayan.json");
    assert.equal(existsSync(yok), false);
    for (const [ad, yol] of [["yok", yok], ["bozuk", yaz("bozuk.json", '{"kayitlar": [')], ["boş dosya", yaz("bos-dosya.json", "")], ["dizi yok", yaz("dizisiz.json", "{}")],
      ["dizi değil", yaz("dizi-degil.json", '{"kayitlar": {}}')], ["null", yaz("null.json", "null")]]) {
      const r = yapimAsamasiGate(yol);
      assert.equal(r.ok, false, ad);
      assert.equal(r.sayi, null, ad);
      assert.match(r.problems.join("\n"), /okunamadı|"kayitlar" dizisi yok/, ad);
      assert.match(r.problems.join("\n"), /boş sayılmaz/, ad);
    }
  });
  it("kapı cari kâhininin okuduğu dosyayı denetler (aynı yol)", () => {
    assert.equal(YAPIM_ASAMASI_YOLU, path.join(ROOT, "test", "bagimsiz", "cari", "YAPIM-ASAMASI.json"));
    const kos = readFileSync(path.join(ROOT, "test", "bagimsiz", "cari", "kos.mjs"), "utf8");
    assert.ok(kos.split(/\r?\n/).some(satir => satir.includes('path.join(HERE, "YAPIM-ASAMASI.json")')), "kos.mjs listeyi aynı adla okumalı");
  });
});

describe("tools/release.mjs YAPIM AŞAMASI kapısı", () => {
  it("depodaki liste doluysa (ya da okunamıyorsa) paket aracı anahtarı okumadan reddeder ve listeyi söyler; boşsa liste iletisi yok", () => {
    const depo = yapimAsamasiGate();
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$/i.test(key)));
    env.PATH = ""; // git / gh bulunamaz → CI kapısı da reddeder; liste kapısı yine iletide görünmeli (ikisi birlikte yazılır)
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "release.mjs"), "--anahtar", path.join(ROOT, "yok-boyle-bir-anahtar.pem")], { cwd: ROOT, env, encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /Doğrulanmamış commit'ten imzalı paket üretilmez/);
    assert.doesNotMatch(r.stderr, /yok-boyle-bir-anahtar|İmza anahtarı bulunamadı/, "kapı anahtardan önce");
    if (depo.ok) assert.doesNotMatch(r.stderr, /YAPIM AŞAMASI/);
    else for (const p of depo.problems) assert.ok(r.stderr.includes(p), `iletide yok: ${p}\n${r.stderr}`);
  });
  it("release.mjs kapıyı atlatma seçeneği vermez (liste yolu dışarıdan verilemez)", () => {
    const kaynak = readFileSync(path.join(ROOT, "tools", "release.mjs"), "utf8");
    assert.ok(kaynak.split(/\r?\n/).some(satir => /const yapim = yapimAsamasiGate\(\);/.test(satir)), "release.mjs varsayılan yolla çağırmalı");
    assert.doesNotMatch(kaynak, /KAHIN_YAPIM_ASAMASI|yapimAsamasiGate\([^)]/);
  });
});
