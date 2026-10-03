// Gerçek sürüm kodu (2.0.21 güvenilirlik, kullanıcı: "uydurma verilerle değil"): eski sürümün verisi, o sürümün GİT
// ETİKETİNDEKİ kodu çalıştırılarak üretilir. Etiketin server/, client/ ve package.json'u `git archive` ile geçici bir
// klasöre çıkarılır (bir kez; sonra önbellekten) ve o kodun kendi createApp'i aynı süreçte açılır. Her sürüm kendi modül
// ağacını yükler (ayrı dosya yolları); veri ve yedek klasörleri sürümler arasında aynen devredilir (gerçek güncelleme gibi).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CURRENT = "guncel";
const CACHE = path.join(tmpdir(), "destekofis-surum-kodu");
const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };

const git = (...args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Etiketin işlem kimliği; etiket yoksa (sığ klon, CI) null. */
export function tagCommit(tag) {
  try {
    return git("rev-parse", "--verify", "--quiet", `${tag}^{commit}`) || null;
  } catch {
    return null;
  }
}
export const tagsAvailable = tags => tags.every(tag => tagCommit(tag));

/** Etiketin kodunu önbelleğe çıkarır ve klasörünü döndürür. */
export function checkoutTag(tag) {
  const commit = tagCommit(tag);
  if (!commit) throw new Error(`${tag} etiketi bu depoda yok (git fetch --tags gerekir).`);
  const dir = path.join(CACHE, `${tag}-${commit.slice(0, 12)}`);
  if (existsSync(path.join(dir, "server", "app.mjs"))) return { dir, commit };
  mkdirSync(CACHE, { recursive: true });
  const temp = `${dir}.yaziliyor-${process.pid}`;
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(temp, { recursive: true });
  const archive = path.join(temp, "kod.tar");
  git("archive", "--format=tar", "-o", archive, commit, "server", "client", "package.json");
  execFileSync("tar", ["-xf", archive, "-C", temp]);
  rmSync(archive, { force: true });
  rmSync(dir, { recursive: true, force: true });
  renameSync(temp, dir);
  return { dir, commit };
}

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
export const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : {} })),
});

/**
 * Sürümü (etiket ya da CURRENT) verilen klasörlerle açar: { version, commit, app, base, login(), close() }.
 * Ortam ve seçenekler o sürümün test/helpers.mjs'iyle aynıdır (HUKUK_ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC=0, lisans
 * kilidi kapalı, zamanlanmış yedek kapalı).
 */
export async function bootVersion(version, { dataDir, backupDir, env = {}, ...overrides } = {}) {
  let createApp;
  let commit = null;
  if (version === CURRENT) ({ createApp } = await import(pathToFileURL(path.join(REPO, "server", "app.mjs")).href));
  else {
    const code = checkoutTag(version);
    commit = code.commit;
    ({ createApp } = await import(pathToFileURL(path.join(code.dir, "server", "app.mjs")).href));
  }
  const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", ...env }, license: LICENSE, startLicenseTimers: false, ...overrides });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const login = async (username = "admin", password = ADMIN_PASSWORD) => {
    const client = createClient(base);
    const result = await client.login(username, password);
    if (result.status !== 200) throw new Error(`${version}: ${username} girişi başarısız (${result.status} ${JSON.stringify(result.data).slice(0, 200)})`);
    return apiOf(client);
  };
  return { version, commit, app, base, login, close: () => app.close() };
}
