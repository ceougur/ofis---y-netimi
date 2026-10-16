// e-Belge karekodu (İz 9; GİB Karekod Standardı Kılavuzu V.1.2 — zorunlu, belgenin sağ üst köşesi) ve GİB logosu.
// Kâhinler programdan bağımsızdır:
//   - karekod ÇÖZÜCÜSÜ jsQR (geliştirme bağımlılığı; programın üreticisinden ayrı bir uygulama) — karekod okunuyor mu, okunan metin ne;
//   - beklenen JSON alanları ELLE hesaplanmış tutarlar + GİB kılavuzundaki örneğin alan sırası; XML alanları testte ayrıca düzenli ifadeyle okunur;
//   - ISO sürüm aralığı: kısa ve uzun içerik (sürüm 1–31), Türkçe karakterler (UTF-8).
// "Nasıl bozulur?": karekod XML'deki tutardan farklı (ayrı hesap); birden çok KDV oranı eksik; alıcı TCKN yerine MERSİS; e-Arşiv belge e-Fatura
// kanalından gider (16.10.2026 gerçek EDM: SEND-FAILED); uzun içerikte büyük sürümün blok tablosu yanlış; şablon kapatılınca karekod yok.
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { after, before, describe, test } from "node:test";
import jsQR from "jsqr";
import { encodeQr } from "../server/lib/qr.mjs";
import { karekodData } from "../server/lib/einvoice/karekod.mjs";
import { createEdmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { renderView, validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
// Modül matrisini piksele çevirip bağımsız çözücüyle okur.
function decodeModules({ size, modules }) {
  const scale = 4;
  const quiet = 4;
  const full = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(full * full * 4).fill(255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = (((y + quiet) * scale + dy) * full + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, full, full)?.data ?? null;
}
// Görünümdeki SVG karekodu (dikdörtgen yolları) modül matrisine çevirir.
function modulesFromSvg(svg) {
  const view = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const size = view - 8;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  for (const [, x, y, w] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let k = 0; k < Number(w); k += 1) modules[Number(y) - 4][Number(x) - 4 + k] = true;
  return { size, modules };
}
const viewQr = html => {
  const src = html.match(/class="karekod"><img alt="Karekod" src="data:image\/svg\+xml;base64,([^"]+)"/)?.[1];
  return src ? decodeModules(modulesFromSvg(Buffer.from(src, "base64").toString("utf8"))) : null;
};

describe("Karekod üreticisi (ISO/IEC 18004) bağımsız çözücüyle", () => {
  test("kısa ve uzun içerik, Türkçe karakter: jsQR aynı metni okur (sürüm 1'den 31'e)", () => {
    const versions = new Set();
    for (const length of [1, 9, 30, 90, 180, 330, 520, 900, 1250]) {
      const text = Array.from({ length }, (_, i) => 'ğüşİçÖ{}":,0123456789abcXYZ'[i % 28]).join("");
      const qr = encodeQr(text);
      versions.add(qr.version);
      assert.equal(decodeModules(qr), text, `uzunluk ${length}, sürüm ${qr.version}`);
    }
    assert.ok(versions.size >= 8 && Math.min(...versions) === 1 && Math.max(...versions) >= 30, [...versions].join(","));
  });
  test("GİB kılavuzundaki örnek JSON okunur", () => {
    const sample = '{"vkntckn":"1111111111","avkntckn":"1111111111","senaryo":"TEMELFATURA","tip":"SATIS","tarih":"2022-08-17","no":"GIB2022000000001","ettn":"04e26a62-7c00-46d0-878c-6f7c60834525","parabirimi":"TRY","malhizmettoplam":"1000.00","kdvmatrah(8)":"1000.00","hesaplanankdv(8)":"80.00","vergidahil":"1080.00","odenecek":"1080.00"}';
    assert.equal(decodeModules(encodeQr(sample)), sample);
  });
  test("ISO/IEC 18004 kapasite tablosu (bayt kipi, M): her sürümün tam kapasitesi o sürüme, bir fazlası sonrakine; 40 sürümün hepsi okunur", () => {
    // ISO/IEC 18004:2015 Tablo 7, düzey M, 8 bit bayt kipi — üreticiden bağımsız kâhin.
    const CAPACITY_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331];
    CAPACITY_M.forEach((capacity, index) => {
      const version = index + 1;
      const text = Array.from({ length: capacity }, (_, i) => String.fromCharCode(33 + ((i * 7 + version) % 90))).join("");
      const qr = encodeQr(text);
      assert.equal(qr.version, version, `${capacity} bayt sürüm ${version}`);
      assert.equal(decodeModules(qr), text, `sürüm ${version} okunur`);
      if (version < 40) assert.equal(encodeQr(`${text}x`).version, version + 1, `${capacity + 1} bayt sürüm ${version + 1}`);
    });
  });
  test("karekoda sığmayacak metin açık hatayla reddedilir", () => {
    assert.throws(() => encodeQr("x".repeat(3000)), /sığmayacak/);
  });
});

describe("e-Belge görünümünde karekod ve GİB logosu (programın API'si)", () => {
  let server;
  let client;
  let ids = {};
  before(async () => {
    server = await startTestServer({ edocEnabled: true });
    const raw = server.client();
    assert.equal((await raw.login("admin", ADMIN_PASSWORD)).status, 200);
    client = { get: async url => unwrap(await raw.get(url)), post: async (url, body) => unwrap(await raw.post(url, body)), put: async (url, body) => unwrap(await raw.put(url, body)), raw: (...args) => raw.raw(...args) };
    const put = await client.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true });
    assert.equal(put.status, 200);
    const firm = await client.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", mersisNo: "0123456789000015" });
    const person = await client.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" });
    ids = { firm: firm.data.id || firm.data.account?.id, person: person.data.id || person.data.account?.id };
  });
  after(async () => {
    await server?.close();
  });
  const xmlOf = async id => (await client.get(`/api/workspace/invoices/${id}/ubl.xml`)).data;
  const field = (xml, path) => xml.match(new RegExp(`<${path}[^>]*>([^<]*)<`))?.[1];

  test("e-Fatura iki KDV oranı: karekod GİB JSON'u, alan sırası kılavuzdaki gibi, tutarlar ELLE hesapla ve XML'le aynı", async () => {
    // 2 × 500 (%20) + 1 × 250 (%10) → mal hizmet 1.250,00; KDV 200 + 25; vergiler dahil = ödenecek 1.475,00.
    const doc = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }, { name: "Bakım", qty: 1, unitPrice: 250, vatRate: 10 }], payment: { rest: "open" } })).data;
    const xml = await xmlOf(doc.id);
    const html = renderView(xml);
    const text = viewQr(html);
    assert.ok(text, "görünümde okunabilir karekod var");
    const data = JSON.parse(text);
    assert.deepEqual(Object.keys(data), ["vkntckn", "avkntckn", "senaryo", "tip", "tarih", "no", "ettn", "parabirimi", "malhizmettoplam", "kdvmatrah(10)", "hesaplanankdv(10)", "kdvmatrah(20)", "hesaplanankdv(20)", "vergidahil", "odenecek"]);
    assert.deepEqual(data, {
      vkntckn: OUR_VKN,
      avkntckn: BUYER_VKN,
      senaryo: "TEMELFATURA",
      tip: "SATIS",
      tarih: doc.issueDate,
      no: doc.number,
      ettn: doc.ettn,
      parabirimi: "TRY",
      malhizmettoplam: "1250.00",
      "kdvmatrah(10)": "250.00",
      "hesaplanankdv(10)": "25.00",
      "kdvmatrah(20)": "1000.00",
      "hesaplanankdv(20)": "200.00",
      vergidahil: "1475.00",
      odenecek: "1475.00",
    });
    assert.equal(data.odenecek, field(xml, "cbc:PayableAmount"), "XML'deki ödenecekle aynı");
    assert.equal(data.no, field(xml, "cbc:ID"));
    // Karekod sağ üst hücrede (bilgi tablosunun üstünde); GİB logosu başlığın üstünde.
    assert.match(html, /<td style="width:38%"><div class="karekod"><img alt="Karekod"/);
    assert.match(html, /class="baslik">(?:<div class="logo">.*?<\/div>)?<div class="gib"><img alt="GİB" src="data:image\/jpeg;base64,\/9j\//);
    assert.equal((await validateInvoice(xml)).schematron.length, 0, "şablon gömülü belge GİB şematronundan temiz");
  });

  test("tevkifatlı e-Fatura: ödenecek (1.120,00) vergiler dahilden (1.200,00) ayrı okunur; tip TEVKIFAT", async () => {
    // 1 × 1000 (%20) → KDV 200; tevkifat 601 (4/10) = 80 → vergiler dahil 1200.00, ödenecek 1120.00 (elle).
    const doc = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Etüt Proje", qty: 1, unitPrice: 1000, vatRate: 20, withholdingCode: "601" }], payment: { rest: "open" } })).data;
    const data = JSON.parse(viewQr(renderView(await xmlOf(doc.id))));
    assert.deepEqual([data.tip, data.malhizmettoplam, data["kdvmatrah(20)"], data["hesaplanankdv(20)"], data.vergidahil, data.odenecek], ["TEVKIFAT", "1000.00", "1000.00", "200.00", "1200.00", "1120.00"]);
  });

  test("e-Arşiv, alıcı TCKN: senaryo EARSIVFATURA, avkntckn 11 hane (MERSİS değil)", async () => {
    const doc = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.person, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } })).data;
    const data = JSON.parse(viewQr(renderView(await xmlOf(doc.id))));
    assert.equal(data.senaryo, "EARSIVFATURA");
    assert.equal(data.avkntckn, "10000000078");
    assert.deepEqual([data.malhizmettoplam, data["kdvmatrah(20)"], data["hesaplanankdv(20)"], data.odenecek], ["300.00", "300.00", "60.00", "360.00"]);
  });

  test("programın PDF'i de karekod taşır; görünüm şablonu kapatılsa da PDF'te kalır", async () => {
    const doc = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.firm, lines: [{ name: "Destek", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } })).data;
    // Karekod yalnız entegratöre ulaşmış belgenin PDF'inde (2.4.0 bitiş turu E4/Y7; gönderilmemiş belge: test/ebelge-240-bitis-turu). Belge gönderilmiş sayılır.
    server.app.store.run("UPDATE invoices SET e_status = 'sent', e_adapter = 'edm' WHERE id = ?", doc.id);
    const before = await client.raw("GET", `/api/workspace/invoices/${doc.id}/fatura.pdf`);
    assert.equal(before.status, 200);
    // Karekod dolu dikdörtgenlerle çizilir: içerik akışında yüzlerce "re f" işlemi (karekodsuz fişte yalnız birkaç kutu).
    const rects = buffer => {
      let ops = 0;
      const raw = buffer.toString("latin1");
      for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
        let content = match[1];
        try {
          content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
        } catch {
          // sıkıştırılmamış akış
        }
        ops += (content.match(/ re\s+f/g) || []).length;
      }
      return ops;
    };
    assert.ok(rects(before.buffer) > 200, `karekod çizildi (${rects(before.buffer)} dikdörtgen)`);
    // Görünüm şablonu kapatılsa da (entegratörün varsayılan görünümü) programın PDF'inde karekod kalır.
    assert.equal((await client.put("/api/workspace/invoices/settings", { eView: { enabled: false } })).status, 200);
    const noView = await client.raw("GET", `/api/workspace/invoices/${doc.id}/fatura.pdf`);
    assert.ok(rects(noView.buffer) > 200, `şablon kapalıyken de karekod (${rects(noView.buffer)})`);
    assert.equal((await client.put("/api/workspace/invoices/settings", { eView: { enabled: true } })).status, 200);
    // Alış faturası (satıcısı karşı taraf): programın PDF'inde bizim karekodumuz yok.
    const supplier = await client.post("/api/workspace/accounts", { name: "Tedarikçi A.Ş.", type: "supplier", address: "Ulus 1", district: "Altındağ", city: "Ankara" });
    assert.equal(supplier.status, 200, JSON.stringify(supplier.data));
    const purchase = await client.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.data.id || supplier.data.account?.id, number: "TDR-77", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    const plain = await client.raw("GET", `/api/workspace/invoices/${purchase.data.id}/fatura.pdf`);
    assert.equal(plain.status, 200);
    assert.ok(rects(plain.buffer) < 60, `alış belgesinde karekod yok (${rects(plain.buffer)})`);
  });
});

describe("Kaşe / imza görseli (Fatura Ayarları; e-Arşivde varsayılan, e-Faturada isteğe bağlı)", () => {
  // 1×1 piksel JPEG (sunucu JPEG ve boyutunu denetler).
  const STAMP = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  let server;
  let client;
  const ids = {};
  before(async () => {
    server = await startTestServer({ edocEnabled: true });
    const raw = server.client();
    assert.equal((await raw.login("admin", ADMIN_PASSWORD)).status, 200);
    client = { get: async url => unwrap(await raw.get(url)), post: async (url, body) => unwrap(await raw.post(url, body)), put: async (url, body) => unwrap(await raw.put(url, body)), raw: (...args) => raw.raw(...args) };
    const saved = await client.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true });
    ids.defaults = { stamp: saved.data.seller.stamp, view: [saved.data.eView.stamp, saved.data.eView.stampEfatura] };
    const firm = await client.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    const person = await client.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" });
    const line = [{ name: "Destek", qty: 1, unitPrice: 100, vatRate: 20 }];
    ids.efatura = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.data.id || firm.data.account?.id, lines: line, payment: { rest: "open" } })).data;
    ids.earsiv = (await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.data.id || person.data.account?.id, lines: line, payment: { rest: "open" } })).data;
  });
  after(async () => {
    await server?.close();
  });
  const view = async doc => renderView((await client.get(`/api/workspace/invoices/${doc.id}/ubl.xml`)).data);
  const pdfImages = async doc => ((await client.raw("GET", `/api/workspace/invoices/${doc.id}/fatura.pdf`)).buffer.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length;
  const hasStamp = html => /class="kase"><img alt="Kaşe \/ İmza" src="data:image\/jpeg/.test(html);

  test("varsayılan: kaşe yok; seçenekler e-Arşivde açık, e-Faturada kapalı; görsel yüklenmeden hiçbir yerde basılmaz", async () => {
    assert.deepEqual(ids.defaults, { stamp: "", view: [true, false] });
    assert.equal(hasStamp(await view(ids.earsiv)), false);
    assert.equal(await pdfImages(ids.earsiv), 0);
  });
  test("yüklenince e-Arşivde (görünüm + PDF Düzenleyen kutusu) basılır, e-Faturada basılmaz; belgeye kopyalanmaz", async () => {
    const saved = await client.put("/api/workspace/invoices/settings", { seller: { stamp: STAMP } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(hasStamp(await view(ids.earsiv)), true, "e-Arşiv görünümünde kaşe");
    assert.equal(hasStamp(await view(ids.efatura)), false, "e-Fatura görünümünde kaşe yok");
    assert.equal(await pdfImages(ids.earsiv), 1, "e-Arşiv PDF'inde kaşe görseli");
    assert.equal(await pdfImages(ids.efatura), 0, "e-Fatura PDF'inde kaşe yok");
    const stored = server.app.store.get("SELECT seller_json AS seller FROM invoices WHERE id = ?", ids.earsiv.id).seller;
    assert.ok(!stored.includes("stamp") && !stored.includes("/9j/"), "kaşe belgenin satıcı bilgisine kopyalanmadı");
  });
  test("\"e-Faturada da göster\" açılınca e-Faturada da; \"Kaşe / İmzayı Göster\" kapatılınca hiçbirinde", async () => {
    assert.equal((await client.put("/api/workspace/invoices/settings", { eView: { stampEfatura: true } })).status, 200);
    assert.equal(hasStamp(await view(ids.efatura)), true);
    assert.equal(await pdfImages(ids.efatura), 1);
    assert.equal((await client.put("/api/workspace/invoices/settings", { eView: { stamp: false } })).status, 200);
    assert.equal(hasStamp(await view(ids.earsiv)), false);
    assert.equal(await pdfImages(ids.earsiv), 0);
  });
  test("JPEG olmayan görsel reddedilir (400, alan seller.stamp); kaldırılınca silinir", async () => {
    const bad = await client.put("/api/workspace/invoices/settings", { seller: { stamp: "data:image/png;base64,iVBORw0KGgo=" } });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.field, "seller.stamp");
    const cleared = await client.put("/api/workspace/invoices/settings", { seller: { stamp: "" } });
    assert.equal(cleared.data.seller.stamp, "");
  });
});

describe("Karekod içeriği XML'den: kimlik VKN / TCKN şemasından okunur", () => {
  test("MERSİS numarası kimlikten önce yazılmış olsa da avkntckn VKN'dir", () => {
    const xml = `<Invoice xmlns:cac="a" xmlns:cbc="b"><cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>ABC2026000000001</cbc:ID>
      <cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0123456789000015</cbc:ID></cac:PartyIdentification><cac:PartyIdentification><cbc:ID schemeID="VKN">9876543210</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingCustomerParty>
      <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TRY">1.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>`;
    const data = karekodData(xml);
    assert.equal(data.vkntckn, "1234567890");
    assert.equal(data.avkntckn, "9876543210");
  });
});

describe("EDM: belge türü ile gönderim kanalı uyuşmazlığı isteğe dönüşmez", () => {
  let edm;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
  });
  after(async () => {
    await edm?.close();
  });
  test("e-Arşiv profilli belge e-Fatura kanalından (ve tersi) gönderilmez; taslak yüklemede de", async () => {
    const client = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1" });
    const earsiv = '<Invoice xmlns:cbc="x"><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID></Invoice>';
    const efatura = '<Invoice xmlns:cbc="x"><cbc:ProfileID>TEMELFATURA</cbc:ProfileID></Invoice>';
    const common = { number: "DOA2026000000001", uuid: "u-kanal", senderVkn: OUR_VKN, receiverVkn: BUYER_VKN, receiverAlias: "urn:mail:defaultpk@alici.com.tr" };
    await assert.rejects(client.send({ ...common, xml: earsiv, earchive: false }), error => error.code === "integrator-channel");
    await assert.rejects(client.send({ ...common, xml: efatura, earchive: true }), error => error.code === "integrator-channel");
    await assert.rejects(client.loadDraft({ ...common, xml: earsiv, earchive: false }), error => error.code === "integrator-channel");
    assert.equal(edm.state.calls.filter(call => call.op === "SendInvoice" || call.op === "LoadInvoice").length, 0, "EDM'ye istek gitmedi");
    await client.send({ ...common, xml: earsiv, earchive: true });
    assert.equal(edm.state.sent.length, 1, "uyumlu kanal gider");
  });
});
