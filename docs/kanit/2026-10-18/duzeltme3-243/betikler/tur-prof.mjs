// Tümünü Gönder istek başı maliyet profili: N bekleyen, 3 istek; yalnız tur sırasında CPU profili (inspector).
import { Session } from "node:inspector/promises";
import { writeFileSync } from "node:fs";
const [root, nArg = "800"] = process.argv.slice(2);
const { setup } = await import(`${process.env.ORTAK}`);
const ctx = await setup(root);
try {
  const retail = (await ctx.api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Perakende", familyName: "Müşteri", taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" })).data.id;
  for (let i = 0; i < Number(nArg); i += 1) await ctx.sale(retail, { issueDate: ctx.day(-30 + Math.floor((i * 30) / Number(nArg))), eSend: "later" });
  const session = new Session(); session.connect();
  await session.post("Profiler.enable"); await session.post("Profiler.start");
  const t = Date.now();
  let sent = 0;
  for (let i = 0; i < 3; i += 1) sent += (await ctx.api.post("/api/workspace/invoices/send-pending", { all: true })).data.sent;
  const took = Date.now() - t;
  const { profile } = await session.post("Profiler.stop");
  writeFileSync(process.env.OUT, JSON.stringify(profile));
  console.log(`süre ${took} ms, gönderilen ${sent}, belge başı ${(took / sent).toFixed(1)} ms`);
} finally { await ctx.close(); }
