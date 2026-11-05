// Dar kontrol W1W2 tur 1 — betik E: ortak WABA kaydı ESKİ kalırsa (silme DIŞI yol: ikinci şirket bağlantısız bir yedekten GERİ YÜKLENDİ).
// 001'in Kaldır'ı Meta'daki aboneliği siliyor mu (DELETE subscribed_apps sayısı), ileti ne diyor; 002'de bağlantı var mı.
const ROOT = process.env.ROOT;
const { PNID, TOKEN, URLS, WABA, startWa } = await import(`${ROOT}/test/whatsapp-248-ortak.mjs`);
const { ADMIN_PASSWORD } = await import(`${ROOT}/test/helpers.mjs`);
const out = {};
const ctx = await startWa({ now: { time: "2026-11-05T10:00:00+03:00", fixed: true } });
const body = res => res.data?.data ?? res.data;
try {
  const created = body(await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
  const company = created.company || created;
  const q = `?hofCompany=${encodeURIComponent(company.id)}`;
  // 002'nin bağlantısız yedeği
  const bk = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id });
  out.backup = bk.status;
  const name = body(bk).backups[0].name;
  // 002 aynı WABA'ya bağlanır
  out.connect002 = (await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status;
  // 002 bağlantısız yedekten geri yüklenir
  const code = body(await ctx.api.get("/api/companies")).companies.find(item => item.id === company.id)?.code;
  const rs = await ctx.api.post("/api/admin/backups/restore", { name, company: company.id, confirm: code, password: ADMIN_PASSWORD });
  out.restore = [rs.status, rs.status === 200 ? "" : JSON.stringify(rs.data).slice(0, 200)];
  out.registry002 = ctx.wa.registry.get(company.id)?.configured;
  // 001 Kaldır
  const before = ctx.fake.requests.filter(r => r.method === "DELETE" && /\/subscribed_apps$/.test(r.path)).length;
  const rm = await ctx.api.del(URLS.conn);
  const rmBody = rm.data?.data ?? rm.data;
  out.remove001 = [rm.status, rmBody?.removal?.meta?.state, rmBody?.removal?.meta?.reason, (rmBody?.removal?.meta?.message || "").slice(0, 160)];
  out.metaDeletes = ctx.fake.requests.filter(r => r.method === "DELETE" && /\/subscribed_apps$/.test(r.path)).length - before;
  // 002'de bağlantı var mı (kullanıcının "o şirkette de Kaldır" demesi yapılabilir mi)
  const v2 = body(await ctx.api.get(`${URLS.conn}${q}`));
  out.conn002 = v2.configured;
  out.registry002After = ctx.wa.registry.get(company.id)?.configured;
} catch (e) {
  out.error = String(e?.stack || e);
} finally {
  await ctx.close();
}
console.log(JSON.stringify(out));
