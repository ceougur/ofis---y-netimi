// Ders 20 zorla betiği — CI #959 (0ecc90de) Windows Node 22 kırmızısı: whatsapp-t-durum-karar-tablosu-248 T35r "ön koşul: toparlama Sonucu Belirsiz yazdı
// (geldi accepted)". Bu bir test değildir. T35r'yi ön yükleme test/fixtures/t35r-yaris-zorla.mjs ile N kez koşar; "yavas" kipinde geri yüklemenin dosya
// kopyası olay döngüsünü kilitleyerek uzar (yavaş Windows koşucusu). Ön koşul (CI'deki sıra): ileti isteği Meta'ya geldikten sonra geri yüklemenin bitmesi
// testin eski sahte Meta gecikmesinden (2.500 ms) uzun sürdü. Yeşil/kırmızı yalnız ön koşulun oluştuğu denemelerde sayılır.
// Kullanım: node test/whatsapp-t35r-yaris-zorla.mjs [deneme=3] [kip=yavas|olc] [ms=3500]
// Çıkış: 0 bütün denemeler yeşil ve ön koşul (yavas kipinde) hepsinde oluştu · 1 en az bir deneme kırmızı · 2 ön koşul oluşmayan deneme var (sonuç sayılmaz).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [trialsArg = "3", mode = "yavas", ms = "3500"] = process.argv.slice(2);
const trials = Number(trialsArg);
const OLD_DELAY_MS = 2_500;
console.log(`# T35r yarış denemesi: ${trials} deneme, kip ${mode}${mode === "yavas" ? ` (geri yükleme kopyası +${ms} ms)` : ""}, TZ ${process.env.TZ || "(yerel)"}, çalışma klasörü ${path.join(here, "..")}`);
let red = 0;
let formed = 0;
for (let n = 1; n <= trials; n += 1) {
  const run = spawnSync(process.execPath, ["--import", "./test/fixtures/t35r-yaris-zorla.mjs", "--test", "--test-name-pattern=T35r", "--test-reporter=spec", "test/whatsapp-t-durum-karar-tablosu-248.test.mjs"], {
    cwd: path.join(here, ".."),
    env: { ...process.env, T35R_ZORLA: mode, T35R_ZORLA_MS: String(ms), HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout || ""}${run.stderr || ""}`;
  const at = name => {
    const hit = new RegExp(`\\[t35r-zorla\\] \\+(\\d+) ms ${name}`).exec(out);
    return hit ? Number(hit[1]) : null;
  };
  const request = at("ileti-istegi-meta-da");
  const restored = at("geri-yukleme-bitti");
  const answered = at("meta-yaniti-gonderildi");
  const firstRead = (() => {
    const all = [...out.matchAll(/\[t35r-zorla\] \+(\d+) ms is-okundu/g)].map(item => Number(item[1]));
    return all.find(value => restored !== null && value >= restored) ?? null;
  })();
  const span = request !== null && restored !== null ? restored - request : null;
  const happened = span !== null && span > OLD_DELAY_MS;
  const before = answered !== null && firstRead !== null ? answered < firstRead : null;
  const pass = /ℹ pass 1\b/.test(out) && /ℹ fail 0\b/.test(out) && run.status === 0;
  const reason = /AssertionError[^\n]*\n?[^\n]*/.exec(out)?.[0]?.replace(/\s+/g, " ").slice(0, 200) || "";
  if (happened) formed += 1;
  if (!pass) red += 1;
  console.log(`deneme ${n}: çıkış ${run.status} · ${pass ? "YEŞİL" : "KIRMIZI"} · ileti isteği → geri yükleme bitti ${span ?? "?"} ms (ön koşul ${happened ? "OLUŞTU" : "OLUŞMADI"}) · Meta yanıtı ara okumadan ${before === null ? "?" : before ? "ÖNCE" : "SONRA"}${reason ? ` · ${reason}` : ""}`);
}
console.log(`# özet: ${trials - red}/${trials} yeşil, ${red} kırmızı; ön koşul oluşan deneme ${formed}/${trials}`);
process.exit(red ? 1 : mode === "yavas" && formed < trials ? 2 : 0);
