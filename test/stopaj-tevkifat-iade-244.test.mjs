// 2.4.4 MM3 (uzman mali müşavir 31b) — Stopaj ve Tevkifat Özeti: iade belgesi asıl belgenin TARAFINDA ve EKSİ.
// KURAL (Tekdüzen Hesap Planı + KDV tevkifatı; programın defteri — server/lib/general-ledger.mjs journal() — aynı yönü yazar):
//   satış / SMM      : karşı tarafın (müşterinin) bizden kestiği — stopaj B 193; KDV tevkifatını alıcı öder (A 391 o kadar az)  → artı
//   satıştan iade    : aynı taraf, EKSİ — asıl satışın tevkifatı ters yönde azalır (B 391 (KDV − tevkifat)); 360'a yazılmaz
//   alış             : bizim kestiğimiz — A 360 (tevkifat + stopaj)                                                            → artı
//   alıştan iade     : aynı taraf, EKSİ — B 360 (tevkifat + stopaj)
// Rapor defterle (193 / 360 hareketi) ve KDV Özeti ile ("Alıcı Olarak Kesilen Tevkifat (2 No.lu)") aynı sayıyı verir.
// Eski kodda (ad865f0; 2.4.3'te de aynı satır) satıştan iade "Bizim kestiğimiz (360)" ve ARTI sayılıyordu (tevkifatlı satış + iadesi → defterde 360
// yokken "Bizim Ödeyeceğimiz Tevkifat 1.800"); alıştan iade "Bizden kesilen (193)" ve stopajı "Bizden Kesilen Stopaj"a ARTI ekleniyordu; iki taraf
// karışınca TOPLAM satırı hiç çıkmıyordu (footerUniform).
//
// Nasıl bozulur? (işe başlarken yazıldı): 1 tam iade · 2 kısmi iade · 3 iadenin iptali · 4 farklı dönem (satış Eylül, iade Ekim) · 5 alıştan iade
// (stopaj + tevkifat) · 6 tevkifatsız iade · 7 002 şirketi · 8 TOPLAM her süzgeçte, ekran/PDF/Excel aynı · 9 defter ve KDV Özeti ile aynı sayı ·
// 10 yetkisiz kullanıcı.
//
// BEKLENEN (elle, belge tutarlarından; programın kodundan değil). Tevkifat 602 ve 612 = 9/10. Saat sabit (config.now) 20.11.2026.
//   Eylül  SMM-1   Kurum A.Ş.  10.000 + KDV, stopaj %20        → 193 tarafı  matrah 10.000  stopaj 2.000  tevkifat 0
//          S1      Beta        2 × 5.000 + KDV, 602             → 193 tarafı  matrah 10.000                tevkifat 1.800
//          S2      Beta        10.000 + KDV, 602                → 193 tarafı  matrah 10.000                tevkifat 1.800
//          P1      Temizlik    2 × 5.000 + KDV, 612             → 360 tarafı  matrah 10.000                tevkifat 1.800
//          P2      Avukat      10.000 + KDV, stopaj %20         → 360 tarafı  matrah 10.000  stopaj 2.000
//   Ekim   R1 = S1'in kısmi iadesi (1 adet)                     → 193 tarafı  matrah −5.000               tevkifat −900
//          R2 = S2'nin tam iadesi (farklı dönem)                → 193 tarafı  matrah −10.000              tevkifat −1.800
//          S3 + R3 tevkifatsız satış ve tam iadesi              → raporda YOK
//          PR1 = P1'in kısmi iadesi (1 adet)                    → 360 tarafı  matrah −5.000               tevkifat −900
//          PR2 = P2'nin tam iadesi                              → 360 tarafı  matrah −10.000  stopaj −2.000
//          S4 1.000 + KDV, 602 (tevkifat 180) + R4 tam iadesi, R4 İPTAL → yalnız S4 (193, matrah 1.000, tevkifat 180)
//   Özet   Eylül: Bizden Kesilen Stopaj 2.000 · Bizim Ödeyeceğimiz Stopaj 2.000 · Bizim Ödeyeceğimiz Tevkifat 1.800
//          Ekim : 0 · −2.000 · −900          Bu Yıl: 2.000 · 0 · 900
//   TOPLAM Bu Yıl: 193 tarafı matrah 16.000, stopaj 2.000, tevkifat 1.080 · 360 tarafı matrah 5.000, stopaj 0, tevkifat 900
//   Defter: 193 borç hareketi = Bizden Kesilen Stopaj; 360 (faturalardan) alacak − borç = Bizim Ödeyeceğimiz Stopaj + Tevkifat
//   KDV Özeti: Alıcı Olarak Kesilen Tevkifat (2 No.lu) = Bizim Ödeyeceğimiz Tevkifat; TOPLAM Satış − TOPLAM Satıştan İade tevkifatı = 193 tarafı TOPLAM tevkifat
//   002: T1 10.000 + KDV, 602 (1.800) ve tam iadesi (Ekim) → 193 tarafı +1.800 / −1.800, Bizim Ödeyeceğimiz Tevkifat 0; 001 raporuna karışmaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const NOW = "2026-11-20T12:00:00+03:00";
const INV = "/api/workspace/invoices";
const REPORT = "/api/workspace/report-center";
const THEIRS = "Bizden kesilen (193)";
const OURS = "Bizim kestiğimiz (360)";
const GROUP = { [THEIRS]: "TOPLAM Bizden Kesilen (193)", [OURS]: "TOPLAM Bizim Kestiğimiz (360)" };
const SEPTEMBER = "from=2026-09-01&to=2026-09-30";
const OCTOBER = "from=2026-10-01&to=2026-10-31";

const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const r2 = value => Math.round((value + Number.EPSILON) * 100) / 100 || 0;
const summaryOf = (data, label) => {
  const item = data.summary.find(([key]) => key === label);
  assert.ok(item, `özette "${label}" yok: ${JSON.stringify(data.summary)}`);
  return moneyOf(item[1]);
};
const objects = data => data.rows.map(row => Object.fromEntries(data.headers.map((header, index) => [header, row[index]])));
// Rapor satırı: belge no → { taraf, matrah, stopaj, tevkifat } (tutarlar sayı).
const byNumber = data =>
  Object.fromEntries(objects(data).map(row => [row["Belge No"], { side: row.Taraf, net: moneyOf(row.Matrah), stoppage: moneyOf(row.Stopaj), withheld: moneyOf(row["KDV Tevkifatı"]) }]));

describe("2.4.4 MM3 — Stopaj ve Tevkifat Özeti: iade asıl belgenin tarafında eksi; defter ve KDV Özeti ile aynı", () => {
  let ctx;
  let api;
  const no = {};
  let q2 = "";
  const report = (id, query = "", co = "") => must(`${id} ${query}`, api.get(`${REPORT}/${id}?${[query, co].filter(Boolean).join("&")}`));
  const stopaj = (query, co) => report("stopaj-tevkifat", query, co);
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    const acc = async (name, type, co = "") => (await must(name, api.post(`/api/workspace/accounts${co ? `?${co}` : ""}`, { name, type }))).id;
    const kurum = await acc("Kurum A.Ş.", "customer");
    const beta = await acc("Beta Gıda Ltd.", "customer");
    const temizlik = await acc("Temizlik Ltd.", "supplier");
    const avukat = await acc("Av. Deniz Yılmaz", "supplier");
    const issue = async (label, body, co = "") => {
      const created = await must(label, api.post(`${INV}${co ? `?${co}` : ""}`, { payment: { rest: "open" }, ...body }));
      no[label] = created.number;
      return created;
    };
    const lineOf = async (id, co = "") => (await must("detay", api.get(`${INV}/${id}${co ? `?${co}` : ""}`))).lines[0].id;
    // Eylül (serideki tarih sırasıyla: FIS serisi kronolojik).
    await issue("SMM-1", { kind: "smm", scenario: "smm", accountId: kurum, issueDate: "2026-09-10", stoppageRate: 20, lines: [{ name: "Hukuki Danışmanlık", qty: 1, unitPrice: 10000, vatRate: 20 }] });
    const s1 = await issue("S1", { scenario: "service_sale", accountId: beta, issueDate: "2026-09-15", lines: [{ name: "Proje Danışmanlığı", qty: 2, unitPrice: 5000, vatRate: 20, withholdingCode: "602" }] });
    const s2 = await issue("S2", { scenario: "service_sale", accountId: beta, issueDate: "2026-09-20", lines: [{ name: "Etüt Hizmeti", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "602" }] });
    const p1 = await issue("P1", { kind: "purchase", scenario: "expense_purchase", accountId: temizlik, issueDate: "2026-09-22", number: "TMZ-9", lines: [{ name: "Temizlik Hizmeti", qty: 2, unitPrice: 5000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }] });
    const p2 = await issue("P2", { kind: "purchase", scenario: "expense_purchase", accountId: avukat, issueDate: "2026-09-25", number: "SMM-77", stoppageRate: 20, lines: [{ name: "Avukatlık Hizmeti", qty: 1, unitPrice: 10000, vatRate: 20, expenseCode: "office" }] });
    // Ekim: iadeler (kısmi / tam / farklı dönem), tevkifatsız satış ve iadesi, iptal edilen iade.
    await issue("R1", { kind: "sale_return", originalId: s1.id, issueDate: "2026-10-05", number: "BETA-IAD-1", lines: [{ originLineId: await lineOf(s1.id), qty: 1 }] });
    await issue("R2", { kind: "sale_return", originalId: s2.id, issueDate: "2026-10-10", number: "BETA-IAD-2", lines: [{ originLineId: await lineOf(s2.id), qty: 1 }] });
    const s3 = await issue("S3", { scenario: "service_sale", accountId: beta, issueDate: "2026-10-12", lines: [{ name: "Eğitim", qty: 1, unitPrice: 3000, vatRate: 20 }] });
    await issue("R3", { kind: "sale_return", originalId: s3.id, issueDate: "2026-10-13", number: "BETA-IAD-3", lines: [{ originLineId: await lineOf(s3.id), qty: 1 }] });
    await issue("PR1", { kind: "purchase_return", originalId: p1.id, issueDate: "2026-10-15", lines: [{ originLineId: await lineOf(p1.id), qty: 1 }] });
    await issue("PR2", { kind: "purchase_return", originalId: p2.id, issueDate: "2026-10-16", lines: [{ originLineId: await lineOf(p2.id), qty: 1 }] });
    const s4 = await issue("S4", { scenario: "service_sale", accountId: beta, issueDate: "2026-10-20", lines: [{ name: "Raporlama", qty: 1, unitPrice: 1000, vatRate: 20, withholdingCode: "602" }] });
    const r4 = await issue("R4", { kind: "sale_return", originalId: s4.id, issueDate: "2026-10-21", number: "BETA-IAD-4", lines: [{ originLineId: await lineOf(s4.id), qty: 1 }] });
    await must("R4 iptal", api.post(`${INV}/${r4.id}/cancel`, { reason: "Yanlış iade" }));
    // 002: tevkifatlı satış ve tam iadesi.
    const second = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    q2 = `hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const gamma = await acc("Gama İnşaat A.Ş.", "customer", q2);
    const t1 = await issue("T1", { scenario: "service_sale", accountId: gamma, issueDate: "2026-10-01", lines: [{ name: "Proje Yönetimi", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "602" }] }, q2);
    await issue("T1-IADE", { kind: "sale_return", originalId: t1.id, issueDate: "2026-10-02", number: "GAMA-IAD-1", lines: [{ originLineId: await lineOf(t1.id, q2), qty: 1 }] }, q2);
    await integrityOk(api, "kurulum");
  });
  after(() => ctx?.server.close());

  it("Eylül (yalnız asıl belgeler): taraflar ve özet", async () => {
    const data = await stopaj(SEPTEMBER);
    const rows = byNumber(data);
    assert.deepEqual(rows[no["SMM-1"]], { side: THEIRS, net: 10000, stoppage: 2000, withheld: 0 });
    assert.deepEqual(rows[no.S1], { side: THEIRS, net: 10000, stoppage: 0, withheld: 1800 });
    assert.deepEqual(rows[no.S2], { side: THEIRS, net: 10000, stoppage: 0, withheld: 1800 });
    assert.deepEqual(rows[no.P1], { side: OURS, net: 10000, stoppage: 0, withheld: 1800 });
    assert.deepEqual(rows[no.P2], { side: OURS, net: 10000, stoppage: 2000, withheld: 0 });
    assert.equal(data.rows.length, 5);
    assert.equal(summaryOf(data, "Bizden Kesilen Stopaj"), 2000);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj"), 2000);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat"), 1800);
  });

  it("Ekim: satıştan iade karşı tarafın kestiğinde (193) EKSİ, alıştan iade bizim kestiğimizde (360) EKSİ; tevkifatsız ve iptal edilen iade yok", async () => {
    const data = await stopaj(OCTOBER);
    const rows = byNumber(data);
    assert.deepEqual(rows[no.R1], { side: THEIRS, net: -5000, stoppage: 0, withheld: -900 }, "kısmi iade");
    assert.deepEqual(rows[no.R2], { side: THEIRS, net: -10000, stoppage: 0, withheld: -1800 }, "tam iade, satış Eylül'de");
    assert.deepEqual(rows[no.PR1], { side: OURS, net: -5000, stoppage: 0, withheld: -900 }, "alıştan kısmi iade (tevkifat)");
    assert.deepEqual(rows[no.PR2], { side: OURS, net: -10000, stoppage: -2000, withheld: 0 }, "alıştan tam iade (stopaj)");
    assert.deepEqual(rows[no.S4], { side: THEIRS, net: 1000, stoppage: 0, withheld: 180 }, "iadesi iptal edilen satış kalır");
    assert.equal(rows[no.R3], undefined, "tevkifatsız iade rapora girmez");
    assert.equal(rows[no.S3], undefined, "tevkifatsız satış rapora girmez");
    assert.equal(rows[no.R4], undefined, "iptal edilen iade rapora girmez");
    assert.equal(data.rows.length, 5);
    assert.equal(summaryOf(data, "Bizden Kesilen Stopaj"), 0);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj"), -2000);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat"), -900);
  });

  it("Bu Yıl: özet ve her tarafın TOPLAM satırı (elle hesap)", async () => {
    const data = await stopaj("preset=thisYear");
    assert.equal(summaryOf(data, "Bizden Kesilen Stopaj"), 2000);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj"), 0, "alıştan iade stopajı düşer");
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat"), 900, "1.800 − 900; satıştan iadeler 360'a yazılmaz");
    const footers = Object.fromEntries((data.footers || []).map(line => [line[data.headers.indexOf("Taraf")], Object.fromEntries(data.headers.map((header, index) => [header, line[index]]))]));
    assert.deepEqual(Object.keys(footers), [GROUP[THEIRS], GROUP[OURS]], `iki tarafın TOPLAM satırı: ${JSON.stringify(data.footers)}`);
    assert.deepEqual([moneyOf(footers[GROUP[THEIRS]].Matrah), moneyOf(footers[GROUP[THEIRS]].Stopaj), moneyOf(footers[GROUP[THEIRS]]["KDV Tevkifatı"])], [16000, 2000, 1080]);
    assert.deepEqual([moneyOf(footers[GROUP[OURS]].Matrah), moneyOf(footers[GROUP[OURS]].Stopaj), moneyOf(footers[GROUP[OURS]]["KDV Tevkifatı"])], [5000, 0, 900]);
  });

  it("defter (193 / 360 hareketi) ve KDV Özeti ile aynı sayı: Eylül, Ekim, Bu Yıl", async () => {
    for (const [label, query, from, to] of [["Eylül", SEPTEMBER, "2026-09-01", "2026-09-30"], ["Ekim", OCTOBER, "2026-10-01", "2026-10-31"], ["Bu Yıl", "preset=thisYear", "2026-01-01", "2026-12-31"]]) {
      const data = await stopaj(query);
      const trial = Object.fromEntries((await must("mizan", api.get(`/api/workspace/ledger?from=${from}&to=${to}`))).trial.accounts.map(row => [row.code, row]));
      const move193 = r2((trial["193"]?.debit ?? 0) - (trial["193"]?.credit ?? 0));
      const move360 = r2((trial["360"]?.credit ?? 0) - (trial["360"]?.debit ?? 0));
      assert.equal(summaryOf(data, "Bizden Kesilen Stopaj"), move193, `${label}: Bizden Kesilen Stopaj = 193 borç hareketi`);
      assert.equal(r2(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj") + summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat")), move360, `${label}: Bizim Ödeyeceğimiz Stopaj + Tevkifat = 360 alacak − borç`);
      const kdv = await report("kdv-ozeti", query);
      assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat"), summaryOf(kdv, "Alıcı Olarak Kesilen Tevkifat (2 No.lu)"), `${label}: KDV Özeti 2 No.lu tevkifat`);
      // Satış tarafı: KDV Özeti'nde satıştaki tevkifat − satıştan iadedeki tevkifat = bu raporda 193 tarafının tevkifatı.
      const kdvRows = objects(kdv);
      const kdvWithheld = kinds => r2(kdvRows.filter(row => kinds.includes(row["Belge Türü"])).reduce((sum, row) => sum + moneyOf(row.Tevkifat), 0));
      const ours = objects(data).filter(row => row.Taraf === THEIRS);
      assert.equal(r2(ours.reduce((sum, row) => sum + moneyOf(row["KDV Tevkifatı"]), 0)), r2(kdvWithheld(["Satış", "Serbest Meslek Makbuzu"]) - kdvWithheld(["Satıştan İade"])), `${label}: 193 tarafı tevkifatı = KDV Özeti satış − satıştan iade`);
    }
  });

  it("her süzgeç (Bu Yıl, Bu Ay, Geçen Ay, Son 30 Gün, Tüm Zamanlar, özel aralık) × ekran/PDF/Excel: TOPLAM = satırlar", async () => {
    for (const query of ["preset=thisYear", "preset=thisMonth", "preset=lastMonth", "preset=last30", "preset=all", SEPTEMBER, "from=2026-10-05&to=2026-10-05"]) {
      const data = await stopaj(query);
      const rows = objects(data);
      const sides = [...new Set(rows.map(row => row.Taraf))];
      // Beklenen TOPLAM satırları satırlardan (programın TOPLAM kodundan bağımsız): taraf başına tutar sütunları toplanır.
      const sums = list => ["Matrah", "Stopaj", "KDV Tevkifatı"].map(header => r2(list.reduce((sum, row) => sum + moneyOf(row[header]), 0)));
      const expected = sides.length > 1 ? [THEIRS, OURS].filter(side => sides.includes(side)).map(side => [GROUP[side], sums(rows.filter(row => row.Taraf === side))]) : sides.length ? [["TOPLAM", sums(rows)]] : [];
      const footers = (data.footers || []).map(line => {
        const cell = Object.fromEntries(data.headers.map((header, index) => [header, line[index]]));
        return [line.find(value => /^TOPLAM/.test(value)), [moneyOf(cell.Matrah), moneyOf(cell.Stopaj), moneyOf(cell["KDV Tevkifatı"])]];
      });
      assert.deepEqual(footers, expected, `${query}: TOPLAM satırları`);
      if (!rows.length) for (const [label, value] of data.summary) assert.equal(moneyOf(value), 0, `${query}: boş dönemde "${label}"`);
      // PDF: satırlardaki ve TOPLAM satırlarındaki her tutar.
      const pdf = await api.raw("GET", `${REPORT}/stopaj-tevkifat/pdf?${query}`);
      assert.equal(pdf.status, 200, `${query} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      for (const line of [...data.rows, ...(data.footers || [])]) for (const cell of line) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `${query} PDF: "${cell}" yok`);
      for (const [label] of expected) assert.ok(text.includes(label), `${query} PDF: "${label}" yok`);
      // Excel: başlık + satırlar + TOPLAM satırları; TOPLAM hücreleri ekrandakiyle aynı.
      const xlsx = await api.raw("GET", `${REPORT}/stopaj-tevkifat/xlsx?${query}`);
      assert.equal(xlsx.status, 200, `${query} Excel`);
      const sheets = xlsxSheets(xlsx.buffer);
      const all = Object.values(sheets)[0];
      const sheet = all.slice(Math.max(0, all.findIndex(row => row.length > 1)));
      assert.equal(sheet.length, 1 + data.rows.length + (data.footers || []).length, `${query} Excel satır sayısı`);
      (data.footers || []).forEach((line, at) => {
        const excel = sheet[1 + data.rows.length + at];
        line.forEach((cell, index) => {
          const value = moneyOf(cell);
          if (value === null) return;
          assert.equal(typeof excel[index] === "number" ? excel[index] : moneyOf(excel[index]), value, `${query} Excel TOPLAM ${data.headers[index]}`);
        });
      });
      assert.deepEqual(sheets["Özet"].slice(-3).map(row => [row[0], moneyOf(row[1]) ?? row[1]]), data.summary.map(([label, value]) => [label, moneyOf(value)]), `${query} Excel özet`);
    }
  });

  it("002 şirketi: tevkifatlı satış ve tam iadesi 193 tarafında +1.800 / −1.800; 001 raporuna karışmaz", async () => {
    const data = await stopaj(OCTOBER, q2);
    const rows = byNumber(data);
    assert.deepEqual(rows[no.T1], { side: THEIRS, net: 10000, stoppage: 0, withheld: 1800 });
    assert.deepEqual(rows["GAMA-IAD-1"], { side: THEIRS, net: -10000, stoppage: 0, withheld: -1800 });
    assert.equal(data.rows.length, 2);
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Tevkifat"), 0, "002: defterde 360 yok");
    assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj"), 0);
    assert.equal(moneyOf(data.footers?.[0]?.[data.headers.indexOf("KDV Tevkifatı")]), 0, "002: tek taraf TOPLAM tevkifat 0");
    const trial = Object.fromEntries((await must("002 mizan", api.get(`/api/workspace/ledger?${OCTOBER}&${q2}`))).trial.accounts.map(row => [row.code, row]));
    assert.equal(trial["360"], undefined, "002 defterinde 360 hareketi yok");
    const first = byNumber(await stopaj(OCTOBER));
    assert.equal(first["GAMA-IAD-1"], undefined, "001 raporunda 002'nin iadesi yok");
  });

  it("yetkisiz kullanıcı (personel): rapor 403", async () => {
    const staff = apiOf(await createUser(ctx.server, api.client, { username: "mm3-personel", role: "personel" }));
    assert.equal((await staff.get(`${REPORT}/stopaj-tevkifat?preset=thisYear`)).status, 403);
  });
});
