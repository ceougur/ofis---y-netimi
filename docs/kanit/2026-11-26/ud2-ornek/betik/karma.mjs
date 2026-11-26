// Fikstür (tohum3) ile API girdisi arasındaki farkı bulmak için: API girdisinin her satırı / faturası fikstürünkiyle tek tek değiştirilir.
// Kullanım: ROOT=<kod> node karma.mjs <api-girdi.json> <test dosyası (tohum3 dışa aktaran)>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const q = await import(pathToFileURL(path.join(process.env.ROOT, "server/lib/obligation-queue.mjs")).href);
const { tohum3 } = await import(pathToFileURL(process.argv[3]).href);
const fx = tohum3();
const raw = JSON.parse(readFileSync(process.argv[2], "utf8")).input;
const sig = r => r.items.reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0) / 100;
const run = (label, input) => {
  const r = q.buildObligations(input);
  console.log(label.padEnd(36), "Σ", sig(r), "kalemler", JSON.stringify(r.items.map(i => [i.key.slice(0, 22), i.remaining])));
};
run("fikstür", fx);
// API girdisini fikstür kimlikleriyle yeniden adlandır
const order = ["F1", "plan:C1", "A", "F2", "S", "plan-entry:P1", "plan:C2", "plan-entry:P2"];
let text = JSON.stringify(raw);
const ren = new Map();
raw.lines.forEach((l, i) => ren.set(l.id, order[i]));
const plan1 = raw.lines[1].planId, plan2 = raw.lines[6].planId;
ren.set(plan1, "C1"); ren.set(plan2, "C2");
ren.set(raw.invoices[0].id, "F1"); ren.set(raw.invoices[1].id, "F2");
for (const [a, b] of ren) text = text.split(a).join(b);
const api = JSON.parse(text);
api.lines.forEach((l, i) => { l.at = fx.lines[i].at; });
api.invoices[0].issuedAt = fx.invoices[0].issuedAt; api.invoices[1].issuedAt = fx.invoices[1].issuedAt;
for (const [i, l] of api.lines.entries()) { const f = fx.lines[i]; const extra = Object.keys(l).filter(k => !(k in f)); const diff = Object.keys(f).filter(k => JSON.stringify(f[k]) !== JSON.stringify(l[k])); console.log("satır", f.id, "fazla alan", extra.join(","), "farklı", diff.map(k => `${k}: fx ${JSON.stringify(f[k])} api ${JSON.stringify(l[k])}`).join(" | ")); }
for (const [i, v] of api.invoices.entries()) { const f = fx.invoices[i]; const diff = [...new Set([...Object.keys(f), ...Object.keys(v)])].filter(k => JSON.stringify(f[k]) !== JSON.stringify(v[k])); console.log("fatura", f.id, diff.map(k => `${k}: fx ${JSON.stringify(f[k])} api ${JSON.stringify(v[k])}`).join(" | ")); }
console.log("takvim fx", JSON.stringify([...fx.schedules]).slice(0, 400)); console.log("takvim api", JSON.stringify(api.schedules.__map).slice(0, 400));
const mk = (lines, invoices, schedules) => ({ lines, invoices, schedules, today: "2026-11-23", lockAt: fx.lockAt });
const apiSched = new Map(api.schedules.__map);
run("API (yeniden adlı, fikstür kilidi)", mk(api.lines, api.invoices, apiSched));
run("API satırları + fikstür fatura/takvim", mk(api.lines, fx.invoices, fx.schedules));
run("fikstür satırları + API fatura/takvim", mk(fx.lines, api.invoices, apiSched));
for (let i = 0; i < 8; i += 1) {
  const lines = fx.lines.map((l, j) => (j === i ? api.lines[i] : l));
  run(`fikstür, satır ${order[i]} API'den`, mk(lines, fx.invoices, fx.schedules));
}
for (let i = 0; i < 2; i += 1) {
  const invoices = fx.invoices.map((v, j) => (j === i ? api.invoices[i] : v));
  run(`fikstür, fatura ${i + 1} API'den`, mk(fx.lines, invoices, fx.schedules));
}
console.log("API at:", JSON.stringify(api.lines.map(l => [l.id, l.at])));
console.log("fx  at:", JSON.stringify(fx.lines.map(l => [l.id, l.at])));
