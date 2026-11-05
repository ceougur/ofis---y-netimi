// W TUR 2 mutasyon koşucusu: her mutasyon AYRI kopyada (git archive <commit> | tar -x; çalışma ağacına dokunulmaz — ders 23, 25).
// Kullanım: node mutasyon.mjs <repo> <commit> <çıktı.json> [M1 M2 …]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [repo, commit, outFile, ...only] = process.argv.slice(2);
const BASE = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wt2-mut";
const K0 = "test/whatsapp-wt2-kod0-250.test.mjs";
const KAL = "test/whatsapp-w2-kaldir-250.test.mjs";
const VERI = "test/whatsapp-w2-veri-248.test.mjs";
const MUTS = [
  { id: "M1", what: "TOKEN_REJECT_CODES'tan 0 çıkar", file: "server/lib/whatsapp/connection.mjs", from: "Object.freeze([0, TOKEN_EXPIRED_CODE])", to: "Object.freeze([TOKEN_EXPIRED_CODE])", tests: [K0] },
  { id: "M2", what: "noteMetaError yalnız 190 (bağlantı 0'da Süresi Doldu olmaz)", file: "server/lib/whatsapp/connection.mjs", from: '|| !isTokenRejectCode(error.code)) return;', to: "|| Number(error.code) !== TOKEN_EXPIRED_CODE) return;", tests: [K0] },
  { id: "M3", what: "kuyruğun belirteç reddi dalı yalnız 190 (0 alan iş Başarısız)", file: "server/lib/whatsapp/queue.mjs", from: 'if (kind === "pause" && isTokenRejectCode(error.code)) {', to: 'if (kind === "pause" && Number(error.code) === 190) {', tests: [K0] },
  { id: "M4", what: "satırdaki neden sabit 190", file: "server/lib/whatsapp/queue.mjs", from: "(Meta hata kodu ${code}); ileti gönderilmedi.", to: "(Meta hata kodu 190); ileti gönderilmedi.", tests: [K0] },
  { id: "M5", what: "kodsuz Meta hatası koruması kalkar (Number(null) = 0)", file: "server/lib/whatsapp/connection.mjs", from: 'code => code !== null && code !== undefined && code !== "" && TOKEN_REJECT_CODES', to: "code => TOKEN_REJECT_CODES", tests: [K0] },
  { id: "M6", what: "Kaldır'da 0 nedeni 'hata kodu 0' (yalnız 190 süresi dolmuş)", file: "server/lib/whatsapp/connection.mjs", from: '(isTokenRejectCode(error.code) ? "erişim belirtecinin süresi dolmuş"', to: '(Number(error.code) === 190 ? "erişim belirtecinin süresi dolmuş"', tests: [K0] },
  { id: "M7", what: "sharedWaba güncel okuma yerine ortak kaydın bellekteki özeti (eski yol)", file: "server/routes/whatsapp.mjs", from: 'if (!companies?.list || typeof withCompanyDb !== "function") {', to: "if (true) {", tests: [KAL] },
  { id: "M8", what: "sharedWaba okunan özet yerine her zaman kayıttaki özet", file: "server/routes/whatsapp.mjs", from: "if (usesWaba(summary ?? whatsapp?.registry?.get?.(company.id))) return true;", to: "if (usesWaba(whatsapp?.registry?.get?.(company.id))) return true;", tests: [KAL] },
  { id: "M9", what: "sharedWaba silinen şirketleri de sayar (yalnız kayıt, exists yok)", file: "server/routes/whatsapp.mjs", from: "return Object.entries(whatsapp?.registry?.snapshot?.() || {}).some(([id, item]) => id !== String(companyId) && usesWaba(item) && exists(id));\n    }", to: "return Object.entries(whatsapp?.registry?.snapshot?.() || {}).some(([id, item]) => id !== String(companyId) && usesWaba(item) && exists(id));\n    }\n    if (Object.entries(whatsapp?.registry?.snapshot?.() || {}).some(([id, item]) => id !== String(companyId) && usesWaba(item))) return true;", tests: [KAL] },
  { id: "M10", what: "meta-graph.mjs redact kaldırılır (Meta'nın metni arındırılmaz)", file: "server/lib/whatsapp/meta-graph.mjs", from: 'const details = clip(redact(failure.error_data?.details || failure.message || "", token), 200);', to: 'const details = clip(failure.error_data?.details || failure.message || "", 200);', tests: [VERI] },
];

const results = [];
for (const mut of MUTS.filter(item => !only.length || only.includes(item.id))) {
  const dir = path.join(BASE, `${mut.id}-${commit}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const tar = execFileSync("git", ["-C", repo, "archive", commit], { maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  symlinkSync(path.join("/home/user/ofis---y-netimi", "node_modules"), path.join(dir, "node_modules"));
  const file = path.join(dir, mut.file);
  const text = readFileSync(file, "utf8");
  const count = text.split(mut.from).length - 1;
  if (count !== 1) {
    results.push({ id: mut.id, what: mut.what, error: `kalıp ${count} kez bulundu` });
    continue;
  }
  writeFileSync(file, text.replace(mut.from, mut.to));
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...mut.tests], { cwd: dir, encoding: "utf8", env: { ...process.env, TZ: "UTC", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, timeout: 900_000, maxBuffer: 1 << 28 });
  const num = key => Number((run.stdout.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1] ?? NaN);
  const failed = [...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]).filter(name => !name.startsWith("2.5.0") && !name.startsWith("2.4.8"));
  const sub = [...run.stdout.matchAll(/^    not ok \d+ - (.+)$/gm)].map(match => match[1].slice(0, 110));
  results.push({ id: mut.id, what: mut.what, exit: run.status, tests: num("tests"), pass: num("pass"), fail: num("fail"), caught: run.status !== 0 && num("fail") > 0, failedTests: sub, other: failed });
  writeFileSync(path.join(BASE, `${mut.id}-${commit}.log`), run.stdout + run.stderr);
  rmSync(dir, { recursive: true, force: true });
}
writeFileSync(outFile, JSON.stringify(results, null, 1));
console.log(results.map(r => `${r.id} ${r.caught ? "YAKALANDI" : "SAĞ"} exit=${r.exit} ${r.pass}/${r.tests} fail=${r.fail} ${r.error || ""} — ${r.what}`).join("\n"));
process.exitCode = results.every(item => item.caught) ? 0 : 1;
