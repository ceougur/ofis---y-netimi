// Lisans servisi izolasyonu (15.10.2026; Operatör Merkezi'nde "Sürüm 9.0.0 · Denemede" kayıtları): gerçek programı AYRI SÜREÇTE açan her test
// (supervisor, bootstrap.mjs, server.mjs) lisans servisini yerel ölü adrese yönlendirmek ZORUNDADIR; yoksa program açılıştan 3 sn sonra
// kendiliğinden deneme başlatır (lib/license.mjs autoTrial) ve GitHub koşucusundan GERÇEK operatör merkezine sahte "ofis" kaydı düşer
// (9.0.0 test paketi, Azure adresleri; lisans.installations). createApp ile aynı süreçte açılanlar `license: { enforce: false }` ile korunur.
// 2.4.4 (E9, Operatör Merkezi'nde Azure adresli yayımlanmamış "2.4.5"): tarama yalnız test/ altındaydı; gerçek kurulum paketini Windows
// servisi olarak kuran iş akışı (.github/workflows/windows.yml install-test; servis ortamı nssm'den, HUKUK_LICENSE_URL GEÇMEZ) ve tools/ altındaki
// araçlar taranmıyordu. Artık: tools/ de taranır; programı kuran/başlatan her iş akışı işi, kurulumdan ÖNCE lisans adlarını yerel adrese
// yönlendirir (tools/lisans-nobetci.mjs engelle) ve nöbetçiyle (denetle + iş sonunda gunluk) servise ulaşılmadığını kanıtlar; aynı süreçte
// lisans uygulaması açık createApp çağrısı da zamanlayıcıyı kapatır.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const STARTERS = /startSupervisor\s*\(|["'`]bootstrap\.mjs["'`]|"server",\s*"server\.mjs"|"server",\s*"supervisor\.mjs"|supervisor\.mjs"\)\]/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "artifacts" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

const rel = file => path.relative(ROOT, file).split(path.sep).join("/");
const withoutComments = text => text.split(/\r?\n/).filter(line => !line.trim().startsWith("//")).join("\n");
const files = [...walk(path.join(ROOT, "test")), ...walk(path.join(ROOT, "tools"))].filter(file => path.resolve(file) !== fileURLToPath(import.meta.url));
// Başlatıcı desenine uyan ama programı AÇMAYAN dosyalar (gerekçeli; dosya kalkarsa liste de güncellenir).
const NOT_STARTERS = {
  "tools/build-windows.mjs": "kurulum paketini derler (bootstrap.mjs'i pakete kopyalar, windres/go çağırır); programı açmaz",
};
const starters = files.filter(file => {
  const text = withoutComments(readFileSync(file, "utf8"));
  return STARTERS.test(text) && /spawn\(|fork\(|execFile\(|execFileSync\(|startSupervisor\s*\(/.test(text) && !NOT_STARTERS[rel(file)];
});

test("gerçek programı ayrı süreçte açan her test ve araç (test/ + tools/) lisans servisini yerel ölü adrese yönlendirir", () => {
  assert.ok(starters.length >= 7, `tarama en az 7 dosya bulmalı (bulunan ${starters.length}): ${starters.map(rel).join(", ")}`);
  for (const file of Object.keys(NOT_STARTERS)) assert.ok(files.some(item => rel(item) === file), `istisna listesindeki dosya yok: ${file}`);
  const missing = starters.filter(file => !readFileSync(file, "utf8").includes("HUKUK_LICENSE_URL"));
  assert.deepEqual(missing.map(rel), [], "HUKUK_LICENSE_URL vermeyen başlatıcılar (gerçek lisans servisine deneme kaydı atar)");
});

// ---- Aynı süreçte açılan program (createApp): lisans uygulaması açık ve zamanlayıcı açıksa 3 sn sonra gerçek servise deneme atar. ----
// Güvenli: uygulama kapalı (enforce: false), zamanlayıcı kapalı, sahte/yerel servis (services/licenseServices) ya da bunları veren bilinen
// yardımcı/değişken (dosyada tanımı denetlenir).
const SAFE_CREATEAPP = /enforce:\s*false|startLicenseTimers:\s*false|licenseServices|\bservices:/;
const SAFE_HELPERS = /\b(appOptions|baseOptions)\(|license:\s*(licenseOptions|unlicensed|LICENSE)\b|\.\.\.(common|overrides|options)\b/;
function createAppCalls(file) {
  // Yorum satırları boşaltılır (satır numarası korunur).
  const text = readFileSync(file, "utf8").split(/\r?\n/).map(line => (line.trim().startsWith("//") ? "" : line)).join("\n");
  const calls = [];
  let index = -1;
  while ((index = text.indexOf("createApp(", index + 1)) >= 0) {
    if (/(function\s+|\.)$/.test(text.slice(Math.max(0, index - 12), index)) || /[A-Za-z0-9_$]$/.test(text.slice(index - 1, index))) continue;
    let depth = 0;
    let end = index + "createApp".length;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    calls.push({ line: text.slice(0, index).split("\n").length, call: text.slice(index, end + 1) });
  }
  return calls;
}

test("aynı süreçte gerçek programı açan her createApp çağrısı (test/ + tools/) lisans servisine deneme atamaz", () => {
  const unsafe = [];
  let total = 0;
  for (const file of files) {
    for (const { line, call } of createAppCalls(file)) {
      total++;
      if (SAFE_CREATEAPP.test(call)) continue;
      // Yardımcı/değişken adı: dosyada güvenli bir tanımı olmalı (ör. run.mjs licenseOptions = { services: [sahte] }).
      const helper = call.match(SAFE_HELPERS);
      if (helper && SAFE_CREATEAPP.test(withoutComments(readFileSync(file, "utf8")))) continue;
      unsafe.push(`${rel(file)}:${line}: ${call.replace(/\s+/g, " ").slice(0, 140)}`);
    }
  }
  assert.ok(total >= 20, `tarama en az 20 createApp çağrısı bulmalı (bulunan ${total})`);
  assert.deepEqual(unsafe, [], "lisans uygulaması açık, zamanlayıcısı açık createApp çağrıları (startLicenseTimers: false ya da license: { enforce: false } verin)");
});

// ---- İş akışları (.github/workflows): gerçek kurulum paketini kuran/servisi başlatan iş. ----
// Windows servisi (nssm) adımın env'ini almaz → HUKUK_LICENSE_URL verilemez; engel koşucu makinesinde kurulur (hosts) ve nöbetçi kanıtlar.
const RUNS_PROGRAM = /Start-Process\s+\$setup|\/VERYSILENT|Restart-Service\s+DestekOfis|Start-Service\s+DestekOfis|windows-kurulum\.mjs|\bnssm(\.exe)?\s+start/;
function workflowJobs(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const start = lines.findIndex(line => /^jobs:\s*$/.test(line));
  if (start < 0) return [];
  const jobs = [];
  for (let i = start + 1; i < lines.length; i++) {
    const header = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) jobs.push({ name: header[1], lines: [] });
    else if (jobs.length) jobs.at(-1).lines.push(lines[i]);
  }
  return jobs;
}
// Adım: "- name:" ya da "- uses:" ile başlayan blok.
function stepAt(lines, index) {
  let from = index;
  while (from > 0 && !/^\s*- (name|uses|run):/.test(lines[from])) from--;
  let to = index + 1;
  while (to < lines.length && !/^\s*- (name|uses|run):/.test(lines[to])) to++;
  return lines.slice(from, to).join("\n");
}
const workflowFiles = readdirSync(path.join(ROOT, ".github", "workflows")).filter(name => /\.ya?ml$/.test(name)).map(name => path.join(ROOT, ".github", "workflows", name));

test("gerçek kurulum paketini kuran/servisi başlatan her iş akışı işi lisans servisini önce engeller, nöbetçiyle kanıtlar", () => {
  const problems = [];
  const guarded = [];
  for (const file of workflowFiles) {
    for (const job of workflowJobs(file)) {
      const code = job.lines.map(line => (line.trim().startsWith("#") ? "" : line));
      const first = code.findIndex(line => RUNS_PROGRAM.test(line));
      if (first < 0) continue;
      const last = code.findLastIndex(line => RUNS_PROGRAM.test(line));
      const where = `${rel(file)} ${job.name}`;
      guarded.push(where);
      const block = code.findIndex(line => /node tools\/lisans-nobetci\.mjs engelle\b/.test(line));
      const check = code.findIndex(line => /node tools\/lisans-nobetci\.mjs denetle\b/.test(line));
      const logs = code.findIndex(line => /node tools\/lisans-nobetci\.mjs gunluk\b/.test(line));
      if (block < 0 || block > first) problems.push(`${where}: "lisans-nobetci.mjs engelle" programı kuran/başlatan ilk satırdan ("${code[first].trim().slice(0, 60)}") ÖNCE yok`);
      else if (/^\s*if:|continue-on-error:\s*true/m.test(stepAt(code, block))) problems.push(`${where}: engel adımı koşullu ya da hatası yutuluyor`);
      if (check < 0 || check < first) problems.push(`${where}: kurulumdan sonra nöbetçi ("lisans-nobetci.mjs denetle") yok`);
      else if (/continue-on-error:\s*true/.test(stepAt(code, check))) problems.push(`${where}: nöbetçi adımının hatası yutuluyor`);
      if (logs < last) problems.push(`${where}: son program adımından sonra günlük nöbetçisi ("lisans-nobetci.mjs gunluk") yok`);
      else if (!/if:\s*always\(\)/.test(stepAt(code, logs)) || /continue-on-error:\s*true/.test(stepAt(code, logs))) problems.push(`${where}: günlük nöbetçisi "if: always()" ile ve hatası yutulmadan koşmalı`);
    }
  }
  assert.ok(guarded.includes(".github/workflows/windows.yml install-test"), `windows.yml install-test taramada bulunmalı (bulunan: ${guarded.join(", ") || "yok"})`);
  assert.deepEqual(problems, []);
});

test("iş akışlarında lisans servisi adresi gerçek servise çevrilmez", () => {
  const bad = [];
  for (const file of workflowFiles) {
    for (const match of readFileSync(file, "utf8").matchAll(/HUKUK_LICENSE_URL\s*[:=]\s*["']?([^\s"']*)/g)) {
      if (!/^http:\/\/127\.0\.0\.1:\d+/.test(match[1])) bad.push(`${rel(file)}: ${match[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("lisans servisi adresi yalnız yerel ölü adres ya da yerel sahte servistir", () => {
  const bad = [];
  for (const file of starters) {
    for (const match of readFileSync(file, "utf8").matchAll(/HUKUK_LICENSE_URL\s*[:=]\s*(["'`])([^"'`]*)\1/g)) {
      if (!/^http:\/\/127\.0\.0\.1:\d+/.test(match[2]) && !/^\$\{/.test(match[2])) bad.push(`${path.relative(ROOT, file)}: ${match[2]}`);
    }
  }
  assert.deepEqual(bad, []);
});
