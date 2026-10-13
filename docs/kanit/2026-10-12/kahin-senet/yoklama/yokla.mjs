// Kara kutu yoklama (geçici; depoya girmez): programı test sunucusuyla başlatır, stdin'deki istek listesini sırayla gönderir,
// yanıtları yazar. Program kodu okunmaz; yalnız HTTP yanıtı.
import { readFileSync } from "node:fs";
import { ADMIN_PASSWORD, startTestServer } from "../../../../../test/helpers.mjs";
const steps = JSON.parse(readFileSync(0, "utf8"));
const server = await startTestServer({ now: { time: "2026-10-12" } });
const c = server.client();
await c.login("admin", ADMIN_PASSWORD);
const ids = {};
const sub = s => JSON.parse(JSON.stringify(s).replace(/\$([A-Za-z0-9_]+)/g, (_, k) => ids[k] ?? `$${k}`));
try {
  for (const raw of steps) {
    const s = sub(raw);
    const r = s.m === "GET" ? await c.get(s.u) : s.m === "DELETE" ? await c.del(s.u) : s.m === "PUT" ? await c.put(s.u, s.b) : await c.post(s.u, s.b);
    if (s.as && r.data?.data?.id) ids[s.as] = r.data.data.id;
    const txt = JSON.stringify(r.data);
    console.log(`${s.m} ${s.u} → ${r.status} ${txt.length > (s.max || 700) ? txt.slice(0, s.max || 700) + "…" : txt}`);
  }
} finally { await server.close(); }
