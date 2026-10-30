// 2.4.7 M4 — cloudflared yapılandırması (docs/mobil/M4-TASARIM.md §4).
//
// Tünel YEREL yönetimli (config_src "local"): giriş kuralları Cloudflare'de değil, bu dosyada; böylece tünelin nereye bağlandığına yalnız program karar verir
// ve kural test edilebilir. Tek kural: atanan ofis adı → http://127.0.0.1:<uzak dinleyici portu> (app.listenRemote). Başka her ad → 404.
// ASLA: ofis ağının ana portu (config.port / publicPort), 0.0.0.0, başka bir bilgisayar, dosya ya da başka şema. Bu kurallar buildIngress içinde
// zorlanır; ihlal TunnelError("config") fırlatır ve süreç başlamaz.
//
// httpHostHeader: uzak dinleyiciye giden Host her zaman ofis adı → mobile-remote çerezleri Secure alır (Host yerel döngü değil) ve aynı köken denetimi
// (Origin = https://<ofis adı>) tutar. Belirteç dosyaya YAZILMAZ (yalnız ortam değişkeni TUNNEL_TOKEN, bellekte).
import { TunnelError } from "./download.mjs";

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const TUNNEL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * @param {object} o
 * @param {string} o.hostname kapıcının atadığı ofis adı (M3 düzeni <ofis>.destekofis.net, ofis = "o" + 16 base32)
 * @param {string} o.tunnelId
 * @param {number} o.remotePort uzak dinleyicinin portu (listenRemote adresi)
 * @param {number[]} o.forbiddenPorts ofis ağı portları (ana dinleyici, servis yöneticisi kapısı)
 */
export function buildIngress({ hostname, tunnelId, remotePort, forbiddenPorts = [] }) {
  const host = String(hostname || "").toLowerCase();
  if (!HOSTNAME.test(host)) throw new TunnelError("config", "Tünel adı geçersiz.");
  if (!TUNNEL_ID.test(String(tunnelId || ""))) throw new TunnelError("config", "Tünel kimliği geçersiz.");
  if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) throw new TunnelError("config", "Uzak dinleyici portu geçersiz.");
  if (forbiddenPorts.filter(Number.isInteger).includes(remotePort)) throw new TunnelError("config", "Tünel ofis ağının ana portuna bağlanamaz.");
  return {
    tunnel: tunnelId,
    ingress: [
      { hostname: host, service: `http://127.0.0.1:${remotePort}`, originRequest: { httpHostHeader: host, connectTimeout: "10s", noHappyEyeballs: true } },
      { service: "http_status:404" },
    ],
  };
}

/** YAML (cloudflared'in okuduğu biçim; JSON YAML'ın alt kümesidir — her değer tırnaklı JSON dizgisi, kaçış sorunu yok). */
export const ingressYaml = config => `${JSON.stringify(config, null, 2)}\n`;

/** Yazılmış yapılandırmanın yalnız izin verilen hizmetleri içerdiğini denetler (test + açılış öncesi son denetim). */
export function assertSafeIngress(config, { remotePort, forbiddenPorts = [] }) {
  const rules = Array.isArray(config?.ingress) ? config.ingress : [];
  if (rules.length !== 2) throw new TunnelError("config", "Tünel yapılandırmasında beklenmeyen kural var.");
  const [first, last] = rules;
  if (first.service !== `http://127.0.0.1:${remotePort}`) throw new TunnelError("config", "Tünel yalnız uzak dinleyiciye bağlanır.");
  if (forbiddenPorts.includes(remotePort)) throw new TunnelError("config", "Tünel ofis ağının ana portuna bağlanamaz.");
  if (last.service !== "http_status:404" || last.hostname) throw new TunnelError("config", "Tünelin son kuralı 404 olmalı.");
  return true;
}

/** cloudflared komut satırı (belirteç YOK — ortam değişkeninde). */
export const cloudflaredArgs = ({ configFile, logLevel = "info" }) => ["tunnel", "--no-autoupdate", "--config", configFile, "--loglevel", logLevel, "--metrics", "127.0.0.1:0", "--grace-period", "3s", "run"];
