import { mkdtempSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import path from "node:path";
const { createUpdater } = await import(process.env.UPDATER);
const real = globalThis.fetch; const seen = [];
const apiOff = async (url, o) => { const u = String(url); if (u.startsWith("https://api.github.com/")) { seen.push(`API 403 ← ${u}`); return new Response("blocked", { status: 403 }); } const r = await real(url, o); seen.push(`${r.status} ← ${u}`); return r; };
for (const v of process.argv.slice(2)) {
  const root = mkdtempSync(path.join(tmpdir(), "upd-")); seen.length = 0;
  const up = createUpdater({ appsDir: path.join(root, "apps"), configDir: path.join(root, "cfg"), currentVersion: v, fetchImpl: apiOff, nodeVersion: "24.21.0", bootstrapVersion: 2, checkRetryDelaysMs: [] });
  const r = await up.check(); console.log(`kurulu ${v}: ${r.status} ${r.version || r.latestVersion || ""} ${r.reason || ""}`); for (const s of seen) console.log("   ", s);
  rmSync(root, { recursive: true, force: true });
}
