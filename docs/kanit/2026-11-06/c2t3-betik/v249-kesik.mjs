// Ç2 tur 3 — (1) 2.4.9'dan gelen, Mutabakat Günlüğü kaydı ZATEN KESİK bir veri dosyası yeni kodla açılınca ne olur (Mutabakat Testi HTTP kaç)? (bilgi için; depoya test yok)
//            (a) banka açılış onarımı: v2.4.9'da 600 tahsilat → GERÇEK 2.0.26 Tüm Hareketleri Sil → v2.4.9 açılışı (kesik onarım kaydı) → yeni kod açılışı
//            (b) taban: v2.4.9'da 6 tahsilat, 5 tarih 6.000 karakter bozuk → v2.4.9 açılışı (kesik taban kaydı) → yeni kod açılışları
// (2) integrity.mjs:832 son taban kaydını `ORDER BY at DESC` ile seçer: yeni kod v2.4.9'un kesik kaydıyla AYNI anda / DAHA ERKEN saatte açılırsa her açılışta yeni satır mı?
//     Karşılaştırma: aynı dosya eski kodla (bc495a1c) açılınca.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node v249-kesik.mjs <yeni kök> <eski kök (bc495a1c)> <v2.4.9 kökü> [banka|taban|hepsi]
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [NEW, OLD, V249, what = "hepsi"] = process.argv.slice(2);
const SCR = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t3-calisma";
const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b";
const T0 = "2027-01-10T10:00:00+03:00";
const { bootVersion } = await import(pathToFileURL(path.join(WT, "test", "guvenilirlik", "surumler.mjs")).href);
const helpers = async root => import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const hNew = await helpers(NEW);
const hOld = await helpers(OLD);
const h249 = await helpers(V249);
const open = async (h, dirs, time, fn) => {
  const server = await h.startTestServer({ now: { time, fixed: true }, ...dirs });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};
const valid = text => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};
const state = async (h, server, action, tables) => {
  const rows = server.app.store.all(`SELECT length(detail_json) AS len, detail_json AS detail FROM integrity_log WHERE action = '${action}'${tables === undefined ? "" : ` AND tables = '${tables}'`} ORDER BY rowid`);
  const admin = await h.loginAdmin(server);
  const scan = await admin.get("/api/workspace/ledger/integrity");
  return { satir: rows.length, uzunluklar: rows.map(row => row.len), gecerli: rows.map(row => valid(row.detail)), mutabakatTestiHTTP: scan.status };
};
const fresh = name => {
  const base = `${SCR}/v249-${name}`;
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  return { dataDir: `${base}/data`, backupDir: `${base}/backups` };
};

if (what === "banka" || what === "hepsi") {
  const dirs = fresh("banka");
  await open(h249, dirs, T0, async server => {
    const admin = await h249.loginAdmin(server);
    const acc = (await admin.post("/api/workspace/accounts", { name: "Kesik Cari", type: "customer", registeredOn: "2026-12-01" })).data.data;
    for (let i = 0; i < 600; i += 1) if ((await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" })).status !== 200) throw new Error("tahsilat");
  });
  const old = await bootVersion("v2.0.26", dirs);
  try {
    const r = await (await old.login()).post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: hNew.ADMIN_PASSWORD });
    console.log(`(a) v2.0.26 Tüm Hareketleri Sil: HTTP ${r.status}`);
  } finally {
    await old.close();
  }
  console.log(`(a) v2.4.9 açılışı: ${JSON.stringify(await open(h249, dirs, "2027-01-10T11:00:00+03:00", s => state(h249, s, "repair", "")))}`);
  for (const [turn, time] of [[1, "2027-01-10T12:00:00+03:00"], [2, "2027-01-10T12:30:00+03:00"]]) console.log(`(a) yeni kod açılış ${turn}: ${JSON.stringify(await open(hNew, dirs, time, s => state(hNew, s, "repair", "")))}`);
  rmSync(path.dirname(dirs.dataDir), { recursive: true, force: true });
}

if (what === "taban" || what === "hepsi") {
  const dirs = fresh("taban");
  const file = await open(h249, dirs, T0, async server => {
    const admin = await h249.loginAdmin(server);
    const acc = (await admin.post("/api/workspace/accounts", { name: "Taban Cari", type: "customer", registeredOn: "2026-12-01" })).data.data;
    for (let i = 0; i < 6; i += 1) await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" });
    return server.app.config.dbPath;
  });
  const db = new DatabaseSync(file);
  db.prepare("UPDATE account_entries SET date = ? || id WHERE id IN (SELECT id FROM account_entries ORDER BY rowid LIMIT 5)").run("9".repeat(6000));
  db.close();
  console.log(`(b) v2.4.9 açılışı (11:00): ${JSON.stringify(await open(h249, dirs, "2027-01-10T11:00:00+03:00", s => state(h249, s, "baseline")))}`);
  // Aynı dosyanın üç kopyası: yeni kod (i) daha geç, (ii) aynı an, (iii) daha erken; eski kod (bc495a1c) aynı an.
  const base = path.dirname(dirs.dataDir);
  const variants = [["yeni-gec", hNew, ["2027-01-10T12:00:00+03:00", "2027-01-10T12:30:00+03:00", "2027-01-10T13:00:00+03:00"]], ["yeni-ayni-an", hNew, ["2027-01-10T11:00:00+03:00", "2027-01-10T11:00:00+03:00", "2027-01-10T11:00:00+03:00"]], ["yeni-erken", hNew, ["2027-01-10T09:00:00+03:00", "2027-01-10T09:10:00+03:00", "2027-01-10T09:20:00+03:00"]], ["eski-bc495a1c-ayni-an", hOld, ["2027-01-10T11:00:00+03:00", "2027-01-10T11:00:00+03:00", "2027-01-10T11:00:00+03:00"]]];
  for (const [name, h, times] of variants) {
    const copy = `${base}-${name}`;
    rmSync(copy, { recursive: true, force: true });
    cpSync(base, copy, { recursive: true });
    const cdirs = { dataDir: `${copy}/data`, backupDir: `${copy}/backups` };
    const turns = [];
    for (const time of times) turns.push(await open(h, cdirs, time, s => state(h, s, "baseline")));
    console.log(`(b) ${name}: ${turns.map((t, i) => `açılış ${i + 1} satır ${t.satir} geçerli ${t.gecerli.join("/")} HTTP ${t.mutabakatTestiHTTP}`).join(" · ")}`);
    rmSync(copy, { recursive: true, force: true });
  }
  rmSync(base, { recursive: true, force: true });
}
