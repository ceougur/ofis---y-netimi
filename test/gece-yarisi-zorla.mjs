// Ders 20 / 22 genel zorla betiği: verilen test dosyasını, sürecin saati yerel gece yarısına N saniye kala başlayıp akarak koşar (ön yükleme
// test/fixtures/surec-saati-gece-yarisi.mjs). "Bugün"ü yüklemede bir kez okuyup gerçek saatli (config.now'suz) sunucu açan testin gün dönümünde
// kırılıp kırılmadığını gösterir. Bu bir test değildir. Kullanım: node test/gece-yarisi-zorla.mjs <test/dosya.test.mjs> [saniye=6] [--sessiz]
// Çıkış: 0 test yeşil ve ön koşul gerçekleşti · 1 test kırmızı · 2 ön koşul gerçekleşmedi (sonuç sayılmaz).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [file, seconds = "6", quiet] = process.argv.slice(2);
if (!file) throw new Error("kullanım: node test/gece-yarisi-zorla.mjs <test/dosya.test.mjs> [saniye] [--sessiz]");
const lead = String(Number(seconds));
const run = spawnSync(process.execPath, ["--import", "./test/fixtures/surec-saati-gece-yarisi.mjs", "--test-reporter=spec", file], {
  cwd: path.join(here, ".."),
  env: { ...process.env, SUREC_SAATI_SN: lead },
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const out = `${run.stdout || ""}${run.stderr || ""}`;
if (quiet !== "--sessiz") process.stdout.write(out);
else process.stdout.write(out.split(/\r?\n/).filter(line => /^\s*✖|AssertionError|ℹ (tests|pass|fail)/.test(line)).slice(0, 12).join("\n") + "\n");
const happened = /ön koşul GERÇEKLEŞTİ/.test(out);
const failed = run.status !== 0;
console.log(`\n[zorla] ${file} · gece yarısına ${lead} sn · ön koşul ${happened ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"} · test ${failed ? `KIRMIZI (çıkış ${run.status})` : "YEŞİL"}`);
process.exit(!happened ? 2 : failed ? 1 : 0);
