// 2.5.0 Ç7b tur 3b — kabul D (ders 17, 53 (b); docs/erp/C7B-FATURA-TASARIM.md §17.4 (7)): v2.4.9'un GERÇEK koduyla (surumler.mjs bootVersion) üretilmiş KİLİTLİ veride Kartı Kapat
// kuralı. Karar (6): "önceden kapatılmış kartlar olduğu gibi kalır" → göç 53 eski kapalı kartı '2.4.9' işaretler; bakiye, ekstre, defter (689) AYNI; donmuş defterdeki 689 maddesi
// güncel türetmeyle birebir (Kural Değişikliği Farkı'na 689 GİRMEZ). Güncellemeden sonra kapatılan kart "Borçta Kalsın".
// Beklenenler ELLE (v2.4.9'un bilinen kuralı + kararlar):
//   v2.4.9 (saat 08.10.2026): K1 Yeni Borç kartı 900 (01.10 / 01.11 / 01.12; Kayıt 20.09), 01.10 tahsilat 300, 08.10 Kartı Kapat → b1 0, 689 600. K2 Yeni Borç kartı 900
//   (01.11 / 01.12 / 01.01; Kayıt 20.09), tahsilatsız → b2 900. Dönem kilidi 08.10.
//   Güncel kod (saat 12.10.2026): b1 0, b2 900, 689 600; K1 işareti '2.4.9', K2 ''; donmuş defterin plan-close:K1 maddesi = güncel türetme (B 689 600 / A 120 600); kural farkı
//   maddelerinde plan-close:K1 YOK. K1 Yeniden Aç 409 (kapanış günü kilitli — eski kural). K2 Kartı Kapat (12.10) → b2 900 KALIR, 689 600 (değişmez), 12.10'da gecikmiş 0,
//   13.10'da 900 (S205: kapanış ertesi). Mutabakat Testi: kural farkı dışında sapma yok (kural farkı K1 / K2'nin KG-2 maddesinden — bu turun konusu değil).
// NASIL BOZARIM: göçte eski kartı işaretlememek (b1 600 olur); eski kartı da yeni kuralla saymak; yeni kartı eski kuralla düşmek (b2 0); 689'u kural farkına sokmak.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const W = "/api/workspace";
const LOCK = "2026-10-08";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
// Madde satırları kuruşla (yevmiye biçimi; c7b-eski-surum-sinif-250 ile aynı gösterim).
const lineSet = entry => entry.lines.map(line => `${line.account}${line.sub ? `/${line.sub}` : ""}:${line.debit}:${line.credit}`).sort();

describe("Ç7b tur 3b — kabul D: v2.4.9'un kilitli verisinde kapatılmış kart eski kuralda, yeni Kartı Kapat 'Borçta Kalsın'", { skip }, () => {
  let root;
  let server;
  let api;
  let app;
  const ids = {};
  let old249;
  const snap = async () => {
    const balance = async id => (await must("cari", api.get(`${W}/accounts/${id}`))).totals.balance;
    const trial = Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
    return { b1: await balance(ids.A1), b2: await balance(ids.A2), m689: trial["689"] || 0 };
  };
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7b3b-eski-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      const acc = async name => (await must("cari", o.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
      ids.A1 = await acc("Eski Kapalı");
      ids.K1 = (await must("kart", o.post(`${W}/plans`, { accountId: ids.A1, name: "Eski K1", total: "900", registeredOn: "2026-09-20", mode: "auto", count: 3, firstDue: "2026-10-01" }))).id;
      await must("tahsilat", o.post(`${W}/plans/${ids.K1}/entries`, { kind: "in", amount: "300", date: "2026-10-01", method: "cash" }));
      await must("Kartı Kapat (v2.4.9)", o.put(`${W}/plans/${ids.K1}`, { status: "closed" }));
      ids.A2 = await acc("Eski Açık");
      ids.K2 = (await must("kart", o.post(`${W}/plans`, { accountId: ids.A2, name: "Eski K2", total: "900", registeredOn: "2026-09-20", mode: "auto", count: 3, firstDue: "2026-11-01" }))).id;
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const ledger = await must("mizan (v2.4.9)", o.get(`${W}/ledger`));
      const trial = Object.fromEntries(ledger.trial.accounts.map(r => [r.code, r.balance]));
      old249 = {
        b1: (await must("cari", o.get(`${W}/accounts/${ids.A1}`))).totals.balance,
        b2: (await must("cari", o.get(`${W}/accounts/${ids.A2}`))).totals.balance,
        m689: trial["689"] || 0,
        close: (ledger.journal?.entries || ledger.entries || []).find(entry => entry.id === `plan-close:${ids.K1}`) || null,
      };
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-10-12T12:00:00+03:00", fixed: true }, integrityScan: false });
    app = server.app;
    await app.ledger.snapshots.runPending();
    api = await server.login();
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("v2.4.9'un kendi değerleri elle beklenenle aynı (üreticinin doğruluğu)", () => {
    assert.deepEqual({ b1: old249.b1, b2: old249.b2, m689: old249.m689 }, { b1: 0, b2: 900, m689: 600 });
  });

  it("güncellemeden sonra: işaretler, bakiyeler ve 689 aynen; donmuş 689 maddesi güncel türetmeyle birebir, kural farkında yok", async () => {
    // Değişmeyen davranış (eski kodda da yeşil — kırmızısı göçün işaretinde, sonda): bakiye, 689, donmuş madde.
    assert.deepEqual(await snap(), { b1: 0, b2: 900, m689: 600 });
    const frozen = app.ledger.snapshots.entries({}).find(item => item.id === `plan-close:${ids.K1}`);
    assert.ok(frozen, "kilitli dönemde donmuş 689 maddesi var");
    assert.deepEqual(lineSet(frozen), ["120:0:60000", "689:60000:0"]);
    const live = app.ledger.build().find(item => item.id === `plan-close:${ids.K1}`);
    assert.deepEqual(lineSet(live), lineSet(frozen), "güncel türetme = donmuş");
    const diff = app.ledger.snapshots.ruleDiff({ detail: true });
    assert.equal(diff.entries.some(item => item.id === `plan-close:${ids.K1}`), false, "689 kural farkına girmez");
    const scan = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.deepEqual((scan.failures || []).map(item => item.code).filter(code => code !== "ledger:rule-diff"), [], JSON.stringify(scan.failures || "").slice(0, 600));
    const rule = id => app.store.get("SELECT close_rule AS r FROM plans WHERE id = ?", id).r;
    assert.equal(rule(ids.K1), "2.4.9", "v2.4.9'da kapatılmış kart eski kural (göç 53)");
    assert.equal(rule(ids.K2), "");
  });

  it("eski kurallı K1 Yeniden Aç 409 (kapanış günü kilitli); K2 güncel kodda Kartı Kapat → Borçta Kalsın (bakiye 900, 689 aynı, ertesi gün gecikmiş 900)", async () => {
    const red = await api.put(`${W}/plans/${ids.K1}`, { status: "active" });
    assert.equal(red.status, 409, JSON.stringify(red.data).slice(0, 300));
    assert.match(String(red.data?.error || ""), /kalan alacaktan vazgeçildi/);
    await must("Kartı Kapat (güncel)", api.put(`${W}/plans/${ids.K2}`, { status: "closed", closeRemaining: 900 }));
    assert.deepEqual(await snap(), { b1: 0, b2: 900, m689: 600 }, "yeni Kartı Kapat: kalan borçta (eski kodda b2 0, 689 1.500)");
    assert.equal((await must("cari", api.get(`${W}/accounts/${ids.A2}`))).totals.overdueDebt, 0, "kapanış günü (12.10)");
    app.config.now.set("2026-10-13T12:00:00+03:00");
    assert.equal((await must("cari", api.get(`${W}/accounts/${ids.A2}`))).totals.overdueDebt, 900, "13.10: kalanın tamamı (S205)");
    const scan = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.deepEqual((scan.failures || []).map(item => item.code).filter(code => code !== "ledger:rule-diff"), [], JSON.stringify(scan.failures || "").slice(0, 600));
  });
});
