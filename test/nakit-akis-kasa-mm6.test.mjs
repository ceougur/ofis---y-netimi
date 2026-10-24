// 2.4.4 madde 31b MM6 (mali müşavir): Tablodaki Nakit Akışı'nın "Kasa giriş" / "Kasa çıkış" sütunları dönemdeki BÜTÜN nakit Kasa hareketlerini gösterir — kaynağı
// ne olursa olsun (cari tahsilat ve ödeme, fatura nakit tahsilatı, taksit kartı, kayıt tahsilatı, elle Kasa hareketi) ve Kasa raporuyla AYNI toplamı verir.
// 2.4.3'te ve aday 7 tabanında (ee047cb) yalnız elle Kasa (cash_entries) ile taksit kartı okunuyordu: carideki 3.000 TL nakit tahsilat Kasa raporunda varken
// Nakit Akışı'nda "Kasa giriş 0". Sekme / Sayfa süzgeci bunlara uygulanmaz (şirket geneli, 30e).
// 2.4.5 madde 5 (kullanıcı kararı 23.10.2026, bilerek değişti): Tablodaki Nakit Akışı'nda Kasa giriş / çıkış / Net / Birikimli / Beklenenle Birlikte sütunları
// KALKTI — tablo tahmini Kasa ile aynı tabloda toplanmaz; Kasa, Kasa raporlarında. Test artık Kasa raporunun aynı kaldığını ve Tablodaki Nakit Akışı'nın hiçbir
// Sekme / Sayfa seçeneğinde Kasa sütunu, toplamı ya da özet satırı taşımadığını denetler.
// Beklenen sayılar girilen tutarlardan (ders 5): giriş 3.000 (cari) + 600 (fatura peşini) + 250 (taksit kartı) + 100 (kayıt tahsilatı) + 200 (elle) = 4.150;
// çıkış 500 (cari ödeme) + 50 (elle) = 550; Banka (Havale/EFT) yoluyla girilen 900 Kasa'da değildir, sayılmaz.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const NOW = new Date();
const TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const trDay = days => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

describe("31b MM6 → 2.4.5 madde 5: Kasa raporu bütün nakit kaynakları sayar; Tablodaki Nakit Akışı'nda Kasa sütunu yok", () => {
  const root = mkdtempSync(path.join(tmpdir(), "nakit-kasa-mm6-"));
  let server;
  let api;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const RANGE = `from=${TODAY}&to=${TODAY}`;

  before(async () => {
    const clock = createClock({ time: new Date(`${TODAY}T10:00:00`), fixed: true });
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock });
    api = await server.login();
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const matrix = [["Dosya No", "Ad Soyad", "Telefon", "Kalan Borç", "Ödeme Sözü"], ["2026/1", "Tülay Öz", "0532 111 11 11", "5.000,00", trDay(5)], ["2026/2", "Mert Can", "0532 222 22 22", "2.000,00", trDay(5)]];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "borclular.xlsx", sheets: [{ name: "Borçlular", matrix }, { name: "Kira", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Ödeme Sözü"], ["2026/9", "Oya Tan", "700,00", trDay(5)]] }] }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const deniz = await must("cari", api.post("/api/workspace/accounts", { name: "Deniz Ak", type: "customer" }));
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Kırtasiye Ltd.", type: "supplier" }));
    await must("cari nakit tahsilat", api.post(`/api/workspace/accounts/${deniz.id}/entries`, { kind: "in", amount: "3.000", date: TODAY, method: "cash", note: "Elden tahsilat" }));
    await must("cari havale (Kasa değil)", api.post(`/api/workspace/accounts/${deniz.id}/entries`, { kind: "in", amount: "900", date: TODAY, method: "bank" }));
    await must("cari nakit ödeme", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "500", date: TODAY, method: "cash" }));
    await must("peşinli fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: deniz.id, issueDate: TODAY, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "600", method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Ali Ak", total: "900" }));
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "250", date: TODAY, method: "cash" }));
    await must("kayıt tahsilatı (eski yol)", api.post(`/api/workspace/cases/${encodeURIComponent("2026/1")}/payments`, { amount: "100", date: TODAY, method: "cash" }));
    await must("elle Kasa giriş", api.post("/api/workspace/cash", { kind: "in", amount: "200", date: TODAY, description: "Elle giriş" }));
    await must("elle Kasa çıkış", api.post("/api/workspace/cash", { kind: "out", amount: "50", date: TODAY, description: "Elle çıkış" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("Kasa raporu giriş 4.150 / çıkış 550 (girilen tutarlardan); Tablodaki Nakit Akışı her Sekme / Sayfa seçeneğinde Kasa sütunu, toplamı, özeti taşımaz", async () => {
    const kasa = await must("Kasa raporu", api.get(`/api/workspace/cash?${RANGE}&method=cash`));
    assert.deepEqual([kasa.period.in, kasa.period.out], [4150, 550], `Kasa raporu dönem giriş/çıkış (girilen tutarlardan): ${JSON.stringify(kasa.period)}`);
    const CASH = ["cashIn", "cashOut", "net", "cumulative", "projected"];
    const session = (await must("rapor", api.get("/api/workspace/reports/nakit-akis"))).sessions[0].key;
    for (const query of ["", `&tabs=${encodeURIComponent("Borçlular")}`, `&tabs=${encodeURIComponent("Kira")}`, `&sessions=${encodeURIComponent(session)}`]) {
      const tag = `Nakit Akışı${query ? ` (${decodeURIComponent(query)})` : ""}`;
      const data = await must(tag, api.get(`/api/workspace/reports/nakit-akis?${RANGE}${query}`));
      const rep = data.report;
      assert.deepEqual(rep.table.columns.map(column => column.key), ["label", "expected", "expectedCount", "collected"], `${tag}: kolonlar`);
      assert.deepEqual(CASH.filter(key => key in rep.totals || rep.table.rows.some(row => key in row) || (rep.table.footer && key in rep.table.footer)), [], `${tag}: Kasa alanı kalmamalı`);
      assert.deepEqual(data.summary.map(([label]) => label), ["Tablodan Beklenen Tahsilat (Muhasebe Kaydı Değil)", "Gerçekleşen Tahsilat"], `${tag}: özet`);
      assert.ok(!(rep.notes || []).some(note => /Kasa/.test(note)), `${tag}: Kasa notu kalmamalı: ${JSON.stringify(rep.notes)}`);
    }
  });
});
