// 2.4.3 göç v29 (iade e-Belgesinde asıl faturanın e-Belge referansı, MM1) — ESKİ SÜRÜMÜN GERÇEK KODUYLA üretilen veri (test kuralı): v2.4.2 etiketi
// açılır, API'sinden e-Fatura alışı ve iadesi (Kes, Sonra Gönder) ile kâğıt alış girilir; aynı veri dosyası güncel kodla açılır.
// Beklenen: göç yalnız ekleyici (kolon boş = asıl faturanın numarası; bugünkü davranış), faturalar aynı, eski iadenin UBL'i asıl numarayı taşır,
// Mutabakat Testi temiz; kâğıt asıllı iade referansla kesilir. Geri dönüş: v2.4.2 göçlü dosyayı açıp yazar; referans silinmez.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { OUR_VKN, SUPPLIER_VKN, vkn } from "./einvoice-mock.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.2";
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };

describe(`göç v29: ${OLD} verisi güncel kodla açılır (iade e-Belge referansı)`, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-243-iade-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("eski iade referanssız (asıl numara), faturalar aynı; kâğıt asıllı iade referansla kesilir; Mutabakat Testi temiz; geri dönüşte referans kalır", async () => {
    const ids = {};
    let before;
    const old = await bootVersion(OLD, dirs);
    try {
      const api = await old.login();
      const ok = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        return res.data;
      };
      await ok("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
      await ok("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true }));
      const supplier = await ok("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", taxNo: SUPPLIER_VKN, taxOffice: "Kadıköy", address: "Bağdat Cd. 7", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@toptanci.com.tr" }));
      const paper = await ok("kâğıt tedarikçi", api.post("/api/workspace/accounts", { name: "Kâğıtçı Ltd.", type: "supplier", taxNo: vkn(444555666), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" }));
      ids.paperSupplier = paper.id;
      const ePurchase = await ok("e-Fatura alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "TPT2026000000123", profile: "TEMELFATURA", lines: [{ name: "Toner", qty: 5, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
      const back = await ok("iade", api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: ePurchase.id, lines: [{ originLineId: ePurchase.lines[0].id, qty: 1 }], payment: {}, eSend: "later" }));
      ids.back = back.id;
      const paperPurchase = await ok("kâğıt alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: paper.id, number: "A 004512", profile: "KAGIT", lines: [{ name: "Kağıt", qty: 10, unitPrice: 50, vatRate: 20, goods: true }], payment: { rest: "open" } }));
      ids.paperPurchase = paperPurchase.id;
      ids.paperLine = paperPurchase.lines[0].id;
      const refused = await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: paperPurchase.id, lines: [{ originLineId: paperPurchase.lines[0].id, qty: 1 }], payment: {} });
      assert.equal(refused.status, 400, `${OLD}: kâğıt asıllı iade kesilemiyordu (MM1 ön koşulu)`);
      before = old.app.store.get("SELECT COUNT(*) AS n, SUM(try_payable) AS total FROM invoices");
      assert.equal(old.app.store.all("PRAGMA table_info(invoices)").some(column => column.name === "return_ref"), false, `${OLD} şemasında kolon yok`);
    } finally {
      await old.close();
    }

    const current = await bootVersion(CURRENT, dirs);
    try {
      const api = await current.login();
      assert.equal(current.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      assert.ok(LATEST_VERSION >= 29);
      assert.deepEqual(current.app.store.get("SELECT COUNT(*) AS n, SUM(try_payable) AS total FROM invoices"), before, "faturalar aynı");
      assert.deepEqual([...new Set(current.app.store.all("SELECT return_ref AS r FROM invoices").map(row => row.r))], [""], "eski faturalarda referans boş");
      const back = (await api.get(`/api/workspace/invoices/${ids.back}`)).data;
      assert.equal(back.returnRef, "");
      const ubl = await api.get(`/api/workspace/invoices/${ids.back}/ubl.xml`);
      const xml = typeof ubl.data === "string" ? ubl.data : ubl.text;
      assert.match(xml, /<cac:InvoiceDocumentReference><cbc:ID>TPT2026000000123<\/cbc:ID>/, "eski iade asıl numarayı taşır (davranış aynı)");
      const made = await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: ids.paperPurchase, lines: [{ originLineId: ids.paperLine, qty: 1 }], payment: {}, returnRef: "A000000000004512", eSend: "later" });
      assert.equal(made.status, 200, JSON.stringify(made.data).slice(0, 300));
      ids.made = made.data.id;
      assert.equal(made.data.returnRef, "A000000000004512");
      const integrity = await api.get("/api/workspace/ledger/integrity");
      assert.equal(integrity.status, 200);
      assert.deepEqual(integrity.data.failures, [], JSON.stringify(integrity.data.failures).slice(0, 400));
    } finally {
      await current.close();
    }

    // Güncellemeden geri dönüş: v2.4.2 göçlü dosyayı açar; kolonu bilmeden listeler; yeni sürümün yazdığı referans silinmez.
    const backOld = await bootVersion(OLD, dirs);
    try {
      const api = await backOld.login();
      const list = await api.get("/api/workspace/invoices?tab=purchase");
      assert.equal(list.status, 200);
      assert.equal((await api.get(`/api/workspace/invoices/${ids.made}`)).status, 200);
    } finally {
      await backOld.close();
    }
    const again = await bootVersion(CURRENT, dirs);
    try {
      assert.equal(again.app.store.get("SELECT return_ref AS r FROM invoices WHERE id = ?", ids.made).r, "A000000000004512");
      const api = await again.login();
      assert.deepEqual((await api.get("/api/workspace/ledger/integrity")).data.failures, []);
    } finally {
      await again.close();
    }
  });
});
