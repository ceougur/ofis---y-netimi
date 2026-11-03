// C1 kod ajanı — §9 "PUT cari aynı desen: yalnız denetlenir": cari bilgisi (PUT /accounts/:id) gövdesi yoldayken cari silinirse silinmiş cariye yazılıyor mu?
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node yaris-put.mjs <depo>
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
const { loginAdmin, startTestServer } = await import(pathToFileURL(path.join(repo, "test/helpers.mjs")).href);
const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
const admin = await loginAdmin(server);
const data = r => (r.data && "ok" in r.data ? r.data.data : r.data);
const account = data(await admin.post("/api/workspace/accounts", { name: "PUT Yarış Carisi", phone: "0532 000 00 01", type: "customer", registeredOn: "2026-09-01" }));
const body = JSON.stringify({ name: "PUT Yarış Carisi (değişti)", phone: "0532 999 99 99", status: "passive", waOptOut: true });
const { port } = new URL(server.base);
let removed = null;
const reply = await new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, method: "PUT", path: `/api/workspace/accounts/${account.id}`, headers: { cookie: admin.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, res => {
    let text = "";
    res.on("data", chunk => (text += chunk));
    res.on("end", () => resolve({ status: res.statusCode, text }));
  });
  req.on("error", reject);
  req.flushHeaders();
  setTimeout(async () => {
    removed = await admin.del(`/api/workspace/accounts/${account.id}`);
    req.end(body);
  }, 300);
});
console.log(JSON.stringify({ adim: "cari silindi (gövde beklerken)", status: removed?.status }));
console.log(JSON.stringify({ adim: "PUT yanıtı", status: reply.status, govde: reply.text.slice(0, 120) }));
const row = server.app.store.get("SELECT name, phone, status, wa_opt_out AS waOptOut, deleted_at IS NOT NULL AS silinmis FROM accounts WHERE id = ?", account.id);
console.log(JSON.stringify({ adim: "veri tabanı", satir: { ...row } }));
await server.close();
