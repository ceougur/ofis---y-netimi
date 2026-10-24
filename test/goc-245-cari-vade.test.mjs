// 2.4.5 madde 6 (K6.4) — ESKİ SÜRÜM VERİSİYLE göç (test kuralı: veri eski sürümün GERÇEK koduyla, API'sinden üretilir; ders 17):
//   v2.4.4 (gerçek kod, git etiketi): açılış bakiyeli müşteri, elle Borç Yaz, tahsilat, taksitsiz satış faturası, tedarikçi açılışı; bir borç Silinenler'e.
//   Güncel kod aynı veri klasöründe: göç v33 kolonları boş ekler; bakiye ve fatura açıkları v2.4.4 ile AYNI; cari kalemi yok (tarih girilmedi); Kalan
//   fatura kapamasının kuyruğundan; v2.4.4'te silinen borç (yükünde vade alanı yok) boş tarihlerle geri gelir; eski borca vade verilince kalem doğar.
// Sahte durağan saat (ders 13); ders 30 lisans adresi.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.4";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};

describe("2.4.5 madde 6 göç: v2.4.4 verisi güncel kodla (Vade Tarihi / Beklenen Ödeme Tarihi boş, Kalan aynı kuyruktan)", { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-245-vade-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("v2.4.4 verisi: göç boş alan ekler, bakiye ve faturalar aynı, kalem yok; eski borca vade verilince kalem doğar", async () => {
    const clock = createClock({ time: `${TODAY}T12:00:00+03:00`, fixed: true });
    const ok = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    const ids = {};
    const before = {};
    const old = await bootVersion(OLD, { ...dirs, now: clock });
    try {
      const api = await old.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const item = await ok("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-G", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
      const customer = await ok("müşteri", api.post("/api/workspace/accounts", { name: "Göç Müşteri", type: "customer", registeredOn: day(-60), openingBalance: "1.000" }));
      ids.customer = customer.id;
      await ok("borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "600", date: day(-40), note: "eski borç" }));
      const doc = await ok("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: day(-30), lines: [{ itemId: item.id, qty: 1, unitPrice: 2000, vatRate: 0 }], payment: { rest: "open", dueDate: day(-30) } }));
      ids.invoice = doc.id;
      await ok("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "1.300", date: day(-20), method: "cash" }));
      const doomed = await ok("silinecek borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "50", date: day(-10), note: "silinen eski borç" }));
      ids.doomed = doomed.entries.find(row => row.note === "silinen eski borç").id;
      await ok("borcu sil", api.del(`/api/workspace/accounts/${customer.id}/entries/${ids.doomed}`));
      const supplier = await ok("tedarikçi", api.post("/api/workspace/accounts", { name: "Göç Tedarikçi", type: "supplier", registeredOn: day(-60), openingBalance: "700" }));
      ids.supplier = supplier.id;
      const card = await ok("kart", api.get(`/api/workspace/accounts/${customer.id}`));
      before.balance = card.totals.balance;
      before.entries = card.entries.map(row => [row.id, row.kind, row.amount, row.date]);
      before.open = (await ok("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`))).open;
      before.supplierBalance = (await ok("tedarikçi kart", api.get(`/api/workspace/accounts/${supplier.id}`))).totals.balance;
      // Ön koşul (kâhin değil): 2.4.4'ün yazdığı biçim — vade alanı yok, Kalan yok.
      assert.equal("dueDate" in card.entries[0], false);
      assert.equal("remaining" in card.entries[0], false);
      assert.equal(old.app.store.all("PRAGMA table_info(account_entries)").some(column => column.name === "due_date"), false);
    } finally {
      await old.close();
    }

    const current = await bootVersion(CURRENT, { ...dirs, now: clock });
    try {
      const api = await current.login();
      assert.equal(current.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      const dated = current.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE due_date <> '' OR expected_date <> ''").n;
      assert.equal(dated, 0, "eski satırlar boş");
      const card = await ok("kart", api.get(`/api/workspace/accounts/${ids.customer}`));
      assert.equal(card.totals.balance, before.balance, "bakiye v2.4.4 ile aynı");
      assert.deepEqual(card.entries.map(row => [row.id, row.kind, row.amount, row.date]), before.entries, "hareketler aynı");
      assert.ok(card.entries.every(row => row.dueDate === "" && row.expectedDate === ""));
      assert.equal((await ok("fatura", api.get(`/api/workspace/invoices/${ids.invoice}`))).open, before.open, "fatura açığı v2.4.4 ile aynı (aynı kapama)");
      // Kalan (S1): açılış 1.000 (−60) ve borç 600 (−40) faturadan (−30) eski; 1.300 tahsilat önce açılışı, sonra 300'ünü borçtan kapatır.
      const opening = card.entries.find(row => row.id === card.openingEntryId);
      const debt = card.entries.find(row => row.note === "eski borç");
      assert.deepEqual([opening.remaining, debt.remaining], [0, 300]);
      assert.equal(before.open, 2000, "fatura dokunulmadı (tahsilat daha eski borçları kapattı)");
      assert.equal((await ok("tedarikçi", api.get(`/api/workspace/accounts/${ids.supplier}`))).totals.balance, before.supplierBalance);
      const dues = await ok("takvim", api.get("/api/workspace/dues"));
      assert.equal(dues.items.some(row => row.source === "account"), false, "tarih girilmeden kalem yok");
      // v2.4.4'te silinen borç: yükünde vade alanı yok → boş tarihlerle döner.
      const trash = await ok("Silinenler", api.get("/api/admin/trash"));
      await ok("geri yükle", api.post("/api/admin/trash/restore", { id: trash.find(row => row.kind === "account-entry" && row.ref === ids.doomed).id }));
      const restored = current.app.store.get("SELECT amount, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE id = ?", ids.doomed);
      assert.deepEqual({ ...restored }, { amount: 50, dueDate: "", expectedDate: "" });
      // Eski borca Beklenen Ödeme Tarihi verilince kalem doğar (Kalan 300).
      await ok("söz", api.put(`/api/workspace/accounts/${ids.customer}/entries/${debt.id}`, { kind: "debt", amount: "600", date: day(-40), expectedDate: day(2) }));
      const after_ = await ok("takvim 2", api.get("/api/workspace/dues"));
      const item = after_.items.find(row => row.source === "account");
      assert.deepEqual([item.entryId, item.amount, item.dueDate, item.label], [debt.id, 300, day(2), "Tahsil Edilecek Borç (Ödeme Sözü)"]);
      // Tedarikçinin eski açılışına Düzenle'den vade.
      const supplier = await ok("tedarikçi kart", api.get(`/api/workspace/accounts/${ids.supplier}`));
      await ok("Düzenle", api.put(`/api/workspace/accounts/${ids.supplier}`, { name: supplier.name, type: supplier.type, registeredOn: supplier.registeredOn, updatedAt: supplier.updatedAt, openingDueDate: day(-1) }));
      const owed = (await ok("takvim 3", api.get("/api/workspace/dues"))).items.find(row => row.source === "account" && row.accountId === ids.supplier);
      assert.deepEqual([owed.direction, owed.label, owed.amount, owed.state], ["out", "Ödenecek Borç", 700, "overdue"]);
    } finally {
      await current.close();
    }
  });
});
