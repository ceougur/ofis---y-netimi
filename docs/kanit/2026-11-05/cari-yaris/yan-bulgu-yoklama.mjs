// YAN BULGU yoklaması (kapsam dışı; DÜZELTME YOK — ana oturum karar verir): accounts.mjs'teki öbür gövdeli yazım uçlarında aynı yarış ailesi var mı?
//   Y1 POST /accounts/:id/entries — gövde yoldayken (hareketsiz) CARİ silinirse yeni hareket silinmiş cariye yazılır mı?
//   Y2 PUT  /accounts/:id         — gövde yoldayken cari silinirse güncelleme silinmiş cariye yazılır mı?
//   Y3 DELETE /accounts/:id/entries/:id — gövdesiz; işleyicide await yok (readJson çağrılmıyor) → yarış penceresi yok (kaynaktan; burada ikinci silme ölçülür).
// Koşu: HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-11-05/cari-yaris/yan-bulgu-yoklama.mjs
import http from "node:http";
import { boot, must } from "../../../../test/banka-210-ortak.mjs";

const ctx = await boot({ now: "2026-10-08T12:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const race = ({ method, path, body, during }) =>
  new Promise((resolve, reject) => {
    const text = JSON.stringify(body);
    const { port } = new URL(ctx.server.base);
    let removed = null;
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, text: data, removed }));
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      removed = await during();
      req.end(text);
    }, 300);
  });
try {
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  // Y1
  const a1 = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Yan Bulgu 1", type: "customer", registeredOn: "2026-09-01" }));
  const y1 = await race({ method: "POST", path: `/api/workspace/accounts/${a1.id}/entries`, body: { kind: "debt", amount: "100", date: "2026-10-08" }, during: () => ctx.api.del(`/api/workspace/accounts/${a1.id}`) });
  const rows1 = ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", a1.id).n;
  const deleted1 = ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", a1.id).d;
  console.log(`Y1 POST hareket (cari silinirken): cari silme ${y1.removed.status} · yanıt ${y1.status} ${y1.text.slice(0, 120)} · silinmiş cariye yazılan hareket ${rows1} · cari deleted_at ${deleted1 ? "dolu" : "boş"}`);
  // Y2
  const a2 = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Yan Bulgu 2", type: "customer", registeredOn: "2026-09-01" }));
  const auditBefore = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.updated' AND entity_id = ?", a2.id).n;
  const y2 = await race({ method: "PUT", path: `/api/workspace/accounts/${a2.id}`, body: { name: "Yan Bulgu 2 Düzeltildi" }, during: () => ctx.api.del(`/api/workspace/accounts/${a2.id}`) });
  const row2 = ctx.store.get("SELECT name, deleted_at AS d FROM accounts WHERE id = ?", a2.id);
  const auditAfter = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.updated' AND entity_id = ?", a2.id).n;
  console.log(`Y2 PUT cari (cari silinirken): cari silme ${y2.removed.status} · yanıt ${y2.status} ${y2.text.slice(0, 120)} · ad "${row2.name}" · deleted_at ${row2.d ? "dolu" : "boş"} · account.updated +${auditAfter - auditBefore}`);
  // Y3
  const a3 = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Yan Bulgu 3", type: "customer", registeredOn: "2026-09-01" }));
  const e3 = await must("borç", ctx.api.post(`/api/workspace/accounts/${a3.id}/entries`, { kind: "debt", amount: "100", date: "2026-10-08" }));
  const [d1, d2] = await Promise.all([ctx.api.del(`/api/workspace/accounts/${a3.id}/entries/${e3.entryId}`), ctx.api.del(`/api/workspace/accounts/${a3.id}/entries/${e3.entryId}`)]);
  const del3 = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.entry.deleted' AND entity_id = ?", e3.entryId).n;
  console.log(`Y3 eşzamanlı iki silme: ${d1.status} / ${d2.status} ${d2.error || d1.error || ""} · account.entry.deleted ${del3}`);
} finally {
  await ctx.server.close();
}
