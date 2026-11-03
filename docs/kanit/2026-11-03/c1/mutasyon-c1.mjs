// 2.4.9 C1 — mutasyon testi (KANIT KURALI 3, ders 7): para çekirdeğine bilerek hata enjekte edilir, test/cari-hareket-249.test.mjs yakalamalı.
// Kopya: `git archive <commit> | tar -x -C <klasör>` (ders 23; çalışma ağacına dokunulmaz). Her mutasyondan sonra dosya geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-11-03/c1/mutasyon-c1.mjs --kopya <klasör>
// Çıktı: her mutasyon için YAKALANDI (test kırmızı) / KAÇTI (test yeşil); son satır "N denetim geçti, M başarısız" (geçti = yakalandı).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const at = process.argv.indexOf("--kopya");
const copy = at > 0 ? path.resolve(process.argv[at + 1]) : "";
if (!copy) throw new Error("--kopya <klasör> gerekli");
const LIB = "server/lib/account-movements.mjs";
const ROUTES = "server/routes/accounts.mjs";
const UNDO = "server/routes/plan-transfer.mjs";
const MUTATIONS = [
  ["M1 fatura sayacı yok", LIB, 'count("invoices", "SELECT COUNT(*) FROM invoices WHERE account_id = ?1")', '"0"'],
  ["M2 fatura yalnız kayıtlı (taslak/iptal sayılmaz)", LIB, '"SELECT COUNT(*) FROM invoices WHERE account_id = ?1")} AS invoices', "\"SELECT COUNT(*) FROM invoices WHERE account_id = ?1 AND status = 'issued'\")} AS invoices"],
  ["M3 mahsup sayacı yok", LIB, 'count("invoice_offsets", "SELECT COUNT(*) FROM invoice_offsets WHERE account_id = ?1")', '"0"'],
  ["M4 taksit kartı sayacı yok", LIB, 'count("plans", "SELECT COUNT(*) FROM plans WHERE account_id = ?1 AND deleted_at IS NULL")', '"0"'],
  ["M5 ciro alan cari sayılmaz", LIB, '"SELECT COUNT(*) FROM cheques WHERE deleted_at IS NULL AND (account_id = ?1 OR endorse_account_id = ?1)")} AS cheques', '"SELECT COUNT(*) FROM cheques WHERE deleted_at IS NULL AND account_id = ?1")} AS cheques'],
  ["M6 şüpheli alacak sayacı yok", LIB, 'count("doubtful_receivables", "SELECT COUNT(*) FROM doubtful_receivables WHERE account_id = ?1 AND status <> \'cancelled\'")', '"0"'],
  ["M7 banka fişi sayacı yok", LIB, "`${vouchersSql(have)} AS vouchers`", "`0 AS vouchers`"],
  ["M8 POS İptal İadesi (pos_sales bağı) sayılmaz", LIB, 'have.has("pos_sales") ? "EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id)" : ""', '""'],
  ["M9 yalnız elle satır (kaynaklı/yetim satır sayılmaz)", LIB, '"SELECT COUNT(*) FROM account_entries WHERE account_id = ?1")} AS allEntries', "\"SELECT COUNT(*) FROM account_entries WHERE account_id = ?1 AND source IN ('', 'bank')\")} AS allEntries"],
  ["M10 stok sayacı yok", LIB, 'count("account_entries", "SELECT COUNT(*) FROM account_entries WHERE account_id = ?1 AND source = \'stock\'")', '"0"'],
  ["M11 Silinenler'deki kart cari silmede sayılır (S1 B)", LIB, '"SELECT COUNT(*) FROM plans WHERE account_id = ?1 AND deleted_at IS NULL")} AS plans', '"SELECT COUNT(*) FROM plans WHERE account_id = ?1")} AS plans'],
  ["M12 kalıcı silmede Silinenler sayılmaz", LIB, 'trash: trashIndex ? Number(trashIndex.get(id)) || 0 : n("trashItems")', "trash: 0"],
  ["M13 dizin fatura yükünü bilmez", LIB, "[row.a, row.b]", "[row.a]"],
  ["M14 Geri Al silinmişleri saymaz", UNDO, "{ includeDeleted: true, trashIndex }", "{}"],
  ["M15 addEntry cari canlılığını denetlemez (yarış)", ROUTES, 'if (!exists(accountId)) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");', ""],
  ["M16 deleteBlock hareketi görmez", ROUTES, "if (found.total > 0) {", "if (found.total > 0 && false) {"],
  ["M17 pasif bilgisi yanlış", ROUTES, 'const passive = account.status === "passive";', "const passive = false;"],
];
let caught = 0;
let escaped = 0;
for (const [name, file, from, to] of MUTATIONS) {
  const full = path.join(copy, file);
  const original = readFileSync(full, "utf8");
  const hits = original.split(from).length - 1;
  if (hits !== 1) {
    console.log(`✗ ${name}: mutasyon uygulanamadı (${hits} eşleşme) — BAŞARISIZ sayılır`);
    escaped += 1;
    continue;
  }
  writeFileSync(full, original.replace(from, to));
  try {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "test/cari-hareket-249.test.mjs"], { cwd: copy, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, encoding: "utf8", timeout: 600_000 });
    const out = `${run.stdout}${run.stderr}`;
    const num = key => Number(out.match(new RegExp(`^# ${key} (\\d+)$`, "m"))?.[1] ?? NaN);
    const failed = out.split("\n").filter(line => /^\s*not ok \d+ - T/.test(line)).map(line => line.replace(/^\s*not ok \d+ - /, "").slice(0, 60));
    const red = run.status !== 0 && num("fail") > 0;
    if (red) caught += 1;
    else escaped += 1;
    console.log(`${red ? "✓ YAKALANDI" : "✗ KAÇTI"} ${name} · çıkış ${run.status} · tests ${num("tests")} pass ${num("pass")} fail ${num("fail")}${failed.length ? ` · kırmızı: ${failed.join(" | ")}` : ""}`);
  } finally {
    writeFileSync(full, original);
  }
}
console.log(`\n${caught} denetim geçti, ${escaped} başarısız`);
process.exit(escaped ? 1 : 0);
