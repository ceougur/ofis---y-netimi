// 2.4.5 ikinci dar kontrol — ortak yardımcı (yalnız yeniden üretim; ürün kodu değişmez).
// ROOT: denenen kod kökü (yeni: /home/user/wt/dar2-245 = 8d73aad, eski: <nd>/245-dar2/eski-201ffef).
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ROOT = process.env.ROOT || "/home/user/wt/dar2-245";
const helpers = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
export { helpers };
export const NOW = process.env.NOWISO || "2026-10-20T12:00:00+03:00";
export const TODAY = NOW.slice(0, 10);
export const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
export const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
export const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
};
export async function start(extra = {}) {
  const server = await helpers.startTestServer({ now: { time: NOW, fixed: false }, legacyCasePayments: false, legacyTableTransfer: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...extra });
  const api = apiOf(await helpers.loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  return { server, api };
}
