// Tümünü Gönder belge başı süre — iki kodda AYNI sayıda belge (HEDEF) gönderilene dek istek yinelenir (yeni kod 20'lik parçalar, eski kod 200'lük).
// WAL denetim noktası gibi tek seferlik maliyetler iki kodda aynı belge sayısına bölünür. Kullanım: node tur-esit.mjs <kök> <N> <HEDEF>
const [root, nArg = "1500", goalArg = "600"] = process.argv.slice(2);
const { setup } = await import(`${process.env.ORTAK}`);
const ctx = await setup(root);
try {
  const retail = (await ctx.api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Perakende", familyName: "Müşteri", taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" })).data.id;
  const N = Number(nArg);
  for (let i = 0; i < N; i += 1) await ctx.sale(retail, { issueDate: ctx.day(-30 + Math.floor((i * 30) / N)), eSend: "later" });
  const t = Date.now(); // saat: gerçek (süre ölçümü)
  let sent = 0;
  let cursor = null;
  let requests = 0;
  while (sent < Number(goalArg)) {
    const r = (await ctx.api.post("/api/workspace/invoices/send-pending", cursor ? { all: true, after: cursor } : { all: true })).data;
    requests += 1;
    sent += r.sent;
    cursor = r.cursor || null;
    if (!r.sent) break;
  }
  const took = Date.now() - t; // saat: gerçek (süre ölçümü)
  console.log(`N=${N} gönderilen ${sent} (${requests} istek) süre ${took} ms, belge başı ${(took / sent).toFixed(1)} ms`);
} finally { await ctx.close(); }
