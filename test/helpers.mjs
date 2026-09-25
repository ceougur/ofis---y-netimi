// Test yardımcıları: geçici klasörlerle sunucu başlatma ve çerezli HTTP istemcisi.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";

export const ADMIN_PASSWORD = "Test-Admin-2026!";

export async function startTestServer(options = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-test-"));
  const dataDir = options.dataDir || path.join(root, "data");
  const backupDir = path.join(root, "backups");
  if (options.prepare) options.prepare({ dataDir, backupDir });
  const app = createApp({
    dataDir,
    backupDir,
    logLevel: "silent",
    scheduleBackups: false,
    // Zamanlanmış Sheet eşitlemesi testlerde kapalıdır (gerekirse ortam değişkeniyle açılır).
    env: { HUKUK_ADMIN_PASSWORD: options.adminPassword ?? ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", ...(options.env || {}) },
    fetchImpl: options.fetchImpl,
    // Lisans kilidi yalnızca lisans testlerinde uygulanır (test/license.test.mjs); diğer testler lisanslı gibi çalışır.
    license: options.license ?? { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: options.startLicenseTimers ?? false,
  });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  return {
    app,
    base,
    root,
    dataDir,
    backupDir,
    client: () => createClient(base),
    async close() {
      await app.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function createClient(base) {
  let cookie = "";
  const request = async (method, url, body, extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (cookie) headers.cookie = cookie;
    let payload;
    if (body !== undefined) {
      headers["content-type"] = headers["content-type"] || "application/json";
      payload = typeof body === "string" ? body : JSON.stringify(body);
    }
    const response = await fetch(base + url, { method, headers, body: payload, redirect: "manual" });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0].endsWith("=") ? "" : setCookie.split(";")[0];
    const type = response.headers.get("content-type") || "";
    const data = type.includes("json") ? await response.json() : await response.text();
    return { status: response.status, data, headers: response.headers };
  };
  return {
    get: (url, headers) => request("GET", url, undefined, headers),
    post: (url, body = {}, headers) => request("POST", url, body, headers),
    put: (url, body = {}, headers) => request("PUT", url, body, headers),
    patch: (url, body = {}, headers) => request("PATCH", url, body, headers),
    del: (url, headers) => request("DELETE", url, undefined, headers),
    login: (username, password) => request("POST", "/api/auth/login", { username, password }),
    get cookie() {
      return cookie;
    },
  };
}

export async function loginAdmin(server) {
  const client = server.client();
  const result = await client.login("admin", ADMIN_PASSWORD);
  if (result.status !== 200) throw new Error(`Admin girişi başarısız: ${JSON.stringify(result.data)}`);
  return client;
}

export async function createUser(server, admin, { username, role = "personel", password = "Personel-2026!", name } = {}) {
  const created = await admin.post("/api/admin/users", { username, name: name || username, role, password, mustChangePassword: false });
  if (created.status !== 200) throw new Error(`Kullanıcı oluşturulamadı: ${JSON.stringify(created.data)}`);
  const client = server.client();
  const login = await client.login(username, password);
  if (login.status !== 200) throw new Error("Kullanıcı girişi başarısız");
  return client;
}
