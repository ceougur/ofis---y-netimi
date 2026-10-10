// 2.1.0 — Aşama 2, Dilim 2: İşlem No (docs/BANKA-MODULU-PLAN.md §5.4, §5.6, §12.3 Aşama 2 "Sıfırlama sonrası ilk İşlem No
// öncekinden büyük").
// Her para olayı bir İşlem No alır: BNK-<yıl>-<6 hane sıra> (yıl, olayın tarihinin yılı). Sayaç settings'te
// meta.bank.seq.<yıl>; numara işlemin içinde max(sayaç, o yılın en büyük sırası) + 1 ile verilir ve sayaç aynı işlemde yazılır.
// "meta." öneki sıfırlamada korunur: Tüm Hareketleri Sil / Tümünü Sıfırla'dan sonra numara yeniden kullanılmaz (basılı belgeler,
// eski yedekteki numaralar çakışmaz).
//
// ÇALIŞIYOR MU: ardışık numara; yıl dönümünde yeni yıl 000001'den; yeniden başlatmadan sonra sürer; 002'nin sayacı ayrı.
// NASIL BOZARIM
//  - İşlem dışında numara istemek → hata (iki yazıcı aynı numarayı alamasın: BEGIN IMMEDIATE içinde verilir).
//  - Bozuk tarih → 400. 999.999'dan sonra numara kırpılmaz (BNK-2026-1000000).
//  - Olaylar silinse de (ya da sıfırlansa da) numara geri gitmez; sayaç silinse (ör. elle) en büyük sıradan sürer.
//  - Numara alan işlem geri alınırsa sayaç da geri alınır (boşluk değil, aynı numara yeniden verilir; hiçbir yere basılmadı).
//  - Aynı yıl + sıra ikinci kez yazılamaz (tekil indeks).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createStore } from "../server/lib/db.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let lib = null;
const load = async () => {
  try {
    lib = await import(pathToFileURL(path.join(ROOT, "server/lib/bank/event-no.mjs")).href);
  } catch {
    lib = null;
  }
  return lib;
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const T0 = "2026-10-08T09:00:00.000Z";

// Bir işlem başlığı yazar (bank.post sonraki dilimde; burada numaralamanın kendisi sınanır).
function record(store, date) {
  return store.tx(() => {
    const number = lib.nextEventNo(store, date);
    store.run("INSERT INTO fin_events (id, year, seq, no, type, date, created_by, created_at) VALUES (?, ?, ?, ?, 'bank_fee', ?, 'test', ?)", `ev-${number.no}`, number.year, number.seq, number.no, date, T0);
    return number;
  });
}

describe("İşlem No (meta.bank.seq.<yıl>)", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "banka-210-islem-no-"));
  let server;
  let admin;
  const boot = async () => {
    server = await startTestServer({ dataDir, now: "2026-10-08T12:00:00+03:00" });
    admin = await loginAdmin(server);
  };
  before(async () => {
    await load();
    await boot();
  });
  after(async () => {
    await server?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("kütüphane var; biçim BNK-<yıl>-<6 hane>; 999.999'dan sonra kırpılmaz", () => {
    assert.ok(lib, "server/lib/bank/event-no.mjs yok");
    assert.equal(lib.eventNoText(2026, 123), "BNK-2026-000123");
    assert.equal(lib.eventNoText(2027, 1), "BNK-2027-000001");
    assert.equal(lib.eventNoText(2026, 1_000_000), "BNK-2026-1000000");
  });

  it("ardışık numara; sayaç aynı işlemde yazılır", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    assert.deepEqual(record(store, "2026-10-08"), { year: 2026, seq: 1, no: "BNK-2026-000001" });
    assert.deepEqual(record(store, "2026-10-07"), { year: 2026, seq: 2, no: "BNK-2026-000002" });
    assert.equal(store.setting("meta.bank.seq.2026", ""), "2");
  });

  it("işlem dışında numara istenemez; bozuk tarih 400", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    assert.throws(() => lib.nextEventNo(store, "2026-10-08"), /işlem/i);
    assert.throws(() => store.tx(() => lib.nextEventNo(store, "2026-02-30")), error => error.status === 400);
    assert.throws(() => store.tx(() => lib.nextEventNo(store, "")), error => error.status === 400);
  });

  it("yıl olayın tarihinden: geçen yılın olayı kendi sırasıyla 000001'den; bu yıl sürer", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    assert.equal(record(store, "2025-12-31").no, "BNK-2025-000001");
    assert.equal(record(store, "2026-01-02").no, "BNK-2026-000003");
  });

  it("geri alınan işlemin numarası yeniden verilir (sayaç da geri alınır); aynı yıl + sıra ikinci kez yazılamaz", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    assert.throws(() => store.tx(() => {
      assert.equal(lib.nextEventNo(store, "2026-10-08").seq, 4);
      throw new Error("vazgeç");
    }), /vazgeç/);
    assert.equal(store.setting("meta.bank.seq.2026", ""), "3", "sayaç geri alındı");
    assert.equal(record(store, "2026-10-08").seq, 4);
    assert.throws(() => store.tx(() => store.run("INSERT INTO fin_events (id, year, seq, no, type, date, created_by, created_at) VALUES ('dup', 2026, 4, 'X', 'bank_fee', '2026-10-08', 't', ?)", T0)), /UNIQUE/);
  });

  it("olaylar silinse de numara geri gitmez; sayaç silinse en büyük sıradan sürer", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    // K6 (c, dilim 3): işlem başlığını bank.post dışından silmek yalnız store.raw kapsamında (test: elle silinmiş olay).
    store.raw("test: olay silme", () => store.tx(() => store.run("DELETE FROM fin_events WHERE year = 2026 AND seq = 4")));
    assert.equal(record(store, "2026-10-08").seq, 5, "silinen 4 yeniden verilmez");
    store.tx(() => store.run("DELETE FROM settings WHERE key = 'meta.bank.seq.2026'"));
    assert.equal(record(store, "2026-10-08").seq, 6, "sayaç yoksa en büyük sıra + 1");
    store.setSetting("meta.bank.seq.2026", "999999");
    assert.equal(record(store, "2026-10-08").no, "BNK-2026-1000000");
  });

  it("Tüm Hareketleri Sil ve Tümünü Sıfırla'dan sonra ilk İşlem No öncekinden büyük; yeniden başlatmadan sonra da", async () => {
    assert.ok(lib, "kütüphane yok");
    const last = server.app.store.get("SELECT MAX(seq) AS n FROM fin_events WHERE year = 2026").n;
    for (const mode of ["movements", "all"]) {
      const reset = await admin.post("/api/companies/sirket-001/reset", { mode, confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data).slice(0, 200));
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM fin_events").n, 0, `${mode}: işlem başlıkları silindi`);
      const next = record(server.app.store, "2026-10-08");
      assert.ok(next.seq > last, `${mode}: sıfırlamadan sonra ${next.no}, önceki son ${last}`);
    }
    const before = server.app.store.get("SELECT MAX(seq) AS n FROM fin_events WHERE year = 2026").n;
    await server.close();
    await boot();
    assert.equal(record(server.app.store, "2026-10-08").seq, before + 1, "yeniden başlatmadan sonra sürer");
  });

  it("şirketlerin sayacı ayrı (her şirketin kendi veri tabanı)", async () => {
    assert.ok(lib, "kütüphane yok");
    const created = unwrap(await admin.post("/api/companies", { code: "002", name: "İkinci Şirket" }));
    assert.equal((await admin.post("/api/companies/select", { id: created.company.id })).status, 200);
    assert.equal((await admin.get("/api/workspace/accounts?limit=1")).status, 200); // 002'nin örneği açılır
    // Açık örneğin veri tabanı bağlantısı (withCompanyDb açık örneğinkini verir).
    const store002 = server.app.context.withCompanyDb(server.app.companies.get(created.company.id), db => createStore(db));
    assert.equal(record(store002, "2026-10-08").no, "BNK-2026-000001", "002 kendi sırasıyla başlar");
    assert.ok(record(server.app.store, "2026-10-08").seq > 1, "001'in sırası sürer");
    assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
  });

  it("yıl dönümü (sahte saat 01.01.2027): yeni yıl 000001'den; 31.12.2026 tarihli olay 2026 sırasından", () => {
    assert.ok(lib, "kütüphane yok");
    const store = server.app.store;
    const last2026 = store.get("SELECT MAX(seq) AS n FROM fin_events WHERE year = 2026").n;
    server.clock.set("2027-01-01T10:00:00+03:00");
    assert.equal(record(store, "2027-01-01").no, "BNK-2027-000001");
    assert.equal(record(store, "2026-12-31").seq, last2026 + 1);
    assert.equal(record(store, "2027-01-01").no, "BNK-2027-000002");
  });
});
