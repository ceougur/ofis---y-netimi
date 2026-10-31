// 2.4.8 SON ADAY T6/T8 ortak düzenek. UYARI (ders 5): sahte Graph (test/whatsapp-sahte-graph.mjs) programı yazan elden çıkmıştır, kâhin DEĞİLDİR; beklenen sayılar
// planın kurallarından (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2, §7a, R1) ve testin girdiği veriden yazılır. Sayılar sahte Meta'nın İSTEK kaydından (ders 3),
// iş durumları programın kendi veri dosyasından (süreç ölüyken salt okunur) okunur. Bütün geçici veri T6_KOK altında (ders 25; benzersiz klasör).
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";
import { startFakeGraph } from "../whatsapp-sahte-graph.mjs";
import { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, WABA } from "../whatsapp-248-ortak.mjs";

export { OFFICE, PNID, TOKEN, WABA };
export const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "cocuk.mjs");
export const KOK = process.env.T6_KOK;
if (!KOK) throw new Error("T6_KOK (benzersiz not defteri klasörü) verilmeli — ders 25");
mkdirSync(KOK, { recursive: true });
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(fn, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await wait(25);
  }
  throw new Error(`${what}: ${ms} ms içinde olmadı`);
}
export const freshDir = prefix => mkdtempSync(path.join(KOK, `${prefix}-`));

/** Küçük tmpfs (gerçek "disk dolu"): kök kullanıcı gerekir. */
export function mountTmpfs(dir, size) {
  mkdirSync(dir, { recursive: true });
  execFileSync("mount", ["-t", "tmpfs", "-o", `size=${size}`, "tmpfs", dir]);
  return () => {
    try {
      execFileSync("umount", [dir]);
    } catch {
      execFileSync("umount", ["-l", dir]);
    }
  };
}
export function freeBytes(dir) {
  const out = execFileSync("df", ["-B1", "--output=avail", dir]).toString().trim().split("\n").pop();
  return Number(out);
}

export async function fakeMeta(patch = {}) {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  fake.state.templates.push(...PROGRAM_TEMPLATES());
  Object.assign(fake.state, patch);
  return fake;
}
export const messageReqs = fake => fake.requests.filter(item => item.method === "POST" && /\/messages$/.test(item.path));
export const mediaReqs = fake => fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path));
/** Alıcı başına Meta'nın KABUL ettiği ileti sayısı (state.messages: işlenen ileti istekleri). */
export function perRecipient(fake) {
  const out = {};
  for (const m of fake.state.messages) out[m.to] = (out[m.to] || 0) + 1;
  return out;
}

/** GERÇEK program ayrı süreçte. kur: ilk açılışta firma adı + Elle Bağla + onay. */
export async function startChild({ dataDir, backupDir, fake, timeoutMs = 3000, gapMs = 200, kur = false, now }) {
  const arg = { dataDir, backupDir, graphUrl: fake.url, timeoutMs, gapMs, now, ...(kur ? { kur: { office: OFFICE, pnid: PNID, waba: WABA, token: TOKEN } } : {}) };
  const tmp = path.join(KOK, "tmp");
  mkdirSync(tmp, { recursive: true });
  const child = spawn(process.execPath, ["--no-warnings", CHILD, JSON.stringify(arg)], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL, TMPDIR: tmp }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", chunk => (out += chunk));
  child.stderr.on("data", chunk => (out += chunk));
  const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
  let ready;
  try {
    ready = await until(() => out.split("\n").map(line => { try { return JSON.parse(line); } catch { return null; } }).find(item => item?.ready), 45_000, `çocuk hazır (${out.slice(-600)})`);
  } catch (error) {
    child.kill("SIGKILL");
    await exited;
    throw error;
  }
  assert.equal(ready.pid, child.pid);
  const api = createClient(ready.base);
  const login = await api.login("admin", ADMIN_PASSWORD);
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return {
    child,
    base: ready.base,
    api,
    exited,
    log: () => out,
    async kill() {
      child.kill("SIGKILL"); // yalnız kendi başlattığımız süreç (ders 36)
      return exited;
    },
    async stop() {
      child.kill("SIGTERM");
      const end = await Promise.race([exited, wait(15_000).then(() => null)]);
      if (!end) {
        child.kill("SIGKILL");
        return exited;
      }
      return end;
    },
  };
}

export async function account(api, name, phone, opening = 25) {
  const res = await api.post("/api/workspace/accounts", { name, phone, openingBalance: String(opening) });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.data;
}
export const phoneOf = i => `0553 ${String(100 + Math.floor(i / 10000)).slice(-3)} ${String(Math.floor(i / 100) % 100).padStart(2, "0")} ${String(i % 100).padStart(2, "0")}`;
export const e164Of = i => `+90553${String(100 + Math.floor(i / 10000)).slice(-3)}${String(Math.floor(i / 100) % 100).padStart(2, "0")}${String(i % 100).padStart(2, "0")}`;

/** Şirket 001'in veri dosyası (salt okunur; süreç ölüyken ya da açıkken WAL ile okunur). */
export function companyDb(dataDir) {
  const direct = path.join(dataDir, "destekofis.sqlite");
  if (existsSync(direct)) return direct;
  const base = path.join(dataDir, "sirketler");
  for (const dir of existsSync(base) ? readdirSync(base) : []) {
    const file = path.join(base, dir, "destekofis.sqlite");
    if (existsSync(file)) return file;
  }
  throw new Error(`şirket dosyası yok: ${dataDir}`);
}
export function query(file, sql, ...args) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
}
export const ledgerDb = dataDir => path.join(dataDir, "whatsapp-gonderim.sqlite");
export function jobStates(dataDir, batchId = null) {
  const rows = query(companyDb(dataDir), `SELECT state, COUNT(*) AS n FROM wa_jobs ${batchId ? "WHERE batch_id = ?" : ""} GROUP BY state ORDER BY state`, ...(batchId ? [batchId] : []));
  return Object.fromEntries(rows.map(row => [row.state, row.n]));
}
export function rmrf(dir) {
  if (dir && dir.startsWith(KOK)) rmSync(dir, { recursive: true, force: true });
}
export function sizeOf(dir) {
  let total = 0;
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const p = path.join(dir, name);
    const st = statSync(p);
    total += st.isDirectory() ? sizeOf(p) : st.size;
  }
  return total;
}
