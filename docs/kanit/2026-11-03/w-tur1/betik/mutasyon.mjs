// W düzeltme turu 1 — mutasyonlar: düzeltme commit'inin (6fd4d020) AYRI kopyasında (git archive; ders 23, 25) tek değişiklik, değişen test dosyası koşulur.
// Her kopya benzersiz klasörde açılır, koşudan sonra yalnız kendi tam yoluyla silinir (ders 36). npm komutu YOK (ders 29): node_modules ana depoya sembolik bağ.
// Kullanım: node mutasyon.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a89b8c1dbc09f146e";
const SP = "/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/w-tur1-a89b8c1d";
const COMMIT = "6fd4d020";
const TEST = "test/whatsapp-w2-onbellek-249.test.mjs";
const MUTATIONS = [
  {
    ad: "MT1-ttl-onizlemeden-yazilir",
    file: "server/lib/whatsapp/templates.mjs",
    from: "    delete meta[META_D0_W5.ttlField]; // teslim süresi listeden alınmaz; kayıttaki (Denetle'nin) değer korunur\n",
    to: "",
  },
  {
    ad: "MT2-denetle-suresi-korunmaz",
    file: "server/lib/whatsapp/templates.mjs",
    from: "    if (before.meta && Object.hasOwn(before.meta, META_D0_W5.ttlField)) meta[META_D0_W5.ttlField] = before.meta[META_D0_W5.ttlField];\n",
    to: "",
  },
  {
    ad: "M08-donem-korumasi-yok",
    file: "server/lib/whatsapp/queue.mjs",
    from: "    if ((templateEpoch.get(record.wabaId) || 0) !== epoch) return result;\n",
    to: "",
    dis: true,
  },
];
const only = process.argv[2] || "";
const results = [];
for (const m of MUTATIONS) {
  if (only && m.ad !== only) continue;
  const dir = path.join(SP, `mut-${m.ad}-${COMMIT}`);
  if (existsSync(dir)) throw new Error(`klasör zaten var: ${dir}`);
  mkdirSync(dir, { recursive: true });
  try {
    const tar = execFileSync("git", ["-C", WT, "archive", COMMIT], { maxBuffer: 1024 * 1024 * 1024 });
    execFileSync("tar", ["-x", "-C", dir], { input: tar });
    symlinkSync("/home/user/ofis---y-netimi/node_modules", path.join(dir, "node_modules"));
    const target = path.join(dir, m.file);
    const text = readFileSync(target, "utf8");
    const count = text.split(m.from).length - 1;
    if (count !== 1) throw new Error(`${m.ad}: değiştirilecek metin ${count} kez bulundu (1 olmalı)`);
    writeFileSync(target, text.replace(m.from, m.to));
    const env = { ...process.env, KANIT_DIR: path.join(WT, "docs", "kanit"), HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
    const run = spawnSync("node", [path.join(WT, "tools/kanit.mjs"), "kos", `w-tur1/mutasyon-${m.ad}`, "--", "node", "--test", "--test-reporter=tap", TEST], { cwd: dir, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });
    const tail = (run.stdout || "").split("\n").filter(line => line.startsWith("[kanit]")).pop() || "";
    results.push({ ad: m.ad, cikis: run.status, ozet: tail });
    if (m.dis) {
      const dis = spawnSync("node", [path.join(WT, "tools/kanit.mjs"), "kos", `w-tur1/dis-surerken-kapi-${m.ad}`, "--", "node", "--test", "--test-reporter=tap", path.join(SP, "betik/surerken-kapi-dis.test.mjs")], { cwd: dir, env: { ...env, KOK: dir }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });
      const sonuc = (dis.stdout || "").split("\n").filter(line => line.includes("SONUC") || line.startsWith("[kanit]"));
      results.push({ ad: `dis-${m.ad}`, cikis: dis.status, ozet: sonuc.join(" | ") });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
for (const r of results) console.log(`${r.ad}: çıkış ${r.cikis} — ${r.ozet}`);
