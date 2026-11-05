// C1 kod ajanı — YENİ BULGU denemesi (düzeltilmez, rapora): taksit kartına tahsilat isteğinin gövdesi yoldayken kart silinirse tahsilat silinmiş karta yazılıyor mu?
// (routes/plans.mjs POST /plans/:id/entries: planRow → await readJson → write, kart yeniden denetlenmez — accounts.mjs'teki §9 deseninin aynısı.)
// Ön koşulun GERÇEKTEN oluştuğu (DELETE 200, sonra gövde) görülür (ders 20). Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node yaris-kart.mjs <depo>
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
const { loginAdmin, startTestServer } = await import(pathToFileURL(path.join(repo, "test/helpers.mjs")).href);
const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
const admin = await loginAdmin(server);
const data = r => (r.data && "ok" in r.data ? r.data.data : r.data);
await admin.post("/api/workspace/bank/setup/dismiss", {});
const account = data(await admin.post("/api/workspace/accounts", { name: "Kart Yarış Carisi", type: "customer", registeredOn: "2026-09-01" }));
const plan = data(await admin.post("/api/workspace/plans", { accountId: account.id, name: "Kart Yarış", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: "2026-10-01" }));
const cashOf = async () => data(await admin.get("/api/workspace/cash")).totals.balance;
const cashBefore = await cashOf();
const body = JSON.stringify({ kind: "in", amount: "300", date: "2026-10-08", method: "cash" });
const { port } = new URL(server.base);
let removed = null;
const reply = await new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, method: "POST", path: `/api/workspace/plans/${plan.id}/entries`, headers: { cookie: admin.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, res => {
    let text = "";
    res.on("data", chunk => (text += chunk));
    res.on("end", () => resolve({ status: res.statusCode, text }));
  });
  req.on("error", reject);
  req.flushHeaders();
  setTimeout(async () => {
    removed = await admin.del(`/api/workspace/plans/${plan.id}`);
    req.end(body);
  }, 300);
});
console.log(JSON.stringify({ adim: "kart silindi (gövde beklerken)", status: removed?.status, govde: JSON.stringify(removed?.data).slice(0, 120) }));
console.log(JSON.stringify({ adim: "kart tahsilatı yanıtı", status: reply.status, govde: reply.text.slice(0, 160) }));
const rows = server.app.store.all("SELECT e.kind, e.amount, e.method, p.deleted_at IS NOT NULL AS kartSilinmis FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE e.plan_id = ?", plan.id).map(row => ({ ...row }));
console.log(JSON.stringify({ adim: "veri tabanı", satirlar: rows, kasaOnce: cashBefore, kasaSonra: await cashOf() }));
// Kart Silinenler'den geri yüklenirse tahsilat döner mi (kalıcı kayıp mı, gizli mi)?
const trash = data(await admin.get("/api/admin/trash"));
const item = trash.find(row => row.kind === "plan" && String(row.id).includes(plan.id));
const restored = item ? await admin.post("/api/admin/trash/restore", { id: item.id }) : null;
console.log(JSON.stringify({ adim: "kartı geri yükle", status: restored?.status ?? "Silinenler'de yok", kasa: await cashOf() }));
await server.close();
