// Yevmiye Defteri satırları: eski (v2.1.0) ↔ yeni; yeni satırın hesap kolonundaki alt hesap (".xx") atılınca çoklu küme aynı mı?
import { readFileSync } from "node:fs";
const [a, b, ...keys] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a, "utf8")).reads;
const B = JSON.parse(readFileSync(b, "utf8")).reads;
const companies = A["sirket-001"] ? Object.keys(A) : [null];
let bad = 0;
for (const c of companies) {
  for (const key of keys.length ? keys : ["rapor:yevmiye", "rapor:yevmiye:varsayilan"]) {
    const ra = (c ? A[c] : A)[key]?.data;
    const rb = (c ? B[c] : B)[key]?.data;
    if (!ra || !rb) { console.log(c, key, "yok", !!ra, !!rb); continue; }
    const canon = r => JSON.stringify(r.map((cell, i) => (i === 3 ? String(cell).replace(/\.\d\d$/, "") : cell)).map(x => typeof x === "string" ? x.replace(/<id\d+>/g, "<id>") : x));
    const count = rows => { const m = new Map(); for (const r of rows) { const k = canon(r); m.set(k, (m.get(k) || 0) + 1); } return m; };
    const ma = count(ra.rows), mb = count(rb.rows);
    let diff = 0;
    for (const k of new Set([...ma.keys(), ...mb.keys()])) if ((ma.get(k) || 0) !== (mb.get(k) || 0)) { diff++; if (diff < 5) console.log("  fark", k, ma.get(k) || 0, mb.get(k) || 0); }
    const subs = new Map(); for (const r of rb.rows) subs.set(r[3], (subs.get(r[3]) || 0) + 1);
    console.log(c || "-", key, "eski", ra.rows.length, "yeni", rb.rows.length, "alt hesap atılınca fark", diff, "yeni hesap kolonları", JSON.stringify([...subs]));
    bad += diff;
  }
}
process.exit(bad ? 1 : 0);
