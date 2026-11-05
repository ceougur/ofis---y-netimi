// Dar kontrol W1W2 tur 1 — betik G (ilke 5): 190 alan kişi Bekliyor'a döndü (toplu iş Duraklatıldı) → o anda YEDEK → yeniden bağlan + Devam Et (B, C gider) →
// yedek GERİ YÜKLENİR (001, açılışta) → eski toplu iş ne oluyor, Devam Et, yeni toplu iş: kişi başına ileti.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const ROOT = process.env.ROOT;
const { PNID, WABA, URLS, startWa } = await import(`${ROOT}/test/whatsapp-248-ortak.mjs`);
const { ADMIN_PASSWORD } = await import(`${ROOT}/test/helpers.mjs`);
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, fbtrace_id: "AbCd" } });
const NOW = { time: "2026-11-05T10:00:00+03:00", fixed: true };
const out = {};
const root = mkdtempSync(path.join(tmpdir(), "wt2-g-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
let ctx = await startWa({ dataDir, backupDir, now: NOW });
const fake = ctx.fake;
const per = () => fake.state.messages.reduce((o, m) => ({ ...o, [m.to]: (o[m.to] || 0) + 1 }), {});
try {
  await ctx.api.post(`${URLS.conn}/test`, {});
  const ids = [];
  for (const [n, p] of [["Ali", "0532 844 00 01"], ["Berk", "0532 844 00 02"], ["Cem", "0532 844 00 03"]]) ids.push((await ctx.account(n, p, 100)).id);
  const id1 = (await ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
  await ctx.drain({ max: 1 });
  fake.state.failQueue.push({ match: /^POST \/\d+\/messages$/, status: 401, body: metaError(Number(process.env.CODE ?? 190), "We were unable to authenticate the app user.") });
  await ctx.drain();
  out.after190 = (await ctx.jobs(id1)).map(j => `${j.accountName}:${j.state}`);
  const backup = (await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" })).data.data.backups[0].name;
  const NEW = "SAHTE-yeni-belirtec-G-0123456789";
  fake.set({ token: NEW });
  out.reconnect = (await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW })).status;
  out.resume = (await ctx.api.post(`${URLS.batches}/${id1}/resume`, {})).status;
  await ctx.drain();
  out.beforeRestore = { jobs: (await ctx.jobs(id1)).map(j => `${j.accountName}:${j.state}`), msgs: per() };
  const staged = await ctx.api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
  out.staged = [staged.status, staged.data?.data?.staged];
  await ctx.server.close();
  ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false, now: NOW });
  const d = await ctx.detail(id1);
  out.afterRestore = { state: d.state, pauseCode: d.pauseCode, jobs: d.jobs.map(j => `${j.accountName}:${j.state}`), tokenExpiry: (await ctx.api.get(URLS.conn)).data.data.tokenExpiry?.state };
  out.resumeAfterRestore = (await ctx.api.post(`${URLS.batches}/${id1}/resume`, {})).status;
  await ctx.drain();
  // Geri yüklenen dosyada bağlantı Süresi Doldu (yedek o anda alındı) → yeniden bağlan, yeni toplu iş
  out.reconnect2 = (await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW })).status;
  const pv = await ctx.api.post(URLS.preview, { kind: "statement", ids, preset: "thisMonth" });
  out.preview = pv.status === 200 ? (pv.data.data.people || []).map(p => `${p.name}:${p.skip || "gönderilir"}${p.sentBefore ? ":sentBefore" : ""}`) : [pv.status, pv.data?.code];
  const b2 = await ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
  out.b2 = [b2.status, b2.data?.code || JSON.stringify(b2.data?.data?.summary?.skipped)];
  await ctx.drain();
  if (b2.status === 200) out.b2jobs = (await ctx.jobs(b2.data.data.batch.id)).map(j => `${j.accountName}:${j.state}:${j.reason || ""}`);
  out.final = per();
} catch (e) {
  out.error = String(e?.stack || e);
} finally {
  await ctx.server.close();
  await fake.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify(out));
