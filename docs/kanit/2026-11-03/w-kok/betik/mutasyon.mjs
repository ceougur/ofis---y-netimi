// 2.4.9 W-KÖK — mutasyonlar: düzeltme commit'inin AYRI kopyasında (git archive; ders 23, 25) tek değişiklik, yeni test dosyası koşulur; her mutasyon en az bir
// hücreyi beklenen nedenle kırmızı yapmalı (ders 7, 38). Her kopya benzersiz klasörde açılır, koşudan sonra yalnız kendi tam yoluyla silinir (ders 36). npm komutu YOK
// (ders 29): node_modules ana depoya sembolik bağ (yalnız kopyada).
// Kullanım: node mutasyon.mjs <düzeltme commit'i> [mutasyon adı]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-aac20c1ad5b639b84";
const SP = "/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/w-kok-aac20c1a";
const [COMMIT, only = ""] = process.argv.slice(2);
if (!COMMIT) throw new Error("kullanım: node mutasyon.mjs <commit> [ad]");
const TEST = "test/whatsapp-w-kok-ttl-249.test.mjs";
const T = "server/lib/whatsapp/templates.mjs";
const Q = "server/lib/whatsapp/queue.mjs";
const MUTATIONS = [
  // Kabul anı yok sayılır: günlükteki son (güncel) değer — eski davranışın biçimi.
  { ad: "MK1-guncel-deger", file: T, from: "    return Math.max(known, later);\n", to: "    return log.at(-1).seconds;\n" },
  // Uzama yok sayılır: yalnız kabul anındaki süre.
  { ad: "MK2-uzama-yok", file: T, from: "    return Math.max(known, later);\n", to: "    return known;\n" },
  // Günlük tek adım (yalnız son değişim).
  { ad: "MK3-tek-adim", file: T, from: "    if (log.length) next[def.name] = log.slice(-TTL_SINCE_MAX).map(", to: "    if (log.length) next[def.name] = log.slice(-1).map(" },
  // İlk değişimden önce kabul edilen iş (süre bilinmiyordu) ilk görülen değeri alır.
  { ad: "MK4-bilinmeyen-ilk-deger", file: T, from: "    let known = META_DEFAULT_TTL_SECONDS; // ilk değişimden önce kabul", to: "    let known = log[0].seconds; // ilk değişimden önce kabul" },
  // Gönderim çekirdeğinin taze okuması süreyi öğretmez (kâhin A1 kök nedeni).
  { ad: "MK5-cekirdek-ogrenmez", file: Q, from: "        noteDeliveryTtl(store, record.wabaId, listing.items, readAt);\n", to: "" },
  // Şablonları Denetle süreyi öğretmez.
  { ad: "MK6-denetle-ogrenmez", file: T, from: "      noteDeliveryTtl(store, record.wabaId, found.filter(Boolean), listedAt);\n", to: "" },
  // Geç dönen eski okuma yeni bilgiyi ezer.
  { ad: "MK7-eski-okuma-ezer", file: T, from: " && (!last || readMs >= last.ms)) {", to: ") {" },
  // Bozuk günlük kısmen okunur.
  { ad: "MK8-bozuk-kismen", file: T, from: "|| (log.length && ms < log.at(-1).ms)) return [];", to: "|| (log.length && ms < log.at(-1).ms)) continue;" },
  // Satır başına ayar okuması (ders 47).
  {
    ad: "MK9-satir-basina-okuma",
    file: Q,
    from: "        if (acceptedMs + ttlOf(row.waba_id, row.template)(acceptedMs) * 1000 + HOUR >= nowMs()) continue;",
    to: "        if (acceptedMs + deliveryTtlRules(store)(row.waba_id, row.template)(acceptedMs) * 1000 + HOUR >= nowMs()) continue;",
  },
];
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
    const env = { ...process.env, KANIT_DIR: path.join(WT, "docs", "kanit"), HUKUK_LICENSE_URL: "http://127.0.0.1:9", TZ: "Europe/Istanbul" };
    const run = spawnSync("node", [path.join(WT, "tools/kanit.mjs"), "kos", `w-kok/mutasyon-${m.ad}`, "--", "node", "--disable-warning=ExperimentalWarning", "--test", "--test-reporter=tap", TEST], { cwd: dir, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 900_000 });
    const tail = (run.stdout || "").split("\n").filter(line => line.startsWith("[kanit]")).pop() || "";
    const failed = (run.stdout || "").split("\n").filter(line => line.startsWith("  ✖")).map(line => line.slice(0, 260));
    results.push({ ad: m.ad, cikis: run.status, ozet: tail, failed });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
for (const r of results) {
  console.log(`${r.ad}: çıkış ${r.cikis} — ${r.ozet}`);
  for (const line of r.failed) console.log(`    ${line}`);
}
console.log(`SONUC ${results.filter(r => r.cikis !== 0).length}/${results.length} mutasyon yakalandı`);
