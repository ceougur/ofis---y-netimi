// dar kontrol D3 tur 6 — ek mutantlar (kopya: /dev/shm/dk-d3t6-yeni). Her mutant tek, dosya sonra geri yazılır.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const COPY = "/dev/shm/dk-d3t6-yeni";
const READER = "server/lib/devir/plan-reader.mjs";
const LINE = '  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? closeDaySql("p") :';
const K_LINE = '      closedAtK: row.status === "closed" && Boolean(row.closedAt) && String(row.closedAt).slice(0, 10) <= K,';
const ESKI = "test/devir-d3-eski-kapali-kart.test.mjs";
const files = (process.env.FILES || ESKI).split(",");
const M = [
  ["M65 yalnız closed_at", LINE, `  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? "COALESCE(p.closed_at, '')" :`],
  ["M66 tarihsiz", K_LINE, '      closedAtK: row.status === "closed" && (Boolean(row.closedAt) || true),'],
  ["MA MAX düşer (eşdeğer beklenir)", LINE, `  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? "COALESCE(p.closed_at, substr(p.updated_at, 1, 10))" :`],
  ["MB closed_at yok sayılır (yalnız updated_at)", LINE, `  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? "substr(p.updated_at, 1, 10)" :`],
  ["MC yedek oluşturma günü", LINE, `  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? "COALESCE(p.closed_at, substr(p.created_at, 1, 10))" :`],
  ["MD K günü hariç (<)", K_LINE, '      closedAtK: row.status === "closed" && Boolean(row.closedAt) && String(row.closedAt).slice(0, 10) < K,'],
  ["ME yedek K+1 kayması (updated_at yerine bugün)", LINE, `  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? "COALESCE(p.closed_at, date('now'))" :`],
];
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
for (const [ad, eski, yeni] of M) {
  if (only && !only.has(ad.split(" ")[0])) continue;
  const file = path.join(COPY, READER);
  const orig = readFileSync(file, "utf8");
  const n = orig.split(eski).length - 1;
  if (n !== 1) { console.log(`${ad}: KURULAMADI (${n})`); continue; }
  writeFileSync(file, orig.replace(eski, yeni));
  try {
    const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 << 20, timeout: 20 * 60_000, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const out = `${r.stdout}\n${r.stderr}`;
    const c = k => (out.match(new RegExp(`^# ${k} (\\d+)$`, "m")) || [])[1];
    const reds = [...out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(m => m[1]).filter(s => !/^D3 tur 6 —/.test(s)).slice(0, 5);
    console.log(`${ad}: çıkış ${r.status} tests ${c("tests")} pass ${c("pass")} fail ${c("fail")} — ${reds.join(" | ").slice(0, 400)}`);
  } finally {
    writeFileSync(file, orig);
  }
}
