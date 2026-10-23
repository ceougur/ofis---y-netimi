// 31e tur 2: genel tablo koşucusu. node tablo-kos.mjs <senaryo.json> [sürümler virgülle]
// senaryo: { sheets: [{name, matrix}], payments?: [{key, amount, days}], tabs?: [[sekme,…], …] }  (matrix hücresinde "@d<gün>" göreli tarih)
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
const { CURRENT, bootVersion } = await import(`${process.env.KOK}/test/guvenilirlik/surumler.mjs`);
const { createClock } = await import(`${process.env.KOK}/server/lib/clock.mjs`);
const NB = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/r31e-f/tmp";
const [file, versionsArg] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(file, "utf8"));
const pad = v => String(v).padStart(2, "0");
const NOW = new Date(2026, 9, 23, 10);
const d = days => { const x = new Date(2026, 9, 23 + days, 12); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
const iso = days => { const x = new Date(2026, 9, 23 + days, 12); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const sheets = spec.sheets.map(s => ({ name: s.name, matrix: s.matrix.map(r => r.map(c => (typeof c === "string" && c.startsWith("@d") ? d(Number(c.slice(2))) : c))) }));
const RANGE = "from=2000-01-01&to=2099-12-31";
const out = {};
for (const version of (versionsArg || `v2.4.3,${CURRENT}`).split(",")) {
  const root = mkdtempSync(path.join(NB, `tk-${version}-`));
  const server = await bootVersion(version, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: createClock({ time: NOW, fixed: true }) });
  try {
    const api = await server.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const staged = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "t.xlsx", sheets });
    if (staged.status !== 200) throw new Error(`stage ${staged.status} ${JSON.stringify(staged.data).slice(0, 300)}`);
    const commit = await api.post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" });
    if (commit.status !== 200) throw new Error(`commit ${commit.status}`);
    const pays = [];
    for (const p of spec.payments || []) { const r = await api.post(`/api/workspace/cases/${encodeURIComponent(p.key)}/payments`, { amount: p.amount, date: iso(p.days), method: "cash", cashForce: true, note: p.note || "" }); pays.push(r.status); }
    const res = { pays };
    const dues = await api.get("/api/workspace/dues");
    res.takvimNotes = dues.data?.notes; res.takvimKeys = Object.keys(dues.data || {}); res.takvimNotlar = JSON.stringify(dues.data || {}).match(/bir kez sayıldı|birden çok sekmede/g) || [];
    res.takvim = { status: dues.status, items: (dues.data?.items || []).map(i => [i.person, i.tab, i.amount, i.debt, i.debtColumn || "", i.state, i.label, Boolean(i.promise)]) };
    const prof = await api.get("/api/workspace/profile");
    res.roller = JSON.stringify(prof.data || {}).match(/"column":"[^"]+","role":"[a-z]+"/g)?.slice(0, 20) || [];
    const ins = await api.get("/api/workspace/insight");
    res.insightKart = JSON.stringify(ins.data || {}).match(/"(label|title)":"[^"]{0,40}","(value|total|amount)":[^,}]{0,30}/g)?.slice(0, 12) || [];
    const ft = await api.get("/api/workspace/plans/from-table");
    res.aktar = { status: ft.status, keys: Object.keys(ft.data || {}).slice(0, 12), tabs: (ft.data?.tabs || []).map(t => [t.tab, t.shape, t.count]), records: (ft.data?.records || ft.data?.candidates || []).map(r => [r.name, r.tab, r.total, r.paid, r.remaining, r.closed, (r.issues || []).map(i => i.code).join("|")]) };
    for (const tabs of [[], ...(spec.tabs || [])]) {
      const q = tabs.length ? `&tabs=${encodeURIComponent(tabs.join(","))}` : "";
      const ce = await api.get(`/api/workspace/reports/cari-ekstre?${RANGE}${q}`);
      const vt = await api.get(`/api/workspace/reports/vade-takip?${RANGE}${q}`);
      const na = await api.get(`/api/workspace/reports/nakit-akis?${RANGE}${q}`);
      res[tabs.length ? `sekme:${tabs.join("+")}` : "suzgecsiz"] = {
        footerKisi: [ce.data?.report?.table?.footer, ce.data?.summary, (ce.data?.report?.table?.rows || []).map(r => [r.cari, r.borc, r.bakiye])], footerVade: [vt.data?.report?.table?.footer, vt.data?.summary], footerNakit: [na.data?.report?.table?.footer, na.data?.summary],
        kisiler: [ce.status, ce.data?.report?.totals?.debit, ce.data?.report?.totals?.credit, (ce.data?.report?.groups || []).map(g => [g.cari, g.debit, g.credit]), ce.data?.report?.notes],
        vade: [vt.status, vt.data?.report?.totals?.count, vt.data?.report?.totals?.amount, (vt.data?.report?.table?.rows || []).map(r => [r.cari, r.tab, r.amount, r.state]), vt.data?.report?.notes],
        nakit: [na.status, na.data?.report?.totals?.expected, na.data?.report?.totals?.collected, na.data?.report?.notes],
      };
    }
    out[version] = res;
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(JSON.stringify(out));
