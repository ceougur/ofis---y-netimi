// cents() kısayolu: eski money(roundMoney(v/100)) ↔ yeni (Number.isSafeInteger && |k|<1e13 → k/100). Gövdeler report-center.mjs'ten
// (HEAD ve 07b8f60) metin olarak çıkarılır — kopya değil, dosyadaki ifade.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const R = "/home/user/ofis---y-netimi";
const { roundMoney } = await import(`${R}/server/lib/money.mjs`);
const { tl } = await import(`${R}/server/lib/report-pdf.mjs`);
const money = value => (value === "" || value === null || value === undefined ? "" : tl(value));
const cur = readFileSync(`${R}/server/routes/report-center.mjs`, "utf8");
const old = execSync(`git -C ${R} show 07b8f60:server/routes/report-center.mjs`, { encoding: "utf8" });
const pick = (src, re) => src.match(re)[0];
const newSrc = pick(cur, /const cents = value => \{[\s\S]*?\n  \};/);
const oldSrc = pick(old, /const cents = value => money\(roundMoney\(\(Number\(value\) \|\| 0\) \/ 100\)\);/);
const make = src => new Function("money", "roundMoney", `${src}\nreturn cents;`)(money, roundMoney);
const fNew = make(newSrc);
const fOld = make(oldSrc);
const values = [0, -0, 1, -1, 5, -5, 99, 100, 101, 12345, -12345, 1e12 - 1, 1e13 - 1, -(1e13 - 1), 1e13, -1e13, 1e13 + 1, 2 ** 53 - 1, 2 ** 53, 9500000001131000, 0.5, -0.5, 1.005, 100.49999999999999, NaN, Infinity, -Infinity, "123", "", null, undefined, "abc", 1e15, -1e15];
for (let i = 0; i < 200000; i += 1) values.push(Math.floor((Math.random() - 0.5) * 2e13));
for (let i = 0; i < 20000; i += 1) values.push(Math.floor((Math.random() - 0.5) * 2e17));
let diff = 0;
const shown = [];
for (const v of values) {
  const a = fOld(v);
  const b = fNew(v);
  if (!Object.is(a, b)) {
    diff += 1;
    if (shown.length < 10) shown.push({ v, old: a, new: b });
  }
}
console.log(JSON.stringify({ count: values.length, diff, shown, newSrc: newSrc.replace(/\s+/g, " ").slice(0, 200) }));
