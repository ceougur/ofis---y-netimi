// 2.4.7 M4 — canlı bağlantı (tünel) yöneticisi (docs/mobil/M4-TASARIM.md).
//
// Sunucu açıkken eşli cihazlar programa Cloudflare Tunnel üzerinden canlı bağlanır. Program tüneli KENDİLİĞİNDEN açar: kapıcıdan (bulut/kapi/tunel.mjs)
// ofisine ait tüneli ve ofis adını ister, cloudflared'i (ilk kullanımda indirilir, özeti doğrulanır) yalnız uzak dinleyiciye (app.listenRemote,
// 127.0.0.1) bağlayarak çalıştırır, adresi karekoda verir (mobileRemote.setPublicUrl). Müşteri başına elle iş yok.
//
// Ne zaman açık (BAŞ MİMAR KARARI, §6): lisans yazılabilir VE (en az bir eşli cihaz VAR ya da süresi dolmamış bir karekod BEKLİYOR). Eşli cihaz ve bekleyen
// karekod yoksa cloudflared çalışmaz (internete açık kapı yok). Adres önceden hazır olsun diye "Uzaktan Bağlanabilir" işaretli kullanıcı varsa kapıcıya
// bir kez başvurulur (adres saklanır, süreç başlamaz). Durum Yönetim → Mobil Cihazlar kartında: Bağlı / Bağlanıyor / Kapalı + neden.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertSafeIngress, buildIngress, cloudflaredArgs, ingressYaml } from "./config.mjs";
import { TunnelError, ensureBinary as defaultEnsureBinary } from "./download.mjs";
import { createProcessSupervisor, reapOrphan } from "./process.mjs";
import { CLOUDFLARED_VERSION, assetFor } from "./release.mjs";

const INFO_SETTING = "mobile.tunnel.info";
export const TUNNEL_STATES = Object.freeze({ off: "Kapalı", connecting: "Bağlanıyor", connected: "Bağlı" });
const RETRY = { network: [30_000, 60_000, 120_000, 300_000, 600_000], gate: [30_000, 60_000, 120_000, 300_000, 600_000], hash: [3_600_000], disk: [900_000], size: [3_600_000] };
const STOP_GRACE_MS = 60_000;

export const TUNNEL_REASONS = Object.freeze({
  disabled: "Uzaktan bağlantı bu kurulumda kapalı.",
  license: "Lisans geçerli değil; uzaktan bağlantı kapalı.",
  idle: "Eşli cihaz yok; karekod oluşturulunca bağlantı kendiliğinden açılır.",
  platform: "Bu işletim sisteminde uzaktan bağlantı bileşeni yok.",
  unpinned: "Bağlantı bileşeni bu sürümde tanımlı değil; program güncellemesiyle gelecek.",
  preparing: "Bağlantı hazırlanıyor.",
  downloading: "Bağlantı bileşeni indiriliyor (ilk kullanımda bir kez).",
  gate: "Kapıcıya başvuruluyor.",
  starting: "Bağlantı kuruluyor.",
  reconnecting: "Bağlantı koptu; yeniden kuruluyor.",
});

/**
 * @param {object} o
 * @param {object} o.store ortak katman deposu
 * @param {object} o.license lisans hizmeti (status().writable)
 * @param {object} o.mobileRemote lib/mobile-remote.mjs (setPublicUrl)
 * @param {Function} o.listenRemote () => Promise<{ port }> (app.listenRemote; bir kez)
 * @param {Function} o.forbiddenPorts () => number[] (ofis ağı portları — tünele ASLA açılmaz)
 * @param {object} o.gate kapıcı istemcisi (gate-client.mjs createGateClient)
 * @param {string} o.root bileşen klasörü (<veri>/bilesenler/cloudflared)
 * @param {Function} [o.fetchImpl] indirme için fetch
 * @param {object} [o.asset] testte sahte dosya tanımı (yoksa release.assetFor())
 * @param {object} [o.runner] testte { command, argsPrefix, identity } (sahte cloudflared; yoksa indirilen ikili)
 */
export function createTunnelManager({
  store,
  license,
  mobileRemote,
  listenRemote,
  forbiddenPorts = () => [],
  gate,
  root,
  fetchImpl,
  asset: assetOverride = null,
  ensureBinary = defaultEnsureBinary,
  runner = null,
  enabled = true,
  tickMs = 5_000,
  firstTickMs = 3_000,
  now = () => Date.now(),
  log = console,
  platform = process.platform,
  stopGraceMs = STOP_GRACE_MS,
}) {
  let state = { state: "off", reason: enabled ? TUNNEL_REASONS.idle : TUNNEL_REASONS.disabled, since: new Date(now()).toISOString(), connections: 0, error: "" };
  let info = readInfo();
  if (info?.publicUrl) mobileRemote?.setPublicUrl?.(info.publicUrl);
  let remotePort = null;
  let supervisor = null;
  let token = null;
  let busy = false;
  let timer = null;
  let first = null;
  let stopped = false;
  let lastDemandAt = 0;
  let retryAt = 0;
  let failures = {};
  let exitsWithoutConnect = 0;
  let reaped = false;

  const pidFile = () => path.join(root, "cloudflared.pid");
  const configFile = () => path.join(root, "tunel.yml");

  function readInfo() {
    try {
      const value = JSON.parse(store.setting(INFO_SETTING, "") || "null");
      return value && value.hostname && value.tunnelId ? value : null;
    } catch {
      return null;
    }
  }
  function set(next, reason, extra = {}) {
    if (state.state !== next || state.reason !== reason) state = { ...state, state: next, reason, since: new Date(now()).toISOString(), ...extra };
    else state = { ...state, ...extra };
  }
  function demand() {
    const t = new Date(now()).toISOString();
    const devices = store.get("SELECT COUNT(*) AS n FROM mobile_devices d JOIN users u ON u.id = d.user_id WHERE d.revoked_at IS NULL AND u.deleted_at IS NULL").n;
    const codes = store.get("SELECT COUNT(*) AS n FROM mobile_codes WHERE state = 'active' AND expires_at > ?", t).n;
    const remoteUsers = store.get("SELECT COUNT(*) AS n FROM mobile_access a JOIN users u ON u.id = a.user_id WHERE a.remote = 1 AND u.deleted_at IS NULL").n;
    return { devices, codes, remoteUsers };
  }
  const licenseOk = () => {
    try {
      return Boolean(license?.status?.().writable);
    } catch {
      return false;
    }
  };
  function fail(error) {
    const code = error instanceof TunnelError ? error.code : "network";
    const schedule = RETRY[code === "gate-refused" ? "gate" : code] || RETRY.network;
    const n = failures[code] || 0;
    failures[code] = n + 1;
    const delay = schedule[Math.min(n, schedule.length - 1)];
    retryAt = now() + delay;
    set("off", error.message || "Uzaktan bağlantı açılamadı.", { error: code, retryInSeconds: Math.round(delay / 1000), connections: 0 });
    log.warn?.(`Uzaktan bağlantı açılamadı (${code}): ${error.message}`);
  }

  async function provision() {
    set("connecting", TUNNEL_REASONS.gate);
    const result = await gate.provision();
    token = result.token;
    info = { tunnelId: result.tunnelId, hostname: result.hostname, publicUrl: result.publicUrl, provisionedAt: new Date(now()).toISOString() };
    store.setSetting(INFO_SETTING, JSON.stringify(info));
    mobileRemote?.setPublicUrl?.(info.publicUrl);
    return info;
  }

  function onLine(line) {
    if (/Registered tunnel connection/i.test(line)) {
      exitsWithoutConnect = 0;
      failures = {};
      set("connected", "", { connections: Math.min(4, state.connections + 1), error: "" });
    } else if (/Unregistered tunnel connection|Connection terminated|Lost connection|Retrying connection/i.test(line)) {
      const left = Math.max(0, state.connections - 1);
      if (left === 0) set("connecting", TUNNEL_REASONS.reconnecting, { connections: 0 });
      else state = { ...state, connections: left };
    }
  }
  function onProcessState(s) {
    if (s.lastExit && !s.running && supervisor && s.nextRetryMs) {
      exitsWithoutConnect += state.state === "connected" ? 0 : 1;
      set("connecting", TUNNEL_REASONS.reconnecting, { connections: 0, retryInSeconds: Math.round(s.nextRetryMs / 1000) });
    }
  }

  async function startProcess() {
    if (!remotePort) remotePort = (await listenRemote()).port;
    let command;
    let argsPrefix = [];
    let identity;
    if (runner) {
      ({ command, argsPrefix = [], identity = command } = runner);
    } else {
      const picked = assetOverride ? { asset: assetOverride, reason: null } : assetFor({ platform });
      if (!picked.asset) {
        const error = new TunnelError(picked.reason, TUNNEL_REASONS[picked.reason]);
        throw error;
      }
      set("connecting", TUNNEL_REASONS.downloading);
      const binary = await ensureBinary({ root, asset: picked.asset, fetchImpl, log });
      command = binary.path;
      identity = binary.path;
    }
    if (stopped) return;
    await provision();
    if (stopped) return;
    const config = buildIngress({ hostname: info.hostname, tunnelId: info.tunnelId, remotePort, forbiddenPorts: forbiddenPorts() });
    assertSafeIngress(config, { remotePort, forbiddenPorts: forbiddenPorts() });
    mkdirSync(root, { recursive: true });
    writeFileSync(configFile(), ingressYaml(config));
    set("connecting", TUNNEL_REASONS.starting, { connections: 0 });
    exitsWithoutConnect = 0;
    supervisor = createProcessSupervisor({
      binary: command,
      args: () => [...argsPrefix, ...cloudflaredArgs({ configFile: configFile() })],
      env: () => ({ TUNNEL_TOKEN: token || "" }),
      pidFile: pidFile(),
      identity,
      onLine,
      onState: onProcessState,
      platform,
      log,
    });
    supervisor.start();
  }

  async function stopProcess() {
    const current = supervisor;
    supervisor = null;
    token = null;
    if (current) await current.stop();
  }

  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      if (!reaped) {
        reaped = true;
        mkdirSync(root, { recursive: true });
        await reapOrphan(pidFile(), { platform, log });
      }
      if (!enabled) {
        await stopProcess();
        return set("off", TUNNEL_REASONS.disabled, { connections: 0 });
      }
      if (!licenseOk()) {
        await stopProcess();
        return set("off", TUNNEL_REASONS.license, { connections: 0 });
      }
      const d = demand();
      const wanted = d.devices > 0 || d.codes > 0;
      if (wanted) lastDemandAt = now();
      if (!wanted) {
        if (supervisor && now() - lastDemandAt < stopGraceMs) return;
        await stopProcess();
        // Adres önceden hazır olsun: "Uzaktan Bağlanabilir" kişi varken kapıcıya bir kez başvurulur (süreç başlamaz, belirteç tutulmaz).
        if (d.remoteUsers > 0 && !info && now() >= retryAt) {
          try {
            await provision();
            token = null;
          } catch (error) {
            fail(error);
            return;
          }
        }
        if (now() >= retryAt || !state.error) set("off", TUNNEL_REASONS.idle, { connections: 0, error: "" });
        return;
      }
      if (supervisor) {
        // Kapıcı belirteci geçersizleşmişse (tünel silinmiş vb.) süreç bağlanmadan düşer: üç düşüşten sonra yeniden başvurulur.
        if (exitsWithoutConnect >= 3) {
          await stopProcess();
          fail(new TunnelError("gate", "Bağlantı kurulamadı; kapıcıya yeniden başvurulacak."));
        }
        return;
      }
      if (now() < retryAt) return;
      try {
        await startProcess();
      } catch (error) {
        await stopProcess();
        fail(error);
      }
    } catch (error) {
      log.error?.("Tünel yöneticisi hatası", error);
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      if (timer || stopped) return;
      first = setTimeout(tick, firstTickMs);
      first.unref?.();
      timer = setInterval(tick, tickMs);
      timer.unref?.();
    },
    tick,
    async stop() {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      timer = null;
      // Süren tur (indirme, kapıcı) en çok 3 sn beklenir; tur `stopped` görünce süreci başlatmadan döner (kapanış takılmaz).
      const until = Date.now() + 3_000;
      while (busy && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 25));
      await stopProcess();
      set("off", TUNNEL_REASONS.disabled, { connections: 0 });
    },
    status() {
      return {
        state: state.state,
        label: TUNNEL_STATES[state.state],
        reason: state.reason,
        since: state.since,
        connections: state.connections,
        publicUrl: info?.publicUrl || "",
        retryInSeconds: state.state === "off" && retryAt > now() ? Math.round((retryAt - now()) / 1000) : null,
        version: runner ? "test" : CLOUDFLARED_VERSION,
      };
    },
    // Testler ve tanılama için (belirteç DIŞARI verilmez).
    remotePort: () => remotePort,
    pid: () => supervisor?.pid() ?? null,
    configFile,
    pidFile,
  };
}
