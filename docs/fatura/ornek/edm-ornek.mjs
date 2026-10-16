// EDM TEST ORTAMI — 5 SENARYO ÖRNEK BELGE + YANIT / UUID DOĞRULAMA (kullanıcı, 16.10.2026: "başla").
// Kullanım:  NODE_USE_ENV_PROXY=1 node docs/fatura/ornek/edm-ornek.mjs <EDM test kimlik dosyası> <çıktı klasörü>
//   Kimlik dosyası: "Kullanıcı Adı: …" ve "Şifre: …" satırları (depoya GİRMEZ; çıktıda maskelenir). Canlı ortam kilitli; yalnız EDM TEST adresi.
// Ne yapar:
//   1–4: belgeyi DestekOfis'in KENDİ API'siyle oluşturur (JSON gövdesi = ekrandaki form), programın ürettiği UBL-TR XML'ini UBL 2.1 XSD + GİB şematronundan
//        geçirir, beklenen tutarları programdan BAĞIMSIZ basit formüllerle hesaplayıp XML'deki değerlerle karşılaştırır, gerçek EDM'ye gönderir
//        (SendInvoice), dönen UUID'nin belgenin ETTN'siyle aynı olduğunu ve GetInvoiceStatus son durumunu doğrular.
//   5:   (a) programın gönderimden ÖNCE durdurduğu hatalar (geçersiz VKN, …) ve (b) programı atlayıp bozulmuş XML'i doğrudan EDM'ye gönderip SOAP Fault'u
//        (EDM hata kodu + ileti) yakalar.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { validateInvoice } = await import(`${R}/tools/ebelge/dogrula.mjs`);
const { createEdmClient, resetEdmCaches } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const { vkn } = await import(`${R}/test/einvoice-mock.mjs`);

const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 900)}`}`);
let pass = 0, fail = 0;
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const k = x => Math.round(x * 100) / 100;
const xmlNum = (xml, tagName) => Number((xml.match(new RegExp(`<cac:LegalMonetaryTotal>[\\s\\S]*?<cbc:${tagName}[^>]*>([^<]+)<`)) || [])[1]);

const EDM_TEST = "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc";
const VKN = "3230512384"; // EDM test hesabının kendi VKN'si (gönderen ve e-Fatura alıcısı)
const GB = "urn:mail:defaultgb@edmbilisim.com.tr";
const PK = "urn:mail:defaultpk@edmbilisim.com.tr";

const server = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
const seq = 100_000_000 + Math.floor(Math.random() * 700_000_000);
const year = new Date().getFullYear();
const results = [];
try {
  const s = await put("/api/workspace/invoices/settings", {
    seller: { name: "DESTEK OFİS", taxNo: VKN, taxOffice: "Kadıköy", address: "Caferağa Mh. Moda Cd. 12", district: "Kadıköy", city: "İstanbul", postalCode: "34710", email: "bilgi@destekofis.com.tr" },
    efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
    integrator: { env: "test", baseUrl: "", username, password, senderAlias: GB, mailboxAlias: PK, autoCheckUser: true },
  });
  check(s.status === 200, `Fatura Ayarları + EDM test bağlantısı (${s.status})`);
  const account = async body => { const r = await post("/api/workspace/accounts", body); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return r.data.id; };
  const firmEF = await account({ name: "Örnek Otomotiv Yedek Parça A.Ş.", type: "customer", taxNo: VKN, taxOffice: "Merkez", address: "Sanayi Sitesi 4. Blok", district: "Merkez", city: "Bursa", eInvoice: true, eAlias: PK });
  const person = await account({ name: "Ayşe Yılmaz", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Yılmaz", taxNo: "10000000146", address: "Bağdat Cd. 1", district: "Kadıköy", city: "İstanbul", email: "alici@example.com" });
  // e-Arşiv firma alıcısı: sağlama haneli, EDM'de mükellef OLMADIĞI sorgulanmış VKN.
  let firmEA = "";
  for (let i = 0; i < 10 && !firmEA; i += 1) {
    const candidate = vkn(400000000 + i * 7919);
    const q = await post("/api/workspace/invoices/check-user", { taxNo: candidate });
    if (q.status === 200 && q.data?.registered === false) firmEA = await account({ name: "Örnek Temizlik Hizmetleri Ltd. Şti.", type: "customer", taxNo: candidate, taxOffice: "Merkez", address: "Atatürk Cd. 9", district: "Merkez", city: "Ankara" });
  }
  check(Boolean(firmEA), "e-Arşiv firma alıcısı (EDM'de mükellef değil)");

  // ---------- Senaryolar (JSON gövdesi = DestekOfis API / ekrandaki form) ----------
  // beklenen(): programdan BAĞIMSIZ hesap (muhasebe kuralı: iskonto TUTARLARI kuruşa yuvarlanır) — brüt = miktar × fiyat; satır iskontosu = brüt × oran;
  // genel iskonto = (brüt − satır iskontosu) × genel oran; net = brüt − iskontolar; KDV = net × oran; tevkifat = KDV × pay/payda (hepsi kuruşa).
  // Not (16.10.2026 ilk koşu): neti doğrudan yuvarlayan hesap 1. senaryoda 1 kuruş farklı çıkar (106,875 → 106,88; program 112,50 − 5,63 = 106,87).
  const SCENARIOS = [
    { key: "1-perakende-coklu-kdv-iskonto", title: "Perakende: 3 kalem, %1 / %10 / %20 KDV, 1. kalemde satır iskontosu, dipte genel iskonto (e-Arşiv, kişi)",
      body: { scenario: "service_sale", accountId: person, discountRate: 5, lines: [
        { name: "Tam Buğday Ekmeği", unit: "Adet", qty: 10, unitPrice: 12.5, vatRate: 1, discountRate: 10 },
        { name: "Süt 1 Lt", unit: "Adet", qty: 6, unitPrice: 35, vatRate: 10 },
        { name: "Çamaşır Deterjanı 3 Kg", unit: "Adet", qty: 2, unitPrice: 180, vatRate: 20 },
      ], payment: { rest: "open" } }, profile: "EARSIVFATURA", type: "earsiv" },
    { key: "2-hizmet-tevkifat-earsiv", title: "Hizmet: KDV tevkifatlı (612 Temizlik, 9/10) e-Arşiv — satış faturasında gelir vergisi STOPAJI programda yok (yalnız SMM/alış)",
      body: { scenario: "service_sale", accountId: () => firmEA, lines: [{ name: "Ofis Temizlik Hizmeti (Ekim)", unit: "Ay", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "612" }], payment: { rest: "open" } },
      profile: "EARSIVFATURA", type: "earsiv", wh: { 612: [9, 10] } },
    { key: "3a-tevkifat-5-10-efatura", title: "Tevkifatlı e-Fatura 5/10 (616 Diğer Hizmetler)",
      body: { scenario: "service_sale", accountId: firmEF, lines: [{ name: "Araç Bakım ve Onarım İşçiliği", unit: "Saat", qty: 8, unitPrice: 750, vatRate: 20, withholdingCode: "616" }], payment: { rest: "open" } },
      profile: "TEMELFATURA", type: "efatura", wh: { 616: [5, 10] } },
    { key: "3b-tevkifat-9-10-efatura", title: "Tevkifatlı e-Fatura 9/10 (602 Etüt, Plan-Proje, Danışmanlık)",
      body: { scenario: "service_sale", accountId: firmEF, lines: [{ name: "Yazılım Danışmanlığı", unit: "Saat", qty: 12, unitPrice: 1500, vatRate: 20, withholdingCode: "602" }], payment: { rest: "open" } },
      profile: "TEMELFATURA", type: "efatura", wh: { 602: [9, 10] } },
    { key: "4-dovizli-usd-efatura", title: "Dövizli e-Fatura: USD, kur 41,25 (PricingExchangeRate; TL karşılığı)",
      body: { scenario: "service_sale", accountId: firmEF, currency: "USD", rate: 41.25, lines: [{ name: "Yedek Parça Kataloğu Lisansı", unit: "Adet", qty: 2, unitPrice: 150, vatRate: 20 }, { name: "Uzaktan Destek", unit: "Saat", qty: 3, unitPrice: 40, vatRate: 20 }], payment: { rest: "open" } },
      profile: "TEMELFATURA", type: "efatura", currency: "USD", rate: 41.25 },
  ];
  const expected = sc => {
    const g = (sc.body.discountRate || 0) / 100;
    let net = 0, vat = 0, wh = 0;
    for (const l of sc.body.lines) {
      const brut = k(l.qty * l.unitPrice);
      const d1 = k(brut * (l.discountRate || 0) / 100);
      const n = k(brut - d1 - k((brut - d1) * g));
      const v = k(n * l.vatRate / 100);
      const [p, q] = sc.wh?.[l.withholdingCode] || [0, 1];
      net += n; vat += v; wh += k(v * p / q);
    }
    return { net: k(net), vat: k(vat), wh: k(wh), payable: k(net + vat - wh) };
  };
  const docs = [];
  for (const sc of SCENARIOS) {
    console.log(`\n■ ${sc.title}`);
    const body = { ...sc.body, accountId: typeof sc.body.accountId === "function" ? sc.body.accountId() : sc.body.accountId };
    const doc = await post("/api/workspace/invoices", body);
    if (!check(doc.status === 200, `kayıt ${doc.status} ${doc.status === 200 ? doc.data.number : JSON.stringify(doc.data)}`)) continue;
    const xml = String((await api.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
    writeFileSync(path.join(OUT, `${sc.key}.json`), JSON.stringify(body, null, 2));
    writeFileSync(path.join(OUT, `${sc.key}.xml`), xml);
    const v = await validateInvoice(xml, { type: sc.type });
    check(v.xsd.length === 0 && v.schematron.length === 0, `UBL 2.1 XSD + GİB şematronu: xsd ${v.xsd.length}, gib ${JSON.stringify(v.schematron.map(e => e.text))}`);
    check(new RegExp(`<cbc:ProfileID>${sc.profile}</cbc:ProfileID>`).test(xml), `ProfileID ${sc.profile}`);
    const e = expected(sc);
    const got = { net: xmlNum(xml, "TaxExclusiveAmount"), payable: xmlNum(xml, "PayableAmount") };
    check(Math.abs(got.net - e.net) < 0.005 && Math.abs(got.payable - e.payable) < 0.005, `tutarlar (bağımsız hesap): matrah ${e.net} / ödenecek ${e.payable} ↔ XML ${got.net} / ${got.payable}`);
    if (sc.wh) check(/<cac:WithholdingTaxTotal>/.test(xml) && /<cbc:InvoiceTypeCode>TEVKIFAT</.test(xml), `tevkifat düğümü + tip TEVKIFAT (tevkif edilen ${e.wh})`);
    if (sc.body.discountRate || sc.body.lines.some(l => l.discountRate)) check(/<cac:AllowanceCharge>/.test(xml), "iskonto düğümü (AllowanceCharge)");
    if (sc.currency) check(new RegExp(`<cbc:DocumentCurrencyCode>${sc.currency}<`).test(xml) && /<cac:PricingExchangeRate>/.test(xml) && new RegExp(`<cbc:CalculationRate>${sc.rate}`).test(xml), `döviz: DocumentCurrencyCode ${sc.currency}, PricingExchangeRate kur ${sc.rate}`);
    const sent = await post(`/api/workspace/invoices/${doc.data.id}/send`, {});
    const row = (await get(`/api/workspace/invoices/${doc.data.id}`)).data;
    check(sent.status === 200, `EDM SendInvoice: ${sent.status} ${sent.data?.eMessage || sent.data?.error || ""}`);
    docs.push({ sc, id: doc.data.id, number: row.number, ettn: row.ettn, expected: e });
  }
  console.log("\n■ Durum Sorgula (GetInvoiceStatus) — son duruma kadar");
  for (let round = 1; round <= 16; round += 1) {
    let open = 0;
    for (const d of docs) {
      const r = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
      d.eStatus = r.data?.eStatus; d.eMessage = r.data?.eMessage || r.data?.error || "";
      if (d.eStatus === "processing") open += 1;
    }
    log(`tur ${round}`, docs.map(d => `${d.number}:${d.eStatus}`).join(" "));
    if (!open) break;
    await sleep(40_000);
  }
  for (const d of docs) {
    check(["sent", "accepted"].includes(d.eStatus), `${d.number} (${d.sc.key}) son durum: ${d.eStatus} — ${d.eMessage.slice(0, 120)}`);
    results.push({ senaryo: d.sc.key, no: d.number, ettn: d.ettn, durum: d.eStatus, ileti: d.eMessage, beklenen: d.expected });
  }

  // ---------- 5 (a): programın gönderimden ÖNCE durdurdukları ----------
  console.log("\n■ 5a Programın kendi denetimi (EDM'ye hiç gitmez)");
  // Not: 1234567890 algoritmaya göre GEÇERLİ bir VKN'dir (ilk koşuda yanlış örnek seçilmişti); geçersiz örnek 1234567891.
  const bad = await post("/api/workspace/accounts", { name: "Hatalı VKN Ltd.", type: "customer", taxNo: "1234567891" });
  check(bad.status === 400, `geçersiz VKN (sağlama hanesi) cari: ${bad.status} — ${bad.data?.error}`);
  const badT = await post("/api/workspace/accounts", { name: "Hatalı TCKN", type: "customer", partyKind: "person", taxNo: "12345678901" });
  check(badT.status === 400, `geçersiz TCKN: ${badT.status} — ${badT.data?.error}`);
  const noVat = await post("/api/workspace/invoices", { scenario: "service_sale", accountId: firmEF, lines: [{ name: "KDV'siz", qty: 1, unitPrice: 100, vatRate: 7 }], payment: { rest: "open" } });
  check(noVat.status === 400, `geçersiz KDV oranı (%7): ${noVat.status} — ${noVat.data?.error}`);
  results.push({ senaryo: "5a-program", vkn: bad.data?.error, tckn: badT.data?.error, kdv: noVat.data?.error });

  // ---------- 5 (b): programı atlayıp bozulmuş XML'i doğrudan EDM'ye (SOAP Fault yakalama) ----------
  console.log("\n■ 5b Bozulmuş XML doğrudan EDM'ye (SendInvoice) — SOAP Fault");
  resetEdmCaches();
  const client = createEdmClient({ baseUrl: EDM_TEST, username, password });
  const base = readFileSync(path.join(OUT, "3b-tevkifat-9-10-efatura.xml"), "utf8");
  const oldUuid = base.match(/<cbc:UUID>([^<]+)</)[1];
  const oldId = base.match(/<cbc:ID>(TEF\d+)<\/cbc:ID>/)[1];
  const FAULTS = [
    ["alıcı VKN geçerli ama e-Fatura mükellefi değil (1234567890)", xml => xml.replace(/(<cac:AccountingCustomerParty>[\s\S]*?<cbc:ID schemeID="VKN">)\d+/, "$11234567890"), { receiverVkn: "1234567890" }],
    ["alıcı VKN boş", xml => xml.replace(/(<cac:AccountingCustomerParty>[\s\S]*?<cbc:ID schemeID="VKN">)\d+/, "$1"), {}],
    ["e-Fatura alıcısı TCKN 11111111111", xml => xml.replace(/(<cac:AccountingCustomerParty>[\s\S]*?<cbc:ID schemeID=")VKN(">)\d+/, "$1TCKN$211111111111"), { receiverVkn: "11111111111" }],
    ["ölçü birimi boş (unitCode=\"\")", xml => xml.replace(/unitCode="[^"]*"/g, 'unitCode=""'), {}],
    ["KDV toplamı yok (TaxTotal silindi)", xml => xml.replace(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g, ""), {}],
    ["geçersiz posta kutusu (PK)", xml => xml, { receiverAlias: "urn:mail:yokboyle@ornek.com.tr" }],
  ];
  for (const [label, mutate, over] of FAULTS) {
    const uuid = randomUUID();
    const number = `TEF${year}${String(900000000 + Math.floor(Math.random() * 99999999)).slice(0, 9)}`;
    const xml = mutate(base.split(oldUuid).join(uuid).split(oldId).join(number));
    const args = { xml, number, uuid, senderVkn: VKN, senderAlias: GB, receiverVkn: VKN, receiverAlias: PK, ...over };
    try {
      const r = await client.send(args);
      // EDM bazı hataları SendInvoice'ta değil, işlerken (GetInvoiceStatus) verir.
      let st = null;
      for (let i = 0; i < 6; i += 1) { await sleep(20_000); st = await client.status({ uuid, number, earchive: false }).catch(error => ({ status: "hata", message: error.message })); if (st.status !== "processing") break; }
      results.push({ senaryo: `5b ${label}`, gonderim: "KABUL", uuidEsit: r.uuid === uuid, durum: st?.status, ileti: st?.message });
      log(`5b ${label}`, { SendInvoice: "kabul", uuidEsit: r.uuid === uuid, sonDurum: st?.status, ileti: st?.message });
    } catch (error) {
      results.push({ senaryo: `5b ${label}`, gonderim: "SOAP Fault", edmKodu: error.integratorCode || error.extra?.integratorCode || "", programKodu: error.code, ileti: error.message });
      log(`5b ${label}`, { SOAPFault: true, edmKodu: error.integratorCode || error.extra?.integratorCode || "", programKodu: error.code, ileti: String(error.message).slice(0, 200) });
    }
  }
} catch (error) {
  log("HATA", String(error?.stack || error).slice(0, 900));
  fail += 1;
} finally {
  writeFileSync(path.join(OUT, "sonuc.json"), mask(JSON.stringify(results, null, 1)));
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  await server.close();
}
