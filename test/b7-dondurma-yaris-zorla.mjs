// Ders 20 / 51 zorla betiği (Ç5-A tur 1c): verilen test dosyasını, programın açılışta başlattığı bekleyen dondurma testin ilk karşılaştırma adımına kadar BİTMEYECEK
// biçimde koşar (ön yükleme test/fixtures/dondurma-yaris-zorla-yukle.mjs — ürünün YALNIZ TEST kancasıyla "before-done"da tutar; süre / uyku YOK). Varsayılan: B7'nin
// "gerçek 2.0.26 verisi" testi. Bu bir test değildir. Kullanım: node test/b7-dondurma-yaris-zorla.mjs [test/dosya.test.mjs] [yineleme=1] [--ad <test adı deseni>]
// Kip (komşu taraması için): DONDURMA_YARIS=ara (varsayılan) | tut (okumaların hepsi dondurma sürerken) | bitir (okumaların hepsi dondurmadan sonra) | gozlem (tur 1d: testin
// ilk adımı — kendi bekleyişi ya da ilk taraması — başladığında kanca dondurmayı GERÇEKTEN tutuyordu, bırakma o adım gözlenerek; yeni B7 testinin dişini gösterir). "--ad ''" bütün testler.
// Her yinelemenin çıkışı: ön koşul GERÇEKLEŞTİ/GERÇEKLEŞMEDİ · test YEŞİL/KIRMIZI. Sonda sayılar. Çıkış: 0 hepsinde ön koşul + yeşil · 1 ön koşullu bir yinelemede kırmızı
// · 2 bir yinelemede ön koşul gerçekleşmedi (o yineleme sayılmaz) · 3 bir yineleme süre sınırında öldürüldü ve ön koşul satırı yok (ön koşul BİLİNMİYOR; asılma bulgudur).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--ad");
const pattern = at >= 0 ? args.splice(at, 2)[1] : "gerçek 2.0.26 verisi";
const file = args[0] || "test/banka-210-gg-tarama.test.mjs";
const times = Math.max(1, Number(args[1]) || 1);
const counts = { happened: 0, missed: 0, green: 0, red: 0, unknown: 0 };
for (let i = 1; i <= times; i += 1) {
  // Süre sınırı GNU timeout ile: kendi süreç grubunu kurar, süre dolunca test koşucusunu VE testin alt sürecini birlikte sonlandırır (yetim süreç kalmaz).
  const limit = String(Number(process.env.ZORLA_SURE_SN || 240));
  const run = spawnSync("timeout", ["-k", "5", limit, process.execPath, "--import", "./test/fixtures/dondurma-yaris-zorla-yukle.mjs", "--test", "--test-reporter=spec", ...(pattern ? [`--test-name-pattern=${pattern}`] : []), file], {
    cwd: path.join(here, ".."),
    env: { ...process.env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // timeout(1): süre dolunca çıkış 124 (TERM) ya da 137 (KILL).
  const timedOut = run.status === 124 || run.status === 137;
  const out = `${run.stdout || ""}${run.stderr || ""}${timedOut ? `\nSÜRE DOLDU: yineleme ${limit} sn'de bitmedi (asıldı)\n` : ""}`;
  // Süre dolan yineleme (Ç5-A tur 1e, dar kontrol DÜŞÜK-2): ön koşul ANCAK kanıtı (testin "ön koşul GERÇEKLEŞTİ" satırı) çıktıda varsa gerçekleşmiş sayılır; satır yoksa (süreç
  // öldürüldü) ön koşul BİLİNMİYOR — ayrı sayılır, kanıtsız "gerçekleşti" denmez (ders 4, 20); asılma yine bulgudur (çıkış 3, sessiz atlanmaz).
  const happened = /ön koşul GERÇEKLEŞTİ/.test(out);
  const unknown = timedOut && !happened;
  const failed = timedOut || run.status !== 0;
  const tests = /ℹ tests (\d+)/.exec(out)?.[1] ?? "?";
  const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? "?";
  const fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? "?";
  // Ç5-A tur 1d (ders 2): atlanan test (ör. etiketsiz kopyada eski sürüm karşılaştırması) YEŞİL sayılmaz — satırda ayrıca yazılır; ön koşulu zaten oluşmaz.
  const skipped = Number(/ℹ skipped (\d+)/.exec(out)?.[1] ?? 0);
  if (unknown) counts.unknown += 1;
  else if (!happened) counts.missed += 1;
  else {
    counts.happened += 1;
    if (failed) counts.red += 1;
    else counts.green += 1;
  }
  const reason = out.split(/\r?\n/).filter(line => /AssertionError|iki yol aynı sonucu|Error:|SÜRE DOLDU|sn'de olmadı/.test(line)).slice(0, 3).join(" ‖ ");
  // Test koşucusunun ana süreci de ön yüklemeyi yükler (0 örnek); testin kendi sürecinin satırı okunur.
  const precondition = out.split(/\r?\n/).filter(line => /\[dondurma yarışı\]/.test(line) && !/ 0 örnek /.test(line)).join(" ") || "[dondurma yarışı] örnek yok";
  console.log(`[zorla ${i}/${times}] ${file} · ${unknown ? "ön koşul BİLİNMİYOR (süre doldu, kanıt satırı yok)" : precondition.trim()} · test ${failed ? `KIRMIZI (çıkış ${run.status})` : "YEŞİL"} · tests ${tests} pass ${pass} fail ${fail}${skipped ? ` · ATLANAN ${skipped}` : ""}${reason ? ` · ${reason.trim().slice(0, 240)}` : ""}`);
}
console.log(`\n[zorla özet] ${file} · ${times} yineleme · ön koşul gerçekleşti ${counts.happened} · gerçekleşmedi ${counts.missed} · ön koşullu yeşil ${counts.green} · ön koşullu kırmızı ${counts.red} · süre doldu, ön koşul bilinmiyor ${counts.unknown}`);
process.exit(counts.unknown ? 3 : counts.missed ? 2 : counts.red ? 1 : 0);
