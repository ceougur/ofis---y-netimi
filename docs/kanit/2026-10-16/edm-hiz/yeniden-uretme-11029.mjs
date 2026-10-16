// Stres testi 11029 (şema hatası) yeniden üretme: aynı 1.000 belge, 60 eşzamanlı, sahte EDM 2–12 sn gecikmeli; EDM'ye giden HER XML UBL 2.1 XSD ile denetlenir.
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { startMockEdm, OUR_VKN, BUYER_VKN } = await import(`${R}/test/einvoice-mock.mjs`);
const { validateInvoice } = await import(`${R}/tools/ebelge/dogrula.mjs`);
const { writeFileSync, mkdirSync } = await import("node:fs");
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const N = Number(process.argv[3] || 1000);
const edm = await startMockEdm();
const bad = [];
let checked = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fetchImpl = async (input, init) => {
  const body = String(init?.body || "");
  if (/SendInvoiceRequest/.test(body)) {
    const content = (body.match(/<[^>]*CONTENT[^>]*>([^<]+)</) || [])[1];
    if (content) {
      const xml = Buffer.from(content, "base64").toString("utf8");
      const v = await validateInvoice(xml, { type: /EARSIVFATURA/.test(xml) ? "earsiv" : "efatura" });
      checked += 1;
      if (v.xsd.length) { bad.push({ id: (xml.match(/<cbc:ID>([^<]+)</) || [])[1], xsd: v.xsd.slice(0, 3) }); writeFileSync(`${OUT}/bozuk-${bad.length}.xml`, xml); }
    }
    await sleep(2000 + Math.random() * 10000);
  }
  return globalThis.fetch(input, init);
};
const server = await startTestServer({ edocEnabled: true, gateVerify: false, moneyStrict: false, fetchImpl, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const un = r => ({ ...r, data: r.data && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
await c.put("/api/workspace/invoices/settings", { seller: { name: "DESTEK OFİS", taxNo: OUR_VKN, taxOffice: "Kadıköy", address: "Moda Cd. 12", district: "Kadıköy", city: "İstanbul" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
const firm = un(await c.post("/api/workspace/accounts", { name: "DESTEK OFİS", type: "customer", taxNo: BUYER_VKN, taxOffice: "Merkez", address: "Cd. 1", district: "Merkez", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" })).data.id;
const person = un(await c.post("/api/workspace/accounts", { name: "DESTEK OFİS Bireysel", type: "customer", partyKind: "person", firstName: "Destek", familyName: "Ofis", taxNo: "10000000146", address: "Moda 1", district: "Kadıköy", city: "İstanbul" })).data.id;
const ITEMS = [["Yazılım Lisansı", 1500, 20], ["Kurulum Hizmeti", 750, 20], ["Eğitim", 400, 10], ["Kırtasiye", 85.5, 20], ["Kitap", 120, 1]];
const specOf = n => ({ efatura: n % 2 === 0, lines: Array.from({ length: 1 + (n % 3) }, (_, i) => { const [name, price, vat] = ITEMS[(n + i) % ITEMS.length]; return { name: `${name} ${n}`, qty: 1 + ((n + i) % 4), unitPrice: price, vatRate: vat }; }) });
let inflight = 0, done = 0, failed = [];
const jobs = [];
const t0 = Date.now();
for (let n = 1; n <= N; n += 1) {
  while (inflight >= 60) await sleep(5);
  inflight += 1;
  const spec = specOf(n);
  jobs.push(c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: spec.efatura ? firm : person, lines: spec.lines, payment: { rest: "open" }, eSend: "now" }).then(un).then(r => { if (r.status !== 200 || r.data?.autoSend?.ok !== true) failed.push({ n, status: r.status, msg: String(r.data?.autoSend?.message || r.data?.error || "").slice(0, 200) }); }).finally(() => { inflight -= 1; done += 1; }));
}
await Promise.all(jobs);
console.log(JSON.stringify({ belge: N, sureSn: Math.round((Date.now() - t0) / 1000), xsdDenetlenen: checked, xsdBozuk: bad.length, bozuklar: bad.slice(0, 5), gonderimHatasi: failed.length, hatalar: failed.slice(0, 5) }, null, 1));
await server.close(); await edm.close();
