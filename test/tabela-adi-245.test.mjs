// 2.4.5 madde 6c (müşteri isteği M1): Firma Bilgisi'nde Tabela Adı + Rapor ve Ekstre Başlığı (Yalnız Tabela Adı / Tabela Adı ve Firma Bilgileri).
// Beklenen (kâhin): müşterinin isteği ve iş listesi madde 6c metni — "boş tabela adında bugünkü başlık", "fatura / e-Belge / makbuz unvanı değişmez",
// "iki şirkette ayrı ayar", "firma bilgisini düzenleyebilen kişi". Sayı yok; başlık metinleri PDF'ten (metin çıkarılarak) ve Excel'den okunur.
// Nasıl bozulur listesi: not defteri 245-tabela/NASIL-BOZULUR.md (boş ad geri uyumu, yasal belge unvanı, 002 sızıntısı, yetkisiz kullanıcı, yeniden
// açınca boş, kısmi PUT siler, geçersiz seçim, eksik firma bilgisi).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readZip } from "../server/lib/zip.mjs";
import { pdfText } from "./banka-210-ortak.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const xmlText = value => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// Excel'in sayfa satırları (ilk hücre metinleri yeter: başlık bloğu A sütununda).
function xlsxRows(buffer, sheet = 1) {
  const entries = readZip(buffer);
  const file = name => entries.find(entry => entry.name === name)?.data.toString("utf8") || "";
  const shared = [...file("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => xmlText([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  return [...file(`xl/worksheets/sheet${sheet}.xml`).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
    [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, body = ""]) => {
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      const v = /<v>([\s\S]*?)<\/v>/.exec(body);
      return t ? xmlText(t[1]) : !v ? "" : /t="s"/.test(attrs) ? shared[Number(v[1])] : v[1];
    }),
  );
}
const appProps = buffer => readZip(buffer).find(entry => entry.name === "docProps/app.xml")?.data.toString("utf8") || "";

const OFFICE = "Merkez Ofis";
const UNVAN = "Yıldız Gıda Ticaret Ltd. Şti.";
const SIGN = "Yıldız Market";
const SELLER = { name: UNVAN, taxNo: "4840847211", taxOffice: "Kadıköy", address: "Bağdat Cad. No 5", district: "Kadıköy", city: "İstanbul" };

describe("2.4.5 madde 6c: Tabela Adı ve Rapor ve Ekstre Başlığı", () => {
  let server;
  let admin;
  let account;
  let entryId;
  let invoiceId;
  let planId;
  const api = {
    get: async url => unwrap(await admin.get(url)),
    post: async (url, body) => unwrap(await admin.post(url, body)),
    put: async (url, body) => unwrap(await admin.put(url, body)),
  };
  const ok200 = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const raw = async (label, url) => {
    const res = await admin.raw("GET", url);
    assert.equal(res.status, 200, `${label}: ${res.status} ${res.buffer.toString("utf8").slice(0, 200)}`);
    return res.buffer;
  };
  const head = text => text.split("\n").slice(0, 12);
  const files = async () => ({
    cariPdf: pdfText(await raw("cari ekstre PDF", `/api/workspace/accounts/${account.id}/ekstre.pdf`)),
    finansPdf: pdfText(await raw("Finans ekstre PDF", `/api/workspace/overview/ekstre.pdf?account=${account.id}&from=${day(-60)}&to=${day(0)}`)),
    finansXlsx: await raw("Finans ekstre Excel", `/api/workspace/overview/ekstre.xlsx?account=${account.id}&from=${day(-60)}&to=${day(0)}`),
    merkezPdf: pdfText(await raw("Rapor Merkezi cari ekstre PDF", `/api/workspace/report-center/cari-ekstre/pdf?account=${account.id}&from=${day(-60)}&to=${day(0)}`)),
    merkezXlsx: await raw("Rapor Merkezi cari ekstre Excel", `/api/workspace/report-center/cari-ekstre/xlsx?account=${account.id}&from=${day(-60)}&to=${day(0)}`),
    kasaPdf: pdfText(await raw("Kasa PDF", `/api/workspace/cash.pdf?from=${day(-60)}&to=${day(0)}`)),
    taksitPdf: pdfText(await raw("taksit ekstresi PDF", `/api/workspace/plans/${planId}/ekstre.pdf`)),
    makbuzPdf: pdfText(await raw("cari makbuz PDF", `/api/workspace/accounts/${account.id}/entries/${entryId}/makbuz.pdf`)),
    faturaPdf: pdfText(await raw("fatura PDF", `/api/workspace/invoices/${invoiceId}/fatura.pdf`)),
  });

  before(async () => {
    server = await startTestServer({ legacyCasePayments: false, legacyTableTransfer: false }); // K1.2: 2.4.5 davranışı (aday 1)
    admin = await loginAdmin(server);
    await ok200("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
    await ok200("şirket adı", api.put("/api/admin/office", { name: OFFICE }));
    await ok200("firma bilgisi", api.put("/api/workspace/invoices/settings", { seller: SELLER }));
    account = await ok200("cari", api.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", registeredOn: day(-40) }));
    await ok200("borç", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: "1500", date: day(-10), method: "cash" }));
    const paid = await ok200("tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "400", date: day(-5), method: "cash" }));
    entryId = (paid.entries || []).find(item => item.kind === "in")?.id;
    assert.ok(entryId, "tahsilat satırı");
    const doc = await ok200("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: account.id, issueDate: day(-3), pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    invoiceId = doc.id;
    const plan = await ok200("taksit kartı", api.post("/api/workspace/plans", { accountId: account.id, name: "Ayşe Demir", total: "600", mode: "auto", count: 3, firstDue: day(5), registeredOn: day(-2) }));
    planId = plan.id;
  });
  after(async () => server?.close());

  test("Tabela Adı boşken başlık bugünkü gibi: PDF'te unvan, Finans Excel'inde ön satır yok, Rapor Merkezi'nde \"001 · Unvan\"", async () => {
    // Bu test ESKİ kodda da yeşildir (bilerek): beklenen başlıklar v2.4.4'ün gerçek çıktısıdır (geri uyum kâhini, KANIT KURALI 2 "eski sürümün gerçek kodu").
    const f = await files();
    assert.equal(head(f.cariPdf)[0], OFFICE, `cari ekstre ilk satır: ${head(f.cariPdf).join(" | ")}`);
    assert.equal(head(f.finansPdf)[0], OFFICE);
    assert.equal(head(f.kasaPdf)[0], OFFICE);
    assert.equal(head(f.taksitPdf)[0], OFFICE);
    assert.match(head(f.merkezPdf)[0], new RegExp(`^(\\d{3} · )?${OFFICE}$`));
    assert.equal(xlsxRows(f.finansXlsx)[0][0], "Tarih", "Finans ekstre Excel'i bugünkü gibi kolon başlığıyla başlar");
    const merkez = xlsxRows(f.merkezXlsx);
    assert.match(merkez[0][0], new RegExp(`^(\\d{3} · )?${OFFICE}$`));
    assert.equal(merkez[1][0], `Cari Ekstre · ${account.name}`);
    for (const text of Object.values(f).filter(value => typeof value === "string")) assert.doesNotMatch(text, new RegExp(SIGN));
  });

  test("Yalnız Tabela Adı: bütün rapor / ekstre PDF + Excel başlığı Tabela Adı; unvan başlıkta yok; kaydedilip yeniden okununca dolu", async () => {
    const settings = await ok200("ayarlar", api.get("/api/workspace/invoices/settings"));
    assert.deepEqual(settings.reportHeader, { signName: "", mode: "sign" }, "kayıtlı ayar yok: boş + Yalnız Tabela Adı");
    const saved = await ok200("kaydet", api.put("/api/workspace/invoices/settings", { reportHeader: { signName: `  ${SIGN} `, mode: "sign" } }));
    assert.deepEqual(saved.reportHeader, { signName: SIGN, mode: "sign" });
    assert.deepEqual((await ok200("yeniden aç", api.get("/api/workspace/invoices/settings"))).reportHeader, { signName: SIGN, mode: "sign" });
    const f = await files();
    for (const [name, text] of Object.entries({ cari: f.cariPdf, finans: f.finansPdf, merkez: f.merkezPdf, kasa: f.kasaPdf, taksit: f.taksitPdf })) {
      assert.equal(head(text)[0], SIGN, `${name} PDF ilk satır: ${head(text).join(" | ")}`);
      assert.ok(!head(text).includes(UNVAN), `${name} PDF başlığında unvan yok`);
      assert.ok(!head(text).some(line => line.includes(OFFICE)), `${name} PDF başlığında şirket adı yok`);
    }
    const finans = xlsxRows(f.finansXlsx);
    assert.deepEqual(finans.slice(0, 2).map(row => row[0]), [SIGN, `Cari Ekstre · ${account.name}`]);
    assert.equal(finans[2][0], "Tarih", "boş satırdan sonra kolon başlıkları (boş satır dosyaya yazılmaz)");
    const merkez = xlsxRows(f.merkezXlsx);
    assert.deepEqual(merkez.slice(0, 2).map(row => row[0]), [SIGN, `Cari Ekstre · ${account.name}`]);
    assert.match(appProps(f.merkezXlsx), new RegExp(`<Company>${SIGN}</Company>`));
  });

  test("Tabela Adı ve Firma Bilgileri: Tabela Adı + unvan + VKN · Vergi Dairesi + adres; Özet sayfasında da", async () => {
    await ok200("kaydet", api.put("/api/workspace/invoices/settings", { reportHeader: { signName: SIGN, mode: "full" } }));
    const want = [SIGN, UNVAN, "VKN: 4840847211 · Vergi Dairesi: Kadıköy", "Bağdat Cad. No 5 Kadıköy / İstanbul"];
    const f = await files();
    for (const [name, text] of Object.entries({ cari: f.cariPdf, finans: f.finansPdf, merkez: f.merkezPdf, kasa: f.kasaPdf, taksit: f.taksitPdf })) assert.deepEqual(head(text).slice(0, 4), want, `${name} PDF başlığı: ${head(text).join(" | ")}`);
    assert.deepEqual(xlsxRows(f.finansXlsx).slice(0, 5).map(row => row[0]), [...want, `Cari Ekstre · ${account.name}`]);
    assert.deepEqual(xlsxRows(f.merkezXlsx).slice(0, 5).map(row => row[0]), [...want, `Cari Ekstre · ${account.name}`]);
    // Rapor Merkezi Excel'inin özet sayfası (Kalem / Değer): şirket satırı yerine Tabela Adı ve firma satırları.
    const summary = xlsxRows(f.merkezXlsx, 2);
    assert.deepEqual(summary.slice(1, 5), [["Tabela Adı", SIGN], ["Firma", UNVAN], ["Firma", want[2]], ["Firma", want[3]]]);
  });

  test("YASAL BELGE DEĞİŞMEZ: fatura PDF'i ve makbuz tabela açıkken de unvanla; Tabela Adı basılmaz", async () => {
    await ok200("kaydet", api.put("/api/workspace/invoices/settings", { reportHeader: { signName: SIGN, mode: "full" } }));
    const f = await files();
    assert.equal(head(f.cariPdf)[0], SIGN, "ön koşul: tabela açık (rapor başlığında görünüyor)");
    assert.match(f.faturaPdf, new RegExp(UNVAN.replace(/\./g, "\\.")), "faturada satıcı unvanı");
    assert.doesNotMatch(f.faturaPdf, new RegExp(SIGN), "faturada Tabela Adı yok");
    assert.doesNotMatch(f.makbuzPdf, new RegExp(SIGN), "makbuzda Tabela Adı yok");
    assert.match(f.makbuzPdf, new RegExp(OFFICE), "makbuz bugünkü gibi şirket adıyla");
  });

  test("kısmi kayıt (reportHeader yok) ayarı silmez; geçersiz seçim ve uzun ad 400 (ayar değişmez); yetkisiz kişi 403", async () => {
    await ok200("Entegratör Ayarları gibi kısmi kayıt", api.put("/api/workspace/invoices/settings", { defaults: { dueDays: 15 } }));
    assert.deepEqual((await ok200("oku", api.get("/api/workspace/invoices/settings"))).reportHeader, { signName: SIGN, mode: "full" });
    const bad = await api.put("/api/workspace/invoices/settings", { reportHeader: { signName: SIGN, mode: "logo" } });
    assert.equal(bad.status, 400, JSON.stringify(bad.data));
    const long = await api.put("/api/workspace/invoices/settings", { reportHeader: { signName: "A".repeat(121) } });
    assert.equal(long.status, 400, JSON.stringify(long.data));
    const staff = await createUser(server, admin, { username: "tabela-personel", role: "personel" });
    const denied = await staff.put("/api/workspace/invoices/settings", { reportHeader: { signName: "Başka Tabela", mode: "sign" } });
    assert.equal(denied.status, 403, JSON.stringify(denied.data));
    assert.deepEqual((await ok200("oku", api.get("/api/workspace/invoices/settings"))).reportHeader, { signName: SIGN, mode: "full" }, "reddedilen istekler ayarı değiştirmedi");
  });

  test("iki şirket ayrı ayar: 002'nin Tabela Adı 001'in raporuna sızmaz; boşaltınca 001 bugünkü başlığa döner", async () => {
    const second = await ok200("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    assert.deepEqual((await ok200("002 ayarı", api.get(`/api/workspace/invoices/settings?${q}`))).reportHeader, { signName: "", mode: "sign" }, "yeni şirket ayarı boş başlar");
    await ok200("002 kaydet", api.put(`/api/workspace/invoices/settings?${q}`, { reportHeader: { signName: "İkinci Tabela", mode: "sign" } }));
    const other = await ok200("002 cari", api.post(`/api/workspace/accounts?${q}`, { name: "Mehmet Kaya", type: "customer" }));
    const pdf002 = pdfText(await raw("002 ekstre", `/api/workspace/accounts/${other.id}/ekstre.pdf?${q}`));
    assert.equal(head(pdf002)[0], "İkinci Tabela");
    assert.deepEqual((await ok200("001 ayarı", api.get("/api/workspace/invoices/settings"))).reportHeader, { signName: SIGN, mode: "full" });
    await ok200("001 boşalt", api.put("/api/workspace/invoices/settings", { reportHeader: { signName: "" } }));
    const f = await files();
    assert.equal(head(f.cariPdf)[0], OFFICE, "Tabela Adı silinince bugünkü başlık");
    assert.equal(xlsxRows(f.finansXlsx)[0][0], "Tarih");
    assert.doesNotMatch(f.cariPdf, /İkinci Tabela/);
  });
});
