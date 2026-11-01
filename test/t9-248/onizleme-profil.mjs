// T9 ÖLÇEK — önizleme süresinin dökümü: tek önizleme (2.000 cari) node --cpu-prof altında; profil özetini (kapsayıcı/öz süre, server/ işlevleri) yazar.
// Kullanım: node --cpu-prof --cpu-prof-dir <klasör> test/t9-248/onizleme-profil.mjs <veri> <iş> [preset] [kind]  → sonra: node test/t9-248/onizleme-profil.mjs --ozet <profil>
import { readFileSync } from "node:fs";
if (process.argv[2] === "--ozet") {
  const prof = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const byId = new Map(prof.nodes.map(n => [n.id, n]));
  const dt = new Map();
  prof.samples.forEach((id, i) => dt.set(id, (dt.get(id) || 0) + (prof.timeDeltas[i] || 0)));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const self = new Map();
  const incl = new Map();
  const ad = n => `${n.callFrame.functionName || "(anonim)"} ${n.callFrame.url.replace(/^.*\/(server|test)\//, "$1/")}:${n.callFrame.lineNumber + 1}`;
  for (const [id, us] of dt) {
    const n = byId.get(id);
    self.set(ad(n), (self.get(ad(n)) || 0) + us);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const k = ad(byId.get(cur));
      if (seen.has(k)) continue;
      seen.add(k);
      incl.set(k, (incl.get(k) || 0) + us);
    }
  }
  const top = (m, filt) => [...m].filter(([k]) => filt(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1e6).toFixed(2)} sn  ${k}`);
  console.log("ÖZ SÜRE (ilk 25):\n" + top(self, () => true).join("\n"));
  console.log("\nKAPSAYICI (server/, ilk 25):\n" + top(incl, k => k.includes("server/")).join("\n"));
  process.exit(0);
}
const { kurulum, log } = await import("./ortak.mjs");
const [VERI, IS, preset = "lastMonth", kind = "statement"] = process.argv.slice(2);
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: "2026-11-02T10:00:00+03:00", fixed: true }, isci: "manual", aralik: 0, tier: "TIER_2K", onEk: `prof${Date.now().toString(36)}` });
try {
  const tum = (await ctx.admin.get(ctx.at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.filter(a => a.phone).slice(0, 2000).map(a => a.id);
  let t = performance.now();
  const one = await ctx.admin.get(ctx.at(`/api/workspace/accounts/${tum[0]}`));
  log("tek cari kartı ms", Math.round(performance.now() - t), one.status);
  t = performance.now();
  const r = await ctx.admin.post(ctx.at("/api/workspace/whatsapp/batches/preview"), { kind, ids: tum, preset });
  log("önizleme ms", Math.round(performance.now() - t), r.status, r.data?.data?.sendable);
} finally {
  await ctx.kapat();
}
