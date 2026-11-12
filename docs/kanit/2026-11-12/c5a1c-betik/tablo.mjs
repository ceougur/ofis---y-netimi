// Ç5-A tur 1c: olc-<etiket>-<kip>.txt dosyalarından hız tablosu (en iyi / ortanca, ms; yalnız GEÇERLİ turlar: tur başındaki 1 dk yük ≤ 2 ve TZ bloğu geçersiz değil).
// Kullanım: node tablo.mjs <klasör> <kip> <etiket1> <etiket2> <etiket3>  → taban / tur 1b / tur 1c; hedef: uç ≤ taban × 1,10 (en iyi ve ortanca) ve uç ≤ tur 1b.
import { readFileSync } from "node:fs";
import path from "node:path";

const [dir, kip, ...tags] = process.argv.slice(2);
const parse = tag => {
  const text = readFileSync(path.join(dir, `olc-${tag}-${kip}.txt`), "utf8").split(/\r?\n/);
  const data = new Map();
  let valid = false;
  let blockBad = false;
  let rounds = { valid: 0, invalid: 0 };
  for (const line of text) {
    if (line.startsWith("=== TZ")) blockBad = /GEÇERSİZ/.test(line);
    const round = /^tur \d+ · yük ([\d.]+)/.exec(line);
    if (round) {
      valid = !blockBad && Number(round[1]) <= 2;
      rounds[valid ? "valid" : "invalid"] += 1;
      continue;
    }
    const m = /^\s+(.+?): (\d+) · ([\d.]+) ms/.exec(line);
    if (m && valid) {
      const list = data.get(m[1]) || [];
      list.push(Number(m[3]));
      data.set(m[1], list);
    }
  }
  return { data, rounds };
};
const stat = list => {
  if (!list?.length) return null;
  const s = list.slice().sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { best: s[0], median: mid, n: s.length };
};
const cols = tags.map(parse);
console.log(`kip ${kip} · geçerli tur: ${tags.map((t, i) => `${t} ${cols[i].rounds.valid} (geçersiz ${cols[i].rounds.invalid})`).join(" · ")}`);
console.log(`| Yol | ${tags.join(" | ")} | uç / taban (en iyi, ortanca) | hedef ≤ %10 | uç ≤ tur 1b |`);
console.log(`|---|${tags.map(() => "---|").join("")}---|---|---|`);
const names = [...cols[0].data.keys()];
for (const name of names) {
  const s = cols.map(c => stat(c.data.get(name)));
  const cell = x => (x ? `${Math.round(x.best)} / ${Math.round(x.median)} (${x.n})` : "—");
  const [base, mid, tip] = s;
  const ratio = base && tip ? `${((tip.best / base.best - 1) * 100).toFixed(1)}% / ${((tip.median / base.median - 1) * 100).toFixed(1)}%` : "—";
  const goal = base && tip ? (tip.best <= base.best * 1.1 && tip.median <= base.median * 1.1 ? "TUTTU" : "TUTMADI") : "—";
  const notWorse = mid && tip ? (tip.best <= mid.best && tip.median <= mid.median ? "evet" : tip.best <= mid.best * 1.03 && tip.median <= mid.median * 1.03 ? "gürültü içinde (≤ %3)" : "HAYIR") : "—";
  console.log(`| ${name} | ${s.map(cell).join(" | ")} | ${ratio} | ${goal} | ${notWorse} |`);
}
