// Lisans servisi izolasyonu (15.10.2026; Operatör Merkezi'nde "Sürüm 9.0.0 · Denemede" kayıtları): gerçek programı AYRI SÜREÇTE açan her test
// (supervisor, bootstrap.mjs, server.mjs) lisans servisini yerel ölü adrese yönlendirmek ZORUNDADIR; yoksa program açılıştan 3 sn sonra
// kendiliğinden deneme başlatır (lib/license.mjs autoTrial) ve GitHub koşucusundan GERÇEK operatör merkezine sahte "ofis" kaydı düşer
// (9.0.0 test paketi, Azure adresleri; lisans.installations). createApp ile aynı süreçte açılanlar `license: { enforce: false }` ile korunur.
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

const files = walk(path.join(ROOT, "test")).filter(file => path.resolve(file) !== fileURLToPath(import.meta.url));
const starters = files.filter(file => {
  const text = readFileSync(file, "utf8").split(/\r?\n/).filter(line => !line.trim().startsWith("//")).join("\n");
  return STARTERS.test(text) && /spawn\(|fork\(|execFile\(|execFileSync\(|startSupervisor\s*\(/.test(text);
});

test("gerçek programı ayrı süreçte açan her test lisans servisini yerel ölü adrese yönlendirir", () => {
  assert.ok(starters.length >= 7, `tarama en az 7 dosya bulmalı (bulunan ${starters.length}): ${starters.map(f => path.relative(ROOT, f)).join(", ")}`);
  const missing = starters.filter(file => !readFileSync(file, "utf8").includes("HUKUK_LICENSE_URL"));
  assert.deepEqual(missing.map(file => path.relative(ROOT, file)), [], "HUKUK_LICENSE_URL vermeyen başlatıcılar (gerçek lisans servisine deneme kaydı atar)");
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
