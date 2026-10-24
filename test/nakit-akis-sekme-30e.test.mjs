// 2.4.4 madde 30e: Tablodaki Nakit Akışı "Sekme" süzgecini uygular (ders 11 "her süzgeç, her seçenek"). 2.4.3'ten beri (ve aday 6'da) rapor penceresi Sekme
// seçimini bu rapor için de gönderiyordu, sunucu yok sayıyordu: Borçlular seçiliyken bütün sekmelerin beklenen tahsilatı toplanıyordu (10.600 yerine 20.100).
// Kural (öbür tablo raporlarıyla aynı, vadeTakip): sekmesi olan kalem yalnız seçili sekmelerdeyse sayılır; sekmesi OLMAYAN kalem süzgeçten geçer. Gerçekleşen
// tahsilat ve Kasa giriş/çıkış sekme taşımaz; Sayfa süzgecinde olduğu gibi süzülmez (şirket geneli; bilinen sınır).
// Beklenen sayılar tablonun kendi hücrelerinden (ders 5): Borçlular 7.600 + 3.000 (Mert'in kalanı 0, kalem yok) · Senetler 2.500 + 1.200 · Kira 3.000 + 1.800 ·
// Ödeme Sözleri 1.000.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { nakitAkis, normalizeFilters } from "../server/lib/reports.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const NOW = new Date();
const TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const shift = days => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const PROMISE = shift(5);
const RANGE = { from: "2000-01-01", to: "2099-12-31" };

describe("2.4.4 30e: Nakit Akışı Sekme süzgeci (birim)", () => {
  const time = Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 5);
  const items = [
    { caseKey: "a", session: "s1", tab: "Borçlular", time, amount: 7600 },
    { caseKey: "b", session: "s1", tab: "Senetler", time, amount: 2500 },
    { caseKey: "c", session: "s1", tab: "Kira", time, amount: 3000 },
    { caseKey: "d", session: "s1", tab: "", time, amount: 400, deadline: true },
  ];
  const payments = [{ caseKey: "a", amount: 1000, date: TODAY }];
  const cashEntries = [{ kind: "in", amount: 250, date: TODAY }, { kind: "out", amount: 50, date: TODAY }];
  const run = tabs => nakitAkis({ items, payments, cashEntries, filters: normalizeFilters({ ...RANGE, tabs }), now: NOW }).totals;

  test("tek sekme: yalnız o sekmenin kalemleri + sekmesiz kalem; iki sekme; süzgeçsiz hepsi", () => {
    assert.equal(run(["Borçlular"]).expected, 8000, `Sekme "Borçlular" seçiliyken Beklenen 7.600 + sekmesiz 400 = 8.000 olmalı; görülen ${run(["Borçlular"]).expected}`);
    assert.equal(run(["Senetler", "Kira"]).expected, 5900, `"Senetler" + "Kira": 2.500 + 3.000 + 400 = 5.900; görülen ${run(["Senetler", "Kira"]).expected}`);
    assert.equal(run([]).expected, 13500, "süzgeçsiz: bütün kalemler");
    assert.equal(run(["Yok Böyle Sekme"]).expected, 400, "olmayan sekme: yalnız sekmesiz kalem");
  });

  // 2.4.5 madde 5 (bilerek): Kasa giriş / çıkış kolonları kalktı; verilen Kasa satırları yok sayılır.
  test("Gerçekleşen tahsilat sekme süzgecinden bağımsız (sekme taşımaz; Sayfa süzgecindeki gibi); Kasa toplamı yok", () => {
    for (const tabs of [[], ["Borçlular"], ["Kira"]]) {
      const totals = run(tabs);
      assert.deepEqual(totals, { expected: totals.expected, collected: 1000 }, `sekme ${JSON.stringify(tabs)}`);
    }
  });
});

describe("2.4.4 30e: Nakit Akışı Sekme süzgeci (API, ekranın ve Excel'in okuduğu uç)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "nakit-sekme-30e-"));
  let server;
  let api;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const workbook = [
    { name: "Borçlular", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], ["2026/00001", "Tülay Öz", "0555 111 22 33", "11500", "3900", "7600", PROMISE], ["2026/00002", "Mert Can", "0555 111 22 44", "8000", "8000", "0", PROMISE], ["2026/00003", "Ece Ak", "0555 111 22 55", "4000", "1000", "3000", PROMISE]] },
    { name: "Senetler", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Ödenen", "Toplam Borç", "Ödeme Sözü"], ["2026/00010", "Selin Ak", "2500", "1500", "4000", PROMISE], ["2026/00011", "Oya Tan", "1200", "800", "2000", PROMISE]] },
    { name: "Kira", matrix: [["Dosya No", "Ad Soyad", "Toplam Borç", "Ödeme Sözü"], ["2026/00020", "Oğuz Er", "3000", PROMISE], ["2026/00021", "Kaan Su", "1800", PROMISE]] },
    { name: "Ödeme Sözleri", matrix: [["Dosya No", "Ad Soyad", "Söz Tarihi", "Söz Tutarı"], ["2026/00030", "Nur Ay", PROMISE, "1000"]] },
  ];
  const akis = async query => (await must(`nakit-akis ${query}`, api.get(`/api/workspace/reports/nakit-akis?from=${RANGE.from}&to=${RANGE.to}${query}`))).report;

  before(async () => {
    const clock = createClock({ time: new Date(`${TODAY}T10:00:00`), fixed: true });
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock });
    api = await server.login();
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "nakit-sekme.xlsx", sheets: workbook }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("her sekme seçeneği: Beklenen yalnız seçili sekmelerin kalemleri; süzgeçsiz toplam = sekmelerin toplamı; satırlar = toplam", async () => {
    const cases = [["", 20100], ["Borçlular", 10600], ["Senetler", 3700], ["Kira", 4800], ["Ödeme Sözleri", 1000], ["Borçlular,Kira", 15400]];
    for (const [tabs, expected] of cases) {
      const rep = await akis(tabs ? `&tabs=${encodeURIComponent(tabs)}` : "");
      assert.equal(rep.totals.expected, expected, `Sekme "${tabs || "Tüm Sekmeler"}" seçiliyken Beklenen ${expected} olmalı (yalnız o sekmenin kalemleri); görülen ${rep.totals.expected}`);
      assert.equal(Math.round(rep.table.rows.reduce((sum, row) => sum + row.expected, 0) * 100) / 100, rep.totals.expected, `${tabs}: satırlar = toplam`);
    }
  });

  test("Sayfa ve Sekme süzgeci birlikte; Excel dışa aktarım aynı süzgeçle 200", async () => {
    const session = (await must("rapor", api.get("/api/workspace/reports/nakit-akis"))).sessions[0].key;
    const rep = await akis(`&sessions=${encodeURIComponent(session)}&tabs=${encodeURIComponent("Senetler")}`);
    assert.equal(rep.totals.expected, 3700, `Sayfa + Sekme "Senetler": 3.700; görülen ${rep.totals.expected}`);
    const res = await api.client.raw("POST", "/api/workspace/reports/nakit-akis/export", { body: JSON.stringify({ format: "xlsx", filters: { ...RANGE, tabs: ["Senetler"] } }), headers: { "content-type": "application/json" } });
    assert.equal(res.status, 200);
  });
});
