// 2.5.0 Ç4 Defter Türü — ESKİ SÜRÜMÜN GERÇEK KODUYLA ÜRETİLEN VERİ (CLAUDE.md test kuralı: "eski sürüm verisi, o sürümün GERÇEK kodu çalıştırılıp API'sinden girilerek üretilir").
// 2.4.9'un kodu (varsayılan ccf0b0ca = v2.4.9 ana dal; sığ klonda etiket yok — git archive ile ayrı klasöre, ders 23) iki şirket üretir:
//   001: Gerçek Kişi + 11 haneli TCKN (serbest meslek / işletme defteri "gibi" görünen), 002: Tüzel Kişi + 10 haneli VKN (bilanço "gibi" görünen); ikisinde cari + fatura.
// Sonra GÜNCEL kod aynı klasörü açar. Beklenen (plan §5 + görev metni): ikisinde de Defter Türü "Seçilmedi" (sessiz çıkarım yok), ayar satırı yazılmamış;
// seçilip Tümünü Sıfırla'dan sonra korunur; şirketler karışmaz.
// Kullanım: node test/defter-turu-c4-eski-surum.mjs [eski kod klasörü | commit]. Gerçek lisans yok (ders 30). Çıkış: "N geçti, M kaldı"; biri kaldıysa çıkış 1.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = mkdtempSync(path.join(tmpdir(), "c4-eski-surum-"));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "✓" : "✗"} ${what}`);
  return cond;
};
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data && response.data.ok ? response.data.data : response.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

function oldCode(arg) {
  if (arg && existsSync(path.join(arg, "server", "app.mjs"))) return { dir: path.resolve(arg), commit: "(klasör)" };
  const commit = arg || "ccf0b0ca";
  const dir = path.join(root, `eski-${commit}`);
  mkdirSync(dir, { recursive: true });
  const archive = path.join(root, "eski.tar");
  execFileSync("git", ["-C", REPO, "archive", "--format=tar", "-o", archive, commit, "server", "client", "package.json"]);
  execFileSync("tar", ["-xf", archive, "-C", dir]);
  if (existsSync(path.join(REPO, "node_modules")) && !existsSync(path.join(dir, "node_modules"))) symlinkSync(path.join(REPO, "node_modules"), path.join(dir, "node_modules"));
  return { dir, commit };
}

async function boot(appDir, dataDir) {
  const { createApp } = await import(pathToFileURL(path.join(appDir, "server", "app.mjs")).href);
  const app = createApp({
    dataDir,
    backupDir: path.join(dataDir, "..", "yedek"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
  });
  const address = await app.listen(0, "127.0.0.1");
  const api = createClient(`http://127.0.0.1:${address.port}`);
  const login = await api.login("admin", ADMIN_PASSWORD);
  if (login.status !== 200) throw new Error(`giriş başarısız: ${login.status}`);
  return { app, api, close: () => app.close() };
}
const rowOf = (file, key) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
  } finally {
    db.close();
  }
};
const today = new Date().toISOString().slice(0, 10);

const { dir: oldDir, commit } = oldCode(process.argv[2]);
console.log(`eski kod: ${commit} (${oldDir})`);
const dataDir = path.join(root, "veri");
let secondId = "";
let secondFile = "";
// 1) Eski sürüm veriyi üretir.
{
  const old = await boot(oldDir, dataDir);
  try {
    const { api } = old;
    await must("firma 001", api.put("/api/workspace/invoices/settings", { seller: { name: "Ayşe Demir", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "12345678950", taxOffice: "Kadıköy" } }));
    const a1 = await must("cari 001", api.post("/api/workspace/accounts", { name: "Ali Kaya", type: "customer" }));
    await must("fatura 001", api.post("/api/workspace/invoices", { kind: "sale", accountId: a1.id, issueDate: today, pricesIncludeVat: true, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    const created = await must("002", api.post("/api/companies", { name: "Demir Ticaret Ltd. Şti.", select: false }));
    secondId = (created.company || created).id;
    const q = `?hofCompany=${encodeURIComponent(secondId)}`;
    await must("firma 002", api.put(`/api/workspace/invoices/settings${q}`, { seller: { name: "Demir Ticaret Ltd. Şti.", partyKind: "company", taxNo: "4840847211", taxOffice: "Kadıköy" } }));
    const a2 = await must("cari 002", api.post(`/api/workspace/accounts${q}`, { name: "Veli Can", type: "customer" }));
    await must("fatura 002", api.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: a2.id, issueDate: today, pricesIncludeVat: true, lines: [{ name: "Mal", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    secondFile = path.join(old.app.companies.dirsOf(old.app.companies.get(secondId)).dataDir);
    const oldSettings = await must("eski ayar", api.get("/api/workspace/invoices/settings"));
    ok(oldSettings.bookType === undefined, "ön koşul: eski sürümde Defter Türü yok");
  } finally {
    await old.close();
  }
}
// 2) Güncel kod aynı veriyi açar.
{
  const { resolveDbPath } = await import(pathToFileURL(path.join(REPO, "server", "lib", "db-path.mjs")).href);
  const cur = await boot(REPO, dataDir);
  try {
    const { api } = cur;
    const q = `?hofCompany=${encodeURIComponent(secondId)}`;
    const s1 = await must("001 oku", api.get("/api/workspace/invoices/settings"));
    const s2 = await must("002 oku", api.get(`/api/workspace/invoices/settings${q}`));
    ok(s1.bookType === "unset", `001 (gerçek kişi, TCKN) Seçilmedi: ${s1.bookType}`);
    ok(s2.bookType === "unset", `002 (tüzel kişi, VKN) Seçilmedi: ${s2.bookType}`);
    ok(s1.seller.partyKind === "person" && s2.seller.partyKind === "company", "eski firma bilgisi yerinde");
    ok(rowOf(resolveDbPath(dataDir), "accounting.bookType") === null && rowOf(resolveDbPath(secondFile), "accounting.bookType") === null, "açılışta ayar satırı yazılmadı (sessiz çıkarım yok)");
    await must("001 seç", api.put("/api/workspace/invoices/settings", { bookType: "professional" }));
    await must("002 seç", api.put(`/api/workspace/invoices/settings${q}`, { bookType: "balance" }));
    await must("002 Tümünü Sıfırla", api.post(`/api/companies/${encodeURIComponent(secondId)}/reset`, { mode: "all", confirm: "002", password: ADMIN_PASSWORD }));
    ok((await must("002 oku", api.get(`/api/workspace/invoices/settings${q}`))).bookType === "balance", "002 Tümünü Sıfırla'dan sonra Bilanço Esası korunur");
    ok((await must("001 oku", api.get("/api/workspace/invoices/settings"))).bookType === "professional", "001 ayrı ayarını taşır");
  } finally {
    await cur.close();
  }
}
rmSync(root, { recursive: true, force: true });
console.log(`${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
