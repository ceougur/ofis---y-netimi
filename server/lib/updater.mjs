// GitHub Releases (veya imzalı bir bildirge adresi) üzerinden güncelleme denetleme, indirme ve kurulum için hazırlama.
//
// Güvenlik zinciri:
//   1. Bildirge (destekofis-guncelleme.json) uygulamaya gömülü Ed25519 anahtarlarından biriyle imzalı olmalı.
//   2. Bildirgedeki sürüm, yayın etiketiyle aynı ve kurulu sürümden yeni olmalı (eski sürüme düşürme yok).
//   3. Paket (zip) boyutu ve SHA-256 özeti bildirgeyle birebir tutmalı.
//   4. Zip içeriği güvenli yollarla ve CRC denetimiyle açılır; paket kendi sürümünü doğru bildirmeli.
// Güncelleyici yalnızca app\ klasörüne yazar; data\ ve backups\ klasörlerine dokunmaz.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { readCurrent, readJsonFile, renameWithRetry, writeCurrent, writeJsonAtomic } from "./app-layout.mjs";
import { compareVersions, normalizeVersion } from "./semver.mjs";
import { MAX_ENVELOPE_BYTES, UpdateError, assessManifest, verifyEnvelope } from "./update-envelope.mjs";
import { TRUSTED_UPDATE_KEYS } from "./update-keys.mjs";
import { readZip } from "./zip.mjs";

export const DEFAULT_FEED = "github:ceougur/ofis---y-netimi";
export const MANIFEST_ASSET = "destekofis-guncelleme.json";
export const CHANNELS = Object.freeze(["stable", "beta"]);
const DEFAULT_CONFIG = Object.freeze({ enabled: true, channel: "stable", feed: null });
const REQUIRED_FILES = ["package.json", "server/server.mjs", "server/supervisor.mjs", "server/app.mjs", "client/index.html"];

const sha256File = file => createHash("sha256").update(readFileSync(file)).digest("hex");

function describeNetworkError(error) {
  const code = error?.cause?.code || error?.code || "";
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Güncelleme sunucusu zamanında yanıt vermedi.";
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return "İnternet bağlantısı yok veya güncelleme sunucusunun adı çözülemedi.";
  if (/ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT/.test(code)) return "Güncelleme sunucusuna bağlanılamadı.";
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(code)) return "Güvenli bağlantı doğrulanamadı (antivirüs/güvenlik duvarı SSL denetimi yapıyor olabilir).";
  return `Güncelleme sunucusuna ulaşılamadı${code ? ` (${code})` : ""}.`;
}

export function createUpdater({
  appsDir,
  configDir,
  currentVersion,
  fetchImpl = (...args) => globalThis.fetch(...args),
  trustedKeys = TRUSTED_UPDATE_KEYS,
  githubApi = "https://api.github.com",
  nodeVersion = process.versions.node,
  bootstrapVersion = 1,
  log = { info() {}, warn() {}, error() {} },
  requestTimeoutMs = 10_000,
  stallTimeoutMs = 30_000,
  defaultFeed = DEFAULT_FEED,
}) {
  const statePath = path.join(appsDir, "update-state.json");
  const configPath = path.join(configDir, "guncelleme.json");
  const downloadDir = path.join(appsDir, ".indirilen");
  const userAgent = `DestekOfis-Guncelleyici/${currentVersion} (+https://destekofis.vercel.app)`;

  // ---------- Ayarlar ve kalıcı durum ----------
  function config() {
    const stored = readJsonFile(configPath, {}) || {};
    return {
      enabled: stored.enabled !== false,
      channel: CHANNELS.includes(stored.channel) ? stored.channel : DEFAULT_CONFIG.channel,
      feed: typeof stored.feed === "string" && stored.feed.trim() ? stored.feed.trim() : null,
    };
  }

  function saveConfig(changes = {}) {
    const next = { ...config() };
    if (changes.enabled !== undefined) next.enabled = Boolean(changes.enabled);
    if (changes.channel !== undefined) {
      if (!CHANNELS.includes(changes.channel)) throw new UpdateError("Geçersiz güncelleme kanalı.", "CONFIG_INVALID");
      next.channel = changes.channel;
    }
    mkdirSync(configDir, { recursive: true });
    const stored = readJsonFile(configPath, {}) || {};
    writeJsonAtomic(configPath, { ...stored, enabled: next.enabled, channel: next.channel });
    return config();
  }

  function state() {
    const stored = readJsonFile(statePath, {}) || {};
    return { lastCheck: stored.lastCheck || null, failed: stored.failed && typeof stored.failed === "object" ? stored.failed : {}, history: Array.isArray(stored.history) ? stored.history : [] };
  }

  function saveState(mutate) {
    const current = state();
    mutate(current);
    current.history = current.history.slice(-30);
    try {
      writeJsonAtomic(statePath, current);
    } catch (error) {
      log.warn?.(`Güncelleme durumu kaydedilemedi: ${error.message}`);
    }
    return current;
  }

  const addHistory = (event, details = {}) => saveState(current => current.history.push({ at: new Date().toISOString(), event, ...details }));

  function recordFailure(version, reason) {
    const normalized = normalizeVersion(version);
    if (!normalized) return;
    saveState(current => {
      current.failed[normalized] = { at: new Date().toISOString(), reason: String(reason || "").slice(0, 500) };
      current.history.push({ at: new Date().toISOString(), event: "failed", version: normalized, reason: String(reason || "").slice(0, 500) });
    });
  }

  // ---------- Ağ ----------
  async function request(url, { accept = "application/json", timeoutMs = requestTimeoutMs, signal } = {}) {
    const signals = [AbortSignal.timeout(timeoutMs), signal].filter(Boolean);
    try {
      return await fetchImpl(url, { headers: { accept, "user-agent": userAgent, "x-github-api-version": "2022-11-28" }, redirect: "follow", signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0] });
    } catch (error) {
      if (signal?.aborted) throw new UpdateError("Güncelleme durduruldu.", "ABORTED");
      throw new UpdateError(describeNetworkError(error), "NETWORK", { retryable: true });
    }
  }

  async function readLimited(response, limit) {
    const reader = response.body?.getReader();
    if (!reader) return Buffer.alloc(0);
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new UpdateError("Güncelleme sunucusunun yanıtı beklenenden büyük.", "RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  async function fetchJson(url, { limit, signal } = {}) {
    const response = await request(url, { signal });
    if (response.status === 404) throw new UpdateError("Güncelleme kaynağı bulunamadı (depo özel veya kaldırılmış olabilir).", "FEED_NOT_FOUND");
    if ((response.status === 403 || response.status === 429) && response.headers.get("x-ratelimit-remaining") === "0") {
      throw new UpdateError("Güncelleme sunucusunun istek sınırına ulaşıldı; daha sonra yeniden denenecek.", "RATE_LIMITED", { retryable: true });
    }
    if (!response.ok) throw new UpdateError(`Güncelleme sunucusu hata döndürdü (HTTP ${response.status}).`, "FEED_HTTP", { retryable: response.status >= 500 || response.status === 403 });
    const body = await readLimited(response, limit);
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      throw new UpdateError("Güncelleme sunucusunun yanıtı okunamadı.", "FEED_INVALID");
    }
  }

  function resolveFeed(value) {
    const feed = value || defaultFeed;
    const github = /^github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(feed);
    if (github) return { type: "github", owner: github[1], repo: github[2] };
    if (/^https?:\/\//i.test(feed)) return { type: "manifest", url: feed };
    throw new UpdateError("Güncelleme kaynağı ayarı geçersiz.", "CONFIG_INVALID");
  }

  async function listCandidates(cfg, signal) {
    const feed = resolveFeed(cfg.feed);
    if (feed.type === "manifest") return [{ tagVersion: null, manifestUrl: feed.url, assets: null }];
    const url = `${githubApi.replace(/\/+$/, "")}/repos/${feed.owner}/${feed.repo}/releases?per_page=30`;
    const releases = await fetchJson(url, { limit: 4 * 1024 * 1024, signal });
    if (!Array.isArray(releases)) throw new UpdateError("Güncelleme sunucusunun yanıtı beklenen biçimde değil.", "FEED_INVALID");
    return releases
      .filter(release => release && !release.draft && (cfg.channel === "beta" || !release.prerelease))
      .map(release => {
        const assets = new Map((Array.isArray(release.assets) ? release.assets : []).filter(asset => asset?.name && asset?.browser_download_url).map(asset => [asset.name, { url: asset.browser_download_url, size: Number(asset.size) || 0 }]));
        return { tagVersion: normalizeVersion(release.tag_name), manifestUrl: assets.get(MANIFEST_ASSET)?.url, assets, prerelease: Boolean(release.prerelease), htmlUrl: release.html_url || null };
      })
      .filter(item => item.tagVersion && item.manifestUrl)
      .sort((a, b) => compareVersions(b.tagVersion, a.tagVersion));
  }

  // ---------- Denetleme ----------
  async function check({ signal } = {}) {
    const cfg = config();
    const failed = state().failed;
    const checkedAt = new Date().toISOString();
    const problems = [];
    const skipped = [];
    let incompatible = null;
    let result;
    try {
      const candidates = await listCandidates(cfg, signal);
      for (const candidate of candidates) {
        if (candidate.tagVersion && compareVersions(candidate.tagVersion, currentVersion) <= 0) break;
        if (candidate.tagVersion && failed[candidate.tagVersion]) {
          skipped.push(candidate.tagVersion);
          continue;
        }
        let verified;
        try {
          verified = verifyEnvelope(await fetchJson(candidate.manifestUrl, { limit: MAX_ENVELOPE_BYTES * 2, signal }), trustedKeys);
        } catch (error) {
          if (error.code === "NETWORK" || error.code === "RATE_LIMITED" || error.code === "ABORTED") throw error;
          problems.push(`${candidate.tagVersion || "Bildirge"}: ${error.message}`);
          continue;
        }
        const { manifest, keyId } = verified;
        if (candidate.tagVersion && manifest.version !== candidate.tagVersion) {
          problems.push(`${candidate.tagVersion}: yayın etiketi ile bildirgedeki sürüm (${manifest.version}) uyuşmuyor.`);
          continue;
        }
        if (failed[manifest.version]) {
          skipped.push(manifest.version);
          continue;
        }
        const assessment = assessManifest(manifest, { currentVersion, channel: cfg.channel, nodeVersion, bootstrapVersion });
        if (!assessment.ok) {
          if (assessment.code === "NOT_NEWER") continue;
          incompatible ||= { version: manifest.version, reason: assessment.reason, needsInstaller: Boolean(assessment.needsInstaller) };
          continue;
        }
        let packageUrl;
        if (candidate.assets) {
          const asset = candidate.assets.get(manifest.package.name);
          if (!asset) {
            problems.push(`${manifest.version}: paket dosyası (${manifest.package.name}) yayında yok.`);
            continue;
          }
          if (asset.size && asset.size !== manifest.package.size) {
            problems.push(`${manifest.version}: paket boyutu bildirgeyle uyuşmuyor.`);
            continue;
          }
          packageUrl = asset.url;
        } else packageUrl = new URL(manifest.package.url || manifest.package.name, candidate.manifestUrl).href;
        result = { status: "available", version: manifest.version, manifest, packageUrl, keyId, releaseUrl: candidate.htmlUrl || null };
        break;
      }
      if (!result && incompatible) result = { status: "incompatible", ...incompatible };
      if (!result && problems.length && candidates.some(item => !item.tagVersion || compareVersions(item.tagVersion, currentVersion) > 0)) {
        result = { status: "error", reason: problems[0], retryable: false };
      }
      result ||= { status: "up-to-date", latestVersion: candidates[0]?.tagVersion && compareVersions(candidates[0].tagVersion, currentVersion) > 0 ? candidates[0].tagVersion : currentVersion };
    } catch (error) {
      const known = error instanceof UpdateError;
      result = { status: "error", reason: known ? error.message : `Güncelleme denetlenemedi: ${error.message}`, code: error.code || null, retryable: known ? error.retryable : true };
    }
    result = { ...result, checkedAt, channel: cfg.channel, currentVersion, problems, skipped };
    saveState(current => {
      current.lastCheck = { at: checkedAt, status: result.status, version: result.version || result.latestVersion || null, reason: result.reason || null };
    });
    if (result.status === "available") log.info(`Yeni sürüm bulundu: ${result.version} (kurulu ${currentVersion})`);
    else if (result.status === "error") log.warn?.(`Güncelleme denetimi başarısız: ${result.reason}`);
    else if (result.status === "incompatible") log.warn?.(`Güncelleme kurulum dosyası gerektiriyor: ${result.reason}`);
    return result;
  }

  // ---------- İndirme ----------
  function ensureFreeSpace(dir, needed) {
    try {
      const stats = statfsSync(dir);
      const free = Number(stats.bavail) * Number(stats.bsize);
      if (Number.isFinite(free) && free < needed) throw new UpdateError(`Diskte yeterli boş alan yok (gereken ≈ ${Math.ceil(needed / 1048576)} MB).`, "DISK_FULL");
    } catch (error) {
      if (error instanceof UpdateError) throw error;
    }
  }

  async function download(found, { onProgress, signal } = {}) {
    const { manifest, packageUrl } = found;
    const size = manifest.package.size;
    mkdirSync(downloadDir, { recursive: true });
    ensureFreeSpace(downloadDir, size * 4 + 64 * 1024 * 1024);
    const target = path.join(downloadDir, manifest.package.name);
    if (existsSync(target) && sha256File(target) === manifest.package.sha256) return target;
    const part = `${target}.part`;
    const stall = new AbortController();
    let stallTimer = setTimeout(() => stall.abort(), stallTimeoutMs);
    const resetStall = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => stall.abort(), stallTimeoutMs);
    };
    const signals = [stall.signal, AbortSignal.timeout(15 * 60_000), signal].filter(Boolean);
    let handle;
    try {
      let response;
      try {
        response = await fetchImpl(packageUrl, { headers: { accept: "application/octet-stream", "user-agent": userAgent }, redirect: "follow", signal: AbortSignal.any(signals) });
      } catch (error) {
        throw new UpdateError(signal?.aborted ? "Güncelleme durduruldu." : describeNetworkError(error), signal?.aborted ? "ABORTED" : "NETWORK", { retryable: !signal?.aborted });
      }
      if (!response.ok) throw new UpdateError(`Güncelleme paketi indirilemedi (HTTP ${response.status}).`, "DOWNLOAD_HTTP", { retryable: true });
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared && declared !== size) throw new UpdateError("Güncelleme paketinin boyutu bildirgeyle uyuşmuyor.", "SIZE_MISMATCH");
      const hash = createHash("sha256");
      handle = await open(part, "w");
      let received = 0;
      onProgress?.({ received, total: size });
      try {
        for await (const chunk of response.body) {
          received += chunk.length;
          if (received > size) throw new UpdateError("Güncelleme paketi beklenenden büyük; indirme durduruldu.", "SIZE_MISMATCH");
          hash.update(chunk);
          await handle.write(chunk);
          resetStall();
          onProgress?.({ received, total: size });
        }
      } catch (error) {
        if (error instanceof UpdateError) throw error;
        throw new UpdateError(signal?.aborted ? "Güncelleme durduruldu." : stall.signal.aborted ? "İndirme durdu (bağlantı çok yavaş veya kesildi)." : describeNetworkError(error), signal?.aborted ? "ABORTED" : "NETWORK", { retryable: !signal?.aborted });
      }
      await handle.close();
      handle = null;
      if (received !== size) throw new UpdateError("Güncelleme paketi eksik indirildi.", "SIZE_MISMATCH", { retryable: true });
      if (hash.digest("hex") !== manifest.package.sha256) throw new UpdateError("Güncelleme paketinin özeti (SHA-256) tutmuyor; paket bozuk veya değiştirilmiş. Güncelleme reddedildi.", "HASH_MISMATCH");
      renameWithRetry(part, target);
      return target;
    } catch (error) {
      rmSync(part, { force: true });
      throw error;
    } finally {
      clearTimeout(stallTimer);
      await handle?.close().catch(() => {});
    }
  }

  // ---------- Paketi açma ----------
  function stage(found, zipPath) {
    const { manifest } = found;
    const version = manifest.version;
    const temp = path.join(appsDir, `.${version}-${randomBytes(4).toString("hex")}.tmp`);
    try {
      if (sha256File(zipPath) !== manifest.package.sha256) throw new UpdateError("Güncelleme paketinin özeti tutmuyor.", "HASH_MISMATCH");
      const entries = readZip(readFileSync(zipPath), { maxTotalBytes: 512 * 1024 * 1024 });
      mkdirSync(temp, { recursive: true });
      const root = `${temp}${path.sep}`;
      for (const entry of entries) {
        const target = path.resolve(temp, entry.name);
        if (!target.startsWith(root)) throw new UpdateError(`Paket içinde güvensiz yol: ${entry.name}`, "PACKAGE_INVALID");
        if (entry.directory) {
          mkdirSync(target, { recursive: true });
          continue;
        }
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, entry.data);
      }
      for (const file of REQUIRED_FILES) if (!existsSync(path.join(temp, file))) throw new UpdateError(`Güncelleme paketi eksik: ${file}`, "PACKAGE_INVALID");
      const declared = normalizeVersion(readJsonFile(path.join(temp, "package.json"), {})?.version);
      if (declared !== version) throw new UpdateError(`Paketin kendi sürümü (${declared || "yok"}) bildirgedeki sürümle (${version}) aynı değil.`, "PACKAGE_INVALID");
      writeFileSync(path.join(temp, ".paket.json"), `${JSON.stringify({ version, sha256: manifest.package.sha256, keyId: found.keyId || null, stagedAt: new Date().toISOString() }, null, 2)}\n`);
      const target = path.join(appsDir, version);
      if (existsSync(target)) rmSync(target, { recursive: true, force: true, maxRetries: 5 });
      renameWithRetry(temp, target);
      rmSync(downloadDir, { recursive: true, force: true });
      return target;
    } catch (error) {
      rmSync(temp, { recursive: true, force: true });
      if (error instanceof UpdateError) throw error;
      throw new UpdateError(`Güncelleme paketi açılamadı: ${error.message}`, "PACKAGE_INVALID");
    }
  }

  // ---------- Etkinleştirme / onay / geri dönüş ----------
  function activate({ version, previous, backup, schemaBefore }) {
    const data = writeCurrent(appsDir, { version, previous, pending: true, backup, schemaBefore, selectedAt: new Date().toISOString() });
    addHistory("activated", { version, previous });
    return data;
  }

  function confirm(version) {
    const current = readCurrent(appsDir) || { version };
    const data = writeCurrent(appsDir, { version, previous: current.previous, selectedAt: current.selectedAt, confirmedAt: new Date().toISOString() });
    addHistory("installed", { version, previous: current.previous || null });
    saveState(saved => {
      // Kurulan sürüm son denetimde bulunan sürümse artık sistem günceldir.
      if (saved.lastCheck && saved.lastCheck.version === version) saved.lastCheck = { ...saved.lastCheck, status: "up-to-date", reason: null };
    });
    return data;
  }

  function rollback({ version, previous, reason }) {
    const data = writeCurrent(appsDir, { version: previous, rolledBackFrom: version, selectedAt: new Date().toISOString() });
    recordFailure(version, reason);
    return data;
  }

  function clearFailure(version) {
    saveState(current => {
      delete current.failed[normalizeVersion(version)];
    });
  }

  return { config, saveConfig, state, check, download, stage, activate, confirm, rollback, recordFailure, clearFailure, addHistory, paths: { statePath, configPath, downloadDir } };
}
