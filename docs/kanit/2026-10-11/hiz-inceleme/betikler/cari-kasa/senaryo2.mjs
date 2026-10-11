// İleri tarihli satırlarla Kasa eksi bakiye denetimi (saat ileri alınıp girilir, geri alınır — eski sürümden kalan ileri tarihli satır gibi)
// + ham eski satırlar (nakit dışı Kasa kaydı, kayıt tahsilatı, yöntemsiz satır). Kullanım: node senaryo2.mjs <kök> <çıktı.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, outFile] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank } = await imp("test/banka-210-hesap-ortak.mjs");

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const ctx = await bootBank({ now: { time: NOW, fixed: true }, moneyStrict: false, gateVerify: false });
const api = ctx.api;
const clock = ctx.server.clock;
const out = [];
const ids = new Map();
const rec = (label, res) => {
  const item = { label, status: res.status, code: res.code || "", error: res.error || "" };
  if (res.status !== 200 && res.data && typeof res.data === "object") item.extra = { balance: res.data.balance, after: res.data.after };
  out.push(item);
  return res;
};
const cash = body => api.post("/api/workspace/cash", { description: "t", ...body });
const at = days => clock.set(`${addDays(TODAY, days)}T12:00:00+03:00`);
try {
  rec("giriş 1000 (-10)", await cash({ kind: "in", amount: "1000", date: addDays(TODAY, -10) }));
  // İleri tarihli satırlar: saat +20'ye alınıp girilir.
  at(20);
  const f1 = rec("ileri giriş 3000 (+15)", await cash({ kind: "in", amount: "3000", date: addDays(TODAY, 15) })).data;
  const f2 = rec("ileri çıkış 800 (+5)", await cash({ kind: "out", amount: "800", date: addDays(TODAY, 5) })).data;
  const party = (await api.post("/api/workspace/accounts", { name: "İleri Cari", type: "supplier", registeredOn: addDays(TODAY, -30) })).data;
  rec("ileri cari nakit tahsilat 500 (+18)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", method: "cash", amount: "500", date: addDays(TODAY, 18) }));
  rec("ileri cari POS tahsilat 9000 (+18)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", method: "card", amount: "9000", date: addDays(TODAY, 18) }));
  at(0);
  for (const [label, amount, day] of [["çıkış 150 bugün", "150", 0], ["çıkış 200 bugün", "200", 0], ["çıkış 201 bugün", "201", 0], ["çıkış 1000 bugün", "1000", 0], ["geçmiş çıkış 300 (-5)", "300", -5], ["geçmiş çıkış 1001 (-5)", "1001", -5], ["geçmiş çıkış 1 (-20)", "1", -20]]) {
    rec(label, await cash({ kind: "out", amount, date: addDays(TODAY, day) }));
  }
  // İleri tarihli satırların düzeltme ve silme denetimi (saat ileri).
  at(20);
  rec("ileri girişi 3000→100 düzelt", await api.put(`/api/workspace/cash/${f1.id}`, { kind: "in", amount: "100", date: addDays(TODAY, 15), description: "t" }));
  rec("ileri girişi sil", await api.del(`/api/workspace/cash/${f1.id}`));
  rec("ileri çıkışı 800→5000 düzelt", await api.put(`/api/workspace/cash/${f2.id}`, { kind: "out", amount: "5000", date: addDays(TODAY, 5), description: "t" }));
  at(0);
  // Ham eski satırlar (eski sürümden kalma): nakit dışı Kasa kaydı, kayıt tahsilatı (payments), yöntemi boş satır.
  const db = ctx.server.app.db;
  const cols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
  out.push({ label: "payments kolonları", cols });
  db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('legacy-card', 'out', 77, ?, 'eski kart', 'card', 'x', ?)").run(addDays(TODAY, -3), new Date().toISOString());
  db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('legacy-empty', 'in', 55, ?, 'eski boş', '', 'x', ?)").run(addDays(TODAY, -3), new Date().toISOString());
  try {
    db.prepare("INSERT INTO payments (id, case_key, amount, date, method, note, created_by, created_at) VALUES ('legacy-pay', 'k1', 444, ?, 'cash', 'eski', 'x', ?)").run(addDays(TODAY, -2), new Date().toISOString());
    out.push({ label: "payments ham satır", ok: true });
  } catch (error) {
    out.push({ label: "payments ham satır", error: String(error.message).slice(0, 120) });
  }
  ctx.server.app.context.money?.reset?.();
  for (const [label, amount] of [["ham sonrası çıkış 700", "700"], ["ham sonrası çıkış 1300", "1300"], ["ham sonrası çıkış 1500", "1500"]]) rec(label, await cash({ kind: "out", amount, date: TODAY }));
  const k = await api.get("/api/workspace/cash");
  out.push({ label: "kasa", byMethod: k.data?.byMethod, byMethodAt: k.data?.byMethodAt, balance: k.data?.balance, balanceToday: k.data?.balanceToday });
} finally {
  await ctx.server.close();
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(out.length);
