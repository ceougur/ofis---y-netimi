// 2.5.0 Ç7a tur 2b — BAŞ MİMAR KARARI 14.11 10:17 (2) (S179 = A'nın liste / rapor tutarlılığı): açılışta sayılmış hesapsız satırlar Hesabı Atanmamış LİSTESİNDE ve banka raporlarının
// satırlarında "Açılışta Sayıldı" işaretiyle KALIR; listenin / raporların özet ve TOPLAM satırları bu satırları DÜŞER (toplam = kovanın bakiyesi; ekran / PDF / Excel aynı). Ayrım
// TEK kaynaktan (lib/bank/opening-cover.mjs — defterin ve kovanın koşulu). docs/erp/C7A-BANKA-TASARIM.md §14.6. Beklenenler testin KENDİ elle hesabı.
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026; banka hesabı yokken girilmiş cari hareketleri, sonra Ziraat açılışı 01.10.2026 100.000):
//   20.09 havale tahsilat 5.000 (AÇILIŞTA SAYILDI) · 25.09 havale ödeme 1.000 (AÇILIŞTA SAYILDI) · 22.09 POS tahsilat 3.000 (POS yalnız Devir Kapanışı'yla — sayılmaz) ·
//   01.10 havale tahsilat 700 · 03.10 havale tahsilat 2.000. Kova: Havale 2.700, POS / Kart 3.000 (toplam 5.700).
//   1. Liste: 5 satır; işaret yalnız 20.09 ve 25.09'da; toplamlar kova.
//   2. Banka Bakiye Raporu (Hesabı Atanmamış, Tüm Zamanlar): Havale satırı Dönem Sonu 2.700, POS satırı 3.000; özet Hesabı Atanmamış 5.700.
//   3. Banka Hareket Raporu (Hesabı Atanmamış, Tüm Zamanlar): 5 hareket satırı (işaretli ikisinin tutar hücreleri boş, açıklamada "Açılışta Sayıldı"); Giriş 5.700, Çıkış 0,
//      Dönem Sonu 5.700; TOPLAM = satırlar. Dönem 21.09'dan: devir 0 (20.09 açılışta sayıldı — önce 5.000).
//   4. Günlük Banka Raporu: işaretli satırlar günlere girmez (Dönem Sonu 5.700).
//   5. Cari / Banka ve POS Hareketleri (Hesabı Atanmamış): işaretli satır kalır, tutarı toplama girmez (Giriş 5.700, Çıkış 0).
// NASIL BOZARIM: işareti kaldır (1 kırılır); raporda toplamdan düşme (2–5: 9.700 / 1.000); devirde düşme (3: 5.000); işaretli satırı listeden sil (1: 3 satır).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const qs = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)).toString();
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : null;
};
const summary = (data, key) => {
  const hit = data.summary.find(([name]) => name === key);
  assert.ok(hit, `${data.id}: özette "${key}" yok: ${JSON.stringify(data.summary)}`);
  return moneyOf(hit[1]) ?? hit[1];
};
// TOPLAM = satırların para hücreleri (ekran / PDF / Excel aynı kaynaktan).
function footerOk(data, tag) {
  if (!data.footer) return;
  data.headers.forEach((header, index) => {
    if (data.types[index] !== "money" || data.footer[index] === "") return;
    const values = data.rows.map(row => moneyOf(row[index])).filter(value => value !== null);
    if (!values.length) return;
    assert.equal(moneyOf(data.footer[index]), values.reduce((a, b) => a + b, 0), `${tag}: TOPLAM "${header}"`);
  });
}

describe("Ç7a — Hesabı Atanmamış listesi ve banka raporları: 'Açılışta Sayıldı' satırı kalır, toplam = kova", () => {
  let ctx;
  let party;
  const report = async (id, query, tag) => {
    const data = await must(tag, ctx.api.get(`${RC}/${id}?${qs(query)}`));
    footerOk(data, tag);
    return data;
  };
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const add = (label, body) => must(label, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, body));
    await add("20.09 havale", { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" });
    await add("25.09 ödeme", { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" });
    await add("22.09 POS", { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" });
    await add("01.10 havale", { kind: "in", amount: "700", method: "bank", date: "2026-10-01" });
    await add("03.10 havale", { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" });
    await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("1. liste: açılışta sayılmış satırlar işaretli kalır; toplamlar kova", async () => {
    const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
    assert.equal(legacy.rows.length, 5, "beş satır listede");
    assert.deepEqual(legacy.rows.map(row => [row.date, row.counted]).sort(), [["2026-09-20", true], ["2026-09-22", false], ["2026-09-25", true], ["2026-10-01", false], ["2026-10-03", false]]);
    assert.deepEqual(legacy.totals, { bankMinor: 270_000, cardMinor: 300_000 }, "toplam = kova");
    const sum = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(sum.unassigned.bankMinor + sum.unassigned.cardMinor, 570_000, "Banka Genel Bakış kovası");
  });

  it("2. Banka Bakiye Raporu: Hesabı Atanmamış satırları ve özeti kova", async () => {
    const data = await report("banka-bakiye", { preset: "all", bankGroup: "unassigned" }, "banka-bakiye");
    const end = data.headers.indexOf("Dönem Sonu");
    const bySub = Object.fromEntries(data.rows.map(row => [row[3], moneyOf(row[end])]));
    assert.deepEqual(bySub, { "102.00": 270_000, "108.00": 300_000 });
    assert.equal(summary(data, "Hesabı Atanmamış Eski Hareketler"), 570_000);
  });

  it("3. Banka Hareket Raporu: işaretli satırlar kalır, tutar hücreleri boş; toplamlar ve devir kova ile", async () => {
    const data = await report("banka-hareket", { preset: "all", bankAccount: "unassigned" }, "banka-hareket");
    const text = data.headers.indexOf("Açıklama");
    const counted = data.rows.filter(row => /Açılışta Sayıldı/.test(row[text]));
    assert.equal(counted.length, 2, "iki işaretli satır");
    for (const row of counted) assert.deepEqual(row.slice(5, 10), ["", "", "", "", ""], "işaretli satırın tutar / bakiye hücreleri boş");
    assert.ok(counted.some(row => /Giriş 5\.000,00 TL/.test(row[text])) && counted.some(row => /Çıkış 1\.000,00 TL/.test(row[text])), "tutar açıklamada");
    assert.equal(summary(data, "Giriş"), 570_000);
    assert.equal(summary(data, "Çıkış"), 0);
    assert.equal(summary(data, "Dönem Sonu"), 570_000);
    const later = await report("banka-hareket", { from: "2026-09-21", to: "2026-10-08", bankAccount: "unassigned" }, "banka-hareket 21.09");
    assert.equal(summary(later, "Devir"), 0, "20.09 açılışta sayıldı — devre girmez");
    assert.equal(summary(later, "Dönem Sonu"), 570_000);
  });

  it("4. Günlük Banka Raporu: işaretli satırlar günlere girmez", async () => {
    const data = await report("banka-gunluk", { preset: "all", bankAccount: "unassigned" }, "banka-gunluk");
    assert.equal(summary(data, "Dönem Sonu"), 570_000);
    assert.equal(summary(data, "Çıkış"), 0);
  });

  it("5. Cari Banka Hareketleri ve Banka ve POS Hareketleri (Hesabı Atanmamış): satır kalır, toplama girmez", async () => {
    const cari = await report("cari-banka-hareketleri", { preset: "all", anyAccount: "unassigned" }, "cari-banka");
    assert.equal(cari.rows.filter(row => row.some(cell => /Açılışta Sayıldı/.test(String(cell)))).length, 2);
    assert.equal(summary(cari, "Giriş"), 570_000);
    assert.equal(summary(cari, "Çıkış"), 0);
    const pos = await report("banka-pos-hareketleri", { preset: "all", anyAccount: "unassigned" }, "banka-pos");
    assert.equal(pos.rows.filter(row => row.some(cell => /Açılışta Sayıldı/.test(String(cell)))).length, 2);
    assert.equal(summary(pos, "Dönem Giriş"), 570_000);
    assert.equal(summary(pos, "Dönem Çıkış"), 0);
  });
});
