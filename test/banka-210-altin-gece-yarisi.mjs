// Ders 20 / 22 — CI #941 (df238b99, Windows Node 24, 31.10.2026 00:47 UTC): banka-210-altin "v2.0.26'nın kendi koduyla üretilen veri" fatura adımında
// 400 chronology ("FIS serisinde son belge … 31.10.2026 tarihli"). Ön koşul zorla: sürecin saati yerel gece yarısına N saniye kala başlar (ön yükleme
// test/fixtures/surec-saati-gece-yarisi.mjs); dosya gece yarısından ÖNCE yüklenir, zincir testi (~15 sn) sürerken gün döner, motor ertesi günde başlar.
// Bu bir test değildir (adı .test.mjs ile bitmez). Kullanım: node test/banka-210-altin-gece-yarisi.mjs [saniye=6]
// Çıkış: 0 test yeşil ve ön koşul gerçekleşti · 1 test kırmızı · 2 ön koşul gerçekleşmedi (sonuç sayılmaz).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lead = String(Number(process.argv[2] || 6));
const run = spawnSync(process.execPath, ["--import", "./test/fixtures/surec-saati-gece-yarisi.mjs", "--test-reporter=spec", "test/banka-210-altin.test.mjs"], {
  cwd: path.join(here, ".."),
  env: { ...process.env, SUREC_SAATI_SN: lead },
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const out = `${run.stdout || ""}${run.stderr || ""}`;
process.stdout.write(out);
const happened = /ön koşul GERÇEKLEŞTİ/.test(out);
const failed = run.status !== 0;
console.log(`\n[zorla] gece yarısına ${lead} sn · ön koşul ${happened ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"} · test ${failed ? `KIRMIZI (çıkış ${run.status})` : "YEŞİL"}`);
process.exit(!happened ? 2 : failed ? 1 : 0);
