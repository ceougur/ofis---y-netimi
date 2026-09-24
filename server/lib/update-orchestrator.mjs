// Otomatik güncellemenin akışı (servis yöneticisi içinde çalışır).
//
// Açılışta:  uygulama hemen başlatılır → güncelleme arka planda denetlenir (ağ yoksa ilk 30 dakikada birkaç kez
//            yeniden denenir) → yeni sürüm varsa uygulama çalışırken indirilip doğrulanır → kısa bir bakım
//            penceresinde ("Sistem güncelleniyor…") eski sürüm durdurulur, veritabanı yedeklenir, yeni sürüm
//            deneme kipinde açılır → sağlık kontrolü geçerse onaylanır; geçmezse önceki sürüme dönülür ve o sürüm
//            bir daha kendiliğinden denenmez. Gün içinde kendiliğinden güncelleme yapılmaz; yönetici panelden
//            "Şimdi güncelle" diyebilir.
import { isInstalledVersion, pruneVersions, readCurrent, versionDir, writeCurrent } from "./app-layout.mjs";
import { UpdateError } from "./update-envelope.mjs";

const RECENT_CHECK_MS = 10 * 60_000;

const summarize = found =>
  found
    ? { version: found.version, notes: found.manifest.notes, releasedAt: found.manifest.releasedAt, size: found.manifest.package.size, channel: found.manifest.channel, releaseUrl: found.releaseUrl || null }
    : null;

export function createUpdateOrchestrator({ updater, controller, appsDir, runningVersion, log, retryDelays = [60_000, 180_000, 600_000, 1_200_000], trialTimeoutMs = 90_000, applyDelayMs = 400 }) {
  const status = { state: "idle", progress: null, lastFound: null, lastFoundAt: 0, lastResult: null, incompatible: null, lastError: null, skipped: [] };
  const aborter = new AbortController();
  let job = null;
  let checking = null;
  let retryTimer = null;
  let applyTimer = null;
  let retryIndex = 0;
  let stopped = false;
  const now = () => new Date().toISOString();

  function publicStatus() {
    const cfg = updater.config();
    const saved = updater.state();
    return {
      enabled: true,
      autoUpdate: cfg.enabled,
      channel: cfg.channel,
      currentVersion: controller.appVersion(),
      state: status.state,
      progress: status.progress,
      available: summarize(status.lastFound),
      incompatible: status.incompatible,
      lastCheck: saved.lastCheck,
      lastResult: status.lastResult,
      lastError: status.lastError,
      failedVersions: Object.keys(saved.failed),
      skippedVersions: status.skipped,
      history: saved.history.slice(-10).reverse(),
    };
  }

  function scheduleRetry() {
    if (stopped || retryIndex >= retryDelays.length) return;
    const delay = retryDelays[retryIndex];
    retryIndex += 1;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => runCheck({ auto: true }).catch(() => {}), delay);
    retryTimer.unref?.();
    log.info(`Güncelleme denetimi ${Math.round(delay / 1000)} sn sonra yeniden denenecek.`);
  }

  async function runCheck({ auto = false } = {}) {
    if (checking) return checking;
    if (job) return { status: "busy" };
    checking = (async () => {
      status.state = "checking";
      try {
        const result = await updater.check({ signal: aborter.signal });
        status.lastFound = result.status === "available" ? result : null;
        status.lastFoundAt = Date.now();
        status.incompatible = result.status === "incompatible" ? { version: result.version, reason: result.reason } : null;
        status.lastError = result.status === "error" ? result.reason : null;
        status.skipped = result.skipped || [];
        return result;
      } finally {
        status.state = job ? status.state : "idle";
        checking = null;
      }
    })();
    const result = await checking;
    if (auto && !stopped) {
      if (result.status === "available") install(result);
      else if (result.status === "error" && result.retryable) scheduleRetry();
    }
    return result;
  }

  // Yeni sürümü deneme kipinde açar; başarılıysa onaylar, değilse önceki sürüme döner.
  async function trial(info) {
    const ready = await controller.startTrial(trialTimeoutMs);
    let reason = ready ? null : "Yeni sürüm zamanında başlatılamadı veya açılırken kapandı.";
    if (!reason) {
      const probe = await controller.probe(info.version);
      if (!probe.ok) reason = probe.reason;
    }
    if (!reason) {
      updater.confirm(info.version);
      controller.release();
      status.lastResult = { outcome: "success", version: info.version, previous: info.previous || null, at: now() };
      log.info(`DestekOfis ${info.version} sürümüne güncellendi${info.previous ? ` (önceki ${info.previous})` : ""}.`);
      const removed = pruneVersions(appsDir, [info.version, info.previous, runningVersion]);
      if (removed.length) log.info(`Eski sürüm klasörleri silindi: ${removed.join(", ")}`);
      return true;
    }
    log.error(`${info.version} sürümü doğrulanamadı: ${reason}`);
    await controller.stop();
    const previousDir = info.previousDir || (info.previous && isInstalledVersion(appsDir, info.previous) ? versionDir(appsDir, info.previous) : null);
    if (!previousDir) {
      log.error("Dönülecek önceki sürüm bulunamadı; mevcut sürüm yeniden başlatılıyor.");
      controller.release();
      await controller.start();
      return false;
    }
    try {
      const schemaNow = controller.schemaVersion();
      if (info.backup && Number.isInteger(info.schemaBefore) && Number.isInteger(schemaNow) && schemaNow > info.schemaBefore) {
        controller.backupDatabase(`basarisiz-guncelleme-${info.version}`);
        controller.restoreDatabase(info.backup);
        log.info(`Veritabanı güncelleme öncesi yedeğe döndürüldü: ${info.backup}`);
      }
    } catch (error) {
      log.error("Veritabanı güncelleme öncesi hâline döndürülemedi", error);
    }
    updater.rollback({ version: info.version, previous: info.previous, reason });
    controller.setAppDir(previousDir);
    controller.release();
    controller.setPhase("restarting", "Önceki sürüme dönülüyor");
    await controller.start();
    status.lastResult = { outcome: "rolled-back", version: info.version, previous: info.previous, reason, at: now() };
    log.error(`${info.version} kurulamadı; ${info.previous} sürümüne dönüldü. Bu sürüm bir daha kendiliğinden denenmeyecek.`);
    return false;
  }

  function install(found) {
    if (job) return job;
    job = (async () => {
      const from = controller.appVersion();
      const fromDir = controller.appDir();
      const version = found.version;
      let activated = false;
      try {
        status.state = "downloading";
        status.progress = { received: 0, total: found.manifest.package.size };
        log.info(`${version} sürümü indiriliyor (${Math.ceil(found.manifest.package.size / 1024)} KB)…`);
        const zip = await updater.download(found, { signal: aborter.signal, onProgress: progress => (status.progress = progress) });
        status.state = "installing";
        status.progress = null;
        const dir = updater.stage(found, zip);
        if (stopped || controller.stopping()) return;
        // Eski sürüm hâlâ açılıyorsa (ör. veritabanı göçü) yarıda kesmemek için hazır olmasını bekle.
        await controller.waitReady?.(30_000);
        status.state = "switching";
        controller.setPhase("updating", `${version} sürümüne geçiliyor`);
        await controller.stop();
        const schemaBefore = controller.schemaVersion();
        let backup = null;
        try {
          backup = controller.backupDatabase(`guncelleme-oncesi-${from}`);
        } catch (error) {
          throw new UpdateError(`Güncelleme öncesi veritabanı yedeği alınamadı: ${error.message}`, "BACKUP_FAILED");
        }
        updater.activate({ version, previous: from, backup: backup?.name, schemaBefore });
        activated = true;
        controller.setAppDir(dir);
        await trial({ version, previous: from, previousDir: fromDir, backup: backup?.name, schemaBefore });
      } catch (error) {
        const reason = error instanceof UpdateError ? error.message : `Beklenmeyen hata: ${error.message}`;
        status.lastResult = { outcome: "failed", version, reason, at: now() };
        updater.addHistory("error", { version, reason });
        log.error(`Güncelleme (${version}) tamamlanamadı: ${reason}`);
        if (activated) writeCurrent(appsDir, { version: from, rolledBackFrom: version, selectedAt: now() });
        if (!controller.isRunning() && !controller.stopping()) {
          controller.setAppDir(fromDir);
          controller.release();
          await controller.start();
        }
        if (error.retryable && !stopped) scheduleRetry();
      } finally {
        status.state = "idle";
        status.progress = null;
        status.lastFound = null;
        job = null;
      }
    })();
    return job;
  }

  async function startup() {
    const current = readCurrent(appsDir);
    if (current?.fallbackFrom) {
      const reason = "Yeni sürümün servis yöneticisi açılamadı; önceki sürüme dönüldü.";
      updater.recordFailure(current.fallbackFrom, reason);
      status.lastResult = { outcome: "rolled-back", version: current.fallbackFrom, previous: current.version, reason, at: now() };
      writeCurrent(appsDir, { ...current, fallbackFrom: undefined, rolledBackFrom: current.fallbackFrom });
    }
    if (current?.pending && current.version === controller.appVersion()) {
      log.info(`${current.version} sürümü önceki açılışta etkinleştirilmiş ama onaylanmamış; deneme açılışı yapılıyor.`);
      controller.setPhase("updating", `${current.version} sürümü doğrulanıyor`);
      await trial({ version: current.version, previous: current.previous, backup: current.backup, schemaBefore: current.schemaBefore });
    } else {
      await controller.start();
    }
    if (updater.config().enabled && !stopped) runCheck({ auto: true }).catch(error => log.error("Güncelleme denetimi hatası", error));
  }

  async function handle(action, payload = {}) {
    if (action === "status") return publicStatus();
    if (action === "check") {
      await runCheck();
      return publicStatus();
    }
    if (action === "config") {
      updater.saveConfig(payload);
      return publicStatus();
    }
    if (action === "apply") {
      if (job) throw new UpdateError("Bir güncelleme zaten sürüyor.", "BUSY");
      if (payload.retryFailed) {
        // Yönetici daha önce kurulamayan sürümü yeniden denemek istedi.
        for (const version of Object.keys(updater.state().failed)) updater.clearFailure(version);
        status.lastFound = null;
      }
      let found = status.lastFound && Date.now() - status.lastFoundAt < RECENT_CHECK_MS ? status.lastFound : null;
      if (!found) {
        const result = await runCheck();
        found = result.status === "available" ? result : null;
      }
      if (!found) throw new UpdateError(status.incompatible?.reason || status.lastError || "Kurulacak yeni bir sürüm yok.", "NOTHING_TO_INSTALL");
      // Yanıt yöneticinin tarayıcısına ulaşsın diye kurulum kısa bir gecikmeyle başlar.
      clearTimeout(applyTimer);
      applyTimer = setTimeout(() => install(found), applyDelayMs);
      return { ...publicStatus(), accepted: true, version: found.version };
    }
    throw new UpdateError("Bilinmeyen güncelleme işlemi.", "UNKNOWN_ACTION");
  }

  function stop() {
    stopped = true;
    aborter.abort();
    clearTimeout(retryTimer);
    clearTimeout(applyTimer);
  }

  return { startup, handle, status: publicStatus, runCheck, install, stop, idle: () => (job || checking || Promise.resolve()).catch(() => {}) };
}
