// Meta (WhatsApp Cloud API) izolasyonu — 2.4.8 W1 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §4 "Testler gerçek Meta'ya GİTMEZ"; ders 30 düzeni,
// test/lisans-servisi-izolasyonu.test.mjs). Bir testin gerçek Meta'ya istek atması müşterinin değil ama GERÇEK bir Meta uygulamasının belirteciyle
// ileti/ücret/kalite kaydı demektir; bu yüzden üç kat:
//   1. Yapılandırma: Meta adresi (config.whatsappGraphUrl) YALNIZ üretim girişinde (server/server.mjs whatsappGraph: true) gerçek adrestir; aynı süreçte açılan
//      testlerde varsayılan BOŞ (istek gitmez), ayrı süreçte açılan gerçek programda lisans servisi ölü adrese yönlendirildiği için yine BOŞ.
//   2. Kaynak taraması: test/, tools/ ve iş akışlarında Meta adresi yazılmaz; whatsappGraphUrl / HUKUK_WHATSAPP_GRAPH_URL yalnız yerel adres ya da değişken.
//   3. Ayrı süreç: gerçek server/server.mjs (HUKUK_LICENSE_URL=http://127.0.0.1:9) açılır; WhatsApp bağlantı görünümü "Meta adresi yok" der.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadConfig } from "../server/lib/config.mjs";
import { createClient, removeTestDir } from "./helpers.mjs";

// Meta istemcisi istek anında yüklenir: modül yoksa (eski kod) yalnız onu kullanan denetim düşer, öbürleri kendi nedeniyle koşar.
const metaGraph = () => import("../server/lib/whatsapp/meta-graph.mjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);
// Adres bu dosyada bile tek parça yazılmaz (kaynak taraması kendini bulmasın diye değil: tarama bu dosyayı zaten dışarıda bırakır; okuyan kişi
// gerçek adresin YALNIZ server/lib/whatsapp/meta-graph.mjs'te durduğunu görsün).
const META_HOST = ["graph", "facebook", "com"].join(".");
const DEAD = "http://127.0.0.1:9";
const rel = file => path.relative(ROOT, file).split(path.sep).join("/");
function walk(dir, out = [], match = /\.(mjs|js|cjs)$/) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "artifacts" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out, match);
    else if (match.test(name)) out.push(full);
  }
  return out;
}
const code = text => text.split(/\r?\n/).map(line => (/^\s*(\/\/|\*|#)/.test(line) ? "" : line)).join("\n");
const sources = [...walk(path.join(ROOT, "test")), ...walk(path.join(ROOT, "tools"))].filter(file => path.resolve(file) !== SELF);
const workflows = readdirSync(path.join(ROOT, ".github", "workflows")).filter(name => /\.ya?ml$/.test(name)).map(name => path.join(ROOT, ".github", "workflows", name));

test("yapılandırma: Meta adresi yalnız üretim girişinde gerçek; testte varsayılan boş; ayrı süreçte (HUKUK_LICENSE_URL ölü adres) boş", async () => {
  const DEFAULT_GRAPH_URL = `https://${META_HOST}`;
  const clean = { HUKUK_LICENSE_URL: undefined, HUKUK_WHATSAPP_GRAPH_URL: undefined };
  const dataDir = path.join(tmpdir(), "w1-izolasyon-yok");
  assert.equal(loadConfig({ dataDir, env: clean }).whatsappGraphUrl, "", "aynı süreçte açılan program (createApp, bayraksız): adres boş");
  assert.equal(loadConfig({ dataDir, env: clean, whatsappGraph: true }).whatsappGraphUrl, DEFAULT_GRAPH_URL, "üretim girişi: gerçek adres");
  assert.equal((await metaGraph()).DEFAULT_GRAPH_URL, DEFAULT_GRAPH_URL, "programın sabiti gerçek Meta adresi");
  assert.equal(loadConfig({ dataDir, env: { ...clean, HUKUK_LICENSE_URL: DEAD }, whatsappGraph: true }).whatsappGraphUrl, "", "ayrı süreçte açılan test programı: adres boş");
  assert.equal(loadConfig({ dataDir, env: clean, whatsappGraph: true, licenseServices: DEAD }).whatsappGraphUrl, "", "lisans servisi değiştirilmiş: adres boş");
  assert.equal(loadConfig({ dataDir, env: { ...clean, HUKUK_LICENSE_URL: DEAD, HUKUK_WHATSAPP_GRAPH_URL: "http://127.0.0.1:4555" }, whatsappGraph: true }).whatsappGraphUrl, "http://127.0.0.1:4555", "açıkça verilen yerel sahte adres");
  assert.equal(loadConfig({ dataDir, env: { ...clean, HUKUK_WHATSAPP_GRAPH_URL: `https://${META_HOST}` } }).whatsappGraphUrl, "", "bayraksız programda ortam değişkeni de adres açmaz");
  // Üretim girişi bayrağı verir; server/ altında başka hiçbir yer vermez.
  const entry = readFileSync(path.join(ROOT, "server", "server.mjs"), "utf8");
  assert.match(code(entry), /createApp\(\{[^}]*whatsappGraph:\s*true[^}]*\}\)/, "server/server.mjs whatsappGraph: true");
  const others = walk(path.join(ROOT, "server")).filter(file => !file.endsWith(`${path.sep}server.mjs`) && /whatsappGraph:\s*true/.test(code(readFileSync(file, "utf8"))));
  assert.deepEqual(others.map(rel), []);
  // Gerçek adres kaynakta TEK yerde (meta-graph.mjs sabiti).
  const literal = walk(path.join(ROOT, "server")).filter(file => code(readFileSync(file, "utf8")).includes(META_HOST));
  assert.deepEqual(literal.map(rel), ["server/lib/whatsapp/meta-graph.mjs"]);
});

test("Meta istemcisi yalnız https ya da yerel adrese istek atar; adres boşsa fetch çağrılmaz", async () => {
  const { createMetaGraph, graphBaseOk } = await metaGraph();
  for (const ok of [`https://${META_HOST}`, "http://127.0.0.1:4555", "http://localhost:80"]) assert.equal(graphBaseOk(ok), true, ok);
  for (const bad of [`http://${META_HOST}`, "http://10.0.0.5:80", "ftp://x", "https://a.com/yol", "", "javascript:alert(1)"]) assert.equal(graphBaseOk(bad), false, bad);
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    throw new TypeError("beklenmiyordu");
  };
  for (const baseUrl of ["", `http://${META_HOST}`]) {
    const graph = createMetaGraph({ baseUrl, fetchImpl, openToken: () => "BELIRTEC" });
    await assert.rejects(graph.phoneLimit("106540352242922"), error => error.reason === "graph-off");
  }
  assert.deepEqual(calls, [], "geçersiz/boş adreste dış istek yok");
});

test("kaynak taraması: test/, tools/ ve iş akışlarında Meta adresi yok; whatsappGraphUrl ve HUKUK_WHATSAPP_GRAPH_URL yalnız yerel", () => {
  assert.ok(sources.length > 300, `taranan dosya sayısı beklenenden az (${sources.length}) — okunamayan veri boş sayılmaz`);
  const named = [...sources, ...workflows].filter(file => code(readFileSync(file, "utf8")).includes(META_HOST));
  assert.deepEqual(named.map(rel), [], "Meta adresini yazan test/araç/iş akışı");
  const bad = [];
  for (const file of [...sources, ...workflows]) {
    const text = code(readFileSync(file, "utf8"));
    for (const match of text.matchAll(/whatsappGraphUrl\s*:\s*(["'`])([^"'`]*)\1/g)) if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(match[2]) && !/^\$\{/.test(match[2])) bad.push(`${rel(file)}: whatsappGraphUrl ${match[2]}`);
    for (const match of text.matchAll(/HUKUK_WHATSAPP_GRAPH_URL\s*[:=]\s*["'`]?([^\s"'`,}]*)/g)) if (match[1] && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(match[1]) && !/^\$\{/.test(match[1])) bad.push(`${rel(file)}: HUKUK_WHATSAPP_GRAPH_URL ${match[1]}`);
  }
  assert.deepEqual(bad, []);
});

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

test("ayrı süreçte açılan gerçek program (server/server.mjs, HUKUK_LICENSE_URL ölü adres): Meta adresi boş (graphAvailable false), Meta'ya istek gidemez", { timeout: 90_000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-w1-surec-"));
  const port = await freePort();
  const env = { ...process.env, HUKUK_LICENSE_URL: DEAD, PORT: String(port), HOST: "127.0.0.1", HUKUK_DISCOVERY_PORT: "0", HUKUK_LOG_LEVEL: "warn", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_DATA_DIR: path.join(root, "data"), HUKUK_BACKUP_DIR: path.join(root, "backups"), HUKUK_UPDATES: "0", HUKUK_DATASET_AUTOSYNC: "0" };
  delete env.HUKUK_WHATSAPP_GRAPH_URL;
  delete env.HUKUK_KAPI_URL;
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT, "server", "server.mjs")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => (output += chunk));
  child.stderr.on("data", chunk => (output += chunk));
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let attempt = 0; attempt < 300 && !up; attempt += 1) {
      try {
        up = (await fetch(`${base}/api/health`)).status === 200;
      } catch {
        // henüz açılmadı
      }
      if (child.exitCode !== null) break;
      if (!up) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(up, `program açılmadı:\n${output.slice(-2000)}`);
    const api = createClient(base);
    assert.equal((await api.login("admin", "Test-Admin-2026!")).status, 200);
    const view = await api.get("/api/workspace/whatsapp/connection");
    assert.equal(view.status, 200);
    assert.equal(view.data.data.graphAvailable, false, "ayrı süreçteki test programında Meta adresi boş");
    // Gerçek programın lisansı etkinleştirilmemiş (deneme ölü adrese gidemez) → salt okunur: kayıt da 403 olur; Meta adresinin boş olması yeter (adres boşken
    // istemci hiçbir isteği başlatmaz — yukarıdaki istemci testi).
    const put = await api.put("/api/workspace/whatsapp/connection", { phoneNumberId: "106540352242922", wabaId: "102290129340398", token: "EAA-IZOLASYON-DENEMESI" });
    assert.equal(put.status, 403);
    assert.equal(put.data.code, "LICENSE_READ_ONLY");
    assert.ok(!output.includes("EAA-IZOLASYON-DENEMESI") && !output.includes(META_HOST), "programın çıktısında belirteç ve Meta adresi yok");
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
          resolve();
        }, 8000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    // Windows'ta kapanan sürecin dosyası bir an tutulabilir: temizlik hatası asıl sonucu ezmez (ders 21; helpers.mjs removeTestDir).
    removeTestDir(root);
  }
});
