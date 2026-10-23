// Salt okuma: gerçek EDM test ortamında GetSMMStatus yanıtı belgenin ETTN'ini taşıyor mu? Kimlik yalnız ortam değişkeninden; çıktıya yazılmaz.
import { createEdmSmmClient, EDM_SMM_URLS } from "/home/user/wt/r31e-e1/server/lib/einvoice/edm.mjs";
const username = process.env.EDM_TEST_KULLANICI, password = process.env.EDM_TEST_PAROLA;
if (!username || !password) throw new Error("kimlik yok");
const seen = [];
const fetchImpl = async (url, init) => {
  if (!String(url).startsWith(EDM_SMM_URLS.test)) throw new Error(`izin dışı adres: ${url}`);
  const response = await fetch(url, init);
  const text = await response.clone().text();
  const op = /GetSMMStatusResponse/.test(text) ? "GetSMMStatus" : /LoginResponse/.test(text) ? "Login" : "diğer";
  if (op === "GetSMMStatus") seen.push({ op, uuidOgesi: /<[^>]*UUID[^>]*>/i.test(text), ham: text.replace(/<SESSION_ID>[^<]*<\/SESSION_ID>/g, "<SESSION_ID>…</SESSION_ID>").slice(0, 2500) });
  return response;
};
const client = createEdmSmmClient({ baseUrl: EDM_SMM_URLS.test, username, password, env: "test", fetchImpl });
for (const [number, uuid] of [["TES2026295644872", "6cd4a435-74a7-4946-9f3a-0737deb7eaaa"], ["TES2026295644876", "b62ff951-7a65-4786-93ce-1c29d2f1c7f8"]]) {
  const r = await client.status({ number, uuid });
  console.log(JSON.stringify({ number, beklenenEttn: uuid, donenEttn: r.uuid, esit: r.uuid.toLowerCase() === uuid, status: r.status }));
}
for (const s of seen) console.log(`--- ${s.op} UUID öğesi: ${s.uuidOgesi}\n${s.ham}`);
