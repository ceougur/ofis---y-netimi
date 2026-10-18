// 2.4.3 H3 fark testi, GERÇEK ESKİ KODLA: aynı 10.000 faturalı verinin iki kopyasında eski (4d546e9) ve yeni sunucu ayrı süreçlerde açılır;
// liste ucu (GET /api/workspace/invoices) tohumlu süzgeç/arama/sıralama/sayfa birleşimleriyle ikisine de sorulur, yanıtlar BAYT BAYT karşılaştırılır.
// Kullanım: KLASOR=<kök> ESKI=<eski kod> YENI=<yeni kod> node fark-10k.mjs > fark-10k.json
import { fork } from "node:child_process";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KOK = process.env.KLASOR;
const ADMIN_PASS = "Hiz-Fatura-Yonetici-1!";
const start = async (label, kod) => {
  const work = path.join(KOK, `calisma-fark-${label}`);
  rmSync(work, { recursive: true, force: true });
  cpSync(path.join(KOK, "veri"), work, { recursive: true });
  const child = fork(path.join(HERE, "hiz.mjs"), [], { env: { ...process.env, HIZ_KOD: kod, HIZ_SUNUCU: JSON.stringify({ dataDir: path.join(work, "data") }), HUKUK_LICENSE_URL: "http://127.0.0.1:9", HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "" }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  const port = await new Promise(resolve => child.on("message", m => m.cmd === "ready" && resolve(m.port)));
  const { createClient } = await import(`${kod}/test/helpers.mjs`);
  const api = createClient(`http://127.0.0.1:${port}`);
  const login = await api.login("admin", ADMIN_PASS);
  if (login.status !== 200) throw new Error(`${label} giriş ${login.status}`);
  return { api, child, work };
};
const old = await start("eski", process.env.ESKI);
const neu = await start("yeni", process.env.YENI);
const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = rng(10017);
const pick = list => list[Math.floor(random() * list.length)];
const int = (a, b) => a + Math.floor(random() * (b - a + 1));
const info = JSON.parse(readFileSync(path.join(KOK, "veri", "hazir.json"), "utf8"));
const all = (await neu.api.get("/api/workspace/invoices?tab=all&limit=5000")).data.data.invoices;
const today = info.today;
const addDays = (iso, d) => { const [y, m, dd] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10); };
const combos = [];
for (const tab of ["", "sale", "purchase", "returns", "drafts", "pending", "cancelled", "all"]) for (const sort of ["date", "number", "amount", "party"]) for (const pay of ["", "open", "paid", "overdue", "partial", "unpaid", "installment"]) combos.push({ tab, sort, pay, limit: "200" });
for (let i = 0; i < 300; i += 1) {
  const doc = pick(all);
  combos.push({
    tab: pick(["", "sale", "purchase", "returns", "pending", "cancelled", "all"]),
    sort: pick(["date", "date", "number", "amount", "party"]),
    pay: random() < 0.35 ? pick(["open", "paid", "overdue", "partial", "unpaid", "installment"]) : "",
    q: random() < 0.5 ? pick([doc.displayNo || "", (doc.displayNo || "").slice(-5), doc.accountName.slice(0, int(3, 9)), doc.accountName.toLocaleUpperCase("tr-TR").slice(0, 6), "çimento", "P01", "a.ş", "zzz yok", "Hizmet Bedeli 1"]) : "",
    from: random() < 0.3 ? addDays(today, -int(0, 360)) : "",
    to: random() < 0.25 ? addDays(today, -int(0, 200)) : "",
    profile: random() < 0.12 ? pick(["TEMELFATURA", "EARSIVFATURA", "KAGIT"]) : "",
    account: random() < 0.12 ? doc.accountId : "",
    item: random() < 0.06 ? pick(info.items).id : "",
    offset: random() < 0.5 ? String(pick([0, 1, 199, 200, 400, 1000, 6000, 9999, 20000])) : "",
    limit: random() < 0.6 ? String(pick([1, 7, 200, 5000])) : "",
  });
}
let same = 0;
let rows = 0;
const diffs = [];
const timing = { eski: 0, yeni: 0 };
for (const combo of combos) {
  const params = new URLSearchParams(Object.entries(combo).filter(([, value]) => value !== ""));
  const url = `/api/workspace/invoices?${params}`;
  let t = performance.now();
  const a = await old.api.get(url);
  timing.eski += performance.now() - t;
  t = performance.now();
  const b = await neu.api.get(url);
  timing.yeni += performance.now() - t;
  const x = JSON.stringify(a.data);
  const y = JSON.stringify(b.data);
  rows += a.data?.data?.invoices?.length || 0;
  if (a.status === b.status && x === y) same += 1;
  else diffs.push({ url, eski: `${a.status} ${x.slice(0, 200)}`, yeni: `${b.status} ${y.slice(0, 200)}` });
}
const count = async api => (await api.get("/api/workspace/invoices?tab=all&limit=1")).data.data.total;
const result = { birlesim: combos.length, ayni: same, farkli: diffs.length, satir: rows, belgeEski: await count(old.api), belgeYeni: await count(neu.api), sureMs: { eski: Math.round(timing.eski), yeni: Math.round(timing.yeni) }, ilkFarklar: diffs.slice(0, 5) };
for (const s of [old, neu]) {
  s.child.send({ cmd: "close" });
  await new Promise(resolve => s.child.on("exit", resolve));
  rmSync(s.work, { recursive: true, force: true });
}
console.log(JSON.stringify(result, null, 1));
process.exitCode = diffs.length ? 1 : 0;
