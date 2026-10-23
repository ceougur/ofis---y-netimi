// 31e tur 7: 20.000 satırlık Dosya No'suz tabloda yükleme/eşitleme süreleri (aday 17 ↔ aday 16), 5.000 satırda bağ (not, telefon).
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const NB = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/r31e-f/tmp";
const CODE = process.env.KOK;
const { CURRENT, bootVersion } = await import(`${CODE}/test/guvenilirlik/surumler.mjs`);
const { createClock } = await import(`${CODE}/server/lib/clock.mjs`);
const N = Number(process.env.N || 20000);
const BONDED = Number(process.env.BAG || 5000);
const pad = v => String(v).padStart(2, "0");
const d = days => { const x = new Date(2026, 9, 23 + days, 12); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
const people = Array.from({ length: N }, (_, i) => ({ name: `Kişi ${String(i + 1).padStart(5, "0")} Soyad`, tutar: String(100 + (i % 900)), vade: d(-((i % 60) + 1)), aciklama: `Aidat ${i + 1}` }));
const matrix = (list, extra = false) => [["Ad Soyad", "Tutar", "Son Ödeme", "Açıklama", ...(extra ? ["Not"] : [])], ...list.map(p => [p.name, p.tutar, p.vade, p.aciklama, ...(extra ? ["-"] : [])])];
const csvOf = m => m.map(line => line.join(",")).join("\n");
let CSV = "";
const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Müşteriler"</script>') : new Response(CSV, { headers: { "content-type": "text/csv" } }));
const SCEN = {
  P1_ayni: { next: () => matrix(people), mode: "replace" },
  P2_tek_hucre: { next: () => matrix(people.map((p, i) => (i === 7 ? { ...p, tutar: "999999" } : p))), mode: "replace" },
  P3_kolon_ekle: { next: () => matrix(people, true), mode: "replace" },
  P4_kolon_ekle_devami: { next: () => matrix(people, true), mode: "merge" },
  P6_ters_sira_kolon: { next: () => matrix([...people].reverse(), true), mode: "replace" },
  P7_sync_ters_sira_kolon: { next: () => matrix([...people].reverse(), true), mode: "sync" },
  P8_sync_kolon: { next: () => matrix(people, true), mode: "sync" },
};
const which = process.argv.slice(2);
for (const [name, sc] of Object.entries(SCEN)) {
  if (which.length && !which.includes(name)) continue;
  const root = mkdtempSync(path.join(NB, `tur7-hiz-${process.env.KOD || "a17"}-`));
  const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, fetchImpl, now: createClock({ time: new Date(2026, 9, 23, 10), fixed: true }) });
  const out = { kod: process.env.KOD || "a17", senaryo: name, N, bag: BONDED };
  try {
    const api = await server.login();
    const sync = sc.mode === "sync";
    CSV = csvOf(matrix(people));
    const s0 = await api.post("/api/workspace/dataset/stage", sync ? { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/HIZ/edit" } : { kind: "excel", fileName: "b.xlsx", sheets: [{ name: "Müşteriler", matrix: matrix(people) }] });
    await api.post("/api/workspace/dataset/commit", { stageId: s0.data.stageId, mode: "replace" });
    const store = server.app.store;
    const keys = store.all("SELECT case_key AS k FROM dataset_rows ORDER BY position").map(r => r.k);
    const t0 = Date.now();
    store.tx(() => {
      for (let i = 0; i < BONDED; i += 1) store.run("INSERT INTO notes (id, case_key, note, created_by, created_at) VALUES (?, ?, ?, ?, ?)", `note-hiz-${i}`, keys[i * Math.floor(N / BONDED)], `not ${i}`, "system", new Date().toISOString());
    });
    out.bagYaz = Date.now() - t0;
    let t = Date.now();
    if (sync) {
      CSV = csvOf(sc.next());
      const other = await server.login();
      let finished = false;
      const pending = api.post("/api/workspace/dataset/sync", {}).finally(() => { finished = true; });
      // Eşitleme sürerken başka bir oturumun basit istekleri (olay döngüsü kilitli mi?): en uzun yanıt süresi
      const lat = [];
      while (!finished) {
        const p0 = Date.now();
        await other.get("/api/workspace/dataset");
        lat.push(Date.now() - p0);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      out.esZamanliIstek = { adet: lat.length, enUzun_ms: Math.max(...lat), ortanca_ms: lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)] };
      const y = await pending;
      out.sync_ms = Date.now() - t;
      out.sync = [y.status, y.data?.ok, y.data?.held, y.data?.counts, y.data?.bonds?.moved, y.data?.bonds?.unmatched, y.data?.hold?.bonds?.count];
    } else {
      const s = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "b.xlsx", sheets: [{ name: "Müşteriler", matrix: sc.next() }] });
      out.stage_ms = Date.now() - t;
      out.onizleme = s.data?.bonds ? { tasinan: s.data.bonds[sc.mode]?.moved?.count, eslesmeyen: s.data.bonds[sc.mode]?.unmatched?.count } : null;
      t = Date.now();
      let c = await api.post("/api/workspace/dataset/commit", { stageId: s.data?.stageId, mode: sc.mode });
      out.commit_ms = Date.now() - t;
      out.commit = [c.status, c.data?.code, c.data?.bonds?.moved, c.data?.bonds?.unmatched];
      if (c.status === 409) {
        t = Date.now();
        c = await api.post("/api/workspace/dataset/commit", { stageId: s.data?.stageId, mode: sc.mode, confirm: true });
        out.onayli_ms = Date.now() - t;
        out.onayli = [c.status, c.data?.bonds?.moved, c.data?.bonds?.unmatched];
      }
    }
    const live = store.get("SELECT COUNT(*) AS n FROM notes n WHERE n.note LIKE 'not %' AND EXISTS (SELECT 1 FROM dataset_rows r WHERE r.case_key = n.case_key)").n;
    out.gorunenNot = live;
  } catch (error) {
    out.hata = String(error?.stack || error).slice(0, 800);
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
  console.log(JSON.stringify(out));
}
