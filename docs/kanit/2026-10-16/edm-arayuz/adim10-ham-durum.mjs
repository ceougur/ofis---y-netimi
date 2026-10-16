// EDM TEST ORTAMI: belgelerin HAM GetInvoiceStatus yanıtı (eşleme boşluğu: Ticari fatura "WAIT_APPLICATION_RESPONSE" iki koşuda iki farklı eşlendi).
import { readFileSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { createEdmClient, resetEdmCaches } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = s => String(s).split(password).join("***").split(username).join("<kullanıcı>");
resetEdmCaches();
let lastBody = "";
const fetchImpl = async (url, init) => { const r = await fetch(url, init); const body = await r.text(); if (/GetInvoiceStatusRequest/.test(String(init?.body || ""))) lastBody = body; return new Response(body, { status: r.status, headers: r.headers }); };
const client = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password, fetchImpl });
for (const [label, uuid, number] of process.argv.slice(3).map(x => x.split(":"))) {
  try {
    const r = await client.status({ uuid, number, earchive: false });
    const st = (lastBody.match(/<INVOICE_STATUS[\s\S]*?<\/INVOICE_STATUS>/) || [""])[0];
    console.log(label, "EŞLEME:", mask(JSON.stringify(r)), "\n  HAM:", mask(st.replace(/\s+/g, " ")).slice(0, 700));
  } catch (e) { console.log(label, "HATA", e.code, mask(e.message).slice(0, 300)); }
}
