// 2.5.0 Ç5-A tur 1b — S127 = A ("bir olay tek kez yazılır"; C5-ACILIS-TASARIM §12.1) KALICI fikstürü (ders 53 (b); anayasa: test verisi programın kendi ürettiği veri).
// GERÇEK v2.4.9 koduyla (git etiketi; bootVersion), o sürümün API'sinden, iki ayrı günde (sahte saat) girilen Excel taksit kartları — her S127 sınıfı için bir kart:
//   "Kilitli Kart"  Kayıt 01.06.2025, yükleme 10.11.2025 (ikisi de kilitli yılda — §3.3 örneği; sınıf iii)
//   "Ters Kart"     yükleme 10.11.2025, Kayıt Tarihi 20.01.2026 günü 15.01.2026 yapılır, P 600 (eski kuralın kart maddesi AÇIK dönemde, yeni kuralın maddesi kilitli yılda — ters)
//   "Ters Sıfır"    yükleme 10.11.2025, Kayıt Tarihi sonradan 20.01.2026, P 0 (ters yön, P = 0)
//   "Kart Bir"      Kayıt 01.10.2025, yükleme 10.11.2026, P 1.500 (kararın örneği; sınıf i / ii P > 0)
//   "Kart İki"      Kayıt 01.10.2025, yükleme 10.11.2026, P 0 (sınıf ii P = 0)
//   "Açık Kart"     Kayıt 01.03.2026, yükleme 10.11.2026, P 300 (ikisi de açık dönemde; sınıf iv)
// + Kasa açılışı, açılışlı cari, tahsilat. İki fikstür: surum-2.4.9-s127-kilitsiz (kilit YOK — sınıf v ve viii) ve surum-2.4.9-s127 (v2.4.9'da kilit 31.12.2025 — göç 47
// bekleyen 2.4.9 koşusu; sınıf i, ii, iii, vi, vii, ters). Her fikstürün manifestinde `oncesi`: v2.4.9'un AYNI veride kendi okuduğu sayılar (mizan bütün zaman / 2025 / 2026,
// cari bakiyeleri, 2025 Yevmiye satırları, Mutabakat Testi) — testin kâhini (eski sürümün gerçek kodu; ders 5, 53 (b)).
//
//   Yeniden üret (etiket gerekir: git fetch --tags):
//     node --disable-warning=ExperimentalWarning test/guvenilirlik/s127-v249-veri.mjs
//   → test/fixtures/surum-2.4.9-s127-kilitsiz, test/fixtures/surum-2.4.9-s127 (+ içerik deposu test/fixtures/surum-nesneler)
// Test: test/s127-tek-kez-250.test.mjs.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { packFixture } from "./fikstur.mjs";
import { bootVersion } from "./surumler.mjs";

export const S127_FIXTURE = "surum-2.4.9-s127";
export const S127_FIXTURE_UNLOCKED = "surum-2.4.9-s127-kilitsiz";
export const S127_TAG = "v2.4.9";
export const S127_DAY_A = "2025-11-10T12:00:00+03:00";
export const S127_DAY_M = "2026-01-20T12:00:00+03:00";
export const S127_DAY_B = "2026-11-10T12:00:00+03:00";
export const S127_LOCK = "2025-12-31";
export const S127_CARDS = Object.freeze([
  { name: "Kilitli Kart", total: "2000", paid: "500", registered: "01.06.2025", day: "A", sinif: "iii" },
  { name: "Ters Kart", total: "3000", paid: "600", registered: "10.11.2025", moveTo: "2026-01-15", day: "A", sinif: "ters" },
  { name: "Ters Sıfır", total: "1000", paid: "0", registered: "10.11.2025", moveTo: "2026-01-20", day: "A", sinif: "ters-0" },
  { name: "Kart Bir", total: "6000", paid: "1500", registered: "01.10.2025", day: "B", sinif: "i" },
  { name: "Kart İki", total: "2400", paid: "0", registered: "01.10.2025", day: "B", sinif: "ii-0" },
  { name: "Açık Kart", total: "1800", paid: "300", registered: "01.03.2026", day: "B", sinif: "iv" },
]);

const data = response => response.data?.data ?? response.data;
const must = async (label, call) => {
  const response = await call;
  if (response.status !== 200) throw new Error(`${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return data(response);
};

/** Aynı okuma her sürümde (v2.4.9 ve güncel kod; testin karşılaştırdığı alanlar). api: surumler.mjs apiOf biçimi. */
export async function readS127Facts(api) {
  const out = {};
  const trial = async query => Object.fromEntries((await must("mizan", api.get(`/api/workspace/ledger${query}`))).trial.accounts.filter(row => row.balance || row.debit || row.credit).map(row => [row.code, Math.round(Number(row.balance) * 100)]));
  out.mizan = await trial("");
  out.mizan2025 = await trial("?from=2025-01-01&to=2025-12-31");
  out.mizan2026 = await trial("?from=2026-01-01&to=2026-12-31");
  out.cari = Object.fromEntries((await must("cari", api.get("/api/workspace/accounts?status=all&limit=500"))).accounts.map(row => [row.name, Math.round(Number(row.balance) * 100)]));
  out.yevmiye2025 = (await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2025-01-01&to=2025-12-31"))).rows;
  const scan = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  out.mutabakat = { ok: scan.ok, failures: scan.checks.filter(check => !check.ok).map(check => check.code).sort() };
  out.lock = (await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil || "";
  return out;
}

export async function produce({ log = console.log } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-s127-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const roles = { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" };
  const upload = (api, day, fileName) =>
    must(`Excel kartları (${day})`, api.post("/api/workspace/plans/import", {
      matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], ...S127_CARDS.filter(card => card.day === day).map(card => [card.name, card.total, "6", "15.02.2026", card.paid, card.registered])],
      headerAt: 0, roles, fileName, linkRecords: false,
    }));
  let commit = "";
  try {
    // Gün A (10.11.2025): Kasa açılışı, açılışlı cari, kilitli yıla düşen kartlar.
    let server = await bootVersion(S127_TAG, { dataDir, backupDir, now: { time: S127_DAY_A, fixed: true } });
    commit = server.commit;
    try {
      const api = await server.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "10.000", date: "2025-01-02" }));
      await must("cari", api.post("/api/workspace/accounts", { name: "Müşteri Bir", registeredOn: "2025-01-02", openingBalance: "3.000", openingSide: "auto" }));
      const a = await upload(api, "A", "kartlar-2025.xlsx");
      if (a.created !== 3) throw new Error(`gün A: ${a.created} kart açıldı (beklenen 3) ${JSON.stringify(a.skipped)}`);
    } finally {
      await server.close();
    }
    // Ara gün (20.01.2026, kilit henüz yok): ters yön kartlarının Kayıt Tarihi düzeltilir (v2.4.9 yüklemede ileri Kayıt Tarihi'ni yükleme gününe çeker — "Kayıt tarihi ileri
    // bir tarih olamaz"; ters yön ancak Kayıt Tarihi sonradan düzeltilince doğar). Kart maddesi 2026'ya geçer, açılış satırı (P) 10.11.2025'te kalır.
    server = await bootVersion(S127_TAG, { dataDir, backupDir, now: { time: S127_DAY_M, fixed: true } });
    try {
      const api = await server.login();
      const list = (await must("kartlar", api.get("/api/workspace/plans?status=all"))).plans;
      for (const item of S127_CARDS.filter(entry => entry.moveTo)) {
        const plan = list.find(row => row.name === item.name);
        if (!plan) throw new Error(`${item.name} kartı yok`);
        await must(`${item.name} Kayıt Tarihi`, api.put(`/api/workspace/plans/${plan.id}`, { name: plan.name, phone: plan.phone || "", note: plan.note || "", total: String(plan.total ?? item.total), refNo: plan.refNo || "", registeredOn: item.moveTo, accountId: plan.accountId || "", groupId: plan.groupId || "", subgroupId: plan.subgroupId || "", caseKey: plan.caseKey || "", caseSource: plan.caseSource || "", caseTitle: plan.caseTitle || "" }));
      }
    } finally {
      await server.close();
    }
    // Gün B (10.11.2026): tahsilat, açık dönemde yüklenen kartlar.
    server = await bootVersion(S127_TAG, { dataDir, backupDir, now: { time: S127_DAY_B, fixed: true } });
    let unlocked;
    try {
      const api = await server.login();
      const account = (await must("cariler", api.get("/api/workspace/accounts?status=all&limit=50"))).accounts.find(row => row.name === "Müşteri Bir");
      await must("tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "800", date: "2026-02-01", method: "cash", note: "Tahsilat" }));
      const b = await upload(api, "B", "kartlar-2026.xlsx");
      if (b.created !== 3) throw new Error(`gün B: ${b.created} kart açıldı (beklenen 3) ${JSON.stringify(b.skipped)}`);
      unlocked = await readS127Facts(api);
    } finally {
      await server.close();
    }
    const unlockedDir = path.join(root, "kilitsiz");
    cpSync(dataDir, path.join(unlockedDir, "data"), { recursive: true });
    cpSync(backupDir, path.join(unlockedDir, "backups"), { recursive: true });
    const packedUnlocked = packFixture({ name: S127_FIXTURE_UNLOCKED, dataDir: path.join(unlockedDir, "data"), backupDir: path.join(unlockedDir, "backups"), manifest: { cut: S127_TAG, commit, now: S127_DAY_B, lockedUntil: "", cards: S127_CARDS, oncesi: unlocked } });
    log(`${S127_FIXTURE_UNLOCKED}: ${packedUnlocked.files} dosya, ${packedUnlocked.bytes} bayt`);
    // Kilit (v2.4.9'da): 31.12.2025.
    server = await bootVersion(S127_TAG, { dataDir, backupDir, now: { time: S127_DAY_B, fixed: true } });
    let locked;
    try {
      const api = await server.login();
      await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: S127_LOCK }));
      locked = await readS127Facts(api);
    } finally {
      await server.close();
    }
    const packed = packFixture({ name: S127_FIXTURE, dataDir, backupDir, manifest: { cut: S127_TAG, commit, now: S127_DAY_B, lockedUntil: S127_LOCK, cards: S127_CARDS, oncesi: locked } });
    log(`${S127_FIXTURE}: ${packed.files} dosya, ${packed.bytes} bayt · v2.4.9 mizan 120 ${locked.mizan["120"] / 100} · Mutabakat Testi ${locked.mutabakat.ok}`);
    return { unlocked, locked };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await produce();
