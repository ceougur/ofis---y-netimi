// Tur 8 Y2: aynı adlı iki kişi farklı telefon / TC; kolon eklenir (a) ya da kolon eklenir + bağlı Ali'nin tutarı değişir (b). KOK = kod kökü.
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const NB = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/r31e-f/tmp";
const { CURRENT, bootVersion } = await import(`${process.env.KOK}/test/guvenilirlik/surumler.mjs`);
const { createClock } = await import(`${process.env.KOK}/server/lib/clock.mjs`);
const out = [];
for (const [label, col, vals, other] of [["tel", "Telefon", ["0532 111 22 33", "0533 444 55 66"], "0534 777 88 99"], ["tc", "TC Kimlik No", ["10000000146", "12345678950"], "10000000078"]]) {
  for (const variant of ["a-kolon", "b-kolon+tutar"]) {
    const root = mkdtempSync(path.join(NB, "y2-"));
    const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: createClock({ time: new Date(2026, 9, 23, 10), fixed: true }) });
    try {
      const api = await server.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const list = [["Ad Soyad", col, "Tutar", "Son Ödeme"], ["Ali Veli", vals[0], "1000", "20.10.2026"], ["Ayşe Kaya", other, "2000", "19.10.2026"], ["Ali Veli", vals[1], "4000", "18.10.2026"]];
      const stage = async m => (await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "y2.xlsx", sheets: [{ name: "Liste", matrix: m }] })).data;
      let s = await stage(list);
      await api.post("/api/workspace/dataset/commit", { stageId: s.stageId, mode: "replace" });
      const store = server.app.store;
      const rows = () => store.all("SELECT case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(r => ({ k: r.k, v: JSON.parse(r.v) }));
      const ali = rows()[0].k;
      await api.post(`/api/workspace/cases/${encodeURIComponent(ali)}/payments`, { amount: "100", date: "2026-10-22", method: "cash" });
      await api.post(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "Ali 1 notu" });
      const next = list.map((line, i) => [...line, i ? "-" : "Not"]).map((line, i) => (variant.startsWith("b") && i === 1 ? line.map((c, j) => (j === 2 ? "1200" : c)) : line));
      s = await stage(next);
      const c = await api.post("/api/workspace/dataset/commit", { stageId: s.stageId, mode: "replace" });
      let onay = null;
      if (c.status === 409) onay = (await api.post("/api/workspace/dataset/commit", { stageId: s.stageId, mode: "replace", confirm: true })).status;
      const now = rows();
      const where = k => { const r = now.find(x => x.k === k); return r ? `${r.v["Ad Soyad"]} ${r.v[col]} ${r.v.Tutar}` : "YOK"; };
      out.push({ test: `${label} ${variant}`, kural: store.setting("dataset.identity", ""), onizleme: { tasinan: s.bonds?.replace?.moved?.count, eslesmeyen: s.bonds?.replace?.unmatched?.names }, uygula: [c.status, c.data?.code ?? null], onay, tahsilat: where(store.get("SELECT case_key AS k FROM payments").k), not: where(store.get("SELECT case_key AS k FROM notes").k) });
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  }
}
for (const line of out) console.log(JSON.stringify(line));
