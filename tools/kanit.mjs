// Kanıt kaydı (10.10.2026; CLAUDE.md → "Geçmiş test hatalarından dersler" 1, 2, 4, 16). Bir testin "geçti" sayılması için
// gerçek çıkış kodu + sayılar okunur ve depoya yazılır; ajan ya da insan beyanı kanıt değildir.
//
//   node tools/kanit.mjs kos <ad> [--sure <dk>] -- <komut> [arg…]   komutu koşar; docs/kanit/<gün>/<ad>.json + ham çıktı
//   node tools/kanit.mjs ci [commit]                                  o commit'in GitHub CI işlerini okur (gh gerekir)
//   node tools/kanit.mjs ozet [klasör]                                kayıtların tablosu; biri bile geçmediyse çıkış 1
//   node tools/kanit.mjs kapi <klasör> --commit <sha> --beklenen a,b,… [--ayni-sayi önek] [--atlanan-yok önek]
//                                     CI'nin "Doğrulama Kapısı" işi: bütün kayıtlar bu commit'te GEÇTİ, beklenenlerin hepsi var,
//                                     aynı önekli kayıtlar (Linux/Windows npm test) aynı sayıda test koştu, needs işleri başarılı
//   node tools/kanit.mjs durum [--hook]                               makine durumu: değişmiş dosya, gönderilmemiş commit, CI;
//                                     --hook: Claude Code Stop kancası (durum yeşil değilse bir kez durdurur, durumu yanıta dayatır)
//
// Hüküm: GEÇTİ yalnız çıkış 0 + tanınan özet + başarısız 0 + iptal 0 + en az 1 test. Çıkış 0 ama özet yoksa BELİRSİZ; çıkış 0 ama
// özette başarısız varsa (ya da tersi) ÇELİŞKİ — ikisi de geçmedi sayılır. Zaman aşımı/sinyal YARIDA.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// ROOT: aracın kendi deposu (imzalı paket kapısı onu denetler). WORK: aracın ÇAĞRILDIĞI klasörün deposu — kos komutu orada koşar, commit
// ve kirli dosya oradan okunur (10.10.2026: ana depodaki araç başka bir worktree'den çağrılınca komut ana depoda koşmuş, kayıt ana deponun
// commit'ini yazmıştı — doğrulama yanlış kodu koştu; kayıttaki commit alanı sayesinde fark edildi).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GZIP_OVER = 1024 * 1024;

const gitIn = cwd => (...args) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};
const WORK = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || process.cwd();
  } catch {
    return process.cwd();
  }
})();
const git = gitIn(WORK);
const KANIT = process.env.KANIT_DIR ? path.resolve(process.env.KANIT_DIR) : path.join(WORK, "docs", "kanit");

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
  const lines = status === null ? null : status.split("\n").filter(Boolean);
  return {
    commit: git("rev-parse", "HEAD"),
    dal: git("rev-parse", "--abbrev-ref", "HEAD"),
    // kirli: izlenen dosyada değişiklik (koşulan kod commit'ten farklı); izlenmeyen: yeni dosyalar (ör. önceki adımın artığı).
    kirli: lines === null ? null : lines.filter(line => !line.startsWith("??")).length,
    izlenmeyen: lines === null ? null : lines.filter(line => line.startsWith("??")).length,
    platform: `${process.platform} ${os.release()} ${process.arch}`,
    node: process.version,
    cpu: os.cpus().length,
    bellek_gb: Math.round(os.totalmem() / 2 ** 30),
  };
}

// Komut KABUKSUZ çalıştırılır: Windows'ta shell: true argümanları kaçışsız birleştirir (boşluklu argüman bölünür; CI koşu 474,
// 180a8a5, Windows Node 24). Windows'ta npm/npx birer .cmd dosyasıdır ve kabuksuz çalışmaz; onlar bu Node'un kendi npm-cli.js /
// npx-cli.js'iyle çalıştırılır. Başka .cmd/.bat komutu güvenle çalıştırılamaz, açıkça reddedilir.
export function resolveCommand(command, { platform = process.platform, execPath = process.execPath, env = process.env, exists = existsSync } = {}) {
  const [file, ...args] = command;
  if (!file) return { error: "komut yok" };
  if (platform !== "win32") return { file, args };
  const base = path.win32.basename(file).toLowerCase().replace(/\.(cmd|bat|exe)$/, "");
  if (base === "node") return { file: execPath, args };
  if (base === "npm" || base === "npx") {
    const candidates = [
      base === "npm" && env.npm_execpath && /npm-cli\.js$/i.test(env.npm_execpath) ? env.npm_execpath : null,
      path.win32.join(path.win32.dirname(execPath), "node_modules", "npm", "bin", `${base}-cli.js`),
    ].filter(Boolean);
    const cli = candidates.find(item => exists(item));
    if (!cli) return { error: `${base}-cli.js bulunamadı (${candidates.join(", ")}); komut kabuksuz çalıştırılamadı` };
    return { file: execPath, args: [cli, ...args] };
  }
  if (/\.(cmd|bat)$/i.test(file)) return { error: `${file}: Windows'ta .cmd/.bat komutu kabuksuz çalıştırılamaz` };
  return { file, args };
}

async function run(name, command, minutes) {
  if (!name || !command.length) throw new Error("kullanım: kos <ad> [--sure <dk>] -- <komut> [arg…]");
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(KANIT, day);
  mkdirSync(dir, { recursive: true });
  const env = environment();
  const started = new Date();
  const chunks = [];
  const target = resolveCommand(command);
  let timedOut = false;
  let timer = null;
  const { exitCode, signal } = target.error
    ? (chunks.push(Buffer.from(`[kanit] başlatılamadı: ${target.error}\n`)), { exitCode: null, signal: null })
    : await new Promise(resolve => {
        const child = spawn(target.file, target.args, { cwd: process.cwd(), env: process.env });
        if (minutes) timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, minutes * 60_000);
        for (const stream of [child.stdout, child.stderr]) {
          stream.on("data", data => {
            chunks.push(data);
            process.stdout.write(data);
          });
        }
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
    ham_cikti: path.relative(WORK, path.join(dir, logName)).split(path.sep).join("/"),
    klasor: WORK,
    ham_cikti_sha256: createHash("sha256").update(raw).digest("hex"),
    ham_cikti_bayt: raw.length,
  };
  writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  const s = summary ? `${summary.gecen}/${summary.toplam} geçti, ${summary.basarisiz} başarısız, ${summary.iptal} iptal, ${summary.atlanan} atlanan` : "özet yok";
  console.log(`\n[kanit] ${name}: ${result.hukum}${result.neden ? ` (${result.neden})` : ""} · çıkış ${exitCode} · ${s} · commit ${env.commit?.slice(0, 7)}${env.kirli ? ` +${env.kirli} değişmiş dosya` : ""}${env.izlenmeyen ? ` +${env.izlenmeyen} izlenmeyen` : ""} · ${env.platform} · Node ${env.node}`);
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

// GitHub CI (yalnız ci.yml koşuları): bir commit ancak bütün koşuları bitmiş, bütün işleri "success" ve içlerinde
// "Doğrulama Kapısı" işi varsa YEŞİL'dir. Atlanan iş (ör. test kırmızıyken "Dağıtım paketi") yeşil sayılmaz; kapısı olmayan
// (eski) commit YEŞİL değildir. gh okunamazsa BELİRSİZ.
export const GATE_JOB = "Doğrulama Kapısı";
const CI_WORKFLOW = ".github/workflows/ci.yml";

function repoSlug(gitFn = git) {
  const remote = gitFn("remote", "get-url", "origin") || "";
  return remote.replace(/\.git$/, "").match(/github\.com[/:]([^/]+\/[^/]+)$/)?.[1] || null;
}

const ghCli = args => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }));

export function ciState(sha, { gh = ghCli, gitFn = git } = {}) {
  const commit = gitFn("rev-parse", sha || "HEAD") || sha;
  const repo = repoSlug(gitFn);
  if (!commit || !repo) return { commit, result: "BELİRSİZ", reason: "commit ya da GitHub deposu bulunamadı", runs: [] };
  let runs;
  try {
    runs = gh([`repos/${repo}/actions/runs?head_sha=${commit}&per_page=50`]).workflow_runs.filter(run => run.path === CI_WORKFLOW);
    for (const run of runs) run.jobs = gh([`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`]).jobs;
  } catch (error) {
    return { commit, result: "BELİRSİZ", reason: `GitHub okunamadı: ${String(error.stderr || error.message).trim().split("\n")[0]}`, runs: [] };
  }
  if (!runs.length) return { commit, result: "BELİRSİZ", reason: "bu commit için CI koşusu yok (gönderilmemiş olabilir)", runs: [] };
  let pending = 0;
  let red = 0;
  let gate = false;
  for (const run of runs) {
    // Koşu sürerken sonraki işler (ör. kapı, "Dağıtım paketi") henüz listede olmayabilir; bitmemiş koşu hiçbir zaman yeşil değildir.
    if (run.status !== "completed") pending += 1;
    for (const job of run.jobs) {
      if (job.status !== "completed") pending += 1;
      else if (job.conclusion !== "success") red += 1;
      else if (job.name === GATE_JOB) gate = true;
    }
  }
  const result = red ? "KIRMIZI" : pending ? "BEKLİYOR" : gate ? "YEŞİL" : "KIRMIZI";
  const reason = red ? `${red} iş yeşil değil` : pending ? `${pending} iş/koşu sürüyor` : gate ? "" : `"${GATE_JOB}" işi yok`;
  return { commit, result, reason, runs: runs.map(run => ({ name: run.name, number: run.run_number, event: run.event, url: run.html_url, status: run.status, conclusion: run.conclusion, jobs: run.jobs.map(job => ({ name: job.name, status: job.status, conclusion: job.conclusion })) })) };
}

function printCi(state) {
  for (const run of state.runs) {
    console.log(`${run.name} #${run.number} (${run.event}) ${run.status}/${run.conclusion ?? "-"}  ${run.url}`);
    for (const job of run.jobs) console.log(`  ${(job.status !== "completed" ? "BEKLİYOR" : job.conclusion === "success" ? "YEŞİL" : `KIRMIZI (${job.conclusion})`).padEnd(22)} ${job.name}`);
  }
  console.log(`\n${String(state.commit).slice(0, 7)}: CI ${state.result}${state.reason ? ` (${state.reason})` : ""}`);
}

async function ciCommand(sha, waitMinutes) {
  const until = Date.now() + waitMinutes * 60_000;
  let state = ciState(sha);
  while (state.result === "BEKLİYOR" && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 30_000));
    state = ciState(sha);
  }
  printCi(state);
  return state.result === "YEŞİL" ? 0 : 1;
}

// CI'nin "Doğrulama Kapısı" işi. Kayıtlar test işlerinin yüklediği kanıt dosyalarıdır (tools/kanit.mjs kos); işlerin kendi
// sonuçları (needs) ayrıca okunur. Çıkış kodu ile kayıt çelişirse, bir platform eksik ya da az test koştuysa kapı kırmızıdır.
export function gateVerdict({ records, commit, expected = [], sameCount = [], noSkip = [], needs = null }) {
  const problems = [];
  const byName = new Map();
  for (const record of records) {
    if (byName.has(record.ad)) problems.push(`${record.ad}: iki kayıt var`);
    byName.set(record.ad, record);
  }
  for (const name of expected) if (!byName.has(name)) problems.push(`${name}: kayıt yok (koşmadı ya da yüklenmedi)`);
  for (const record of records) {
    if (record.hukum !== "GEÇTİ") problems.push(`${record.ad}: ${record.hukum}${record.neden ? ` — ${record.neden}` : ""}`);
    if (commit && record.commit !== commit) problems.push(`${record.ad}: başka commit'te koştu (${String(record.commit).slice(0, 7)} ≠ ${commit.slice(0, 7)})`);
    if (record.kirli) problems.push(`${record.ad}: çalışma ağacında ${record.kirli} değişmiş dosya varken koştu`);
  }
  for (const prefix of sameCount) {
    const group = records.filter(record => record.ad.startsWith(prefix));
    const counts = new Set(group.map(record => record.ozet?.toplam));
    if (group.length && counts.size !== 1) problems.push(`${prefix}*: platformlar farklı sayıda test koştu (${group.map(record => `${record.ad} ${record.ozet?.toplam ?? "?"}`).join(", ")})`);
  }
  for (const prefix of noSkip) {
    for (const record of records.filter(item => item.ad.startsWith(prefix) && item.ozet?.atlanan)) problems.push(`${record.ad}: ${record.ozet.atlanan} test atlandı (o platformda doğrulanmadı)`);
  }
  if (needs) {
    for (const [job, value] of Object.entries(needs)) if (value?.result !== "success") problems.push(`${job} işi: ${value?.result ?? "bilinmiyor"}`);
  }
  return { ok: problems.length === 0, problems };
}

function readRecords(dir) {
  const out = [];
  const walk = folder => {
    for (const name of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith(".json")) out.push(JSON.parse(readFileSync(full, "utf8")));
    }
  };
  try {
    walk(path.resolve(dir));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return out;
}

function gateCommand(args) {
  const opt = name => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : null;
  };
  const list = name => (opt(name) || "").split(",").map(item => item.trim()).filter(Boolean);
  const records = readRecords(args[0] || "kanit");
  const needs = process.env.NEEDS_JSON ? JSON.parse(process.env.NEEDS_JSON) : null;
  const result = gateVerdict({ records, commit: opt("--commit"), expected: list("--beklenen"), sameCount: list("--ayni-sayi"), noSkip: list("--atlanan-yok"), needs });
  const lines = [`## ${GATE_JOB}: ${result.ok ? "GEÇTİ" : "GEÇMEDİ"}`, "", "| Kayıt | Hüküm | Test | Geçen | Başarısız | İptal | Atlanan | Çıkış | Platform | Node | Süre |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const r of records.sort((a, b) => a.ad.localeCompare(b.ad))) {
    lines.push(`| ${r.ad} | ${r.hukum} | ${r.ozet?.toplam ?? "-"} | ${r.ozet?.gecen ?? "-"} | ${r.ozet?.basarisiz ?? "-"} | ${r.ozet?.iptal ?? "-"} | ${r.ozet?.atlanan ?? "-"} | ${r.cikis_kodu} | ${r.platform.split(" ")[0]} | ${r.node} | ${r.sure_sn} sn |`);
  }
  if (!result.ok) lines.push("", "### Sorunlar", ...result.problems.map(item => `- ${item}`));
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`, { flag: "a" });
  return result.ok ? 0 : 1;
}

// Makine durumu: yerelde değişmiş dosya, gönderilmemiş commit ve HEAD'in CI'si. Hepsi temiz ve CI YEŞİL değilse "doğrulandı"
// denemez. Claude Code Stop kancası olarak (--hook) durum yeşil değilse yanıtın bitmesini BİR KEZ durdurur ve durumu modele
// verir; ikinci denemede (stop_hook_active) bırakır ki döngü olmasın.
export function machineState({ gitFn = git, ciFn = ciState } = {}) {
  const status = gitFn("status", "--porcelain");
  const dirty = status === null ? null : status.split("\n").filter(Boolean).length;
  const upstream = gitFn("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  const ahead = upstream ? Number(gitFn("rev-list", "--count", "@{u}..HEAD")) : null;
  const head = gitFn("rev-parse", "HEAD");
  const ci = ciFn(head, { gitFn });
  const green = dirty === 0 && ahead === 0 && ci.result === "YEŞİL";
  const parts = [`HEAD ${String(head).slice(0, 7)}`, `CI ${ci.result}${ci.reason ? ` (${ci.reason})` : ""}`];
  if (dirty) parts.push(`${dirty} değişmiş/izlenmeyen dosya`);
  if (dirty === null) parts.push("git durumu okunamadı");
  if (ahead) parts.push(`${ahead} commit gönderilmedi`);
  if (upstream === null) parts.push("uzak dal yok (gönderilmemiş)");
  const jobs = ci.runs.flatMap(run => run.jobs.filter(job => job.status !== "completed" || job.conclusion !== "success").map(job => `${job.name}: ${job.status !== "completed" ? "sürüyor" : job.conclusion}`));
  return { green, line: parts.join(" · "), jobs, ci };
}

export function hookDecision(input, state) {
  if (state.green) return { code: 0, message: "" };
  if (input?.stop_hook_active) return { code: 0, message: "" };
  const message = [
    `KANIT KAPISI (makine durumu, kanca tarafından): ${state.line}`,
    ...state.jobs.map(job => `  - ${job}`),
    "Bu durumda yanıtta hiçbir iş \"doğrulandı\", \"geçti\", \"yeşil\" ya da \"tamamlandı\" diye bildirilemez. Yanıta bu durumu olduğu gibi",
    "yaz: hangi denetim sürüyor/kırmızı, neyin doğrulanmadığı. (CLAUDE.md → Geçmiş test hatalarından dersler 1, 2, 16.)",
  ].join("\n");
  return { code: 2, message };
}

// tools/release.mjs ve release.yml için: imzalı paket yalnız temiz çalışma ağacından ve CI'si (Windows dahil, kapı işiyle) YEŞİL
// commit'ten üretilir. Atlatma seçeneği yoktur.
export function releaseGate({ gitFn = gitIn(ROOT), ciFn = ciState } = {}) {
  const problems = [];
  const status = gitFn("status", "--porcelain");
  if (status === null) problems.push("git durumu okunamadı");
  else if (status.trim()) problems.push(`çalışma ağacında ${status.split("\n").filter(Boolean).length} değişmiş/izlenmeyen dosya var (paket commit'ten farklı olur)`);
  const head = gitFn("rev-parse", "HEAD");
  const ci = ciFn(head, { gitFn });
  if (ci.result !== "YEŞİL") problems.push(`CI ${ci.result}${ci.reason ? `: ${ci.reason}` : ""} (${String(head).slice(0, 7)})`);
  return { ok: problems.length === 0, problems, ci };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = name => {
    const at = rest.indexOf(name);
    return at >= 0 ? rest[at + 1] : null;
  };
  let code;
  if (cmd === "kos") {
    // kos <ad> [--sure <dk>] [--] <komut…>; "--" isteğe bağlı (Windows'ta PowerShell onu yutabilir).
    const [name, ...tail] = rest;
    let minutes = 0;
    let at = 0;
    if (tail[at] === "--sure") {
      minutes = Number(tail[at + 1]);
      at += 2;
    }
    if (tail[at] === "--") at += 1;
    code = await run(name, tail.slice(at), minutes);
  } else if (cmd === "ci") code = await ciCommand(rest[0] && !rest[0].startsWith("--") ? rest[0] : null, Number(opt("--bekle") || 0));
  else if (cmd === "ozet") code = summaryOf(rest[0]);
  else if (cmd === "kapi") code = gateCommand(rest);
  else if (cmd === "durum") {
    if (rest.includes("--hook")) {
      let input = {};
      try {
        input = JSON.parse(readFileSync(0, "utf8") || "{}");
      } catch {
        input = {};
      }
      // Kancada durum, kancayı tetikleyen oturumun (ya da yardımcı ajanın kendi worktree'sinin) klasöründen okunur.
      const state = machineState({ gitFn: input.cwd ? gitIn(input.cwd) : git });
      const decision = hookDecision(input, state);
      if (decision.message) process.stderr.write(`${decision.message}\n`);
      code = decision.code;
    } else {
      const state = machineState();
      console.log(state.line);
      for (const job of state.jobs) console.log(`  - ${job}`);
      code = state.green ? 0 : 1;
    }
  } else {
    console.log("kullanım: node tools/kanit.mjs kos <ad> [--sure <dk>] -- <komut…> | ci [commit] [--bekle <dk>] | ozet [klasör] | kapi <klasör> … | durum [--hook]");
    code = 2;
  }
  process.exit(code);
}
