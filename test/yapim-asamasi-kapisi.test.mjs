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
import { removeTestDir } from "./helpers.mjs";

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
  // Birleşik tur 6 (dar kontrol DK-D2T3 DÜŞÜK-7, yaşayan mutant C1): koşucunun adım eşlemesini bekleyen kayıtlar ("eşleme" paketi) da sayılır — liste YALNIZ onlardan
  // oluşsa da yayın adayı olmaz (S100: liste BOŞ olmak zorunda).
  it("yalnız 'eşleme' paketli kayıtlar → yine ret (sayılır; paket dağılımında görünür)", () => {
    const r = yapimAsamasiGate(yaz("esleme.json", JSON.stringify({ kayitlar: [kayit("k1:mizan:519", "eşleme"), kayit("k1:mizan:500", "eşleme")] }, null, 1)));
    assert.deepEqual({ ok: r.ok, sayi: r.sayi, paketler: r.paketler }, { ok: false, sayi: 2, paketler: { eşleme: 2 } });
    assert.match(r.problems.join("\n"), /YAPIM AŞAMASI listesi boş değil: 2 kayıt \(paketlere göre: eşleme 2\)/);
  });
  // Birleşik tur 6 (DK-D2T3 DÜŞÜK-7, mutant C3): varsayılan yol aracın KENDİ deposundan çözülür — çalışma dizinine bağlı değildir (release.mjs başka klasörden de çağrılabilir).
  it("varsayılan yol çalışma dizininden bağımsız: başka klasörden çağrılınca da depodaki listeyi okur (aynı sonuç)", () => {
    const burada = yapimAsamasiGate();
    const kod = `const k = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "tools", "kanit.mjs")).href)}); const r = k.yapimAsamasiGate(); console.log(JSON.stringify({ ok: r.ok, sayi: r.sayi, problems: r.problems }));`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", kod], { cwd: DIR, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1)), { ok: burada.ok, sayi: burada.sayi, problems: burada.problems });
    assert.notEqual(burada.sayi, null, "depodaki liste okunabilmeli (okunamadı iletisi değil)");
  });
  // Birleşik tur 7 İş 5 (dar kontrol DK-B6 DÜŞÜK-2, yaşayan mutant M8 `commit = false`): tools/release.mjs kapıyı bağımsız değişkensiz çağırır (`yapimAsamasiGate()`) —
  // varsayılan çağrı da listeyi COMMIT'le karşılaştırmalı (skip-worktree atlatması yalnız açık `commit: true` ile kapanmış olmasın).
  it("varsayılan çağrı (release.mjs'in yolu: yol ve commit verilmez) listeyi commit'le karşılaştırır; başka yolda karşılaştırmaz", () => {
    assert.ok(readFileSync(path.join(ROOT, "tools", "release.mjs"), "utf8").split(/\r?\n/).some(satir => /yapimAsamasiGate\(\)/.test(satir)), "release.mjs kapıyı varsayılanla çağırıyor (ön koşul)");
    const baska = JSON.stringify({ aciklama: "commit'teki", kayitlar: Array.from({ length: 7 }, (_, i) => kayit(`k${i}:mizan:519`, "M8")) }, null, 1);
    const sahte = (...args) => ((args[0] === "--no-replace-objects" ? args.slice(1) : args)[0] === "show" ? baska : null);
    const varsayilan = yapimAsamasiGate(undefined, { gitFn: sahte });
    const ayniYol = yapimAsamasiGate(YAPIM_ASAMASI_YOLU, { gitFn: sahte });
    const baskaYol = yapimAsamasiGate(yaz("baska.json", JSON.stringify({ kayitlar: [] })), { gitFn: sahte });
    const farkli = r => r.problems.some(p => /çalışma ağacında commit'tekinden FARKLI \(commit'te 7,/.test(p));
    assert.deepEqual({ varsayilan: farkli(varsayilan), ayniYol: farkli(ayniYol), baskaYol: [baskaYol.ok, farkli(baskaYol)] }, { varsayilan: true, ayniYol: true, baskaYol: [true, false] });
  });
  it("kapı cari kâhininin okuduğu dosyayı denetler (aynı yol)", () => {
    assert.equal(YAPIM_ASAMASI_YOLU, path.join(ROOT, "test", "bagimsiz", "cari", "YAPIM-ASAMASI.json"));
    const kos = readFileSync(path.join(ROOT, "test", "bagimsiz", "cari", "kos.mjs"), "utf8");
    assert.ok(kos.split(/\r?\n/).some(satir => satir.includes('path.join(HERE, "YAPIM-ASAMASI.json")')), "kos.mjs listeyi aynı adla okumalı");
  });
});

// Birleşik tur 6 (dar kontrol DK-D2T3 DOĞRULANMADI → denendi): `git update-index --skip-worktree` ile listenin çalışma ağacında boşaltılması `git status --porcelain`'de
// görünmüyor (temiz ağaç denetimi geçer) ve kapı çalışma ağacının BOŞ listesini okuyup geçiyordu. Kapı artık listeyi commit'ten de okur; farklıysa ret.
describe("YAPIM AŞAMASI kapısı — liste commit'ten de okunur (skip-worktree / assume-unchanged atlatması)", () => {
  const listeMetni = kayitlar => JSON.stringify({ aciklama: "deneme", kayitlar }, null, 1);
  const dolu = [kayit("k1:mizan:519", "Ç5-A"), kayit("k1:mizan:500", "Ç5-A")];
  // Kapı listeyi `git --no-replace-objects show HEAD:<yol>` ile okur (birleşik tur 7); sahte git baştaki bayrağı atlar.
  const sahteGit = icerik => (...args) => {
    const rest = args[0] === "--no-replace-objects" ? args.slice(1) : args;
    return rest[0] === "show" && rest[1] === "HEAD:liste.json" ? icerik : null;
  };
  it("çalışma ağacında boş, commit'te dolu → ret: 'FARKLI' + 'commit'te boş değil'; ikisi aynıysa (CRLF ↔ LF dahil) geçer; commit'ten okunamıyor / bozuk → ret", () => {
    const yol = yaz("liste.json", listeMetni([]));
    const atlatma = yapimAsamasiGate(yol, { commit: true, kok: DIR, gitFn: sahteGit(listeMetni(dolu)) });
    const ayni = yapimAsamasiGate(yaz("liste.json", listeMetni([]).split("\n").join("\r\n")), { commit: true, kok: DIR, gitFn: sahteGit(listeMetni([])) });
    const okunamadi = yapimAsamasiGate(yol, { commit: true, kok: DIR, gitFn: sahteGit(null) });
    const bozuk = yapimAsamasiGate(yol, { commit: true, kok: DIR, gitFn: sahteGit('{"kayitlar": [') });
    assert.deepEqual(
      { atlatma: [atlatma.ok, atlatma.problems.some(p => /çalışma ağacında commit'tekinden FARKLI \(commit'te 2, çalışma ağacında 0 kayıt\)/.test(p)), atlatma.problems.some(p => /commit'te boş değil: 2 kayıt/.test(p))], ayni: [ayni.ok, ayni.problems], okunamadi: [okunamadi.ok, /commit'ten okunamadı \(git show HEAD:liste\.json\)/.test(okunamadi.problems.join("\n"))], bozuk: [bozuk.ok, /okunamadı \(HEAD:liste\.json/.test(bozuk.problems.join("\n"))] },
      { atlatma: [false, true, true], ayni: [true, []], okunamadi: [false, true], bozuk: [false, true] },
    );
  });
  it("gerçek git: dolu liste commit'lenir, skip-worktree işaretlenir, çalışma ağacında boşaltılır → git status temiz (ön koşul), kapı ret; işaret yoksa status 'M' gösterir", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "yapim-asamasi-git-"));
    try {
      const git = (...args) => {
        const r = spawnSync("git", ["-C", repo, "-c", "user.name=Deneme", "-c", "user.email=deneme@example.invalid", "-c", "core.autocrlf=false", ...args], { encoding: "utf8" });
        return r.status === 0 ? r.stdout.trim() : null;
      };
      const yol = path.join(repo, "liste.json");
      assert.notEqual(git("init", "-q"), null, "git init");
      writeFileSync(yol, listeMetni(dolu));
      assert.notEqual(git("add", "liste.json"), null);
      assert.notEqual(git("commit", "-q", "-m", "liste"), null);
      assert.notEqual(git("update-index", "--skip-worktree", "liste.json"), null);
      writeFileSync(yol, listeMetni([]));
      const status = git("status", "--porcelain");
      assert.equal(status, "", "ön koşul (ders 20): skip-worktree işaretli dosyanın değişikliği git status'ta GÖRÜNMEZ");
      const kapi = yapimAsamasiGate(yol, { commit: true, kok: repo, gitFn: git });
      const yalnizAgac = yapimAsamasiGate(yol);
      assert.notEqual(git("update-index", "--no-skip-worktree", "liste.json"), null);
      assert.deepEqual(
        { kapi: kapi.ok, neden: kapi.problems.some(p => /FARKLI/.test(p)), yalnizAgac: yalnizAgac.ok, isaretsizStatus: git("status", "--porcelain") },
        { kapi: false, neden: true, yalnizAgac: true, isaretsizStatus: "M liste.json" },
        "commit'le karşılaştırmayan kapı (eski davranış) bu durumda GEÇERDİ",
      );
    } finally {
      // Windows (ders 48): git nesne dosyaları salt okunur — temizlik hatası asıl sonucu ezmez (removeTestDir yineler, Windows'ta uyarıyla bırakır).
      removeTestDir(repo);
    }
  });
  // Birleşik tur 7 (dar kontrol DK-B6 DÜŞÜK-3): `git replace <commit'teki dolu listenin blob'u> <boş listenin blob'u>` + skip-worktree + çalışma ağacında boş liste →
  // git status temiz VE `git show HEAD:<yol>` boş listeyi verir; kapı geçiyordu. Kapı artık yerine koyma nesnelerini okumaz (`--no-replace-objects`) → ret.
  it("gerçek git: replace + skip-worktree → git status temiz ve bayraksız 'git show' boş liste (ön koşul), kapı ret (yerine koyma okunmaz)", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "yapim-asamasi-replace-"));
    try {
      const git = (...args) => {
        const r = spawnSync("git", ["-C", repo, "-c", "user.name=Deneme", "-c", "user.email=deneme@example.invalid", "-c", "core.autocrlf=false", ...args], { encoding: "utf8" });
        return r.status === 0 ? r.stdout.trim() : null;
      };
      const yol = path.join(repo, "liste.json");
      assert.notEqual(git("init", "-q"), null, "git init");
      writeFileSync(yol, listeMetni(dolu));
      assert.notEqual(git("add", "liste.json"), null);
      assert.notEqual(git("commit", "-q", "-m", "liste"), null);
      const doluBlob = git("rev-parse", "HEAD:liste.json");
      const bos = path.join(repo, "bos.json");
      writeFileSync(bos, listeMetni([]));
      const bosBlob = git("hash-object", "-w", "bos.json");
      rmSync(bos);
      assert.notEqual(git("replace", doluBlob, bosBlob), null, "git replace");
      assert.notEqual(git("update-index", "--skip-worktree", "liste.json"), null);
      writeFileSync(yol, listeMetni([]));
      const onKosul = { status: git("status", "--porcelain"), bayraksizShow: JSON.parse(git("show", "HEAD:liste.json")).kayitlar.length };
      assert.deepEqual(onKosul, { status: "", bayraksizShow: 0 }, "ön koşul (ders 20): ağaç temiz görünür, bayraksız git show yerine koyulan BOŞ listeyi verir");
      const kapi = yapimAsamasiGate(yol, { commit: true, kok: repo, gitFn: git });
      assert.deepEqual({ kapi: kapi.ok, farkli: kapi.problems.some(p => /FARKLI \(commit'te 2, çalışma ağacında 0 kayıt\)/.test(p)), bosDegil: kapi.problems.some(p => /commit'te boş değil: 2 kayıt/.test(p)) }, { kapi: false, farkli: true, bosDegil: true });
    } finally {
      removeTestDir(repo);
    }
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
