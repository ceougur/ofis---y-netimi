// EDM TEST ortamı: hiç gönderilmemiş (rastgele) ETTN için GetInvoiceStatus ne döner? (Y3: belirsiz gönderim sonrası "EDM'de yok" ayrımı)
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const R = "/home/user/ofis---y-netimi";
const { createEdmClient, resetEdmCaches } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = s => String(s).split(password).join("***").split(username).join("<kullanıcı>");
resetEdmCaches();
const client = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password });
for (const earchive of [false, true]) {
  const uuid = randomUUID();
  try {
    const r = await client.status({ uuid, number: "", earchive });
    console.log(earchive ? "e-Arşiv" : "e-Fatura", "YANIT:", mask(JSON.stringify(r)));
  } catch (e) { console.log(earchive ? "e-Arşiv" : "e-Fatura", "HATA:", e.code, e.status, mask(e.message).slice(0, 400)); }
}
