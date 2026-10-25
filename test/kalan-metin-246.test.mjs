// 2.4.6 madde 7 + 8 — 2.4.5'ten kalan metin / görünüm bulguları (docs/2.4.5-IS-LISTESI.md EKRAN GEZİNTİSİ B3–B9, SONRAYA "TAHSİLAT ALINMADI", K-DB2).
// Para, bakiye ve defter DEĞİŞMEZ; bu testler yalnız ekrana / dosyaya giden metni ve biçimi denetler. Davranış ayrıca e2e'de (senaryo-ekstre-ayrinti-245
// 1b / 2 / 3c, senaryo-pil-karti-245 S4 / S10 / S10b, senaryo-raporlar A). Eski kodda (e77447a) her bölüm kırmızıdır; nedeni iletide.
//   B4  Ayrıntılı Ekstre PDF'inde Belge No ("FIS2026000000001") iki satıra bölünmez (aynı kolonda "Makbuz 1" gibi boşluklu değer olsa da).
//   B5  Ayrıntılı ve düz Cari Ekstre Excel'inde Bakiye SAYI: borçlu artı, alacaklı eksi; ekran ve PDF "… TL B / A" kalır.
//   B6  carinin vadeli borç kalemi (takvim / zil / Vade Takip) borç kaydının Açıklamasını taşır; etiket (label) değişmez.
//   B7  planlı banka işleminin etiketi yazım düzeninde ("Planlı Diğer Gider").
//   B8  Tablo Raporları'nda tablodaki kişi kolonu ve özeti "Kişi" (cari değil).
//   Kaynak: B3 sekme adı, B7 Vade Takip notu / pil kartı tutar adı, B8 sektör önerisi / tablo şeridi, B9 rozet, zil yön başlığı, K-DB2 not tarafı.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { reportXlsx } from "../server/lib/report-files.mjs";
import { must } from "./banka-210-ortak.mjs";
import { bootBank, openAcceptanceAccounts } from "./banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..");
const source = file => readFileSync(path.join(ROOT, file), "utf8");
const LICENSE = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };

describe("2.4.6 kalan metin — sunucu (B4, B5, B6, B7)", () => {
  let ctx;
  let api;
  const id = {};
  before(async () => {
    ctx = await bootBank({ env: LICENSE, legacyCasePayments: false, legacyTableTransfer: false });
    api = ctx.api;
    const { ziraat } = await openAcceptanceAccounts(api);
    id.bank = ziraat.id;
    id.customer = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Metin Müşteri", type: "customer", registeredOn: "2026-01-01" }))).id;
    // İki vadeli borç: aynı cari, aynı etiket — açıklamaları ayırır (B6).
    await must("borç 1", api.post(`/api/workspace/accounts/${id.customer}/entries`, { kind: "debt", amount: "1000", date: "2026-10-01", dueDate: "2026-10-09", note: "Ekim malzeme teslimi" }));
    await must("borç 2", api.post(`/api/workspace/accounts/${id.customer}/entries`, { kind: "debt", amount: "700", date: "2026-10-02", dueDate: "2026-10-10", note: "Montaj işçiliği" }));
    // Fatura (Belge No uzun ve boşluksuz) + makbuzlu nakit tahsilat (Belge No "Makbuz N", boşluklu) — B4.
    await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: id.customer, issueDate: "2026-10-03", lines: [{ name: "Montaj Hizmeti", qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { rest: "open" } }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${id.customer}/entries`, { kind: "in", amount: "500", method: "cash", date: "2026-10-05", note: "Elden" }));
    id.creditor = (await must("alacaklı", api.post("/api/workspace/accounts", { name: "Metin Alacaklı", type: "customer", registeredOn: "2026-01-01" }))).id;
    await must("alacak", api.post(`/api/workspace/accounts/${id.creditor}/entries`, { kind: "credit", amount: "250", date: "2026-10-04", note: "İskonto dekontu" }));
    // Planlı banka gideri (B7).
    await must("planlı gider", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: id.bank, amount: "1.200", plannedDate: "2026-10-10", description: "Ekim kirası" }));
  });
  after(() => ctx.server.close());

  const ekstre = (account, items, format = "") => `/api/workspace/report-center/cari-ekstre${format ? `/${format}` : ""}?account=${account}&from=2026-01-01&to=2026-12-31${items ? "&items=1" : ""}`;

  it("B4: Ayrıntılı Ekstre PDF'inde fatura numarası Belge No kolonunda bölünmez", async () => {
    const screen = await must("ekran", api.get(ekstre(id.customer, true)));
    const at = screen.headers.indexOf("Belge No");
    const numbers = screen.rows.map(row => row[at]).filter(value => /^[A-Z]{3}\d{13}$/.test(value));
    assert.equal(numbers.length, 1, `ekranda bir fatura numarası (${screen.rows.map(row => row[at]).join(" | ")})`);
    assert.ok(screen.rows.some(row => /^Makbuz \d+$/.test(row[at])), "aynı kolonda boşluklu makbuz numarası var (kolon sözcüklü sayılır)");
    const pdf = await api.raw("GET", ekstre(id.customer, true, "pdf"));
    assert.equal(pdf.status, 200);
    const parts = pdfText(pdf.buffer).split("\n").filter(line => /^[A-Z]{3}\d+$/.test(line));
    assert.ok(parts.includes(numbers[0]), `PDF'te Belge No tek parça yazılmalı: ${numbers[0]}; PDF'teki parçalar: ${parts.join(" | ") || "(yok)"}`);
    assert.deepEqual(parts.filter(line => line !== numbers[0]), [], `PDF'te bölünmüş Belge No parçası: ${parts.join(" | ")}`);
  });

  it("B5: Cari Ekstre Excel'inde (ayrıntılı ve düz) Bakiye sayı — borçlu artı, alacaklı eksi; ekran B / A metni kalır", async () => {
    for (const [account, label] of [[id.customer, "borçlu"], [id.creditor, "alacaklı"]]) {
      for (const items of [true, false]) {
        const screen = await must("ekran", api.get(ekstre(account, items)));
        const at = screen.headers.indexOf("Bakiye");
        assert.ok(screen.rows.some(row => / TL [BA]$/.test(row[at])), `${label}/${items ? "ayrıntılı" : "düz"}: ekranda "… TL B/A" kalır`);
        const file = await api.raw("GET", ekstre(account, items, "xlsx"));
        assert.equal(file.status, 200);
        const sheet = xlsxRows(file.buffer);
        const head = sheet.findIndex(row => row[0] === "Tarih" && row.includes("Bakiye"));
        const col = sheet[head].indexOf("Bakiye");
        const values = sheet.slice(head + 1).map(row => row[col]).filter(value => value !== "" && value !== undefined);
        assert.ok(values.length >= 2, `${label}: Excel'de bakiye hücresi var`);
        const text = values.filter(value => typeof value !== "number");
        assert.deepEqual(text, [], `${label}/${items ? "ayrıntılı" : "düz"}: Excel Bakiye kolonu metin olmamalı (toplanamaz): ${text.slice(0, 3).join(" | ")}`);
        const last = values[values.length - 1];
        const closing = screen.rows[screen.rows.length - 1][at];
        const expected = Number(closing.replace(/ TL [BA]$/, "").replace(/\./g, "").replace(",", ".")) * (/ A$/.test(closing) ? -1 : 1);
        assert.equal(Math.round(last * 100), Math.round(expected * 100), `${label}: son bakiye işaretli sayı (${last} ↔ ekran ${closing})`);
        assert.ok(sheet.some(row => String(row[0] || "").includes("Bakiye: artı borçlu, eksi alacaklı")), `${label}: Excel alt başlığı işaretin anlamını söyler`);
      }
    }
  });

  it("B5 (birim): yalnız tutar kolonunda ve tam \"<tutar> TL B|A\" biçiminde çevrilir; başka metin olduğu gibi", () => {
    const data = { title: "Deneme", subtitle: "Kapsam · B: borçlu · A: alacaklı", headers: ["Açıklama", "Bakiye"], types: ["", "money"], rows: [["10.000,00 TL B", "10.000,00 TL B"], ["x", "250,00 TL A"], ["y", "0,00 TL"], ["z", "1.500 TL + faiz"]], footers: [["GENEL TOPLAM", "9.750,00 TL B"]] };
    const rows = xlsxRows(reportXlsx(data, { now: new Date("2026-10-08T09:00:00Z") }));
    const body = rows.slice(rows.findIndex(row => row[0] === "Açıklama") + 1);
    assert.deepEqual(body.map(row => row[1]), [10000, -250, 0, "1.500 TL + faiz", 9750]);
    assert.equal(body[0][0], "10.000,00 TL B", "metin kolonundaki aynı yazı çevrilmez");
  });

  it("B6: carinin vadeli borç kalemi Açıklamayı taşır (takvim ve Vade Takip); etiket aynı", async () => {
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.source === "account" && item.accountId === id.customer);
    assert.equal(items.length, 2, `iki vadeli borç kalemi (${items.length})`);
    assert.deepEqual(items.map(item => item.label), ["Tahsil Edilecek Borç", "Tahsil Edilecek Borç"], "etiket değişmez");
    assert.deepEqual(items.map(item => item.note).sort(), ["Ekim malzeme teslimi", "Montaj işçiliği"], `kalemde borcun açıklaması: ${JSON.stringify(items.map(item => item.note))}`);
    const vade = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?from=2026-10-01&to=2026-12-31&sources=account"));
    const rows = vade.rows.filter(row => row.source === "account" && row.party === "Metin Müşteri");
    assert.equal(rows.length, 2);
    assert.ok(rows.some(row => String(row.detail).startsWith("Ekim malzeme teslimi")) && rows.some(row => String(row.detail).startsWith("Montaj işçiliği")), `Vade Takip açıklama: ${rows.map(row => row.detail).join(" | ")}`);
  });

  it("B7: planlı banka işleminin etiketi yazım düzeninde (Planlı Diğer Gider)", async () => {
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const plan = dues.items.find(item => item.source === "bank");
    assert.ok(plan, "planlı banka kalemi takvimde");
    assert.equal(plan.label, "Planlı Diğer Gider · Ekim kirası", `etiket: ${plan.label}`);
  });
});

describe("2.4.6 kalan metin — kaynak (B3, B7, B8, B9, zil yönü, K-DB2)", () => {
  it("B3: Raporlar'ın ilk sekmesi \"Cari Mizanı ve Ekstresi\" (Tüm Raporlar → Cari Ekstre ile iki ayrı \"Cari Ekstre\" yok)", () => {
    const text = source("client/assets/hof-overview.js");
    assert.ok(text.includes('["mizan", "Cari Mizanı ve Ekstresi",'), "mizan sekmesinin adı \"Cari Mizanı ve Ekstresi\" olmalı");
    assert.ok(!text.includes('["mizan", "Cari Ekstre",'), "eski ad \"Cari Ekstre\" kalmamalı");
  });
  it("B7: Vade Takip alt notu Cari (vadeli) ve Planlı Banka İşlemi'ni sayar; pil kartında ödeme kalemi \"Ödenecek\"", () => {
    assert.ok(source("client/assets/hof-overview.js").includes("Taksit, Fatura, Cari (vadeli), Çek / Senet, Planlı Banka İşlemi ve Kasa'dan."), "Vade Takip alt notu eksik kaynak sayıyor");
    const promises = source("client/assets/hof-promises.js");
    assert.ok(!promises.includes("<dt>Beklenen</dt>"), "pil kartında sabit \"Beklenen\" kalmamalı");
    assert.ok(promises.includes('item.direction === "out" ? "Ödenecek"'), "ödeme kaleminde tutar adı \"Ödenecek\" olmalı");
  });
  it("B8: sektör önerisi \"Tahsilat … araçları açık olur\" demez; tablo şeridi \"öncelikli doğru veri\" demez", () => {
    const insight = source("client/assets/hof-insight.js");
    assert.ok(!/modules\.tahsilat \? "Tahsilat"/.test(insight) && !insight.includes('join(" ve ")} araçları açık olur'), "sektör önerisinde Tahsilat aracı yazılmamalı (2.4.5 kapısı)");
    const index = source("client/index.html");
    const bundle = /<meta name="hof-app-bundle" content="\/assets\/(app-[0-9a-f]{10}\.js)">/.exec(index)?.[1];
    assert.ok(bundle && readdirSync(path.join(ROOT, "client", "assets")).includes(bundle), `paket: ${bundle}`);
    const app = source(`client/assets/${bundle}`);
    assert.ok(!app.includes("öncelikli doğru veri"), "tablo şeridi tablodaki kayıtları \"öncelikli doğru veri\" diye sunmamalı");
    assert.ok(app.includes(" içinde ödeme günü olan kayıtlar (tablodan okunur; muhasebe kaydı değildir). "), "yeni şerit metni pakette");
  });
  it("B8: Tablo Raporları'nda kişi kolonu \"Kişi\"", () => {
    const reports = source("server/lib/reports.mjs");
    assert.ok(!reports.includes('{ key: "cari", label: "Cari" }'), "Tablo Raporları kolonu \"Cari\" olmamalı (tablodaki kişiler cari değil)");
    assert.equal((reports.match(/\{ key: "cari", label: "Kişi" \}/g) || []).length, 2);
  });
  it("B9 + zil yönü: rozet zil listesinin tamamını sayar; ödeme kalemi \"ÖDEME YAPILMADI\" / \"… ÖDEME VAR\", grupları ayrı", () => {
    const alerts = source("client/assets/hof-alerts.js");
    assert.ok(!alerts.includes('const count = list.filter(item => item.type !== "upcoming").length;'), "rozet yaklaşan kalemleri dışarıda bırakmamalı");
    assert.ok(alerts.includes('const head = paying ? "ÖDEME YAPILMADI" : "TAHSİLAT ALINMADI";'), "ödeme kaleminin başlığı yöne göre olmalı");
    assert.ok(alerts.includes('["Ödeme yapılmadı",') && alerts.includes('["Yaklaşan ödemeler (7 gün)",'), "zilde ödeme grupları ayrı olmalı");
  });
  it("K-DB2: tahsilat / ödeme formundaki bilgi notu cari TÜRÜNE değil açık bakiyenin TARAFINA bakar", () => {
    const accounts = source("client/assets/hof-accounts.js");
    assert.ok(!accounts.includes('const fifoSide = type === "in" ? account.type !== "supplier" : account.type !== "customer";'), "not cari türüne bakmamalı");
    assert.ok(accounts.includes('const fifoSide = type === "in" ? openBalance > 0.005 : openBalance < -0.005;'), "not bakiyenin tarafına bakmalı");
  });
});
