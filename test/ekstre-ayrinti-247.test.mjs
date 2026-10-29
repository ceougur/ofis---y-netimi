// 2.4.7 müşteri istekleri (kullanıcı 28.10.2026) — Ayrıntılı Cari Ekstre (Rapor Merkezi cari-ekstre, items=1). Kapsam yalnız bu rapor; seçenek kapalı Cari Ekstre ve
// saklanan veri değişmez.
//   (5)  metin: alt başlıkta YALNIZ "Cari No … · tarih aralığı" ("Fatura kalemleriyle" ve "B: borçlu · A: alacaklı" yok); İşlem kolonunda tür kısa adı
//        ("Satış", "Alış", "Satıştan İade", "Alıştan İade"); açıklamada da "Satış FIS…" (kayıtta "Satış Faturası FIS…" SAKLI kalır). Fatura kesilmemiş Müşteri
//        Fişi (FIS serisi — "değersiz fiş") da "… Faturası" görünmez. Ekran, PDF, Excel.
//   (6a) Sütunlar: gizlenen kolon ekranda, PDF'te ve Excel'de yok; TOPLAM = satırlar; seçim KİŞİ BAŞINA sunucuda hatırlanır (yeni oturum, sunucu yeniden açılışı,
//        öbür şirket aynı; başka kullanıcı etkilenmez); en az bir kolon; bilinmeyen kolon reddedilir; yetkisiz 403.
//   (6b) Kalem Açıklaması: fatura satırının açıklaması (invoice_lines.description) kalem satırında; açıklamasız kalemde boş; stok kartı notu HİÇ gelmez; dönemde
//        açıklamalı kalem yoksa kolon çıkmaz (boş kolon); uzun açıklama PDF'te sarılır, tutarlar bölünmez.
// Boş dönem, tek kayıt, yetkisiz kullanıcı (CLAUDE.md rapor kuralı). Eski kodda (2.4.6 / bu dalın tabanı) kırmızı: kolon, uç ve metinler yok.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
// Saf kolon seçimi testte yüklenir (eski kodda yok: yalnız o test kırmızı olsun, dosyanın tamamı değil).
const detailLib = () => import("../server/lib/statement-detail.mjs");

const LICENSE = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const NOW = "2026-11-27T12:00:00+03:00";
const RANGE = "from=2026-01-01&to=2026-12-31";
const ACIKLAMA = "Banyo kapısı 80x190 ölçüsünde, şeffaf temperli cam ve krom profil; sağdan açılım, montaj yerinde ölçü alınarak yapılacaktır (KALEMNOTU247)";
const STOK_NOTU = "Depo rafı B3 — STOKNOTU247 müşteriye gösterilmez";
const LABEL = "Açıklama / Ürün - Hizmet";

const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
async function must(label, promise) {
  const r = await promise;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return unwrap(r);
}
const kurus = text => {
  const match = /^(-?)([\d.]+),(\d{2}) TL( [BA])?$/.exec(String(text ?? "").replace(/−/g, "-").trim());
  if (!match) return null;
  const value = Number(`${match[2].replace(/\./g, "")}${match[3]}`) * (match[1] ? -1 : 1);
  return match[4] === " A" ? -value : value;
};
const col = (data, name) => data.headers.indexOf(name);
/** TOPLAM = satırlar: görünen Borç / Alacak kolonlarında Dönem Toplamı = dönem hareketleri, Genel Toplam = devir dahil; kalem satırları toplanmaz. */
function assertTotals(data, label) {
  const moves = data.rows.filter((_, index) => data.rowMarks[index] !== "item");
  const sum = (rows, index) => rows.reduce((total, row) => total + (kurus(row[index]) || 0), 0);
  const [period, grand] = data.footers;
  for (const name of ["Borç", "Alacak"]) {
    const at = col(data, name);
    if (at < 0) continue;
    assert.equal(kurus(period[at]), sum(moves.slice(1), at), `${label}: Dönem Toplamı ${name}`);
    assert.equal(kurus(grand[at]), sum(moves, at), `${label}: Genel Toplam ${name}`);
  }
  const bakiye = col(data, "Bakiye");
  if (bakiye >= 0) assert.equal(grand[bakiye], moves.at(-1)[bakiye], `${label}: Genel Toplam bakiye = son satır`);
  assert.equal(data.footers.every(line => line.length === data.headers.length), true, `${label}: TOPLAM satırı kolon sayısı`);
  assert.equal(data.rows.every(row => row.length === data.headers.length), true, `${label}: satır kolon sayısı`);
}

describe("2.4.7 Ayrıntılı Cari Ekstre — (5) metin, (6a) Sütunlar, (6b) Kalem Açıklaması", () => {
  let server;
  let admin;
  let muhasebe;
  const id = {};
  const get = (client, account, extra = "") => must(`ekstre ${account}`, client.get(`/api/workspace/report-center/cari-ekstre?account=${account}&${RANGE}&items=1${extra}`));
  const files = async (client, account, extra = "") => {
    const pdf = await client.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?account=${account}&${RANGE}&items=1${extra}`);
    const xlsx = await client.raw("GET", `/api/workspace/report-center/cari-ekstre/xlsx?account=${account}&${RANGE}&items=1${extra}`);
    assert.equal(pdf.status, 200, "PDF");
    assert.equal(xlsx.status, 200, "Excel");
    const sheet = xlsxRows(xlsx.buffer);
    const headerAt = sheet.findIndex(row => row[0] === "Tarih" || row.includes("Bakiye"));
    return { pdf: pdfText(pdf.buffer), sheet, headerAt, xheaders: sheet[headerAt] || [], body: sheet.slice(headerAt + 1) };
  };
  const setColumns = (client, hidden, extra = "") => client.put(`/api/workspace/report-center/cari-ekstre/columns${extra}`, { hidden });

  before(async () => {
    server = await startTestServer({ now: NOW, env: LICENSE, startLicenseTimers: false, legacyCasePayments: false, legacyTableTransfer: false });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
    muhasebe = await createUser(server, admin, { username: "muhasebe247", role: "muhasebe" });
    id.customer = (await must("müşteri", admin.post("/api/workspace/accounts", { name: "Cam Kabin Müşterisi", type: "customer", registeredOn: "2026-01-01" }))).id;
    id.supplier = (await must("tedarikçi", admin.post("/api/workspace/accounts", { name: "Profil Tedarik", type: "supplier", registeredOn: "2026-01-01" }))).id;
    id.single = (await must("tek kayıt", admin.post("/api/workspace/accounts", { name: "Tek Satırlı Cari", type: "customer", registeredOn: "2026-01-01" }))).id;
    id.item = (await must("ürün", admin.post("/api/workspace/stock", { name: "Köşe Kabin 90", code: "KK-90", unit: "Adet", unitPrice: "1000", salePrice: "2500", vatRate: "20", note: STOK_NOTU, openingQty: "10", openingDate: "2026-01-02" }))).id;
    // Alış + alıştan iade (tarih sırası: FIS serisi numara–tarih sırasına uyar).
    const buy = await must("alış", admin.post("/api/workspace/invoices", { kind: "purchase", accountId: id.supplier, number: "PRF-2026-11", issueDate: "2026-11-05", lines: [{ itemId: id.item, goods: true, name: "Köşe Kabin 90", qty: 5, unitPrice: 1000, vatRate: 20, description: "Tedarikçi lot 7" }], payment: { rest: "open" } }));
    await must("alıştan iade", admin.post("/api/workspace/invoices", { kind: "purchase_return", accountId: id.supplier, issueDate: "2026-11-08", originalId: buy.id, lines: [{ originLineId: buy.lines[0].id, qty: 1 }], payment: {} }));
    // Satış (Müşteri Fişi — FIS serisi, e-Belge kapalı): açıklamalı stok kalemi + açıklamasız hizmet kalemi; peşin nakit tahsilat.
    const sale = await must("satış", admin.post("/api/workspace/invoices", { kind: "sale", accountId: id.customer, issueDate: "2026-11-10", lines: [{ itemId: id.item, goods: true, name: "Köşe Kabin 90", code: "KK-90", qty: 2, unitPrice: 2500, vatRate: 20, description: ACIKLAMA }, { name: "Montaj", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { cash: [{ amount: "600", method: "cash" }], rest: "open" } }));
    id.sale = sale.id;
    id.saleNo = sale.number;
    id.saleLines = sale.lines.map(line => line.id);
    await must("satıştan iade", admin.post("/api/workspace/invoices", { kind: "sale_return", accountId: id.customer, issueDate: "2026-11-12", originalId: sale.id, lines: [{ originLineId: id.saleLines[0], qty: 1 }], payment: {} }));
    await must("tahsilat", admin.post(`/api/workspace/accounts/${id.customer}/entries`, { kind: "in", amount: "1000", method: "cash", date: "2026-11-20", note: "Elden" }));
    await must("tek fatura", admin.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: id.single, issueDate: "2026-11-15", lines: [{ name: "Keşif", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }));
  });
  after(async () => server?.close());

  test("5 alt başlık yalnız Cari No + tarih aralığı (ekran, PDF, Excel); seçenek kapalı ekstre değişmez", async () => {
    const detail = await get(admin, id.customer);
    assert.match(detail.subtitle, /^Cari No \d+ · 01\.01\.2026 – 31\.12\.2026$/, `alt başlık: ${detail.subtitle}`);
    const out = await files(admin, id.customer);
    for (const gone of ["Fatura kalemleriyle", "B: borçlu", "A: alacaklı"]) assert.ok(!out.pdf.includes(gone), `PDF'te "${gone}" olmamalı`);
    const preamble = out.sheet.slice(0, out.headerAt).flat().map(String).join(" | ");
    assert.ok(!/Fatura kalemleriyle|B: borçlu/.test(preamble), `Excel üst bilgisi: ${preamble}`);
    assert.ok(preamble.includes(detail.subtitle), `Excel'de Cari No + aralık: ${preamble}`);
    const plain = await must("düz", admin.get(`/api/workspace/report-center/cari-ekstre?account=${id.customer}&${RANGE}`));
    assert.ok(plain.subtitle.endsWith("B: borçlu · A: alacaklı"), `düz ekstre alt başlığı değişmez: ${plain.subtitle}`);
  });

  test("5 İşlem ve Açıklama tür kısa adıyla; Müşteri Fişi (FIS) dahil hiçbir hücrede 'Faturası' yok; kayıtta saklı metin değişmez", async () => {
    assert.match(id.saleNo, /^FIS\d+$/, "satış Müşteri Fişi (FIS serisi; fatura kesilmedi)");
    const customer = await get(admin, id.customer);
    const supplier = await get(admin, id.supplier);
    const ops = data => data.rows.filter((_, index) => data.rowMarks[index] === "invoice").map(row => row[col(data, "İşlem")]);
    assert.deepEqual(ops(customer), ["Satış", "Satıştan İade"], "müşterinin fatura satırları");
    assert.deepEqual(ops(supplier), ["Alış", "Alıştan İade"], "tedarikçinin fatura satırları");
    const at = col(customer, LABEL);
    const notes = customer.rows.map(row => row[at]);
    assert.ok(notes.includes(`Satış ${id.saleNo}`), `açıklama "Satış ${id.saleNo}": ${notes.join(" | ")}`);
    assert.ok(notes.includes(`Satış ${id.saleNo} · peşin tahsilat`), `peşin tahsilat açıklaması: ${notes.join(" | ")}`);
    for (const [data, name] of [[customer, "müşteri"], [supplier, "tedarikçi"]]) {
      const cells = data.rows.flat().concat(data.footers.flat()).join(" | ");
      assert.ok(!/Faturası/.test(cells), `${name} ekranı: "Faturası" geçmemeli — ${cells.match(/[^|]*Faturası[^|]*/)?.[0]}`);
      const out = await files(admin, name === "müşteri" ? id.customer : id.supplier);
      assert.ok(!/Faturası/.test(out.pdf), `${name} PDF'i: "Faturası" geçmemeli — ${out.pdf.split("\n").find(line => /Faturası/.test(line))}`);
      assert.ok(!out.sheet.flat().some(cell => /Faturası/.test(String(cell))), `${name} Excel'i: "Faturası" geçmemeli`);
    }
    // Saklanan veri değişmez: defter satırının açıklaması kayıtta tam tür adıyla; seçenek kapalı ekstre de onu yazar.
    const stored = server.app.store.get("SELECT note FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'debt'", id.sale);
    assert.equal(stored.note, `Satış Faturası ${id.saleNo}`);
    const plain = await must("düz", admin.get(`/api/workspace/report-center/cari-ekstre?account=${id.customer}&${RANGE}`));
    assert.ok(plain.rows.some(row => row[2] === `Satış Faturası ${id.saleNo}`), "seçenek kapalı ekstre bugünkü metinle");
  });

  test("6b Kalem Açıklaması: açıklamalı kalemde metin, açıklamasızda boş; stok kartı notu hiçbir çıktıda yok; uzun açıklama PDF'te sarılır", async () => {
    const data = await get(admin, id.customer);
    const at = col(data, "Kalem Açıklaması");
    assert.ok(at > col(data, LABEL), `Kalem Açıklaması kolonu, Ürün - Hizmet'ten sonra (${data.headers.join(", ")})`);
    const item = name => data.rows.find((row, index) => data.rowMarks[index] === "item" && row[col(data, LABEL)].startsWith(`› ${name}`));
    assert.equal(item("Köşe Kabin 90")[at], ACIKLAMA);
    assert.equal(item("Montaj")[at], "", "açıklamasız kalem boş");
    assert.ok(data.rows.every((row, index) => data.rowMarks[index] === "item" || row[at] === ""), "hareket satırında Kalem Açıklaması boş");
    const out = await files(admin, id.customer);
    // Hücrenin satırları PDF'te art arda yazılır: boşluklar atılınca açıklamanın TAMAMI (kesilmeden, "…" yok) bulunur.
    assert.ok(out.pdf.replace(/\s+/g, "").includes(ACIKLAMA.replace(/\s+/g, "")), "PDF'te kalem açıklamasının tamamı (sarılmış, kesilmemiş)");
    assert.ok(out.xheaders.includes("Kalem Açıklaması") && out.body.some(row => row[out.xheaders.indexOf("Kalem Açıklaması")] === ACIKLAMA), "Excel'de kalem açıklaması");
    const everything = [data.rows.flat().join(" "), out.pdf, out.sheet.flat().join(" ")].join(" ");
    assert.ok(!everything.includes("STOKNOTU247"), "stok kartının notu gelmez");
    // Uzun açıklama sarılır, tutar ve TOPLAM bölünmez: Genel Toplam'ın tutarları PDF'te tek parça.
    const grand = data.footers[1];
    for (const name of ["Borç", "Alacak"]) assert.ok(out.pdf.split("\n").includes(grand[col(data, name)]), `PDF'te Genel Toplam ${name} tek parça (${grand[col(data, name)]})`);
    const lines = out.pdf.split("\n").filter(line => /KALEMNOTU247|Banyo kapısı|temperli/.test(line));
    assert.ok(lines.length >= 2, `açıklama PDF'te birden çok satıra sarılır (${lines.length})`);
  });

  test("6b dönemde açıklamalı kalem yoksa kolon çıkmaz (ekran = PDF = Excel); Sütunlar listesinde kalır", async () => {
    const data = await get(admin, id.single);
    assert.equal(col(data, "Kalem Açıklaması"), -1, "boş kolon yok");
    assert.equal(data.headers.length, 15);
    assert.deepEqual(data.columns.empty, ["Kalem Açıklaması"]);
    assert.ok(data.columns.all.includes("Kalem Açıklaması") && !data.columns.hidden.includes("Kalem Açıklaması"), "kişinin seçimi değil, yalnız boş");
    const out = await files(admin, id.single);
    assert.deepEqual(out.xheaders, data.headers, "Excel başlıkları = ekran");
  });

  test("6a Sütunlar: gizlenen kolon ekranda, PDF'te ve Excel'de yok; TOPLAM = satırlar; Ürün - Hizmet gizlenince TOPLAM adı ilk boş kolonda", async () => {
    const before = await get(admin, id.customer);
    assertTotals(before, "hepsi açık");
    assert.deepEqual(before.columns.hidden, []);
    const saved = await must("gizle", setColumns(admin, ["Yol", "Kalem Açıklaması", "Borç"]));
    assert.deepEqual(saved.hidden, ["Yol", "Kalem Açıklaması", "Borç"]);
    const data = await get(admin, id.customer);
    for (const gone of ["Yol", "Kalem Açıklaması", "Borç"]) assert.equal(col(data, gone), -1, `ekranda ${gone} yok`);
    assert.equal(data.headers.length, 13);
    assert.deepEqual(data.columns.hidden, ["Yol", "Kalem Açıklaması", "Borç"]);
    assertTotals(data, "üç kolon gizli");
    // Kalan kolonların değerleri gizlemeden öncekiyle aynı (yalnız seçilir).
    for (const name of ["Alacak", "Bakiye", "Toplam"]) assert.deepEqual(data.rows.map(row => row[col(data, name)]), before.rows.map(row => row[col(before, name)]), `${name} değerleri aynı`);
    const out = await files(admin, id.customer);
    assert.deepEqual(out.xheaders, data.headers, "Excel başlıkları = ekran");
    assert.equal(out.body.length, data.rows.length + data.footers.length, "Excel satırı = ekran + 2 TOPLAM");
    assert.ok(!out.pdf.includes("KALEMNOTU247") && !out.sheet.flat().some(cell => String(cell).includes("KALEMNOTU247")), "gizli Kalem Açıklaması PDF / Excel'de yok");
    assert.ok(!out.pdf.split("\n").includes("Nakit"), "gizli Yol (Nakit) PDF'te yok");
    assert.ok(!out.pdf.split("\n").includes("Yol") && !out.pdf.split("\n").includes("Borç"), "PDF başlığında Yol / Borç yok");
    // Açıklama / Ürün - Hizmet de gizlenince TOPLAM satırlarının adı ilk boş metin kolonuna (Tarih) yazılır.
    await must("ad kolonu gizle", setColumns(admin, [LABEL]));
    const named = await get(admin, id.customer);
    assert.equal(col(named, LABEL), -1);
    assert.equal(named.footers[0][col(named, "Tarih")], "DÖNEM TOPLAMI");
    assert.equal(named.footers[1][col(named, "Tarih")], "GENEL TOPLAM");
    assertTotals(named, "Ürün - Hizmet gizli");
    const namedOut = await files(admin, id.customer);
    // Dar Tarih kolonunda ad iki satıra sarılabilir ("GENEL" / "TOPLAM").
    assert.ok(namedOut.pdf.replace(/\s+/g, " ").includes("DÖNEM TOPLAMI") && namedOut.pdf.replace(/\s+/g, " ").includes("GENEL TOPLAM"), "PDF'te TOPLAM adı");
    assert.ok(namedOut.body.some(row => row[0] === "GENEL TOPLAM"), `Excel'de TOPLAM adı: ${JSON.stringify(namedOut.body.slice(-2))}`);
    await must("geri aç", setColumns(admin, []));
    assert.equal((await get(admin, id.customer)).headers.length, 16, "hepsi yeniden açık");
  });

  test("6a en az bir kolon kalır; bilinmeyen kolon ve liste olmayan gövde reddedilir; seçim değişmez", async () => {
    await must("bir kolon", setColumns(admin, ["Tarih"]));
    const all = (await get(admin, id.customer)).columns.all;
    const empty = await setColumns(admin, all);
    assert.equal(empty.status, 400, `hepsi gizli: ${empty.status}`);
    assert.match(JSON.stringify(empty.data), /En az bir sütun/);
    const unknown = await setColumns(admin, ["Tarih", "Yok Böyle Kolon"]);
    assert.equal(unknown.status, 400);
    const bad = await admin.put("/api/workspace/report-center/cari-ekstre/columns", { hidden: "Tarih" });
    assert.equal(bad.status, 400);
    assert.deepEqual((await get(admin, id.customer)).columns.hidden, ["Tarih"], "reddedilen istek seçimi değiştirmez");
    // Tek görünen kolon bırakılabilir (Bakiye): TOPLAM satırında yalnız bakiye.
    await must("yalnız bakiye", setColumns(admin, all.filter(name => name !== "Bakiye")));
    const only = await get(admin, id.customer);
    assert.deepEqual(only.headers, ["Bakiye"]);
    assert.equal(only.footers[1][0], only.rows.filter((_, index) => only.rowMarks[index] !== "item").at(-1)[0]);
    const out = await files(admin, id.customer);
    assert.deepEqual(out.xheaders, ["Bakiye"]);
    await must("geri aç", setColumns(admin, []));
  });

  test("6a seçim kişi başına: yeni oturumda ve sunucu yeniden açılınca aynı kullanıcıda kalır, başka kullanıcıda yok; 002 şirketinde de aynı", async () => {
    await must("gizle", setColumns(admin, ["İsk. %", "KDV %"]));
    const other = server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    assert.deepEqual((await get(other, id.customer)).columns.hidden, ["İsk. %", "KDV %"], "aynı kullanıcı, yeni oturum");
    const theirs = await get(muhasebe, id.customer);
    assert.deepEqual(theirs.columns.hidden, [], "başka kullanıcı etkilenmez");
    assert.ok(col(theirs, "İsk. %") >= 0 && col(theirs, "KDV %") >= 0);
    await must("muhasebe kendi seçimi", setColumns(muhasebe, ["Belge No"]));
    assert.deepEqual((await get(admin, id.customer)).columns.hidden, ["İsk. %", "KDV %"], "muhasebenin seçimi yöneticiyi değiştirmez");
    // 002: aynı kişi aynı seçimi görür (tercih ortak katmanda); 002'den değiştirilen seçim 001'de de geçerli.
    const second = await must("002", admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const account = await must("002 cari", admin.post(`/api/workspace/accounts?${q}`, { name: "Cam Kabin Müşterisi", type: "customer", registeredOn: "2026-01-01" }));
    await must("002 fatura", admin.post(`/api/workspace/invoices?${q}`, { kind: "sale", scenario: "service_sale", accountId: account.id, issueDate: "2026-11-20", lines: [{ name: "İkinci Şirket Kalemi", qty: 1, unitPrice: 50, vatRate: 20, description: "002 açıklaması" }], payment: { rest: "open" } }));
    const in002 = await get(admin, account.id, `&${q}`);
    assert.deepEqual(in002.columns.hidden, ["İsk. %", "KDV %"], "002'de aynı seçim");
    assert.equal(col(in002, "İsk. %"), -1);
    assert.equal(in002.rows.find((_, index) => in002.rowMarks[index] === "item")[col(in002, "Kalem Açıklaması")], "002 açıklaması", "002'nin kalem açıklaması");
    assertTotals(in002, "002");
    await must("002'den değiştir", setColumns(admin, ["Yol"], `?${q}`));
    assert.deepEqual((await get(admin, id.customer)).columns.hidden, ["Yol"], "002'de yapılan seçim 001'de");
    // Sunucu yeniden açılır (aynı veri klasörü): seçim kalır.
    await server.app.close();
    const reopened = await startTestServer({ now: NOW, env: LICENSE, startLicenseTimers: false, legacyCasePayments: false, legacyTableTransfer: false, dataDir: server.dataDir, backupDir: server.backupDir });
    try {
      const again = await loginAdmin(reopened);
      assert.deepEqual((await get(again, id.customer)).columns.hidden, ["Yol"], "yeniden açılışta aynı");
      const mu = reopened.client();
      assert.equal((await mu.login("muhasebe247", "Personel-2026!")).status, 200);
      assert.deepEqual((await get(mu, id.customer)).columns.hidden, ["Belge No"], "muhasebenin kendi seçimi de kalır");
      await must("geri aç", setColumns(again, []));
    } finally {
      await reopened.app.close();
      removeTestDir(reopened.root);
    }
    server = { close: async () => removeTestDir(server.root), root: server.root };
  });
});

describe("2.4.7 Ayrıntılı Cari Ekstre — boş dönem, yetki, saf kolon seçimi", () => {
  let server;
  let admin;
  let accountId;
  before(async () => {
    server = await startTestServer({ now: NOW, env: LICENSE, startLicenseTimers: false, legacyCasePayments: false, legacyTableTransfer: false });
    admin = await loginAdmin(server);
    accountId = (await must("cari", admin.post("/api/workspace/accounts", { name: "Hareketsiz Cari", type: "customer", registeredOn: "2026-01-01" }))).id;
  });
  after(async () => server?.close());

  test("boş dönem: yalnız Devir satırı, TOPLAM sıfır, alt başlık Cari No + aralık, gizli kolon uygulanır", async () => {
    await must("gizle", admin.put("/api/workspace/report-center/cari-ekstre/columns", { hidden: ["Belge No"] }));
    const data = await must("boş", admin.get(`/api/workspace/report-center/cari-ekstre?account=${accountId}&${RANGE}&items=1`));
    assert.equal(data.rows.length, 1);
    assert.equal(data.rows[0][data.headers.indexOf("İşlem")], "Devir");
    assert.equal(data.headers.indexOf("Belge No"), -1);
    assert.equal(data.headers.indexOf("Kalem Açıklaması"), -1, "açıklamalı kalem yok → kolon yok");
    assert.match(data.subtitle, /^Cari No \d+ · 01\.01\.2026 – 31\.12\.2026$/);
    assert.equal(data.footers[1][data.headers.indexOf("Borç")], "0,00 TL");
    const pdf = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?account=${accountId}&${RANGE}&items=1`);
    assert.equal(pdf.status, 200);
  });

  test("yetkisiz (Finans Raporları yok): rapor ve Sütunlar ucu 403, seçim yazılmaz", async () => {
    const staff = await createUser(server, admin, { username: "personel247", role: "personel" });
    const view = await staff.get(`/api/workspace/report-center/cari-ekstre?account=${accountId}&${RANGE}&items=1`);
    assert.equal(view.status, 403);
    const put = await staff.put("/api/workspace/report-center/cari-ekstre/columns", { hidden: ["Tarih"] });
    assert.equal(put.status, 403);
    const anon = await server.client().put("/api/workspace/report-center/cari-ekstre/columns", { hidden: ["Tarih"] });
    assert.equal(anon.status, 401);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'auth.prefs.%' AND value LIKE '%Tarih%'").n, 0, "yetkisiz istek seçim yazmadı");
  });

  test("projectColumns (saf): bilinmeyen ad yok sayılır, hepsi gizliyse model değişmez, değerler yalnız seçilir", async () => {
    const { projectColumns } = await detailLib();
    assert.equal(typeof projectColumns, "function", "statement-detail.mjs projectColumns yok");
    const model = { headers: ["Tarih", LABEL, "Borç"], types: ["", "", "money"], rows: [["01.01.2026", "Devir", ""], ["02.01.2026", "Satış FIS1", "10,00 TL"]], footers: [["", "GENEL TOPLAM", "10,00 TL"]] };
    assert.deepEqual(projectColumns(model, ["Yok"]).headers, model.headers);
    assert.deepEqual(projectColumns(model, ["Tarih", LABEL, "Borç"]).headers, model.headers, "hepsi gizli → değişmez");
    const out = projectColumns(model, [LABEL]);
    assert.deepEqual(out.headers, ["Tarih", "Borç"]);
    assert.deepEqual(out.footers, [["GENEL TOPLAM", "10,00 TL"]]);
    assert.deepEqual(out.rows, [["01.01.2026", ""], ["02.01.2026", "10,00 TL"]]);
    assert.deepEqual(model.footers, [["", "GENEL TOPLAM", "10,00 TL"]], "girdi değişmez");
    assert.deepEqual(projectColumns(model, ["Tarih", LABEL]).footers, [["10,00 TL"]], "yalnız tutar kolonu kalınca TOPLAM adsız");
  });
});
