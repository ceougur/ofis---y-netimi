import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import path from "node:path";
import { chromium } from "playwright"; import { createApp } from "../../../server/app.mjs";
const PASS = "Prova-Admin-2026!"; const root = mkdtempSync(path.join(tmpdir(), "dl-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch(); const context = await browser.newContext({ acceptDownloads: true }); const page = await context.newPage();
await page.goto(`${BASE}/`); await page.fill("#hof-auth input[name=username]", "admin"); await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
const acc = await page.evaluate(async () => (await (await fetch("/api/workspace/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Tülay Arıkan", type: "customer" }) })).json()));
const id = acc.data.id;
const head = await page.evaluate(async id => { const r = await fetch(`/api/workspace/accounts/${id}/ekstre.pdf?download=1`); return Object.fromEntries(r.headers.entries()); }, id);
console.log("başlıklar:", head["content-disposition"], "|", head["content-type"]);
for (const variant of ["attr", "noattr"]) {
  const dl = page.waitForEvent("download", { timeout: 5000 });
  await page.evaluate(([id, variant]) => { const a = document.createElement("a"); a.href = `/api/workspace/accounts/${id}/ekstre.pdf?download=1`; if (variant === "attr") a.download = "Cari-ekstre Tülay Arıkan.pdf"; document.body.appendChild(a); a.click(); a.remove(); }, [id, variant]);
  const file = await dl; console.log(variant, "→ suggestedFilename:", file.suggestedFilename(), "| url:", file.url().slice(-40));
}
await browser.close(); await app.close?.(); process.exit(0);
