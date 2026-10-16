// Gerçek EDM test ortamı: hangi UN/ECE birim kodlarını kabul ediyor? Programın ürettiği gerçek bir e-Fatura XML'i (son-hal TEF…272) alınır,
// ETTN/numara yenilenir, bütün kalemlerin unitCode'u adaya çevrilir, LoadInvoice (portala TASLAK; GİB'e gitmez) ya da SendInvoice ile denenir.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const R = "/home/user/ofis---y-netimi";
const { createEdmClient, resetEdmCaches } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = s => String(s).split(password).join("***").split(username).join("<kullanıcı>");
const mode = process.argv[3]; // "taslak" | "gonder"
const codes = process.argv.slice(4);
const base = readFileSync(process.argv[2].replace(/.*/, "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/edm-canli-test/son-hal/TEF2026481687272.xml"), "utf8");
resetEdmCaches();
const client = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password });
const oldUuid = base.match(/<cbc:UUID>([^<]+)<\/cbc:UUID>/)[1];
const oldId = base.match(/<cbc:ID>(TEF\d+)<\/cbc:ID>/)[1];
for (const code of codes) {
  const uuid = randomUUID();
  const number = `TEF2026${String(900000000 + Math.floor(Math.random() * 99999999)).slice(0, 9)}`;
  const xml = base.split(oldUuid).join(uuid).split(oldId).join(number).replace(/unitCode="[^"]*"/g, `unitCode="${code}"`);
  const args = { xml, number, uuid, senderVkn: "3230512384", senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", receiverVkn: "3230512384", receiverAlias: "urn:mail:defaultpk@edmbilisim.com.tr" };
  try {
    const r = mode === "gonder" ? await client.send(args) : await client.loadDraft(args);
    console.log(code, "KABUL", number, r.status);
  } catch (e) {
    console.log(code, "RED", number, e.extra?.integratorCode || e.integratorCode || e.code, mask(e.message).slice(0, 160));
  }
}
