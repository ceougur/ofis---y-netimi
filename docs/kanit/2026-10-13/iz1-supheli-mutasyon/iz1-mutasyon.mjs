// 2.3.0 İz 1 — mutasyon testi (CLAUDE.md KANIT KURALI 3: para çekirdeğine bilerek hata → testler yakalamalı).
// Her mutasyon çalışma ağacındaki dosyaya uygulanır, iki test dosyası koşulur, dosya aynen geri yazılır. Yakalanmayan mutasyon = eksik test.
// Çıktı: TAP benzeri özet (# tests/pass/fail) — tools/kanit.mjs kos bu satırları okur; ayrıntı tablo docs/kanit/<gün>/iz1-supheli-mutasyon.md.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
const OUT = process.argv[3];
if (!ROOT || !OUT) throw new Error("kullanım: node iz1-mutasyon.mjs <depo> <çıktı klasörü>");
const TESTS = ["test/banka-230-supheli.test.mjs", "test/banka-230-supheli-bozma.test.mjs"];
const MUTATIONS = [
  { name: "M1 işaret: Şüpheli Alacağa Al maddesi ters (B 120 / A 128)", file: "server/lib/doubtful-gl.mjs",
    from: 'lines: [{ account: DOUBTFUL_GL.doubtful, debit: record.amountMinor, credit: 0, party: record.party }, { account: control, debit: 0, credit: record.amountMinor, party: record.party }] });',
    to: 'lines: [{ account: DOUBTFUL_GL.doubtful, debit: 0, credit: record.amountMinor, party: record.party }, { account: control, debit: record.amountMinor, credit: 0, party: record.party }] });' },
  { name: "M2 tutar sınırı: alacak satırı kalanı aşsa da tamamı 128'den düşer", file: "server/lib/doubtful-gl.mjs",
    from: "          const minor = Math.min(left, s.remaining);\n          s.remaining -= minor;\n          s.collected += minor;",
    to: "          const minor = left;\n          s.remaining -= minor;\n          s.collected += minor;" },
  { name: "M3 644 kuralı: karşılık fazlası çözülmez", file: "server/lib/doubtful-gl.mjs",
    from: "          if (s.provision > s.remaining) {\n            const release = s.provision - s.remaining;",
    to: "          if (false) {\n            const release = s.provision - s.remaining;" },
  { name: "M4 hesap: değersizde karşılık kullanılmaz (hepsi 659)", file: "server/lib/doubtful-gl.mjs",
    from: "          const used = Math.min(minor, s.provision);\n          s.provision -= used;",
    to: "          const used = 0;\n          s.provision -= used;" },
  { name: "M5 çıkarma tutarı: kalan yerine alınan tutar", file: "server/lib/doubtful-gl.mjs",
    from: '          extras.push({ kind: "release", recordId: event.record.id, party, date: event.date, minor: s.remaining });',
    to: '          extras.push({ kind: "release", recordId: event.record.id, party, date: event.date, minor: event.record.amountMinor });' },
  { name: "M6 tarih: kayıt tarihinden önceki karşılık/değersiz/çıkarma kabul edilir", file: "server/lib/bank/doubtful.mjs",
    from: "    if (date < record.date) throw new HttpError(400,",
    to: "    if (false) throw new HttpError(400," },
  { name: "M7 tutar sınırı: zaten şüphelideki tutar sayılmaz (bakiye − açık yerine bakiye)", file: "server/lib/bank/doubtful.mjs",
    from: "    if (minor > room.roomMinor) {",
    to: "    if (minor > room.balanceMinor) {" },
  { name: "M8 karşılık sınırı: ayrılmış karşılık sayılmaz", file: "server/lib/bank/doubtful.mjs",
    from: "    if (state.provision + minor > state.remaining) {",
    to: "    if (minor > state.remaining) {" },
  { name: "M9 beklenen: 120'den kalan şüpheli düşülmez (kapı)", file: "server/routes/ledger.mjs",
    from: "      for (const [control, minor] of d.byControl) out[control] = roundMoney((out[control] || 0) - minor / 100);",
    to: "      for (const [control, minor] of d.byControl) out[control] = roundMoney((out[control] || 0) - 0 * minor);" },
  { name: "M10 kapanış: Şüpheliden Çıkar kapanış tarihini yazmaz", file: "server/lib/bank/doubtful.mjs",
    from: "store.run(\"UPDATE doubtful_receivables SET status = 'released', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'open'\", date, event.id,",
    to: "store.run(\"UPDATE doubtful_receivables SET status = 'released', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'open'\", '', event.id," },
  // M11 ilk hâli (PARTY_ACCOUNTS'tan 128'i çıkar) eşdeğer mutanttı: 128 satırları post() yerine doğrudan party ile kuruluyor; mutasyon kodu değiştirmiyordu.
  { name: "M11 cari bazında: 128 alacak satırı cariyi taşımaz (120 + 128 ≠ kart)", file: "server/lib/doubtful-gl.mjs",
    from: "    const inserted = hit.records.map(item => ({ account: DOUBTFUL_GL.doubtful, debit: 0, credit: item.minor, party: line.party, doubtful: item.recordId }));",
    to: "    const inserted = hit.records.map(item => ({ account: DOUBTFUL_GL.doubtful, debit: 0, credit: item.minor, doubtful: item.recordId }));" },
  { name: "M12 hedef: Değersiz Alacak satırı kendi kaydı yerine en eski kayıttan düşer", file: "server/lib/doubtful-gl.mjs",
    from: "      if (credit.target) {\n        const s = state.get(credit.target);",
    to: "      if (credit.target && false) {\n        const s = state.get(credit.target);" },
];
mkdirSync(OUT, { recursive: true });
// only: yalnız bu numaralı mutasyonlar koşar; öbür satırlar önceki JSON'dan korunur (M11 eşdeğer mutantının yeniden koşusu).
const ONLY = new Set((process.argv[4] || "").split(",").filter(Boolean).map(Number));
let rows = [];
try {
  if (ONLY.size) rows = JSON.parse(readFileSync(path.join(OUT, "iz1-supheli-mutasyon.json"), "utf8")).filter(row => !ONLY.has(row.no));
} catch {
  rows = [];
}
let killed = 0;
for (const [index, mutation] of MUTATIONS.entries()) {
  if (ONLY.size && !ONLY.has(index + 1)) continue;
  const file = path.join(ROOT, mutation.file);
  const original = readFileSync(file, "utf8");
  if (!original.includes(mutation.from)) throw new Error(`${mutation.name}: kaynak metin bulunamadı (${mutation.file})`);
  writeFileSync(file, original.replace(mutation.from, mutation.to));
  let result;
  try {
    result = spawnSync("node", ["--disable-warning=ExperimentalWarning", "--test", ...TESTS], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(file, original);
  }
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? -1);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? -1);
  const names = [...out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(m => m[1]).filter(name => !/^Şüpheli/.test(name)).slice(0, 4);
  const caught = result.status !== 0 && fail > 0;
  if (caught) killed += 1;
  writeFileSync(path.join(OUT, `m${index + 1}.log`), out);
  rows.push({ no: index + 1, name: mutation.name, file: mutation.file, exit: result.status, pass, fail, caught, sample: names });
  console.log(`${caught ? "YAKALANDI" : "KAÇTI    "} ${mutation.name} · çıkış ${result.status} · geçen ${pass}, düşen ${fail}${names.length ? ` · ${names[0].slice(0, 90)}` : ""}`);
}
rows.sort((a, b) => a.no - b.no);
const total = rows.length;
const caughtAll = rows.filter(row => row.caught).length;
const md = ["# İz 1 Şüpheli Alacak — mutasyon tablosu", "", `Kod: ${ROOT} · testler: ${TESTS.join(", ")} · ${new Date().toISOString()}`, "", "| # | Mutasyon | Dosya | Çıkış | Geçen | Düşen | Sonuç | Yakalayan test (örnek) |", "|---|---|---|---|---|---|---|---|",
  ...rows.map(row => `| ${row.no} | ${row.name} | ${row.file} | ${row.exit} | ${row.pass} | ${row.fail} | ${row.caught ? "YAKALANDI" : "KAÇTI"} | ${row.sample[0] ? row.sample[0].replace(/\|/g, "/").slice(0, 120) : ""} |`),
  "", `Toplam: ${caughtAll}/${total} mutasyon yakalandı.`];
writeFileSync(path.join(OUT, "iz1-supheli-mutasyon.md"), md.join("\n"));
writeFileSync(path.join(OUT, "iz1-supheli-mutasyon.json"), JSON.stringify(rows, null, 2));
const ran = ONLY.size ? ONLY.size : MUTATIONS.length;
console.log(`\n# tests ${ran}\n# pass ${killed}\n# fail ${ran - killed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(killed === ran ? 0 : 1);
