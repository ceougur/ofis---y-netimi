// Dar kontrol W1W2 tur 1 — betik A (W TUR 2 kopyası, CODE env): Meta kod (ileti isteğinde) → Duraklatıldı → yeniden bağlan → ikinci toplu iş aynı kişiyle → Devam Et.
// Kişi başına Meta'nın kabul ettiği ileti sayısı, Bu Ay, 24 saat penceresi. ROOT: kodun kökü (yeni / eski kopya).
const ROOT = process.env.ROOT;
const { PNID, TOKEN, URLS, WABA, startWa } = await import(`${ROOT}/test/whatsapp-248-ortak.mjs`);
const metaError = (code, message, subcode = null) => ({ error: { message, type: "OAuthException", code, ...(subcode ? { error_subcode: subcode } : {}), fbtrace_id: "AbCd" } });
const T0 = Date.parse("2026-11-05T10:00:00+03:00");
const out = {};
const per = ctx => ctx.messages().reduce((o, m) => ({ ...o, [m.to]: (o[m.to] || 0) + 1 }), {});
const ctx = await startWa({ now: { time: new Date(T0).toISOString(), fixed: true } });
try {
  const sina = await ctx.api.post(`${URLS.conn}/test`, {});
  out.sina = sina.status;
  const acc = [];
  for (const [n, p] of [["Ali", "0532 811 00 01"], ["Berk", "0532 811 00 02"], ["Cem", "0532 811 00 03"], ["Deniz", "0532 811 00 04"]]) acc.push(await ctx.account(n, p, 100));
  const [A, B, C, D] = acc;
  const b1 = await ctx.api.post(URLS.batches, { kind: "statement", ids: [A.id, B.id, C.id], preset: "thisMonth" });
  out.b1 = b1.status;
  const id1 = b1.data.data.batch.id;
  await ctx.drain({ max: 1 }); // A gider
  // B'nin ileti isteği 190 alır (belirteç Meta'da iptal edildi).
  // STAGE=send: ileti isteği 190; STAGE=media: PDF yükleme 190 (belirteç Meta'da iptal edildi; sonraki istekler engelle zaten gitmez).
  const STAGE = process.env.STAGE || "send";
  ctx.fake.state.failQueue.push({ match: STAGE === "media" ? /^POST \/\d+\/media$/ : /^POST \/\d+\/messages$/, status: 401, body: metaError(Number(process.env.CODE ?? 190), "We were unable to authenticate the app user.") });
  await ctx.drain();
  out.stage = STAGE; out.reqsAfter = ctx.fake.requests.map(r => `${r.method} ${r.path}`); out.tokenExpiry = (await ctx.api.get(URLS.conn)).data.data.tokenExpiry; out.audit = ctx.store.all("SELECT type FROM audit_events WHERE type LIKE 'whatsapp.token%'").length;
  out.failQueueLeft = ctx.fake.state.failQueue.length;
  let d1 = await ctx.detail(id1);
  out.afterFail = { state: d1.state, pauseCode: d1.pauseCode, jobs: d1.jobs.map(j => `${j.accountName}:${j.state}:${j.errorCode ?? ""}`), msgs: per(ctx) };
  // Yeni toplu iş (bağlantı Süresi Doldu) — reddedilmeli
  const refused = await ctx.api.post(URLS.batches, { kind: "statement", ids: [B.id, D.id], preset: "thisMonth" });
  out.newWhileExpired = [refused.status, refused.data?.code];
  // Yeniden bağlan: yeni belirteç (Bilgileri Değiştir).
  const NEW = "SAHTE-yeni-belirtec-0123456789-abcdef";
  ctx.fake.set({ token: NEW });
  const put = await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW });
  out.reconnect = put.status;
  // İkinci toplu iş: B (birinci işte Duraklatıldı) ve D
  const prev = await ctx.api.post(URLS.preview, { kind: "statement", ids: [B.id, D.id], preset: "thisMonth" });
  out.preview2 = prev.status === 200 ? (prev.data.data.people || prev.data.data.rows || []).map(p => `${p.name || p.accountName}:${p.skip || "gönderilir"}`) : [prev.status, prev.data?.code];
  const b2 = await ctx.api.post(URLS.batches, { kind: "statement", ids: [B.id, D.id], preset: "thisMonth" });
  out.b2 = [b2.status, b2.data?.data?.summary ? JSON.stringify(b2.data.data.summary) : b2.data?.code];
  const id2 = b2.data?.data?.batch?.id;
  await ctx.drain();
  if (id2) { const d2 = await ctx.detail(id2); out.b2jobs = d2.jobs.map(j => `${j.accountName}:${j.state}:${j.errorCode ?? ""}:${j.skipReason || ""}:${j.errorText || ""}`); out.b2pause = [d2.state, d2.pauseCode, d2.pauseReason]; out.lastReqs = ctx.fake.requests.slice(-6).map(r => `${r.method} ${r.path} ${r.auth.slice(-8)}`); }
  // Birinci işte Devam Et
  const res = await ctx.api.post(`${URLS.batches}/${id1}/resume`, {});
  out.resume = [res.status, res.data?.code, res.data?.error];
  await ctx.drain();
  d1 = await ctx.detail(id1);
  out.final1 = { state: d1.state, jobs: d1.jobs.map(j => `${j.accountName}:${j.state}:${j.errorCode ?? ""}:${j.skipReason || ""}`) };
  out.msgsPerPerson = per(ctx);
  out.messageRequests = ctx.messageRequests().length;
  out.window = ctx.server.app.whatsapp.ledger.windowUsage(WABA, new Date(T0 - 86_400_000).toISOString());
  out.window = { count: out.window.count, phones: [...(out.window.phones || [])].length };
  // Başarısızları Yeniden Dene (Başarısız yoksa 400) → ileti sayısı değişmemeli
  const rf = await ctx.api.post(`${URLS.batches}/${id1}/retry-failed`, {});
  await ctx.drain();
  out.retryFailed = [rf.status, rf.data?.code];
  out.msgsAfterRetry = per(ctx);
} catch (e) {
  out.error = String(e?.stack || e);
} finally {
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
