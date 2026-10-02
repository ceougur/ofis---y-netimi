// Fatura 2.0.15 — QA raporundan (docs/FATURA-QA-RAPORU.md) çıkan düzeltme ve eklemeler:
// A8 logo (yalnız JPEG, boyut sınırı, belgeye kopyalanmaz, PDF'e DCTDecode görseli), A9 kaşe / imza alanı,
// A6 toplu kesme ve toplu iptal (her belge kendi işleminde; tarih sırası; hata belge belge), B? stok kartı silme koruması
// (fatura kalemine bağlı ürün silinmez), Fiyat Farkı Faturası senaryosu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { after, before, describe, test } from "node:test";
import { jpegInfo } from "../server/lib/pdf-write.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const LOGO = readFileSync(join(FIXTURES, "logo.jpg"));
const PNG = readFileSync(join(FIXTURES, "logo.png"));
const dataUrl = (type, buffer) => `data:image/${type};base64,${buffer.toString("base64")}`;
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
  raw: (...args) => client.raw(...args),
});
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));

// PDF'teki görünen metin: her yazı tipinin ToUnicode eşlemesiyle sayfa akışlarındaki glifler çözülür.
function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar|DCTDecode/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}

describe("Fatura 2.0.15: QA düzeltmeleri ve eklemeleri", () => {
  let server;
  let api;
  let admin;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    api = apiOf(admin);
    ids.customer = (await api.post("/api/workspace/accounts", { name: "Meram Kırtasiye Ltd.", type: "customer", city: "Konya", email: "muhasebe@meramkirtasiye.example", phone: "0532 100 20 30" })).data.id;
    ids.supplier = (await api.post("/api/workspace/accounts", { name: "Selçuklu Kağıt A.Ş.", type: "supplier", taxNo: "1234567890", taxOffice: "Selçuk", city: "Konya" })).data.id;
    ids.item = (await api.post("/api/workspace/stock", { name: "Fotokopi Kağıdı A4", unit: "Paket", minQty: "", unitPrice: "", salePrice: 150, openingQty: "", openingCash: false, openingDate: "" })).data.id;
    assert.ok(ids.customer && ids.supplier && ids.item, "cari ve ürün açıldı");
    // Stoğa 100 paket (üç gün önce), satışlar bundan sonra.
    const purchase = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SKA2026000000017", issueDate: shift(-3), lines: [{ itemId: ids.item, qty: 100, unitPrice: 90, vatRate: 20 }], payment: {} });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    ids.purchase = purchase.data.id;
  });
  after(async () => {
    await server.close();
  });
  const sale = (lines, extra = {}) => api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, lines, payment: { rest: "open" }, ...extra });
  const balance = async id => (await api.get(`/api/workspace/accounts/${id}`)).data.totals.balance;
  const stockQty = async id => Number((await api.get(`/api/workspace/stock/${id}`)).data.qty);

  test("Toplu kesme: taslaklar tarih sırasıyla kesilir; stoğu eksiye düşüren taslak kesilmez, diğerleri kesilir; kesilmiş belge invoice-not-draft", async () => {
    // Taslaklar ters sırayla açılır (bugün, dün, önceki gün); kesim tarih sırasıyla olmalı, yoksa seri kronolojisi bozulur.
    const dates = [shift(0), shift(-1), shift(-2)];
    const drafts = [];
    for (const date of dates) {
      const draft = await sale([{ itemId: ids.item, qty: 2, unitPrice: 150, vatRate: 20 }], { status: "draft", issueDate: date });
      assert.equal(draft.status, 200, JSON.stringify(draft.data));
      assert.equal(draft.data.status, "draft");
      drafts.push(draft.data);
    }
    const hungry = await sale([{ itemId: ids.item, qty: 500, unitPrice: 150, vatRate: 20 }], { status: "draft" });
    assert.equal(hungry.status, 200);
    const empty = await api.post("/api/workspace/invoices/bulk-issue", { ids: [] });
    assert.equal(empty.status, 400);
    const before = await balance(ids.customer);
    const result = await api.post("/api/workspace/invoices/bulk-issue", { ids: [drafts[0].id, hungry.data.id, drafts[1].id, drafts[2].id, ids.purchase] });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.issued, 3, JSON.stringify(result.data.results));
    assert.equal(result.data.failed, 2);
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[hungry.data.id].ok, false);
    assert.equal(byId[hungry.data.id].code, "stock-negative", "500 paket satış: stok eksiye düşer, kesilmez");
    assert.equal(byId[ids.purchase].code, "invoice-not-draft", "kesilmiş alış faturası toplu kesmeye girmez");
    // Tarih sırası: en eski taslak en küçük numarayı aldı; sonuç listesi de bu sırada.
    const issuedInOrder = result.data.results.filter(item => item.ok).map(item => item.number);
    assert.deepEqual(issuedInOrder, [...issuedInOrder].sort(), `numaralar artan: ${issuedInOrder.join(", ")}`);
    const rows = await Promise.all(drafts.map(draft => api.get(`/api/workspace/invoices/${draft.id}`)));
    assert.deepEqual(rows.map(row => row.data.status), ["issued", "issued", "issued"]);
    assert.equal(rows[2].data.number, issuedInOrder[0], "önceki günün taslağı ilk numara");
    assert.equal(rows[0].data.number, issuedInOrder[2], "bugünün taslağı son numara");
    assert.equal((await api.get(`/api/workspace/invoices/${hungry.data.id}`)).data.status, "draft", "kesilemeyen taslak taslak kaldı");
    assert.equal(Math.round(((await balance(ids.customer)) - before) * 100), 3 * 36000, "üç belge × 360 cariye borç yazıldı");
    assert.equal(await stockQty(ids.item), 94);
    assert.equal((await api.get("/api/workspace/ledger/integrity")).data.ok, true);
    ids.bulkIssued = rows.map(row => row.data.id);
    ids.hungry = hungry.data.id;
  });

  test("Toplu iptal: seçilenler iptal edilir; iadesi olan belge iptal edilmez; en yeni belge önce; personel 403; boş liste 400", async () => {
    // bulkIssued sırası: bugün, dün, önceki gün (taslak açılış sırası).
    const [newest, middle, oldest] = ids.bulkIssued;
    const detail = (await api.get(`/api/workspace/invoices/${oldest}`)).data;
    const ret = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: oldest, lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: {} });
    assert.equal(ret.status, 200, JSON.stringify(ret.data));
    const staff = apiOf(await createUser(server, admin, { username: "selin", role: "personel" }));
    assert.equal((await staff.post("/api/workspace/invoices/bulk-cancel", { ids: [newest] })).status, 403);
    assert.equal((await api.post("/api/workspace/invoices/bulk-cancel", { ids: [], reason: "x" })).status, 400);
    const before = await balance(ids.customer);
    const result = await api.post("/api/workspace/invoices/bulk-cancel", { ids: [oldest, middle, newest, ids.hungry], reason: "Yanlış cariye kesildi" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[oldest].ok, false);
    assert.equal(byId[oldest].code, "invoice-has-returns", "iadesi olan belge: önce iade iptal edilir");
    assert.equal(byId[ids.hungry].code, "invoice-draft", "taslak iptal edilmez, silinir");
    assert.equal(byId[middle].ok, true);
    assert.equal(byId[newest].ok, true);
    assert.equal(result.data.cancelled, 2);
    assert.equal(result.data.results.filter(item => item.ok).map(item => item.id)[0], newest, "en yeni belge önce iptal edilir");
    const cancelled = (await api.get(`/api/workspace/invoices/${middle}`)).data;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancelReason, "Yanlış cariye kesildi");
    assert.equal(Math.round((before - (await balance(ids.customer))) * 100), 2 * 36000, "iki belgenin borcu geri alındı");
    assert.equal(await stockQty(ids.item), 94 + 4 + 1, "iki satışın 4 paketi stoğa döndü; iade 1 paket zaten içeride");
    assert.equal((await api.get("/api/workspace/ledger/integrity")).data.ok, true);
  });

  test("Logo: yalnız JPEG, 150 KB ve 1200 piksel sınırı; belgeye kopyalanmaz; PDF'e DCTDecode görseli olarak gömülür; kaldırılınca çıkmaz", async () => {
    assert.deepEqual(jpegInfo(LOGO), { width: 120, height: 48, components: 3 });
    assert.equal(jpegInfo(PNG), null);
    const png = await api.put("/api/workspace/invoices/settings", { seller: { logo: dataUrl("png", PNG) } });
    assert.equal(png.status, 400);
    assert.equal(png.data.field, "seller.logo");
    assert.match(png.data.error, /JPEG/);
    // 3 × 64 KB yorum bölümü eklenmiş JPEG: yapı geçerli, boyut sınırı aşıldı.
    const comment = Buffer.concat([Buffer.from([0xff, 0xfe, 0xff, 0xff]), Buffer.alloc(0xfffd, 0x20)]);
    const fat = Buffer.concat([LOGO.subarray(0, 2), comment, comment, comment, LOGO.subarray(2)]);
    assert.deepEqual(jpegInfo(fat), jpegInfo(LOGO), "yorum bölümleri atlanır, boyut yine okunur");
    const big = await api.put("/api/workspace/invoices/settings", { seller: { logo: dataUrl("jpeg", fat) } });
    assert.equal(big.status, 400);
    assert.match(big.data.error, /150 KB/);
    // SOF0 genişliği 1300 piksel yapılmış kopya.
    const sof = LOGO.indexOf(Buffer.from([0xff, 0xc0]));
    const wide = Buffer.from(LOGO);
    wide.writeUInt16BE(1300, sof + 7);
    assert.equal(jpegInfo(wide).width, 1300);
    const huge = await api.put("/api/workspace/invoices/settings", { seller: { logo: dataUrl("jpeg", wide) } });
    assert.equal(huge.status, 400);
    assert.match(huge.data.error, /1200 piksel/);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: { logo: dataUrl("jpeg", LOGO) } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.seller.logo, dataUrl("jpeg", LOGO));
    assert.equal((await api.get("/api/workspace/invoices/settings")).data.seller.logo, dataUrl("jpeg", LOGO));
    // Logo belgenin satıcı kopyasına girmez; diğer ayarlar (ör. ad) logo gönderilmeden kaydedilince logo silinmez.
    const kept = await api.put("/api/workspace/invoices/settings", { seller: { name: "Selçuklu Ofis Çözümleri" }, defaults: { footer: "Teşekkür ederiz." } });
    assert.equal(kept.data.seller.logo, dataUrl("jpeg", LOGO), "logo gönderilmeyen kayıt logoyu korur");
    const doc = await sale([{ itemId: ids.item, qty: 1, unitPrice: 150, vatRate: 20 }]);
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    ids.logoDoc = doc.data.id;
    const sellerJson = server.app.store.get("SELECT seller_json AS sellerJson FROM invoices WHERE id = ?", doc.data.id).sellerJson;
    assert.ok(!sellerJson.includes("logo"), "seller_json'da logo yok (belge şişmez; PDF güncel logoyu basar)");
    assert.equal(JSON.parse(sellerJson).name, "Selçuklu Ofis Çözümleri");
    const pdf = await api.raw("GET", `/api/workspace/invoices/${doc.data.id}/fatura.pdf`);
    assert.equal(pdf.status, 200);
    const raw = pdf.buffer.toString("latin1");
    assert.match(raw, /\/Type \/XObject \/Subtype \/Image \/Width 120 \/Height 48 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/);
    assert.match(raw, /\/XObject << \/Im1 \d+ 0 R >>/, "sayfa kaynaklarında görsel");
    assert.ok(pdf.buffer.includes(LOGO), "JPEG verisi olduğu gibi gömülü");
    assert.match(pdfText(pdf.buffer), /Selçuklu Ofis Çözümleri/);
    // Alış belgesi karşı tarafın belgesidir: logomuz basılmaz.
    const purchasePdf = await api.raw("GET", `/api/workspace/invoices/${ids.purchase}/fatura.pdf`);
    assert.ok(!purchasePdf.buffer.toString("latin1").includes("/DCTDecode"), "alış belgesinde logo yok");
    const removed = await api.put("/api/workspace/invoices/settings", { seller: { logo: "" } });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.seller.logo, "");
    assert.ok(!(await api.raw("GET", `/api/workspace/invoices/${doc.data.id}/fatura.pdf`)).buffer.toString("latin1").includes("/DCTDecode"), "logo kaldırılınca PDF'te görsel yok");
  });

  test("Kaşe / imza alanı: satış PDF'inde Teslim Alan ve Düzenleyen kutuları; ayar kapatılınca yok; alış belgesinde hiç basılmaz", async () => {
    assert.equal((await api.get("/api/workspace/invoices/settings")).data.defaults.signatureArea, true, "varsayılan açık");
    let text = pdfText((await api.raw("GET", `/api/workspace/invoices/${ids.logoDoc}/fatura.pdf`)).buffer);
    assert.match(text, /TESLİM ALAN/);
    assert.match(text, /DÜZENLEYEN/);
    assert.match(text, /Kaşe \/ İmza/);
    const purchaseText = pdfText((await api.raw("GET", `/api/workspace/invoices/${ids.purchase}/fatura.pdf`)).buffer);
    assert.ok(!/TESLİM ALAN|Kaşe \/ İmza/.test(purchaseText), "alış belgesinde kaşe / imza kutusu yok");
    assert.match(purchaseText, /SATICI \/ DÜZENLEYEN/, "alış belgesinde satıcı karşı taraftır");
    const off = await api.put("/api/workspace/invoices/settings", { defaults: { signatureArea: false } });
    assert.equal(off.data.defaults.signatureArea, false);
    text = pdfText((await api.raw("GET", `/api/workspace/invoices/${ids.logoDoc}/fatura.pdf`)).buffer);
    assert.ok(!/TESLİM ALAN|Kaşe \/ İmza/.test(text), "ayar kapalıyken kutular basılmaz");
    await api.put("/api/workspace/invoices/settings", { defaults: { signatureArea: true } });
  });

  test("Stok kartı: fatura kalemine bağlı ürün silinmez (409 invoice-linked); fatura iptal edilince silinir", async () => {
    const item = (await api.post("/api/workspace/stock", { name: "Toner 85A", unit: "Adet", minQty: "", unitPrice: "", salePrice: 900, openingQty: "", openingCash: false, openingDate: "" })).data;
    const purchase = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SKA2026000000018", lines: [{ itemId: item.id, qty: 5, unitPrice: 600, vatRate: 20 }], payment: {} });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    const blocked = await api.del(`/api/workspace/stock/${item.id}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.code, "invoice-linked");
    assert.match(blocked.data.error, /SKA2026000000018/);
    assert.equal((await api.get(`/api/workspace/stock/${item.id}`)).status, 200, "ürün duruyor");
    assert.equal((await api.post(`/api/workspace/invoices/${purchase.data.id}/cancel`, { reason: "Yanlış ürün" })).status, 200);
    const deleted = await api.del(`/api/workspace/stock/${item.id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
  });

  test("Fiyat Farkı Faturası senaryosu: stoksuz satış kalemi, cariye borç; senaryo listesinde ve varsayılan satış senaryosu olarak seçilebilir", async () => {
    const meta = (await api.get("/api/workspace/invoices/meta")).data;
    assert.equal(meta.scenarios.price_difference.label, "Fiyat Farkı Faturası");
    assert.equal(meta.scenarios.price_difference.kind, "sale");
    assert.equal(meta.scenarios.price_difference.line, "service");
    const before = await balance(ids.customer);
    const stockBefore = await stockQty(ids.item);
    const doc = await api.post("/api/workspace/invoices", { scenario: "price_difference", accountId: ids.customer, lines: [{ name: "Fiyat farkı (SKA2026000000017 · kur farkı)", qty: 1, unitPrice: 250, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.kind, "sale");
    assert.equal(doc.data.scenarioLabel, "Fiyat Farkı Faturası");
    assert.equal(Math.round(((await balance(ids.customer)) - before) * 100), 30000);
    assert.equal(await stockQty(ids.item), stockBefore, "stok değişmez");
    const defaults = await api.put("/api/workspace/invoices/settings", { defaults: { saleScenario: "price_difference" } });
    assert.equal(defaults.data.defaults.saleScenario, "price_difference");
    await api.put("/api/workspace/invoices/settings", { defaults: { saleScenario: "" } });
    assert.equal((await api.get("/api/workspace/ledger/integrity")).data.ok, true);
  });
});
