// Ders 20 zorla betiği (CI #1008 Windows Node 22, B3 T1 "tur başına sayfa artışı geçmişle büyüyor (46, 47, 0, 97, 54, 39, 0, 106, 46)"): B3 T1'i GERÇEK saat
// GERCEK_SAAT_KAT kat hızlı akarken koşar (ön yükleme test/fixtures/gercek-saat-hizli.mjs). KÖK NEDEN: WhatsApp işçisinin bakımı drain()'in SONUNDA ve ayrıca her
// runOnce() turunda gerçek saatle 60 sn'de bir (server/lib/whatsapp/scheduler.mjs turn(), maintainMs) koşar; yavaş makinede tur ~15 sn sürünce bu ara bakım bir
// turun ORTASINA düşer, o turda kabul edilmiş işlerin PDF'lerini siler, kalan PDF'ler o sayfaları kullanır → o tur page_count artmaz (0), sonraki tur boş havuzu
// yeniden doldurur (≈ 2 tur). Toplam artış doğrusal; ürün davranışı doğru, ölçüm turun içinde gerçek saate bağlıydı.
// Ön koşul GERÇEKLEŞTİ: ölçüm satırında turun ortasında ara bakım (yeni biçim: 6. alan 0 < n < 200) ya da (eski biçim) artışı 0 olan kararlı tur var. Bu bir test değildir.
// Kullanım: node test/whatsapp-b3-buyume-zorla.mjs [test dosyası=test/whatsapp-b3-buyume-249.test.mjs] [kat=8]
// Çıkış: 0 test yeşil ve ön koşul gerçekleşti · 1 test kırmızı · 2 ön koşul gerçekleşmedi (sonuç sayılmaz).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [file = "test/whatsapp-b3-buyume-249.test.mjs", factor = "8"] = process.argv.slice(2);
const run = spawnSync(process.execPath, ["--import", "./test/fixtures/gercek-saat-hizli.mjs", "--test", "--test-concurrency=1", "--test-reporter=spec", file], {
  cwd: path.join(here, ".."),
  env: { ...process.env, GERCEK_SAAT_KAT: String(Number(factor)), HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
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
// Ara bakım turun ORTASINA düştü: o turda silinen PDF 0 ile 200 arasında (200 = bakım turun son işinden sonra koştu, havuzu etkilemez).
const midMaintenance = rounds.filter(r => r.length > 5 && r[5] > 0 && r[5] < 200).length;
const zeroRounds = rounds.slice(1).filter(r => r[1] === 0).length;
const happened = midMaintenance > 0 || zeroRounds > 0;
const failed = run.status !== 0;
const reason = out.split(/\r?\n/).find(l => /AssertionError|beklenen true/.test(l)) || "";
console.log(line.trim());
if (reason) console.log(reason.trim().slice(0, 300));
console.log(`[zorla] ${file} · gerçek saat ×${factor} · ara bakımlı tur ${midMaintenance} · artışı 0 tur ${zeroRounds} · ön koşul ${happened ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"} · test ${failed ? `KIRMIZI (çıkış ${run.status})` : "YEŞİL"}`);
process.exit(!happened ? 2 : failed ? 1 : 0);
