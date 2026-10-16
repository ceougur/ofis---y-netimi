// EDM TEST: daha önce gönderilen iki belgenin resmî PDF'i (GetInvoice DIRECTION=OUT, INVOICE_CONTENT_TYPE=PDF). Program kendi vekil modülünden
// (HTTPS_PROXY ortam değişkeni) çıkar. Kimlik bilgisi yalnız yüklenen dosyadan; çıktıda maskelenir.
import { readFileSync, writeFileSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { createEdmClient, resetEdmCaches } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const { createProxyFetch, cachedResolver } = await import(`${R}/server/lib/net-proxy.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = v => String(v ?? "").split(password).join("***").split(username).join("<kullanıcı>");
resetEdmCaches();
const fetchImpl = createProxyFetch({ resolve: cachedResolver({ file: "" }) });
const client = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password, fetchImpl });
for (const [number, uuid] of [["DOF2026596432372", "63bade0b-52a8-4b2b-b24d-ca17f239f146"], ["DOA2026596432372", "794b98bc-0dc3-4fcb-a6e1-be6e61fb243c"]]) {
  try {
    const pdf = await client.officialPdf({ uuid, number });
    const out = `${process.argv[3]}/${number}-resmi.pdf`;
    writeFileSync(out, pdf.data);
    console.log(`${number}: PDF ${pdf.data.length} bayt → ${out}`);
  } catch (e) { console.log(`${number}: HATA ${e.code} ${mask(e.message).slice(0, 300)} ${mask(e.extra?.detail || e.detail || "").slice(0, 300)}`); }
}
