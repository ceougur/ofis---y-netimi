// 2.5.0 BS-4 (2.4.8 dk17'den devreden DÜŞÜK; docs/2.4.8-IS-LISTESI.md satır 565, docs/2.5.0-IS-LISTESI.md A tablosu BS-4) — bir şirketin veri dosyası
// kayıpken (taşınma, virüs programı, disk hatası) Yönetim → Şirketler → Birleşik Rapor 500 "Sunucu işlemi tamamlayamadı." dönüyordu: buildReport her
// şirket için appFor() açıyor, app.mjs appFor kayıp dosyada (v2.0.21 "boş açılmaz" koruması) HttpError OLMAYAN bir hata (dataMissing) atıyor.
// Veri dosyası YARATILMIYORDU (koruma açılıştan önce), yalnız yanıt yanlıştı.
// BAŞ MİMAR KARARI (ders 4: okunamayan veri boş değildir; yaygın birleşik raporlama — kaynak eksikse rapor üretilmez):
//   • rapor KISMİ TOPLAM vermez; ekran (JSON), PDF ve Excel AYNI yanıt: 409 + code "company-data-missing" (bozuk / açılamayan dosyada "company-unavailable");
//   • ileti şirketin kodunu ve adını söyler, ne yapılacağını bir cümleyle anlatır;
//   • hiçbir dosya ya da klasör yaratılmaz (istekten sonra şirket klasörü listelenir);
//   • açılış hata verirse yarım açılmış bağlantı kalmaz (Linux'ta /proc/self/fd; ders 48 — "açmayı denedi → sonra dosya değiştirildi" sırası da denenir).
// Kayıp şirket seçilmeden alınan rapor (yalnız 001) eskisi gibi 200.
// Dosyaya dokunmadan ÖNCE şirket kapatılır (closeCompany async → await; Windows açık dosyayı silmez — ders 48).
// Eski kodda (e74eb6e7) beklenen kırmızı (ders 38): "rapor üretilmez (409)" denetiminde 500.
// Sahte saat (ders 13); lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const LINUX = process.platform === "linux";
const unwrap = res => (res.data && typeof res.data === "object" && res.data.ok === true ? res.data.data : res.data);

// Linux: sürecin açık dosya tanıtıcıları (hedef yollarıyla). Başka platformda null (ölçülmez; DENENMEYEN).
const openFds = () => {
  if (!LINUX) return null;
  const out = [];
  for (const fd of readdirSync("/proc/self/fd")) {
    try {
      out.push(readlinkSync(`/proc/self/fd/${fd}`));
    } catch {
      // okuma sırasında kapanan tanıtıcı
    }
  }
  return out;
};
const listing = dir => (existsSync(dir) ? readdirSync(dir).sort() : "KLASÖR YOK");

async function world() {
  const server = await startTestServer({ now: NOW, maxCompanies: 2, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const admin = await loginAdmin(server);
  const created = await admin.post("/api/companies", { code: "002", name: "Kayıp Veri Ltd.", select: true });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const company = unwrap(created).company;
  // 002'de veri (boş şirket değil): cari + Kasa girişi.
  assert.equal((await admin.post("/api/workspace/accounts", { name: "Kaybolmaması Gereken", type: "customer" })).status, 200);
  assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: 2500, date: "2026-10-08", description: "Açılış" })).status, 200);
  const root = unwrap(await admin.get("/api/companies")).companies.find(item => item.root);
  assert.equal((await admin.post("/api/companies/select", { id: root.id })).status, 200, "001'e dönüldü");
  assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: 1000, date: "2026-10-08", description: "Açılış" })).status, 200);
  // Kayıptan önce birleşik rapor iki şirketle 200; 002'nin Kasa'sı 2.500 (programın kendi ürettiği veri).
  const healthy = await admin.get("/api/companies/report");
  assert.equal(healthy.status, 200, JSON.stringify(healthy.data));
  assert.deepEqual(unwrap(healthy).rows.map(row => [row.code, row.cash]), [["001", 1000], ["002", 2500]]);
  const dir = path.join(server.dataDir, "sirketler", "002");
  const file = path.join(dir, "destekofis.sqlite");
  assert.ok(existsSync(file), "002'nin veri dosyası var");
  // Önce şirket kapatılır (async; Windows açık dosyayı silmez), sonra dosyaya dokunulur.
  await server.app.context.closeCompany(company.id);
  return { server, admin, company, root, dir, file };
}

// Ekran (JSON), PDF ve Excel üçü de aynı 409 + ileti; her istekten sonra klasör ve açık dosyalar ölçülür.
async function assertRefused(w, { code, message, dirAfter, label }) {
  const problems = [];
  const fdsBefore = openFds();
  for (const [kind, url] of [
    ["ekran", "/api/companies/report"],
    ["ekran (yalnız 002)", `/api/companies/report?ids=${w.company.id}`],
    ["PDF", "/api/companies/report.pdf?inline=1"],
    ["Excel", "/api/companies/report.xlsx"],
  ]) {
    const res = await w.admin.raw("GET", url);
    const body = res.data || {};
    if (res.status !== 409) problems.push(`${kind}: rapor üretilmez (409) — yanıt ${res.status} ${res.buffer.toString("utf8").slice(0, 160)}`);
    if (body.code !== code) problems.push(`${kind}: code “${body.code}” (beklenen “${code}”)`);
    if (!message.test(String(body.error))) problems.push(`${kind}: ileti “${body.error}” ${message} ile eşleşmiyor`);
    if (res.headers.get("content-type")?.includes("pdf") || res.headers.get("content-type")?.includes("spreadsheet")) problems.push(`${kind}: dosya üretildi (kısmi rapor)`);
    const now = listing(w.dir);
    if (JSON.stringify(now) !== JSON.stringify(dirAfter)) problems.push(`${kind}: şirket klasörü değişti — ${JSON.stringify(now)} (beklenen ${JSON.stringify(dirAfter)})`);
  }
  if (fdsBefore) {
    const fdsAfter = openFds();
    const toData = fdsAfter.filter(target => target.startsWith(w.dir));
    if (toData.length) problems.push(`yarım açılmış bağlantı: ${toData.join(", ")}`);
    if (fdsAfter.length > fdsBefore.length) problems.push(`açık dosya sayısı arttı: ${fdsBefore.length} → ${fdsAfter.length}`);
  }
  assert.deepEqual(problems, [], `${label}: ${problems.join(" | ")}`);
}

describe("2.5.0 BS-4 — veri dosyası kayıp ya da açılamayan şirket varken Birleşik Rapor üretilmez (409; ekran = PDF = Excel), dosya yaratılmaz", () => {
  let w;
  before(async () => {
    w = await world();
  });
  after(async () => w?.server.close());

  test("veri dosyası silinmiş: 409 company-data-missing, ileti kod + ad + ne yapılacağı; klasörde dosya yaratılmaz; açık tanıtıcı kalmaz", async () => {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${w.file}${suffix}`, { force: true, maxRetries: 10, retryDelay: 200 });
    const left = listing(w.dir);
    assert.ok(!left.includes("destekofis.sqlite"), "ön koşul: veri dosyası yok");
    await assertRefused(w, { label: "dosya silinmiş", code: "company-data-missing", message: /^“002 · Kayıp Veri Ltd\.” şirketinin veri dosyası bulunamadı; birleşik rapor üretilmedi\. Yönetim → Yedekler'den şirketi geri yükleyin ya da raporu bu şirketi seçmeden alın\.$/, dirAfter: left });
  });

  test("veri klasörü tamamen silinmiş: aynı 409; klasör yeniden yaratılmaz", async () => {
    rmSync(w.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await assertRefused(w, { label: "klasör silinmiş", code: "company-data-missing", message: /“002 · Kayıp Veri Ltd\.” şirketinin veri dosyası bulunamadı/, dirAfter: "KLASÖR YOK" });
  });

  test("kayıp şirket seçilmeden (yalnız 001) rapor eskisi gibi 200 ve yalnız 001'i toplar", async () => {
    const res = await w.admin.get(`/api/companies/report?ids=${w.root.id}`);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const report = unwrap(res);
    assert.deepEqual(report.rows.map(row => [row.code, row.cash]), [["001", 1000]]);
    assert.equal(report.totals[1], 1000, "TOPLAM = 001");
    const pdf = await w.admin.raw("GET", `/api/companies/report.pdf?ids=${w.root.id}`);
    const xlsx = await w.admin.raw("GET", `/api/companies/report.xlsx?ids=${w.root.id}`);
    assert.deepEqual([pdf.status, xlsx.status], [200, 200]);
    assert.equal(existsSync(w.dir), false, "kayıp şirketin klasörü yaratılmadı");
  });
});

describe("2.5.0 BS-4 — veri dosyası bozuk (açılış hata verir): 409 company-unavailable; yarım açılmış bağlantı kalmaz, dosya sonra silinebilir (ders 48)", () => {
  let w;
  before(async () => {
    w = await world();
  });
  after(async () => w?.server.close());

  test("bozuk dosya: 409, ileti kod + ad + neden; açık tanıtıcı yok; açmayı denedikten sonra dosya silinip yerine yenisi yazılabilir", async () => {
    for (const suffix of ["-wal", "-shm"]) rmSync(`${w.file}${suffix}`, { force: true, maxRetries: 10, retryDelay: 200 });
    writeFileSync(w.file, Buffer.alloc(64 * 1024, 0x5a));
    const left = listing(w.dir);
    await assertRefused(w, { label: "dosya bozuk", code: "company-unavailable", message: /^“002 · Kayıp Veri Ltd\.” şirketinin verisi açılamadı \([^)]+\); birleşik rapor üretilmedi\. Yönetim → Yedekler'den şirketi geri yükleyin ya da raporu bu şirketi seçmeden alın\.$/, dirAfter: left });
    // "Program açmayı denedi → sonra dosya değiştirildi" (ders 48): açık bağlantı kalsaydı Windows'ta silme EBUSY verirdi.
    rmSync(w.file, { force: true });
    writeFileSync(w.file, Buffer.alloc(1024, 0x41));
    assert.equal(existsSync(w.file), true);
  });
});
