// 2.5.1 D3 tur 3 — İLETİ KATALOĞU kaydedicisi (test değildir). Testlerin GERÇEKTEN ürettiği devir iletilerini (ön izleme yanıtından; elle yazılmış değil) D3T3_KATALOG_DIR
// verilmişse `<klasör>/<test>.jsonl` dosyasına satır satır yazar; katalog belgesi test/devir-d3-ileti-katalog.mjs ile bu dosyalardan üretilir. Değişken yoksa hiçbir şey yazmaz.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function katalogaYaz(test, senaryo, ileti, kaynak = "API") {
  const dir = process.env.D3T3_KATALOG_DIR;
  if (!dir || !ileti) return;
  mkdirSync(dir, { recursive: true });
  const { kod, seviye, baslik, neOldu, neden, neYapmali, nereye, metin, guvence } = ileti;
  appendFileSync(path.join(dir, `${test}.jsonl`), `${JSON.stringify({ test, senaryo, kaynak, kod, seviye, baslik, neOldu, neden, neYapmali, nereye, guvence: guvence || "", metin })}\n`);
}
