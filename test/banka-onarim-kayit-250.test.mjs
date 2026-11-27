// 2.5.0 Ç2 TUR 3 — YAN BULGU 2 (ORTA; v2.4.9 üretim kodunda da): banka açılış onarımının Mutabakat Günlüğü kaydı (server/lib/bank/repair.mjs) kesilmiş JSON olmaz.
// Senaryo (dar kontrol bank-kesik; burada eski sürümün GERÇEK kodu): güncel sürümde 600 tahsilat → kullanıcı 2.0.26'ya döner ve "Tüm Hareketleri Sil" yapar (2.0.26 işlem başlıklarını —
// fin_events — bilmez, silmez) → güncel sürüm açılışında onarım 600 başlığı iptal eder. Önceki kayıt `JSON.stringify({ ...report }).slice(0, 20000)` → geçersiz JSON → Mutabakat Testi
// (routes/ledger.mjs günlüğü JSON.parse eder) HTTP 500: defter / mutabakat görünmez. Yeni kural (lib/log-detail.mjs boundedDetail): rapor dizileri ilk 50 öğe, tam sayılar `counts`'ta.
// Tam rapor meta.bank.repair ayarında (değişmedi; zil ve Banka modülü onu okur).
// Saat SAHTE ve sabit (güncel sürüm; ders 13, 22); 2.0.26 sahte saati tanımaz (gerçek saatle sıfırlar — onarım bundan etkilenmez). Gerçek dış servis yok (ders 30).
// WINDOWS (ders 48): aynı veri klasörü iki sürümle açılır; 2.0.26 sıfırlamadan önce zorunlu yedek alır (dosya kopyası).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const N = 600;
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data.data;
};
const withServer = async (dirs, time, fn) => {
  const server = await startTestServer({ now: { time, fixed: true }, ...dirs });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};

describe("Ç2 tur 3 — YAN BULGU 2: banka açılış onarımının kaydı kesilmiş JSON olmaz (2.0.26'ya dönüp Tüm Hareketleri Sil → 600 iptal başlığı)", () => {
  const skip = tagsAvailable(["v2.0.26"]) ? false : "v2.0.26 etiketi yok (git fetch --tags)";
  it(`${N} tahsilat → GERÇEK 2.0.26 'Tüm Hareketleri Sil' → güncel açılış: ${N} başlık iptal; kayıt geçerli JSON (ilk 50 + counts); Mutabakat Testi 200; ikinci açılışta kayıt yinelenmez`, { skip, timeout: 600_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "banka-onarim-kayit-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    try {
      await withServer(dirs, "2027-01-10T10:00:00+03:00", async server => {
        const admin = await loginAdmin(server);
        const account = await must("cari", admin.post("/api/workspace/accounts", { name: "İptal Cari", type: "customer", registeredOn: "2026-12-01" }));
        for (let i = 0; i < N; i += 1) await must(`tahsilat ${i}`, admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" }));
        assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'").n, N, "ön koşul: her tahsilatın etkin işlem başlığı");
      });
      {
        const old = await bootVersion("v2.0.26", dirs);
        try {
          const api = await old.login();
          const reset = await api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
          assert.equal(reset.status, 200, `v2.0.26 Tüm Hareketleri Sil: ${reset.status} ${JSON.stringify(reset.data).slice(0, 300)}`);
          assert.equal(old.app.store.get("SELECT COUNT(*) AS n FROM account_entries").n, 0, "2.0.26 hareketleri sildi");
          assert.equal(old.app.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'").n, N, "2.0.26 işlem başlıklarını bilmez (silmedi)");
        } finally {
          await old.close();
        }
      }
      let first = "";
      for (const turn of [1, 2]) {
        await withServer(dirs, turn === 1 ? "2027-01-10T12:00:00+03:00" : "2027-01-10T12:30:00+03:00", async server => {
          const store = server.app.store;
          assert.deepEqual([store.get("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'").n, store.get("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'cancelled'").n], [0, N], `açılış ${turn}: başlıklar iptal`);
          const rows = store.all("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = '' ORDER BY rowid");
          assert.equal(rows.length, 1, `açılış ${turn}: tek onarım kaydı (onarım tek seferlik)`);
          assert.match(rows[0].summary, new RegExp(`iptal edilen işlem başlığı ${N}`));
          assert.ok(rows[0].detail.length <= 20_000, `${rows[0].detail.length} karakter`);
          let detail;
          try {
            detail = JSON.parse(rows[0].detail);
          } catch (error) {
            assert.fail(`onarım kaydının ayrıntısı geçerli JSON değil (${rows[0].detail.length} karakter, sonu ${JSON.stringify(rows[0].detail.slice(-40))}): ${error.message}`);
          }
          if (turn === 1) {
            // meta.bank.repair her açılışta o açılışın raporuyla yazılır (ikinci açılışta boş rapor) — tam liste ilk açılışta okunur.
            const full = JSON.parse(store.get("SELECT value FROM settings WHERE key = 'meta.bank.repair'").value);
            assert.equal(full.cancelledEvents.length, N, "tam rapor (meta.bank.repair, değişmedi): bütün iptal başlıkları");
            assert.deepEqual(detail.cancelledEvents, full.cancelledEvents.slice(0, 50), "kayıtta ilk 50 başlık");
            assert.equal(detail.at, full.at);
            first = rows[0].detail;
          } else assert.equal(rows[0].detail, first, "ikinci açılış kaydı değiştirmedi");
          assert.deepEqual(detail.counts, { undoneMatches: 0, voidedSales: 0, cancelledEvents: N, clearedRefs: 0, refreshedEvents: 0, closedCollections: 0, reopenedCollections: 0, pending: 0 }, "tam sayılar");
          assert.equal("unassignedIds" in detail, false, "Hesabı Belirsiz kimlik listesi kayda yazılmaz (önceki gibi)");
          const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));
          assert.equal(scan.log.find(row => row.action === "repair" && row.tables === "")?.detail?.counts?.cancelledEvents, N, "kayıt Mutabakat Testi'nin günlüğünde ayrıştırılmış");
          assert.equal((await (await loginAdmin(server)).get("/api/workspace/report-center/mutabakat-gunlugu")).status, 200, "Mutabakat Günlüğü raporu");
        });
      }
    } finally {
      removeTestDir(root);
    }
  });
});
