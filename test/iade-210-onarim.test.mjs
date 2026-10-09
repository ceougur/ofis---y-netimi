// 2.1.0 Canlı Hata 2 — açılış onarımı. Veri GERÇEK v2.0.26 koduyla üretildi (test/guvenilirlik/iade-onarim-veri.mjs →
// test/fixtures/surum-2.0.26-iade): orada iade + peşin geri ödemesiyle yanlış büyümüş / küçülmemiş taksit kartları var.
// Güncel kod bu veriyi açınca: yanlış kartlar (C, B, J) kendiliğinden doğru kalana iner; doğru kartlar (D, E) ve kalanı zaten doğru
// olan fazla tahsilatlı kart (A) değişmez; küçülecek taksiti kilitli dönemde olan kart (KILIT) değişmez (kilitli döneme yazılmaz);
// her değişiklik audit'e (plan.repaired, previous) yazılır; ikinci açılışta hiçbir şey değişmez; Mutabakat Testi tutarlı.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { IADE_FIXTURE } from "./guvenilirlik/iade-onarim-veri.mjs";

const money = text => Number(String(text ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
const fixture = readFixture(IADE_FIXTURE);
const T = fixture.today;
const cases = fixture.cases;

describe("2.1.0 Canlı Hata 2 — v2.0.26 verisinde yanlış büyümüş taksit kartlarının açılış onarımı", () => {
  let unpacked;
  let server;
  let api;
  const open = async () => {
    server = await bootVersion(CURRENT, { dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, now: { time: `${T}T12:00:00+03:00`, fixed: true } });
    api = await server.login();
  };
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const card = async key => (await must(`kart ${key}`, api.get(`/api/workspace/plans/${cases[key].planId}`))).totals;
  const repairs = () => server.app.store.all("SELECT entity_id AS planId, payload_json AS payload FROM audit_events WHERE type = 'plan.repaired' ORDER BY created_at").map(row => ({ planId: row.planId, ...JSON.parse(row.payload) }));
  const snapshot = async () => {
    const out = {};
    for (const key of Object.keys(cases)) {
      const t = await card(key);
      out[key] = [t.total, t.paid, t.remaining];
    }
    return out;
  };
  before(async () => {
    unpacked = unpackFixture(IADE_FIXTURE);
    await open();
  });
  after(async () => {
    await server?.close();
    unpacked?.cleanup();
  });

  test("yanlış kartlar (C, B, J) doğru kalana iner; D, E, A dokunulmaz; kilitli dönemdeki kart (KILIT) değişmez", async () => {
    assert.deepEqual(Object.fromEntries(Object.entries(cases).map(([key, item]) => [key, item.v2026.left])), { C: 500, B: 400, J: 300, A: 0, D: 1000, E: 500, KILIT: 500 }, "fikstür: v2.0.26'nın yazdığı kalanlar");
    const now = await snapshot();
    assert.deepEqual(now, {
      C: [0, 0, 0],
      B: [0, 0, 0],
      J: [300, 300, 0],
      A: [300, 1500, 0],
      D: [1000, 0, 1000],
      E: [500, 0, 500],
      KILIT: [500, 0, 500],
    });
    const result = server.app.context.ownCardRepair;
    assert.deepEqual(result.fixed.map(item => item.planId).sort(), [cases.C.planId, cases.B.planId, cases.J.planId].sort());
    assert.deepEqual(result.locked.map(item => item.planId), [cases.KILIT.planId], "kilitli dönemdeki kart listede, değişmedi");
  });

  test("her değişiklik audit'te: plan.repaired, previous (toplam, kalan, taksitler) ve yeni kalan", async () => {
    const list = repairs();
    assert.equal(list.length, 3);
    const c = list.find(item => item.planId === cases.C.planId);
    assert.equal(c.previous.total, 500);
    assert.equal(c.previous.left, 500);
    assert.equal(c.previous.items.length, 1);
    assert.equal(c.left, 0);
    assert.equal(c.reason, "iade-geri-odeme");
    const j = list.find(item => item.planId === cases.J.planId);
    assert.deepEqual([j.previous.total, j.previous.left, j.total, j.left, j.cut], [600, 300, 300, 0, 300]);
  });

  test("raporlar onarılan kartla: Alacak Yaşlandırma, ANLIK DURUM Geciken Alacak, Geciken Taksitler, cari kartı", async () => {
    const aging = await must("Alacak Yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
    const row = name => money((aging.rows || []).find(r => r[0] === name)?.at(-1));
    assert.deepEqual([row(cases.C.name), row(cases.B.name), row(cases.J.name), row(cases.D.name), row(cases.E.name), row(cases.KILIT.name)], [0, 0, 0, 1000, 500, 500]);
    // Gecikmiş: D (1.000, vade T−20), E (500, T−20), KILIT (500, T−40). C'nin 500'ü (T−20) v2.0.26'da gecikmiş görünüyordu.
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(overview.receivable.overdue, 2000);
    const late = await must("Geciken Taksitler", api.get("/api/workspace/report-center/geciken-taksitler"));
    assert.equal((late.rows || []).some(r => JSON.stringify(r).includes(cases.C.name)), false, "C geciken listesinde yok");
    for (const key of ["C", "B", "J"]) {
      const account = await must(`cari ${key}`, api.get(`/api/workspace/accounts/${cases[key].accountId}`));
      assert.equal(account.totals.overdue || 0, 0, `${key}: cari kartı Geciken 0`);
    }
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
  });

  test("ikinci açılışta hiçbir şey değişmez (idempotent); kilitli kart yine listede", async () => {
    const first = await snapshot();
    await server.close();
    await open();
    assert.deepEqual(await snapshot(), first);
    assert.equal(repairs().length, 3, "yeni audit yok");
    assert.deepEqual(server.app.context.ownCardRepair.fixed, []);
    assert.deepEqual(server.app.context.ownCardRepair.locked.map(item => item.planId), [cases.KILIT.planId]);
  });

  test("onarılan kartta yeni işlem doğru: C'nin iadesi iptal edilince kart faturanın açığına (500) döner", async () => {
    // Onarılmış C'nin iadesi iptal edilince kart faturanın açığına (500) döner (onarım iadeyle tutarlı bir kart bıraktı).
    const list = await must("faturalar", api.get("/api/workspace/invoices?tab=all&limit=500"));
    const ret = (list.invoices || []).find(item => item.kind === "sale_return" && item.accountId === cases.C.accountId);
    assert.ok(ret, "C'nin iadesi");
    await must("iade iptali", api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
    const c = await card("C");
    assert.deepEqual([c.total, c.remaining], [500, 500]);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true);
  });
});
