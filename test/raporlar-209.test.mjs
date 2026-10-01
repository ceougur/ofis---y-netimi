// Raporlar (v2.0.9): tek Raporlar penceresinin sunucu tarafı — birleşik Vade takip (taksit, çek/senet, ileri tarihli
// Kasa, tablo takvimi), nakit akışına tablo kaynağı ve dönem toplamları, mizanda telefonla arama, yeni modül raporları
// (aylık kasa, cari bazında tahsilat, taksit performansı, çek/senet vade dağılımı, stok özeti) ve sektöre uygun taslak
// Excel (143 sektörün her taslağı programın kendi tanıyıcısıyla doğru okunur).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { dueList, groupFlows, projection } from "../server/lib/finance-report.mjs";
import { analyzeDataset } from "../server/lib/insight/analyze.mjs";
import { computeDues } from "../server/lib/insight/dues.mjs";
import { SECTORS } from "../server/lib/insight/sectors.mjs";
import { monthHeaders, sectorTemplate, templateIds, templateSheet } from "../server/lib/insight/templates.mjs";
import { isoDay } from "../server/lib/plans.mjs";
import { buildXlsx } from "../server/lib/xlsx-write.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = isoDay(new Date());
const shift = days => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const tr = iso => iso.split("-").reverse().join(".");
const round = value => Math.round(value * 100) / 100;

describe("vade listesi ve nakit dönemleri (saf)", () => {
  it("aralık, gecikmiş, bu ay, tutarsız kalem ve toplamlar", () => {
    const items = [
      { date: shift(-40), direction: "in", amount: 100, source: "plan", label: "eski gecikmiş" },
      { date: shift(-1), direction: "out", amount: 50, source: "cheque", label: "dün ödenecek" },
      { date: TODAY, direction: "in", amount: 30, source: "table", label: "bugün" },
      { date: shift(10), direction: "in", amount: 20, source: "plan", label: "yaklaşan" },
      { date: shift(10), direction: "", amount: null, source: "deadline", label: "son tarih" },
      { date: shift(60), direction: "in", amount: 999, source: "plan", label: "aralık dışı" },
      { date: shift(5), direction: "in", amount: 0, source: "plan", label: "sıfır" },
    ];
    const all = dueList({ today: TODAY, from: TODAY, to: shift(30), late: true, items });
    assert.deepEqual(all.rows.map(row => row.label), ["eski gecikmiş", "dün ödenecek", "bugün", "yaklaşan", "son tarih"]);
    assert.equal(all.totals.in.overdue.amount, 100);
    assert.equal(all.totals.out.overdue.amount, 50);
    assert.equal(all.totals.in.today.amount, 30);
    assert.equal(all.totals.in.total.amount, 150);
    assert.equal(all.totals.noAmount, 1);
    assert.equal(all.totals.net, 100);
    const noLate = dueList({ today: TODAY, from: TODAY, to: shift(30), late: false, items });
    assert.ok(!noLate.rows.some(row => row.state === "overdue"), "gecikmişleri göster kapalı: başlangıçtan öncekiler yok");
    // Tablodaki ay kalemi (ayın 1'i) içinde bulunulan ayda "bu ay"dır, gecikmiş değil; toplamda bugün/bu ay kümesinde.
    const monthStart = `${TODAY.slice(0, 7)}-01`;
    const month = dueList({ today: TODAY, from: "", to: "", items: [{ date: monthStart, direction: "in", amount: 70, source: "table", label: "Eylül", month: true }] });
    assert.equal(month.rows[0].state, TODAY === monthStart ? "today" : "month");
    assert.equal(month.totals.in.overdue.count, 0);
    assert.equal(month.totals.in.today.amount, 70);
  });
  it("nakit akışı ay / hafta toplamları: son dönemin kasası tahmini kasadır", () => {
    const result = projection({ today: TODAY, to: shift(70), cashToday: 1000, flows: [
      { date: shift(1), direction: "in", amount: 100, source: "plan", label: "a" },
      { date: shift(20), direction: "out", amount: 300, source: "cheque", label: "b" },
      { date: shift(50), direction: "in", amount: 50, source: "plan", label: "c" },
    ] });
    for (const group of ["day", "week", "month"]) {
      const periods = groupFlows(result, group);
      assert.equal(periods.at(-1).closing, result.closing, group);
      assert.equal(round(periods.reduce((sum, period) => sum + period.in - period.out, 0)), round(result.closing - result.opening), group);
    }
  });
});

describe("Raporlar penceresi uçları (tam yığın)", () => {
  let server;
  let admin;
  let ali;
  let veli;
  let tedarik;
  const excel = (fileName, sheet, matrix) => ({ kind: "excel", fileName, sheets: [{ name: sheet, matrix }] });
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    // Tablo: ödeme sözleri +3 gün (takvimde) ve +40 gün (takvimin 30 günlük söz penceresinin dışında, raporun 90 günlük
    // aralığında). Tek tarih kolonu: kalan borç o tarihin tutarıdır (iki tarih kolonunda tutar belirsizdir, yazılmaz).
    const staged = await admin.post("/api/workspace/dataset/stage", excel("Tahsilat.xlsx", "Borçlular", [["MÜŞTERİ", "TELEFON", "KALAN BORÇ", "ÖDEME SÖZÜ"], ["Deniz Ay", "0533 222 11 00", "1.200,00", tr(shift(3))], ["Can Er", "0533 222 11 01", "900,00", tr(shift(40))]]));
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    ali = (await admin.post("/api/workspace/accounts", { name: "Ali Veli", type: "customer", phone: "0532 111 22 33", openingBalance: "5000" })).data.data;
    veli = (await admin.post("/api/workspace/accounts", { name: "Ali Veli", type: "customer", phone: "0544 999 88 77" })).data.data;
    tedarik = (await admin.post("/api/workspace/accounts", { name: "Tedarik Ltd.", type: "supplier", phone: "0312 555 00 00" })).data.data;
    await admin.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "in", amount: "1500", date: TODAY, note: "Nakit" });
    await admin.post(`/api/workspace/accounts/${tedarik.id}/entries`, { kind: "credit", amount: "2000", date: shift(-10), note: "Fatura" });
    const plan = await admin.post("/api/workspace/plans", { registeredOn: "2026-01-01", name: "Ali Veli", accountId: veli.id, total: "3000", mode: "auto", count: 3, firstDue: shift(-20), everyMonths: 1 });
    assert.equal(plan.status, 200, JSON.stringify(plan.data));
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1000", dueDate: shift(10), accountId: ali.id, serialNo: "A-1" })).status, 200);
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "800", dueDate: shift(20), accountId: tedarik.id, serialNo: "V-1" })).status, 200);
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "700", dueDate: shift(45), accountId: veli.id, serialNo: "S-1" })).status, 200);
    // v2.0.13: ileri tarihli Kasa hareketi girilemez (400 date-future). Eski sürümden kalmış ileri tarihli satır Vade
    // Takip ve Nakit Akış'ta okunmaya devam eder: veritabanına doğrudan (eski veri gibi) yazılır, kapı yeniden tabanlanır.
    assert.equal((await admin.post("/api/workspace/cash", { kind: "out", amount: "4000", date: shift(15), description: "Kira", cashForce: true })).data.code, "date-future");
    server.app.store.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('eski-ileri-kira', 'out', 4000, ?, 'Kira', 'cash', 'eski', ?)").run(shift(15), new Date().toISOString());
    server.app.integrity.start();
    assert.equal((await admin.post("/api/workspace/stock", { name: "A4 kağıt", unit: "paket", unitPrice: "50", openingQty: "10", openingDate: shift(-60) })).status, 200);
  });
  after(async () => {
    await server.close();
  });

  it("Vade takip: her kaynak kendi hesabından; toplamlar; süzgeçler; dışa aktarma", async () => {
    const response = await admin.get("/api/workspace/overview/vade-takip?preset=next30");
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const data = response.data.data;
    const bySource = source => data.rows.filter(row => row.source === source);
    assert.equal(bySource("plan").find(row => row.state === "overdue")?.amount, 1000, "20 gün önceki taksit gecikmiş");
    assert.equal(bySource("cheque").length, 2, "alınan ve verilen çek (30 gün)");
    assert.equal(bySource("note").length, 0, "45 gün sonraki senet 30 günlük aralıkta yok");
    assert.equal(bySource("cash")[0]?.amount, 4000);
    assert.equal(bySource("promise")[0]?.amount, 1200, "tablodaki ödeme sözü");
    assert.equal(data.totals.out.total.amount, 4800, "kira + verilen çek");
    assert.equal(data.totals.in.total.amount, round(data.rows.filter(row => row.direction === "in" && row.amount !== null).reduce((sum, row) => sum + row.amount, 0)));
    const ninety = (await admin.get("/api/workspace/overview/vade-takip?preset=next90")).data.data;
    assert.ok(ninety.rows.some(row => row.source === "note" && row.amount === 700), "90 gün: senet");
    assert.ok(ninety.rows.some(row => row.source === "promise" && row.amount === 900 && row.date === shift(40)), "90 gün: tablodaki +40 günlük söz (takvim penceresinin dışında)");
    const calendar = (await admin.get("/api/workspace/dues")).data.data;
    assert.ok(calendar.items.some(item => item.due === shift(3) && item.amount === 1200), "takvimde +3 günlük söz");
    assert.ok(!calendar.items.some(item => item.due === shift(40)), "takvim 30 günden sonraki sözü göstermez; rapor gösterir");
    // Takvimdeki her tablo kalemi raporda aynı tarih ve tutarla.
    const open = (await admin.get("/api/workspace/overview/vade-takip?preset=open")).data.data.rows;
    for (const item of calendar.items.filter(entry => !entry.source && entry.amount > 0)) assert.ok(open.some(row => row.date === item.due && row.amount === item.amount), `takvim kalemi raporda: ${item.label} ${item.due}`);
    const out = (await admin.get("/api/workspace/overview/vade-takip?preset=next30&direction=out")).data.data;
    assert.deepEqual(out.rows.map(row => row.amount).sort(), [4000, 800]);
    const onlyPlan = (await admin.get("/api/workspace/overview/vade-takip?preset=open&sources=plan")).data.data;
    assert.ok(onlyPlan.rows.length === 3 && onlyPlan.rows.every(row => row.source === "plan"), "kaynak süzgeci");
    const byPhone = (await admin.get(`/api/workspace/overview/vade-takip?preset=open&q=${encodeURIComponent("0533 222 11 00")}`)).data.data;
    assert.ok(byPhone.rows.length >= 1 && byPhone.rows.every(row => /Deniz Ay/.test(row.party)), "tablodaki kişi telefonla bulunur");
    const chequeByPhone = (await admin.get("/api/workspace/overview/vade-takip?preset=open&q=0312555")).data.data;
    assert.deepEqual(chequeByPhone.rows.map(row => row.amount), [800], "carinin telefonuyla verilen çek bulunur");
    const late = (await admin.get("/api/workspace/overview/vade-takip?preset=late")).data.data;
    assert.ok(late.rows.length && late.rows.every(row => row.state === "overdue"), "gecikmiş");
    const noLate = (await admin.get(`/api/workspace/overview/vade-takip?from=${TODAY}&to=${shift(30)}&late=0`)).data.data;
    assert.ok(!noLate.rows.some(row => row.date < TODAY), "gecikmişleri göster kapalı");
    const pdf = await admin.raw("GET", "/api/workspace/overview/vade-takip.pdf?preset=next30");
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");
    const xlsx = await admin.raw("GET", "/api/workspace/overview/vade-takip.xlsx?preset=next30");
    assert.equal(xlsx.status, 200);
    assert.equal(xlsx.buffer.subarray(0, 2).toString(), "PK");
    assert.equal((await admin.get("/api/workspace/overview/vade-takip?from=2026-13-01")).status, 400);
  });

  it("Vade takip önbelleği: tablodaki hücre düzeltilince ve tahsilat girilince hemen yenilenir", async () => {
    const promiseOf = async () => (await admin.get("/api/workspace/overview/vade-takip?preset=open&sources=promise")).data.data.rows.find(row => row.party === "Deniz Ay");
    const before = await promiseOf();
    assert.equal(before.amount, 1200);
    const key = before.ref.key;
    assert.equal((await admin.post("/api/workspace/overrides", { caseKey: key, field: "KALAN BORÇ", value: "1.500,00" })).status, 200);
    assert.equal((await promiseOf()).amount, 1500, "tutar düzeltmesi raporda");
    const payment = await admin.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "500", date: TODAY, note: "Söz tahsilatı" });
    assert.equal(payment.status, 200);
    assert.equal((await promiseOf()).amount, 1000, "kayıt tahsilatı sözden düşer");
    assert.equal((await admin.post("/api/workspace/overrides", { caseKey: key, field: "KALAN BORÇ", value: "0" })).status, 200);
    assert.equal(await promiseOf(), undefined, "kalan borç 0: söz listeden kalkar");
    assert.equal((await admin.post("/api/workspace/overrides", { caseKey: key, field: "KALAN BORÇ", value: "1.200,00" })).status, 200);
    const paymentId = payment.data.data.payment?.id ?? payment.data.data.id;
    assert.equal((await admin.del(`/api/workspace/payments/${paymentId}`)).status, 200);
    assert.equal((await promiseOf()).amount, 1200, "düzeltme ve tahsilat geri alınınca eski hâli");
  });

  it("Vade takip yetkisi: personel ve muhasebe göremez; uzman görür; ANLIK DURUM verilen personel görür", async () => {
    const personel = await createUser(server, admin, { username: "per209" });
    const muhasebe = await createUser(server, admin, { username: "muh209", role: "muhasebe" });
    const uzman = await createUser(server, admin, { username: "uzm209", role: "avukat" });
    assert.equal((await personel.get("/api/workspace/overview/vade-takip")).status, 403);
    assert.equal((await muhasebe.get("/api/workspace/overview/vade-takip")).status, 403);
    assert.equal((await personel.raw("GET", "/api/workspace/overview/vade-takip.pdf")).status, 403);
    const expert = await uzman.get("/api/workspace/overview/vade-takip?preset=open");
    assert.equal(expert.status, 200);
    assert.ok(expert.data.data.allowed.includes("cheque"), "uzmanın çek yetkisi var: çek kalemleri gelir");
    assert.equal((await uzman.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 403, "mizan ANLIK DURUM yetkisidir");
    const users = (await admin.get("/api/admin/users")).data.data;
    const target = (Array.isArray(users) ? users : users.users).find(user => user.username === "per209");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: ["overview.view"] })).status, 200);
    const granted = await personel.get("/api/workspace/overview/vade-takip?preset=open");
    assert.equal(granted.status, 200);
    assert.ok(granted.data.data.allowed.includes("cheque") && granted.data.data.allowed.includes("cash"), "ANLIK DURUM yetkisi çek ve Kasa kalemlerini de açar");
  });

  it("Nakit akış: tablo kaynağı açılıp kapanır (çift sayım yok); dönem toplamları", async () => {
    const withTable = (await admin.get(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${shift(30)}`)).data.data;
    const noTable = (await admin.get(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${shift(30)}&table=0`)).data.data;
    const tableRows = withTable.rows.filter(row => row.source === "table" || row.source === "promise");
    assert.ok(tableRows.length >= 1, "ödeme sözü beklenen girişte");
    assert.ok(![...noTable.rows, ...noTable.overdue].some(row => row.source === "table" || row.source === "promise"));
    assert.equal(round(withTable.closing - noTable.closing), round(tableRows.reduce((sum, row) => sum + row.amount, 0)));
    const grouped = (await admin.get(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${shift(60)}&group=week`)).data.data;
    assert.equal(grouped.periods.at(-1).closing, grouped.closing);
    const pdf = await admin.raw("GET", `/api/workspace/overview/nakit-akisi.pdf?from=${TODAY}&to=${shift(60)}&group=month`);
    assert.equal(pdf.status, 200);
    const xlsx = await admin.raw("GET", `/api/workspace/overview/nakit-akisi.xlsx?from=${TODAY}&to=${shift(60)}&group=month`);
    assert.equal(xlsx.status, 200);
  });

  it("Mizan: aynı adlı iki cari ayrı; telefonla arama; boşken cari sayısı döner", async () => {
    const mizan = (await admin.get(`/api/workspace/overview/mizan?from=${shift(-400)}&to=${TODAY}`)).data.data;
    assert.equal(mizan.rows.filter(row => row.name === "Ali Veli").length, 2);
    assert.equal(mizan.accountCount, 3);
    const byPhone = (await admin.get(`/api/workspace/overview/mizan?from=${shift(-400)}&to=${TODAY}&q=0544999`)).data.data;
    assert.deepEqual(byPhone.rows.map(row => row.id), [veli.id]);
  });

  it("Yeni modül raporları rakamları ekranlarla aynı", async () => {
    const run = async (id, query = "") => {
      const response = await admin.get(`/api/workspace/report-center/${id}?${query}`);
      assert.equal(response.status, 200, `${id}: ${JSON.stringify(response.data).slice(0, 300)}`);
      return response.data.data;
    };
    const catalog = (await admin.get("/api/workspace/report-center")).data.data.reports.map(report => report.id);
    for (const id of ["kasa-aylik", "cari-tahsilat", "taksit-performans", "cek-vade-dagilimi", "stok-ozet"]) assert.ok(catalog.includes(id), id);
    const cash = (await admin.get(`/api/workspace/cash?from=${TODAY.slice(0, 4)}-01-01&to=${TODAY.slice(0, 4)}-12-31`)).data.data;
    const aylik = await run("kasa-aylik", `from=${TODAY.slice(0, 4)}-01-01&to=${TODAY.slice(0, 4)}-12-31`);
    const sumCol = (data, header) => round(data.rows.reduce((sum, row) => sum + Number(String(row[data.headers.indexOf(header)]).replace(/[^\d,-]/g, "").replace(",", ".")), 0));
    assert.equal(sumCol(aylik, "Giriş"), cash.period.in, "aylık kasa girişi = Kasa");
    assert.equal(sumCol(aylik, "Çıkış"), cash.period.out, "aylık kasa çıkışı = Kasa");
    const tahsilat = await run("cari-tahsilat", `from=${shift(-3)}&to=${shift(3)}`);
    const aliRow = tahsilat.rows.find(row => row[0] === ali.refNo);
    assert.ok(aliRow && /2\.500,00/.test(aliRow[5]), `Ali Veli (1): nakit 1.500 + çek 1.000 → ${aliRow}`);
    assert.ok(tahsilat.rows.find(row => row[0] === veli.refNo && /700,00/.test(row[4])), "Ali Veli (2): alınan senet 700 ayrı satırda");
    const perf = await run("taksit-performans", `from=${shift(-400)}&to=${shift(400)}`);
    assert.match(perf.summary.find(([label]) => label === "Vadesi Gelen")[1], /3\.000,00/);
    assert.match(perf.summary.find(([label]) => label === "Geciken")[1], /1\.000,00/);
    const cek = await run("cek-vade-dagilimi");
    assert.match(cek.summary.find(([label]) => label === "Tahsil Edilecek")[1], /1\.700,00/);
    assert.match(cek.summary.find(([label]) => label === "Ödenecek")[1], /800,00/);
    const stok = await run("stok-ozet", `from=${shift(-30)}&to=${TODAY}`);
    assert.deepEqual(stok.rows[0].slice(4, 8), ["10", "0", "0", "10"], "dönem başı 10 (60 gün önce açılış), hareket yok");
    const pdf = await admin.raw("GET", `/api/workspace/report-center/stok-ozet/pdf?from=${shift(-30)}&to=${TODAY}`);
    assert.equal(pdf.status, 200);
  });
});

describe("rapor ekranı kuralı: boş veri, geçmiş/gelecek dönem, tek kayıt, yetkisiz kullanıcı", () => {
  const NEW_REPORTS = ["kasa-aylik", "cari-tahsilat", "taksit-performans", "cek-vade-dagilimi", "stok-ozet"];
  it("boş kurulumda her yeni rapor ve Vade takip hatasız, sıfır satır; geçmiş ve gelecek dönem; tek kayıt; personel 403", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const ranges = ["", `from=${shift(-800)}&to=${shift(-700)}`, `from=${shift(400)}&to=${shift(500)}`];
      for (const id of NEW_REPORTS) {
        for (const range of ranges) {
          const response = await admin.get(`/api/workspace/report-center/${id}?${range}`);
          assert.equal(response.status, 200, `${id} ${range}: ${JSON.stringify(response.data).slice(0, 200)}`);
          const rows = response.data.data.rows.filter(row => !/Vadesi geçmiş/.test(row[0]));
          // İlk kolon dönem/ad; diğer hücrelerde sıfırdan farklı rakam olmamalı (hareketsiz aylar 0,00 satırıdır).
          assert.ok(rows.every(row => row.slice(1).every(cell => !/[1-9]/.test(String(cell)))), `${id} ${range}: boş veride tutar yok ${JSON.stringify(rows.slice(0, 2))}`);
          assert.ok(response.data.data.summary.length && response.data.data.summary.every(([, value]) => !/[1-9]/.test(String(value))), `${id} ${range}: özet sıfır ${JSON.stringify(response.data.data.summary)}`);
        }
        assert.equal((await admin.raw("GET", `/api/workspace/report-center/${id}/pdf`)).status, 200, `${id} boş PDF`);
        assert.equal((await admin.raw("GET", `/api/workspace/report-center/${id}/xlsx`)).status, 200, `${id} boş Excel`);
      }
      const empty = (await admin.get("/api/workspace/overview/vade-takip?preset=open")).data.data;
      assert.deepEqual([empty.rows.length, empty.totals.in.total.amount, empty.totals.out.total.amount], [0, 0, 0]);
      assert.equal((await admin.raw("GET", "/api/workspace/overview/vade-takip.pdf?preset=open")).status, 200, "boş Vade takip PDF");
      // Tek kayıt: 40 gün sonra vadesi gelen tek taksit. v2.0.13'ten beri ileri tarihli Kasa hareketi girilemez
      // (gelecekteki ödeme vadeyle planlanır); Vade takip yalnız o kalemi, 30 günlük pencere hiçbir şeyi göstermez.
      const future = shift(40);
      assert.equal((await admin.post("/api/workspace/cash", { kind: "out", amount: "750", date: future, description: "Sigorta", cashForce: true })).data.code, "date-future");
      assert.equal((await admin.post("/api/workspace/plans", { name: "Sigorta Taksidi", total: "750", count: 1, firstDue: future })).status, 200);
      const one = (await admin.get("/api/workspace/overview/vade-takip?preset=open")).data.data;
      assert.deepEqual(one.rows.map(row => [row.source, row.amount, row.date, row.state]), [["plan", 750, future, "upcoming"]]);
      assert.equal((await admin.get("/api/workspace/overview/vade-takip?preset=next30")).data.data.rows.length, 0, "40 gün sonraki kalem 30 günde yok");
      const monthly = (await admin.get(`/api/workspace/report-center/kasa-aylik?from=${future.slice(0, 7)}-01&to=${future}`)).data.data;
      assert.ok(!monthly.rows.some(row => /750,00/.test(row.join(" "))), "vade Kasa hareketi değildir; aylık kasaya girmez");
      const personel = await createUser(server, admin, { username: "per209b" });
      for (const id of NEW_REPORTS) assert.equal((await personel.get(`/api/workspace/report-center/${id}`)).status, 403, `${id}: personel 403`);
      assert.equal((await personel.raw("GET", "/api/workspace/report-center/stok-ozet/xlsx")).status, 403);
    } finally {
      await server.close();
    }
  });
});

describe("sektöre uygun taslak Excel", () => {
  const NAMES = ["Ayşe Yılmaz", "Mehmet Demir", "Zeynep Kaya", "Ali Çelik", "Elif Şahin", "Mustafa Arslan", "Fatma Öztürk", "Hasan Aydın"];
  const now = new Date();
  const d = days => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
  };
  // Kullanıcının dolduracağı gibi örnek değerler (türe göre).
  const fill = (column, index) =>
    ({
      id: `2026/${100 + index}`,
      person: NAMES[index % NAMES.length],
      phone: `05${32 + index} ${100 + index} ${10 + index} ${20 + index}`,
      email: `kisi${index}@ornek.com`,
      date: d(index * 9 - 20),
      day: String(1 + ((index * 4) % 28)),
      money: `${(1500 + index * 250).toLocaleString("tr-TR")},00`,
      number: String(3 + index),
      list: column.options?.[index % (column.options?.length || 1)],
      month: index % 3 === 0 ? "" : "Ödendi",
    })[column.kind] ?? (column.label === "Not" ? "" : `${column.label} ${index + 1}`);

  it("her sektörün taslağı var; doldurulan taslak doğru sektör ve kolon türleriyle okunur; aylar ve ödeme günü takvime girer", () => {
    assert.deepEqual(new Set(templateIds()), new Set(SECTORS.map(sector => sector.id)));
    const wrong = [];
    for (const sector of SECTORS) {
      const template = sectorTemplate(sector.id, { now });
      const rows = Array.from({ length: 8 }, (_, index) => Object.fromEntries([["__hofKey", `satir:${sector.id}${index}`], ["__sheet", template.sheet], ...template.columns.map(column => [column.label, fill(column, index)])]));
      const analysis = analyzeDataset({ rows, tabs: [template.sheet], now });
      const got = SECTORS.find(item => item.id === analysis.sector.suggestion);
      // Genel grubunda ipucu az olan sektörler "Genel" olarak önerilebilir; diğer her sektör kendisi olarak tanınır.
      if (analysis.sector.suggestion !== sector.id && !(sector.group === "genel" && got?.group === "genel")) wrong.push(`${sector.id} → ${analysis.sector.suggestion}`);
      const role = label => analysis.columns.find(column => column.column === label)?.role;
      for (const column of template.columns) {
        if (column.kind === "money" && role(column.label) !== "money") wrong.push(`${sector.id}: ${column.label} tutar değil (${role(column.label)})`);
        if (column.kind === "date" && role(column.label) !== "date") wrong.push(`${sector.id}: ${column.label} tarih değil (${role(column.label)})`);
        if (column.kind === "phone" && role(column.label) !== "phone") wrong.push(`${sector.id}: ${column.label} telefon değil (${role(column.label)})`);
      }
      const hasPerson = template.columns.some(column => column.kind === "person");
      if (hasPerson !== Boolean(analysis.primary.person)) wrong.push(`${sector.id}: kişi kolonu ${analysis.primary.person || "yok"}`);
      const dues = computeDues({ rows, tabs: [template.sheet], now });
      if (template.months && !dues.items.some(item => item.kind === "month")) wrong.push(`${sector.id}: ay kolonları takvime girmedi`);
      if (template.columns.some(column => column.kind === "day") && !template.months && !dues.items.some(item => item.recurring)) wrong.push(`${sector.id}: ödeme günü takvime girmedi`);
    }
    assert.deepEqual(wrong, []);
  });

  it("ay kolonları: eğitim yılı Eylül–Haziran, takvim yılı Ocak–Aralık (yılla)", () => {
    assert.deepEqual(monthHeaders("school", new Date(2026, 8, 29)).slice(0, 5), ["Eylül 2026", "Ekim 2026", "Kasım 2026", "Aralık 2026", "Ocak 2027"]);
    assert.equal(monthHeaders("school", new Date(2027, 2, 1))[0], "Eylül 2026", "Mart'ta içinde bulunulan eğitim yılı");
    assert.equal(monthHeaders("year", new Date(2026, 4, 1)).length, 12);
  });

  it("dosya: başlık satırı, açılır liste, ödeme günü sınırı, yardım notu, tarih/tutar/metin biçimi", () => {
    const template = sectorTemplate("okul-servisi", { now: new Date(2026, 8, 29) });
    const buffer = buildXlsx([templateSheet(template)], { now: new Date(2026, 8, 29) });
    const files = new Map(readZip(buffer).map(entry => [entry.name, entry.data.toString("utf8")]));
    const sheet = files.get("xl/worksheets/sheet1.xml");
    assert.match(sheet, /<t>Öğrenci<\/t>/);
    assert.match(sheet, /<t>Eylül 2026<\/t>/);
    assert.match(sheet, /state="frozen"/);
    assert.match(sheet, /<dataValidation type="list"[^>]*sqref="[A-Z]+2:[A-Z]+2001"><formula1>"Aktif,Ayrıldı"<\/formula1>/);
    assert.match(sheet, /promptTitle="Aylık Ücret"/);
    assert.ok(sheet.indexOf("<dataValidations") > sheet.indexOf("</sheetData>") && sheet.indexOf("<dataValidations") < sheet.indexOf("<pageMargins"), "şemadaki yerinde");
    const styles = files.get("xl/styles.xml");
    assert.match(styles, /formatCode="#,##0\.00"/);
    assert.match(styles, /numFmtId="49"/, "telefon metin biçiminde (baştaki 0)");
    const withDay = sectorTemplate("site-yonetimi", { now: new Date(2026, 8, 29) });
    const daySheet = new Map(readZip(buildXlsx([templateSheet(withDay)])).map(entry => [entry.name, entry.data.toString("utf8")])).get("xl/worksheets/sheet1.xml");
    assert.match(daySheet, /type="whole" operator="between"[^>]*><formula1>1<\/formula1><formula2>31<\/formula2>/);
  });

  it("uçlar: katalog, dosya adı, bilinmeyen sektör, giriş gerekir", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const catalog = (await admin.get("/api/workspace/templates")).data.data;
      assert.ok(catalog.groups.reduce((sum, group) => sum + group.sectors.length, 0) >= SECTORS.length);
      const file = await admin.raw("GET", "/api/workspace/templates/hukuk-icra/xlsx");
      assert.equal(file.status, 200);
      assert.equal(file.buffer.subarray(0, 2).toString(), "PK");
      assert.match(decodeURIComponent(file.headers.get("content-disposition")), /DestekOfis Taslak - İcra ve Alacak Takibi\.xlsx/);
      assert.equal((await admin.get("/api/workspace/templates/yok-boyle/xlsx")).status, 404);
      assert.equal((await server.client().get("/api/workspace/templates")).status, 401);
    } finally {
      await server.close();
    }
  });
});
