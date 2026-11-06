// 2.5.0 D2 — BAKIM KİPİ (docs/devir/D2-ALTYAPI-TASARIM.md §5; DEVIR-PLANI G1.1, §7.6).
//
// Devir (D4), Devri Yenile ve Devri Geri Al şirketi bu kipe alır. Kip ortak katmanda tek kayıttır (şirket kimliği → kip bilgisi). Kip açıkken:
//   1. Şirkete giden BÜTÜN yazma istekleri 503 "maintenance" (001 dahil; server/app.mjs assertWriteGates). Okuma çalışır. Ortak katmanın şirket / yedek /
//      güncelleme yazmaları da (Şirketler, Yedekler, Güncelleme) herhangi bir şirket kipteyken 503 — dosya takası ve kayıt defteriyle çakışmasın.
//   2. Veri tabanı düzeyinde güvence: 002 ve sonrası bağlantı PRAGMA query_only; 001'in bağlantısı ortak katmanı (oturum, kullanıcı, lisans) da taşıdığı için
//      orada GEÇİCİ tetikleyiciler (applyWriteGuard): ortak tablolar ve ortak ayar anahtarları dışındaki her tabloya yazım RAISE(ABORT). GET'te yazan yollar
//      (tekrarlayan fatura taslağı, test serisi başlangıcı) ve gözden kaçan bir arka plan yazıcısı da dosyayı değiştiremez.
//   3. Arka plan yazıcıları durur: canWriteInBackground false (Sheets eşitlemesi, POS valör kuyruğu, belge temizliği, sohbet arşivi, mutabakat taraması, oturum
//      temizliği, donmuş defter, WhatsApp durum bildirimi 503); WhatsApp işçisi şirketin kilit işaretini görür (writeLock sarmalayıcısı); otomatik yedek hedefleri
//      kipteki şirketi atlar; 001 kipteyken mobil özet yüklemesi durur.
//   4. Güncelleme kurulumu başlamaz: servis yöneticisinden "update:hold" (lib/update-orchestrator.mjs) — süreli (UPDATE_HOLD_TTL_MS), kip sürdükçe yenilenir;
//      süreç ölürse tutma kendiliğinden düşer. Güncelleme o an geçiş adımındaysa kip AÇILMAZ (503 update-switching).
// Kip BELLEKTEDİR: süreç ölünce kalkar (G1: canlı dosya takasa kadar değişmez — kopyada üret, doğrula, takas et). Yarıda kalan kipin izi veri klasöründeki
// bakim-kipi.json'dadır; açılışta okunur (lastAborted; Yönetim ekranı / D4 temizliği için), dosya silinir, kip yeniden AÇILMAZ (karar: tasarım notu §5.4).
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HttpError } from "../http.mjs";

export const MAINTENANCE_CODE = "maintenance";
export const MAINTENANCE_MARKER = "bakim-kipi.json";
export const UPDATE_HOLD_TTL_MS = 30 * 60_000;
const RENEW_MS = 5 * 60_000;
const REASONS = { devir: "yıl sonu devri yapılıyor", "devri-yenile": "devir yenileniyor", "devri-geri-al": "devir geri alınıyor" };
export const reasonText = reason => REASONS[reason] || "bakım yapılıyor";
export const maintenanceMessage = entry => `${entry?.label ? `“${entry.label}” şirketinde ` : ""}${reasonText(entry?.reason)}; bu sırada kayıt girilemez. Birkaç dakika sonra yeniden deneyin.`;

const publicEntry = entry => ({ companyId: entry.companyId, label: entry.label || "", reason: entry.reason, reasonText: reasonText(entry.reason), runId: entry.runId || "", since: entry.since, by: entry.by || null, updateHold: Boolean(entry.hold?.held) });

/**
 * @param {object} o
 * @param {string} o.dataDir ortak katmanın veri klasörü (bakim-kipi.json)
 * @param {() => object|null} [o.supervisorLink] servis yöneticisi kanalı (yoksa güncelleme tutulmaz — güncelleme de yoktur)
 * @param {(companyId: string, on: boolean, entry: object) => void} [o.onChange] veri tabanı korumasını kuran / kaldıran (server/app.mjs)
 */
export function createMaintenance({ dataDir, log = null, supervisorLink = () => null, onChange = () => {}, now = () => Date.now(), holdTtlMs = UPDATE_HOLD_TTL_MS, renewMs = RENEW_MS } = {}) {
  const active = new Map();
  const pending = new Set();
  const marker = path.join(dataDir, MAINTENANCE_MARKER);
  let renewTimer = null;
  let stopped = false;
  // Önceki süreçte yarıda kalan kip (süreç öldü / kapandı): yalnız bilgi olarak tutulur, kip yeniden açılmaz.
  let lastAborted = null;
  if (existsSync(marker)) {
    try {
      const value = JSON.parse(readFileSync(marker, "utf8"));
      lastAborted = { at: new Date(now()).toISOString(), entries: Array.isArray(value?.entries) ? value.entries.map(publicEntry) : [], pid: value?.pid || null };
    } catch {
      lastAborted = { at: new Date(now()).toISOString(), entries: [], pid: null, unreadable: true };
    }
    try {
      rmSync(marker, { force: true });
    } catch {
      // silinemedi; bir sonraki yazımda üzerine yazılır
    }
    log?.warn?.(`Önceki çalışmada bakım kipi yarıda kaldı (${lastAborted.entries.map(item => `${item.label || item.companyId}: ${item.reasonText}`).join(", ") || "ayrıntı okunamadı"}); canlı veri değişmedi, kip kaldırıldı.`);
  }
  function writeMarker() {
    try {
      if (!active.size) return void rmSync(marker, { force: true });
      writeFileSync(`${marker}.tmp`, JSON.stringify({ pid: process.pid, at: new Date(now()).toISOString(), entries: [...active.values()] }, null, 2));
      renameSync(`${marker}.tmp`, marker);
    } catch (error) {
      log?.warn?.(`Bakım kipi işareti yazılamadı: ${error.message}`);
    }
  }
  const link = () => {
    try {
      return supervisorLink?.() || null;
    } catch {
      return null;
    }
  };
  async function hold(key, on) {
    const current = link();
    if (!current?.supervised) return { supervised: false, held: false };
    try {
      const result = await current.request("update:hold", { key, on, ttlMs: holdTtlMs }, { timeoutMs: 10_000 });
      return { supervised: true, held: Boolean(on), switching: Boolean(result?.switching) };
    } catch (error) {
      // Güncelleme bu kurulumda yoksa (kurulu düzen değil / kapalı) tutulacak bir şey de yoktur.
      if (error?.code === "UPDATES_DISABLED") return { supervised: true, held: false, disabled: true };
      throw error;
    }
  }
  function scheduleRenew() {
    if (renewTimer || stopped || !renewMs) return;
    renewTimer = setInterval(() => {
      for (const entry of active.values()) {
        if (!entry.hold?.held) continue;
        hold(entry.companyId, true).catch(error => log?.warn?.(`Güncelleme tutması yenilenemedi (${entry.companyId}): ${error.message}`));
      }
    }, renewMs);
    renewTimer.unref?.();
  }
  async function enter(companyId, { reason = "devir", runId = "", by = null, label = "" } = {}) {
    const id = String(companyId || "");
    if (!id) throw new HttpError(400, "Bakım kipi için şirket gerekli.");
    if (stopped) throw new HttpError(503, "Sunucu kapanıyor; bakım kipi açılmadı.", { code: "shutting-down" });
    if (active.has(id) || pending.has(id)) throw new HttpError(409, "Bu şirkette bakım zaten sürüyor.", { code: "maintenance-busy" });
    pending.add(id);
    try {
      let held;
      try {
        held = await hold(id, true);
      } catch (error) {
        throw new HttpError(503, `Güncelleme yöneticisine ulaşılamadı; bakım kipi açılmadı (${error.message}). Birkaç dakika sonra yeniden deneyin.`, { code: "update-hold-failed", retryAfter: 60 });
      }
      if (held.switching) {
        await hold(id, false).catch(() => {});
        throw new HttpError(503, "Program şu anda güncelleniyor; güncelleme bitince yeniden deneyin.", { code: "update-switching", retryAfter: 60 });
      }
      const entry = { companyId: id, reason, runId: String(runId || ""), label: String(label || ""), by: by ? { id: by.id || "", name: by.display_name || by.username || by.name || "" } : null, since: new Date(now()).toISOString(), hold: held };
      active.set(id, entry);
      try {
        onChange(id, true, entry);
      } catch (error) {
        active.delete(id);
        try {
          onChange(id, false, entry);
        } catch {
          // koruma kaldırılamadı; bağlantı kapanınca geçici tetikleyiciler de düşer
        }
        if (held.held) await hold(id, false).catch(() => {});
        throw error;
      }
      writeMarker();
      scheduleRenew();
      log?.info?.(`Bakım kipi açıldı: ${entry.label || id} (${reasonText(reason)}${runId ? `, ${runId}` : ""})`);
      return publicEntry(entry);
    } finally {
      pending.delete(id);
    }
  }
  async function exit(companyId, { runId = "" } = {}) {
    const id = String(companyId || "");
    const entry = active.get(id);
    if (!entry) return false;
    if (runId && entry.runId && String(runId) !== entry.runId) throw new HttpError(409, "Bakım kipi başka bir işlemin; kapatılmadı.", { code: "maintenance-owner" });
    active.delete(id);
    writeMarker();
    try {
      onChange(id, false, entry);
    } catch (error) {
      log?.error?.(`Bakım kipi koruması kaldırılamadı (${id})`, error);
    }
    if (entry.hold?.held) await hold(id, false).catch(error => log?.warn?.(`Güncelleme tutması bırakılamadı (${id}): ${error.message}; süresi dolunca düşer.`));
    if (!active.size && renewTimer) {
      clearInterval(renewTimer);
      renewTimer = null;
    }
    log?.info?.(`Bakım kipi kapandı: ${entry.label || id}`);
    return true;
  }
  /** Kipi açar, işi yürütür, her durumda kapatır (hata asıl hatadır; kapatma hatası günlüğe). */
  async function run(companyId, options, fn) {
    const entry = await enter(companyId, options);
    try {
      return await fn(entry);
    } finally {
      await exit(companyId, { runId: options?.runId || "" }).catch(error => log?.error?.("Bakım kipi kapatılamadı", error));
    }
  }
  function stop() {
    stopped = true;
    clearInterval(renewTimer);
    renewTimer = null;
    // Süreç kapanıyor: işaret dosyası kalır (sonraki açılış "yarıda kaldı" der); tutmalar süresi dolunca düşer.
  }
  return {
    enter,
    exit,
    run,
    stop,
    has: id => active.has(String(id || "")),
    get: id => (active.has(String(id || "")) ? publicEntry(active.get(String(id))) : null),
    any: () => active.size > 0,
    list: () => [...active.values()].map(publicEntry),
    status: () => ({ active: [...active.values()].map(publicEntry), lastAborted }),
  };
}

// ---------- 001 bağlantısının veri tabanı koruması (geçici tetikleyiciler) ----------
// Ortak katman tabloları (lib/company-backups.mjs COMMON_TABLES ile aynı küme — giriş oturumu, kullanıcı, rol, mobil eşleme) ve ortak ayar anahtarları
// (COMMON_SETTINGS) yazılabilir kalır: geri yüklemedeki gibi takasta canlıdan aktarılırlar. Öbür her tabloya INSERT / UPDATE / DELETE "DESTEKOFIS_BAKIM" ile düşer.
// Tetikleyiciler TEMP'tir: yalnız bu bağlantıda, dosyaya yazılmaz; bağlantı kapanınca (süreç ölünce) kendiliğinden kalkar.
export const MAINTENANCE_ABORT = "DESTEKOFIS_BAKIM";
const TRIGGER_PREFIX = "destekofis_bakim_";
const quoteName = value => `"${String(value).replace(/"/g, '""')}"`;
export function applyWriteGuard(db, on, { commonTables = [], commonSettingsSql = "0" } = {}) {
  const existing = db.prepare("SELECT name FROM sqlite_temp_master WHERE type = 'trigger' AND name LIKE ?").all(`${TRIGGER_PREFIX}%`).map(row => row.name);
  // Kip açılış / kapanışı istek dışından çağrılır; yine de açık bir işlemin içine düşerse (beklenmez) kendi işlemini açmaz.
  const own = !db.isTransaction;
  if (own) db.exec("BEGIN");
  try {
    for (const name of existing) db.exec(`DROP TRIGGER IF EXISTS temp.${quoteName(name)}`);
    if (on) {
      const skip = new Set(commonTables);
      const tables = db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
      for (const table of tables) {
        if (skip.has(table)) continue;
        for (const op of ["INSERT", "UPDATE", "DELETE"]) {
          const ref = op === "DELETE" ? "OLD" : "NEW";
          const when = table === "settings" ? ` WHEN NOT (${commonSettingsSql.replace(/\bkey\b/g, `${ref}.key`)})` : "";
          db.exec(`CREATE TEMP TRIGGER ${quoteName(`${TRIGGER_PREFIX}${table}_${op.toLowerCase()}`)} BEFORE ${op} ON main.${quoteName(table)}${when} BEGIN SELECT RAISE(ABORT, '${MAINTENANCE_ABORT}'); END`);
        }
      }
    }
    if (own) db.exec("COMMIT");
  } catch (error) {
    if (own) db.exec("ROLLBACK");
    throw error;
  }
  return db.prepare("SELECT COUNT(*) AS n FROM sqlite_temp_master WHERE type = 'trigger' AND name LIKE ?").get(`${TRIGGER_PREFIX}%`).n;
}
