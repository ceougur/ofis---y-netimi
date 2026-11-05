// GÖZLEM yoklaması (kapsam dışı): cari hareketi düzeltmesi (PUT /accounts/:id/entries/:entryId) gövde yoldayken hareket silinirse yanıt ne?
import http from "node:http";
import { boot, must } from "../../../../test/banka-210-ortak.mjs";

const ctx = await boot({ now: "2026-10-08T12:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
try {
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  const acc = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Gözlem", type: "customer", registeredOn: "2026-09-01" }));
  for (const [label, body] of [["borç", { kind: "debt", amount: "100", date: "2026-10-08" }], ["tahsilat", { kind: "in", amount: "100", date: "2026-10-08", method: "cash" }]]) {
    const made = await must(label, ctx.api.post(`/api/workspace/accounts/${acc.id}/entries`, body));
    const auditBefore = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events").n;
    const text = JSON.stringify({ amount: "150", cashForce: true });
    const { port } = new URL(ctx.server.base);
    const reply = await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, method: "PUT", path: `/api/workspace/accounts/${acc.id}/entries/${made.entryId}`, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, text: data }));
      });
      req.on("error", reject);
      req.flushHeaders();
      setTimeout(async () => {
        const del = await ctx.api.del(`/api/workspace/accounts/${acc.id}/entries/${made.entryId}?cashForce=1`);
        console.log(`${label}: silme ${del.status}`);
        req.end(text);
      }, 300);
    });
    const auditAfter = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events").n;
    const row = ctx.store.get("SELECT 1 AS x FROM account_entries WHERE id = ?", made.entryId);
    console.log(`${label}: düzeltme yanıtı ${reply.status} ${reply.text.slice(0, 160)} · satır ${row ? "VAR" : "yok"} · audit +${auditAfter - auditBefore - 1} (silme dışı)`);
  }
} finally {
  await ctx.server.close();
}
