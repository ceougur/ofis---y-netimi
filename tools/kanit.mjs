// Kanıt kaydı (10.10.2026; CLAUDE.md → "Geçmiş test hatalarından dersler" 1, 2, 4, 16). Bir testin "geçti" sayılması için
// gerçek çıkış kodu + sayılar okunur ve depoya yazılır; ajan ya da insan beyanı kanıt değildir.
//
//   node tools/kanit.mjs kos <ad> [--sure <dk>] -- <komut> [arg…]   komutu koşar; docs/kanit/<gün>/<ad>.json + ham çıktı
//   node tools/kanit.mjs ci [commit]                                  o commit'in GitHub CI işlerini okur (gh gerekir)
//   node tools/kanit.mjs ozet [klasör]                                kayıtların tablosu; biri bile geçmediyse çıkış 1
//
// Hüküm: GEÇTİ yalnız çıkış 0 + tanınan özet + başarısız 0 + iptal 0 + en az 1 test. Çıkış 0 ama özet yoksa BELİRSİZ; çıkış 0 ama
// özette başarısız varsa (ya da tersi) ÇELİŞKİ — ikisi de geçmedi sayılır. Zaman aşımı/sinyal YARIDA.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KANIT = process.env.KANIT_DIR ? path.resolve(process.env.KANIT_DIR) : path.join(ROOT, "docs", "kanit");
const GZIP_OVER = 1024 * 1024;

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const last = (text, regex) => {
  let match = null;
  for (const m of text.matchAll(regex)) match = m;
  return match;
};

// Projedeki test koşucularının özet satırları. Tanınmayan çıktı BELİRSİZ'dir; buraya biçim eklenmeden "geçti" denmez.
export function parseSummary(text) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  const node = {};
  for (const key of ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const m = last(clean, new RegExp(`^\\s*(?:#|ℹ)\\s+${key}\\s+(\\d+)\\s*$`, "gm"));
    if (m) node[key] = Number(m[1]);
  }
  if (node.tests !== undefined && node.pass !== undefined && node.fail !== undefined) {
    return { bicim: "node:test", toplam: node.tests, gecen: node.pass, basarisiz: node.fail, iptal: node.cancelled ?? 0, atlanan: (node.skipped ?? 0) + (node.todo ?? 0) };
  }
  let m = last(clean, /(\d+) geçti, (\d+) kaldı/g);
  if (m) return { bicim: "senaryo", toplam: Number(m[1]) + Number(m[2]), gecen: Number(m[1]), basarisiz: Number(m[2]), iptal: 0, atlanan: 0 };
  m = last(clean, /(\d+) denetim geçti, (\d+) başarısız/g);
  if (m) return { bicim: "senaryo", toplam: Number(m[1]) + Number(m[2]), gecen: Number(m[1]), basarisiz: Number(m[2]), iptal: 0, atlanan: 0 };
  m = last(clean, /(\d+)\s*\/\s*(\d+) (?:denetim|kontrol) geçti/g);
  if (m) return { bicim: "senaryo", toplam: Number(m[2]), gecen: Number(m[1]), basarisiz: Number(m[2]) - Number(m[1]), iptal: 0, atlanan: 0 };
  m = last(clean, /(\d+) adım başarılı\./g);
  if (m) return { bicim: "e2e-run", toplam: Number(m[1]), gecen: Number(m[1]), basarisiz: 0, iptal: 0, atlanan: 0 };
  // test:mutabakat — tohum başına bir "Tohum n:" satırı ve ardından ✓ ya da ✗ UYUŞMAZLIK.
  const seeds = [...clean.matchAll(/^Tohum \d+: /gm)].length;
  if (seeds) {
    const bad = [...clean.matchAll(/✗ UYUŞMAZLIK/g)].length;
    const good = [...clean.matchAll(/✓ Her işlemden sonra/g)].length;
    return { bicim: "mutabakat", toplam: seeds, gecen: good, basarisiz: bad, iptal: Math.max(0, seeds - good - bad), atlanan: 0 };
  }
  // test:guvenilirlik — "✓ Tohum n · taban …" ya da "✗ …".
  const okSeeds = [...clean.matchAll(/^✓ Tohum \d+ · taban /gm)].length;
  const badSeeds = [...clean.matchAll(/^✗ /gm)].length;
  if (okSeeds || badSeeds) return { bicim: "guvenilirlik", toplam: okSeeds + badSeeds, gecen: okSeeds, basarisiz: badSeeds, iptal: 0, atlanan: 0 };
  m = last(clean, /(\d+)\/(\d+) dosya sözdizimi denetiminden geçti/g);
  if (m) return { bicim: "check", toplam: Number(m[2]), gecen: Number(m[1]), basarisiz: Number(m[2]) - Number(m[1]), iptal: 0, atlanan: 0 };
  return null;
}

export function verdict({ exitCode, signal, timedOut, summary }) {
  if (timedOut || signal) return { hukum: "YARIDA", neden: timedOut ? "zaman aşımı" : `sinyal ${signal}` };
  if (!summary) return { hukum: exitCode === 0 ? "BELİRSİZ" : "BAŞARISIZ", neden: "özet satırı tanınmadı" };
  const bad = summary.basarisiz > 0 || summary.iptal > 0;
  if (exitCode === 0 && bad) return { hukum: "ÇELİŞKİ", neden: `çıkış 0 ama özet: ${summary.basarisiz} başarısız, ${summary.iptal} iptal` };
  if (exitCode !== 0 && !bad) return { hukum: "ÇELİŞKİ", neden: `özet temiz ama çıkış ${exitCode}` };
  if (exitCode !== 0) return { hukum: "BAŞARISIZ", neden: `çıkış ${exitCode}; ${summary.basarisiz} başarısız, ${summary.iptal} iptal` };
  if (!summary.toplam) return { hukum: "BELİRSİZ", neden: "hiç test koşmadı" };
  return { hukum: "GEÇTİ", neden: summary.atlanan ? `${summary.atlanan} atlanan/todo` : "" };
}

function environment() {
  const status = git("status", "--porcelain");
  return {
    commit: git("rev-parse", "HEAD"),
    dal: git("rev-parse", "--abbrev-ref", "HEAD"),
    kirli: status === null ? null : status.split("\n").filter(Boolean).length,
    platform: `${process.platform} ${os.release()} ${process.arch}`,
    node: process.version,
    cpu: os.cpus().length,
    bellek_gb: Math.round(os.totalmem() / 2 ** 30),
  };
}

async function run(name, command, minutes) {
  if (!name || !command.length) throw new Error("kullanım: kos <ad> [--sure <dk>] -- <komut> [arg…]");
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(KANIT, day);
  mkdirSync(dir, { recursive: true });
  const env = environment();
  const started = new Date();
  const chunks = [];
  const child = spawn(command[0], command.slice(1), { cwd: ROOT, shell: process.platform === "win32", env: process.env });
  let timedOut = false;
  const timer = minutes ? setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, minutes * 60_000) : null;
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", data => {
      chunks.push(data);
      process.stdout.write(data);
    });
  }
  const { exitCode, signal } = await new Promise(resolve => {
    child.on("error", error => {
      chunks.push(Buffer.from(`\n[kanit] başlatılamadı: ${error.message}\n`));
      resolve({ exitCode: null, signal: null });
    });
    child.on("close", (code, sig) => resolve({ exitCode: code, signal: sig }));
  });
  if (timer) clearTimeout(timer);
  const raw = Buffer.concat(chunks);
  const summary = parseSummary(raw.toString("utf8"));
  const result = verdict({ exitCode, signal, timedOut, summary });
  const logName = raw.length > GZIP_OVER ? `${name}.log.gz` : `${name}.log`;
  writeFileSync(path.join(dir, logName), raw.length > GZIP_OVER ? gzipSync(raw) : raw);
  const record = {
    ad: name,
    komut: command.join(" "),
    ...env,
    basladi: started.toISOString(),
    sure_sn: Math.round((Date.now() - started.getTime()) / 100) / 10,
    cikis_kodu: exitCode,
    sinyal: signal,
    zaman_asimi: timedOut,
    ozet: summary,
    ...result,
    ham_cikti: path.relative(ROOT, path.join(dir, logName)).split(path.sep).join("/"),
    ham_cikti_sha256: createHash("sha256").update(raw).digest("hex"),
    ham_cikti_bayt: raw.length,
  };
  writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  const s = summary ? `${summary.gecen}/${summary.toplam} geçti, ${summary.basarisiz} başarısız, ${summary.iptal} iptal, ${summary.atlanan} atlanan` : "özet yok";
  console.log(`\n[kanit] ${name}: ${result.hukum}${result.neden ? ` (${result.neden})` : ""} · çıkış ${exitCode} · ${s} · commit ${env.commit?.slice(0, 7)}${env.kirli ? ` +${env.kirli} değişmiş dosya` : ""} · ${env.platform} · Node ${env.node}`);
  return result.hukum === "GEÇTİ" ? 0 : 1;
}

function summaryOf(dir) {
  const target = dir ? path.resolve(dir) : path.join(KANIT, new Date().toISOString().slice(0, 10));
  const records = readdirSync(target).filter(name => name.endsWith(".json")).map(name => JSON.parse(readFileSync(path.join(target, name), "utf8")));
  if (!records.length) {
    console.log(`${target}: kayıt yok — BELİRSİZ`);
    return 1;
  }
  for (const r of records.sort((a, b) => a.basladi.localeCompare(b.basladi))) {
    const s = r.ozet ? `${r.ozet.gecen}/${r.ozet.toplam}` : "-";
    console.log(`${r.hukum.padEnd(9)} ${r.ad.padEnd(34)} ${s.padStart(11)}  çıkış ${String(r.cikis_kodu).padEnd(4)} ${r.commit?.slice(0, 7)}${r.kirli ? "*" : " "} ${r.platform.split(" ")[0]} ${r.node}  ${r.neden || ""}`);
  }
  const bad = records.filter(r => r.hukum !== "GEÇTİ");
  console.log(`\n${records.length} kayıt: ${records.length - bad.length} GEÇTİ, ${bad.length} geçmedi${bad.length ? ` (${bad.map(r => `${r.ad}: ${r.hukum}`).join(", ")})` : ""}.`);
  return bad.length ? 1 : 0;
}

// GitHub CI: commit'in BÜTÜN koşularındaki BÜTÜN işler. Biri sürüyorsa BEKLİYOR, biri yeşil değilse KIRMIZI; atlanan iş de yeşil
// sayılmaz (ör. "Dağıtım paketi" test kırmızıyken atlanır).
function ci(sha) {
  const commit = git("rev-parse", sha || "HEAD");
  const remote = git("remote", "get-url", "origin") || "";
  const repo = remote.replace(/\.git$/, "").match(/github\.com[/:]([^/]+\/[^/]+)$/)?.[1];
  if (!repo) throw new Error(`GitHub deposu bulunamadı (${remote})`);
  const gh = args => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
  const runs = gh([`repos/${repo}/actions/runs?head_sha=${commit}&per_page=50`]).workflow_runs;
  if (!runs.length) {
    console.log(`${commit.slice(0, 7)}: CI koşusu yok — BELİRSİZ`);
    return 1;
  }
  let pending = 0;
  let red = 0;
  for (const run of runs) {
    const jobs = gh([`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`]).jobs;
    console.log(`${run.name} #${run.run_number} (${run.event}) ${run.status}/${run.conclusion ?? "-"}  ${run.html_url}`);
    for (const job of jobs) {
      const state = job.status !== "completed" ? "BEKLİYOR" : job.conclusion === "success" ? "YEŞİL" : `KIRMIZI (${job.conclusion})`;
      if (job.status !== "completed") pending += 1;
      else if (job.conclusion !== "success") red += 1;
      console.log(`  ${state.padEnd(22)} ${job.name}`);
    }
    // Koşu sürerken sonraki işler (ör. "Dağıtım paketi") henüz listede olmayabilir; bitmemiş koşu hiçbir zaman yeşil değildir.
    if (run.status !== "completed") pending += 1;
  }
  const result = red ? "KIRMIZI" : pending ? "BEKLİYOR" : "YEŞİL";
  console.log(`\n${commit.slice(0, 7)}: CI ${result}${red ? ` (${red} iş kırmızı)` : ""}${pending ? ` (${pending} iş/koşu sürüyor)` : ""}`);
  return result === "YEŞİL" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  let code;
  if (cmd === "kos") {
    const dash = rest.indexOf("--");
    const head = dash < 0 ? rest : rest.slice(0, dash);
    const minutesAt = head.indexOf("--sure");
    const minutes = minutesAt >= 0 ? Number(head[minutesAt + 1]) : 0;
    code = await run(head[0], dash < 0 ? [] : rest.slice(dash + 1), minutes);
  } else if (cmd === "ci") code = ci(rest[0]);
  else if (cmd === "ozet") code = summaryOf(rest[0]);
  else {
    console.log("kullanım: node tools/kanit.mjs kos <ad> [--sure <dk>] -- <komut…> | ci [commit] | ozet [klasör]");
    code = 2;
  }
  process.exit(code);
}
