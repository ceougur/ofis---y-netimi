// BİRLEŞİK TUR 1 mutasyon koşucusu: kaynak ağacın (yeni kod) kopyasını açar, tek bir değişiklik enjekte eder, ilgili test dosyasını koşar, sonucu yazar.
// Kullanım: node mutasyon.mjs <kaynak ağaç> <çalışma klasörü> <çıktı .txt>
// Her mutasyon kendi kopyasında (ders 23); kopyada node_modules ana depoya bağlıdır (ders 29); bitince kopya (önce bağ) tam yoluyla silinir (ders 36).
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const [SRC, WORK, OUT] = process.argv.slice(2).map(item => path.resolve(item));
const MUTANTS = [
  { id: "M1", what: "cari: işlem içi yeniden okuma kaldırıldı (prepare bayat satırla)", file: "server/routes/accounts.mjs", from: "        const previous = entryOf(account.id, opened.id);\n", to: "        const previous = opened;\n        entryOf(account.id, opened.id);\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M2", what: "stok: işlem içi yeniden okuma kaldırıldı", file: "server/routes/stock.mjs", from: "        const previous = moveOf(item.id, opened.id);\n", to: "        const previous = opened;\n        moveOf(item.id, opened.id);\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M3", what: "taksit: işlem içi yeniden okuma kaldırıldı", file: "server/routes/plans.mjs", from: "        const previous = entryOf(plan.id, opened.id);\n", to: "        const previous = opened;\n        entryOf(plan.id, opened.id);\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M4", what: "Kasa: işlem içi yeniden okuma kaldırıldı", file: "server/routes/cash.mjs", from: "        const previous = existing(opened.id);\n", to: "        const previous = opened;\n        existing(opened.id);\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5", what: "iyimser kilit: karşılaştırma kaldırıldı (yardımcı hiç 409 vermez)", file: "server/lib/row-version.mjs", from: "  throw new HttpError(409, message, { code, updatedAt: updated || created });\n", to: "  return;\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5a", what: "iyimser kilit: cari ucunda çağrı kaldırıldı", file: "server/routes/accounts.mjs", from: "        assertRowVersion(body, rowVersion(store, \"account_entries\", previous.id), ENTRY_STALE);\n", to: "", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5b", what: "iyimser kilit: stok ucunda çağrı kaldırıldı", file: "server/routes/stock.mjs", from: "        assertRowVersion(body, rowVersion(store, \"stock_moves\", previous.id), MOVE_STALE);\n", to: "", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5c", what: "iyimser kilit: taksit ucunda çağrı kaldırıldı", file: "server/routes/plans.mjs", from: "        assertRowVersion(body, rowVersion(store, \"plan_entries\", previous.id), ENTRY_STALE);\n", to: "", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5d", what: "iyimser kilit: Kasa ucunda çağrı kaldırıldı", file: "server/routes/cash.mjs", from: "        assertRowVersion(body, rowVersion(store, \"cash_entries\", previous.id), ENTRY_STALE);\n", to: "", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M5e", what: "iyimser kilit: boş sürüm her zaman geçer (truthy kalıbı)", file: "server/lib/row-version.mjs", from: "  if (sent === updated || (!updated && sent === created)) return;\n", to: "  if (!sent || sent === updated || (!updated && sent === created)) return;\n", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M8", what: "Kasa: transferin öbür tarafı denetimi kaldırıldı", file: "server/routes/cash.mjs", from: "        if (pairedAtOpen && !twin) throw new HttpError(404, TWIN_GONE);\n", to: "", test: "test/birlesik-tur1-yaris-250.test.mjs" },
  { id: "M6", what: "Değişiklik Geçmişi: Object.hasOwn kaldırıldı (eski AUDIT_GROUPS[type] || [type])", file: "server/routes/admin.mjs", from: "    const prefixes = Object.hasOwn(AUDIT_GROUPS, type) ? AUDIT_GROUPS[type] : [type];\n", to: "    const prefixes = AUDIT_GROUPS[type] || [type];\n", test: "test/defter-turu-c4.test.mjs" },
  { id: "M7", what: "BS-4: meşgul şirketin HttpError'ı yutuldu (companies.mjs 'if (error instanceof HttpError) throw error;' silindi)", file: "server/routes/companies.mjs", from: "        if (error instanceof HttpError) throw error;\n", to: "", test: "test/bs4-birlesik-rapor-250.test.mjs" },
];
const only = process.env.MUTANT ? new Set(process.env.MUTANT.split(",")) : null;
mkdirSync(WORK, { recursive: true });
writeFileSync(OUT, `# mutasyon koşusu ${new Date().toISOString()} kaynak ${SRC} TZ=${process.env.TZ || "(yerel)"}\n`);
const skip = new Set(["node_modules", ".git", "kanit"]);
for (const mutant of MUTANTS) {
  if (only && !only.has(mutant.id)) continue;
  const copy = path.join(WORK, mutant.id);
  rmSync(copy, { recursive: true, force: true });
  cpSync(SRC, copy, { recursive: true, filter: source => !skip.has(path.basename(source)) });
  symlinkSync("/home/user/ofis---y-netimi/node_modules", path.join(copy, "node_modules"));
  const target = path.join(copy, mutant.file);
  const source = readFileSync(target, "utf8");
  const hits = source.split(mutant.from).length - 1;
  if (hits !== 1) {
    appendFileSync(OUT, `${mutant.id} UYGULANAMADI (eşleşme ${hits}) — ${mutant.what}\n`);
    continue;
  }
  writeFileSync(target, source.replace(mutant.from, mutant.to));
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", mutant.test], { cwd: copy, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const text = `${run.stdout}\n${run.stderr}`;
  // Kırmızının nedeni okunsun (ders 38): ham çıktının hata satırları ayrı dosyaya.
  writeFileSync(`${OUT}.${mutant.id}.log`, text.split(/\r?\n/).filter(line => /not ok|error:|^\s{8}\S/.test(line)).slice(0, 80).join("\n"));
  const num = key => Number((text.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1] ?? NaN);
  const failed = [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1]).filter(name => !/^2\.5\.0 /.test(name) || true);
  const verdict = run.status !== 0 && num("fail") > 0 ? "YAKALANDI" : run.status === 0 && num("fail") === 0 ? "YAŞADI" : "BELİRSİZ";
  appendFileSync(OUT, `${mutant.id} ${verdict} — ${mutant.what} — çıkış ${run.status}, tests ${num("tests")} pass ${num("pass")} fail ${num("fail")} cancelled ${num("cancelled")}\n${failed.map(name => `    ✖ ${name.slice(0, 200)}`).join("\n")}\n`);
  // Kopya: önce node_modules bağı, sonra klasör (yalnız kendi tam yolu).
  unlinkSync(path.join(copy, "node_modules"));
  rmSync(copy, { recursive: true, force: true });
}
if (existsSync(WORK)) appendFileSync(OUT, "# bitti\n");
