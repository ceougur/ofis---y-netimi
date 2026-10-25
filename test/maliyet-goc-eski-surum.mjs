#!/usr/bin/env node
// 2.4.6 madde 1 — göç v34'ün ESKİ SÜRÜMÜN GERÇEK VERİSİYLE denenmesi (CLAUDE.md test kuralı: test verisi programın kendisinin ürettiği veridir; ders 17, 23).
// Elle koşulur (npm test'te değil; eski kod gerekir):
//   git archive v2.4.5 | tar -x -C <ayrı klasör>        (ders 23: eski kod çalışma ağacına girmez)
//   node test/maliyet-goc-eski-surum.mjs <ayrı klasör>
// Adımlar: (1) v2.4.5'in GERÇEK kodu API'den veri üretir (001: cariler, stok kartları, Kasa hareketleri, sektör Üretim; 002: cariler + Kasa).
// (2) Aynı veri klasörü bu dalın koduyla açılır: göç v34 uygulanır (göç öncesi yedek), eski tabloların satır sayıları ve Kasa / cari bakiyeleri
// değişmez, maliyet_* tabloları boş; sektör Duşakabin Üretimi seçilince şablon kurulur, değer kaydedilir. 002 açılınca o da göçer.
// (3) Eski sürüme dönüş: v2.4.5 aynı (v34) dosyayı açar, verisini okur, yazar; maliyet tablolarına dokunmaz. (4) Yeni kodla yeniden: değer yerinde.
// Ders 30: HUKUK_LICENSE_URL=http://127.0.0.1:9. Çıkış 0 = bütün denetimler geçti; 1 = biri geçmedi.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const OLD = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(path.join(OLD, "server/app.mjs"))) {
  console.error("kullanım: node test/maliyet-goc-eski-surum.mjs <v2.4.5 kod kopyası>");
  process.exit(2);
}
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Goc-Eski-Surum-2026!";
const root = mkdtempSync(path.join(tmpdir(), "maliyet-goc-v245-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
let checks = 0;
const opened = new Set();
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
  console.log(`  ✓ ${message}`);
};
const eq = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
  console.log(`  ✓ ${message}`);
};

async function open(codeRoot, label) {
  const { createApp } = await import(`${pathToFileURL(path.join(codeRoot, "server/app.mjs")).href}?${label}`);
  const app = createApp({
    dataDir, backupDir, logLevel: "silent", scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, alertScheduler: false, chatArchive: false, integrityScan: false, posQueue: false, analysisWorker: false,
  });
  opened.add(app);
  const close = app.close.bind(app);
  app.close = async () => {
    opened.delete(app);
    await close();
  };
  const { port } = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  let cookie = "";
  const req = async (method, url, body) => {
    const response = await fetch(base + url, { method, headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = (response.headers.get("content-type") || "").includes("json") ? await response.json() : null;
    return { status: response.status, data };
  };
  const data = async (method, url, body) => {
    const response = await req(method, url, body);
    assert.equal(response.status, 200, `${label} ${method} ${url}: ${response.status} ${JSON.stringify(response.data).slice(0, 200)}`);
    return response.data.data;
  };
  await data("POST", "/api/auth/login", { username: "admin", password: PASSWORD });
  return { app, req, data, version: app.config.version };
}

// Eski tabloların satır sayıları (maliyet_* hariç) + Kasa ve cari bakiyesi (programın kendi uçlarından).
async function snapshot(p, q = "") {
  const db = q ? null : p.app.store;
  const counts = db ? Object.fromEntries(db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'maliyet_%' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(({ name }) => [name, db.get(`SELECT COUNT(*) AS n FROM "${name}"`).n])) : null;
  const accounts = await p.data("GET", `/api/workspace/accounts${q}`);
  const list = Array.isArray(accounts) ? accounts : accounts.items || accounts.accounts || [];
  const cash = await p.data("GET", `/api/workspace/cash${q}`);
  return { counts, accounts: list.map(item => [item.id, item.name, item.balance ?? item.balanceMinor ?? null]).sort(), cashBalance: cash.balance ?? cash.summary ?? cash.totals ?? null };
}

try {
  console.log(`eski kod: ${OLD}\nyeni kod: ${NEW}\nveri: ${root}`);
  // (1) v2.4.5 veri üretir
  const old = await open(OLD, "eski1");
  ok(old.version === "2.4.5", `eski program sürümü 2.4.5 (${old.version})`);
  ok(old.app.store.get("PRAGMA user_version").user_version === 33, "eski veri dosyası v33");
  await old.data("POST", "/api/workspace/insight/sector", { sectorId: "uretim", source: "manual" });
  ok((await old.req("POST", "/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" })).status === 400, "eski sürüm Duşakabin Üretimi sektörünü tanımaz (400)");
  for (let i = 1; i <= 300; i += 1) await old.data("POST", "/api/workspace/accounts", { name: `Göç Carisi ${i}`, type: i % 4 === 0 ? "supplier" : "customer" });
  for (let i = 1; i <= 100; i += 1) await old.data("POST", "/api/workspace/stock", { name: `Göç Ürünü ${i}`, unit: "Adet", minQty: "", unitPrice: String(10 + i), openingQty: String(i), openingCash: false, openingDate: today });
  for (let i = 1; i <= 500; i += 1) await old.data("POST", "/api/workspace/cash", { kind: i % 3 === 0 ? "out" : "in", amount: String(100 + (i % 37)), description: `Göç hareketi ${i}` });
  const second = (await old.data("POST", "/api/companies", { name: "Göç İkinci" })).company;
  const q = `?hofCompany=${second.id}`;
  for (let i = 1; i <= 50; i += 1) await old.data("POST", `/api/workspace/accounts${q}`, { name: `İkinci Cari ${i}` });
  for (let i = 1; i <= 50; i += 1) await old.data("POST", `/api/workspace/cash${q}`, { kind: "in", amount: String(50 + i), description: `İkinci ${i}` });
  const before = await snapshot(old);
  const before2 = await snapshot(old, q);
  ok(before.counts.accounts >= 300 && before.counts.cash_entries >= 500 && before.counts.stock_items >= 100, `eski veri üretildi (cari ${before.counts.accounts}, kasa ${before.counts.cash_entries}, stok ${before.counts.stock_items})`);
  ok(!old.app.store.get("SELECT 1 AS found FROM sqlite_master WHERE name = 'maliyet_kartlar'"), "eski dosyada maliyet tablosu yok");
  await old.app.close();

  // (2) yeni kod aynı veriyi açar → göç v34
  const neu = await open(NEW, "yeni1");
  ok(neu.app.migration.applied.includes(34), `göç uygulandı: ${neu.app.migration.applied.join(", ")}`);
  ok(neu.app.store.get("PRAGMA user_version").user_version >= 34, "veri dosyası v34");
  ok(/pre-migration-v3[4-9]/.test(neu.app.migration.backup?.name || ""), `göç öncesi yedek alındı (${neu.app.migration.backup?.name})`);
  const after = await snapshot(neu);
  eq(after.accounts, before.accounts, "cari listesi ve bakiyeleri aynı");
  eq(after.cashBalance, before.cashBalance, "Kasa bakiyesi aynı");
  const changed = Object.entries(after.counts).filter(([name, n]) => before.counts[name] !== n && !["audit_events", "settings", "sessions"].includes(name));
  // Hariç: işlem geçmişi ve ayarlar (açılış / göç kaydı), oturumlar (yeni programa giriş bir oturum satırı ekler — ilk koşuda sessions 1 → 2 görüldü).
  eq(changed, [], "eski tabloların satır sayısı değişmedi (işlem geçmişi, ayarlar ve oturumlar hariç)");
  eq(neu.app.store.all("SELECT name FROM sqlite_master WHERE name LIKE 'maliyet_%' AND type = 'table' ORDER BY name").map(row => row.name), ["maliyet_adimlar", "maliyet_basliklar", "maliyet_hucreler", "maliyet_kartlar", "maliyet_satirlar", "maliyet_sekmeler"], "maliyet tabloları eklendi");
  ok(neu.app.store.get("SELECT COUNT(*) AS n FROM maliyet_kartlar").n === 0, "maliyet tabloları boş (sektör Üretim)");
  ok((await neu.req("GET", "/api/maliyet")).status === 403, "sektör Üretim iken kart kapalı");
  await neu.data("POST", "/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" });
  const state = await neu.data("GET", "/api/maliyet");
  ok(Object.keys(state.kartlar).length === 28, "Duşakabin Üretimi seçilince 28 kartlık boş şablon kuruldu (5 + 8 + 7 + 8)");
  const kart = state.kartlar["cam/100x100-oval-kabin"];
  const saved = await neu.data("PUT", "/api/maliyet", { kartlar: [{ kod: kart.kod, rev: kart.rev, satirlar: [{ id: "s1", ad: "Aliminyum", birim: "Kgr", miktar: 2, fiyat: 125.5 }] }] });
  ok(saved.kartlar[kart.kod].sonuc === (((251 + (251 * 18) / 100) * 20) / 100 + (251 + (251 * 18) / 100)) / 200, "göçmüş veride maliyet kaydedildi ve hesaplandı");
  const after2 = await snapshot(neu, q);
  eq(after2.accounts, before2.accounts, "002: cari listesi aynı (açılınca göçtü)");
  eq(after2.cashBalance, before2.cashBalance, "002: Kasa bakiyesi aynı");
  ok((await neu.req("GET", `/api/maliyet${q}`)).status === 403, "002'nin sektörü ayrı (kapalı)");
  const maliyetSayisi = db => db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'maliyet_%' ORDER BY name").map(({ name }) => [name, db.get(`SELECT COUNT(*) AS n FROM "${name}"`).n]);
  const maliyetOnce = maliyetSayisi(neu.app.store);
  await neu.app.close();

  // (3) eski sürüme dönüş: v2.4.5 v34 dosyasını açar
  const back = await open(OLD, "eski2");
  ok(back.app.store.get("PRAGMA user_version").user_version >= 34, "eski sürüm yeni dosyayı açtı (şema sürümü korunur)");
  const backSnap = await snapshot(back);
  eq(backSnap.accounts, before.accounts, "eski sürüm carileri okur");
  await back.data("POST", "/api/workspace/cash", { kind: "in", amount: "77", description: "Eski sürüme dönüşte" });
  eq(maliyetSayisi(back.app.store), maliyetOnce, "eski sürüm maliyet tablolarına dokunmadı (satır sayıları aynı)");
  await back.app.close();

  // (4) yeni kod yeniden
  const again = await open(NEW, "yeni2");
  ok(again.app.migration.applied.length === 0, "yeniden açılışta göç yok");
  const reread = await again.data("GET", "/api/maliyet");
  eq(reread.kartlar[kart.kod].satirlar[0].fiyat, 125.5, "maliyet değeri yerinde");
  await again.app.close();
  console.log(`\nGEÇTİ: ${checks} denetim · eski ${old.version} → yeni → eski → yeni · yedekler: ${readdirSync(backupDir, { recursive: true }).filter(name => String(name).endsWith(".sqlite") || String(name).includes("pre-migration")).length}`);
} catch (error) {
  console.error(`\nBAŞARISIZ (${checks} denetim geçti): ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  // Hata olsa da açık kalan program kapanır (süreç takılı kalmaz).
  for (const app of [...opened]) await app.close().catch(() => {});
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
