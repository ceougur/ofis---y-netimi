// 2.4.7 M4 — tünel yöneticisinin programa bağlanması (app.mjs'te tek satır; docs/mobil/M4-TASARIM.md §7).
//
// Yalnız ortak katmanda (hub yok). Açık olma: M3 ile AYNI anahtar — kapıcı adresi (config.mobileKapiUrl; server.mjs `mobileKapi: true` + ders 30 kuralı:
// lisans servisi ortam değişkeniyle değiştirilmişse — testler — HUKUK_KAPI_URL açıkça verilmedikçe boş). Kapıcı adresi yoksa tünel "bu kurulumda kapalı"
// ve hiçbir dış istek yok. Testler sahte kapıcı/sahte cloudflared ile `tunnel: { gate, runner, … }` verir. HUKUK_TUNNEL=0 tüneli her durumda kapatır.
import path from "node:path";
import { createGateClient } from "./gate-client.mjs";
import { createTunnelManager } from "./manager.mjs";

/**
 * @returns {object|null} tünel yöneticisi (başlatılmış) ya da null
 */
export function attachTunnel({ option, config, store, license, mobileRemote, mobileSync = () => null, listenRemote, forbiddenPorts, log, env = process.env }) {
  const opts = option && typeof option === "object" ? option : {};
  const gateUrl = opts.gateUrl || config.mobileKapiUrl || "";
  const enabled = env.HUKUK_TUNNEL !== "0" && opts.enabled !== false && Boolean(opts.gate || gateUrl);
  if (!option && !gateUrl) return null;
  const client = opts.gate || createGateClient({ gateUrl, fetchImpl: config.mobileKapiFetch || config.fetchImpl, store, now: () => config.remoteNow?.ms?.() ?? Date.now() });
  // Ofis kapıcıda henüz kayıtlı değilse (ilk açılış) M3'ün kaydı bir kez tetiklenir, başvuru yinelenir.
  const gate = {
    async provision() {
      try {
        return await client.provision();
      } catch (error) {
        const sync = mobileSync();
        if (error?.gateCode !== "kapi-ofis-yok" || !sync?.kayitGonder) throw error;
        await sync.kayitGonder().catch(() => null);
        return client.provision();
      }
    },
  };
  const manager = createTunnelManager({
    store,
    license,
    mobileRemote,
    listenRemote,
    forbiddenPorts,
    gate,
    root: opts.root || path.join(config.dataDir, "bilesenler", "cloudflared"),
    fetchImpl: config.fetchImpl,
    asset: opts.asset || null,
    ensureBinary: opts.ensureBinary,
    runner: opts.runner || null,
    enabled,
    tickMs: opts.tickMs ?? 5_000,
    firstTickMs: opts.firstTickMs ?? 3_000,
    stopGraceMs: opts.stopGraceMs,
    log,
  });
  manager.start();
  return manager;
}
