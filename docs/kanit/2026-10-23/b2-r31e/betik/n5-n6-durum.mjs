// 31e tur 7 N5/N6: her yolun yanıt kodu (aday 17 ↔ yeni), ham sayı.
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const NB = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/r31e-f/tmp";
const { CURRENT, bootVersion } = await import(`${process.env.KOK}/test/guvenilirlik/surumler.mjs`);
const { createClock } = await import(`${process.env.KOK}/server/lib/clock.mjs`);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const head = ["Ad Soyad", "Tutar", "Son Ödeme"];
let CSV = "";
const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Müşteriler"</script>') : new Response(CSV, { headers: { "content-type": "text/csv" } }));
const root = mkdtempSync(path.join(NB, "n56-"));
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, fetchImpl, now: createClock({ time: new Date(2026, 9, 23, 10), fixed: true }) });
const out = {};
try {
  const api = await server.login();
  await api.post("/api/workspace/bank/setup/dismiss", {});
  CSV = [head, ["Kemal Er", "100", "20.10.2026"], ["Lale Ak", "200", "20.10.2026"]].map(r => r.join(",")).join("\n");
  const s = await api.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/N56/edit" });
  await api.post("/api/workspace/dataset/commit", { stageId: s.data.stageId, mode: "replace", link: true });
  const store = server.app.store;
  const lale = store.get("SELECT case_key AS k FROM dataset_rows WHERE values_json LIKE '%Lale%'").k;
  out.not = (await api.post(`/api/workspace/cases/${encodeURIComponent(lale)}/notes`, { note: "Lale notu" })).status;
  CSV = [head, ["Kemal Er", "100", "20.10.2026"]].map(r => r.join(",")).join("\n");
  out.esitle = (await api.post("/api/workspace/dataset/sync", {})).data?.counts;
  const missing = (await api.get("/api/workspace/dataset/missing")).data;
  out.liste = missing.map(r => ({ on: r.preview?.[0], bonds: r.bonds ?? "ALAN YOK" }));
  const rm = await api.post("/api/workspace/dataset/missing", { action: "remove", rowIds: missing.map(r => r.rowId) });
  out.sheetteYokKaldir = [rm.status, rm.data?.code ?? null, (rm.data?.error || "").slice(0, 160)];
  out.notHala = store.get("SELECT case_key AS k FROM notes WHERE note = 'Lale notu'")?.k === lale;
  const gone = "satir:0123456789abcdef";
  const tries = {
    belge: api.client.raw("POST", `/api/workspace/cases/${encodeURIComponent(gone)}/documents?name=a.pdf`, { body: PDF, headers: { "content-type": "application/octet-stream", "x-hof-upload": "1" } }),
    gorev: api.post("/api/workspace/tasks", { title: "Ara", caseKey: gone, dueDate: "2026-10-25" }),
    duzeltme: api.post("/api/workspace/overrides", { caseKey: gone, field: "Tutar", value: "1" }),
    kayitNotu: api.put(`/api/workspace/case-notes/${encodeURIComponent(gone)}`, { note: "x" }),
    telefon: api.post(`/api/workspace/cases/${encodeURIComponent(gone)}/phones`, { phone: "05321112233", label: "İş" }),
    haciz: api.post(`/api/workspace/cases/${encodeURIComponent(gone)}/liens`, { title: "Araç", placedAt: "2026-10-21" }),
    not: api.post(`/api/workspace/cases/${encodeURIComponent(gone)}/notes`, { note: "x" }),
  };
  out.bayat = {};
  for (const [k, p] of Object.entries(tries)) { const r = await p; out.bayat[k] = [r.status, r.data?.code ?? null]; }
  out.bayatYazilan = Object.fromEntries(["case_documents", "tasks", "overrides", "case_notes", "phones", "liens", "notes"].map(t => [t, store.get(`SELECT COUNT(*) AS n FROM ${t} WHERE case_key = ?`, gone).n]));
  const del = await api.del("/api/workspace/dataset");
  out.veriyiKaldir = [del.status, del.data?.code ?? null];
} finally {
  await server.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify(out));
