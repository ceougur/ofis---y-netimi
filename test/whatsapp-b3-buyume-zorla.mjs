// Ders 20 zorla betiği (CI #1008 Windows Node 22, B3 T1 "tur başına sayfa artışı geçmişle büyüyor (46, 47, 0, 97, 54, 39, 0, 106, 46)"). Bu bir test değildir.
// KÖK NEDEN: WhatsApp işçisinin bakımı drain()'in SONUNDA ve ayrıca her runOnce() turunda GERÇEK saatle 60 sn'de bir (server/lib/whatsapp/scheduler.mjs turn(), maintainMs)
// koşar; yavaş makinede (CI Windows ~15 sn / tur) bu ara bakım bir turun ORTASINA düşer, o turda kabul edilmiş işlerin PDF'lerini siler, kalan PDF'ler o sayfaları kullanır
// → o tur page_count artmaz (0), sonraki tur boş havuzu yeniden doldurur (≈ 2 tur). Toplam artış doğrusal; ürün davranışı doğru, ölçüm turun içinde gerçek saate bağlıydı.
// İki kip:
//   --tur 4,7 [--is 100]  BELİRLENİMCİ (test/fixtures/bakim-sicrama.mjs): verilen turların <is>. iletisinden sonra gerçek saat 61 sn ileri atılır → ara bakım tam o turun
//                         ortasında; başka tur ara bakım görmez (testin süresi < 60 sn iken). --tur yok = denetim (ara bakım yok).
//   --kat 8               BENZETİM (test/fixtures/gercek-saat-hizli.mjs): gerçek saat kat kat hızlı; ara bakımın düştüğü tur makine hızına bağlı (belirlenimci değil).
// Ön koşul okuması ölçüm satırından: yeni biçim 6. alan (tur içinde ara bakımın sildiği PDF; 0 < n < 200 = turun ortası), eski biçim (5 alan) artışı 0 olan kararlı tur.
// Kullanım: node test/whatsapp-b3-buyume-zorla.mjs [test dosyası=test/whatsapp-b3-buyume-249.test.mjs] [--tur 4,7] [--is 100] [--kat N]
// Çıkış: 0 test yeşil ve ön koşul beklendiği gibi · 1 test kırmızı · 2 ön koşul beklendiği gibi oluşmadı (sonuç sayılmaz).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const file = args[0] && !args[0].startsWith("--") ? args[0] : "test/whatsapp-b3-buyume-249.test.mjs";
const factor = flag("--kat");
const wanted = String(flag("--tur") || "").split(",").map(Number).filter(n => Number.isInteger(n) && n > 0);
const at = Number(flag("--is") || 100);
const PEOPLE = 200;
const preload = factor ? "./test/fixtures/gercek-saat-hizli.mjs" : "./test/fixtures/bakim-sicrama.mjs";
const env = { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
if (factor) env.GERCEK_SAAT_KAT = String(Number(factor));
else env.B3_SICRAMA_ILETI = wanted.map(r => (r - 1) * PEOPLE + at).join(",");
const run = spawnSync(process.execPath, ["--import", preload, "--test", "--test-concurrency=1", "--test-reporter=spec", file], {
  cwd: path.join(here, ".."),
  env,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const out = `${run.stdout || ""}${run.stderr || ""}`;
const line = out.split(/\r?\n/).find(l => l.includes("B3 T1 ölçüm:")) || "";
let rounds = [];
try {
  rounds = JSON.parse(line.slice(line.indexOf("[")));
} catch {
  rounds = [];
}
// Yeni biçim ama wa_job_pdfs yok (B3 öncesi ürün + yeni test: 6. alan null) → eski biçim gibi artışı 0 olan turlardan okunur.
const newFormat = rounds.length > 0 && rounds[0].length > 5 && rounds[0][5] !== null;
// Ara bakımın turun ORTASINA düştüğü turlar (yeni biçim) ya da artışı 0 olan kararlı turlar (eski biçim — ara bakım görünmez, yalnız izi).
const midRounds = newFormat ? rounds.filter(r => r[5] > 0 && r[5] < PEOPLE).map(r => r[0]) : [];
const zeroRounds = rounds.slice(1).filter(r => r[1] === 0).map(r => r[0]);
let happened;
if (factor) happened = midRounds.length > 0 || zeroRounds.length > 0;
else if (newFormat) happened = rounds.length > 0 && midRounds.join(",") === wanted.join(",");
else happened = rounds.length > 0 && zeroRounds.join(",") === wanted.join(",");
const failed = run.status !== 0;
const reason = out.split(/\r?\n/).find(l => /AssertionError|beklenen true/.test(l)) || "";
console.log(line.trim());
for (const l of out.split(/\r?\n/)) if (/^\s*[#ℹ] (tests|pass|fail|cancelled|skipped|todo) \d+/.test(l) || /# B3 (sıçrama|tur süresi|T1 havuz)/.test(l)) console.log(l.trim().replace(/^ℹ/, "#"));
if (reason) console.log(reason.trim().slice(0, 400));
const mode = factor ? `gerçek saat ×${factor}` : `sıçrama turları [${wanted.join(",")}] (iş ${at})`;
console.log(`[zorla] ${file} · ${mode} · ara bakımlı tur [${midRounds.join(",")}] · artışı 0 tur [${zeroRounds.join(",")}] · ön koşul ${happened ? "BEKLENDİĞİ GİBİ" : "OLUŞMADI / FARKLI"} · test ${failed ? `KIRMIZI (çıkış ${run.status})` : "YEŞİL"}`);
process.exit(!happened ? 2 : failed ? 1 : 0);
