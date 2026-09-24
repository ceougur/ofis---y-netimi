import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.resolve(process.env.HUKUK_DATA_DIR || path.join(ROOT, "data"));
const BACKUP_DIR = path.resolve(process.env.HUKUK_BACKUP_DIR || path.join(ROOT, "backups"));
const PUBLIC_DIR = path.join(ROOT, "client");
const PORT = Number(process.env.PORT || 5123);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_DAYS = 7;
const ADMIN_USERNAME = process.env.HUKUK_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.HUKUK_ADMIN_PASSWORD || "Ofis2026!";

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(BACKUP_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, "hukuk-ofisi.sqlite");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','avukat','personel','muhasebe')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  case_key TEXT NOT NULL,
  values_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_name, case_key)
);
CREATE TABLE IF NOT EXISTS overrides (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  case_key TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_name, case_key, field)
);
CREATE TABLE IF NOT EXISTS deleted_records (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  case_key TEXT NOT NULL,
  deleted_by TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  UNIQUE(source_name, case_key)
);
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS phones (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, phone TEXT NOT NULL, label TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS liens (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, title TEXT NOT NULL, placed_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, case_key TEXT NOT NULL, assignee TEXT NOT NULL, due_date TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, completed_by TEXT);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, message TEXT NOT NULL, case_key TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_records_source ON records(source_name);
`);

const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${randomUUID()}`;
const text = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const json = value => { try { return JSON.parse(value); } catch { return {}; } };
const hashToken = token => createHash("sha256").update(token).digest("hex");
const passwordHash = password => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const verifyPassword = (password, stored) => {
  const [salt, digest] = String(stored).split(":");
  if (!salt || !digest) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
};
const getOne = (sql, ...args) => db.prepare(sql).get(...args);
const getAll = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);

if (!getOne("SELECT id FROM users WHERE username = ?", ADMIN_USERNAME)) {
  const timestamp = now();
  run("INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?, ?)", id("user"), ADMIN_USERNAME, "Ofis yöneticisi", passwordHash(ADMIN_PASSWORD), timestamp, timestamp);
  console.log(`İlk yönetici hesabı oluşturuldu: ${ADMIN_USERNAME}`);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => part.trim().split("=")).filter(parts => parts.length === 2).map(([key, value]) => [key, decodeURIComponent(value)]));
}
function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(body);
}
function ok(res, data) { send(res, 200, { ok: true, data }); }
function fail(res, status, message) { send(res, status, { ok: false, error: message }); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 5_000_000) reject(new Error("İstek gövdesi çok büyük.")); });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Geçersiz JSON.")); } });
    req.on("error", reject);
  });
}
function userFromRequest(req) {
  const token = parseCookies(req.headers.cookie || "").hof_session;
  if (!token) return null;
  const session = getOne("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", hashToken(token));
  if (!session || new Date(session.expires_at) <= new Date()) return null;
  const user = getOne("SELECT id, username, display_name, role, active FROM users WHERE id = ? AND active = 1", session.user_id);
  return user || null;
}
function requireUser(req, res) {
  const user = userFromRequest(req);
  if (!user) { fail(res, 401, "Oturum gerekli."); return null; }
  return user;
}
function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") { fail(res, 403, "Bu işlem yalnızca yöneticiye açıktır."); return null; }
  return user;
}
function audit(user, type, entityId, payload = {}) {
  run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id("event"), type, entityId, user.id, user.display_name, JSON.stringify(payload), now());
}
function setSession(res, userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", hashToken(token), userId, expires, now());
  res.setHeader("set-cookie", `hof_session=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax`);
}
function clearSession(req, res) {
  const token = parseCookies(req.headers.cookie || "").hof_session;
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
  res.setHeader("set-cookie", "hof_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
}
function pathSegments(url) { return new URL(url, `http://${HOST}:${PORT}`).pathname.split("/").filter(Boolean).map(decodeURIComponent); }
function spreadsheetId(sheetUrl) {
  const match = String(sheetUrl || "").trim().match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([^/?#]+)/i);
  if (!match) throw new Error("Geçerli bir Google Sheets bağlantısı girilmedi.");
  return match[1];
}
function googleCsvUrl(sheetUrl, gid = "0") {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId(sheetUrl)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
}
function parseCsv(csv) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]; const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell.trim()); if (row.some(value => value.length > 0)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell.trim()); if (row.some(value => value.length > 0)) rows.push(row); }
  return rows;
}
function csvToRecords(csv, tabTitle = "") {
  const matrix = parseCsv(csv); const headers = matrix[0] || [];
  return matrix.slice(1).map(values => headers.reduce((record, header, index) => { if (header.trim()) record[header.trim()] = values[index]?.trim() || ""; if (tabTitle) record.__sheet = tabTitle; return record; }, {})).filter(record => Object.entries(record).some(([key, value]) => key !== "__sheet" && Boolean(value)));
}
async function readGoogleSheet(sheetUrl) {
  const sourceUrl = String(sheetUrl || "").trim();
  const id = spreadsheetId(sourceUrl);
  const documentResponse = await fetch(`https://docs.google.com/spreadsheets/d/${id}/edit`, { headers: { Accept: "text/html" } });
  if (!documentResponse.ok) return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs: [], message: `Google Sheets erişimi başarısız (${documentResponse.status}). Sheet paylaşım iznini kontrol edin.` };
  const html = await documentResponse.text(); const tabs = [];
  const patterns = [
    /\[(\d+),0,\\"(\d+)\\",\[\{\\"1\\":\[\[0,0,\\"([^"\\]+)\\"/g,
    /"gid"\s*:\s*"?(\d+)"?[^{}]{0,240}?"(?:name|title)"\s*:\s*"([^"\\]+)"/g,
    /"(?:name|title)"\s*:\s*"([^"\\]+)"[^{}]{0,240}?"gid"\s*:\s*"?(\d+)"?/g,
  ];
  for (const [index, pattern] of patterns.entries()) { let match; while ((match = pattern.exec(html))) { const gid = index === 0 ? match[2] : index === 1 ? match[1] : match[2]; const title = index === 0 ? match[3] : index === 1 ? match[2] : match[1]; if (gid && title && !tabs.some(tab => tab.gid === gid)) tabs.push({ gid, title }); } }
  const fallbackGid = new URL(sourceUrl).searchParams.get("gid") || "0"; const targets = tabs.length ? tabs : [{ gid: fallbackGid, title: "" }]; const rows = [];
  for (const tab of targets) { const response = await fetch(googleCsvUrl(sourceUrl, tab.gid), { headers: { Accept: "text/csv" } }); if (!response.ok) return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs, message: `"${tab.title || "Sheet"}" sekmesi okunamadı (${response.status}). Sheet'i görüntüleme izni olan kişilerle paylaşın.` }; rows.push(...csvToRecords(await response.text(), tab.title)); }
  return { connected: true, sourceUrl, syncedAt: now(), rows, tabs: targets, message: `${targets.length} sekmeden ${rows.length} kayıt okundu.` };
}
function sourceName(body, fallback = "Çalışma tablosu") { return text(body.sourceName, fallback); }
function caseKey(body) { return text(body.caseKey || body.case_key); }
function parseValues(record) { return typeof record === "object" && record ? record : {}; }
function withOverrides(source, key, values) {
  const merged = { ...values };
  for (const item of getAll("SELECT field, value FROM overrides WHERE source_name = ? AND case_key = ?", source, key)) merged[item.field] = item.value;
  return merged;
}
function workspaceState(user) {
  return {
    activeUser: { id: user.id, name: user.display_name, role: user.role, active: true },
    users: getAll("SELECT id, username, display_name AS name, role, active FROM users ORDER BY display_name"),
    cases: getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, values_json AS valuesJson, version, created_at AS createdAt, updated_at AS updatedAt FROM records ORDER BY updated_at DESC").map(row => ({ ...row, values: json(row.valuesJson), valuesJson: undefined })),
    records: getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, values_json AS valuesJson, version, created_at AS createdAt, updated_at AS updatedAt FROM records ORDER BY created_at DESC").map(row => ({ ...row, values: json(row.valuesJson), valuesJson: undefined })),
    overrides: getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, field, value, version, updated_by AS updatedBy, updated_at AS updatedAt FROM overrides ORDER BY updated_at DESC"),
    deletedRecords: getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, deleted_by AS deletedBy, deleted_at AS deletedAt FROM deleted_records ORDER BY deleted_at DESC"),
    messages: getAll("SELECT id, recipient, message, case_key AS caseKey, created_by AS actorId, created_at AS createdAt FROM messages ORDER BY created_at DESC LIMIT 100").map(row => ({ ...row, to: row.recipient, recipient: undefined })),
    tasks: getAll("SELECT id, title, case_key AS caseKey, assignee, due_date AS dueDate, priority, status, created_by AS actorId, created_at AS createdAt, completed_at AS completedAt, completed_by AS completedBy FROM tasks ORDER BY created_at DESC"),
    notes: getAll("SELECT id, case_key AS caseKey, note, created_by AS actorId, created_at AS createdAt FROM notes ORDER BY created_at DESC"),
    phones: getAll("SELECT id, case_key AS caseKey, phone, label, created_by AS actorId, created_at AS createdAt FROM phones ORDER BY created_at DESC"),
    payments: getAll("SELECT id, case_key AS caseKey, amount, date, note, created_by AS actorId, created_at AS createdAt FROM payments ORDER BY created_at DESC"),
    liens: getAll("SELECT id, case_key AS caseKey, title, placed_at AS placedAt, expires_at AS expiresAt, status, created_by AS actorId, created_at AS createdAt FROM liens ORDER BY created_at DESC"),
    events: getAll("SELECT id, type, entity_id AS entityId, actor_id AS actorId, actor_name AS actorName, payload_json AS payloadJson, created_at AS createdAt FROM audit_events ORDER BY created_at DESC LIMIT 500").map(row => ({ ...row, payload: json(row.payloadJson), payloadJson: undefined }))
  };
}
function backup() {
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    const target = path.join(BACKUP_DIR, `hukuk-ofisi-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
    copyFileSync(dbPath, target);
    const files = readdirSync(BACKUP_DIR).filter(name => name.endsWith(".sqlite")).sort().reverse();
    files.slice(30).forEach(name => unlinkSync(path.join(BACKUP_DIR, name)));
    console.log(`Yedek oluşturuldu: ${target}`);
  } catch (error) { console.error("Yedekleme hatası:", error.message); }
}
setInterval(backup, 6 * 60 * 60 * 1000).unref();

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const segments = pathSegments(req.url || "/");
  if (req.method === "GET" && url.pathname === "/api/health") return ok(res, { service: "hukuk-ofisi-merkezi", status: "ok", time: now() });
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const body = await readBody(req); const username = text(body.username); const password = String(body.password || "");
      const user = getOne("SELECT id, username, display_name, role, active, password_hash FROM users WHERE username = ?", username);
      if (!user || !user.active || !verifyPassword(password, user.password_hash)) return fail(res, 401, "Kullanıcı adı veya parola hatalı.");
      setSession(res, user.id); audit(user, "auth.login", user.id, {}); return ok(res, { id: user.id, username: user.username, name: user.display_name, role: user.role });
    } catch (error) { return fail(res, 400, error.message); }
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") { clearSession(req, res); return ok(res, true); }
  if (req.method === "GET" && url.pathname === "/api/auth/me") { const user = userFromRequest(req); return user ? ok(res, { id: user.id, username: user.username, name: user.display_name, role: user.role }) : fail(res, 401, "Oturum gerekli."); }
  if (req.method === "GET" && url.pathname === "/api/trpc/sheets.getRows") {
    try {
      const raw = url.searchParams.get("input"); const input = raw ? json(decodeURIComponent(raw)) : {};
      const batchInput = input?.json || input?.["0"]?.json || input?.[0]?.json || input?.["0"] || input?.[0] || {};
      const sheetUrl = text(batchInput.sheetUrl || input?.sheetUrl);
      const result = await readGoogleSheet(sheetUrl);
      const payload = { result: { data: { json: result } } };
      return send(res, 200, url.searchParams.get("batch") === "1" ? [payload] : payload);
    } catch (error) {
      const payload = { result: { data: { json: { connected: false, sourceUrl: "", syncedAt: null, rows: [], tabs: [], message: error.message || "Google Sheets okunamadı. Bağlantı ve paylaşım iznini kontrol edin." } } } };
      return send(res, 200, url.searchParams.get("batch") === "1" ? [payload] : payload);
    }
  }
  if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
    const user = requireUser(req, res); if (!user) return;
    try { const body = await readBody(req); const current = getOne("SELECT password_hash FROM users WHERE id = ?", user.id); if (!verifyPassword(String(body.currentPassword || ""), current.password_hash)) return fail(res, 400, "Mevcut parola hatalı."); if (String(body.newPassword || "").length < 10) return fail(res, 400, "Yeni parola en az 10 karakter olmalı."); run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", passwordHash(String(body.newPassword)), now(), user.id); audit(user, "profile.password_changed", user.id); return ok(res, true); } catch (error) { return fail(res, 400, error.message); }
  }
  if (segments[0] === "api" && segments[1] === "admin") {
    const admin = requireAdmin(req, res); if (!admin) return;
    if (req.method === "GET" && url.pathname === "/api/admin/users") return ok(res, getAll("SELECT id, username, display_name AS name, role, active, created_at AS createdAt FROM users ORDER BY display_name"));
    if (req.method === "POST" && url.pathname === "/api/admin/users") { try { const body = await readBody(req); const username = text(body.username), name = text(body.name), role = text(body.role, "personel"); if (!username || !name || !String(body.password || "") || !["admin","avukat","personel","muhasebe"].includes(role)) return fail(res, 400, "Kullanıcı alanları eksik veya geçersiz."); const timestamp = now(); const userId = id("user"); run("INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", userId, username, name, role, passwordHash(String(body.password)), timestamp, timestamp); audit(admin, "user.created", userId, { username, role }); return ok(res, { id: userId, username, name, role }); } catch (error) { return fail(res, 400, error.message.includes("UNIQUE") ? "Bu kullanıcı adı zaten kayıtlı." : error.message); } }
    if (req.method === "PATCH" && segments[2]) { try { const body = await readBody(req); const role = text(body.role); const active = body.active === false ? 0 : 1; if (role && !["admin","avukat","personel","muhasebe"].includes(role)) return fail(res, 400, "Geçersiz rol."); const target = getOne("SELECT id FROM users WHERE id = ?", segments[2]); if (!target) return fail(res, 404, "Kullanıcı bulunamadı."); if (role) run("UPDATE users SET role = ?, active = ?, updated_at = ? WHERE id = ?", role, active, now(), segments[2]); else run("UPDATE users SET active = ?, updated_at = ? WHERE id = ?", active, now(), segments[2]); audit(admin, "user.updated", segments[2], { role, active }); return ok(res, true); } catch (error) { return fail(res, 400, error.message); } }
  }
  if (segments[0] !== "api" || segments[1] !== "workspace") {
    if (req.method !== "GET") return fail(res, 404, "Endpoint bulunamadı.");
    const filePath = url.pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, url.pathname.replace(/^\//, ""));
    const safePath = path.resolve(filePath);
    if (!safePath.startsWith(path.resolve(PUBLIC_DIR)) || !existsSync(safePath)) return send(res, 404, { error: "Sayfa bulunamadı." });
    const ext = path.extname(safePath); const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" }[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType, "cache-control": [".html", ".js", ".css"].includes(ext) ? "no-store, no-cache, must-revalidate" : "public, max-age=3600" }); return res.end(readFileSync(safePath));
  }
  const user = requireUser(req, res); if (!user) return;
  try {
    if (req.method === "GET" && url.pathname === "/api/workspace/state") return ok(res, workspaceState(user));
    if (req.method === "POST" && url.pathname === "/api/workspace/profile") { const body = await readBody(req); const name = text(body.name); if (!name) return fail(res, 400, "Personel adı gerekli."); run("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", name, now(), user.id); audit(user, "profile.updated", user.id, { name }); return ok(res, { id: user.id, name, role: user.role }); }
    if (req.method === "GET" && url.pathname === "/api/workspace/records") { const source = text(url.searchParams.get("sourceName")); const rows = getAll("SELECT id, source_name AS sourceName, case_key AS caseKey, values_json AS valuesJson, version, created_at AS createdAt, updated_at AS updatedAt FROM records WHERE (? = '' OR source_name = ?) ORDER BY created_at DESC", source, source).map(row => ({ ...row, values: withOverrides(row.sourceName, row.caseKey, json(row.valuesJson)), valuesJson: undefined })); return ok(res, rows); }
    if (req.method === "POST" && url.pathname === "/api/workspace/records") { const body = await readBody(req); const source = sourceName(body); const values = parseValues(body.values); const key = caseKey(body) || text(values.ESAS || values["DOSYA NO"] || values["Dosya No"], id("case")); if (!Object.values(values).some(value => text(String(value)))) return fail(res, 400, "En az bir bilgi girilmelidir."); const recordId = id("record"), timestamp = now(); run("INSERT INTO records (id, source_name, case_key, values_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", recordId, source, key, JSON.stringify(values), user.id, timestamp, timestamp); audit(user, "source.row.created", recordId, { sourceName: source, caseKey: key }); return ok(res, { id: recordId, sourceName: source, caseKey: key, values, createdAt: timestamp }); }
    if (req.method === "GET" && url.pathname === "/api/workspace/deleted") { const source = text(url.searchParams.get("sourceName")); return ok(res, getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, deleted_by AS deletedBy, deleted_at AS deletedAt FROM deleted_records WHERE (? = '' OR source_name = ?) ORDER BY deleted_at DESC", source, source)); }
    if (req.method === "POST" && url.pathname === "/api/workspace/deleted") { const body = await readBody(req); const source = sourceName(body), key = caseKey(body); if (!key) return fail(res, 400, "Silinecek kayıt kimliği gerekli."); const item = getOne("SELECT id FROM deleted_records WHERE source_name = ? AND case_key = ?", source, key); const recordId = item?.id || id("deleted"); run("INSERT INTO deleted_records (id, source_name, case_key, deleted_by, deleted_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_name, case_key) DO UPDATE SET deleted_by = excluded.deleted_by, deleted_at = excluded.deleted_at", recordId, source, key, user.id, now()); audit(user, "source.row.deleted", recordId, { sourceName: source, caseKey: key }); return ok(res, { id: recordId, sourceName: source, caseKey: key }); }
    if (req.method === "GET" && url.pathname === "/api/workspace/overrides") { const source = text(url.searchParams.get("sourceName")), key = text(url.searchParams.get("caseKey")); return ok(res, getAll("SELECT id, case_key AS caseKey, source_name AS sourceName, field, value, version, updated_by AS updatedBy, updated_at AS updatedAt FROM overrides WHERE (? = '' OR source_name = ?) AND (? = '' OR case_key = ?) ORDER BY updated_at DESC", source, source, key, key)); }
    if (req.method === "POST" && url.pathname === "/api/workspace/overrides") { const body = await readBody(req); const source = sourceName(body), key = caseKey(body), field = text(body.field); if (!key || !field) return fail(res, 400, "Dosya ve alan bilgisi gerekli."); const old = getOne("SELECT id, value, version FROM overrides WHERE source_name = ? AND case_key = ? AND field = ?", source, key, field); const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion); if (old && expectedVersion !== null && old.version !== expectedVersion) return fail(res, 409, "Bu alan başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin."); const itemId = old?.id || id("override"); const version = (old?.version || 0) + 1; run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_name, case_key, field) DO UPDATE SET value = excluded.value, version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at", itemId, source, key, field, text(body.value), version, user.id, now()); audit(user, "source.cell.updated", itemId, { sourceName: source, caseKey: key, field, previousValue: old?.value || "", value: text(body.value), version }); return ok(res, { id: itemId, version }); }
    if (req.method === "POST" && segments[2] === "cases" && segments[4] === "notes") { const body = await readBody(req), key = segments[3], note = text(body.note); if (!note) return fail(res, 400, "Not metni gerekli."); const itemId = id("note"); run("INSERT INTO notes (id, case_key, note, created_by, created_at) VALUES (?, ?, ?, ?, ?)", itemId, key, note, user.id, now()); audit(user, "case.note.created", itemId, { caseKey: key }); return ok(res, { id: itemId }); }
    if (req.method === "POST" && segments[2] === "cases" && segments[4] === "phones") { const body = await readBody(req), key = segments[3], phone = text(body.phone).replace(/[^\d+]/g, ""); if (phone.length < 7) return fail(res, 400, "Geçerli bir telefon numarası gerekli."); const itemId = id("phone"); run("INSERT INTO phones (id, case_key, phone, label, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", itemId, key, phone, text(body.label, "Telefon"), user.id, now()); audit(user, "case.phone.created", itemId, { caseKey: key }); return ok(res, { id: itemId }); }
    if (req.method === "POST" && segments[2] === "cases" && segments[4] === "payments") { const body = await readBody(req), key = segments[3], amount = Number(body.amount); if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, "Geçerli bir tahsilat tutarı gerekli."); const itemId = id("payment"); run("INSERT INTO payments (id, case_key, amount, date, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", itemId, key, amount, text(body.date, new Date().toISOString().slice(0, 10)), text(body.note), user.id, now()); audit(user, "case.payment.created", itemId, { caseKey: key, amount }); return ok(res, { id: itemId }); }
    if (req.method === "POST" && segments[2] === "cases" && segments[4] === "liens") { const body = await readBody(req), key = segments[3], placed = new Date(text(body.placedAt)); if (Number.isNaN(placed.getTime())) return fail(res, 400, "Geçerli bir haciz tarihi gerekli."); const expires = new Date(placed); expires.setFullYear(expires.getFullYear() + 1); const itemId = id("lien"); run("INSERT INTO liens (id, case_key, title, placed_at, expires_at, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)", itemId, key, text(body.title, "Haciz"), placed.toISOString(), expires.toISOString(), user.id, now()); audit(user, "case.lien.created", itemId, { caseKey: key, expiresAt: expires.toISOString() }); return ok(res, { id: itemId }); }
    if (req.method === "GET" && url.pathname === "/api/workspace/liens") { const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 7))); const threshold = Date.now() + days * 86400000; const items = getAll("SELECT id, case_key AS caseKey, title, placed_at AS placedAt, expires_at AS expiresAt, status, created_by AS actorId FROM liens WHERE status = 'active' ORDER BY expires_at").filter(item => new Date(item.expiresAt).getTime() <= threshold && new Date(item.expiresAt).getTime() >= Date.now()); return ok(res, { days, upcoming: items, total: items.length }); }
    if (req.method === "POST" && url.pathname === "/api/workspace/tasks") { const body = await readBody(req), title = text(body.title); if (!title) return fail(res, 400, "Görev başlığı gerekli."); const itemId = id("task"); run("INSERT INTO tasks (id, title, case_key, assignee, due_date, priority, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)", itemId, title, caseKey(body), text(body.assignee, user.display_name), text(body.dueDate), text(body.priority, "normal"), user.id, now()); audit(user, "task.created", itemId, { title, caseKey: caseKey(body) }); return ok(res, { id: itemId }); }
    if (req.method === "POST" && segments[2] === "tasks" && segments[4] === "complete") { const item = getOne("SELECT id FROM tasks WHERE id = ?", segments[3]); if (!item) return fail(res, 404, "Görev bulunamadı."); run("UPDATE tasks SET status = 'completed', completed_at = ?, completed_by = ? WHERE id = ?", now(), user.display_name, segments[3]); audit(user, "task.completed", segments[3]); return ok(res, true); }
    if (req.method === "POST" && url.pathname === "/api/workspace/messages") { const body = await readBody(req), recipient = text(body.to), message = text(body.message); if (!recipient || !message) return fail(res, 400, "Alıcı ve mesaj gerekli."); const itemId = id("message"); run("INSERT INTO messages (id, recipient, message, case_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", itemId, recipient, message, caseKey(body), user.id, now()); audit(user, "message.created", itemId, { recipient }); return ok(res, { id: itemId }); }
    if (req.method === "GET" && url.pathname === "/api/workspace/reports") { const users = getAll("SELECT id, display_name AS name, role FROM users WHERE active = 1 ORDER BY display_name"); const report = users.map(item => ({ userId: item.id, userName: item.name, role: item.role, tasksCreated: getOne("SELECT COUNT(*) AS count FROM tasks WHERE created_by = ?", item.id).count, tasksCompleted: getOne("SELECT COUNT(*) AS count FROM tasks WHERE completed_by = ?", item.name).count, notes: getOne("SELECT COUNT(*) AS count FROM notes WHERE created_by = ?", item.id).count, calls: getOne("SELECT COUNT(*) AS count FROM phones WHERE created_by = ?", item.id).count, collections: getOne("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE created_by = ?", item.id).total, dataEntries: getOne("SELECT COUNT(*) AS count FROM audit_events WHERE actor_id = ?", item.id).count })); return ok(res, { generatedAt: now(), report, totals: { tasks: getOne("SELECT COUNT(*) AS count FROM tasks").count, completedTasks: getOne("SELECT COUNT(*) AS count FROM tasks WHERE status = 'completed'").count, notes: getOne("SELECT COUNT(*) AS count FROM notes").count, payments: getOne("SELECT COALESCE(SUM(amount),0) AS total FROM payments").total, events: getOne("SELECT COUNT(*) AS count FROM audit_events").count } }); }
    return fail(res, 404, "Workspace endpoint bulunamadı.");
  } catch (error) { console.error("API hatası:", error); return fail(res, 500, "Sunucu işlemi tamamlayamadı."); }
}

const server = createServer((req, res) => { handle(req, res).catch(error => { console.error(error); fail(res, 500, error.message); }); });
server.listen(PORT, HOST, () => console.log(`Hukuk Ofisi merkezi sunucusu http://${HOST}:${PORT}`));
process.on("SIGINT", () => { db.close(); process.exit(0); });
process.on("SIGTERM", () => { db.close(); process.exit(0); });
