// 2.3.0 İz 5.1–5.4 (kullanıcı kararı 15.10.2026, müşteri talepleri; docs/2.3.0-IS-LISTESI.md):
//   5.1 Banka → Hareketler PDF / Excel: ekrandaki süzgeçlerle aynı liste (movements.list; ikinci hesaplama yok), alt TOPLAM, Rapor Merkezi üreticisi;
//       bank.view yeter (kullanıcı yalnız gördüğü satırları indirir).
//   5.2 "Tüm Zamanlar": ekran/PDF/Excel başlığında "1976" ve "19xx" geçmez (her rapor); dönem metni "Tüm Zamanlar"; POS Ödeme Takvimi boşken ipucu + bağ.
//   5.3 POS Satış Raporu / POS Komisyon Raporu (plan §8.10; müşteri "provizyon kesintisi"): kip ve vergi ayrımı, iade ayrı satır, her süzgeç, TOPLAM, PDF/Excel.
//   5.4 Rapor Merkezi grup sırası: Cari · Kasa · Stok · Fatura · Çek / Senet · Taksit · Banka · Ana Defter · Kayıtlar · Ofis.
// Beklenen sayılar testin kendi defterinden (POS kuralı: BSMV Dahil → kesinti = brüt × oran; BSMV = kesinti − kesinti / 1,05; komisyon = kesinti − BSMV;
// net = brüt − kesinti; İade Edilmez → iadede komisyon 0) — programın kodu çağrılmadan (ders 5). Sahte saat (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, TODAY, acceptanceBase, bootBank, kurus, must, openPos, posInvoice, ziraatPos } from "./banka-220-pos-ortak.mjs";

const RC = "/api/workspace/report-center";
const GROUP_ORDER = ["Cari", "Kasa", "Stok", "Fatura", "Çek / Senet", "Taksit", "Banka", "Ana Defter", "Kayıtlar", "Ofis"];
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : null;
};
const qs = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)).toString();
// Bağımsız POS defteri (kuruş). BSMV Dahil: kesinti = brüt × oran; BSMV = kesinti − round(kesinti / 1,05); komisyon = kesinti − BSMV.
const deductionOf = (gross, rate) => Math.round((gross * rate) / 1000);
const taxOf = deduction => deduction - Math.round(deduction / 1.05);
const SALES = [];
const sale = (d, gross, ratePerMille, installments, extra = {}) => {
  const deduction = deductionOf(gross, ratePerMille);
  const bsmv = taxOf(deduction);
  SALES.push({ d, kind: "sale", gross, commission: deduction - bsmv, bsmv, net: gross - deduction, installments, ...extra });
};
const refund = (d, gross, extra = {}) => SALES.push({ d, kind: "refund", gross: -gross, commission: 0, bsmv: 0, net: -gross, installments: 1, ...extra });

describe("2.3.0 İz 5 — Hareketler PDF/Excel, Tüm Zamanlar, POS Satış / Komisyon raporları, grup sırası", () => {
  let ctx;
  let api;
  let base;
  let pos;
  let pos2;
  let companyName;

  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    const companies = await must("şirketler", api.get("/api/companies"));
    companyName = "İz Beş Ticaret A.Ş.";
    await must("unvan", api.put(`/api/companies/${companies.companies[0].id}`, { name: companyName }));
    base = await acceptanceBase(ctx);
    pos = await openPos(api, ziraatPos(base.acc.ziraat.id));
    pos2 = await openPos(api, ziraatPos(base.acc.garanti.id, { name: "Garanti Sanal POS", kind: "virtual", merchantNo: "987654321", terminalNo: "T002" }));
    // 08.10 Ürün B 10 × 1.000 tek çekim (kesinti 250 = 238,10 + 11,90; net 9.750).
    const first = await must("POS'lu fatura", posInvoice(api, { accountId: base.abc.id, itemId: base.urunB.id, qty: 10, unitPrice: 1000, date: TODAY, posId: pos.id }));
    sale(TODAY, kurus(10000), 25, 1);
    // 12.10 Ürün B 12 × 1.000 3 taksit %3,5 (kesinti 420 = 400 + 20; net 11.580).
    ctx.server.clock.set("2026-10-12T10:00:00+03:00");
    await must("taksitli POS'lu fatura", posInvoice(api, { accountId: base.abc.id, itemId: base.urunB.id, qty: 12, unitPrice: 1000, date: "2026-10-12", installments: 3, posId: pos.id }));
    sale("2026-10-12", kurus(12000), 35, 3);
    // 13.10 Satıştan İade 3 adet = 3.000 POS İadesi (İade Edilmez → komisyon geri alınmaz).
    ctx.server.clock.set("2026-10-13T10:00:00+03:00");
    const original = await must("asıl fatura", api.get(`/api/workspace/invoices/${first.id}`));
    await must("Satıştan İade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: first.id, issueDate: "2026-10-13", lines: [{ originLineId: original.lines[0].id, qty: 3 }], payment: { cash: [{ amount: 3000, method: "card", posId: pos.id }], cheques: [], endorse: [], rest: "open" }, force: true }));
    refund("2026-10-13", kurus(3000));
    // Banka hareketleri (5.1 için): Ziraat'e masraf ve Garanti'ye cari tahsilatı.
    await must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: base.acc.ziraat.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-13" }));
    await must("ABC tahsilat", api.post(`/api/workspace/accounts/${base.abc.id}/entries`, { kind: "in", amount: "1.500", method: "bank", bankAccountId: base.acc.garanti.id, date: "2026-10-13" }));
  });
  after(() => ctx?.server.close());

  const get = (id, query = {}, format = "") => (format ? api.raw("GET", `${RC}/${id}/${format}?${qs(query)}`) : api.get(`${RC}/${id}?${qs(query)}`));
  const col = (data, header) => {
    const index = data.headers.indexOf(header);
    assert.ok(index >= 0, `${data.id}: "${header}" kolonu yok (${data.headers.join(", ")})`);
    return index;
  };
  const cellOf = (data, row, header) => moneyOf(row[col(data, header)]) ?? 0;
  const summaryOf = (data, key) => {
    const hit = data.summary.find(([name]) => name === key);
    assert.ok(hit, `${data.id}: özette "${key}" yok: ${JSON.stringify(data.summary)}`);
    return moneyOf(hit[1]) ?? hit[1];
  };
  const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
  async function screen(id, query, tag) {
    const res = await get(id, query);
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    if (data.footer) {
      data.headers.forEach((header, index) => {
        if (data.types[index] !== "money" || header === "Bakiye") return;
        const values = data.rows.map(row => moneyOf(row[index])).filter(value => value !== null);
        if (values.length) assert.equal(moneyOf(data.footer[index]), sum(values, value => value), `${tag}: TOPLAM "${header}"`);
      });
    }
    return data;
  }
  async function checkFiles(id, query, data, tag) {
    const pdf = await get(id, query, "pdf");
    assert.equal(pdf.status, 200, `${tag} PDF`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes(data.title) && text.includes(companyName), `${tag} PDF: başlık ve şirket`);
    for (const row of data.rows) for (const cell of row) if (moneyOf(cell) !== null) assert.ok(text.includes(String(cell).trim()), `${tag} PDF: "${cell}" yok`);
    if (data.footer) for (const cell of data.footer) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `${tag} PDF: TOPLAM "${cell}" yok`);
    const xlsx = await get(id, query, "xlsx");
    assert.equal(xlsx.status, 200, `${tag} Excel`);
    const book = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    assert.deepEqual(sheet[0], data.headers, `${tag} Excel: başlık satırı`);
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer ? 1 : 0), `${tag} Excel: satır sayısı`);
    if (data.footer) data.footer.forEach((cell, c) => {
      if (moneyOf(cell) === null) return;
      const excel = sheet.at(-1)[c];
      assert.equal(typeof excel === "number" ? Math.round(excel * 100) : moneyOf(excel), moneyOf(cell), `${tag} Excel TOPLAM "${data.headers[c]}"`);
    });
  }

  it("5.4 katalog grup sırası: Cari · Kasa · Stok · Fatura · Çek / Senet · Taksit · Banka · Ana Defter · Kayıtlar · Ofis (tanım sırasından bağımsız)", async () => {
    const catalog = await must("katalog", api.get(RC));
    const groups = [...new Set(catalog.reports.map(report => report.group))];
    assert.deepEqual(groups, GROUP_ORDER.filter(name => groups.includes(name)), `grup sırası: ${groups.join(" · ")}`);
    assert.equal(groups[0], "Cari");
    assert.ok(groups.indexOf("Banka") > groups.indexOf("Taksit") && groups.indexOf("Ana Defter") > groups.indexOf("Banka"));
    // Grup içinde rapor sırası tanım sırası: Banka grubunun ilk raporu Banka Bakiye Raporu, POS Satış Raporu Faturası Beklenen'den sonra.
    const bank = catalog.reports.filter(report => report.group === "Banka").map(report => report.id);
    assert.equal(bank[0], "banka-bakiye");
    assert.ok(bank.indexOf("pos-satis") > bank.indexOf("faturasi-beklenen-komisyonlar") && bank.indexOf("pos-komisyon") === bank.indexOf("pos-satis") + 1, bank.join(", "));
    // Yetkisi sınırlı kullanıcıda da aynı sıra (muhasebe: yalnız Banka; Kasa grubu yoksa sıra bozulmaz).
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "iz5-muhasebe", role: "muhasebe" }));
    const own = await must("muhasebe katalog", accountant.get(RC));
    const ownGroups = [...new Set(own.reports.map(report => report.group))];
    assert.deepEqual(ownGroups, GROUP_ORDER.filter(name => ownGroups.includes(name)));
  });

  it("5.3 POS Satış Raporu: her POS × tür × dönem — satış, taksitli satış, iade ayrı satır (eksi); komisyon matrah, BSMV ayrı, net; TOPLAM; PDF/Excel", async () => {
    const RANGES = [
      { label: "Bu Yıl", q: {}, from: "2026-01-01", to: "2026-12-31" },
      { label: "Bu Ay", q: { preset: "thisMonth" }, from: "2026-10-01", to: "2026-10-31" },
      { label: "tek gün 08.10", q: { from: TODAY, to: TODAY }, from: TODAY, to: TODAY },
      { label: "12.10–13.10", q: { from: "2026-10-12", to: "2026-10-13" }, from: "2026-10-12", to: "2026-10-13" },
      { label: "boş (2020)", q: { from: "2020-01-01", to: "2020-12-31" }, from: "2020-01-01", to: "2020-12-31" },
    ];
    const KINDS = ["", "sale", "refund", "cancel"];
    const POS = [["", null], ["Z", pos.id], ["G", pos2.id]];
    for (const r of RANGES) {
      for (const [which, posId] of POS) {
        for (const kind of KINDS) {
          const query = { ...r.q, ...(posId ? { posTerminal: posId } : {}), ...(kind ? { posSale: kind } : {}) };
          const tag = `pos-satis ${which || "tümü"} ${kind || "tüm türler"} ${r.label}`;
          const data = await screen("pos-satis", query, tag);
          const expected = which === "G" ? [] : SALES.filter(item => item.d >= r.from && item.d <= r.to && (!kind || item.kind === kind));
          assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı (${data.rows.map(row => row.join(" | ")).join("\n")})`);
          expected.forEach((item, index) => {
            const row = data.rows[index];
            assert.equal(row[col(data, "Tür")], item.kind === "sale" ? "POS Satışı" : "POS İadesi", `${tag}: tür`);
            assert.equal(row[col(data, "POS")], "Ziraat Fiziki POS", `${tag}: POS`);
            assert.equal(row[col(data, "Cari")], "ABC Ltd.", `${tag}: cari`);
            assert.equal(row[col(data, "Taksit")], item.installments > 1 ? `${item.installments} Taksit` : "Tek Çekim", `${tag}: taksit`);
            assert.equal(row[col(data, "Kip")], "BSMV Dahil", `${tag}: kip`);
            assert.deepEqual([cellOf(data, row, "Brüt"), cellOf(data, row, "Komisyon"), cellOf(data, row, "BSMV"), cellOf(data, row, "KDV"), cellOf(data, row, "Net")], [item.gross, item.commission, item.bsmv, 0, item.net], `${tag}: ${row.join(" | ")}`);
            assert.ok(row[col(data, "İşlem No")], `${tag}: İşlem No`);
          });
          assert.equal(summaryOf(data, "Brüt (Net)"), sum(expected, item => item.gross), `${tag}: Brüt (Net)`);
          assert.equal(summaryOf(data, "Komisyon (Net)"), sum(expected, item => item.commission), `${tag}: Komisyon (Net)`);
          assert.equal(summaryOf(data, "BSMV"), sum(expected, item => item.bsmv), `${tag}: BSMV`);
          assert.equal(summaryOf(data, "Bankaya Geçecek (Net)"), sum(expected, item => item.net), `${tag}: Net`);
          if (expected.length) assert.equal(moneyOf(data.footer[col(data, "Net")]), sum(expected, item => item.net), `${tag}: TOPLAM Net`);
          if (!r.q.preset && r.from === "2026-01-01" && !kind && !posId) await checkFiles("pos-satis", query, data, tag);
        }
      }
    }
    // Bağımsız: 10.000 → 238,10 + 11,90, net 9.750; 12.000 → 400 + 20, net 11.580; iade −3.000.
    assert.deepEqual(SALES.map(item => [item.gross, item.commission, item.bsmv, item.net]), [[1_000_000, 23_810, 1_190, 975_000], [1_200_000, 40_000, 2_000, 1_158_000], [-300_000, 0, 0, -300_000]]);
  });

  it("5.3 POS Komisyon Raporu: Aylık / Yıllık / Dönem Toplamı × POS × tür — satış ve iade ayrı satır, kip; TOPLAM = satırlar; PDF/Excel", async () => {
    for (const [period, label] of [["month", "Ekim 2026"], ["year", "2026"], ["range", "01.01.2026 – 31.12.2026"]]) {
      for (const kind of ["", "sale", "refund"]) {
        const query = { posPeriod: period, ...(kind ? { posSale: kind } : {}) };
        const tag = `pos-komisyon ${period} ${kind || "tümü"}`;
        const data = await screen("pos-komisyon", query, tag);
        const groupsExpected = ["sale", "refund"].filter(which => !kind || which === kind).map(which => ({ which, items: SALES.filter(item => item.kind === which) }));
        assert.equal(data.rows.length, groupsExpected.length, `${tag}: satır sayısı (${data.rows.map(row => row.join(" | ")).join("\n")})`);
        groupsExpected.forEach((group, index) => {
          const row = data.rows[index];
          assert.equal(row[col(data, "Dönem")], label, `${tag}: dönem`);
          assert.equal(row[col(data, "POS")], "Ziraat Fiziki POS");
          assert.equal(row[col(data, "Tür")], group.which === "sale" ? "POS Satışı" : "POS İadesi", `${tag}: tür`);
          assert.equal(row[col(data, "Kip")], "BSMV Dahil");
          assert.equal(Number(row[col(data, "İşlem")]), group.items.length, `${tag}: işlem sayısı`);
          assert.deepEqual([cellOf(data, row, "Brüt"), cellOf(data, row, "Komisyon"), cellOf(data, row, "BSMV"), cellOf(data, row, "KDV"), cellOf(data, row, "Net")], [sum(group.items, item => item.gross), sum(group.items, item => item.commission), sum(group.items, item => item.bsmv), 0, sum(group.items, item => item.net)], `${tag}: ${row.join(" | ")}`);
        });
        const all = groupsExpected.flatMap(group => group.items);
        assert.equal(summaryOf(data, "Komisyon (Net)"), sum(all, item => item.commission), `${tag}: özet komisyon`);
        assert.equal(summaryOf(data, "Bankaya Geçen (Net)"), sum(all, item => item.net), `${tag}: özet net`);
        assert.equal(summaryOf(data, "İadede Geri Alınan Komisyon"), 0, `${tag}: iade komisyonu (İade Edilmez)`);
        if (data.footer) assert.equal(data.footer[col(data, "Kesinti %")], "", `${tag}: oran toplanmaz`);
        if (period === "month" && !kind) {
          assert.match(data.rows[0][col(data, "Kesinti %")], /^%3,05$/, "satış satırının kesinti oranı 670 / 22.000 = %3,05");
          await checkFiles("pos-komisyon", query, data, tag);
        }
      }
    }
    // Garanti Sanal POS'ta işlem yok → boş; tanınmayan dönem değeri aylığa düşmez, 400 değil varsayılan (izin listesi); POS süzgeci.
    const empty = await screen("pos-komisyon", { posTerminal: pos2.id }, "Garanti POS");
    assert.equal(empty.rows.length, 0);
    assert.match(empty.subtitle, /^Garanti Sanal POS · Aylık/);
    const zir = await screen("pos-komisyon", { posTerminal: pos.id, posPeriod: "year" }, "Ziraat yıllık");
    assert.equal(zir.rows.length, 2);
    assert.match(zir.subtitle, /^Ziraat Fiziki POS · Yıllık/);
  });

  it("5.1 Banka → Hareketler PDF / Excel: ekrandaki süzgeçle aynı satırlar (hesap, tür, yön, tarih, arama), alt TOPLAM, Rapor Merkezi başlığı; bank.view yeter, personel 403", async () => {
    const CASES = [
      { label: "tümü", q: {} },
      { label: "Ziraat", q: { account: base.acc.ziraat.id } },
      { label: "Garanti giriş", q: { account: base.acc.garanti.id, dir: "in" } },
      { label: "masraf", q: { type: "fee" } },
      { label: "13.10", q: { from: "2026-10-13", to: "2026-10-13" } },
      { label: "arama ABC", q: { q: "ABC" } },
      { label: "POS", q: { pos: pos.id } },
      { label: "boş (2020)", q: { from: "2020-01-01", to: "2020-12-31" } },
    ];
    for (const c of CASES) {
      const list = await must(`liste ${c.label}`, api.get(`${BANK}/movements?${qs({ ...c.q, limit: "200" })}`));
      const xlsx = await api.raw("GET", `${BANK}/movements.xlsx?${qs(c.q)}`);
      assert.equal(xlsx.status, 200, `${c.label} Excel ${xlsx.status}`);
      const sheets = xlsxSheets(xlsx.buffer);
      const book = Object.values(sheets)[0];
      assert.match(String(book[0]?.[0]), /^\d{3} · /, `${c.label}: başlık bloğu şirket`);
      assert.equal(book[1]?.[0], "Banka Hareketleri");
      const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
      assert.deepEqual(sheet[0], ["Tarih", "İşlem No", "Tür", "Hesap", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Durum", "Giren"], `${c.label}: kolonlar`);
      const body = sheet.slice(1).filter(row => row[0] !== "TOPLAM");
      assert.equal(body.length, list.rows.length, `${c.label}: Excel satırları = ekrandaki liste (${body.length} / ${list.rows.length})`);
      assert.deepEqual(body.map(row => row[1]), list.rows.map(row => row.no), `${c.label}: İşlem No sırası ekranla aynı`);
      const inSum = list.rows.filter(row => row.status === "active" && row.signedMinor >= 0).reduce((total, row) => total + row.signedMinor, 0);
      const outSum = list.rows.filter(row => row.status === "active" && row.signedMinor < 0).reduce((total, row) => total - row.signedMinor, 0);
      const total = sheet.at(-1);
      if (list.rows.length) {
        assert.equal(total[0], "TOPLAM", `${c.label}: TOPLAM satırı`);
        const value = cell => (typeof cell === "number" ? Math.round(cell * 100) : moneyOf(cell) || 0);
        assert.equal(value(total[5]), inSum, `${c.label}: TOPLAM Giriş`);
        assert.equal(value(total[6]), outSum, `${c.label}: TOPLAM Çıkış`);
        assert.equal(total[7], "", `${c.label}: Bakiye toplanmaz`);
      } else assert.ok(!sheet.some(row => row[0] === "TOPLAM"), `${c.label}: boşta TOPLAM yok`);
      const ozet = Object.fromEntries((sheets["Özet"] || []).slice(1).map(([key, val]) => [key, val]));
      assert.equal(typeof ozet["Giriş (Etkin)"] === "number" ? Math.round(ozet["Giriş (Etkin)"] * 100) : moneyOf(ozet["Giriş (Etkin)"]), inSum, `${c.label}: Özet Giriş`);
      assert.equal(Number(ozet.Hareket), list.rows.length, `${c.label}: Özet Hareket`);
      const pdf = await api.raw("GET", `${BANK}/movements.pdf?${qs(c.q)}`);
      assert.equal(pdf.status, 200, `${c.label} PDF`);
      assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      assert.ok(text.includes("Banka Hareketleri") && text.includes(companyName), `${c.label} PDF: başlık ve şirket`);
      for (const row of list.rows) assert.ok(text.includes(row.no), `${c.label} PDF: İşlem No ${row.no}`);
      if (c.q.account === base.acc.ziraat.id && !c.q.dir) {
        assert.ok(list.balance && body.every(row => moneyOf(row[7]) !== null || typeof row[7] === "number"), "tek hesapta yürüyen bakiye dolu");
        assert.ok(text.includes("Ziraat Bankası · Ana TL Hesabı"), "PDF alt başlığında hesap");
      }
    }
    // Süzgeç doğrulaması listeyle aynı: tanınmayan tür 400, olmayan hesap 404.
    assert.equal((await api.raw("GET", `${BANK}/movements.pdf?type=yok`)).status, 400);
    assert.equal((await api.raw("GET", `${BANK}/movements.xlsx?account=yok`)).status, 404);
    // Yetki: personel (bank.view yok) 403 ve dosya sızmaz; muhasebe (bank.view var, bank.reports olsa da olmasa da) indirir.
    const personel = apiOf(await createUser(ctx.server, api.client, { username: "iz5-personel", role: "personel" }));
    for (const suffix of ["pdf", "xlsx"]) {
      const res = await personel.raw("GET", `${BANK}/movements.${suffix}`);
      assert.equal(res.status, 403, `personel ${suffix}`);
      assert.ok(!res.buffer.toString("latin1").startsWith("%PDF") && res.buffer.subarray(0, 2).toString("latin1") !== "PK", "dosya sızdı");
    }
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "iz5-muhasebe-2", role: "muhasebe" }));
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    await must("rapor yetkisini kaldır", api.client.patch(`/api/admin/users/${users.find(user => user.username === "iz5-muhasebe-2").id}`, { grants: { add: [], remove: ["bank.reports"] } }));
    assert.equal((await accountant.get(RC)).status, 403, "Banka Raporları yok");
    assert.equal((await accountant.raw("GET", `${BANK}/movements.xlsx?account=${base.acc.ziraat.id}`)).status, 200, "bank.view ile Hareketler Excel");
  });

  it("5.2 Tüm Zamanlar: her raporun ekran başlığı ve PDF'i '1976' / '19xx' içermez, dönem metni 'Tüm Zamanlar'; POS Ödeme Takvimi boşken ipucu + Banka → Hareketler bağı", async () => {
    const catalog = await must("katalog", api.get(RC));
    const all = { preset: "all", from: "1976-01-01", to: TODAY }; // ekranın gönderdiği biçim (hof-report-center.js presetRange("all"))
    let checked = 0;
    for (const report of catalog.reports) {
      const query = { ...all, ...(report.accountRequired ? { account: base.abc.id } : {}) };
      const res = await api.get(`${RC}/${report.id}?${qs(query)}`);
      assert.equal(res.status, 200, `${report.id}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      const head = `${res.data.title} ${res.data.subtitle}`;
      assert.ok(!/\b19\d\d\b/.test(head), `${report.id}: başlıkta 19xx (${head})`);
      if (report.params.includes("range")) assert.ok(/Tüm Zamanlar/.test(res.data.subtitle) || !/\d{2}\.\d{2}\.\d{4} – /.test(res.data.subtitle), `${report.id}: dönem metni Tüm Zamanlar (${res.data.subtitle})`);
      for (const row of res.data.rows) assert.ok(!/\b19\d\d\b/.test(row[0] || ""), `${report.id}: satırda 19xx (${row[0]})`);
      checked += 1;
    }
    assert.ok(checked > 40, `${checked} rapor`);
    for (const id of ["banka-bakiye", "kasa-hareketleri", "pos-satis", "banka-gunluk", "cari-hareketleri"]) {
      const pdf = await api.raw("GET", `${RC}/${id}/pdf?${qs(all)}`);
      assert.equal(pdf.status, 200, `${id} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      assert.ok(!/\b19\d\d\b/.test(text), `${id} PDF: 19xx geçiyor`);
      assert.ok(text.includes("Tüm Zamanlar"), `${id} PDF: Tüm Zamanlar`);
    }
    // Vade raporları sınırsız kalır (preset=all → açık aralık): POS Ödeme Takvimi bütün bekleyenler.
    const takvim = catalog.reports.find(report => report.id === "pos-odeme-takvimi");
    assert.deepEqual(takvim.emptyHint, { text: "Bekleyen POS kalemi yok; bankaya geçenler Banka → Hareketler'de.", bankTab: "movements", label: "Banka → Hareketler" }, "POS Ödeme Takvimi boş ipucu kataloğa gider");
    const pending = await must("takvim", api.get(`${RC}/pos-odeme-takvimi?preset=all`));
    assert.ok(pending.rows.length >= 3, "bekleyen POS kalemleri (taksitler + satış)");
    assert.match(pending.subtitle, /Bütün bekleyenler/);
    const noHint = catalog.reports.filter(report => report.emptyHint).map(report => report.id);
    assert.deepEqual(noHint, ["pos-odeme-takvimi"], "ipucu yalnız POS Ödeme Takvimi'nde");
  });
});
