// W TUR 2 DÜŞÜK D1 — dar kontrolün mutasyonları (X1–X8; dk-wt2-c8e1/betik/mut.mjs'ten AYNEN kalıplar). Ders 23: her mutasyon AYRI `git archive <BASE>` kopyasında; yeni test
// dosyaları çalışma ağacından üstüne konur (ürün kodu BASE'deki gibi). Çalışma ağacına dokunulmaz. Kullanım: BASE=c83f21c6 node mut.mjs [X1 X2 …]
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wt2-d1-a7b3";
const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-aabef37e4fca15eb3";
const BASE = process.env.BASE || "c83f21c6";
const TZ = process.env.MUT_TZ || "UTC";
const K0 = "test/whatsapp-wt2-kod0-250.test.mjs";
const KAL = "test/whatsapp-w2-kaldir-250.test.mjs";
const ROUTE = "server/routes/whatsapp.mjs";
const CONN = "server/lib/whatsapp/connection.mjs";
const MUTS = [
  { id: "X1", what: "sharedWaba aynı veri dosyasını gösteren şirketi atlamaz (selfKey denetimi kalkar)", file: ROUTE, from: "      if (selfKey && dataKeyOf(company) === selfKey) continue;\n", to: "" },
  { id: "X2", what: "sharedWaba okunan özeti ortak kayda yazmaz (kayıt tazelenmez)", file: ROUTE, from: "          whatsapp?.registry?.set?.(company.id, summary);\n", to: "" },
  { id: "X3", what: "okunamayan (bozuk) dosya 'bağlı değil' sayılır (ders 4 ihlali)", file: ROUTE, from: "      } catch {\n        summary = null;\n      }", to: "      } catch {\n        summary = { configured: false };\n      }" },
  { id: "X4", what: "dosyası olmayan şirket 'bağlı değil' sayılır (kayıttaki özet geçmez)", file: ROUTE, from: "        if (value !== null && value !== undefined) {", to: "        if (true) {" },
  { id: "X5", what: "sharedWaba silinen şirketi de sayar: liste yerine ortak kaydın bütün girdileri", file: ROUTE, from: "    for (const company of companies.list()) {", to: "    for (const company of [...companies.list(), ...Object.keys(whatsapp?.registry?.snapshot?.() || {}).filter(id => !companies.get(id)).map(id => ({ id, dir: `sirketler/yok-${id}` }))]) {" },
  { id: "X6", what: "102 de belirteç reddi sayılır (kararın dışı — kapsam taşması)", file: CONN, from: "Object.freeze([0, TOKEN_EXPIRED_CODE])", to: "Object.freeze([0, 102, TOKEN_EXPIRED_CODE])" },
  { id: "X7", what: "noteMetaError 'daha önce çalıştı' koşulunu yalnız 190'da uygular (0'da her belirteç Süresi Doldu)", file: CONN, from: "    if (!tokenWorked(current) && Number(error.subcode) !== TOKEN_EXPIRED_SUBCODE) return;", to: "    if (Number(error.code) === TOKEN_EXPIRED_CODE && !tokenWorked(current) && Number(error.subcode) !== TOKEN_EXPIRED_SUBCODE) return;" },
  { id: "X8", what: "noteMetaError 'belirteç arada değişti' koşulunu yalnız 190'da uygular", file: CONN, from: "    if (!current || current.tokenSealed !== record.tokenSealed || current.tokenExpired) return;", to: "    if (!current || (Number(error.code) === TOKEN_EXPIRED_CODE && current.tokenSealed !== record.tokenSealed) || current.tokenExpired) return;" },
];
const only = process.argv.slice(2);
const noMut = only.includes("YOK"); // mutasyonsuz kopya (taban yeşil mi)
const results = [];
for (const mut of noMut ? [{ id: "YOK", what: "mutasyon yok (taban)" }] : MUTS.filter(item => !only.length || only.includes(item.id))) {
  const COPY = path.join(DIR, `kopya-${mut.id}-${BASE}`);
  rmSync(COPY, { recursive: true, force: true });
  mkdirSync(COPY, { recursive: true });
  execSync(`git -C ${WT} archive ${BASE} | tar -x -C ${COPY}`);
  for (const t of [K0, KAL]) copyFileSync(path.join(WT, t), path.join(COPY, t));
  symlinkSync("/home/user/ofis---y-netimi/node_modules", path.join(COPY, "node_modules"));
  try {
    if (mut.file) {
      const file = path.join(COPY, mut.file);
      const original = readFileSync(file, "utf8");
      const count = original.split(mut.from).length - 1;
      if (count !== 1) {
        results.push({ id: mut.id, error: `kalıp ${count} kez` });
        continue;
      }
      writeFileSync(file, original.replace(mut.from, mut.to));
    }
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", K0, KAL], { cwd: COPY, encoding: "utf8", env: { ...process.env, TZ, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, timeout: 1_200_000, maxBuffer: 1 << 28 });
    const num = key => Number((run.stdout.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1] ?? NaN);
    const sub = [...run.stdout.matchAll(/^    not ok \d+ - (.+)$/gm)].map(m => m[1].slice(0, 140));
    // Başarısız denetimin iletisi (ders 38): her "not ok"tan sonraki ilk "error:" satırı.
    const errs = [...run.stdout.matchAll(/^    not ok \d+ - [^\n]*\n(?:[^\n]*\n){0,12}?\s+error: ([^\n]+)/gm)].map(m => m[1].slice(0, 260));
    results.push({ id: mut.id, what: mut.what, exit: run.status, tests: num("tests"), pass: num("pass"), fail: num("fail"), cancelled: num("cancelled"), caught: run.status !== 0 && num("fail") > 0, failed: sub, errors: errs });
    writeFileSync(path.join(DIR, `mut-${mut.id}-${BASE}-${TZ.replace("/", "-")}.log`), run.stdout + run.stderr);
  } finally {
    unlinkSync(path.join(COPY, "node_modules"));
    rmSync(COPY, { recursive: true, force: true });
  }
}
writeFileSync(path.join(DIR, `mut-sonuc-${BASE}-${TZ.replace("/", "-")}.json`), JSON.stringify(results, null, 1));
console.log(results.map(r => `${r.id} ${r.caught ? "YAKALANDI" : "SAĞ"} exit=${r.exit} ${r.pass}/${r.tests} fail=${r.fail} ${r.error || ""} — ${r.what}${r.failed?.length ? `\n    ${r.failed.join("\n    ")}` : ""}${r.errors?.length ? `\n    İLETİ: ${r.errors.join("\n    İLETİ: ")}` : ""}`).join("\n"));
