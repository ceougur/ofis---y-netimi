// 2.5.0 tek aday düzeltme turu — G1 (dar kontrol t3c7a; S214 = A + BAŞ MİMAR KARARI 14.11 10:17 (2)): "Banka ve POS Hareketleri" raporu Hesap = Tüm Hesaplar seçiminde de
// "Açılışta Sayıldı" işaretini uygular — açılışta sayılmış hesabı atanmamış satır raporda KALIR, işaretli; tutarı devre, dönem giriş / çıkışına, yürüyen bakiyeye, Dönem Sonu'na
// ve "(tüm hareketler)" satırlarına girmez. Rapor = defter (102 + 108) = hesaplar + Hesabı Atanmamış kovası; üç Yol seçeneğinde de (Banka ve POS (Tümü), Banka (Havale / EFT),
// POS / Kart). Ekran / PDF / Excel aynı sayılar. Beklenenler testin KENDİ elle hesabı.
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026): banka hesabı yokken girilmiş cari hareketleri — 20.09 havale tahsilat 5.000 (AÇILIŞTA SAYILDI), 25.09 havale ödeme 1.000 (AÇILIŞTA SAYILDI),
// 22.09 POS tahsilat 3.000 (POS yalnız Devir Kapanışı'yla sayılır — sayılmaz); sonra Ziraat açılışı 01.10 100.000, Ziraat'e bağlı 03.10 havale tahsilat 1.500, Garanti açılışı
// 05.10 10.000 (İKİ AYRI AÇILIŞ GÜNÜ: havale sınırı en geç açılış = 05.10); hesap yokken girilmiş 06.10 hesapsız havale tahsilat 2.000 (sınırdan sonra — kovada).
//   Elle: 102 = Ziraat 101.500 + Garanti 10.000 + 102.00 2.000 = 113.500; 108 = 108.00 3.000. Kova = havale 2.000 + POS 3.000.
//   Tümü (preset all): Devir 0; işaretli 2 satır (tutar / bakiye hücreleri boş); Dönem Giriş 1.500 + 3.000 + 2.000 = 6.500; Çıkış 0; açılışlar 110.000 (düzeltme); Dönem Sonu
//   116.500 = 102 + 108; Banka (tüm hareketler) 113.500; POS / Kredi Kartı (tüm hareketler) 3.000. Havale yolu: Dönem Sonu 113.500, işaretli 2. POS yolu: 3.000, işaretli 0.
//   Dönem 26.09'dan: Devir 3.000 (yalnız 22.09 POS; 20.09 / 25.09 açılışta sayıldı); Dönem Sonu yine 116.500; son satırın bakiyesi = Dönem Sonu.
//   Ziraat'e bağlı 03.10 satırı (hesaplı, tarihi havale sınırından ÖNCE) İŞARETLENMEZ — hem Tüm Hesaplar'da hem Ziraat seçiminde (Ziraat Dönem Sonu 101.500).
// NASIL BOZARIM: Tüm Hesaplar'ı eski Kasa yoluna geri al (Tümü 120.500, işaretli 0); işaret yardımcısında hesaplı satırı atlamayı kaldır (03.10 işaretlenir: Tümü 115.000, Ziraat
// 100.000); devirde düşme (26.09: Devir 7.000); "(tüm hareketler)" satırlarında düşme (117.500).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

const RC = "/api/workspace/report-center";
const ID = "banka-pos-hareketleri";
const qs = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)).toString();
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : null;
};
const summary = (data, key) => {
  const hit = data.summary.find(([name]) => name === key);
  assert.ok(hit, `${key}: özette yok: ${JSON.stringify(data.summary)}`);
  return moneyOf(hit[1]);
};
const COUNTED = /Açılışta Sayıldı/;
const markedRows = data => data.rows.filter(row => row.some(cell => COUNTED.test(String(cell))));

describe("G1 — Banka ve POS Hareketleri (Tüm Hesaplar): 'Açılışta Sayıldı' uygulanır, rapor = defter = hesaplar + kova", () => {
  let ctx;
  let ziraat;
  const report = (query, tag) => must(tag, ctx.api.get(`${RC}/${ID}?${qs(query)}`));
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const add = (label, body) => must(label, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { cashForce: true, ...body }));
    await add("20.09 havale", { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" });
    await add("25.09 ödeme", { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" });
    await add("22.09 POS", { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" });
    // Hesap yokken girilen hesapsız havale (hesap açıldıktan sonra sınırdan sonraki güne hesapsız giriş yolu kapalıdır); Garanti 05.10 açılınca da sınırdan sonra kalır → kova.
    await add("06.10 hesapsız havale", { kind: "in", amount: "2.000", method: "bank", date: "2026-10-06" });
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    await add("03.10 Ziraat havale", { kind: "in", amount: "1.500", method: "bank", date: "2026-10-03", bankAccountId: ziraat.id });
    await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "İkinci Hesap", kind: "demand", opening: { date: "2026-10-05", amount: "10.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("ön koşul: defter ve kova elle hesapla (102 = 113.500, 108 = 3.000; 102.00 2.000, 108.00 3.000; Ziraat'e bağlı satır hesapta)", async () => {
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["102"], 113_500);
    assert.equal(trial["108"], 3_000);
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.00"]?.balance, 2_000);
    assert.equal(subs["108.00"]?.balance, 3_000);
    const row = ctx.server.app.store.get("SELECT fin_ref AS ref FROM account_entries WHERE date = '2026-10-03'");
    assert.equal(row.ref, ziraat.id, "03.10 Ziraat'e bağlı");
  });

  it("Tüm Hesaplar × üç Yol: işaretli satırlar kalır, toplama girmez; Dönem Sonu = defter; '(tüm hareketler)' = defter", async () => {
    const all = await report({ preset: "all" }, "Tümü");
    const marked = markedRows(all);
    assert.equal(marked.length, 2, "iki işaretli satır (20.09, 25.09)");
    assert.deepEqual(marked.map(row => row[0]).sort(), ["20.09.2026", "25.09.2026"]);
    for (const row of marked) assert.deepEqual([row[4], row[5], row[6]], ["", "", ""], "işaretli satırın Giriş / Çıkış / Bakiye hücreleri boş");
    assert.ok(marked.some(row => /Giriş 5\.000,00 TL/.test(row[3])) && marked.some(row => /Çıkış 1\.000,00 TL/.test(row[3])), "tutar açıklamada");
    assert.ok(!all.rows.some(row => row[0] === "03.10.2026" && COUNTED.test(row[3])), "Ziraat'e bağlı 03.10 satırı işaretlenmez");
    assert.equal(summary(all, "Devir"), 0);
    assert.equal(summary(all, "Dönem Giriş"), 650_000);
    assert.equal(summary(all, "Dönem Çıkış"), 0);
    assert.equal(summary(all, "Açılış ve Devir Düzeltmeleri"), 11_000_000);
    assert.equal(summary(all, "Dönem Sonu"), 11_650_000, "Dönem Sonu = 102 + 108");
    assert.equal(summary(all, "Banka (tüm hareketler)"), 11_350_000, "= 102");
    assert.equal(summary(all, "POS / Kredi Kartı (tüm hareketler)"), 300_000, "= 108");
    const balances = all.rows.map(row => moneyOf(row[6])).filter(value => value !== null);
    assert.equal(balances.at(-1), 11_650_000, "son satırın bakiyesi = Dönem Sonu");
    const footerIn = all.rows.map(row => moneyOf(row[4])).filter(value => value !== null).reduce((a, b) => a + b, 0);
    assert.equal(footerIn, 650_000, "Giriş kolonu toplamı = Dönem Giriş");

    const bank = await report({ preset: "all", payMethod: "bank" }, "Havale");
    assert.equal(markedRows(bank).length, 2);
    assert.equal(summary(bank, "Dönem Sonu"), 11_350_000, "Havale yolu = 102");
    assert.equal(summary(bank, "Dönem Giriş"), 350_000);
    const card = await report({ preset: "all", payMethod: "card" }, "POS");
    assert.equal(markedRows(card).length, 0);
    assert.equal(summary(card, "Dönem Sonu"), 300_000, "POS yolu = 108");

    // Hesaplar + kova (ayrı seçimler) = Tümü.
    const unassigned = await report({ preset: "all", anyAccount: "unassigned" }, "Atanmamış");
    const zir = await report({ preset: "all", anyAccount: ziraat.id }, "Ziraat");
    assert.equal(summary(zir, "Dönem Sonu"), 10_150_000, "Ziraat 101.500 (03.10 hesaplı satırı işaretlenmez)");
    assert.equal(markedRows(zir).length, 0);
    assert.equal(summary(unassigned, "Dönem Sonu"), 500_000, "kova");
  });

  it("dönem ortasından: devir açılışta sayılmış satırları düşer; yürüyen bakiye = Dönem Sonu", async () => {
    const mid = await report({ from: "2026-09-26", to: "2026-10-08" }, "26.09");
    assert.equal(summary(mid, "Devir"), 300_000, "devir yalnız 22.09 POS");
    assert.equal(moneyOf(mid.rows[0][6]), 300_000, "Devir satırı");
    assert.equal(summary(mid, "Dönem Sonu"), 11_650_000);
    assert.equal(mid.rows.map(row => moneyOf(row[6])).filter(value => value !== null).at(-1), 11_650_000);
    const early = await report({ from: "2026-09-21", to: "2026-10-08" }, "21.09");
    assert.equal(summary(early, "Devir"), 0, "20.09 açılışta sayıldı — devre girmez");
    assert.equal(markedRows(early).length, 1, "dönemde yalnız 25.09");
    assert.equal(summary(early, "Dönem Sonu"), 11_650_000);
  });

  it("PDF ve Excel: aynı sayılar (Devir, Dönem Sonu, '(tüm hareketler)'; işaretli satırlar)", async () => {
    const query = { from: "2026-09-26", to: "2026-10-08" };
    const data = await report(query, "26.09");
    const pdf = await ctx.api.raw("GET", `${RC}/${ID}/pdf?${qs(query)}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const [key, value] of data.summary) assert.ok(text.includes(key) && text.includes(value), `PDF özet "${key}: ${value}"`);
    const allPdf = pdfText((await ctx.api.raw("GET", `${RC}/${ID}/pdf?preset=all`)).buffer).replace(/\s+/g, " ");
    assert.ok(/Açılışta Sayıldı/.test(allPdf), "PDF'te işaretli satır");
    const xlsx = await ctx.api.raw("GET", `${RC}/${ID}/xlsx?${qs(query)}`);
    assert.equal(xlsx.status, 200);
    const sheets = xlsxSheets(xlsx.buffer);
    const ozet = Object.fromEntries((sheets["Özet"] || []).slice(1).map(([key, value]) => [key, value]));
    for (const key of ["Devir", "Dönem Sonu", "Banka (tüm hareketler)", "POS / Kredi Kartı (tüm hareketler)"]) {
      const value = ozet[key];
      assert.equal(typeof value === "number" ? Math.round(value * 100) : moneyOf(value), summary(data, key), `Excel Özet "${key}"`);
    }
  });
});
