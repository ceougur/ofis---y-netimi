// M2T2: p6 ölçümü — VERI (p6-uret.mjs) klasörünün KOPYASI üzerinde ROOT kodu: liste (GET doubtful), form ucu (GET write-off), cari kartı; olay döngüsü en çok; /proc/loadavg.
// ROOT=<kod> VERI=<veri klasörü> TEKRAR=5 node p6-olc.mjs
import { pathToFileURL } from "node:url";
import path from "node:path";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
const ROOT = process.env.ROOT, VERI = process.env.VERI, N = Number(process.env.TEKRAR || 5);
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const work = mkdtempSync(path.join(tmpdir(), "m2t2-olc-"));
cpSync(path.join(VERI, "data"), path.join(work, "data"), { recursive: true });
const { party, recs } = JSON.parse(readFileSync(path.join(VERI, "ids.json"), "utf8"));
const TODAY = "2026-10-15", ACC = "/api/workspace/accounts";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
const loop = monitorEventLoopDelay({ resolution: 5 });
const time = async (label, fn) => {
  const xs = [];
  let out;
  loop.reset();
  loop.enable();
  for (let i = 0; i < N; i += 1) {
    const t = process.hrtime.bigint();
    out = await fn();
    xs.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  loop.disable();
  xs.sort((x, y) => x - y);
  console.log(label, "ms medyan", xs[Math.floor(N / 2)].toFixed(1), "en az", xs[0].toFixed(1), "en çok", xs[N - 1].toFixed(1), "olay döngüsü en çok ms", (loop.max / 1e6).toFixed(1), "durum", out.status);
  return out;
};
const list = await time("liste (GET doubtful)", () => api.get(`${ACC}/${party}/doubtful`));
console.log("liste kayıt", list.data?.records?.length, "writeOff[0]", JSON.stringify(list.data?.records?.[0]?.writeOff ?? null));
await time("cari kartı (GET account)", () => api.get(`${ACC}/${party}`));
if (list.data?.records?.[0]?.writeOff !== undefined) {
  const q = await time("form ucu (GET write-off 01.03)", () => api.get(`${ACC}/${party}/doubtful/${recs[0]}/write-off?date=2026-03-01`));
  console.log("uç", JSON.stringify({ limit: q.data?.limitMinor, offer: q.data?.offerMinor, best: q.data?.best?.date, any: q.data?.anyMinor }));
}
console.log("loadavg", readFileSync("/proc/loadavg", "utf8").trim());
server.close();
rmSync(work, { recursive: true });
