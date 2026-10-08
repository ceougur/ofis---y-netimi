// Ortak: sunucu (gerçek veri ve yedek klasörleriyle), çerezli istemci, tarayıcı yardımcıları.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PASS = "Denetim-Admin-2026!";
export const STAFF_PASS = "Personel-Denetim-2026!";

export function startServer(root, { fresh = true, maxCompanies = 0 } = {}) {
  if (fresh) fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const app = createApp({
    dataDir: path.join(root, "data"),
    backupDir: path.join(root, "backups"),
    logLevel: "error",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6" },
    startLicenseTimers: false,
    // Program en fazla 2 şirkete izin verir (2.0.25); veri bozan denemelerin 003 deneme şirketi için sınır yükseltilir.
    ...(maxCompanies ? { maxCompanies } : {}),
  });
  return app;
}

// Personel istemcisi: her istek seçilen şirkete gider (programın kendi arayüzünün yaptığı gibi ?hofCompany=).
export function staff(base, company = "", shared = null) {
  const client = shared || createClient(base);
  const scoped = url => (company && url.startsWith("/api/") && !url.startsWith("/api/companies") && !url.startsWith("/api/auth") ? `${url}${url.includes("?") ? "&" : "?"}hofCompany=${company}` : url);
  const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
  return {
    client,
    company,
    login: (u, p) => client.login(u, p),
    get: async url => unwrap(await client.get(scoped(url))),
    post: async (url, body) => unwrap(await client.post(scoped(url), body)),
    put: async (url, body) => unwrap(await client.put(scoped(url), body)),
    patch: async (url, body) => unwrap(await client.patch(scoped(url), body)),
    del: async url => unwrap(await client.del(scoped(url))),
    raw: (method, url, opts) => client.raw(method, scoped(url), opts),
    withCompany: id => staff(base, id, client),
  };
}
