// 2.5.0 S229 = A + S230 = A (kullanıcı 20.11.2026; kullanıcının 14.11 06:31 kuralıyla öneri uygulandı) — "Carinin Mevcut Borcu" kartının içine aldığı kısım faturada
// açık GÖRÜNMEZ: Açık Faturalar raporu (ekran + PDF + Excel + TOPLAM), Anlık Durum'un fatura özeti, fatura kartı ('Açık' + 'Taksit Kartında: <kart> · <tutar>'),
// Faturalar listesi (Kalan, Açık Bakiye, Ödeme Durumu süzgeci, PDF / Excel), Tahsilat Ekle / Mahsup Et'in ÖNERDİĞİ tutar. Kapama, Mahsup SINIRI, bakiye, gecikmiş
// ve birleşik listeler (net) DEĞİŞMEZ; karar (5) netleşmesi (alış faturası / Alacak Yaz) ve şüpheli kuyruğu (S213 = B) Açık Faturalar'a GİRMEZ.
// Sahte saat 08.10.2026 (test/banka-210-hesap-ortak.mjs); bütün faturalar 02.09 tarihli (numara / tarih sırası), vadeler ayrı. Beklenenler kararların sözünden ELLE (kod koşulmadan):
//  K1 kısmi (S229 örneği, tarihler sahte saate taşındı): F1 50.000 (02.09, vade 20.09) + Borç Yaz 30.000 (05.09); 25.09'da Mevcut Borç kartı 60.000 (2 × 30.000; 01.11 / 01.12)
//     → S200 = A: kart önce elle borcu (30.000), eksik 30.000'i F1'den alır. Açık Faturalar F1 Kalan 20.000, 18 gün gecikmiş, TOPLAM Alacak 20.000; Anlık Durum açık / vadesi
//     geçen satış 20.000; fatura kartı Açık 20.000, 'Taksit Kartında · 30.000'; liste Kalan 20.000, 'Vadesi Geçti'; Mahsup önerisi 20.000, sınırı 50.000. Bakiye 80.000, gecikmiş 20.000.
//  K2 tam: F 50.000 (vade 20.09), kart 50.000 → Açık Faturalar'da YOK; Anlık Durum 0; fatura 'Taksitte' (Açık 0); 'Açık' süzgecinde VAR, 'Ödenmedi'de YOK; 'Taksit Kartında · 50.000'.
//  K3 iki kart: F 50.000; kart 20.000, sonra kart 10.000 → F 20.000; iki 'Taksit Kartında' satırı (20.000 + 10.000).
//  K4 elle borç + iki fatura (S200 sırası): F1 30.000 (vade 10.09), F2 40.000 (vade 30.09), Borç Yaz 20.000; kart 60.000 → elle 20.000, F1 30.000 (vadesi önce), F2 10.000 →
//     F1 Taksitte (listede yok), F2 Kalan 30.000.
//  K5 kart tahsilatı (S118 = B): K1'in kartına 40.000 → F1 gösterilen açık yine 20.000 (kart ödemesi önce elle borca, sonra F1'in kart payına); 'Taksit Kartında · 20.000'; bakiye 40.000.
//  K6 Alacak Yaz'lı cari + alış faturası (karar (5) Açık Faturalar'a GİRMEZ): F 50.000, Alacak Yaz 10.000, alış faturası 6.000, kart 20.000 → Açık Faturalar satış F 30.000 (40.000 / 20.000 DEĞİL),
//     alış 6.000 kendi satırında.
//  K7 şüpheli (S213 = B): F 50.000, kart 20.000, şüpheliye alma 10.000 → Açık Faturalar F 30.000 (listede kalır).
//  K8 kart silinir → F yeniden kendi açığıyla (50.000); Kartı Kapat 'Borçta Kalsın' → kart borcu taşımayı sürdürür, F 20.000 (K1 gibi) kalır.
//  K9 fatura iptali (S210 = A): K1 kurulumu, F1 İptal Et → Açık Faturalar'da yok, liste 'İptal'.
//  K10 eski kapama düzeni (legacyClosing): kısmi (F 50.000, kart 30.000 → 20.000) ve tam (Taksitte) aynı.
//  K11 mahsup edilmemiş iade belgesi (K1): değişmez — kendi satırında.
//  K12 yetkili Muhasebe kullanıcısı: Açık Faturalar ve fatura kartı yöneticiyle AYNI sayılar; Personel 403 (bugünkü gibi).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { settleInvoices } from "../server/lib/invoice-settle.mjs";

const W = "/api/workspace";
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};

function harness(getCtx) {
  let n = 0;
  const api = () => getCtx().api;
  const h = {
    acc: async name => (await must("cari", api().post(`${W}/accounts`, { name: `${name} ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id,
    sale: async (accountId, gross, date, dueDate) => (await must("satış", api().post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment: { rest: "open", dueDate } }))).id,
    purchase: async (accountId, gross, date) => (await must("alış", api().post(`${W}/invoices`, { scenario: "expense_purchase", accountId, number: `ALS${(n += 1)}`, issueDate: date, lines: [{ name: "Gider", qty: 1, unitPrice: gross / 1.2, vatRate: 20, expenseCode: "other" }], payment: { rest: "open", dueDate: date } }))).id,
    entry: (accountId, kind, amount, date, extra = {}) => must(kind, api().post(`${W}/accounts/${accountId}/entries`, { kind, amount: String(amount), date, note: `${kind} ${amount}`, ...extra })),
    card: async (accountId, total, count, name = `Mevcut ${n}`) => (await must("Mevcut Borç kartı", api().post(`${W}/plans`, { accountId, name, total: String(total), registeredOn: "2026-09-25", mode: "auto", count, firstDue: "2026-11-01", coversBalance: true }))).id,
    open: async accountId => {
      const r = await must("Açık Faturalar", api().get(`${W}/report-center/acik-faturalar?account=${accountId}`));
      const at = name => r.headers.indexOf(name);
      return {
        rows: r.rows.map(row => ({ no: row[at("Fatura No")], kalan: moneyOf(row[at("Kalan")]), taraf: row[at("Taraf")], gecikme: row[at("Gecikme")] })),
        alacak: moneyOf(r.summary.find(([k]) => k === "Açık Alacak")?.[1]),
        borc: moneyOf(r.summary.find(([k]) => k === "Açık Borç")?.[1]),
        footers: (r.footers || []).map(line => [line[0], moneyOf(line[at("Kalan")])]),
      };
    },
    doc: id => must("fatura kartı", api().get(`${W}/invoices/${id}`)),
    list: (accountId, pay = "") => must("Faturalar", api().get(`${W}/invoices?tab=all&account=${accountId}${pay ? `&pay=${pay}` : ""}`)),
    totals: async id => (await must("cari kartı", api().get(`${W}/accounts/${id}`))).totals,
    numberOf: id => getCtx().store.get("SELECT number FROM invoices WHERE id = ?", id).number,
  };
  return h;
}

describe("S229 = A + S230 = A — Mevcut Borç kartının aldığı kısım faturada açık görünmez", () => {
  let ctx;
  const h = harness(() => ctx);
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx?.server.close());

  it("K1 kısmi (S200 = A sırası): Açık Faturalar 20.000 + TOPLAM; fatura kartı; liste; Anlık Durum; Mahsup önerisi 20.000, sınırı 50.000; bakiye / gecikmiş değişmez", async () => {
    const A = await h.acc("S229 K1");
    const f1 = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    await h.entry(A, "debt", 30000, "2026-09-05", { dueDate: "2026-11-15" });
    const before = (await must("Anlık Durum", ctx.api.get(`${W}/overview`))).invoices;
    const p = await h.card(A, 60000, 2, "S229 Kartı");
    const after = (await must("Anlık Durum", ctx.api.get(`${W}/overview`))).invoices;
    const open = await h.open(A);
    assert.deepEqual(open.rows, [{ no: h.numberOf(f1), kalan: 20000, taraf: "Alacak (Satış)", gecikme: "18 gün" }], `Açık Faturalar F1: ${JSON.stringify(open.rows)} (20.000 beklendi — kartın aldığı 30.000 düşülür)`);
    assert.equal(open.alacak, 20000, "Açık Alacak özeti");
    assert.deepEqual(open.footers, [["TOPLAM", 20000]], `TOPLAM satırı ${JSON.stringify(open.footers)}`);
    // Anlık Durum: bu cari özete kart açılınca 50.000 yerine 20.000 katkı verir (öteki cariler değişmez).
    assert.equal(Math.round((after.openSale - before.openSale) * 100) / 100, -30000, `Anlık Durum açık satış farkı ${after.openSale - before.openSale} (−30.000 beklendi)`);
    assert.equal(Math.round((after.overdueSale - before.overdueSale) * 100) / 100, -30000, "Anlık Durum vadesi geçen satış farkı");
    const doc = await h.doc(f1);
    assert.equal(doc.open, 20000, `fatura kartı Açık ${doc.open} (20.000 beklendi)`);
    assert.equal(doc.ownOpen, 50000, "faturanın kendi açığı");
    assert.equal(doc.inPlan, 30000);
    assert.equal(doc.payState, "overdue");
    assert.deepEqual(doc.inPlans.map(item => [item.planId, item.name, item.amount]), [[p, "S229 Kartı", 30000]], "Taksit Kartında satırı");
    const list = await h.list(A);
    const row = list.invoices.find(item => item.id === f1);
    assert.equal(row.open, 20000, `Faturalar listesi Kalan ${row.open}`);
    assert.equal(list.totals.open, 20000, "Açık Bakiye");
    assert.equal(list.totals.overdue, 20000, "Vadesi Geçmiş");
    const offsets = await must("Mahsup adayları", ctx.api.get(`${W}/invoices/${f1}/offsets`));
    assert.equal(offsets.suggest, 20000, `Mahsup önerisi ${offsets.suggest}`);
    assert.equal(offsets.open, 50000, "Mahsup SINIRI faturanın kendi açığı (değişmez)");
    const t = await h.totals(A);
    assert.equal(t.balance, 80000);
    assert.equal(t.overdueDebt, 20000, "gecikmiş (iki okumada aynı)");
  });

  it("K2 tam: Açık Faturalar'da yok, Anlık Durum'a girmez, 'Taksitte'; Ödeme Durumu süzgeçleri; PDF / Excel", async () => {
    const B = await h.acc("S229 K2");
    const f = await h.sale(B, 50000, "2026-09-02", "2026-09-20");
    const before = (await must("Anlık Durum", ctx.api.get(`${W}/overview`))).invoices;
    const p = await h.card(B, 50000, 2, "Tam Kart");
    const after = (await must("Anlık Durum", ctx.api.get(`${W}/overview`))).invoices;
    const open = await h.open(B);
    assert.deepEqual(open.rows, [], `kartın tamamını aldığı fatura listede: ${JSON.stringify(open.rows)}`);
    assert.equal(open.alacak, 0);
    assert.equal(Math.round((after.openSale - before.openSale) * 100) / 100, -50000, "Anlık Durum açık satış");
    const doc = await h.doc(f);
    assert.equal(doc.open, 0, `fatura kartı Açık ${doc.open}`);
    assert.equal(doc.payState, "installment");
    assert.equal(doc.payStateLabel, "Taksitte");
    assert.deepEqual(doc.inPlans.map(item => [item.planId, item.amount]), [[p, 50000]]);
    const ids = async pay => (await h.list(B, pay)).invoices.map(item => item.id);
    assert.deepEqual(await ids("open"), [f], "'Açık' süzgeci (taksitli gibi)");
    assert.deepEqual(await ids("installment"), [f], "'Taksitte' süzgeci");
    assert.deepEqual(await ids("unpaid"), [], "'Ödenmedi' süzgecinde yok");
    assert.deepEqual(await ids("overdue"), [], "'Vadesi Geçti' süzgecinde yok");
    assert.deepEqual(await ids("paid"), [], "'Ödendi' süzgecinde yok");
    assert.equal((await h.list(B)).totals.open, 0, "Açık Bakiye");
    // Faturalar Excel'i: Kalan 0, Ödeme Durumu Taksitte.
    const xlsx = await ctx.api.raw("GET", `${W}/invoices/export.xlsx?tab=all&account=${B}`);
    assert.equal(xlsx.status, 200);
    const sheets = xlsxSheets(xlsx.buffer);
    const sheet = Object.values(sheets)[0];
    const head = sheet.findIndex(line => line.includes("Kalan (TL)"));
    const cols = sheet[head];
    const line = sheet.slice(head + 1).find(cells => cells.includes(h.numberOf(f)));
    assert.equal(line[cols.indexOf("Ödeme Durumu")], "Taksitte");
    assert.ok(["0,00", "0", 0].includes(line[cols.indexOf("Kalan (TL)")]), `Excel Kalan ${line[cols.indexOf("Kalan (TL)")]}`);
  });

  it("K2b Açık Faturalar PDF ve Excel TOPLAM'ı ekranla aynı (kısmi kart)", async () => {
    const C = await h.acc("S229 PDF");
    await h.sale(C, 50000, "2026-09-02", "2026-09-20");
    await h.card(C, 30000, 1);
    const pdfRes = await ctx.api.raw("GET", `${W}/report-center/acik-faturalar/pdf?account=${C}`);
    assert.equal(pdfRes.status, 200);
    const pdf = pdfText(pdfRes.buffer);
    // Satır Kalan + TOPLAM Kalan (+ özet) 20.000; 50.000 yalnız Fatura Tutarı sütununda (satır + TOPLAM). Tabanda Kalan da 50.000 (4 kez), 20.000 hiç yok.
    const count = text => pdf.split(text).length - 1;
    assert.ok(count("20.000,00") >= 2, `PDF'te 20.000,00 ${count("20.000,00")} kez`);
    assert.ok(count("50.000,00") <= 2, `PDF'te 50.000,00 ${count("50.000,00")} kez (Kalan 50.000 gösterilmemeli)`);
    const xRes = await ctx.api.raw("GET", `${W}/report-center/acik-faturalar/xlsx?account=${C}`);
    assert.equal(xRes.status, 200);
    const sheet = Object.values(xlsxSheets(xRes.buffer))[0];
    const head = sheet.findIndex(line => line.includes("Kalan"));
    const col = sheet[head].indexOf("Kalan");
    const values = sheet.slice(head + 1).map(line => line[col]).filter(value => value !== undefined && value !== "");
    const nums = values.map(value => (typeof value === "number" ? value : moneyOf(value) ?? Number(String(value).replace(/\./g, "").replace(",", "."))));
    assert.ok(nums.every(value => value === 20000), `Excel Kalan sütunu (satır + TOPLAM) ${JSON.stringify(values)}`);
  });

  it("K3 iki kart: gösterilen açık iki kartın payı düşülmüş; iki 'Taksit Kartında' satırı", async () => {
    const D = await h.acc("S229 K3");
    const f = await h.sale(D, 50000, "2026-09-02", "2026-09-20");
    const p1 = await h.card(D, 20000, 1, "Birinci");
    const p2 = await h.card(D, 10000, 1, "İkinci");
    assert.deepEqual((await h.open(D)).rows.map(r => r.kalan), [20000]);
    const doc = await h.doc(f);
    assert.equal(doc.open, 20000);
    assert.deepEqual(doc.inPlans.map(item => [item.planId, item.amount]).sort(), [[p1, 20000], [p2, 10000]].sort());
    assert.equal((await h.totals(D)).balance, 50000);
  });

  it("K4 elle borç + iki fatura: kart önce elle borcu, sonra vadesi önce gelen faturayı alır", async () => {
    const E = await h.acc("S229 K4");
    const f1 = await h.sale(E, 30000, "2026-09-02", "2026-09-10");
    const f2 = await h.sale(E, 40000, "2026-09-02", "2026-09-30");
    await h.entry(E, "debt", 20000, "2026-09-03");
    await h.card(E, 60000, 2);
    const open = await h.open(E);
    assert.deepEqual(open.rows.map(r => [r.no, r.kalan]), [[h.numberOf(f2), 30000]], `Açık Faturalar ${JSON.stringify(open.rows)}`);
    assert.equal((await h.doc(f1)).payState, "installment");
    assert.equal((await h.doc(f2)).open, 30000);
    assert.equal((await h.totals(E)).balance, 90000);
  });

  it("K5 kartın taksiti tahsil edilir: fatura gösterilen açığı DEĞİŞMEZ; kart payı azalır", async () => {
    const A = await h.acc("S229 K5");
    const f1 = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    await h.entry(A, "debt", 30000, "2026-09-05");
    const p = await h.card(A, 60000, 2);
    await must("taksit tahsilatı", ctx.api.post(`${W}/plans/${p}/entries`, { kind: "in", amount: "40000", date: "2026-10-05", method: "cash" }));
    const doc = await h.doc(f1);
    assert.equal(doc.open, 20000, `Açık ${doc.open}`);
    assert.deepEqual(doc.inPlans.map(item => item.amount), [20000]);
    assert.deepEqual((await h.open(A)).rows.map(r => r.kalan), [20000]);
    assert.equal((await h.totals(A)).balance, 40000);
  });

  it("K6 Alacak Yaz + alış faturası: karar (5) netleşmesi Açık Faturalar'a GİRMEZ", async () => {
    const G = await h.acc("S229 K6");
    const f = await h.sale(G, 50000, "2026-09-02", "2026-09-20");
    await h.entry(G, "credit", 10000, "2026-09-02");
    const buy = await h.purchase(G, 6000, "2026-09-02");
    await h.card(G, 20000, 1);
    const open = await h.open(G);
    assert.deepEqual(open.rows.map(r => [r.no, r.taraf, r.kalan]).sort(), [[h.numberOf(f), "Alacak (Satış)", 30000], [h.numberOf(buy), "Borç (Alış)", 6000]].sort(), JSON.stringify(open.rows));
    assert.equal((await h.doc(f)).open, 30000);
  });

  it("K7 şüpheliye alınmış fatura listede kalır (S213 = B); kart payı yine düşer", async () => {
    const H = await h.acc("S229 K7");
    const f = await h.sale(H, 50000, "2026-09-02", "2026-09-20");
    await h.card(H, 20000, 1);
    await must("şüpheliye al", ctx.api.post(`${W}/accounts/${H}/doubtful`, { amount: "10000", date: "2026-10-01", reason: "lawsuit" }));
    assert.deepEqual((await h.open(H)).rows.map(r => [r.no, r.kalan]), [[h.numberOf(f), 30000]]);
  });

  it("K8 kart silinir → fatura kendi açığıyla; Kartı Kapat 'Borçta Kalsın' → kart payı sürer", async () => {
    const A = await h.acc("S229 K8a");
    const f = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    const p = await h.card(A, 30000, 1);
    assert.equal((await h.doc(f)).open, 20000);
    await must("kart sil", ctx.api.del(`${W}/plans/${p}`));
    assert.equal((await h.doc(f)).open, 50000, "kart silinince payı faturaya döner");
    assert.deepEqual((await h.open(A)).rows.map(r => r.kalan), [50000]);
    const B = await h.acc("S229 K8b");
    const g = await h.sale(B, 50000, "2026-09-02", "2026-09-20");
    const q = await h.card(B, 30000, 1);
    const left = (await must("kart", ctx.api.get(`${W}/plans/${q}`))).totals.remaining;
    await must("Kartı Kapat", ctx.api.put(`${W}/plans/${q}`, { status: "closed", closeRemaining: left }));
    const doc = await h.doc(g);
    assert.equal(doc.open, 20000, `Borçta Kalsın: Açık ${doc.open}`);
    assert.deepEqual((await h.open(B)).rows.map(r => r.kalan), [20000]);
    assert.equal((await h.totals(B)).balance, 50000);
  });

  it("K9 fatura iptali (S210 = A): Açık Faturalar'da yok, listede 'İptal'", async () => {
    const A = await h.acc("S229 K9");
    const f1 = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    await h.entry(A, "debt", 30000, "2026-09-05");
    await h.card(A, 60000, 2);
    await must("iptal", ctx.api.post(`${W}/invoices/${f1}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));
    assert.deepEqual((await h.open(A)).rows, []);
    const row = (await h.list(A)).invoices.find(item => item.id === f1);
    assert.equal(row.status, "cancelled");
    assert.equal((await h.list(A)).totals.open, 0);
  });


  it("K12 Muhasebe kullanıcısı: Açık Faturalar ve fatura kartı yöneticiyle aynı", async () => {
    const A = await h.acc("S229 K12");
    const f = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    await h.card(A, 30000, 1);
    const client = await createUser(ctx.server, ctx.api.client, { username: `muh${Date.now() % 100000}`, role: "muhasebe" });
    const get = async url => {
      const res = await client.get(url);
      return { status: res.status, data: res.data?.data };
    };
    const report = await get(`${W}/report-center/acik-faturalar?account=${A}`);
    const doc = await get(`${W}/invoices/${f}`);
    // Muhasebe rolü Finans Raporları (overview.view) ve Faturaları Görme (invoices.view) yetkili: 200 ve yöneticiyle aynı sayılar.
    assert.equal(report.status, 200, `Muhasebe Açık Faturalar ${report.status}`);
    assert.deepEqual(report.data.rows, (await must("yönetici", ctx.api.get(`${W}/report-center/acik-faturalar?account=${A}`))).rows);
    assert.equal(doc.status, 200);
    assert.equal(doc.data.open, 20000);
    // Yetkisiz (Personel): rapor ve fatura kartı kapalı (bugünkü gibi).
    const staff = await createUser(ctx.server, ctx.api.client, { username: `per${Date.now() % 100000}`, role: "personel" });
    assert.equal((await staff.get(`${W}/report-center/acik-faturalar?account=${A}`)).status, 403);
    assert.equal((await staff.get(`${W}/invoices/${f}`)).status, 403);
  });
  it("K11 mahsup edilmemiş iade belgesi kendi satırında (değişmez)", async () => {
    const A = await h.acc("S229 K11");
    const f = (await must("peşin satış", ctx.api.post(`${W}/invoices`, { scenario: "service_sale", accountId: A, issueDate: "2026-09-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: 10000 / 1.2, vatRate: 20 }], payment: { cash: [{ amount: "10000", method: "cash" }] } }))).id;
    const line = (await h.doc(f)).lines[0].id;
    const ret = await must("iade", ctx.api.post(`${W}/invoices`, { kind: "sale_return", accountId: A, originalId: f, issueDate: "2026-09-10", lines: [{ originLineId: line, qty: 0.2 }], payment: { cash: [] }, force: true }));
    const rows = (await h.open(A)).rows;
    assert.deepEqual(rows.map(r => [r.no, r.taraf, r.kalan]), [[h.numberOf(ret.id), "Borç (Satıştan İade)", 2000]], JSON.stringify(rows));
  });

});

describe("S229 / S230 — eski kapama düzeni (legacyClosing) aynı kural", () => {
  let ctx;
  const h = harness(() => ctx);
  before(async () => {
    ctx = await bootBank({ legacyClosing: settleInvoices });
  });
  after(() => ctx?.server.close());
  it("K10 kısmi 20.000 ve tam 'Taksitte'", async () => {
    const A = await h.acc("S229 eski kısmi");
    const f = await h.sale(A, 50000, "2026-09-02", "2026-09-20");
    await h.card(A, 30000, 1);
    assert.deepEqual((await h.open(A)).rows.map(r => r.kalan), [20000]);
    assert.equal((await h.doc(f)).open, 20000);
    assert.equal((await h.list(A)).invoices.find(item => item.id === f).open, 20000);
    const B = await h.acc("S229 eski tam");
    const g = await h.sale(B, 50000, "2026-09-02", "2026-09-20");
    await h.card(B, 50000, 2);
    assert.deepEqual((await h.open(B)).rows, []);
    const doc = await h.doc(g);
    assert.equal(doc.payState, "installment");
    assert.equal(doc.open, 0);
  });
});
