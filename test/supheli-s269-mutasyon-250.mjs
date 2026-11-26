#!/usr/bin/env node
// 2.5.0 UD turu 4 — S269 = A / S268 = A mutasyon testi (KANIT KURALI 3; ders 7; kalıp test/tyk-mutasyon-250.mjs API mutantları): her düzeltmenin karşı mutantı programın AYRI tam
// kopyasına (server, client, test; node_modules bağı — npm ci YOK, ders 23, 25, 29) enjekte edilir; seçili testler her mutantta KIRMIZI olmalı. Taban (mutantsız) yeşil değilse koşulmaz.
// Kullanım: node test/supheli-s269-mutasyon-250.mjs [--klasor <boş geçici klasör>] [--yalniz S1,S2]. Ekran mutantları Chromium ister (PLAYWRIGHT_BROWSERS_PATH ortamdan).
// Çıkış 0 yalnız bütün mutantlar öldüyse. Yük koşusudur: `flock -s scratchpad/olcum.lock` ile başlatılır (ders 52).
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const base = path.resolve(argv.includes("--klasor") ? argv[argv.indexOf("--klasor") + 1] : path.join(tmpdir(), `s269-mutasyon-${process.pid}`));
const ONLY = argv.includes("--yalniz") ? new Set(String(argv[argv.indexOf("--yalniz") + 1] || "").split(",").filter(Boolean)) : null;
const wanted = id => !ONLY || ONLY.has(id);
const API = ["test/supheli-degersiz-s269-250.test.mjs"];
const E2E = "test/e2e/senaryo-supheli-kuyruk-250.mjs";
const SERVER = "server/lib/bank/doubtful.mjs";
const CLIENT = "client/assets/hof-accounts.js";
// [kimlik, karar, dosya, eski metin, yeni metin, koşu: "api" | "e2e"]
const MUTANTS = [
  ["S1", "S269 geri — Değersiz Yaz'da 'kayıt kapalı' denetimi o günün bağlı payını saymaz (sınır yalnız tutar denetiminde)", SERVER, "const { record, state, share } = openRecord(accountId, did, { writeOffOn: dayOf });", "const { record, state, share } = openRecord(accountId, did);", "api"],
  ["S2", "S269 geri — Silinenler'den Değersiz geri yüklemesinde 'kayıt kapalı' denetimi bağlı payı saymaz", SERVER, "openRecord(payload.accountId, payload.recordId, { writeOffOn: () => payload.date });", "openRecord(payload.accountId, payload.recordId);", "api"],
  ["S3", "S269 geri — kapalı denetimi ortak yerde bağlı payı yok sayar (iki yol birden)", SERVER, "if (record.status !== \"open\" || !s || s.remaining + extra <= 0) {", "if (record.status !== \"open\" || !s || s.remaining <= 0) {", "api"],
  ["S4", "S268 geri — listenin yazılabilir tutarı yalnız kalan (bağlı pay ipucuna gitmez; sunucu)", SERVER, "return { writeOffRoomMinor: Math.max(0, best), writeOffRoomDate: bestDate };", "return { writeOffRoomMinor: state.remaining, writeOffRoomDate: \"\" };", "api"],
  ["S5", "S268 — bağlı payın günü bildirilmez (form bugünle açılır, sınır o günde)", SERVER, "      best = room;\n      bestDate = day;", "      best = room;", "api"],
  ["C1", "S268 geri — form ipucu ve önerilen tutar yalnız kalandan (istemci yazılabilir tutarı kullanmaz)", CLIENT, "const room = Math.max(record.remainingMinor, Number(record.writeOffRoomMinor) || 0);", "const room = record.remainingMinor;", "e2e"],
  ["C2", "S269 geri — kalanı 0 görünen kayıtta Değersiz Alacak Yaz düğmesi gizli", CLIENT, "record.status === \"open\" && record.writeOffRoomMinor > 0 ?", "false ?", "e2e"],
  ["C3", "S268 — form tarihi bağlı payın gününe kurulmaz (bugün)", CLIENT, "value: roomDate || office().todayIso?.() || \"\" },", "value: office().todayIso?.() || \"\" },", "e2e"],
];

rmSync(base, { recursive: true, force: true });
const full = path.join(base, "tam");
mkdirSync(full, { recursive: true });
for (const dir of ["server", "client", "test", "tools"]) cpSync(path.join(ROOT, dir), path.join(full, dir), { recursive: true });
cpSync(path.join(ROOT, "package.json"), path.join(full, "package.json"));
symlinkSync(realpathSync(path.join(ROOT, "node_modules")), path.join(full, "node_modules"), "junction");
const env = { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const count = (out, name) => Number((out.match(new RegExp(`^# ${name} (\\d+)`, "m")) || [])[1] || 0);
const runApi = () => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...API], { cwd: full, encoding: "utf8", timeout: 600_000, env });
const runE2e = () => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", E2E], { cwd: full, encoding: "utf8", timeout: 900_000, env });
const e2eCount = out => {
  const m = out.match(/senaryo-supheli-kuyruk-250: (\d+) geçti, (\d+) kaldı/);
  return m ? { pass: Number(m[1]), fail: Number(m[2]) } : { pass: 0, fail: 0 };
};
const rows = [];
let killed = 0;
let total = 0;
const baseApi = runApi();
const needE2e = MUTANTS.some(m => wanted(m[0]) && m[5] === "e2e");
const baseE2e = needE2e ? runE2e() : null;
rows.push(`TABAN API: tests ${count(baseApi.stdout, "tests")}, pass ${count(baseApi.stdout, "pass")}, fail ${count(baseApi.stdout, "fail")}, çıkış ${baseApi.status}`);
if (baseE2e) rows.push(`TABAN EKRAN: ${JSON.stringify(e2eCount(baseE2e.stdout))}, çıkış ${baseE2e.status}`);
if (baseApi.status === 0 && (!baseE2e || baseE2e.status === 0)) {
  for (const [id, label, file, from, to, kind] of MUTANTS) {
    if (!wanted(id)) continue;
    total += 1;
    const target = path.join(full, file);
    const original = readFileSync(target, "utf8");
    const hits = original.split(from).length - 1;
    if (hits !== 1) {
      rows.push(`${id} ENJEKTE EDİLEMEDİ (${hits} eşleşme) — ${label}`);
      continue;
    }
    writeFileSync(target, original.replace(from, to));
    const run = kind === "api" ? runApi() : runE2e();
    writeFileSync(target, original);
    let dead;
    let detail;
    if (kind === "api") {
      dead = run.status !== 0 && count(run.stdout, "fail") > 0;
      const failed = [...run.stdout.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map(m => m[1]).filter(name => !/^S269 = A \/ S268 = A — /.test(name)).slice(0, 3);
      detail = `tests ${count(run.stdout, "tests")}, pass ${count(run.stdout, "pass")}, fail ${count(run.stdout, "fail")}${dead ? ` · öldüren: ${failed.join(" | ").slice(0, 300)}` : ""}`;
    } else {
      const c = e2eCount(run.stdout);
      dead = run.status !== 0 && c.fail > 0;
      const failed = run.stdout.split(/\r?\n/).filter(line => /^\s*✗/.test(line)).slice(0, 3).map(line => line.trim().slice(0, 160));
      detail = `ekran ${c.pass} geçti, ${c.fail} kaldı${dead ? ` · öldüren: ${failed.join(" | ")}` : ""}`;
    }
    if (dead) killed += 1;
    rows.push(`${id} ${dead ? "ÖLDÜ" : "YAŞADI"} (${detail}) — ${label}`);
  }
} else rows.push("TABAN KIRMIZI — mutantlar koşulmadı");
rmSync(base, { recursive: true, force: true });
for (const row of rows) console.log(row);
console.log(`# tests ${total}\n# pass ${killed}\n# fail ${total - killed}`);
process.exitCode = total > 0 && killed === total ? 0 : 1;
