// Wolvox karşılaştırmasının kalan dört maddesi (kullanıcı kararı 16.10.2026: "isteğe bağlı olarak olsun") — bu dosya e-Belge XML'ine giren
// üçünü denetler: cari bakiyesi notu, ödeme şekli kodu, kalemde Seri No / Lot No (portala taslak: test/einvoice-240-taslak.test.mjs).
// Faturalar programın GERÇEK API'sinden kaydedilir; beklenen sayılar ELLE hesaplanmıştır (kodu okumadan; satır: miktar × fiyat + KDV), XML
// programdan bağımsız kâhinlere (OASIS UBL 2.1 XSD + GİB UBL-TR şematronu, kod listesi PaymentMeansCodeTypeList) karşı denetlenir; görünüm
// şablonu SaxonJS ile çizilir (renderView).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { renderView, validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

function vkn(nine) {
  const digits = String(nine).padStart(9, "0").split("").map(Number);
  let sum = 0;
  digits.forEach((digit, index) => {
    const tmp = (digit + (9 - index)) % 10;
    let value = (tmp * 2 ** (9 - index)) % 9;
    if (tmp !== 0 && value === 0) value = 9;
    sum += value;
  });
  return `${digits.join("")}${(10 - (sum % 10)) % 10}`;
}
const IBAN = "TR330006100519786457841326";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const describeErrors = result => [...result.xsd.map(error => `XSD: ${error}`), ...result.schematron.map(error => `GİB: ${error.text} [${error.location}]`)].join("\n");
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;| /g, " ").replace(/\s+/g, " ");
const notes = xml => [...xml.replace(/<cac:InvoiceLine>[\s\S]*$/, "").matchAll(/<cbc:Note>([^<]*)<\/cbc:Note>/g)].map(match => match[1]);
const means = xml => [...xml.matchAll(/<cac:PaymentMeans>([\s\S]*?)<\/cac:PaymentMeans>/g)].map(match => ({ code: match[1].match(/<cbc:PaymentMeansCode>([^<]*)</)?.[1], due: match[1].match(/<cbc:PaymentDueDate>([^<]*)</)?.[1] || "", iban: match[1].match(/<cac:PayeeFinancialAccount><cbc:ID>([^<]*)</)?.[1] || "" }));

let server;
let api;
let today;
const ids = {};
async function issue(body) {
  const response = await api.post("/api/workspace/invoices", body);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}
async function xmlOf(id) {
  const response = await api.get(`/api/workspace/invoices/${id}/ubl.xml`);
  assert.equal(response.status, 200, `ubl.xml ${response.status}`);
  return typeof response.data === "string" ? response.data : response.text;
}
async function options(eOptions, defaults) {
  const saved = await api.put("/api/workspace/invoices/settings", { ...(eOptions ? { eOptions } : {}), ...(defaults ? { defaults } : {}) });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  return saved.data;
}
const dmy = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

before(async () => {
  server = await startTestServer({ edocEnabled: true });
  const client = server.client();
  api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const saved = await api.put("/api/workspace/invoices/settings", {
    seller: { name: "Deneme Ofis Ltd. Şti.", taxNo: vkn(123456789), taxOffice: "Çankaya", address: "Atatürk Blv. No:1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr", banks: [{ name: "Örnek Bankası", iban: IBAN }] },
    efatura: true,
    earsiv: true,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  ids.defaults = { eOptions: saved.data.eOptions, itemTracking: saved.data.defaults.itemTracking };
  const account = async body => {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.id || response.data.account?.id;
  };
  ids.firm = await account({ name: "Bakiye Ticaret A.Ş.", type: "customer", taxNo: vkn(987654321), taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@bakiye.com.tr" });
  ids.payer = await account({ name: "Peşin Ticaret A.Ş.", type: "customer", taxNo: vkn(555666777), taxOffice: "Kavaklıdere", address: "Tunalı 5", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@pesin.com.tr" });
  ids.supplier = await account({ name: "Tedarik A.Ş.", type: "supplier", taxNo: vkn(111222333), taxOffice: "Ulus", address: "Ulus 1", district: "Altındağ", city: "Ankara" });
  today = (await api.get("/api/workspace/invoices/meta")).data?.today || new Date().toISOString().slice(0, 10);
});
after(async () => {
  await server?.close();
});

describe("Ek seçenekler: varsayılan kapalı, ayardan açılır", () => {
  test("yeni kurulumda dördü de kapalı; ayar kaydedilip geri okunur", async () => {
    assert.deepEqual(ids.defaults, { eOptions: { balanceNote: false, paymentMeans: false, draftUpload: false }, itemTracking: false });
    const saved = await options({ balanceNote: true, paymentMeans: true }, { itemTracking: true });
    assert.deepEqual(saved.eOptions, { balanceNote: true, paymentMeans: true, draftUpload: false });
    assert.equal(saved.defaults.itemTracking, true);
    const back = await options({ balanceNote: false, paymentMeans: false }, { itemTracking: false });
    assert.deepEqual(back.eOptions, { balanceNote: false, paymentMeans: false, draftUpload: false });
    assert.equal(back.defaults.itemTracking, false);
  });
});

describe("Cari bakiyesi faturanın notunda", () => {
  test("kapalıyken not yok; açıkken bu fatura dahil bakiye (2 × 500 + %20 = 1.200,00 TL borç); belge GİB'e uygun", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
    ids.firstSale = doc.id;
    assert.equal(notes(await xmlOf(doc.id)).filter(note => /bakiye/i.test(note)).length, 0, "kapalıyken bakiye notu yok");
    await options({ balanceNote: true });
    const xml = await xmlOf(doc.id);
    assert.ok(notes(xml).includes(`Cari hesap bakiyeniz (${dmy(today)} itibarıyla, bu fatura dahil): 1.200,00 TL borç`), notes(xml).join(" | "));
    assert.equal(describeErrors(await validateInvoice(xml)), "");
    assert.match(text(renderView(xml)), /Cari hesap bakiyeniz \(\d\d\.\d\d\.\d{4} itibarıyla, bu fatura dahil\): 1\.200,00 TL borç/, "görünümde not");
  });
  test("ikinci fatura (1 × 250 + %20 = 300) ve 2.000 TL tahsilattan sonra: 1.200 + 300 − 2.000 = 500,00 TL alacak", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Destek", qty: 1, unitPrice: 250, vatRate: 20 }], payment: { rest: "open" } });
    assert.ok(notes(await xmlOf(doc.id)).some(note => note.endsWith(": 1.500,00 TL borç")), "tahsilattan önce 1.500 borç");
    const paid = await api.post(`/api/workspace/accounts/${ids.firm}/entries`, { kind: "in", amount: "2000", date: today, note: "Havale" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const xml = await xmlOf(doc.id);
    assert.ok(notes(xml).some(note => note.endsWith(": 500,00 TL alacak")), notes(xml).join(" | "));
  });
  test("alış faturasının XML'ine (satıcı karşı taraf) bakiye notu girmez", async () => {
    const doc = await issue({ kind: "purchase", accountId: ids.supplier, number: "TDR-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(notes(await xmlOf(doc.id)).filter(note => /bakiye/i.test(note)).length, 0);
    await options({ balanceNote: false });
  });
});

describe("Ödeme şekli kodu (GİB kod listesi)", () => {
  test("kapalıyken eski davranış: IBAN'lı açık fatura tek PaymentMeans 42 + IBAN", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.payer, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" } });
    ids.cashSale = doc.id;
    assert.deepEqual(means(await xmlOf(doc.id)), [{ code: "42", due: doc.issueDate, iban: IBAN }]);
  });
  test("açıkken tamamı nakit: yalnız 10 (Nakit); belge GİB'e uygun; görünümde Ödeme Şekli: Nakit", async () => {
    await options({ paymentMeans: true });
    const xml = await xmlOf(ids.cashSale);
    assert.deepEqual(means(xml).map(item => item.code), ["10"]);
    assert.equal(describeErrors(await validateInvoice(xml)), "");
    assert.match(text(renderView(xml)), /Ödeme Şekli Nakit/);
  });
  test("400 nakit + 500 kart + kalan 300 vadeli: 10, 48 ve açık kısım 42 (IBAN + son ödeme tarihi); görünümde vade peşinin tarihi değil", async () => {
    // Gerçek EDM denemesinde görüldü (16.10.2026): peşin satırlar belge tarihini taşıyınca görünüm "Son Ödeme Tarihi"ni ilk satırdan okuyordu.
    const due = new Date(Date.parse(`${today}T12:00:00Z`) + 31 * 86400000).toISOString().slice(0, 10);
    const doc = await issue({ scenario: "service_sale", accountId: ids.payer, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 400, method: "cash" }, { amount: 500, method: "card" }], rest: "open", dueDate: due } });
    const xml = await xmlOf(doc.id);
    const list = means(xml);
    assert.deepEqual(list, [{ code: "10", due: "", iban: "" }, { code: "48", due: "", iban: "" }, { code: "42", due, iban: IBAN }], JSON.stringify(list));
    assert.equal(describeErrors(await validateInvoice(xml)), "");
    const view = text(renderView(xml));
    assert.match(view, /Ödeme Şekli Nakit, Kredi Kartı, Havale \/ EFT/);
    assert.ok(view.includes(`Son Ödeme Tarihi ${dmy(due)}`), view.slice(0, 600));
  });
  test("havale peşin 42, çek 20, senet 60 (alınan evrak faturaya bağlı)", async () => {
    const bank = await issue({ scenario: "service_sale", accountId: ids.payer, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { cash: [{ amount: 120, method: "bank" }], rest: "open" } });
    assert.deepEqual(means(await xmlOf(bank.id)).map(item => item.code), ["42"]);
    const cheque = await issue({ scenario: "service_sale", accountId: ids.payer, lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, vatRate: 0, exemptionCode: "351" }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "500", dueDate: today, serialNo: "EK-1", bank: "Örnek Bankası" }], endorse: [], rest: "open" }, force: true });
    const note = await issue({ scenario: "service_sale", accountId: ids.payer, lines: [{ name: "Hizmet", qty: 1, unitPrice: 700, vatRate: 0, exemptionCode: "351" }], payment: { cash: [], cheques: [{ instrument: "note", amount: "700", dueDate: today, serialNo: "EK-S1", bank: "" }], endorse: [], rest: "open" }, force: true });
    const chequeXml = await xmlOf(cheque.id);
    assert.deepEqual(means(chequeXml).map(item => item.code), ["20"]);
    assert.deepEqual(means(await xmlOf(note.id)).map(item => item.code), ["60"]);
    assert.equal(describeErrors(await validateInvoice(chequeXml)), "");
  });
  test("peşinsiz açık fatura: açıkken de eski davranış (42 + IBAN)", async () => {
    assert.deepEqual(means(await xmlOf(ids.firstSale)).map(item => item.code), ["42"]);
    await options({ paymentMeans: false });
  });
});

describe("Kalemde Seri No / Lot No", () => {
  test("kayıt, ayrıntı, e-Belge (cac:ItemInstance), görünüm; GİB'e uygun", async () => {
    await options(null, { itemTracking: true });
    const doc = await issue({ scenario: "goods_sale", accountId: ids.firm, lines: [{ name: "Kombi", qty: 1, unitPrice: 20000, vatRate: 20, serialNo: "SN-12345", lotNo: "LOT-7" }, { name: "Montaj", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, force: true });
    ids.tracked = doc;
    assert.equal(doc.lines[0].serialNo, "SN-12345");
    assert.equal(doc.lines[0].lotNo, "LOT-7");
    assert.equal(doc.lines[1].serialNo, "");
    const xml = await xmlOf(doc.id);
    assert.match(xml, /<cac:Item><cbc:Name>Kombi<\/cbc:Name><cac:ItemInstance><cbc:SerialID>SN-12345<\/cbc:SerialID><cac:LotIdentification><cbc:LotNumberID>LOT-7<\/cbc:LotNumberID><\/cac:LotIdentification><\/cac:ItemInstance><\/cac:Item>/);
    assert.equal((xml.match(/<cac:ItemInstance>/g) || []).length, 1, "boş kalemde ItemInstance yok");
    assert.equal(describeErrors(await validateInvoice(xml)), "");
    assert.match(text(renderView(xml)), /Kombi Seri No: SN-12345 · Lot No: LOT-7/);
  });
  test("yalnız lot ya da yalnız seri: boş alan yazılmaz", async () => {
    const doc = await issue({ scenario: "goods_sale", accountId: ids.firm, lines: [{ name: "İlaç", qty: 1, unitPrice: 10, vatRate: 10, lotNo: "L-99" }, { name: "Cihaz", qty: 1, unitPrice: 10, vatRate: 20, serialNo: "S-1" }], payment: { rest: "open" }, force: true });
    const xml = await xmlOf(doc.id);
    assert.match(xml, /<cac:ItemInstance><cac:LotIdentification><cbc:LotNumberID>L-99<\/cbc:LotNumberID><\/cac:LotIdentification><\/cac:ItemInstance>/);
    assert.match(xml, /<cac:ItemInstance><cbc:SerialID>S-1<\/cbc:SerialID><\/cac:ItemInstance>/);
    assert.equal(describeErrors(await validateInvoice(xml)), "");
  });
  test("iade faturası asıl kalemin seri / lot numarasını taşır; düzenlemede değer korunur", async () => {
    const ret = await issue({ kind: "sale_return", originalId: ids.tracked.id, lines: [{ originLineId: ids.tracked.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true });
    assert.equal(ret.lines[0].serialNo, "SN-12345");
    assert.equal(ret.lines[0].lotNo, "LOT-7");
    const edited = await api.post(`/api/workspace/invoices/${ids.tracked.id}/edit`, { accountId: ids.firm, lines: [{ name: "Montaj", qty: 1, unitPrice: 600, vatRate: 20, serialNo: "M-1" }], payment: { rest: "open" }, force: true });
    // İadesi olan fatura düzenlenmez (mevcut kural) — bu yüzden seri numarası düzenleme yolu ayrı belgede denenir.
    assert.equal(edited.status, 409);
    const plain = await issue({ scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Bakım", qty: 1, unitPrice: 100, vatRate: 20, serialNo: "B-1" }], payment: { rest: "open" } });
    const changed = await api.post(`/api/workspace/invoices/${plain.id}/edit`, { accountId: ids.firm, lines: [{ name: "Bakım", qty: 1, unitPrice: 100, vatRate: 20, serialNo: "B-2", lotNo: "L-2" }], payment: { rest: "open" } });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.deepEqual([changed.data.lines[0].serialNo, changed.data.lines[0].lotNo], ["B-2", "L-2"]);
  });
  test("61 karakterlik seri numarası reddedilir (alan sınırı 60)", async () => {
    const response = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Bakım", qty: 1, unitPrice: 100, vatRate: 20, serialNo: "X".repeat(61) }], payment: { rest: "open" } });
    assert.equal(response.status, 400, JSON.stringify(response.data));
  });
});
