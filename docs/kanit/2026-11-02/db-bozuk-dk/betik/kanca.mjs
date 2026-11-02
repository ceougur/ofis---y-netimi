// Dar kontrol: T-Kbozuk / T-Kbozuk-yabancı akışında (WhatsApp kancası, bozuk 002 dosyası) testin rmSync'inden hemen önce açık tutamak sayısı.
// Kullanım: node kanca.mjs <depo kökü> <bozuk|yabanci|kilit>
import { existsSync, readdirSync, readlinkSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const [root, mode] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { PNID, TOKEN, URLS, WABA, startWa } = await imp("test/whatsapp-248-ortak.mjs");
const { resolveDbPath } = await imp("server/lib/db-path.mjs");
const TEL = "905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const fds = file => {
  let open = 0;
  for (const fd of readdirSync("/proc/self/fd")) {
    try {
      if (readlinkSync(`/proc/self/fd/${fd}`).startsWith(file)) open += 1;
    } catch {}
  }
  return open;
};
const out = { mode };
const ctx = await startWa({ maxCompanies: 2, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
try {
  const created = await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false });
  const company = created.data.data.company || created.data.data;
  const q = `?hofCompany=${encodeURIComponent(company.id)}`;
  await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
  await ctx.api.put(`${URLS.ack}${q}`, { ack: true });
  const p = (await ctx.api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" })).data.data;
  const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
  ctx.server.app.mobileRemote.setPublicUrl("http://ofis-t.destekofis.test");
  await ctx.server.app.context.whatsapp.connection.registerHook(null, "http://ofis-t.destekofis.test");
  const secret = new URL(ctx.fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
  const ts = () => String(Math.floor(ctx.clock().getTime() / 1000));
  const post = statuses =>
    new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] }));
      const req = http.request(`http://127.0.0.1:${remote.port}/wa/kanca/${secret}`, { method: "POST", headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.end(payload);
    });
  const batch = await ctx.api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [p.id], preset: "thisMonth" });
  const batchId = batch.data.data.batch.id;
  await ctx.drain();
  const job = (await ctx.api.get(`${URLS.batches}/${batchId}${q}`)).data.data.jobs[0];
  out.onKosul = job.state;
  await ctx.server.app.context.closeCompany(company.id);
  const dir = path.join(ctx.server.app.config.dataDir, "sirketler");
  const file = resolveDbPath(path.join(dir, readdirSync(dir)[0]));
  const moved = [];
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) (renameSync(file + suffix, `${file + suffix}.yok`), moved.push(file + suffix));
  if (mode === "kilit") {
    for (const name of moved) renameSync(`${name}.yok`, name);
    const lock = new DatabaseSync(file);
    lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
    try {
      out.durum = [await post([{ id: job.wamid, status: "delivered", timestamp: ts(), recipient_id: TEL }])];
    } finally {
      lock.exec("ROLLBACK");
      lock.close();
    }
    out.kilit_kalkinca_tutamak = fds(file);
  } else {
    writeFileSync(file, "bu bir veri tabanı değil — bozuk dosya ".repeat(200));
    if (mode === "bozuk") out.durum = [await post([{ id: job.wamid, status: "delivered", timestamp: ts(), recipient_id: TEL }])];
    else {
      ctx.clock.advance(6 * 60_000);
      out.durum = [];
      for (let i = 0; i < 3; i += 1) {
        out.durum.push(await post([{ id: `wamid.YABANCI-B${i}`, status: "delivered", timestamp: ts(), recipient_id: TEL }]));
        ctx.clock.advance(10 * 60_000);
      }
    }
    await ctx.server.app.context.closeCompany(company.id);
    out.rmSync_oncesi_tutamak = fds(file);
  }
} catch (error) {
  out.hata = error.stack;
} finally {
  await ctx.close().catch(e => (out.kapanis = e.message));
}
console.log(JSON.stringify(out));
