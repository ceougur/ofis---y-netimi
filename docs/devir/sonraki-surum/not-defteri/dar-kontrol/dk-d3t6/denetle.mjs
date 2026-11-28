// dar kontrol D3 tur 6 — eski sürümün ürettiği veriyi YENİ kodla açar (göç), K = 31.12.2026 devir ön izlemesini alır; her kart için devirsiz program ↔ plan karşılaştırır.
// KOD=<yeni ya da eski kod kökü> VERI=<g-vXXX klasörü> CARISIZ=1 (carisiz kartın bağı boşaltılır) node denetle.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const { KOD, VERI } = process.env;
const K = "2026-12-31";
const helpers = await import(pathToFileURL(path.join(KOD, "test/helpers.mjs")).href);
const meta = JSON.parse(readFileSync(path.join(VERI, "kartlar.json"), "utf8"));
const root = mkdtempSync(path.join("/dev/shm", "dk-d3t6-kos-"));
const dataDir = path.join(root, "data");
cpSync(path.join(VERI, "data"), dataDir, { recursive: true });
if (process.env.CARISIZ) {
  const db = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
  db.prepare("UPDATE plans SET account_id = '' WHERE id = ?").run(meta.kartlar.carisiz.id);
  db.close();
}
const server = await helpers.startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: "2027-01-05T10:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const client = await helpers.loginAdmin(server);
if (process.env.EDIT) for (const key of ["haziran", "kGunu", "tam"]) {
  const id = meta.kartlar[key].id;
  const cur = (await client.get(`/api/workspace/plans/${id}`)).data.data;
  const r = await client.put(`/api/workspace/plans/${id}`, { ...cur, note: "yeni sürümde K sonrası düzenlendi" });
  const row = server.app.store.get("SELECT closed_at AS c, updated_at AS u, status FROM plans WHERE id = ?", id);
  console.error("EDIT", key, r.status, JSON.stringify(r.data).slice(0, 160), JSON.stringify(row));
}
const started = await client.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K, option: "borc-alacak" });
if (started.status !== 200) throw new Error(JSON.stringify(started.data));
let job;
for (let i = 0; i < 1200; i += 1) {
  job = (await client.get(`/api/admin/devir/preview/${started.data.data.id}`)).data.data;
  if (job.state !== "running") break;
  await new Promise(r => setTimeout(r, 50));
}
const store = server.app.store;
const out = { kod: meta.kod, tz: process.env.TZ, carisiz: Boolean(process.env.CARISIZ), state: job.state, hata: job.error || null };
// devirsiz: genel defter ≤K cari boyutu (bütün hesaplar) + 127 carisiz
const partyK = {};
let b127 = {};
for (const entry of server.app.ledger.build()) if (entry.date <= K) for (const line of entry.lines || []) {
  if (line.party) partyK[line.party] = (partyK[line.party] || 0) + line.debit - line.credit;
  if (line.account === "127") b127[line.party || line.sub || ""] = (b127[line.party || line.sub || ""] || 0) + line.debit - line.credit;
}
const cols = new Set(store.all("PRAGMA table_info(plans)").map(r => r.name));
const rows = [];
if (job.state === "done") {
  const plan = job.result.plan;
  for (const [key, info] of Object.entries(meta.kartlar)) {
    const db = store.get(`SELECT status, closed_at AS closedAt, close_rule AS closeRule, updated_at AS updatedAt, account_id AS party,
      MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10))) AS gun FROM plans WHERE id = ?`, info.id);
    const card = plan.newYear.kartlar.find(r => r.kart === info.id);
    const cari = plan.newYear.cariler.find(r => r.cari === db.party);
    const acc = db.party ? (await client.get(`/api/workspace/accounts/${db.party}`)).data?.data?.totals : null;
    rows.push({
      key, durumDb: db.status, closedAt: db.closedAt, kural: db.closeRule, gun: db.gun,
      plan: card ? `${card.durum} kalan ${card.kalanMinor / 100} ödenen ${card.odenenMinor / 100} taksit ${card.taksitler.length} (${card.taksitler.map(t => t.kalanMinor / 100).join("/")}) kural ${card.kapanisKurali}` : "YOK",
      cariPlanK: cari ? cari.kBakiyeMinor / 100 : "satırsız", cariDefterK: db.party ? (partyK[db.party] || 0) / 100 : "-",
      cariSatir: cari ? cari.satirlar.map(s => `${s.aciklama || s.tur || ""}:${(s.borcMinor ?? s.minor ?? 0) / 100}/${(s.alacakMinor ?? 0) / 100}`).join(";") : "",
      bugun: acc ? `bakiye ${acc.balance} planKalan ${acc.planRemaining}` : "-",
    });
  }
  out.sayilar = plan.sayilar.taksitKarti;
  out.sorunlar = plan.sorunlar;
  out.durdurur = job.result.onDenetim.durdurur.map(i => [i.kod, i.baslik, i.neOldu]);
  out.uyarir = (job.result.onDenetim.uyarir || []).map(i => [i.kod, i.baslik]);
  out.rapor = [...JSON.stringify(job.result.rapor).matchAll(/"Taksit Kartı","([^"]*)","([^"]*)"/g)].map(m => `${m[1]} | ${m[2]}`);
  out.d127 = b127;
  if (process.env.DUMP) out.rapor127 = JSON.stringify(job.result.rapor).match(/.{0,200}127.{0,200}/g);
}
out.kartlar = rows;
console.log(JSON.stringify(out, null, 1));
await server.close();
helpers.removeTestDir(root);
