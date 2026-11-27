// 2.5.0 W-1(a) GÖÇ — ESKİ SÜRÜMÜN GERÇEK KODUYLA ÜRETİLEN BAĞLANTI (CLAUDE.md test kuralı: "eski sürüm verisi, o sürümün GERÇEK kodu çalıştırılıp API'sinden girilerek üretilir").
// 2.4.9'un kodu (varsayılan ccf0b0ca = v2.4.9 ana dal; sığ klonda etiket yok — git archive ile ayrı klasöre, ders 23) iki veri klasörü üretir:
//   (1) Elle Bağla + Bağlantıyı Sına (Yol 1)   (2) WhatsApp'ı Bağla kaydı (Yol 2; 2.4.9'un saveEmbedded işlevi — rota kapıcıdan gelen belirteçle bunu çağırır)
// sonra GÜNCEL kod aynı klasörleri açar. Beklenen (plan WHATSAPP-PAKETI-2.5.0 §1 W-1 + görev metni): Yol 1 süresiz; Meta 190 → "Süresi Doldu" (2.4.9'da sınanmış belirteç
// "çalışmış" sayılır); Yol 2 bağlanma + 60 gün → 53. günde "doluyor", 60. günde "Süresi Doldu", yeni gönderim 409.
// Kullanım: node test/whatsapp-w1a-goc-250.mjs [eski kod klasörü | commit]   (varsayılan commit ccf0b0ca). Gerçek Meta / lisans yok (ders 30). Çıkış: "N geçti, M kaldı".
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA } from "./whatsapp-248-ortak.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86_400_000;
const T0 = Date.parse("2026-11-05T10:00:00+03:00");
const root = mkdtempSync(path.join(tmpdir(), "w1a-goc-250-"));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "✓" : "✗"} ${what}`);
  return cond;
};

function oldCode(arg) {
  if (arg && existsSync(path.join(arg, "server", "app.mjs"))) return { dir: path.resolve(arg), commit: "(klasör)" };
  const commit = arg || "ccf0b0ca";
  const dir = path.join(root, `eski-${commit}`);
  mkdirSync(dir, { recursive: true });
  const archive = path.join(root, "eski.tar");
  execFileSync("git", ["-C", REPO, "archive", "--format=tar", "-o", archive, commit, "server", "client", "package.json"]);
  execFileSync("tar", ["-xf", archive, "-C", dir]);
  return { dir, commit };
}

async function boot(appDir, dataDir, nowMs, graphUrl) {
  const { createApp } = await import(pathToFileURL(path.join(appDir, "server", "app.mjs")).href);
  const app = createApp({
    dataDir,
    backupDir: path.join(dataDir, "..", "yedek"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
    now: { time: new Date(nowMs).toISOString(), fixed: true },
    whatsappGraphUrl: graphUrl,
    whatsappTimeoutMs: 800,
    whatsappWorker: "manual",
    whatsappGapMs: 0,
  });
  const address = await app.listen(0, "127.0.0.1");
  const api = createClient(`http://127.0.0.1:${address.port}`);
  const login = await api.login("admin", ADMIN_PASSWORD);
  if (login.status !== 200) throw new Error(`giriş başarısız: ${login.status}`);
  return { app, api, close: () => app.close() };
}

const code = oldCode(process.argv[2]);
console.log(`eski kod: ${code.commit} → ${code.dir}`);
const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
fake.state.templates.push(...PROGRAM_TEMPLATES());
const manualDir = path.join(root, "yol1", "veri");
const embeddedDir = path.join(root, "yol2", "veri");
try {
  // ---------- 2.4.9 (eski kod) veriyi üretir ----------
  {
    const old = await boot(code.dir, manualDir, T0, fake.url);
    try {
      ok((await old.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status === 200, "2.4.9: Elle Bağla kaydedildi");
      ok((await old.api.post(`${URLS.conn}/test`, {})).status === 200, "2.4.9: Bağlantıyı Sına başarılı");
      const raw = JSON.parse(old.app.store.setting("whatsapp.meta", "{}"));
      ok(!("tokenExpiresAt" in raw) && raw.lastTest?.ok === true, "2.4.9 kaydında süre alanı yok (eski biçim), son sınama başarılı");
    } finally {
      await old.close();
    }
  }
  {
    const old = await boot(code.dir, embeddedDir, T0, fake.url);
    try {
      const admin = old.app.store.get("SELECT * FROM users WHERE username = 'admin'");
      old.app.context.whatsapp.connection.saveEmbedded(admin, { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: "1505264761663625" });
      const raw = JSON.parse(old.app.store.setting("whatsapp.meta", "{}"));
      ok(raw.mode === "embedded" && !("tokenExpiresAt" in raw), "2.4.9: WhatsApp'ı Bağla kaydı (eski biçim, süre alanı yok)");
      ok((await old.api.put("/api/admin/office", { name: "Göç Ticaret" })).status === 200 && (await old.api.put(URLS.ack, { ack: true })).status === 200, "2.4.9: firma adı + gönderim onayı");
      ok((await old.api.post("/api/workspace/accounts", { name: "Göç Kişi", phone: "0532 700 00 01", openingBalance: "100" })).status === 200, "2.4.9: cari");
    } finally {
      await old.close();
    }
  }
  // ---------- 2.5.0 (güncel kod) aynı veriyi açar ----------
  {
    const cur = await boot(REPO, manualDir, T0 + 400 * DAY, fake.url);
    try {
      const view = (await cur.api.get(URLS.conn)).data.data;
      ok(view.tokenExpiry?.state === "ok" && view.tokenExpiry?.expiresAt === null, `Yol 1 (2.4.9 kaydı) süresiz: 400 gün sonra ${JSON.stringify(view.tokenExpiry)}`);
      fake.set({ token: "META-DA-IPTAL-EDILDI" });
      ok((await cur.api.post(`${URLS.conn}/test`, {})).status === 502, "Meta 190 (belirteç Meta'da kaldırıldı)");
      const after = (await cur.api.get(URLS.conn)).data.data;
      ok(after.tokenExpiry?.state === "expired" && after.tokenExpiry?.expiredBy === "meta", `2.4.9'da sınanmış belirteç çalışmış sayılır → Süresi Doldu (Meta): ${JSON.stringify(after.tokenExpiry)}`);
      fake.set({ token: TOKEN });
    } finally {
      await cur.close();
    }
  }
  {
    const cur = await boot(REPO, embeddedDir, T0 + 53 * DAY, fake.url);
    try {
      const view = (await cur.api.get(URLS.conn)).data.data;
      ok(view.tokenExpiry?.expiresAt === new Date(T0 + 60 * DAY).toISOString() && view.tokenExpiry?.source === "default", `Yol 2 (2.4.9 kaydı): bitiş = bağlanma + 60 gün (${view.tokenExpiry?.expiresAt})`);
      ok(view.tokenExpiry?.state === "expiring" && view.tokenExpiry?.daysLeft === 7, `53. gün: süresi doluyor, 7 gün kaldı (${view.tokenExpiry?.state} ${view.tokenExpiry?.daysLeft})`);
    } finally {
      await cur.close();
    }
  }
  {
    const cur = await boot(REPO, embeddedDir, T0 + 60 * DAY, fake.url);
    try {
      const view = (await cur.api.get(URLS.conn)).data.data;
      ok(view.tokenExpiry?.state === "expired" && view.tokenExpiry?.expiredBy === "clock", `60. gün: Süresi Doldu (${JSON.stringify(view.tokenExpiry)})`);
      const id = cur.app.store.get("SELECT id FROM accounts WHERE name = 'Göç Kişi'")?.id;
      const before = fake.requests.length;
      const res = await cur.api.post(URLS.batches, { kind: "statement", ids: [id], preset: "thisMonth" });
      ok(res.status === 409 && res.data.code === "whatsapp-token-expired" && /süresi doldu/.test(res.data.error || ""), `yeni gönderim 409 Türkçe neden (${res.status} ${res.data.code})`);
      ok(fake.requests.length === before, "Meta'ya istek gitmedi");
    } finally {
      await cur.close();
    }
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await fake.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
