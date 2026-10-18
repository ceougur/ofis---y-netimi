// 2.3.0 İz 1.6/1.7 — Şüpheli Ticari Alacaklar: EKRANIN OKUDUĞU sunucu verisi (plan §3.11b/5; kâhin docs/2.3.0-SUPHELI-KABUL.md §2 adım 0–3).
// Cari listesi/kartı (rozet, özet, canDoubtful), ANLIK DURUM (alacak toplamında şüpheli ayrı), Vade Takip (şüpheli ayrı kutu), Rapor Merkezi
// "Şüpheli Alacaklar" (her süzgeç — ders 11; TOPLAM = satırlar; PDF/Excel = ekran; boş dönem; 400 kötü süzgeç; yetki accounts.doubtful YA DA
// overview.view), Alacak Yaşlandırma (Şüpheli Alacak kolonu Toplam'a girmez), Hesap Planı Mizanı'nda 128/129.
// Sahte saat 08.10.2026. ABC Ltd.: borç 10.000 (01.10) → al 4.000 (05.10, Dava) → karşılık 2.500 (06.10) → tahsilat 3.000 (07.10): 128 = 1.000,
// 129 = −1.000, kart 7.000. XYZ: borç 5.000 → al 5.000 (03.10, Karşılıksız Çek) → değersiz 5.000 (04.10): kapanan kayıt, kart 0.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank, expectStatus } from "./banka-210-hesap-ortak.mjs";
import { collect, customer, debt, provision, take, trial, writeOff } from "./banka-230-supheli-ortak.mjs";

const RC = "/api/workspace/report-center";
const moneyOf = cell => {
  const match = /^(-?)((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim().replace(/−/g, "-"));
  return match ? Number(`${match[1]}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const col = (report, name) => {
  const index = report.headers.indexOf(name);
  assert.ok(index >= 0, `kolon ${name}`);
  return index;
};
/** Satırların para kolonu toplamı = TOPLAM satırı (ders 11: her süzgeçte). */
const footerMatches = (report, names) => {
  assert.ok(report.footer, "TOPLAM satırı var");
  for (const name of names) {
    const index = col(report, name);
    const sum = report.rows.reduce((total, row) => total + (moneyOf(row[index]) || 0), 0);
    assert.equal(moneyOf(report.footer[index]), Math.round(sum * 100) / 100, `TOPLAM ${name}`);
  }
};

describe("Şüpheli Alacaklar — ekranın okuduğu veri (liste, kart, ANLIK DURUM, vade takip, rapor, yaşlandırma, mizan)", () => {
  let ctx;
  let abc;
  let xyz;
  let record;
  let personel;
  let muhasebe;
  before(async () => {
    ctx = await bootBank();
    personel = await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" });
    muhasebe = await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" });
    abc = await customer(ctx.api, "ABC Ltd.");
    xyz = await customer(ctx.api, "XYZ A.Ş.");
    await debt(ctx.api, abc.id, 10000, "2026-10-01");
    record = (await must("ABC al", take(ctx.api, abc.id, { amount: 4000, date: "2026-10-05", reason: "lawsuit", note: "Dava açıldı" }))).record;
    await must("ABC karşılık", provision(ctx.api, abc.id, record.id, { amount: 2500, date: "2026-10-06" }));
    await collect(ctx.api, abc.id, 3000, "2026-10-07");
    await debt(ctx.api, xyz.id, 5000, "2026-10-01");
    const closed = (await must("XYZ al", take(ctx.api, xyz.id, { amount: 5000, date: "2026-10-03", reason: "cheque", note: "Karşılıksız" }))).record;
    await must("XYZ değersiz", writeOff(ctx.api, xyz.id, closed.id, { amount: 5000, date: "2026-10-04" }));
  });
  after(() => ctx.server.close());

  it("ön koşul (kâhin adım 3 + XYZ): 128 = 1.000, 129 = −1.000, 659 = 5.000; ABC kartı 7.000, XYZ 0", async () => {
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 1000);
    assert.equal(gl(129), -1000);
    assert.equal(gl(659), 5000);
  });

  it("cari listesi: ABC doubtfulOpen 1.000 (rozet), XYZ 0; totals.doubtful 1.000, doubtfulCount 1; borçlular toplamı şüpheliyi KAPSAR (120 + 128 = kart)", async () => {
    const list = await must("liste", ctx.api.get("/api/workspace/accounts?status=all"));
    const a = list.accounts.find(row => row.id === abc.id);
    const x = list.accounts.find(row => row.id === xyz.id);
    assert.equal(a.doubtfulOpen, 1000);
    assert.equal(a.balance, 7000);
    assert.equal(x.doubtfulOpen, 0);
    assert.equal(x.balance, 0);
    assert.equal(list.totals.doubtful, 1000);
    assert.equal(list.totals.doubtfulCount, 1);
    assert.equal(list.totals.debtor, 7000);
  });

  it("cari kartı: doubtful özeti (açık 1.000, karşılık 1.000, tahsil 3.000) ve canDoubtful yönetici/muhasebe true, personel false", async () => {
    const card = await must("kart", ctx.api.get(`/api/workspace/accounts/${abc.id}`));
    assert.deepEqual({ open: card.doubtful.openMinor, provision: card.doubtful.provisionMinor, collected: card.doubtful.collectedMinor, count: card.doubtful.count, openCount: card.doubtful.openCount }, { open: 100000, provision: 100000, collected: 300000, count: 1, openCount: 1 });
    assert.equal(card.canDoubtful, true);
    const staff = await personel.get(`/api/workspace/accounts/${abc.id}`);
    assert.equal(staff.status, 200);
    assert.equal(staff.data.data.canDoubtful, false, "personelde düğme yok");
    assert.equal(staff.data.data.doubtful.openMinor, 100000, "bilgi personele de görünür");
    const acc = await muhasebe.get(`/api/workspace/accounts/${abc.id}`);
    assert.equal(acc.data.data.canDoubtful, true);
    const list = await must("ABC kayıtları", ctx.api.get(`/api/workspace/accounts/${abc.id}/doubtful`));
    assert.equal(list.records.length, 1);
    assert.equal(list.records[0].stateKey, "open");
    assert.equal(list.records[0].statusLabel, "Şüpheli Alacakta");
    const closed = await must("XYZ kayıtları", ctx.api.get(`/api/workspace/accounts/${xyz.id}/doubtful`));
    assert.equal(closed.records[0].stateKey, "writtenOff");
    assert.equal(closed.records[0].statusLabel, "Değersiz Yazıldı");
  });

  it("yetkisiz: personel Şüpheli Alacağa Al → 403 doubtful-permission ya da FORBIDDEN; hiçbir şey yazılmaz", async () => {
    const res = await personel.post(`/api/workspace/accounts/${abc.id}/doubtful`, { amount: 100, date: "2026-10-08", reason: "other" });
    assert.equal(res.status, 403, JSON.stringify(res.data));
    const list = await must("ABC kayıtları", ctx.api.get(`/api/workspace/accounts/${abc.id}/doubtful`));
    assert.equal(list.records.length, 1);
  });

  it("ANLIK DURUM: receivable.doubtful 1.000 (1 cari) ayrı satır; total = cari borçluları + çek (şüpheli toplamın İÇİNDE, ayrıca eklenmez)", async () => {
    const data = await must("overview", ctx.api.get("/api/workspace/overview"));
    assert.equal(data.receivable.doubtful, 1000);
    assert.equal(data.receivable.doubtfulCount, 1);
    assert.equal(data.receivable.accounts, 7000);
    assert.equal(data.receivable.total, Math.round((data.receivable.accounts + data.receivable.cheques) * 100) / 100);
  });

  it("Vade Takip (hatırlatmalar): doubtful { amount 1.000, accountCount 1 } ayrı alan; Tahsil Edilecek'e girmez; Ödenecek süzgecinde 0; PDF özetinde satır", async () => {
    const data = await must("vade takip", ctx.api.get("/api/workspace/overview/vade-takip?preset=next30"));
    assert.equal(data.doubtful.amount, 1000);
    assert.equal(data.doubtful.accountCount, 1);
    assert.equal(data.totals.in.total.amount, 0, "vade kalemi yok: şüpheli alacak vade kalemi değildir");
    const out = await must("ödenecek", ctx.api.get("/api/workspace/overview/vade-takip?preset=next30&direction=out"));
    assert.equal(out.doubtful.amount, 0);
    const pdf = await ctx.api.raw("GET", "/api/workspace/overview/vade-takip.pdf?preset=next30");
    assert.equal(pdf.status, 200);
    assert.ok(pdfText(pdf.buffer).replace(/\s+/g, " ").includes("Şüpheli Alacak (vade takibinin dışında)"), "PDF özetinde şüpheli satırı");
  });

  it("Rapor Merkezi kataloğu: Şüpheli Alacaklar (Cari grubu; range + doubtfulStatus + doubtfulReason; ilk açılış Bu Yıl)", async () => {
    const catalog = await must("katalog", ctx.api.get(RC));
    const report = catalog.reports.find(item => item.id === "supheli-alacaklar");
    assert.ok(report, "rapor listede");
    assert.equal(report.group, "Cari");
    assert.equal(report.title, "Şüpheli Alacaklar");
    assert.deepEqual(report.params, ["range", "doubtfulStatus", "doubtfulReason"]);
    assert.equal(report.preset, "thisYear");
  });

  it("rapor varsayılan (Bu Yıl, Açık): yalnız ABC; Tutar 4.000, Karşılık 1.000, Tahsil 3.000, Değersiz 0, Kalan 1.000, Durum Şüpheli Alacakta; TOPLAM = satır", async () => {
    const report = await must("rapor", ctx.api.get(`${RC}/supheli-alacaklar`));
    assert.deepEqual(report.headers, ["Cari No", "Cari", "Neden", "Tarih", "Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan", "Durum"]);
    assert.equal(report.rows.length, 1);
    const row = report.rows[0];
    assert.equal(row[col(report, "Cari")], "ABC Ltd.");
    assert.equal(row[col(report, "Neden")], "Dava");
    assert.equal(row[col(report, "Tarih")], "05.10.2026");
    assert.deepEqual([row[4], row[5], row[6], row[7], row[8]].map(moneyOf), [4000, 1000, 3000, 0, 1000]);
    assert.equal(row[col(report, "Durum")], "Şüpheli Alacakta");
    footerMatches(report, ["Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan"]);
    const summary = Object.fromEntries(report.summary);
    assert.equal(moneyOf(summary.Kalan), 1000);
    assert.equal(summary["Kayıt"], "1");
    assert.match(report.subtitle, /Durum: Açık/);
  });

  it("Durum süzgeci: Kapanan → yalnız XYZ (Değersiz Yazıldı, Kalan 0, Değersiz 5.000); Tümü → 2 satır, TOPLAM = satırlar", async () => {
    const closed = await must("kapanan", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=closed`));
    assert.equal(closed.rows.length, 1);
    assert.equal(closed.rows[0][1], "XYZ A.Ş.");
    assert.equal(closed.rows[0][2], "Karşılıksız Çek");
    assert.equal(closed.rows[0][9], "Değersiz Yazıldı");
    assert.deepEqual([closed.rows[0][4], closed.rows[0][7], closed.rows[0][8]].map(moneyOf), [5000, 5000, 0]);
    footerMatches(closed, ["Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan"]);
    const all = await must("tümü", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all`));
    assert.equal(all.rows.length, 2);
    footerMatches(all, ["Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan"]);
    assert.equal(moneyOf(all.footer[4]), 9000);
    assert.equal(moneyOf(all.footer[8]), 1000);
    assert.equal(Object.fromEntries(all.summary)["Değersiz"], "5.000,00 TL");
  });

  it("Neden süzgeci (her seçenek): Dava 1 (ABC), Karşılıksız Çek 1 (XYZ; Tümü), Protestolu Senet / İcra / Diğer 0; geçersiz neden 400", async () => {
    const lawsuit = await must("dava", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all&doubtfulReason=lawsuit`));
    assert.deepEqual(lawsuit.rows.map(row => row[1]), ["ABC Ltd."]);
    assert.match(lawsuit.subtitle, /Neden: Dava/);
    const cheque = await must("çek", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all&doubtfulReason=cheque`));
    assert.deepEqual(cheque.rows.map(row => row[1]), ["XYZ A.Ş."]);
    for (const reason of ["note", "enforcement", "other"]) {
      const empty = await must(reason, ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all&doubtfulReason=${reason}`));
      assert.equal(empty.rows.length, 0, reason);
      assert.equal(empty.footer, null, `${reason}: boşta TOPLAM yok`);
    }
    const bad = await ctx.api.get(`${RC}/supheli-alacaklar?doubtfulReason=bogus`);
    assert.equal(bad.status, 400);
    assert.equal(bad.code, "doubtful-filter");
  });

  it("dönem süzgeci: 01–04.10 Tümü → yalnız XYZ (kayıt tarihine göre); 2025 → boş (ipucu ekranda); geçersiz tarih 400", async () => {
    const early = await must("erken", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all&from=2026-10-01&to=2026-10-04`));
    assert.deepEqual(early.rows.map(row => row[1]), ["XYZ A.Ş."]);
    const past = await must("2025", ctx.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all&from=2025-01-01&to=2025-12-31`));
    assert.equal(past.rows.length, 0);
    assert.equal(past.total, 0);
    const bad = await ctx.api.get(`${RC}/supheli-alacaklar?from=31.12.2026`);
    assert.equal(bad.status, 400);
  });

  it("PDF ve Excel = ekran: Tümü süzgecinde her para hücresi PDF'te; Excel satırları ve TOPLAM aynı", async () => {
    const q = "?doubtfulStatus=all";
    const report = await must("rapor", ctx.api.get(`${RC}/supheli-alacaklar${q}`));
    const pdf = await ctx.api.raw("GET", `${RC}/supheli-alacaklar/pdf${q}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const row of report.rows) for (const cell of row) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `PDF'te "${cell}" (${row[1]})`);
    for (const cell of report.footer) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `PDF TOPLAM "${cell}"`);
    assert.ok(text.includes("Şüpheli Alacaklar"), "PDF başlığı");
    const xlsx = await ctx.api.raw("GET", `${RC}/supheli-alacaklar/xlsx${q}`);
    assert.equal(xlsx.status, 200);
    const sheet = Object.values(xlsxSheets(xlsx.buffer))[0];
    for (const row of report.rows) {
      const line = sheet.find(cells => String(cells[1]) === row[1] && Number(cells[4]) === moneyOf(row[4]));
      assert.ok(line, `Excel'de ${row[1]}`);
      for (const name of ["Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan"]) assert.equal(Number(line[col(report, name)]), moneyOf(row[col(report, name)]), `Excel ${row[1]} ${name}`);
      assert.equal(String(line[9]), row[9], "Excel durum");
    }
    const totalLine = sheet.find(cells => String(cells[0]) === "TOPLAM" || String(cells[1]) === "TOPLAM");
    assert.ok(totalLine, "Excel TOPLAM satırı");
    assert.equal(Number(totalLine[4]), 9000);
    assert.equal(Number(totalLine[8]), 1000);
  });

  it("yetki: muhasebe (Şüpheli Alacak İşlemleri var, finans raporları yok) raporu açar; personel 403; Alacak Yaşlandırma muhasebeye kapalı kalır", async () => {
    // 2.4.3 H9 (bilerek güncellendi): muhasebe Finans Raporları'nı varsayılan olarak görür; "finans raporları yok" durumu kişiden kaldırılarak kurulur.
    const usersList = (await ctx.api.client.get("/api/admin/users")).data.data;
    const muhasebeId = (Array.isArray(usersList) ? usersList : usersList.users).find(user => user.username === "muhasebe1").id;
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${muhasebeId}`, { grants: { add: [], remove: ["overview.view"] } })).status, 200);
    const acc = await muhasebe.get(`${RC}/supheli-alacaklar?doubtfulStatus=all`);
    assert.equal(acc.status, 200, JSON.stringify(acc.data).slice(0, 200));
    assert.equal(acc.data.data.rows.length, 2);
    const catalog = await muhasebe.get(RC);
    assert.equal(catalog.status, 200);
    assert.ok(catalog.data.data.reports.some(item => item.id === "supheli-alacaklar"), "muhasebe kataloğunda");
    assert.ok(!catalog.data.data.reports.some(item => item.id === "alacak-yaslandirma"), "finans raporu bu muhasebede yok (overview.view kişiden kaldırıldı)");
    const aging = await muhasebe.get(`${RC}/alacak-yaslandirma`);
    assert.equal(aging.status, 403);
    for (const tail of ["", "/pdf", "/xlsx"]) expectStatus(await personel.get(`${RC}/supheli-alacaklar${tail}`), 403, "", `personel rapor${tail}`);
  });

  it("Alacak Yaşlandırma: 'Şüpheli Alacak (dilimlere dahil)' kolonu ABC 1.000 (Toplam'a ikinci kez girmez: vade kalemi yok → Toplam 0), XYZ satırı yok; özette aynı ad (karar 15.10.2026)", async () => {
    const report = await must("yaşlandırma", ctx.api.get(`${RC}/alacak-yaslandirma`));
    const sup = col(report, "Şüpheli Alacak (dilimlere dahil)");
    const total = col(report, "Toplam");
    const row = report.rows.find(cells => cells[0] === "ABC Ltd.");
    assert.ok(row, "ABC satırı (yalnız şüphelisi olan cari de listelenir)");
    assert.equal(moneyOf(row[sup]), 1000);
    assert.equal(moneyOf(row[total]), 0, "şüpheli Toplam'a girmez");
    assert.ok(!report.rows.some(cells => cells[0] === "XYZ A.Ş."), "kapanan kayıt satır açmaz");
    assert.equal(moneyOf(Object.fromEntries(report.summary)["Şüpheli Alacak (dilimlere dahil)"]), 1000);
    assert.equal(moneyOf(report.footer[sup]), 1000, "TOPLAM şüpheli");
  });

  it("Hesap Planı Mizanı (Rapor Merkezi): 128 Şüpheli Ticari Alacaklar 1.000 Borç, 129 1.000 Alacak, 654 2.500, 644 1.500, 659 5.000", async () => {
    const report = await must("mizan", ctx.api.get(`${RC}/hesap-mizani`));
    const rowOf = code => report.rows.find(cells => String(cells[0]) === code);
    const bal = col(report, "Bakiye");
    const dir = col(report, "Yön");
    assert.deepEqual([moneyOf(rowOf("128")[bal]), rowOf("128")[dir]], [1000, "Borç"]);
    assert.deepEqual([moneyOf(rowOf("129")[bal]), rowOf("129")[dir]], [1000, "Alacak"]);
    assert.equal(moneyOf(rowOf("654")[bal]), 2500);
    assert.equal(moneyOf(rowOf("644")[bal]), 1500);
    assert.equal(moneyOf(rowOf("659")[bal]), 5000);
    assert.match(rowOf("128")[1], /Şüpheli/);
  });

  it("şüpheli hiç kullanılmamış şirkette: rapor boş, liste/ANLIK DURUM alanları 0 (eski veride gösterim bozulmaz)", async () => {
    const fresh = await bootBank();
    try {
      const customerId = (await customer(fresh.api, "Temiz Cari")).id;
      await debt(fresh.api, customerId, 100, "2026-10-01");
      const report = await must("rapor", fresh.api.get(`${RC}/supheli-alacaklar?doubtfulStatus=all`));
      assert.equal(report.rows.length, 0);
      const list = await must("liste", fresh.api.get("/api/workspace/accounts"));
      assert.equal(list.totals.doubtful, 0);
      assert.equal(list.accounts[0].doubtfulOpen, 0);
      const overview = await must("overview", fresh.api.get("/api/workspace/overview"));
      assert.equal(overview.receivable.doubtful, 0);
      const aging = await must("yaşlandırma", fresh.api.get(`${RC}/alacak-yaslandirma`));
      assert.ok(aging.headers.includes("Şüpheli Alacak (dilimlere dahil)") && aging.headers.includes("Vade Gecikme (Gün)"));
    } finally {
      fresh.server.close();
    }
  });
});
