// 2.4.4 iş listesi 22 — e-SMM gönderim kapıları ESKİ SÜRÜM VERİSİYLE (test kuralı: veri eski sürümün GERÇEK koduyla, API'sinden üretilir; ders 17).
//   v2.4.0 (gerçek kod): "e-SMM kullanıcısıyım" işaretli → serbest meslek makbuzu ESMM profili + TES numarası alır, EDM'ye gönderilemez (2.4.1'de gizlendi).
//   v2.4.3 (gerçek kod): e-SMM gizli → serbest meslek makbuzu kâğıt (KAGIT, SMM serisi).
//   Güncel kod, e-SMM KAPALI (üretim varsayılanı): ikisi de hiçbir gönderim yoluna girmez (bugünkü davranış).
//   Güncel kod, e-SMM AÇIK: 2.4.0'ın numaralı ESMM makbuzu Gönderilecekler'de "Gönderilmedi" görünür ve kendi numarasıyla e-SMM servisinden gider;
//   2.4.3'ün kâğıt makbuzu e-Belge olmaz.
// Sahte EDM (test/einvoice-mock.mjs + test/esmm-mock.mjs); sahte saat (ders 13); ders 30 lisans adresi.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const at = (days, hour = 10) => new Date(2026, 5, 17 + days, hour, 0, 0).getTime();

describe("e-SMM gönderim kapıları: v2.4.0 ESMM makbuzu ve v2.4.3 kâğıt makbuzu güncel kodla", () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-244-esmm-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocStatusPollMs: [10, 10] };
  let edm;
  after(async () => {
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("bayrak kapalıyken ikisi de gönderilmez; açıkken yalnız 2.4.0'ın ESMM makbuzu kendi numarasıyla e-SMM servisinden gider", async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const clock = createClock({ time: at(0), fixed: true });
    const ids = {};
    const ok = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    const integrator = { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" };
    const makbuz = (api, accountId) => ok("makbuz", api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));

    const v240 = await bootVersion("v2.4.0", { ...dirs, now: clock });
    try {
      const api = await v240.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      await ok("v2.4.0 ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator }));
      const account = await ok("v2.4.0 cari", api.post("/api/workspace/accounts", CLIENT));
      ids.account = account.id || account.account?.id;
      const doc = await makbuz(api, ids.account);
      // Ön koşul (kâhin değil): 2.4.0'ın yazdığı biçim.
      assert.equal(doc.profile, "ESMM");
      assert.equal(doc.number, "TES2026000000001");
      assert.ok(["", "none", null, undefined].includes(doc.eStatus), String(doc.eStatus));
      ids.esmm = doc.id;
    } finally {
      await v240.close();
    }

    const v243 = await bootVersion("v2.4.3", { ...dirs, now: clock });
    try {
      const api = await v243.login();
      const doc = await makbuz(api, ids.account);
      assert.equal(doc.profile, "KAGIT", "2.4.3'te e-SMM gizli");
      assert.match(doc.number, /^SMM2026\d{9}$/);
      ids.paper = doc.id;
    } finally {
      await v243.close();
    }

    const pendingOf = async api => (await ok("Gönderilecekler", api.get("/api/workspace/invoices?tab=pending"))).invoices.map(item => item.id);
    // Güncel kod, e-SMM KAPALI (üretim): ne Gönderilecekler ne gönderim.
    const off = await bootVersion(CURRENT, { ...dirs, now: clock });
    try {
      const api = await off.login();
      const pending = await pendingOf(api);
      assert.ok(!pending.includes(ids.esmm) && !pending.includes(ids.paper), JSON.stringify(pending));
      for (const id of [ids.esmm, ids.paper]) {
        const card = await ok("kart", api.get(`/api/workspace/invoices/${id}`));
        for (const key of ["canSend", "canRefresh", "canOfficial", "eUnsent"]) assert.equal(Boolean(card[key]), false, `${id} ${key}`);
      }
      const send = await api.post(`/api/workspace/invoices/${ids.esmm}/send`, {});
      assert.equal(send.status, 409, JSON.stringify(send.data));
      const turn = await ok("Tümünü Gönder", api.post("/api/workspace/invoices/send-pending", { all: true }));
      assert.deepEqual(turn.results, []);
      assert.deepEqual(edm.state.smm.calls, [], "e-SMM servisine istek yok");
    } finally {
      await off.close();
    }

    // Güncel kod, e-SMM AÇIK: 2.4.0'ın numaralı makbuzu gönderilmemiş e-Belgedir (Gönderilmedi) → kendi numarasıyla gider; kâğıt makbuz gitmez.
    resetEdmCaches();
    const on = await bootVersion(CURRENT, { ...dirs, now: clock, esmmEnabled: true });
    try {
      const api = await on.login();
      const pending = await pendingOf(api);
      assert.ok(pending.includes(ids.esmm), "2.4.0 makbuzu Gönderilecekler'de");
      assert.ok(!pending.includes(ids.paper), "kâğıt makbuz Gönderilecekler'de değil");
      const paper = await ok("kâğıt kart", api.get(`/api/workspace/invoices/${ids.paper}`));
      assert.equal(paper.canSend, false);
      const card = await ok("ESMM kart", api.get(`/api/workspace/invoices/${ids.esmm}`));
      assert.equal(card.eUnsent, true);
      assert.equal(card.canSend, true);
      const turn = await ok("Tümünü Gönder", api.post("/api/workspace/invoices/send-pending", { all: true }));
      assert.deepEqual(turn.results.map(item => [item.id, item.ok]), [[ids.esmm, true]], JSON.stringify(turn.results));
      const sent = await ok("kart", api.get(`/api/workspace/invoices/${ids.esmm}`));
      assert.equal(sent.number, "TES2026000000001", "numara değişmedi");
      assert.equal(sent.eStatus, "sent", sent.eMessage);
      assert.deepEqual(edm.state.smm.sent.map(item => item.id), ["TES2026000000001"]);
      assert.deepEqual(edm.state.calls.filter(call => call.op === "SendInvoice"), [], "e-Fatura servisine gönderim yok");
      assert.deepEqual(edm.state.smm.violations, []);
      const integrity = await api.get("/api/workspace/ledger/integrity");
      assert.equal(integrity.status, 200);
      assert.deepEqual(integrity.data.failures, [], JSON.stringify(integrity.data.failures).slice(0, 400));
    } finally {
      await on.close();
    }
  });
});
