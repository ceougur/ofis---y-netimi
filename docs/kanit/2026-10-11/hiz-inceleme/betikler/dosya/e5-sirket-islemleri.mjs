// E5: rapor iş parçacıkları çalışırken (üretim yolu, reportWorker: true) Şimdi Yedek Al (Tüm Şirketler), otomatik yedek, 002 geri yükleme,
// 002 silme. Her adımda yanıt kodu + gövde, rapor yanıtlarının kodları, işlem sonrası 002 veri dosyasında süreçte kalan tanıtıcı.
import path from "node:path";
import { readdirSync, readlinkSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
const ROOT = "/home/user/ofis---y-netimi";
const DATA = path.resolve(process.argv[2]);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const app = createApp({ dataDir: DATA, backupDir: path.join(path.dirname(DATA), "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcek-210-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, moneyStrict: false, gateVerify: false, integrityScan: false, analysisWorker: false, reportWorker: true });
const { port } = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${port}`;
const c = createClient(base);
const login = await c.login("admin", "Olcek-210-Yonetici!");
console.log("giriş", login.status);
const list = await c.get("/api/companies");
const companies = (list.data?.data || list.data).companies;
const c2 = companies.find(x => x.code === "002");
const file2 = path.join(DATA, "sirketler/002/destekofis.sqlite");
const fds = p => readdirSync("/proc/self/fd").map(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`); } catch { return ""; } }).filter(x => x.startsWith(p));
const RC = "/api/workspace/report-center";
const st = r => `${r.status}${r.status >= 400 ? ":" + JSON.stringify(r.data?.error || r.data).slice(0, 120) : ""}`;
const reportLoop = (company, id, query, n) => {
  const out = [];
  const one = async () => { const t = Date.now(); const r = await c.get(`${RC}/${id}?${new URLSearchParams({ ...query, hofCompany: company })}`); out.push(`${st(r)}/${Date.now() - t}ms`); };
  return { out, run: Promise.all(Array.from({ length: n }, () => one())) };
};
const wait = ms => new Promise(r => setTimeout(r, ms));
// 0) 002'de raporlar iş parçacığında mı?
const r0 = await c.get(`${RC}/banka-hareket?preset=all&hofCompany=${c2.id}`);
const runner2 = () => [...(app.children?.values?.() || [])];
console.log("002 banka-hareket:", r0.status, "toplam", (r0.data?.data || r0.data)?.total);
let backup002 = "";
// 1) Şimdi Yedek Al (Tüm Şirketler) — 001'de (100.000 satır) ve 002'de raporlar sürerken
{
  const a = reportLoop("sirket-001", "banka-hareket", { preset: "all" }, 2);
  const b = reportLoop(c2.id, "banka-bakiye", { preset: "all" }, 2);
  await wait(300);
  const t = Date.now();
  const r = await c.post("/api/admin/backups", { scope: "all" });
  const body = r.data?.data || r.data;
  console.log(`[1] Şimdi Yedek Al (Tüm): ${r.status} ${Date.now() - t} ms; yedekler ${JSON.stringify((body.backups || []).map(x => x.code + ":" + x.name))}; hatalar ${JSON.stringify(body.failed || body.error)}`);
  backup002 = (body.backups || []).find(x => x.code === "002")?.name || "";
  await a.run; await b.run;
  console.log(`[1] eşzamanlı raporlar 001: ${a.out.join(", ")} | 002: ${b.out.join(", ")}`);
}
// 2) Otomatik yedek (zamanlayıcının çağırdığı işlev) raporlar sürerken
{
  const a = reportLoop("sirket-001", "banka-hareket", { preset: "all" }, 2);
  await wait(300);
  let res;
  try { res = (app.runDueBackups?.() || []).map(x => `${x.name || x.error}`); } catch (e) { res = "HATA " + e.message; }
  console.log(`[2] runDueBackups: ${JSON.stringify(res)}`);
  await a.run;
  console.log(`[2] eşzamanlı raporlar 001: ${a.out.join(", ")}`);
}
// 3) 002 geri yükleme, 002'de raporlar sürerken (3 tur)
const backupsList = await c.get(`/api/admin/backups?hofCompany=${c2.id}`);
const bl = backupsList.data?.data || backupsList.data;
const items = (bl.backups || bl.items || bl.list || []).filter(x => (x.companyId || x.company?.id) === c2.id || String(x.name).includes("-002-"));
const pick = { name: backup002 };
console.log("[3] geri yüklenecek yedek:", pick?.name, "(", items.length, "yedek )");
for (let round = 1; round <= 3; round += 1) {
  const b = reportLoop(c2.id, "banka-hareket", { preset: "all" }, 4);
  await wait(round * 40);
  const t = Date.now();
  const r = await c.post("/api/admin/backups/restore", { name: pick.name, company: c2.id, target: c2.id, confirm: "002", password: "Olcek-210-Yonetici!" });
  console.log(`[3.${round}] geri yükleme: ${st(r)} ${Date.now() - t} ms; ${JSON.stringify(r.data?.data || r.data).slice(0, 160)}`);
  await b.run;
  console.log(`[3.${round}] eşzamanlı 002 raporları: ${b.out.join(", ")}`);
  console.log(`[3.${round}] geri yüklemeden hemen sonra 002 dosyasında süreçteki tanıtıcı: ${fds(file2).length} [${fds(file2).map(p => path.basename(p)).join(", ")}]`);
  const after = await c.get(`${RC}/banka-hareket?preset=all&hofCompany=${c2.id}`);
  console.log(`[3.${round}] sonra 002 raporu: ${st(after)} toplam ${(after.data?.data || after.data)?.total}`);
}
// 4) 002 silme, raporlar sürerken
{
  const b = reportLoop(c2.id, "banka-masraf", { preset: "all" }, 3);
  await wait(60);
  const t = Date.now();
  const rr = await c.raw("DELETE", `/api/companies/${c2.id}`, { body: JSON.stringify({ confirm: "002", password: "Olcek-210-Yonetici!" }), headers: { "content-type": "application/json" } }); const r = { status: rr.status, data: rr.data };
  console.log(`[4] 002 silme: ${st(r)} ${Date.now() - t} ms`);
  await b.run;
  console.log(`[4] eşzamanlı 002 raporları: ${b.out.join(", ")}`);
  console.log(`[4] silindikten sonra eski 002 dosyası var mı: ${existsSync(file2)}; süreçte sirketler/002 ya da silinen-sirketler tanıtıcısı: ${fds(path.join(DATA, "silinen-sirketler")).length + fds(path.join(DATA, "sirketler/002")).length}`);
}
await app.close();
console.log("kapandı");
