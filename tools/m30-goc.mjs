// 2.4.4 madde 30 — v2.4.3 → 2.4.4 göçü gerçek kodla (ders 17), yedek tatbikatı, zincirleme göç ve arıza. Düzenleyici.
//
//   node --disable-warning=ExperimentalWarning tools/m30-goc.mjs <adım> --kok <klasör> [--hacim kucuk|buyuk] [--tohum 7] [--surum v2.4.3]
//
// Adımlar (her biri kökteki klasörleri kullanır; çıktılar kök/çıktı/*.json):
//   uret      --surum v2.4.3 : eski sürümün GERÇEK koduyla, kendi API'sinden veri (test/guvenilirlik/m30-uretici.mjs) → kok/taban/{data,backups}
//   olcu      --surum <s> --veri <klasör> --ad <ad> : o sürümle (sabit sahte saat: üretimin son günü) bütün olgular → kok/cikti/<ad>.json
//   goc       : taban kopyası → kok/goc; 2.4.4 aynı klasörde açılır (güncelleyicinin yaptığı gibi), süre + günlük; ardından olcu
//   fark      --once <ad> --sonra <ad> : olgu farkı + sınıflama (belgeli karar / BULGU) → kok/cikti/fark-<once>-<sonra>.json
//   tatbikat  : göçten sonra 2.4.4'te çalışma + yedek → çalış → geri yükle → yeniden çalış + 2.4.3 yedeğini geri yükle (test/guvenilirlik/m30-tatbikat.mjs)
//   donus     : göçten sonra 2.4.3 yeniden açılır (geri dönüş), sonra yeniden 2.4.4
//   zincir    --ad <ad> --kaynak fikstur:<ad>|<klasör> --yol v2.1.0,… : ara sürümlerle adım adım göç + doğrudan göç (yol bağımsızlığı)
//   kesinti   [--noktalar …] [--gecikmeler …] : göç sırasında SIGKILL (zorla ve gerçek süreç), disk dolu, kilitli dosya (tools/m30-goc-kesinti-adim.mjs)
// Madde 30 kanıt sırası (docs/kanit/2026-10-22/244-m30-goc/NOT.md): uret (v2.4.3, buyuk) → olcu → goc → fark → tatbikat → donus → kesinti → zincir ×2.
// Ortam: TMPDIR not defterinde benzersiz klasör (ders 25; eski sürüm kodu önbelleği orada), HUKUK_LICENSE_URL=http://127.0.0.1:9 (ders 30).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const args = process.argv.slice(2);
const step = args[0];
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const root = path.resolve(value("kok", ""));
if (!value("kok", "")) throw new Error("--kok <klasör> gerekli");
const out = path.join(root, "cikti");
mkdirSync(out, { recursive: true });
const log = line => console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
const writeJson = (name, data) => writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
const readJson = name => JSON.parse(readFileSync(path.join(out, `${name}.json`), "utf8"));

const { startMockEdm } = await import("../test/einvoice-mock.mjs");
const { resetEdmCaches } = await import("../server/lib/einvoice/edm.mjs");

if (step === "uret") {
  const { generate } = await import("../test/guvenilirlik/m30-uretici.mjs");
  const version = value("surum", "v2.4.3");
  const base = path.join(root, value("hedef", "taban"));
  if (existsSync(base)) rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  resetEdmCaches();
  const edm = await startMockEdm();
  try {
    const started = performance.now();
    const { manifest } = await generate({ version, dataDir: path.join(base, "data"), backupDir: path.join(base, "backups"), edmUrl: edm.url, seed: Number(value("tohum", 7)), hacim: value("hacim", "kucuk"), endDay: value("gun", undefined), log });
    manifest.edm = { sent: edm.state.sent.length, cancelled: edm.state.cancelled.length, violations: edm.state.violations };
    manifest.ms = Math.round(performance.now() - started);
    writeJson(`manifest-${value("hedef", "taban")}`, manifest);
    log(`üretildi: ${JSON.stringify(manifest.counts)}`);
    log(`süre ${(manifest.ms / 1000).toFixed(1)} sn; EDM gönderim ${manifest.edm.sent}, iptal ${manifest.edm.cancelled}, ihlal ${manifest.edm.violations.length}`);
    // Her API yanıtı 200 olmalıydı (200 dışı yanıt üretimi durdurur); EDM sözleşme ihlali başarısızlık sayılır.
    summary(manifest.requests + 1, manifest.edm.violations.length ? 1 : 0, `${manifest.requests} API isteği 200; EDM ihlali ${manifest.edm.violations.length}`);
  } finally {
    await edm.close();
  }
} else if (step === "olcu") {
  // Ölçüm verinin KOPYASINDA yapılır (açılış/giriş oturum ve günlük satırı yazar; taban değişmesin).
  const version = value("surum", "v2.4.3");
  const source = path.resolve(root, value("veri", "taban"));
  const name = value("ad", `${version}-${path.basename(source)}`);
  const copy = path.join(root, `olcu-${name}`);
  rmSync(copy, { recursive: true, force: true });
  cpSync(source, copy, { recursive: true });
  try {
    const facts = await measure({ version, dir: copy, day: dayOf() });
    writeJson(name, facts);
    log(`ölçüldü ${name}: açılış ${facts.bootMs} ms, şirketler ${facts.install.companies.map(c => c.code).join(", ")}`);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
} else if (step === "goc") {
  // Güncelleyicinin yaptığı gibi: veri klasörü yerinde kalır, program kodu 2.4.4 olur ve AYNI klasörde açılır (göçler açılışta; 002'ninki ilk
  // erişimde). Taban bozulmasın diye kopyada (kok/goc).
  const target = path.join(root, value("hedef", "goc"));
  rmSync(target, { recursive: true, force: true });
  cpSync(path.resolve(root, value("veri", "taban")), target, { recursive: true });
  const { treeHashes } = await import("../test/guvenilirlik/olgular.mjs");
  const before = treeHashes(path.join(target, "backups"));
  const facts = await measure({ version: "guncel", dir: target, day: dayOf(), logLevel: "info" });
  const after = treeHashes(path.join(target, "backups"));
  facts.newBackups = Object.keys(after).filter(rel => !before[rel]);
  writeJson(value("ad", "guncel-goc"), facts);
  log(`göç + ölçü: 001 açılışı (göç dahil) ${facts.bootMs} ms; ilk erişim ${JSON.stringify(facts.firstAccessMs)}; yeni yedek ${facts.newBackups.join(", ")}`);
  // Denetim: her şirket dosyası şema 32, bütünlük "ok", her şirkete bir göç öncesi yedek.
  const codes = Object.keys(facts.files);
  const bad = codes.filter(code => facts.files[code].version !== 32 || facts.files[code].integrity !== "ok" || !facts.newBackups.some(rel => rel.startsWith(`${code} - `) && /pre-migration-v32\.sqlite$/.test(rel)));
  for (const code of codes) log(`  ${code}: şema ${facts.files[code].version}, bütünlük ${facts.files[code].integrity}, numara tabanı ${facts.files[code].numberFloor}`);
  summary(codes.length, bad.length, `göç: ${codes.length} şirket şema 32 + göç öncesi yedek; sorunlu ${bad.join(",") || "yok"}`);
} else if (step === "fark") {
  const { diffFacts, oldDataMap } = await import("../test/guvenilirlik/m30-fark.mjs");
  const { companyDbFile, readRegistry } = await import("../test/guvenilirlik/uretici.mjs");
  const once = value("once", "v2.4.3-taban");
  const sonra = value("sonra", "guncel-goc");
  const before = readJson(once);
  // Sınıflama haritası: göçten ÖNCEKİ veri dosyası (eski sürümün yazdığı; --eski <klasör>, varsayılan taban).
  const oldDir = path.join(path.resolve(root, value("eski", "taban")), "data");
  const registry = readRegistry(oldDir) || [{ id: "sirket-001", dir: "" }];
  const maps = Object.fromEntries(before.install.companies.map(c => [c.code, oldDataMap(companyDbFile(oldDir, registry.find(e => e.id === c.id) || { id: c.id, dir: "" }))]));
  const report = diffFacts(before, readJson(sonra), { maps });
  writeJson(`fark-${once}-${sonra}`, report);
  for (const line of report.summaryLines) log(line);
  summary(report.rows.length, report.bulgu.length, "olgu (EŞİT + BELGELİ = geçti, BULGU = başarısız)");
  process.exitCode = report.bulgu.length ? 2 : 0;
} else if (step === "tatbikat") {
  // Göçten sonra çalışma + yedek tatbikatı + 2.4.3 yedeğinin geri yüklenmesi (test/guvenilirlik/m30-tatbikat.mjs). Göç klasörünün kopyasında.
  const { runDrill } = await import("../test/guvenilirlik/m30-tatbikat.mjs");
  const { oldDataMap } = await import("../test/guvenilirlik/m30-fark.mjs");
  const { bootVersion, CURRENT } = await import("../test/guvenilirlik/surumler.mjs");
  const { createClock } = await import("../server/lib/clock.mjs");
  const { companyDbFile, readRegistry } = await import("../test/guvenilirlik/uretici.mjs");
  const dir = path.join(root, "tatbikat");
  rmSync(dir, { recursive: true, force: true });
  cpSync(path.join(root, value("veri", "goc")), dir, { recursive: true });
  const day = dayOf();
  const baseline = readJson(value("taban-olcu", "guncel-goc"));
  const manifest = readJson("manifest-taban");
  const oldDir = path.join(root, "taban", "data");
  const registry = readRegistry(oldDir);
  const maps = Object.fromEntries(baseline.install.companies.map(c => [c.code, oldDataMap(companyDbFile(oldDir, registry.find(e => e.id === c.id) || { id: c.id, dir: "" }))]));
  const clock = createClock({ time: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 18, 0, 0), fixed: false });
  resetEdmCaches();
  const edm = await startMockEdm();
  const bootCurrent = () => bootVersion(CURRENT, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, edocEnabled: true, edocLive: true, esmmEnabled: true, edocStatusPollMs: [10, 10] });
  try {
    const { checks } = await runDrill({ dir, day, maps, baseline, oldBackups: manifest.backups, bootCurrent, clock, edm, log });
    writeJson("tatbikat", { day, checks, edm: { sent: edm.state.sent.map(x => x.id), smm: edm.state.smm.sent.map(x => x.id), violations: [...edm.state.violations, ...(edm.state.smm.violations || [])] } });
    const fail = checks.filter(item => !item.ok).length;
    summary(checks.length, fail, "tatbikat denetimleri");
    process.exitCode = fail ? 1 : 0;
  } finally {
    await edm.close();
  }
} else if (step === "donus") {
  // Aynı dosyayı iki sürüm açar: göçten sonra 2.4.3 yeniden açılır (geri dönüş), sonra yeniden 2.4.4. Göç klasörünün kopyasında.
  const { stableDiff } = await import("../test/guvenilirlik/m30-tatbikat.mjs");
  const dir = path.join(root, "donus");
  rmSync(dir, { recursive: true, force: true });
  cpSync(path.join(root, "goc"), dir, { recursive: true });
  const day = dayOf();
  const old = await measure({ version: "v2.4.3", dir, day });
  const back = await measure({ version: "guncel", dir, day });
  writeJson("donus-v2.4.3", old);
  writeJson("donus-guncel", back);
  const taban = readJson("v2.4.3-taban");
  const goc = readJson("guncel-goc");
  const checks = [];
  for (const code of Object.keys(taban.companies)) {
    const d1 = stableDiff(taban.companies[code], old.companies[code]);
    checks.push({ name: `${code} göçten sonra 2.4.3 açınca gösterdiği = göçten önce gösterdiği`, ok: !d1.length, detail: d1 });
    checks.push({ name: `${code} 2.4.3 açılışı şemayı geri almaz (32 kalır)`, ok: old.files[code].version === 32, detail: { version: old.files[code].version } });
    const d2 = stableDiff(goc.companies[code], back.companies[code]);
    checks.push({ name: `${code} 2.4.3'ten sonra yeniden 2.4.4: gösterdiği = göç ölçüsü`, ok: !d2.length, detail: d2 });
  }
  for (const item of checks) log(`${item.ok ? "✓" : "✗"} ${item.name}${item.ok ? "" : ` — ${JSON.stringify(item.detail).slice(0, 800)}`}`);
  writeJson("donus", { checks });
  summary(checks.length, checks.filter(item => !item.ok).length, "geri dönüş denetimleri");
  process.exitCode = checks.some(item => !item.ok) ? 1 : 0;
  rmSync(dir, { recursive: true, force: true });
} else if (step === "zincir") {
  // Zincirleme göç: daha eski sürümün GERÇEK verisi (depodaki fikstür ya da o sürümün koduyla üretilen) sırayla ara sürümlerle açılır (her biri kendi
  // göçünü yapar), sonra 2.4.4; aynı veri ARA SÜRÜMSÜZ doğrudan 2.4.4 ile de açılır. Denetim: (1) 2.4.3'ün gösterdiği → 2.4.4'ün gösterdiği (fark +
  // sınıflama, ana göçle aynı kurallar), (2) yol bağımsızlığı: adım adım güncellenen = doğrudan güncellenen.
  const { stableDiff } = await import("../test/guvenilirlik/m30-tatbikat.mjs");
  const { diffFacts, oldDataMap } = await import("../test/guvenilirlik/m30-fark.mjs");
  const { bootVersion } = await import("../test/guvenilirlik/surumler.mjs");
  const { unpackFixture } = await import("../test/guvenilirlik/fikstur.mjs");
  const { companyDbFile, readRegistry } = await import("../test/guvenilirlik/uretici.mjs");
  const { scoped } = await import("../test/guvenilirlik/m30-uretici.mjs");
  const name = value("ad", "zincir");
  const source = value("kaynak", "fikstur:surum-2.0.26-turler");
  const pathVersions = value("yol", "v2.1.0,v2.2.0,v2.3.0,v2.4.3").split(",");
  const day = value("gun", new Date().toISOString().slice(0, 10));
  const make = target => {
    rmSync(target, { recursive: true, force: true });
    if (source.startsWith("fikstur:")) unpackFixture(source.slice(8), { root: target });
    else cpSync(path.resolve(root, source), target, { recursive: true });
  };
  const stepDir = path.join(root, `${name}-adim`);
  const directDir = path.join(root, `${name}-dogrudan`);
  make(stepDir);
  make(directDir);
  const timings = {};
  for (const version of pathVersions) {
    const started = performance.now();
    const server = await bootVersion(version, { dataDir: path.join(stepDir, "data"), backupDir: path.join(stepDir, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocLive: true });
    try {
      const api = await server.login();
      for (const company of (await api.get("/api/companies")).data.all) {
        const res = await scoped(api, company.id).get("/api/workspace/ledger/lock");
        if (res.status !== 200) throw new Error(`${version} ${company.code} açılmadı: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      }
    } finally {
      await server.close();
    }
    timings[version] = Math.round(performance.now() - started);
    const reg = readRegistry(path.join(stepDir, "data")) || [{ id: "sirket-001", dir: "" }];
    const { fileFacts } = await import("../test/guvenilirlik/m30-olgular.mjs");
    log(`  ${version}: ${reg.map(e => `${e.id === "sirket-001" ? "001" : e.dir}: şema ${fileFacts(companyDbFile(path.join(stepDir, "data"), e)).version}`).join(", ")} (${timings[version]} ms)`);
  }
  const last = pathVersions.at(-1);
  // son ara sürümün gösterdiği (kopyada), sonra 2.4.4 aynı klasörde (göç)
  const lastCopy = path.join(root, `${name}-olcu`);
  rmSync(lastCopy, { recursive: true, force: true });
  cpSync(stepDir, lastCopy, { recursive: true });
  const before = await measure({ version: last, dir: lastCopy, day });
  rmSync(lastCopy, { recursive: true, force: true });
  const oldData = path.join(stepDir, "data");
  const registry = readRegistry(oldData) || [{ id: "sirket-001", dir: "" }];
  const maps = Object.fromEntries(before.install.companies.map(c => [c.code, oldDataMap(companyDbFile(oldData, registry.find(e => e.id === c.id) || { id: c.id, dir: "" }))]));
  const migratedDir = path.join(root, `${name}-goc`);
  rmSync(migratedDir, { recursive: true, force: true });
  cpSync(stepDir, migratedDir, { recursive: true });
  const after = await measure({ version: "guncel", dir: migratedDir, day });
  const direct = await measure({ version: "guncel", dir: directDir, day });
  writeJson(`${name}-${last}`, before);
  writeJson(`${name}-guncel`, after);
  writeJson(`${name}-dogrudan`, direct);
  const report = diffFacts(before, after, { maps });
  writeJson(`fark-${name}`, report);
  for (const line of report.summaryLines) log(line);
  const checks = report.rows.map(row => ({ name: `${row.company} ${row.area}`, ok: row.klass !== "BULGU", detail: row }));
  for (const code of Object.keys(after.companies)) {
    const diff = direct.companies[code] ? stableDiff(after.companies[code], direct.companies[code]) : [{ section: "şirket yok" }];
    checks.push({ name: `${code} yol bağımsızlığı: ${pathVersions.join(" → ")} → 2.4.4 = doğrudan 2.4.4`, ok: !diff.length, detail: diff });
    log(`${diff.length ? "✗" : "✓"} ${code} yol bağımsızlığı${diff.length ? ` — ${JSON.stringify(diff).slice(0, 800)}` : ""}`);
    checks.push({ name: `${code} şema 32 (adım adım ve doğrudan)`, ok: after.files[code].version === 32 && direct.files[code]?.version === 32, detail: { step: after.files[code].version, direct: direct.files[code]?.version } });
  }
  writeJson(`${name}`, { source, pathVersions, timings, checks: checks.map(({ name: n, ok }) => ({ name: n, ok })) });
  summary(checks.length, checks.filter(item => !item.ok).length, `zincir ${source} → ${pathVersions.join(" → ")} → 2.4.4`);
  process.exitCode = checks.some(item => !item.ok) ? 1 : 0;
  for (const dir of [stepDir, directDir, migratedDir]) rmSync(dir, { recursive: true, force: true });
} else if (step === "kesinti") {
  await import("./m30-goc-kesinti-adim.mjs").then(module => module.run({ root, out, value, log, measure, summary, writeJson, readJson, dayOf }));
} else {
  throw new Error(`Bilinmeyen adım: ${step}`);
}

/** node:test biçiminde özet (tools/kanit.mjs kos tanır): her denetim bir "test". */
function summary(tests, fail, note = "") {
  if (note) console.log(`# ${note}`);
  console.log(`# tests ${tests}\n# pass ${tests - fail}\n# fail ${fail}\n# cancelled 0\n# skipped 0\n# todo 0`);
}

function dayOf() {
  const fromArg = value("gun", null);
  if (fromArg) return fromArg;
  const file = path.join(out, "manifest-taban.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).endDay : new Date().toISOString().slice(0, 10);
}

/** Sürümü klasörde açar (sabit sahte saat: gün 17:00), bütün olguları okur. version "guncel" = 2.4.4 adayı (çalışma ağacı). */
async function measure({ version, dir, day, logLevel = "silent", login = true }) {
  const { bootVersion, CURRENT } = await import("../test/guvenilirlik/surumler.mjs");
  const { createClock } = await import("../server/lib/clock.mjs");
  const { companyFacts, installFacts, fileFacts } = await import("../test/guvenilirlik/m30-olgular.mjs");
  const { scoped } = await import("../test/guvenilirlik/m30-uretici.mjs");
  const { companyDbFile, readRegistry } = await import("../test/guvenilirlik/uretici.mjs");
  const current = version === "guncel" || version === CURRENT;
  const clock = createClock({ time: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 17, 0, 0), fixed: true });
  // Üretimdeki bayraklar (o sürümün server.mjs'i): 2.4.3 e-Belge test + canlı; 2.4.4 ayrıca e-SMM (ders 14).
  const flags = current ? { edocEnabled: true, edocLive: true, esmmEnabled: true } : { edocEnabled: true, edocLive: true };
  resetEdmCaches();
  const edm = await startMockEdm();
  const started = performance.now();
  const server = await bootVersion(current ? CURRENT : version, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, logLevel, ...flags });
  const bootMs = Math.round(performance.now() - started);
  const result = { version: current ? "2.4.4-aday" : version, commit: server.commit || gitHead(), day, bootMs, firstAccessMs: {}, companies: {}, files: {} };
  try {
    const api = await server.login();
    result.install = await installFacts(api);
    for (const company of result.install.companies) {
      const t = performance.now();
      const scopedApi = scoped(api, company.id);
      await scopedApi.get("/api/workspace/ledger/lock");
      result.firstAccessMs[company.code] = Math.round(performance.now() - t);
      result.companies[company.code] = await companyFacts(scopedApi);
    }
  } finally {
    await server.close();
    await edm.close();
  }
  const registry = readRegistry(path.join(dir, "data")) || [{ id: "sirket-001", dir: "" }];
  for (const company of result.install.companies) result.files[company.code] = fileFacts(companyDbFile(path.join(dir, "data"), registry.find(entry => entry.id === company.id) || { id: company.id, dir: "" }));
  return result;
}
function gitHead() {
  try {
    return execFileSync("git", ["-C", path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
