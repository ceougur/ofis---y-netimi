// 2.1.0 — rapor iş parçacığının kapanış, zaman aşımı ve hata yolları (hız düzeltmesinin bağımsız incelemesi H1–H3, 11.10.2026;
// docs/kanit/2026-10-11/hiz-inceleme; lib/report-runner.mjs). Ön koşullar gerçek iş parçacığı + sınama girişiyle ZORLA kurulur (ders 20):
// test/fixtures/rapor-is-parcacigi-sinama.mjs (bekle: sonlandırılabilir bekleme sonra gerçek rapor; bozuk: SQLite hatası; sql: sonlandırılamayan
// uzun sorgu).
// ÇALIŞIYOR MU:
//   H1 — rapor sürerken şirket geri yüklenir ya da silinirse çalışan VE sırada bekleyen rapor 503 "report-interrupted" + "Şirket verisi şu anda
//        değiştiriliyor…" alır; geri yükleme/silme 200; sunucu günlüğüne ERROR yazılmaz. Sunucunun kendi kapanışında 503 "report-closed".
//   H2 — zaman aşımında istek hemen 503 alır ama iş parçacığının yuvası GERÇEKTEN kapanana kadar dolu kalır: aynı anda en çok `max`;
//        close() sorgusu süren iş parçacığını bekler; sonra veri dosyasında açık tanıtıcı yok (Windows'ta EBUSY olmasın), dosya taşınabilir.
//   H3 — iş parçacığındaki beklenmeyen hata (HttpError değil) yerinde hazırlanan rapordaki gibi: kullanıcıya "Sunucu işlemi tamamlayamadı.",
//        günlüğe yığınıyla ERROR; bilinçli hatalar (404 hesap, 400 süzgeç) aynen.
// NASIL BOZARIM: kapanışı rapor sürerken tetikle (geri yükleme, silme, kapanış); zaman aşımını sorgu ortasına denk getir; olmayan dosya.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readlinkSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createApp } from "../server/app.mjs";
import { HttpError } from "../server/lib/http.mjs";
import { createReportRunner } from "../server/lib/report-runner.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const ENTRY = new URL("./fixtures/rapor-is-parcacigi-sinama.mjs", import.meta.url);
const COMPANY_MSG = "Şirket verisi şu anda değiştiriliyor (geri yükleme, silme ya da sıfırlama); raporu birkaç saniye sonra yeniden açın.";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const outcome = promise => promise.then(
  value => ({ ok: true, value }),
  error => ({ ok: false, http: error instanceof HttpError, status: error?.status ?? null, code: error?.extra?.code ?? null, message: String(error?.message || error), stack: String(error?.stack || "") }),
);
// Linux'ta süreçte bir dosyaya açık tanıtıcılar (/proc/self/fd); öbür platformlarda null (denetim dosya taşımayla yapılır).
const openHandles = file => {
  if (process.platform !== "linux") return null;
  return readdirSync("/proc/self/fd").filter(fd => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`).startsWith(file);
    } catch {
      return false;
    }
  }).length;
};

describe("rapor iş parçacığı (doğrudan): kapanış nedeni, zaman aşımında yuva ve tanıtıcı, beklenmeyen hata", () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-rapor-kapanis-"));
  after(() => rmSync(root, { recursive: true, force: true }));
  const job = (sinama, extra = {}) => ({ dbPath: path.join(root, "yok.sqlite"), time: new Date().toISOString(), id: "banka-hareket", query: {}, user: { id: "u", perms: new Set(["bank.reports"]) }, limit: 1, sinama, ...extra });

  it("H1: şirket kapanışında çalışan ve sıradaki rapor 503 report-interrupted (Türkçe neden); sunucu kapanışında 503 report-closed", async () => {
    const runner = createReportRunner({ max: 1, entry: ENTRY });
    const running = outcome(runner.run(job("bekle:5000")));
    const queued = outcome(runner.run(job("bekle:5000")));
    await wait(300);
    assert.equal(runner.stats.active, 1, "bir rapor çalışıyor");
    await runner.close({ reason: "company" });
    for (const [label, result] of [["çalışan", await running], ["sıradaki", await queued]]) {
      assert.equal(result.ok, false, label);
      assert.equal(result.http, true, `${label}: HttpError (500'e dönmesin): ${result.message}`);
      assert.equal(result.status, 503, label);
      assert.equal(result.code, "report-interrupted", label);
      assert.equal(result.message, COMPANY_MSG, label);
    }
    const late = await outcome(runner.run(job("bekle:10")));
    assert.equal(late.code, "report-interrupted", "kapandıktan sonra gelen istek de aynı nedenle");

    const shut = createReportRunner({ max: 1, entry: ENTRY });
    const during = outcome(shut.run(job("bekle:5000")));
    await wait(300);
    await shut.close();
    const result = await during;
    assert.equal(result.http, true, result.message);
    assert.equal(result.status, 503);
    assert.equal(result.code, "report-closed");
    assert.match(result.message, /Sunucu kapanıyor/);
  });

  it("H2: zaman aşımında istek hemen 503 alır ama sorgusu süren iş parçacığı yuvayı tutar (en çok max); close() onu bekler, dosya serbest", async () => {
    const file = path.join(root, "uzun.sqlite");
    const counter = new SharedArrayBuffer(4);
    const started = () => Atomics.load(new Int32Array(counter), 0);
    // Sonlandırılamayan sorgu (~2 sn bu makinede; inceleme E2: terminate SQLite sorgusunun ortasında etkisiz).
    const runner = createReportRunner({ max: 2, timeoutMs: 100, entry: ENTRY });
    const t0 = Date.now();
    const jobs = Array.from({ length: 4 }, () => outcome(runner.run(job("sql:10000000", { file, sayac: counter }))));
    const first = await Promise.race(jobs);
    const timedOutAt = Date.now() - t0;
    assert.equal(first.code, "report-timeout", JSON.stringify(first));
    assert.ok(timedOutAt < 1500, `zaman aşımı yanıtı hemen (${timedOutAt} ms)`);
    await wait(600);
    const midway = started();
    const sqlStillRunning = runner.stats.live;
    assert.ok(midway <= 2, `zaman aşımından sonra yeni iş parçacığı açılmadı: başlayan ${midway} (en çok 2)`);
    assert.ok(sqlStillRunning >= 1 && sqlStillRunning <= 2, `sorgusu süren iş parçacığı yuvada: ${sqlStillRunning}`);
    const c0 = Date.now();
    await runner.close();
    const closeMs = Date.now() - c0;
    assert.equal(runner.stats.live, 0, "kapanıştan sonra yaşayan iş parçacığı yok");
    assert.equal(runner.stats.active, 0);
    // Kapanış, sorgusu süren iş parçacığını bekledi: bitti dediğinde veri dosyası serbest.
    const handles = openHandles(file);
    if (handles !== null) assert.equal(handles, 0, `close() sonrası ${file} için açık tanıtıcı ${handles} (close ${closeMs} ms)`);
    if (existsSync(file)) {
      renameSync(file, `${file}.tasindi`);
      rmSync(`${file}.tasindi`, { force: true });
    }
    for (const result of await Promise.all(jobs)) {
      assert.equal(result.http, true, result.message);
      assert.equal(result.status, 503);
      assert.ok(["report-timeout", "report-closed"].includes(result.code), result.code);
    }
    assert.ok(started() <= 2, `toplam başlayan ${started()} (sıradakiler kapanışta düştü)`);
  });

  it("H3: iş parçacığındaki beklenmeyen hata HttpError değil (günlüğe yazılsın, kullanıcıya genel ileti); yığın iş parçacığının", async () => {
    const runner = createReportRunner({ entry: ENTRY });
    const result = await outcome(runner.run(job("bozuk")));
    await runner.close();
    assert.equal(result.ok, false);
    assert.equal(result.http, false, `beklenmeyen hata HttpError olarak dönmemeli (ham ileti kullanıcıya gider): ${result.status} ${result.message}`);
    assert.match(result.message, /Rapor iş parçacığında hata/);
    assert.match(result.stack, /iş parçacığı yığını/);
  });
});

describe("rapor iş parçacığı (sunucu üzerinden): şirket geri yükleme/silme sırasında rapor, beklenmeyen hata", () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-rapor-kapanis-http-"));
  const lines = [];
  const quiet = () => {};
  const log = { debug: quiet, info: quiet, warn: quiet, error: (message, meta) => lines.push(`${message} ${meta instanceof Error ? meta.stack || meta.message : meta ?? ""}`) };
  let app;
  let client;
  let second;
  const companyCall = (method, url, body) => client.raw(method, url, { body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const report = (company, query = "preset=all") =>
    client.get(`/api/workspace/report-center/banka-hareket?${query}&hofCompany=${encodeURIComponent(company)}`).then(res => ({ status: res.status, code: res.data?.code, error: res.data?.error }));
  before(async () => {
    app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), log, scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, reportWorker: true, reportWorkerEntry: ENTRY });
    const { port } = await app.listen(0, "127.0.0.1");
    client = createClient(`http://127.0.0.1:${port}`);
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    second = (await client.post("/api/companies", { code: "002", name: "İkinci" })).data.data.company;
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    const opened = await client.post(`/api/workspace/bank/accounts${q}`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-01-01", amount: "1.000", confirmed: true } });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    process.env.DESTEKOFIS_TEST_RAPOR = "";
    const plain = await report(second.id);
    assert.equal(plain.status, 200, JSON.stringify(plain));
  });
  after(async () => {
    delete process.env.DESTEKOFIS_TEST_RAPOR;
    await app?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("H1: 002 geri yüklenirken ve silinirken açık raporlar 503 report-interrupted (çalışan + sıradaki); işlem 200; günlükte ERROR yok", async () => {
    const backup = (await client.post("/api/admin/backups", { scope: "one", companyId: second.id })).data.data.backups[0];
    assert.ok(backup?.name, "002 yedeği alındı");
    for (const step of ["geri yükleme", "silme"]) {
      lines.length = 0;
      process.env.DESTEKOFIS_TEST_RAPOR = "bekle:4000";
      // En çok 2 iş parçacığı: 2 çalışan + 1 sırada.
      const reports = [report(second.id), report(second.id), report(second.id)];
      await wait(500);
      const done =
        step === "geri yükleme"
          ? await companyCall("POST", "/api/admin/backups/restore", { name: backup.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD })
          : await companyCall("DELETE", `/api/companies/${second.id}`, { confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(done.status, 200, `${step}: ${JSON.stringify(done.data)}`);
      const results = await Promise.all(reports);
      process.env.DESTEKOFIS_TEST_RAPOR = "";
      for (const result of results) {
        assert.equal(result.status, 503, `${step}: rapor ${JSON.stringify(result)}`);
        assert.equal(result.code, "report-interrupted", `${step}: ${JSON.stringify(result)}`);
        assert.equal(result.error, COMPANY_MSG, step);
      }
      assert.deepEqual(lines, [], `${step}: günlükte ERROR yazılmamalı`);
      if (step === "geri yükleme") {
        const again = await report(second.id);
        assert.equal(again.status, 200, `geri yüklemeden sonra rapor açılır: ${JSON.stringify(again)}`);
      }
    }
  });

  it("H3: iş parçacığında SQLite hatası → 500 'Sunucu işlemi tamamlayamadı.' (ham ileti yok) ve günlükte yığınlı ERROR; 404 hesap aynen", async () => {
    lines.length = 0;
    process.env.DESTEKOFIS_TEST_RAPOR = "bozuk";
    const broken = await report("sirket-001");
    process.env.DESTEKOFIS_TEST_RAPOR = "";
    assert.equal(broken.status, 500, JSON.stringify(broken));
    assert.equal(broken.error, "Sunucu işlemi tamamlayamadı.", `kullanıcıya ham ileti gitmemeli: ${broken.error}`);
    assert.equal(lines.length, 1, `günlükte bir ERROR: ${lines.join(" | ")}`);
    assert.match(lines[0], /Rapor iş parçacığında hata/);
    assert.match(lines[0], /unable to open database file/);
    assert.match(lines[0], /iş parçacığı yığını/);
    lines.length = 0;
    const missing = await report("sirket-001", "bankAccount=bacc-yok");
    assert.equal(missing.status, 404, JSON.stringify(missing));
    assert.equal(missing.code, "bank-account-missing");
    assert.deepEqual(lines, [], "bilinçli hata günlüğe yazılmaz");
  });
});
