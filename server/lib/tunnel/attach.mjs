// 2.4.7 M4 — tünel yöneticisinin programa bağlanması (app.mjs'te tek satır; docs/mobil/M4-TASARIM.md §7).
//
// Yalnız ortak katmanda (hub yok) ve `tunnel` seçeneği verilince açılır: server.mjs (üretim) `tunnel: true` verir; createApp'ı kullanan testler vermez
// (tünel yok). Testler sahte kapıcı/sahte cloudflared ile `tunnel: { gate, runner, … }` verir.
// Ders 30 (test gerçek servise ulaşmaz): lisans adresi yerel döngüyse (test kurulumu, HUKUK_LICENSE_URL=http://127.0.0.1:9) ve kapıcı adresi AÇIKÇA
// verilmemişse gerçek kapıcıya hiç başvurulmaz (tünel "bu kurulumda kapalı"). HUKUK_TUNNEL=0 tüneli her durumda kapatır.
import path from "node:path";
import { createSecretBox } from "../secret-box.mjs";
import { DEFAULT_GATE_URL, createGateClient } from "./gate-client.mjs";
import { createTunnelManager } from "./manager.mjs";

const loopbackOnly = list =>
  String(list || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .every(item => {
      try {
        return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(item).hostname);
      } catch {
        return false;
      }
    });

/**
 * @returns {object|null} tünel yöneticisi (başlatılmış) ya da null
 */
export function attachTunnel({ option, config, store, license, mobileRemote, listenRemote, forbiddenPorts, log, env = process.env }) {
  if (!option) return null;
  const opts = option === true ? {} : option;
  const explicitGate = opts.gateUrl || env.HUKUK_KAPI_URL || "";
  const testInstall = loopbackOnly(config.licenseServices) && !explicitGate && !opts.gate;
  const enabled = env.HUKUK_TUNNEL !== "0" && opts.enabled !== false && !testInstall;
  const gate = opts.gate || createGateClient({ gateUrl: explicitGate || DEFAULT_GATE_URL, fetchImpl: config.fetchImpl, store, box: createSecretBox(config.dataDir) });
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
