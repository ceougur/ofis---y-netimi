// Uzman mali müşavir turu — ortak yardımcılar. Aday kopyası: ../uzman-mm-243 (5966ac3). Ağa çıkılmaz (sahte EDM, lisans 127.0.0.1:9).
import path from "node:path";
import { pathToFileURL } from "node:url";

export const S = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad";
export const ROOT = path.join(S, "defter-243");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
export const helpers = await imp("test/helpers.mjs");
export const mock = await imp("test/einvoice-mock.mjs");
export const edmLib = await imp("server/lib/einvoice/edm.mjs");

export const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz: ${url}`);
  return globalThis.fetch(input, init);
};

export async function boot({ dataDir, now, extra = {} }) {
  edmLib.resetEdmCaches?.();
  const server = await helpers.startTestServer({ dataDir, now, edocEnabled: true, fetchImpl, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...extra });
  const client = server.client();
  const login = await client.login("admin", helpers.ADMIN_PASSWORD);
  if (login.status !== 200) throw new Error(`giriş ${login.status}`);
  const log = [];
  const call = async (label, method, url, body, { allow = [] } = {}) => {
    const r = method === "GET" ? await client.get(url) : method === "DELETE" ? await client.del(url) : await client[method.toLowerCase()](url, body);
    const data = r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data;
    log.push({ label, method, url, status: r.status, body, resp: r.status === 200 ? undefined : data });
    if (r.status !== 200 && !allow.includes(r.status)) {
      console.log(`✗ ${label}: ${r.status} ${JSON.stringify(data).slice(0, 600)}`);
    }
    return { status: r.status, data };
  };
  const must = async (label, method, url, body) => {
    const r = await call(label, method, url, body);
    if (r.status !== 200) throw new Error(`${label} başarısız: ${r.status} ${JSON.stringify(r.data).slice(0, 800)}`);
    return r.data;
  };
  return { server, client, call, must, log };
}
export const c = v => Math.round(Number(v) * 100);
export const tl = v => (v / 100).toFixed(2);
