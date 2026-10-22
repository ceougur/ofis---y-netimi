// 2.4.4 madde 23 — iptal süresi ESKİ SÜRÜM VERİSİYLE (test kuralı, ders 17): v2.4.3 etiketinin GERÇEK kodu açılır, API'sinden e-Arşiv faturalar kesilip
// sahte EDM'ye gönderilir (sahte saat: kesim 0. gün, gönderim 0. ve 3. gün); aynı veri dosyası güncel kodla açılır.
// Beklenen (GİB kılavuzu §3 + TBK 92, KAYNAK.md): 2.4.3'ün yazdığı gönderim kaydı iletim günüdür → 3. gün gönderilen belge 11. gün iptal edilir,
// 0. gün gönderilen belge 11. gün reddedilir (son gün 8). Geri dönüş: v2.4.3 aynı dosyayı açar ve kendi kuralıyla (kesimden) 11. günde reddeder —
// davranış farkı eski kodun kendisiyle gösterilir; şema değişmediği için eski sürüm dosyayı sorunsuz okur.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { isoDay } from "../server/lib/plans.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.3";
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const D = new Date(2026, 5, 17);
const at = (days, hour = 10) => new Date(D.getFullYear(), D.getMonth(), D.getDate() + days, hour, 0, 0).getTime();
const day = days => isoDay(new Date(at(days)));
const tr = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

describe(`iptal süresi: ${OLD} verisi güncel kodla (iletim günü eski sürümün gönderim kaydından)`, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-244-iptal-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocStatusPollMs: [10, 10] };
  let edm;
  after(async () => {
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("3. gün gönderilen 11. gün iptal edilir, 0. gün gönderilen reddedilir; geri dönüşte 2.4.3 kesimden sayar", async () => {
    edm = await startMockEdm();
    const clock = createClock({ time: at(0), fixed: true });
    const ids = {};
    const old = await bootVersion(OLD, { ...dirs, now: clock });
    try {
      const api = await old.login();
      const ok = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        return res.data;
      };
      await ok("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
      await ok("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
      const person = await ok("cari", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", email: "ayse@example.com" }));
      const personId = person.id || person.account?.id;
      const issue = async (label, eSend) => ok(label, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: personId, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" }, eSend }));
      const sentDay0 = await issue("0. gün kes ve gönder", "now");
      assert.equal(sentDay0.profile, "EARSIVFATURA");
      ids.day0 = sentDay0.id;
      ids.day3 = (await issue("0. gün kes, sonra gönder", "later")).id;
      ids.back = (await issue("0. gün kes, sonra gönder (geri dönüş için)", "later")).id;
      clock.set(at(3));
      await ok("3. gün gönder", api.post(`/api/workspace/invoices/${ids.day3}/send`, {}));
      await ok("3. gün gönder (geri dönüş belgesi)", api.post(`/api/workspace/invoices/${ids.back}/send`, {}));
      // 2.4.3'ün yazdığı gönderim kaydı (kâhin değil, ön koşul): 3. gün belgelerinin "invoice.e.sent" izi 3. gün
      const trail = old.app.store.all("SELECT entity_id AS id, created_at AS at FROM audit_events WHERE type = 'invoice.e.sent'");
      assert.equal(trail.length, 3, JSON.stringify(trail));
      assert.equal(isoDay(new Date(trail.find(row => row.id === ids.day3).at)), day(3));
      assert.equal(isoDay(new Date(trail.find(row => row.id === ids.day0).at)), day(0));
    } finally {
      await old.close();
    }

    clock.set(at(11));
    const current = await bootVersion(CURRENT, { ...dirs, now: clock });
    try {
      const api = await current.login();
      const card3 = (await api.get(`/api/workspace/invoices/${ids.day3}`)).data;
      assert.deepEqual(card3.cancelWindow, { start: day(3), source: "iletim", lastDay: day(11), late: false });
      const card0 = (await api.get(`/api/workspace/invoices/${ids.day0}`)).data;
      assert.deepEqual(card0.cancelWindow, { start: day(0), source: "iletim", lastDay: day(8), late: true });
      assert.equal(card0.canCancel, false);
      const before = edm.state.cancelled.length;
      const cancelled = await api.post(`/api/workspace/invoices/${ids.day3}/cancel`, { reason: "Müşteri vazgeçti" });
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
      assert.equal(cancelled.data.status, "cancelled");
      assert.equal(edm.state.cancelled.length, before + 1, "EDM'de iptal edildi");
      const refused = await api.post(`/api/workspace/invoices/${ids.day0}/cancel`, { reason: "Geç" });
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "einvoice-cancel-late");
      assert.match(refused.data.error, new RegExp(`alıcıya iletildiği ${tr(day(0)).replace(/\./g, "\\.")} gününden sonraki 8 gün içinde \\(en geç ${tr(day(8)).replace(/\./g, "\\.")}\\)`));
      const integrity = await api.get("/api/workspace/ledger/integrity");
      assert.equal(integrity.status, 200);
      assert.deepEqual(integrity.data.failures, [], JSON.stringify(integrity.data.failures).slice(0, 400));
    } finally {
      await current.close();
    }

    // Geri dönüş: v2.4.3 aynı dosyayı açar; aynı (3. gün gönderilmiş) belgeyi 11. günde kesimden sayarak reddeder — 2.4.4'ün iletimden sayımı farkı.
    const backOld = await bootVersion(OLD, { ...dirs, now: clock });
    try {
      const api = await backOld.login();
      const list = await api.get("/api/workspace/invoices?tab=all");
      assert.equal(list.status, 200);
      const refusedOld = await api.post(`/api/workspace/invoices/${ids.back}/cancel`, { reason: "Geç" });
      assert.equal(refusedOld.status, 409, JSON.stringify(refusedOld.data));
      assert.equal(refusedOld.data.code, "einvoice-cancel-late");
      assert.match(refusedOld.data.error, /kesildikten 8 gün sonra/);
    } finally {
      await backOld.close();
    }
  });
});
