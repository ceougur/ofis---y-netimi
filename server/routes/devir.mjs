// 2.5.0 D2 — devir altyapısının yönetim uçları (docs/devir/D2-ALTYAPI-TASARIM.md §8). Ortak katmanda (server/app.mjs HUB_ONLY: admin/devir, admin/maintenance);
// hepsi system.manage ister ve kullanıcının görebildiği şirketlerle sınırlıdır. Devri yapan uçlar (ön izleme, başlat, yenile, geri al) D3–D4'ün işi; burada:
//   GET  /api/admin/devir/archives          arşiv kayıtları + dosya durumu (özet hesaplanmaz) + sahipsiz arşiv klasörleri
//   POST /api/admin/devir/archives/verify   { company, year } — arşiv dosyasının bütünlük özeti (akışla; okuma işi)
//   GET  /api/admin/devir/backups           kalıcı devir yedekleri (Yönetim → Yedekler → Devir Yedekleri)
//   POST /api/admin/devir/backups/verify    { company, name } — devir yedeğinin her dosyası bildirgesiyle aynı mı
//   GET  /api/admin/maintenance             bakım kipindeki şirketler + önceki çalışmada yarıda kalan kip
// 2.5.1 D3 — devir ÖN İZLEMESİ (yalnız okuma; yazan uç YOK — D4; docs/devir/D3-D4-TASARIM.md §3.9):
//   POST /api/admin/devir/preview           { company, cutoff (YYYY-12-31), option ("borc-alacak" | "sadece-bakiye") } → { id, state } — iş parçacığında başlar; aynı şirkette
//                                           süren ön izleme varsa YENİSİ açılmaz, sürenin kimliği döner (joined: true)
//   GET  /api/admin/devir/preview/:id       { id, company, state (running | done | failed), asama, result? { plan, onDenetim, rapor, zamanlama }, stale, error? } — sonuç iş parçacığında
//                                           JSON'a çevrilmiş metin olarak eklenir (ana iş parçacığında büyük nesne yok)
//   GET  /api/admin/devir/preview/:id/report.pdf | report.xlsx   Devir Raporu (ekran = PDF = Excel; aynı satırlar)
import path from "node:path";
import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { HttpError, ok, readJson, sendBody, sendBuffer, text } from "../lib/http.mjs";
import { createReportHeader } from "../lib/report-header.mjs";
import { reportFileBase } from "../lib/report-files.mjs";
import { ROOT_COMPANY_ID } from "../lib/companies.mjs";
import { checkCutoff, DEVIR_OPTIONS } from "../lib/devir/plan.mjs";
import { devirReportPdf, devirReportXlsx } from "../lib/devir/report.mjs";
import { runPreview } from "../lib/devir/plan-worker.mjs";
import { beklenmeyenHataIletisi, devirIletisi, DEVIR_TARGETS, onIzlemeReddiIletisi } from "../lib/devir/iletiler.mjs";
import { archiveFileOf, archiveKey, readArchiveFacts, validYear } from "../lib/devir/archives.mjs";
import { commitPendingMigration, verifyArchive } from "../lib/devir/archive-open.mjs";
import { devirBackupRoot, verifyDevirBackup } from "../lib/devir/devir-backups.mjs";

const BACKUP_DIR_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9-]+$/;

const PREVIEW_ENTRY = new URL("../lib/devir/plan-worker.mjs", import.meta.url);
const PREVIEW_KEEP = 8;
const PREVIEW_TIMEOUT_MS = 30 * 60_000;

/** Ön izleme iş parçacığı: { dbPath, time, job } → sonuç; onProgress(aşama). Hata: HttpError (aynı durum kodu) ya da 500. */
export function runPreviewWorker(data, { onProgress = () => {}, timeoutMs = PREVIEW_TIMEOUT_MS } = {}) {
  let worker = null;
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    worker = new Worker(PREVIEW_ENTRY, { workerData: { ...data, devirPreview: true }, name: "destekofis-devir-on-izleme" });
    worker.unref();
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
      worker.terminate().catch(() => {});
    };
    const timer = setTimeout(() => finish(new Error("devir ön izlemesi zamanında bitmedi")), timeoutMs);
    timer.unref?.();
    worker.on("message", message => {
      if (message?.type === "progress") return onProgress(message.asama);
      if (message?.ok) return finish(null, { json: message.json, raporJson: message.raporJson });
      if (message && message.status && message.status < 500) return finish(new HttpError(message.status, message.message, { code: message.code }));
      return finish(Object.assign(new Error(message?.message || "devir ön izlemesi başarısız"), { stack: message?.stack || "" }));
    });
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error(`devir ön izleme iş parçacığı kapandı (kod ${code})`)));
  });
  return { promise, terminate: () => worker?.terminate().catch(() => {}) };
}

export function registerDevirRoutes(router, { auth, companies, backups, maintenance, archiveView, archiveCache, appFor = null, now = null, log = null }) {
  const companyFor = (admin, id) => {
    const company = companies.get(text(id));
    if (!company || !companies.canAccess(admin, company.id)) throw new HttpError(404, "Şirket bulunamadı ya da bu şirketi görme yetkiniz yok.");
    return company;
  };

  router.get("/api/admin/devir/archives", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const visible = backups.accessible(admin);
    const ids = new Set(visible.map(company => company.id));
    ok(res, {
      archives: visible.flatMap(company => archiveView(company)),
      orphans: companies.orphanArchives().filter(item => ids.has(item.companyId)),
    });
  });

  router.post("/api/admin/devir/archives/verify", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const company = companyFor(admin, body.company);
    const year = text(body.year);
    if (!validYear(year)) throw new HttpError(400, "Arşiv yılı dört haneli olmalı (ör. 2026).");
    const entry = companies.archiveOf(company.id, year);
    if (!entry) throw new HttpError(404, `${year} arşivi bulunamadı.`, { code: "archive-not-found" });
    const file = archiveFileOf(companies.dirsOf(company).dataDir, year);
    const result = await verifyArchive({ file, entry, cache: archiveCache(), key: archiveKey(company.id, year) });
    // Diskten tanınmış (özeti olmayan) arşivin özeti ilk doğrulamada kayda girer (açılıştaki kuralla aynı).
    if (result.state === "recovered") companies.updateArchive(company.id, year, { sha256: result.sha256, size: result.size, verifiedAt: new Date().toISOString() });
    // 2.5.0 D2 tur 2: taşımadan sonra kesilen göç (dosya bekleyen özeti tutuyor) — açılıştaki kuralla aynı, kayıt kesinleştirilir.
    if (result.pending) commitPendingMigration({ registry: companies, company, entry, integrity: result, schemaVersion: readArchiveFacts(file)?.schemaVersion ?? entry.schemaVersion });
    if (result.state === "ok") companies.updateArchive(company.id, year, { verifiedAt: new Date().toISOString() });
    ok(res, { company: company.id, year, state: result.state === "recovered" ? "ok" : result.state, sha256: result.sha256, size: result.size });
  });

  router.get("/api/admin/devir/backups", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    ok(res, { backups: backups.accessible(admin).flatMap(company => backups.listDevirBackupsFor(company)).map(({ dir, ...item }) => item) });
  });

  router.post("/api/admin/devir/backups/verify", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const company = companyFor(admin, body.company);
    const name = text(body.name);
    if (!BACKUP_DIR_NAME.test(name)) throw new HttpError(400, "Geçersiz devir yedeği adı.");
    const root = devirBackupRoot(backups.folderOf(company));
    const dir = path.join(root, name);
    if (path.dirname(path.resolve(dir)) !== path.resolve(root)) throw new HttpError(400, "Geçersiz devir yedeği adı.");
    ok(res, { company: company.id, name, ...(await verifyDevirBackup(dir)) });
  });

  // ---------- 2.5.1 D3: ön izleme işleri (bellekte; şirket başına en çok bir süren iş) ----------
  // D3 tur 3 (DEVİR NEDEN DURDU): ön izlemenin her reddi dört alanlı Türkçe ileti (iletiler.mjs); kod makine alanında (`code`), kullanıcıya giden metin `error` = ileti.metin. Bu
  // bölümde HttpError YALNIZ buradan kurulur (kaynak tarayan denetim: test/devir-d3-ileti.test.mjs).
  const refuse = (status, ileti) => new HttpError(status, ileti.metin, { code: ileti.kod, ileti });
  const previews = new Map(); // id → iş
  const running = new Map(); // şirket → süren işin kimliği
  const clockNow = () => (typeof now === "function" ? now() : new Date());
  const publicJob = job => ({
    id: job.id,
    company: job.companyId,
    cutoff: job.job.K,
    option: job.job.option,
    state: job.state,
    asama: job.asama,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || "",
    // Ön izleme sürerken bakım kipi açıldıysa (Devri Başlat) sonuç bayattır (tasarım §3.11 madde 40); D4 kopyada yeniden hesaplar.
    stale: job.stale || Boolean(maintenance?.has?.(job.companyId)),
    ...(job.error ? { error: job.error } : {}),
  });
  // Sonuç önceden JSON'a çevrilmiş metindir (iş parçacığında): gövdeye metin olarak eklenir — büyük sonuç her yoklamada yeniden çevrilmez (lib/http.mjs sendBody deseni).
  const sendJob = (res, job) => {
    const head = JSON.stringify({ ok: true, data: publicJob(job) });
    sendBody(res, 200, job.resultJson ? `${head.slice(0, -2)},"result":${job.resultJson}}}` : head);
  };
  const keepRecent = () => {
    const done = [...previews.values()].filter(job => job.state !== "running").sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1));
    while (done.length > PREVIEW_KEEP) previews.delete(done.shift().id);
  };
  router.post("/api/admin/devir/preview", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = (await readJson(req)) || {};
    const company = companyFor(admin, body.company);
    const cutoff = text(body.cutoff);
    const option = text(body.option) || "borc-alacak";
    if (!DEVIR_OPTIONS[option]) throw refuse(400, onIzlemeReddiIletisi("DEVIR_SECENEK"));
    if (typeof appFor !== "function") throw refuse(503, devirIletisi({ kod: "devir-on-izleme-yok", baslik: "Ön İzleme Kullanılamıyor", neOldu: "Bu kurulumda devir ön izlemesi açılamadı", neden: "Ön izleme olmadan devrin sonucu gösterilemez", neYapmali: ["Programı yeniden başlatıp yeniden deneyin", "Sorun sürerse destek ekibine haber verin"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" }));
    // Şirket ÖNCE açılır (bekleyen göçü koşar; meşgulse 503 — geri yükleme / ayırma sürüyor).
    const target = appFor(company);
    const today = target.context?.period?.today?.() || clockNow().toISOString().slice(0, 10);
    try {
      checkCutoff(cutoff, today);
    } catch (error) {
      throw refuse(error.status || 400, onIzlemeReddiIletisi(error.code, { cutoff, today }));
    }
    const existing = running.get(company.id);
    if (existing && previews.get(existing)?.state === "running") return ok(res, { ...publicJob(previews.get(existing)), joined: true });
    const label = createReportHeader({ store: target.store, company: () => company }).companyLabel() || `${company.code} · ${company.name}`;
    const job = { K: cutoff, today, option, company: { id: company.id, code: company.code, name: company.name, label }, isRoot: company.id === ROOT_COMPANY_ID };
    const entry = { id: `onizleme-${randomUUID()}`, companyId: company.id, job, state: "running", asama: "basladi", startedAt: clockNow().toISOString(), finishedAt: "", resultJson: "", raporJson: "", error: null, stale: false, label };
    previews.set(entry.id, entry);
    running.set(company.id, entry.id);
    const dbPath = target.config?.dbPath || "";
    const finish = (error, result) => {
      entry.finishedAt = clockNow().toISOString();
      if (error) {
        entry.state = "failed";
        // D3 tur 3: beklenmeyen hata Türkçe cümle + "Verileriniz değişmedi." (ön izleme yazmaz); ham ileti / yığın izi yanıt gövdesine girmez, sunucu günlüğüne yazılır.
        const code = error.code || error.extra?.code || "";
        const ileti = error.status && error.status < 500 ? error.extra?.ileti || onIzlemeReddiIletisi(code, { cutoff, today }) : beklenmeyenHataIletisi();
        if (!error.status || error.status >= 500) log?.warn?.(`Devir ön izlemesi hesaplanamadı (${company.code}): ${error.stack || error.message || error}`);
        entry.error = { status: error.status || 500, code: ileti.kod, message: ileti.metin, ileti };
      } else {
        entry.state = "done";
        entry.resultJson = result.json;
        // Rapor satırları ayrı metin: PDF / Excel istenince çözülür (ana iş parçacığına iletide yalnız metin gelir — nesne ağacı kopyalanmaz).
        entry.raporJson = result.raporJson;
      }
      if (maintenance?.has?.(company.id)) entry.stale = true;
      if (running.get(company.id) === entry.id) running.delete(company.id);
      keepRecent();
    };
    if (dbPath && dbPath !== ":memory:" && !target.store.inTransaction) {
      const handle = runPreviewWorker({ dbPath, time: clockNow().toISOString(), job }, { onProgress: asama => (entry.asama = asama) });
      entry.terminate = handle.terminate;
      handle.promise.then(result => finish(null, result), error => finish(error));
    } else {
      // İş parçacığısız yol (bellekteki veri tabanı): aynı işlev, şirket örneğinin kendi hizmetleriyle.
      try {
        const data = runPreview({ store: target.store, ledger: target.context.ledger, job, progress: asama => (entry.asama = asama) });
        finish(null, { json: JSON.stringify(data), raporJson: JSON.stringify(data.rapor) });
      } catch (error) {
        finish(error);
      }
    }
    ok(res, publicJob(entry));
  });
  const previewOf = (admin, id) => {
    const entry = previews.get(text(id));
    if (!entry || !companies.canAccess(admin, entry.companyId)) {
      throw refuse(404, devirIletisi({ kod: "devir-preview-not-found", baslik: "Ön İzleme Bulunamadı", neOldu: "İstenen devir ön izlemesi bulunamadı (süresi dolmuş ya da program yeniden başlatılmış olabilir)", neden: "Ön izlemeler yalnız program açıkken ve son birkaç tanesi saklanır", neYapmali: ["Ön İzleme'yi yeniden başlatın"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" }));
    }
    return entry;
  };
  router.get("/api/admin/devir/preview/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "system.manage");
    sendJob(res, previewOf(admin, params.id));
  });
  const reportFile = (admin, id) => {
    const entry = previewOf(admin, id);
    if (entry.state !== "done" || !entry.raporJson) {
      throw refuse(409, devirIletisi({ kod: "devir-preview-running", baslik: "Ön İzleme Henüz Bitmedi", neOldu: entry.state === "failed" ? "Ön izleme tamamlanamadığı için Devir Raporu üretilemedi" : "Ön izleme hâlâ hesaplanıyor", neden: "Devir Raporu ön izlemenin sonucundan üretilir", neYapmali: [entry.state === "failed" ? "Ön İzleme'yi yeniden başlatın" : "Ön izleme bitince Devir Raporu'nu yeniden isteyin"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" }));
    }
    return { entry, data: JSON.parse(entry.raporJson), ctx: { now: clockNow(), companyLabel: entry.label, userName: admin.display_name || admin.username || "" } };
  };
  router.get("/api/admin/devir/preview/:id/report.pdf", async ({ req, res, params, url }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const { entry, data, ctx } = reportFile(admin, params.id);
    sendBuffer(res, devirReportPdf(data, ctx), { type: "application/pdf", name: `${reportFileBase(data.title, entry.job.today)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/admin/devir/preview/:id/report.xlsx", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const { entry, data, ctx } = reportFile(admin, params.id);
    sendBuffer(res, devirReportXlsx(data, ctx), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${reportFileBase(data.title, entry.job.today)}.xlsx` });
  });

  router.get("/api/admin/maintenance", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const ids = new Set(backups.accessible(admin).map(company => company.id));
    const status = maintenance.status();
    ok(res, { active: status.active.filter(item => ids.has(item.companyId)), lastAborted: status.lastAborted });
  });
}
