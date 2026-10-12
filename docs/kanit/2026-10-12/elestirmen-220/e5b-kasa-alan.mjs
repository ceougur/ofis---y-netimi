// e5b: /api/workspace/cash yanıtında 123456.78'in geçtiği alan yolları (bank.view kaldırılmış muhasebe). Koşu: node <bu dosya> [kök]
// kök verilirse o kopyanın (ör. v2.1.0) test yardımcıları ve sunucusu kullanılır.
const root = process.argv[2] ? (await import("node:path")).resolve(process.argv[2]) : (await import("node:path")).resolve(new URL("../../../../", import.meta.url).pathname);
const { apiOf } = await import(`${root}/test/banka-210-ortak.mjs`);
const { BANK, bootBank, must } = await import(`${root}/test/banka-210-hesap-ortak.mjs`);
const { createUser } = await import(`${root}/test/helpers.mjs`);
const ctx = await bootBank();
await must("hesap", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "123.456,78", confirmed: true } }));
const client = await createUser(ctx.server, ctx.api.client, { username: "e-muh", role: "muhasebe" });
const users = await ctx.api.client.get("/api/admin/users");
const list = users.data?.data?.users || users.data?.users || users.data?.data || [];
const target = list.find(u => u.username === "e-muh");
console.log("yetki kaldır:", (await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.view", "bank.reports"] } })).status);
const muh = apiOf(client);
const paths = [];
const walk = (v, p) => {
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  else if (String(v).includes("123456.78") || String(v).includes("12345678")) paths.push(`${p} = ${v}`);
};
for (const u of ["/api/workspace/cash", "/api/workspace/overview"]) {
  const r = await muh.get(u);
  paths.length = 0;
  walk(r.data, "");
  console.log(u, r.status, JSON.stringify(paths));
}
await ctx.server.close();
process.exit(0);
