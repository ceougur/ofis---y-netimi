// 2.4.7 M4 — cloudflared indirici ve doğrulayıcı (docs/mobil/M4-TASARIM.md §3).
//
// Kural: çalıştırılan dosya HER ZAMAN özeti kodda sabit (release.mjs) olan dosyadır.
//  - Var olan dosya her açılışta yeniden özetlenir (diskte değiştirilmiş dosya çalışmaz; silinir, yeniden indirilir).
//  - İndirme "<ad>.part" dosyasına akar, akarken özetlenir; tamamlanınca özet tutarsa adı tek adımda (rename) değiştirilir. Yarıda kalan indirme
//    (bağlantı koptu, süre doldu, program kapandı) .part olarak kalır ve bir sonraki denemede baştan yazılır — yarım dosya hiçbir zaman çalıştırılmaz.
//  - Özet tutmazsa .part silinir, TunnelError("hash"); disk dolu (ENOSPC) → .part silinir, TunnelError("disk"); ağ → TunnelError("network").
//  - Boyut sınırı (maxBytes) aşılırsa indirme kesilir (bozuk/yanlış yanıt diski doldurmaz).
import { createHash } from "node:crypto";
import { chmodSync, createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";

export class TunnelError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "TunnelError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const VERSION_DIR = /^\d{4}\.\d{1,2}\.\d{1,3}$/;

/**
 * İkiliyi hazırlar: doğru özetli dosya varsa yolunu döner, yoksa indirir + doğrular.
 * @param {object} o
 * @param {string} o.root  bileşen klasörü (<veri>/bilesenler/cloudflared)
 * @param {object} o.asset release.assetFor().asset { file, url, sha256, maxBytes, version }
 * @param {Function} o.fetchImpl vekil sunucuya uyan fetch (config.fetchImpl)
 * @param {number} [o.timeoutMs]
 * @param {Function} [o.onProgress] (alınan bayt, toplam|null)
 */
export async function ensureBinary({ root, asset, fetchImpl, timeoutMs = 10 * 60_000, onProgress = () => {}, log = console }) {
  if (!asset || !/^[0-9a-f]{64}$/.test(asset.sha256 || "")) throw new TunnelError("unpinned", "Bağlantı bileşeninin doğrulama özeti bu sürümde tanımlı değil.");
  const dir = path.join(root, asset.version);
  const target = path.join(dir, asset.file);
  const part = `${target}.part`;
  mkdirSync(dir, { recursive: true });
  if (existsSync(target)) {
    const have = await sha256File(target).catch(() => "");
    if (have === asset.sha256) {
      cleanupOldVersions(root, asset.version, log);
      return { path: target, downloaded: false };
    }
    log.warn?.(`Bağlantı bileşeninin özeti tutmadı (diskte değişmiş); silinip yeniden indirilecek.`);
    rmSync(target, { force: true });
  }
  rmSync(part, { force: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  let handle = null;
  try {
    let response;
    try {
      response = await fetchImpl(asset.url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "DestekOfis" } });
    } catch (error) {
      throw new TunnelError("network", "Bağlantı bileşeni indirilemedi (internet bağlantısı yok ya da engelli).", error);
    }
    if (!response.ok || !response.body) throw new TunnelError("network", `Bağlantı bileşeni indirilemedi (HTTP ${response.status}).`);
    const total = Number(response.headers?.get?.("content-length")) || null;
    if (total && total > asset.maxBytes) throw new TunnelError("size", "Bağlantı bileşeni beklenenden büyük; indirilmedi.");
    const hash = createHash("sha256");
    let received = 0;
    handle = await open(part, "w");
    try {
      for await (const chunk of response.body) {
        const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
        received += bytes.length;
        if (received > asset.maxBytes) throw new TunnelError("size", "Bağlantı bileşeni beklenenden büyük; indirme kesildi.");
        hash.update(bytes);
        await handle.write(bytes);
        onProgress(received, total);
      }
    } catch (error) {
      if (error instanceof TunnelError) throw error;
      if (error?.code === "ENOSPC") throw new TunnelError("disk", "Diskte yer kalmadı; bağlantı bileşeni indirilemedi.", error);
      throw new TunnelError("network", "Bağlantı bileşeninin indirilmesi yarıda kaldı.", error);
    }
    await handle.sync().catch(() => {});
    await handle.close();
    handle = null;
    if (total && received !== total) throw new TunnelError("network", "Bağlantı bileşeninin indirilmesi yarıda kaldı.");
    const got = hash.digest("hex");
    if (got !== asset.sha256) throw new TunnelError("hash", "İndirilen bağlantı bileşeninin özeti beklenenle aynı değil; dosya silindi ve çalıştırılmadı.");
    renameSync(part, target);
    if (process.platform !== "win32") chmodSync(target, 0o755);
    cleanupOldVersions(root, asset.version, log);
    return { path: target, downloaded: true };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    rmSync(part, { force: true });
    if (error instanceof TunnelError) throw error;
    if (error?.code === "ENOSPC") throw new TunnelError("disk", "Diskte yer kalmadı; bağlantı bileşeni indirilemedi.", error);
    throw new TunnelError("network", "Bağlantı bileşeni indirilemedi.", error);
  } finally {
    clearTimeout(timer);
  }
}

// Yalnız bu programın kendi bileşen klasöründeki ESKİ sürüm klasörleri (ad: yıl.ay.yama) silinir; başka hiçbir şey.
function cleanupOldVersions(root, keep, log) {
  try {
    for (const name of readdirSync(root)) {
      if (name !== keep && VERSION_DIR.test(name)) rmSync(path.join(root, name), { recursive: true, force: true });
    }
  } catch (error) {
    log.warn?.(`Eski bağlantı bileşeni silinemedi: ${error.message}`);
  }
}
