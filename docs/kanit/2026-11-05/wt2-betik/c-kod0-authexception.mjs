// Dar kontrol W1W2 tur 1 — betik C: Meta belirteci 190 DIŞINDAKİ belirteç koduyla reddediyor (CODE env: 0 AuthException, 102 API Session).
// İleti isteğinde: iletisi gitmeyen kişi ne oluyor (190 kararıyla aynı mı), bağlantı Süresi Doldu oluyor mu, Devam Et kaç kişiyi Başarısız yapıyor.
const ROOT = process.env.ROOT;
const CODE = Number(process.env.CODE ?? 0);
const { URLS, startWa } = await import(`${ROOT}/test/whatsapp-248-ortak.mjs`);
const metaError = (code, message, subcode = null) => ({ error: { message, type: "OAuthException", code, ...(subcode ? { error_subcode: subcode } : {}), fbtrace_id: "AbCd" } });
const T0 = Date.parse("2026-11-05T10:00:00+03:00");
const out = { code: CODE };
const per = ctx => ctx.messages().reduce((o, m) => ({ ...o, [m.to]: (o[m.to] || 0) + 1 }), {});
const ctx = await startWa({ now: { time: new Date(T0).toISOString(), fixed: true } });
try {
  out.sina = (await ctx.api.post(`${URLS.conn}/test`, {})).status;
  const ids = [];
  for (let i = 1; i <= 4; i += 1) ids.push((await ctx.account(`Kişi ${i}`, `0532 822 00 0${i}`, 100)).id);
  const b1 = await ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
  const id = b1.data.data.batch.id;
  await ctx.drain({ max: 1 }); // 1. kişi gider
  // Belirteç Meta'da iptal edildi: bundan sonra HER ileti isteği bu kodla reddedilir (yapışkan).
  ctx.fake.set({ failNext: { match: /^POST \/\d+\/messages$/, status: 401, body: metaError(CODE, "We were unable to authenticate the app user."), sticky: true } });
  await ctx.drain();
  let d = await ctx.detail(id);
  out.after1 = { state: d.state, pauseCode: d.pauseCode, pauseReason: d.pauseReason, jobs: d.jobs.map(j => `${j.state}:${j.errorCode ?? ""}`), tokenExpiry: (await ctx.api.get(URLS.conn)).data.data.tokenExpiry?.state };
  // Kullanıcı (yeniden bağlanmadan) Devam Et'e basar — kaç kez basabilir, her basış kaç kişiyi yakar?
  const presses = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await ctx.api.post(`${URLS.batches}/${id}/resume`, {});
    await ctx.drain();
    d = await ctx.detail(id);
    presses.push(`${r.status}:${d.state}:${d.jobs.map(j => j.state[0]).join("")}`);
  }
  out.resumePresses = presses; const dd = await ctx.detail(id); out.afterPresses = [dd.state, dd.pauseCode, dd.pauseReason];
  out.messageRequests = ctx.messageRequests().length;
  out.msgs = per(ctx);
  // Belirteç yeniden geçerli (yeniden bağlandı): Başarısızları Yeniden Dene → kişi başına ileti
  ctx.fake.set({ failNext: null });
  const rf = await ctx.api.post(`${URLS.batches}/${id}/retry-failed`, {});
  out.retryFailed = rf.status;
  await ctx.drain();
  if (d.state === "paused") {
    const r = await ctx.api.post(`${URLS.batches}/${id}/resume`, {});
    out.lastResume = r.status;
    await ctx.drain();
  }
  out.final = (await ctx.detail(id)).jobs.map(j => j.state);
  out.msgsFinal = per(ctx);
} catch (e) {
  out.error = String(e?.stack || e);
} finally {
  await ctx.close();
}
console.log(JSON.stringify(out));
