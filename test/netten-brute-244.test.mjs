// SMM "Netten Brüte" (2.4.4 iş listesi madde 26, ek bulgu b; DURUM-VE-DEVAM EK-3 K-E1b). Hata: form Stopaj % kutusu boşken ("otomatik") istemci
// her alıcıya ayardaki oranı (%20) gönderiyordu; sunucu kayıtta gerçek kişi alıcıya stopaj uygulamaz → brüt %25 fazla yazılıyordu. "Fiyatlar KDV
// Dahil"de brüt KDV dahil fiyat sanılıyor, matrah KDV kadar eksik kalıyordu. Düzeltme: birim fiyatı sunucu kaydın kendi yolundan çözer
// (POST /api/workspace/invoices/gross-from-net — documentInput + computeInvoice).
//
// BEKLENEN SAYILAR (ders 5 uyarısı): bu işi yapan elden, programın kodundan değil KURALDAN elle hesaplandı — yine de aynı elden olduğu için
// KÂHİN SAYILMAZ (ajan-ortak 22.10: kâhini kodu görmeyen ayrı ajan yazar). Asıl iddia talimattan gelir: Net Ücret = yazılan tutar (veri tabanı).
//   - Stopaj kimden: 193 sayılı GVK md. 94/1 vergi kesintisi yapmaya mecbur olanları sayar (kamu idareleri, sermaye şirketleri, kooperatifler,
//     dernek/vakıflar, basit usul dışındaki ticaret ve serbest meslek erbabı…); ticari faaliyeti olmayan gerçek kişi (nihai tüketici) listede YOK →
//     stopaj kesilmez. Oran: md. 94/2-b serbest meslek ödemeleri %20 (programın ayar varsayılanı, testte değiştirilmedi). Elle yazılan oran geçer.
//   - Stopaj = brüt ücret × oran (kuruşa, yarım yukarı); Net Ücret = brüt − stopaj (GİB e-SMM: "Net Ücret"); KDV = matrah (brüt ücret) × oran
//     (KDV Kanunu md. 20; kalem başına kuruşa); KDV tevkifatı = KDV × pay/payda (KDV GUT I/C-2.1.3; 602 Etüt, Plan-Proje, Danışmanlık 9/10);
//     Ödenecek (Net Tahsil Edilen) = Net Ücret + KDV − tevkifat. KDV dahil fiyat = matrah + KDV.
//   - Kuruş belirsizliği (iki brüt aynı Net Ücreti veriyorsa) en küçük brüt; KDV dahil fiyatta KDV = matrah × oran olan fiyat.
//   Kanun metni bu ortamdan indirilemedi (mevzuat.gov.tr/MevzuatMetin/1.4.193.pdf ve gib.gov.tr ağ politikasıyla reddedildi, 22.10.2026); madde
//   metni oradan doğrulanır. ebelge.gib.gov.tr'deki e-SMM belgeleri (509 VUK GT, e-SMM düzenleme kılavuzu) stopajın kimden kesileceğini yazmaz.
// Her kayıttan sonra VERİ TABANI okunur (ders 3): kaydedilen makbuzun Net Ücreti (net_total − stoppage_total) yazılan tutara kuruşu kuruşuna eşit.
// Eski kodda (163dd5d) kırmızı: POST ucu yoktu (GET + istemcinin oranı); ekrandan kırmızı senaryo test/e2e/senaryo-netten-brute-244.mjs.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const FIRM = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", address: "Bağdat Cd. 5", district: "Kadıköy", city: "İstanbul" };
const RETAIL = { name: "Kimliksiz Müşteri", type: "customer", partyKind: "person", firstName: "Kimliksiz", familyName: "Müşteri" };
// İstemcinin Birim Fiyat kutusuna yazdığı biçim (hof-invoices.js priceText: "1.250,00"); sunucu parseAmount ile okur.
const PRICE = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const kurus = value => Math.round(Number(value) * 100);

let server;
let api;
const accounts = {};

// Formun gövdesi (istemci docBody gibi). first: ilk kalem (Netten Brüte'nin yazdığı); others: öbür kalemler.
const formBody = ({ who, rate, includeVat = false, discountRate = "0", first = {}, others = [], scenario = "smm" }) => ({
  scenario,
  kind: scenario === "smm" ? "smm" : undefined,
  accountId: who ? accounts[who] : "",
  pricesIncludeVat: includeVat,
  discountRate,
  ...(rate !== undefined ? { stoppageRate: String(rate) } : {}),
  lines: [{ name: "Avukatlık Ücreti", qty: "1", unitPrice: "0", vatRate: 20, ...first }, ...others],
});
async function nettenBrute(form, net) {
  return api.post("/api/workspace/invoices/gross-from-net", { ...formBody(form), net });
}
// Netten Brüte → ilk kaleme birim fiyat (istemci biçimiyle) → Kaydet → veri tabanı.
async function issueFromNet(form, net) {
  const answer = await nettenBrute(form, net);
  assert.equal(answer.status, 200, JSON.stringify(answer.data));
  const body = formBody(form);
  body.lines[0] = { ...body.lines[0], qty: "1", unitPrice: PRICE.format(answer.data.unitPrice) };
  const saved = await api.post("/api/workspace/invoices", { ...body, payment: { rest: "open" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const row = server.app.store.get("SELECT kind, status, stoppage_rate AS rate, net_total AS net, stoppage_total AS stoppage, vat_total AS vat, withheld_total AS withheld, payable_total AS payable FROM invoices WHERE id = ?", saved.data.id);
  assert.ok(row, "makbuz veri tabanında");
  assert.equal(row.kind, "smm");
  assert.equal(row.status, "issued");
  const line = server.app.store.get("SELECT unit_price AS unitPrice, qty FROM invoice_lines WHERE invoice_id = ? ORDER BY rowid LIMIT 1", saved.data.id);
  return { answer: answer.data, row, line };
}

before(async () => {
  server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)) };
  for (const [key, body] of Object.entries({ firm: FIRM, person: PERSON, retail: RETAIL })) {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    accounts[key] = response.data.id || response.data.account?.id;
  }
});
after(async () => server?.close());

// Elle hesaplanmış beklenenler (TL). Kaynak ve türetme dosya başında; her satırın hesabı yanında.
const CASES = [
  // kişi alıcı, oran boş → stopaj yok (GVK 94'te sayılmaz): brüt = net 1.000; KDV 1.000 × %20 = 200; ödenecek 1.200. ESKİ KOD: 1.250 yazıyordu.
  { name: "gerçek kişi alıcı, oran boş, KDV %20", form: { who: "person" }, net: "1.000,00", want: { unitPrice: 1000, rate: 0, net: 1000, stoppage: 0, vat: 200, withheld: 0, payable: 1200 } },
  // nihai tüketici (kimliksiz kişi) aynı kural; 999,99 × %20 = 199,998 → 200,00; ödenecek 1.199,99.
  { name: "nihai tüketici (kimliksiz kişi), oran boş", form: { who: "retail" }, net: "999,99", want: { unitPrice: 999.99, rate: 0, net: 999.99, stoppage: 0, vat: 200, withheld: 0, payable: 1199.99 } },
  // tüzel alıcı, oran boş → %20: brüt 1.000 ÷ 0,8 = 1.250; stopaj 250; KDV 250; ödenecek 1.000 + 250 = 1.250.
  { name: "tüzel alıcı, oran boş (%20), KDV %20", form: { who: "firm" }, net: "1.000,00", want: { unitPrice: 1250, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 0, payable: 1250 } },
  // tüzel, KDV %0 (istisna): brüt 1.250; KDV 0; ödenecek 1.000.
  { name: "tüzel alıcı, KDV'siz kalem", form: { who: "firm", first: { vatRate: 0 } }, net: "1000", want: { unitPrice: 1250, rate: 20, net: 1250, stoppage: 250, vat: 0, withheld: 0, payable: 1000 } },
  // tüzel, Fiyatlar KDV Dahil: matrah 1.250, KDV 250 → KDV dahil birim fiyat 1.500. ESKİ KOD: 1.250 KDV dahil → matrah 1.041,67.
  { name: "tüzel alıcı, Fiyatlar KDV Dahil", form: { who: "firm", includeVat: true }, net: "1.000,00", want: { unitPrice: 1500, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 0, payable: 1250 } },
  // kişi, Fiyatlar KDV Dahil: matrah 1.000, KDV 200 → 1.200.
  { name: "gerçek kişi alıcı, Fiyatlar KDV Dahil", form: { who: "person", includeVat: true }, net: "1.000,00", want: { unitPrice: 1200, rate: 0, net: 1000, stoppage: 0, vat: 200, withheld: 0, payable: 1200 } },
  // kişi, KDV dahil, kuruş sınırı: matrah 1.000,03; KDV 200,006 → 200,01 (GİB: matrah × oran) → fiyat 1.200,04 (1.200,03 de aynı matrahı verir
  // ama KDV'si 200,00 olur).
  { name: "gerçek kişi alıcı, KDV dahil, KDV kuruşu matrahtan", form: { who: "person", includeVat: true }, net: "1.000,03", want: { unitPrice: 1200.04, rate: 0, net: 1000.03, stoppage: 0, vat: 200.01, withheld: 0, payable: 1200.04 } },
  // kişi, oran elle %15: brüt 850 ÷ 0,85 = 1.000; stopaj 150; KDV 200; ödenecek 850 + 200 = 1.050.
  { name: "gerçek kişi alıcı, oran elle %15", form: { who: "person", rate: 15 }, net: "850", want: { unitPrice: 1000, rate: 15, net: 1000, stoppage: 150, vat: 200, withheld: 0, payable: 1050 } },
  // tüzel, oran elle 0: brüt = net.
  { name: "tüzel alıcı, oran elle 0", form: { who: "firm", rate: 0 }, net: "1.000,00", want: { unitPrice: 1000, rate: 0, net: 1000, stoppage: 0, vat: 200, withheld: 0, payable: 1200 } },
  // tüzel, oran elle %17, KDV %10: B − yuvarla(0,17·B) = 1.000 → B = 1.204,82 (stopaj 204,8194 → 204,82; 1.204,81 → 204,82 → 999,99 olmaz);
  // KDV 120,482 → 120,48; ödenecek 1.000 + 120,48 = 1.120,48.
  { name: "tüzel alıcı, oran elle %17, KDV %10", form: { who: "firm", rate: 17, first: { vatRate: 10 } }, net: "1.000,00", want: { unitPrice: 1204.82, rate: 17, net: 1204.82, stoppage: 204.82, vat: 120.48, withheld: 0, payable: 1120.48 } },
  // tüzel, KDV tevkifatı 602 (9/10): brüt 1.250; stopaj 250; KDV 250; tevkifat 225; ödenecek 1.000 + 250 − 225 = 1.025.
  { name: "tüzel alıcı, KDV tevkifatlı (602, 9/10)", form: { who: "firm", first: { withholdingCode: "602" } }, net: "1.000,00", want: { unitPrice: 1250, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 225, payable: 1025 } },
  // tüzel, kuruş: 1.000,01 ÷ 0,8 = 1.250,0125 → 1.250,01 (stopaj 250,002 → 250,00; net 1.000,01); KDV 250,00; ödenecek 1.250,01.
  { name: "tüzel alıcı, kuruşlu net", form: { who: "firm" }, net: "1.000,01", want: { unitPrice: 1250.01, rate: 20, net: 1250.01, stoppage: 250, vat: 250, withheld: 0, payable: 1250.01 } },
  // tüzel, iki kalem (öbürü 100 TL): makbuzun tamamı 1.000 net → toplam brüt 1.250 → ilk kalem 1.150; KDV 230 + 20 = 250; ödenecek 1.250.
  { name: "tüzel alıcı, iki kalem (net makbuzun tamamı)", form: { who: "firm", others: [{ name: "Dilekçe", qty: "1", unitPrice: "100", vatRate: 20 }] }, net: "1.000,00", want: { unitPrice: 1150, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 0, payable: 1250 } },
  // tüzel, kalem iskontosu %10: matrah 1.250 → P − yuvarla(0,1·P) = 1.250 → P = 1.388,89 (iskonto 138,889 → 138,89); KDV 250; ödenecek 1.250.
  { name: "tüzel alıcı, kalem iskontosu %10", form: { who: "firm", first: { discountRate: "10" } }, net: "1.000,00", want: { unitPrice: 1388.89, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 0, payable: 1250 } },
  // tüzel, genel iskonto %10 (belge düzeyi): aynı hesap — P = 1.388,89, matrah 1.250.
  { name: "tüzel alıcı, genel iskonto %10", form: { who: "firm", discountRate: "10" }, net: "1.000,00", want: { unitPrice: 1388.89, rate: 20, net: 1250, stoppage: 250, vat: 250, withheld: 0, payable: 1250 } },
];

describe("Netten Brüte — kaydedilen makbuzun Net Ücreti yazılan tutardır (veri tabanından)", () => {
  for (const item of CASES) {
    test(item.name, async () => {
      const { answer, row, line } = await issueFromNet(item.form, item.net);
      const want = item.want;
      assert.equal(kurus(answer.unitPrice), kurus(want.unitPrice), `birim fiyat (yanıt) ${answer.unitPrice}`);
      assert.equal(kurus(line.unitPrice), kurus(want.unitPrice), `birim fiyat (veri tabanı) ${line.unitPrice}`);
      assert.equal(Number(line.qty), 1, "miktar 1");
      assert.equal(Number(row.rate), want.rate, "stopaj oranı (veri tabanı)");
      assert.equal(kurus(row.net), kurus(want.net), "brüt ücret (matrah)");
      assert.equal(kurus(row.stoppage), kurus(want.stoppage), "stopaj");
      assert.equal(kurus(row.vat), kurus(want.vat), "KDV");
      assert.equal(kurus(row.withheld), kurus(want.withheld), "KDV tevkifatı");
      assert.equal(kurus(row.payable), kurus(want.payable), "ödenecek");
      // Asıl iddia: Net Ücret = yazılan net, kuruşu kuruşuna.
      const target = kurus(String(item.net).replace(/\./g, "").replace(",", "."));
      assert.equal(kurus(row.net) - kurus(row.stoppage), target, "Net Ücret = yazılan tutar");
      // Yanıttaki dökümle kayıt aynı.
      assert.equal(kurus(answer.net), target);
      assert.equal(kurus(answer.gross), kurus(row.net));
      assert.equal(kurus(answer.payable), kurus(row.payable));
    });
  }
});

describe("Netten Brüte — reddedilen istekler", () => {
  test("cari seçilmeden: neden yazılır", async () => {
    const answer = await nettenBrute({}, "1000");
    assert.equal(answer.status, 400);
    assert.match(answer.data.error || answer.data.message || JSON.stringify(answer.data), /carisini seçin/);
  });
  test("net boş / sıfır / harf", async () => {
    for (const net of ["", "0", "abc", "-5"]) {
      const answer = await nettenBrute({ who: "firm" }, net);
      assert.equal(answer.status, 400, `net "${net}"`);
    }
  });
  test("SMM dışında kullanılmaz", async () => {
    const answer = await nettenBrute({ who: "firm", scenario: "service_sale" }, "1000");
    assert.equal(answer.status, 400);
    assert.match(JSON.stringify(answer.data), /serbest meslek makbuzunda/);
  });
  test("öbür kalemlerin net ücreti hedefi aşıyorsa yazılmaz", async () => {
    const answer = await nettenBrute({ who: "firm", others: [{ name: "Büyük Kalem", qty: "1", unitPrice: "2000", vatRate: 20 }] }, "1000");
    assert.equal(answer.status, 400);
    assert.match(JSON.stringify(answer.data), /Öbür kalemlerin net ücreti/);
  });
  test("öbür kalemde tanınmayan tevkifat kodu: girdi hatası söylenir", async () => {
    const answer = await nettenBrute({ who: "firm", others: [{ name: "Kalem", qty: "1", unitPrice: "10", vatRate: 20, withholdingCode: "999" }] }, "1000");
    assert.equal(answer.status, 400);
    assert.match(JSON.stringify(answer.data), /tevkifat kodu/);
  });
});

// Rastgele (tohumlu) formlar: alıcı × oran (boş/elle) × KDV × KDV dahil × tevkifat × kalem/genel iskonto × öbür kalemler. Beklenen yalnız kural:
// Net Ücret = yazılan tutar (kuruşu kuruşuna, veri tabanından) ve stopaj oranı = GVK 94 kuralı (boşsa tüzel %20 / kişi 0; elle yazılan geçer).
describe("Netten Brüte — rastgele formlar (tohum 2026_1022)", () => {
  test("300 makbuz: Net Ücret = yazılan, oran = alıcı kuralı", async () => {
    let seed = 2026_1022;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = list => list[Math.floor(rnd() * list.length)];
    let saved = 0;
    let skipped = 0;
    for (let run = 0; run < 300; run += 1) {
      const who = pick(["firm", "person", "retail"]);
      const rate = pick([undefined, undefined, undefined, 0, 10, 15, 17, 20, 40]);
      const vatRate = pick([0, 1, 10, 20, 20]);
      const first = { vatRate, discountRate: String(pick([0, 0, 0, 5, 12.5])), ...(vatRate > 0 && rnd() < 0.3 ? { withholdingCode: pick(["602", "616"]) } : {}) };
      const others = Array.from({ length: pick([0, 0, 1, 2]) }, (_, index) => ({ name: `Kalem ${index + 2}`, qty: String(pick([1, 2, 3])), unitPrice: (Math.floor(rnd() * 50000) / 100).toFixed(2), vatRate: pick([0, 10, 20]) }));
      const form = { who, rate, includeVat: rnd() < 0.4, discountRate: String(pick([0, 0, 0, 3])), first, others };
      const targetKurus = 1 + Math.floor(rnd() * 5_000_000) + (others.length ? 2_000_000 : 0);
      const net = (targetKurus / 100).toFixed(2).replace(".", ",");
      const answer = await nettenBrute(form, net);
      if (answer.status === 400 && /Öbür kalemlerin net ücreti/.test(JSON.stringify(answer.data))) {
        skipped += 1;
        continue;
      }
      assert.equal(answer.status, 200, `koşu ${run}: ${JSON.stringify(answer.data)} ${JSON.stringify(form)} net ${net}`);
      const body = formBody(form);
      body.lines[0] = { ...body.lines[0], qty: "1", unitPrice: PRICE.format(answer.data.unitPrice) };
      const response = await api.post("/api/workspace/invoices", { ...body, payment: { rest: "open" } });
      assert.equal(response.status, 200, `koşu ${run} kayıt: ${JSON.stringify(response.data)}`);
      const row = server.app.store.get("SELECT stoppage_rate AS rate, net_total AS net, stoppage_total AS stoppage FROM invoices WHERE id = ?", response.data.id);
      const expectedRate = rate !== undefined ? rate : who === "firm" ? 20 : 0;
      assert.equal(Number(row.rate), expectedRate, `koşu ${run} oran (${who}, ${rate})`);
      assert.equal(kurus(row.net) - kurus(row.stoppage), targetKurus, `koşu ${run} Net Ücret ${JSON.stringify(form)} net ${net} → fiyat ${answer.data.unitPrice}`);
      saved += 1;
    }
    assert.ok(saved >= 250, `kaydedilen ${saved}, atlanan ${skipped}`);
  });
});
