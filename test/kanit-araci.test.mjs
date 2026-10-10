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

// ---- Doğrulama kapısı (10.10.2026; kullanıcı: "yapmadığı işi yapılmış, doğrulamadığı sonucu doğrulanmış gösteremeyen süreç") ----
const { ciState, gateVerdict, machineState, hookDecision, releaseGate, GATE_JOB } = await import(pathToFileURL(TOOL).href);
const SHA = "a".repeat(40);
const fakeGit = (over = {}) => (...args) => {
  const key = args.join(" ");
  if (key in over) return over[key];
  if (key === `rev-parse ${SHA}` || key === "rev-parse HEAD") return SHA;
  if (key === "remote get-url origin") return "https://github.com/ceougur/ofis---y-netimi";
  if (key === "status --porcelain") return "";
  if (key === "rev-parse --abbrev-ref --symbolic-full-name @{u}") return "origin/dal";
  if (key === "rev-list --count @{u}..HEAD") return "0";
  return null;
};
const job = (name, status = "completed", conclusion = "success") => ({ name, status, conclusion });
const fakeGh = runs => args => {
  const url = args[0];
  if (url.includes("/actions/runs?head_sha=")) return { workflow_runs: runs.map((run, index) => ({ id: index + 1, path: ".github/workflows/ci.yml", name: "CI", run_number: 500 + index, event: "push", html_url: "u", status: "completed", conclusion: "success", ...run })) };
  const id = Number(url.match(/runs\/(\d+)\/jobs/)[1]);
  return { jobs: runs[id - 1].jobs };
};
const ALL = [job("Test (ubuntu-latest, Node 22)"), job("Test (windows-latest, Node 22)"), job("Uçtan uca (Chromium)"), job(GATE_JOB), job("Dağıtım paketi")];

describe("doğrulama kapısı: CI okuma (yalnız ci.yml, kapı işi şart)", () => {
  const state = runs => ciState(SHA, { gh: fakeGh(runs), gitFn: fakeGit() });
  it("bütün işler başarılı ve kapı işi var → YEŞİL", () => assert.equal(state([{ jobs: ALL }]).result, "YEŞİL"));
  it("Windows işi kırmızı → KIRMIZI (Linux yeşili yetmez)", () => {
    const jobs = ALL.map(item => (item.name.includes("windows") ? job(item.name, "completed", "failure") : item));
    assert.equal(state([{ jobs, conclusion: "failure" }]).result, "KIRMIZI");
  });
  it("atlanan iş yeşil sayılmaz", () => assert.equal(state([{ jobs: ALL.map(item => (item.name === "Dağıtım paketi" ? job(item.name, "completed", "skipped") : item)) }]).result, "KIRMIZI"));
  it("kapı işi olmayan (eski) commit YEŞİL değil", () => {
    const result = state([{ jobs: ALL.filter(item => item.name !== GATE_JOB) }]);
    assert.equal(result.result, "KIRMIZI");
    assert.match(result.reason, /işi yok/);
  });
  it("koşu sürüyorsa, listedeki işler yeşil olsa da BEKLİYOR", () => assert.equal(state([{ status: "in_progress", conclusion: null, jobs: ALL.slice(0, 3) }]).result, "BEKLİYOR"));
  it("aynı commit'in ikinci koşusu kırmızıysa YEŞİL değil", () => assert.equal(state([{ jobs: ALL }, { jobs: [job("Test (windows-latest, Node 24)", "completed", "failure")] }]).result, "KIRMIZI"));
  it("başka iş akışlarının koşuları (ör. yayın) hükme girmez", () => {
    const gh = args => (args[0].includes("head_sha") ? { workflow_runs: [{ id: 1, path: ".github/workflows/ci.yml", name: "CI", status: "completed", conclusion: "success" }, { id: 2, path: ".github/workflows/release.yml", name: "R", status: "in_progress" }] } : { jobs: args[0].includes("runs/1/") ? ALL : [job("x", "in_progress", null)] });
    assert.equal(ciState(SHA, { gh, gitFn: fakeGit() }).result, "YEŞİL");
  });
  it("GitHub okunamazsa ya da koşu yoksa BELİRSİZ (asla YEŞİL değil)", () => {
    assert.equal(ciState(SHA, { gh: () => { throw new Error("403"); }, gitFn: fakeGit() }).result, "BELİRSİZ");
    assert.equal(state([]).result, "BELİRSİZ");
  });
});

describe("doğrulama kapısı: CI'deki kapı işinin hükmü", () => {
  const rec = (ad, over = {}) => ({ ad, hukum: "GEÇTİ", commit: SHA, kirli: 0, izlenmeyen: 0, ozet: { toplam: 1538, gecen: 1538, basarisiz: 0, iptal: 0, atlanan: 0 }, ...over });
  const four = ["ubuntu-latest-node22", "ubuntu-latest-node24", "windows-latest-node22", "windows-latest-node24"].map(name => rec(`npm-test-${name}`));
  const expected = four.map(item => item.ad).concat("e2e-e2e");
  const verdictOf = (records, needs = { test: { result: "success" }, e2e: { result: "success" } }) => gateVerdict({ records, commit: SHA, expected, sameCount: ["npm-test-"], noSkip: ["npm-test-"], needs });
  const e2e = rec("e2e-e2e", { ozet: { toplam: 50, gecen: 50, basarisiz: 0, iptal: 0, atlanan: 0 } });
  it("dört platform + e2e, aynı sayı, bu commit → geçer", () => assert.deepEqual(verdictOf([...four, e2e]), { ok: true, problems: [] }));
  it("Windows kaydı yoksa geçmez", () => assert.match(verdictOf([...four.slice(0, 3), e2e]).problems.join(), /windows-latest-node24: kayıt yok/));
  it("çelişkili kayıt (çıkış 0, özette başarısız) geçmez", () => assert.equal(verdictOf([...four.slice(1), rec("npm-test-ubuntu-latest-node22", { hukum: "ÇELİŞKİ" }), e2e]).ok, false));
  it("Windows Linux'tan az test koştuysa geçmez", () => {
    const fewer = rec("npm-test-windows-latest-node22", { ozet: { toplam: 1500, gecen: 1500, basarisiz: 0, iptal: 0, atlanan: 0 } });
    assert.match(verdictOf([...four.filter(item => item.ad !== fewer.ad), fewer, e2e]).problems.join(), /farklı sayıda test/);
  });
  it("atlanan test varsa geçmez (o platformda doğrulanmadı)", () => {
    const skipped = rec("npm-test-windows-latest-node24", { ozet: { toplam: 1538, gecen: 1530, basarisiz: 0, iptal: 0, atlanan: 8 } });
    assert.match(verdictOf([...four.filter(item => item.ad !== skipped.ad), skipped, e2e]).problems.join(), /8 test atlandı/);
  });
  it("başka commit'te ya da değişmiş ağaçta koşan kayıt geçmez", () => {
    assert.equal(verdictOf([...four.slice(1), rec("npm-test-ubuntu-latest-node22", { commit: "b".repeat(40) }), e2e]).ok, false);
    assert.equal(verdictOf([...four.slice(1), rec("npm-test-ubuntu-latest-node22", { kirli: 2 }), e2e]).ok, false);
  });
  it("işin kendisi kırmızıysa (needs) kayıtlar temiz olsa da geçmez", () => assert.equal(verdictOf([...four, e2e], { test: { result: "failure" }, e2e: { result: "success" } }).ok, false));
  it("aynı adla iki kayıt (biri eski) geçmez", () => assert.match(verdictOf([...four, four[0], e2e]).problems.join(), /iki kayıt/));
});

describe("doğrulama kapısı: Stop kancası ve imzalı paket kapısı", () => {
  const ci = result => () => ({ commit: SHA, result, reason: result === "YEŞİL" ? "" : "x", runs: [{ jobs: [job("Test (windows-latest, Node 22)", "in_progress", null)] }] });
  it("her şey yeşilse kanca durdurmaz", () => assert.equal(hookDecision({}, machineState({ gitFn: fakeGit(), ciFn: ci("YEŞİL") })).code, 0));
  it("CI sürerken/kırmızıyken kanca yanıtı BİR KEZ durdurur ve gerçek durumu verir", () => {
    for (const result of ["BEKLİYOR", "KIRMIZI", "BELİRSİZ"]) {
      const decision = hookDecision({ stop_hook_active: false }, machineState({ gitFn: fakeGit(), ciFn: ci(result) }));
      assert.equal(decision.code, 2, result);
      assert.match(decision.message, new RegExp(`CI ${result}`));
      assert.match(decision.message, /windows-latest, Node 22\): sürüyor/);
      assert.equal(hookDecision({ stop_hook_active: true }, machineState({ gitFn: fakeGit(), ciFn: ci(result) })).code, 0, "ikinci denemede döngü yok");
    }
  });
  it("CI yeşil ama gönderilmemiş commit ya da değişmiş dosya varsa kanca durdurur", () => {
    assert.equal(hookDecision({}, machineState({ gitFn: fakeGit({ "rev-list --count @{u}..HEAD": "2" }), ciFn: ci("YEŞİL") })).code, 2);
    assert.equal(hookDecision({}, machineState({ gitFn: fakeGit({ "status --porcelain": " M server/app.mjs" }), ciFn: ci("YEŞİL") })).code, 2);
    assert.equal(hookDecision({}, machineState({ gitFn: fakeGit({ "rev-parse --abbrev-ref --symbolic-full-name @{u}": null }), ciFn: ci("YEŞİL") })).code, 2);
  });
  it("imzalı paket kapısı: değişmiş/izlenmeyen dosya ya da yeşil olmayan CI → ret; temiz + YEŞİL → izin", () => {
    assert.equal(releaseGate({ gitFn: fakeGit({ "status --porcelain": "?? yeni.mjs" }), ciFn: ci("YEŞİL") }).ok, false);
    for (const result of ["BEKLİYOR", "KIRMIZI", "BELİRSİZ"]) assert.equal(releaseGate({ gitFn: fakeGit(), ciFn: ci(result) }).ok, false, result);
    assert.equal(releaseGate({ gitFn: fakeGit({ "status --porcelain": null }), ciFn: ci("YEŞİL") }).ok, false);
    assert.equal(releaseGate({ gitFn: fakeGit(), ciFn: ci("YEŞİL") }).ok, true);
  });
  it("tools/release.mjs CI/git okunamayınca anahtarı okumadan reddeder (atlatma seçeneği yok)", () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$/i.test(key)));
    env.PATH = "";
    const result = spawnSync(process.execPath, [path.join(ROOT, "tools", "release.mjs"), "--anahtar", path.join(ROOT, "yok-boyle-bir-anahtar.pem")], { cwd: ROOT, env, encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Doğrulanmamış commit'ten imzalı paket üretilmez/);
    assert.doesNotMatch(result.stderr, /ENOENT|anahtar/i, "kapı anahtardan önce");
  });
});
