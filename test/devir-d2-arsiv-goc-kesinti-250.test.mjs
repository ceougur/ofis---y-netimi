// 2.5.0 D2 tur 2 — ARŞİV GÖÇÜ YARIDA KESİLİNCE (dar kontrol 06.11 ORTA-1; docs/devir/D2-ALTYAPI-TASARIM.md §13).
// Önceden (6dc3e150): arşiv dosyası YERİNDE göç ediyor, yeni özet kayda akışla özet bittikten SONRA yazılıyordu → arada süreç ölünce arşiv KALICI "Değişmiş" (dosya son
// şemada / yeni özet, kayıt eski özet); sonraki göçlü sürümde K2 (değişmiş + eski şema → 409 archive-changed) ile programdan hiç açılamaz; Doğrula kaydı düzeltmez.
// Beklenen (iki aşamalı göç — kopyada göç + özet → kayda bekleyen özet → taşıma → kesinleştirme): HANGİ adımda kesilirse kesilsin yeniden açılışta arşiv uyarısız açılır,
// Doğrula "ok", Yönetim listesi "Doğrulandı"; kayıt dosyanın özetini ve son şemayı taşır; göç öncesi kopya kalır; çalışma kopyası / bekleyen özet kalmaz. Yeni kural yok:
// K1 (tembel göç) ve K2 aynen — gerçekten değişmiş dosya yine 409 / uyarı.
// Veri: arşiv GERÇEK v2.0.26 koduyla üretilmiş fikstürden (test/fixtures/surum-2.0.26-zincir; ders 17). Kesme AYRI SÜREÇTE SIGKILL (test/fixtures/devir-d2-arsiv-goc-isci.mjs).
// Kesme noktaları: "kopya-goc-etti" (göç bitti, özet alınırken, kayıt yazılmadan — p3'ün kesmesi yeni düzende), "bekleyen-yazildi" (taşımadan ÖNCE), "tasindi" (taşımadan
// SONRA, kayıt kesinleşmeden); ayrıca taşımadan sonra kesilip kayıt defteri de kaybolan arşiv (bekleyen özet arşiv klasöründeki kayıt kopyasından), ve bekleyen özetin K2 ile
// ilişkisi (önceki sürümün ARA ŞEMADA kalmış göçü: kabul edilip göç sürer; bekleyen özeti de tutmayan dosya yine 409).
// Windows (ders 48): çalışma kopyasının asıl dosyanın yerine taşınması (rename), SIGKILL'den sonra aynı dosyaların yeniden açılması / silinmesi — CI Windows işlerinde görülür.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { MIGRATION_WORK_FILE, hashFile, placeLegacyArchive, schemaOf, writeSettingRaw } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HERE, "fixtures", "devir-d2-arsiv-goc-isci.mjs");
const NOW = "2026-11-02T10:00:00+03:00";
const roots = [];
let fixture = null;
let fixtureDb = "";
before(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2-goc-fikstur-"));
  roots.push(dir);
  fixture = unpackFixture("surum-2.0.26-zincir", { root: dir });
  fixtureDb = resolveDbPath(fixture.dataDir);
});
after(() => {
  fixture?.cleanup();
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2-goc-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const start = dir => startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
const registryEntry = (dir, year = "2025") => readJson(path.join(dir, "data", "sirketler.json")).companies.find(item => item.id === ROOT_COMPANY_ID)?.archives?.find(item => item.year === year) || null;
const cashCount = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n;
  } finally {
    db.close();
  }
};

/** Kurulum: program açılır, eski şemalı arşiv kaydıyla yerleştirilir, program kapanır. */
async function setup(dir, options = {}) {
  const server = await start(dir);
  try {
    await loginAdmin(server);
    return await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025", ...options });
  } finally {
    await server.close();
  }
}
/** Ayrı süreçte arşivi açtırır, göçün verilen adımında SIGKILL. Dönüş: { code, signal, note }. */
function interrupt(dir, step) {
  const note = path.join(dir, `kesme-${step}.json`);
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", WORKER, path.join(dir, "data"), path.join(dir, "backups"), "2025", step, note], { env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  child.stderr.on("data", chunk => (err += chunk));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`işçi 120 sn içinde bitmedi: ${err}`));
    }, 120_000);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, note: existsSync(note) ? readJson(note) : null, err });
    });
  });
}
/** Yeniden açılışta kullanıcının gördüğü: arşiv okuma, yazma denemesinin uyarısı, Doğrula, Yönetim listesi. */
async function reopen(dir) {
  const server = await start(dir);
  try {
    const admin = await loginAdmin(server);
    const read = await admin.get("/api/workspace/cash?hofArchive=2025");
    const write = await admin.post("/api/workspace/cash?hofArchive=2025", { kind: "in", amount: 1, date: "2025-12-01", description: "arşive yazma denemesi" });
    const verify = await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2025" });
    const list = unwrap(await admin.get("/api/admin/devir/archives"));
    const row = (list?.archives || []).find(item => item.companyId === ROOT_COMPANY_ID && item.year === "2025");
    return {
      seen: { okuma: read.status, yazma: write.status, uyari: write.data?.archive?.warning ?? null, dogrula: unwrap(verify)?.state ?? `${verify.status} ${verify.data?.code || ""}`, liste: row?.status ?? null },
      readError: read.status >= 400 ? JSON.stringify(read.data).slice(0, 240) : "",
    };
  } finally {
    await server.close();
  }
}
/** Kesmeden sonra (yeniden açmadan önce) diskteki ara durum. */
async function snapshot(dir, made) {
  const entry = registryEntry(dir);
  const fileSha = await hashFile(made.file);
  return {
    dosyaSema: schemaOf(made.file),
    dosyaEski: fileSha === made.sha256,
    kayitEski: entry?.sha256 === made.sha256,
    bekleyen: entry?.pendingSha256 ? (entry.pendingSha256 === fileSha ? "dosyayı tutar" : "dosyayı tutmaz") : "yok",
    calismaKopyasi: existsSync(path.join(made.dir, MIGRATION_WORK_FILE)),
  };
}
/** Yeniden açılıştan sonra kayıt ve dosyalar: kayıt dosyanın özeti + son şema + göç bilgisi; göç öncesi kopya = ilk dosya; geçici dosya / bekleyen özet yok; veri aynı. */
async function expectSettled(dir, made, label) {
  const entry = registryEntry(dir);
  const fileSha = await hashFile(made.file);
  assert.equal(schemaOf(made.file), LATEST_VERSION, `${label}: arşiv son şemada`);
  assert.equal(entry.sha256, fileSha, `${label}: kayıttaki özet dosyanınki`);
  assert.equal(entry.schemaVersion, LATEST_VERSION, `${label}: kayıttaki şema`);
  assert.equal(entry.migratedFrom, made.schemaVersion, `${label}: göç bilgisi (eski şema)`);
  assert.equal(entry.previousSha256, made.sha256, `${label}: önceki özet ilk dosyanınki`);
  assert.equal(entry.pendingSha256, undefined, `${label}: bekleyen özet kalmadı`);
  const sidecar = readJson(path.join(made.dir, "arsiv-kaydi.json"));
  assert.equal(sidecar.sha256, fileSha, `${label}: arşiv klasöründeki kayıt kopyası da kesinleşti`);
  assert.equal(sidecar.pendingSha256, undefined, `${label}: kayıt kopyasında bekleyen özet yok`);
  const names = readdirSync(made.dir).sort();
  assert.deepEqual(names.filter(name => name.startsWith("goc-oncesi-v")), [`goc-oncesi-v${made.schemaVersion}.sqlite`], `${label}: tek göç öncesi kopya`);
  assert.equal(await hashFile(path.join(made.dir, `goc-oncesi-v${made.schemaVersion}.sqlite`)), made.sha256, `${label}: göç öncesi kopya ilk dosyanın aynısı`);
  assert.deepEqual(names.filter(name => name.startsWith(MIGRATION_WORK_FILE) || /-wal$|-shm$|-journal$/.test(name) || name.endsWith(".yaziliyor")), [], `${label}: çalışma kopyası / günlük / yarım dosya kalmadı (${names.join(", ")})`);
  assert.equal(cashCount(made.file), cashCount(fixtureDb), `${label}: veri aynı (kasa satırları)`);
}
const SETTLED = { okuma: 200, yazma: 403, uyari: "", dogrula: "ok", liste: "ok" };

describe("D2 tur 2 — arşiv göçü yarıda kesilince arşiv kalıcı 'Değişmiş' olmaz (ORTA-1)", () => {
  // Kesmeden sonraki beklenen ara durum (yeni düzen): asıl dosya taşımaya kadar değişmez; bekleyen özet taşımadan ÖNCE kayıtta.
  const MIDDLE = {
    "kopya-goc-etti": { dosyaSema: "eski", dosyaEski: true, kayitEski: true, bekleyen: "yok", calismaKopyasi: true },
    "bekleyen-yazildi": { dosyaSema: "eski", dosyaEski: true, kayitEski: true, bekleyen: "dosyayı tutmaz", calismaKopyasi: true },
    tasindi: { dosyaSema: "son", dosyaEski: false, kayitEski: true, bekleyen: "dosyayı tutar", calismaKopyasi: false },
  };
  for (const step of Object.keys(MIDDLE)) {
    test(`kesme "${step}" (SIGKILL): yeniden açılışta arşiv uyarısız açılır, Doğrula ok, liste Doğrulandı; kayıt kesinleşir, geçici dosya kalmaz`, async () => {
      const dir = workDir();
      const made = await setup(dir);
      assert.ok(made.schemaVersion < LATEST_VERSION, `fikstür eski şemada (${made.schemaVersion})`);
      const cut = await interrupt(dir, step);
      assert.notEqual(cut.note?.yol, "bitti", `ön koşul: göç kesilmeliydi (işçi: ${JSON.stringify(cut.note)} ${cut.err.slice(0, 300)})`);
      assert.ok(cut.note, `ön koşul: işçi kesme notu yazmadı (çıkış ${cut.code} ${cut.signal}) ${cut.err.slice(0, 300)}`);
      const middle = await snapshot(dir, made);
      const { seen, readError } = await reopen(dir);
      assert.deepEqual(seen, SETTLED, `kesme "${step}" (${cut.note.yol}) sonrası yeniden açılış — ara durum ${JSON.stringify(middle)} ${readError}`);
      await expectSettled(dir, made, `kesme "${step}"`);
      // Kesme gerçekten istenen adımda oldu (programın kesme noktası) ve ara durum iki aşamalı düzenin söylediği gibiydi.
      assert.equal(cut.note.yol, "kanca", `kesme programın "${step}" noktasında olmalı (${JSON.stringify(cut.note)})`);
      const expected = { ...MIDDLE[step], dosyaSema: MIDDLE[step].dosyaSema === "son" ? LATEST_VERSION : made.schemaVersion };
      assert.deepEqual(middle, expected, `kesme "${step}" anındaki ara durum`);
    });
  }

  test(`kesme "tasindi" + kayıt defteri kaybı: arşiv diskten tanınır, bekleyen özet arşiv klasöründeki kayıt kopyasından gelir, yeniden açılışta uyarısız açılır`, async () => {
    const dir = workDir();
    const made = await setup(dir, { liveYears: true });
    const cut = await interrupt(dir, "tasindi");
    assert.ok(cut.note && cut.note.yol !== "bitti", `ön koşul: göç kesilmeliydi (${JSON.stringify(cut.note)} ${cut.err.slice(0, 300)})`);
    // Eski sürümün (alanı bilmeyen) kaydı yeniden yazması: archives alanı düşer (sirketler.json + ikinci kopya).
    for (const name of ["sirketler.json", "sirketler.yedek.json"]) {
      const file = path.join(dir, "data", name);
      const value = readJson(file);
      for (const item of value.companies) delete item.archives;
      writeFileSync(file, JSON.stringify(value, null, 2));
    }
    const { seen, readError } = await reopen(dir);
    assert.deepEqual(seen, SETTLED, `kayıt defteri kaybından sonra yeniden açılış ${readError}`);
    const entry = registryEntry(dir);
    assert.equal(entry.recovered, true, "arşiv diskten tanındı");
    assert.equal(entry.sha256, await hashFile(made.file), "kayıttaki özet dosyanınki");
    assert.equal(entry.pendingSha256, undefined, "bekleyen özet kesinleşti");
    assert.equal(cut.note.yol, "kanca");
  });

  test("bekleyen özet ve K2: önceki sürümün ARA ŞEMADA kalmış göçü (dosya bekleyen özeti tutuyor, şema hâlâ eski) açılışta kabul edilip göç sürer — 409 değil; Doğrula da kabul eder; bekleyen özeti de tutmayan değişmiş dosya yine 409 archive-changed", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const admin = await loginAdmin(server);
      const placed = {};
      for (const year of ["2025", "2024", "2023"]) {
        const made = await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: fixtureDb, year });
        // Önceki sürümün göçü (kopyada) ara bir sonuca ulaşmış, taşınmış, kayıt kesinleşmeden kesilmiş: dosya değişti, kayıtta bekleyen özet. Şema bu sürüme göre eski.
        writeSettingRaw(made.file, "d2tur2.ara-goc", year);
        const db = new DatabaseSync(made.file);
        db.exec("PRAGMA journal_mode = DELETE");
        db.close();
        const middleSha = await hashFile(made.file);
        assert.notEqual(middleSha, made.sha256);
        placed[year] = { ...made, middleSha };
      }
      const pendingOf = year => ({ pendingSha256: placed[year].middleSha, pendingFrom: placed[year].schemaVersion - 1, pendingAt: "2026-11-01T09:00:00.000Z" });
      server.app.companies.updateArchive(ROOT_COMPANY_ID, "2025", pendingOf("2025"));
      server.app.companies.updateArchive(ROOT_COMPANY_ID, "2024", pendingOf("2024"));
      // 2023: kayıttaki bekleyen özet BAŞKA bir dosyanınki — dosya ne kaydı ne bekleyeni tutar (gerçekten değişmiş).
      server.app.companies.updateArchive(ROOT_COMPANY_ID, "2023", { pendingSha256: "0".repeat(64), pendingFrom: placed["2023"].schemaVersion - 1 });
      // 2025: açılış — bekleyen kabul, göç sürer.
      const opened = await admin.get("/api/workspace/cash?hofArchive=2025");
      assert.equal(opened.status, 200, `ara şemada kalmış göç açılır (K2'ye düşmez): ${opened.status} ${JSON.stringify(opened.data).slice(0, 240)}`);
      let entry = server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025");
      assert.equal(schemaOf(placed["2025"].file), LATEST_VERSION, "göç sürdü (son şema)");
      assert.equal(entry.sha256, await hashFile(placed["2025"].file), "kayıt göçten sonraki dosyanın özeti");
      assert.equal(entry.previousSha256, placed["2025"].middleSha, "önceki özet: kabul edilen ara dosya");
      assert.equal(entry.migratedFrom, placed["2025"].schemaVersion, "göç ara şemadan");
      assert.equal(entry.pendingSha256, undefined);
      const written = await admin.post("/api/workspace/cash?hofArchive=2025", { kind: "in", amount: 1, date: "2025-12-01", description: "x" });
      assert.deepEqual([written.status, written.data?.archive?.warning], [403, ""], "uyarısız salt okunur");
      // 2024: önce Doğrula — bekleyen kabul, kayıt kesinleşir (açılış ile aynı kural); sonra açılış göç eder.
      const verified = unwrap(await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2024" }));
      assert.equal(verified?.state, "ok", `Doğrula ara dosyayı kabul eder: ${JSON.stringify(verified)}`);
      entry = server.app.companies.archiveOf(ROOT_COMPANY_ID, "2024");
      assert.deepEqual([entry.sha256, entry.pendingSha256, entry.previousSha256, entry.migratedFrom], [placed["2024"].middleSha, undefined, placed["2024"].sha256, placed["2024"].schemaVersion - 1], "Doğrula bekleyen özeti kesinleştirdi");
      assert.equal((await admin.get("/api/workspace/cash?hofArchive=2024")).status, 200);
      assert.equal(schemaOf(placed["2024"].file), LATEST_VERSION);
      // 2023: K2 aynen.
      const refused = await admin.get("/api/workspace/cash?hofArchive=2023");
      assert.deepEqual([refused.status, refused.data?.code], [409, "archive-changed"], "bekleyen özeti de tutmayan dosya değişmiş sayılır (K2)");
      assert.equal(schemaOf(placed["2023"].file), placed["2023"].schemaVersion, "değişmiş dosya göç ettirilmedi");
      assert.equal(unwrap(await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2023" }))?.state, "changed");
    } finally {
      await server.close();
    }
  });

  test("sözleşme: çalışma kopyasının adı programınkiyle aynı; devir yedeği çalışma kopyasını almaz", async () => {
    const archives = await import("../server/lib/devir/archives.mjs");
    assert.equal(archives.MIGRATION_WORK_FILE, MIGRATION_WORK_FILE);
    assert.equal(archives.isArchiveTransient?.(MIGRATION_WORK_FILE), true);
    assert.equal(archives.isArchiveTransient?.(`${MIGRATION_WORK_FILE}-wal`), true);
    assert.equal(archives.isArchiveTransient?.("goc-oncesi-v19.sqlite"), true);
    assert.equal(archives.isArchiveTransient?.("destekofis.sqlite"), false);
    assert.equal(archives.isArchiveTransient?.("arsiv-kaydi.json"), false);
  });
});
