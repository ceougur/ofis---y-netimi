// Kanıt kaydı aracı (tools/kanit.mjs, 10.10.2026): "geçti" yalnız gerçek çıkış kodu + tanınan özet + 0 başarısız ile verilir.
// Geçmiş hatalar: yalnız Linux'ta geçen testler "geçti" sayıldı; reddedilen istekler "✓" sayıldı; boş günlükten başarı tablosu
// üretildi. Bu test aracın o yanlışları yapmadığını sınar (CLAUDE.md → "Geçmiş test hatalarından dersler" 2, 4, 16).
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(ROOT, "tools", "kanit.mjs");
const { parseSummary, verdict } = await import(pathToFileURL(TOOL).href);

describe("kanıt aracı: özet satırları", () => {
  it("node:test TAP ve spec biçimleri; son özet alınır", () => {
    const tap = "# tests 99\n# pass 99\n# fail 0\nara çıktı\n# tests 12\n# suites 2\n# pass 10\n# fail 1\n# cancelled 1\n# skipped 0\n# todo 0\n";
    assert.deepEqual(parseSummary(tap), { bicim: "node:test", toplam: 12, gecen: 10, basarisiz: 1, iptal: 1, atlanan: 0 });
    const spec = "\x1b[34mℹ tests 4\x1b[39m\nℹ pass 3\nℹ fail 0\nℹ cancelled 0\nℹ skipped 1\nℹ todo 0\n";
    assert.deepEqual(parseSummary(spec), { bicim: "node:test", toplam: 4, gecen: 3, basarisiz: 0, iptal: 0, atlanan: 1 });
  });
  it("projedeki arayüz senaryosu biçimleri", () => {
    assert.equal(parseSummary("Senaryo 2.0.22: 56 geçti, 0 kaldı. Ekranlar: x").basarisiz, 0);
    assert.equal(parseSummary("BAŞARISIZ: 50 denetim geçti, 3 başarısız.").basarisiz, 3);
    assert.deepEqual(parseSummary("\n57/60 denetim geçti. Ekran görüntüleri: x"), { bicim: "senaryo", toplam: 60, gecen: 57, basarisiz: 3, iptal: 0, atlanan: 0 });
    assert.equal(parseSummary("12 / 12 kontrol geçti.").toplam, 12);
    assert.equal(parseSummary("\n50 adım başarılı.").gecen, 50);
    assert.equal(parseSummary("410/410 dosya sözdizimi denetiminden geçti.").basarisiz, 0);
  });
  it("mutabakat ve güvenilirlik koşucuları; yarıda kalan tohum iptal sayılır", () => {
    const mut = "Tohum 1: 5000 işlem\n  ✓ Her işlemden sonra Kasa …\nTohum 2: 5000 işlem\n  ✗ UYUŞMAZLIK (2):\nTohum 3: 10 işlem\n";
    assert.deepEqual(parseSummary(mut), { bicim: "mutabakat", toplam: 3, gecen: 1, basarisiz: 1, iptal: 1, atlanan: 0 });
    const guv = "\n✓ Tohum 1 · taban bos: 1000 işlem\n\n✗ değişmez kural bozuldu\n";
    assert.deepEqual(parseSummary(guv), { bicim: "guvenilirlik", toplam: 2, gecen: 1, basarisiz: 1, iptal: 0, atlanan: 0 });
  });
  it("tanınmayan ya da boş çıktı özet sayılmaz", () => {
    assert.equal(parseSummary(""), null);
    assert.equal(parseSummary("her şey yolunda ✓"), null);
  });
});

describe("kanıt aracı: hüküm", () => {
  const sum = (over = {}) => ({ bicim: "node:test", toplam: 10, gecen: 10, basarisiz: 0, iptal: 0, atlanan: 0, ...over });
  it("GEÇTİ yalnız çıkış 0 + özet temiz + en az bir test", () => {
    assert.equal(verdict({ exitCode: 0, summary: sum() }).hukum, "GEÇTİ");
    assert.equal(verdict({ exitCode: 0, summary: sum({ toplam: 0, gecen: 0 }) }).hukum, "BELİRSİZ");
    assert.equal(verdict({ exitCode: 0, summary: null }).hukum, "BELİRSİZ");
  });
  it("çıkış kodu ile özet çelişirse ÇELİŞKİ (geçmedi)", () => {
    assert.equal(verdict({ exitCode: 0, summary: sum({ basarisiz: 1, gecen: 9 }) }).hukum, "ÇELİŞKİ");
    assert.equal(verdict({ exitCode: 0, summary: sum({ iptal: 1, gecen: 9 }) }).hukum, "ÇELİŞKİ");
    assert.equal(verdict({ exitCode: 1, summary: sum() }).hukum, "ÇELİŞKİ");
  });
  it("başarısız, yarıda, başlatılamayan", () => {
    assert.equal(verdict({ exitCode: 1, summary: sum({ basarisiz: 2, gecen: 8 }) }).hukum, "BAŞARISIZ");
    assert.equal(verdict({ exitCode: 1, summary: null }).hukum, "BAŞARISIZ");
    assert.equal(verdict({ exitCode: null, summary: null }).hukum, "BAŞARISIZ");
    assert.equal(verdict({ exitCode: null, signal: "SIGKILL", summary: sum() }).hukum, "YARIDA");
    assert.equal(verdict({ exitCode: null, timedOut: true, summary: null }).hukum, "YARIDA");
  });
});

describe("kanıt aracı: gerçek koşu kaydı", () => {
  const runTool = (dir, name, script) =>
    spawnSync(process.execPath, [TOOL, "kos", name, "--", process.execPath, "-e", script], { env: { ...process.env, KANIT_DIR: dir }, encoding: "utf8" });
  const recordOf = (dir, name) => {
    const day = readdirSync(dir)[0];
    return JSON.parse(readFileSync(path.join(dir, day, `${name}.json`), "utf8"));
  };

  it("geçen komut: çıkış 0, kayıt GEÇTİ, ham çıktı ve sha256 yazılır", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kanit-"));
    try {
      const result = runTool(dir, "iyi", "console.log('# tests 3\\n# pass 3\\n# fail 0\\n# cancelled 0')");
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const record = recordOf(dir, "iyi");
      assert.equal(record.hukum, "GEÇTİ");
      assert.equal(record.cikis_kodu, 0);
      assert.equal(record.ozet.toplam, 3);
      assert.match(record.ham_cikti_sha256, /^[0-9a-f]{64}$/);
      assert.ok(record.commit === null || /^[0-9a-f]{40}$/.test(record.commit));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("özetinde başarısız olan ama 0 ile çıkan komut GEÇMEZ (çelişki), araç 1 döner", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kanit-"));
    try {
      const result = runTool(dir, "celiski", "console.log('# tests 3\\n# pass 2\\n# fail 1\\n# cancelled 0')");
      assert.equal(result.status, 1);
      assert.equal(recordOf(dir, "celiski").hukum, "ÇELİŞKİ");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("özetsiz 0 çıkış BELİRSİZ; 3 ile çıkan komut BAŞARISIZ ve gerçek kodu kaydedilir", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kanit-"));
    try {
      assert.equal(runTool(dir, "sessiz", "console.log('tamam')").status, 1);
      assert.equal(recordOf(dir, "sessiz").hukum, "BELİRSİZ");
      assert.equal(runTool(dir, "dusen", "console.log('1 / 2 kontrol geçti.'); process.exit(3)").status, 1);
      const record = recordOf(dir, "dusen");
      assert.equal(record.hukum, "BAŞARISIZ");
      assert.equal(record.cikis_kodu, 3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
