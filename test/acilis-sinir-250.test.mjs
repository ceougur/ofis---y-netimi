// 2.5.0 Ç5-A tur 1e — İş 4 (dar kontrol DÜŞÜK-1): yaşayan üç mutantı öldüren testler (kod DEĞİŞMEDİ; yalnız eksik test). Her biri bir kuralın SINIRINI dener:
//   A1 — S127 = A ("bir olay tek kez yazılır"; KULLANICI KARARI 11.11.2026): eski kurallı bölge (from, through] — Kayıt Tarihi TAM KİLİT GÜNÜ olan, kilitten sonra yüklenmiş kart
//        da eski kurala bağlıdır (bölge "<=" ile biter; "<" olursa kart kilitli yılın donmuş defterinde ve açık dönemde iki kez yazılır → 120 ≠ cariler).
//   A8 — carisiz evrak Alacak Yaşlandırması'na girmez (BAŞ MİMAR 11.11; S49 = A + MM5) AMA taksit kartına sayılmış carisiz evrak KALIR: kartın alacağı evrakın içine geçer,
//        yaşlandırmanın toplamı değişmez (alacak raporu terk etmez).
//   A16 — göç 49: evrak açılış işaretini yalnız İLK olayının notu "Açılış portföyü (Excel/Sheets)" ise alır (B4); sonradan bir olayına aynı not yazılmış formdan evrak açılış DEĞİL.
// Veri: A1 ve A16 v2.4.9'un GERÇEK koduyla API'den (test/guvenilirlik/surumler.mjs; ders 17, 23); kâhin A1'de v2.4.9'un kendi cari bakiyeleri. A8 güncel kodla (kural güncel kodun).
// Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { readS127Facts } from "./guvenilirlik/s127-v249-veri.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
const must = async (label, call) => {
  const r = await call;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data?.data ?? r.data;
};
const dirsOf = prefix => {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  return { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
};
const money = cell => {
  const text = String(cell ?? "").replace(/\s|TL/g, "").replace(/−/g, "-");
  return text ? Math.round(Number(text.replace(/\./g, "").replace(",", ".")) * 100) : 0;
};

describe("A1 — S127: Kayıt Tarihi tam kilit günü olan, kilitten sonra yüklenmiş kart eski kurala bağlı (bir kez yazılır)", { skip: SKIP }, () => {
  const LOCK = "2025-12-31";
  const DAY = { time: "2026-11-10T12:00:00+03:00", fixed: true };
  let dirs = null;
  let server = null;
  let oracle = null;
  before(async () => {
    dirs = dirsOf("c5a1e-a1-");
    const old = await bootVersion("v2.4.9", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: DAY });
    try {
      const api = await old.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      await must("cari", api.post("/api/workspace/accounts", { name: "Sınır Müşteri", registeredOn: "2025-01-02", openingBalance: "1.000", openingSide: "auto" }));
      const roles = { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" };
      const done = await must("Excel kartları", api.post("/api/workspace/plans/import", {
        matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], ["Kilit Günü Kartı", "1200", "6", "15.02.2026", "300", "31.12.2025"], ["Kilit Günü Sıfır", "800", "4", "15.02.2026", "0", "31.12.2025"]],
        headerAt: 0, roles, fileName: "sinir.xlsx", linkRecords: false,
      }));
      assert.equal(done.created, 2, `v2.4.9 iki kart açtı: ${JSON.stringify(done.skipped || done).slice(0, 300)}`);
      await must("kilit (v2.4.9)", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      oracle = await readS127Facts(api);
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: DAY, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
  }, { timeout: 180_000 });
  after(async () => {
    await server?.close().catch(() => {});
    dirs?.cleanup();
  });

  it("v2.4.9'un kendi sayıları (kâhin): 120 = cariler, kilit kilit gününde", () => {
    assert.equal(oracle.lock, LOCK);
    assert.equal(oracle.mizan["120"], Object.values(oracle.cari).reduce((sum, value) => sum + value, 0));
  });

  it("güncel kod: cariler v2.4.9 ile aynı; mizan 120 = cariler (kart iki kez yazılmaz); kartın maddesi Kayıt Tarihi'nde (kilit günü — eski yapı)", async () => {
    assert.equal(server.app.ledger.snapshots.state().coverage, LOCK, "ön koşul: kilitli yıl donmuş");
    const api = await server.login();
    const now = await readS127Facts(api);
    assert.deepEqual(now.cari, oracle.cari, "cari bakiyeleri v2.4.9 ile aynı");
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0), `mizan 120 = cariler (S127 = A): ${JSON.stringify(now.mizan)}`);
    const entries = server.app.ledger.build();
    for (const name of ["Kilit Günü Kartı", "Kilit Günü Sıfır"]) {
      const id = server.app.store.get("SELECT id FROM plans WHERE name = ?", name).id;
      const entry = entries.find(item => item.id === `plan:${id}`);
      assert.equal(entry?.date, LOCK, `${name}: eski yapıya bağlı — madde Kayıt Tarihi'nde (kilit günü), yükleme gününde DEĞİL: ${JSON.stringify(entry && { date: entry.date, cls: entry.cls })}`);
    }
  });
});

describe("A8 — taksit kartına sayılmış carisiz evrak Alacak Yaşlandırması'nda KALIR (kartın alacağı evrağa geçer; toplam değişmez)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer({ now: { time: "2026-11-20T12:00:00+03:00", fixed: true } });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  const total = async () => {
    const report = await must("Alacak Yaşlandırma", admin.get("/api/workspace/report-center/alacak-yaslandirma"));
    const column = report.headers.indexOf("Toplam");
    const sum = report.rows.reduce((acc, row) => acc + money(row[column]), 0);
    assert.equal(money(report.footer[column]), sum, "TOPLAM = satırlar");
    return sum;
  };

  // Taksite sayılmış CARİSİZ evrak bugünkü yollarla (ve v2.0.26'da) doğmuyor: kart açılırken cari açılır, karta sayılan evrak kartın carisini alır (c5a1e not defterinde a8.mjs ile
  // denendi). Dal eski / dışarıdan yazılmış veri içindir: durum evrağın carisi ayrı bağlantıyla boşaltılarak kurulur (EK DENETİM — programın ürettiği veri değil; kâhin: kartın
  // alacağı evrağa geçer, yaşlandırmanın toplamı kart tutarıdır).
  it("kart 900 → karta sayılan çek 400, evrağın carisi boş (eski veri): yaşlandırmanın toplamı aynı (900) — evrak raporda KALIR", async () => {
    const plan = await must("kart", admin.post("/api/workspace/plans", { name: "Kartlı Keşideci", total: "900" }));
    const before = await total();
    assert.equal(before, 90000, "ön koşul: kartın alacağı yaşlandırmada");
    const cheque = await must("karta sayılan çek", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "A8-1", bank: "Akbank", drawer: "Kartlı Keşideci", planId: plan.id, amount: "400", issueDate: "2026-11-10", dueDate: "2027-01-15" }));
    const id = cheque.id || cheque.cheque?.id;
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE cheque_id = ?", id).n, 1, "ön koşul: evrak kartın taksitine sayıldı");
    assert.equal(await total(), before, "carili hâlde de toplam aynı");
    const other = new DatabaseSync(server.app.store.get("PRAGMA database_list").file);
    try {
      other.exec("PRAGMA busy_timeout = 5000");
      assert.equal(other.prepare("UPDATE cheques SET account_id = '' WHERE id = ?").run(id).changes, 1);
    } finally {
      other.close();
    }
    assert.equal(server.app.store.get("SELECT account_id AS a FROM cheques WHERE id = ?", id).a, "", "ön koşul: evrak carisiz, taksite sayılı");
    assert.equal(await total(), before, "taksite sayılı carisiz evrak yaşlandırmada KALIR (toplam = kart tutarı)");
  });
});

describe("A16 — göç 49: evrak açılış işaretini yalnız İLK olayının notundan alır", { skip: SKIP }, () => {
  it("v2.4.9: Excel açılış portföyü evrakı → işaretli; formdan alınıp sonraki olayına aynı not yazılmış evrak → işaretsiz", { timeout: 180_000 }, async () => {
    const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
    const NOTE = "Açılış portföyü (Excel/Sheets)";
    const dirs = dirsOf("c5a1e-a16-");
    let current = null;
    try {
      const old = await bootVersion("v2.4.9", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW });
      try {
        const api = await old.login();
        await api.post("/api/workspace/bank/setup/dismiss", {});
        const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
        await must("Excel portföy", api.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "EP-16", "Akbank", "Eski Borçlu", "70", "15.12.2026", "01.02.2026"]], headerAt: 0, roles, fileName: "portfoy.xlsx" }));
        const form = await must("formdan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "F-16", bank: "Akbank", drawer: "Form Keşideci", amount: "90", issueDate: "2026-10-01", dueDate: "2026-10-15" }));
        const formId = form.id || form.cheque?.id || old.app.store.get("SELECT id FROM cheques WHERE serial_no = 'F-16'").id;
        await must("tahsil (notu portföy notuyla aynı)", api.post(`/api/workspace/cheques/${formId}/actions`, { action: "collect", date: "2026-10-16", method: "cash", note: NOTE }));
        const events = old.app.store.all("SELECT ev.note FROM cheque_events ev WHERE ev.cheque_id = ? ORDER BY ev.rowid", formId).map(row => row.note);
        assert.ok(events.length >= 2 && events[0] !== NOTE && events.slice(1).includes(NOTE), `ön koşul: formdan evrakın ilk olayı portföy notu DEĞİL, sonraki olayı o not: ${JSON.stringify(events)}`);
      } finally {
        await old.close();
      }
      current = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false });
      const flag = serial => current.app.store.get("SELECT is_opening AS v FROM cheques WHERE serial_no = ?", serial).v;
      assert.equal(flag("EP-16"), 1, "Excel açılış portföyü: işaretli (göç 49)");
      assert.equal(flag("F-16"), 0, "formdan evrak: sonraki olayının notu yüzünden açılış OLMAZ (ilk olay şartı)");
    } finally {
      await current?.close().catch(() => {});
      dirs.cleanup();
    }
  });
});
