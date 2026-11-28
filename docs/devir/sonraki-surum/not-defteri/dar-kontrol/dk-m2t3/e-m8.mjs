// DK-M2T3 E: M8 ('önceki gün kesiti aynı günü de alır') eşdeğer mi? Aynı günlü bağlı tahsilatlı S155 sınıfı; bütün günlerin sınır / önerisi + Değersiz Yaz ve geri yükleme. node e-m8.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const DAYS = ["2026-09-13", "2026-09-15", "2026-09-17", "2026-09-20", "2026-09-25", "2026-10-01", "2026-10-15"];
let n = 0;
const out = [];
const variants = [];
for (const debt of ["3400", "1000", "300"]) for (const bound of ["2876,45", "1000", "300"]) for (const s2 of ["500", "0"]) for (const order of ["after", "before"]) variants.push({ debt, bound, s2, order });
for (const v of variants) {
  n += 1;
  const a = (await api.post(ACC, { name: `E ${n}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 7${String(n).padStart(2, "0")} 11 11` })).data;
  const inv = (await api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-13", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } })).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: v.debt, date: "2026-09-12", note: "Borç" });
  // S 3000 @17.09 ile aynı gün bağlı tahsilat (yazım sırası: kayıttan önce / sonra)
  if (v.order === "before") await api.post(`${ACC}/${a.id}/entries`, pay(v.bound, "2026-09-17", inv.id));
  const sr = await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" });
  if (sr.status !== 200) { out.push(`${JSON.stringify(v)} kayıt ${sr.status}`); continue; }
  const s = sr.data.record.id;
  if (v.order === "after") await api.post(`${ACC}/${a.id}/entries`, pay(v.bound, "2026-09-17", inv.id));
  await api.post(`${ACC}/${a.id}/entries`, pay("200", "2026-09-20", inv.id));
  if (v.s2 !== "0") await api.post(`${ACC}/${a.id}/doubtful`, { amount: v.s2, date: "2026-09-25", reason: "lawsuit" });
  const row = [];
  for (const d of DAYS) {
    const q = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=${d}`)).data;
    row.push(q?.limitMinor === undefined ? `${d}:-` : `${d.slice(5)}:${q.limitMinor}/${q.offerMinor}`);
  }
  // kısmi Değersiz (önerinin yarısı) 17.09 ile; sonra sil + aynı gün bağlı tahsilat ekle + geri yükle (yazım anı satırın kendi anı)
  const q = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=2026-09-17`)).data;
  let tail = "";
  if (q.offerMinor > 1) {
    const half = Math.floor(q.offerMinor / 2);
    const w = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: (half / 100).toFixed(2).replace(".", ","), date: "2026-09-17" });
    const q2 = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=2026-09-17`)).data;
    tail = `yarım ${half}:${w.status} sonra 17.09 ${q2.limitMinor}/${q2.offerMinor}`;
    if (w.status === 200) {
      const line = (await api.get(`${ACC}/${a.id}/doubtful`)).data.records.find(x => x.id === s).writeOffs.at(-1);
      await api.del(`${ACC}/${a.id}/doubtful/${s}/write-offs/${line.entryId}`);
      await api.post(`${ACC}/${a.id}/entries`, pay("150", "2026-09-17", inv.id));
      const t = (await api.get("/api/admin/trash")).data.find(x => x.kind === "doubtful-writeoff" && x.ref === line.entryId);
      const r = await api.post("/api/admin/trash/restore", { id: t.id });
      tail += ` · geri yükle ${r.status}${r.status !== 200 ? " " + String(r.error).slice(0, 80) : ""}`;
      const list = (await api.get(`${ACC}/${a.id}/doubtful`)).data.records.find(x => x.id === s);
      tail += ` · liste ${JSON.stringify(list.writeOff && [list.writeOff.today?.limitMinor, list.writeOff.today?.offerMinor, list.writeOff.best?.date, list.writeOff.best?.offerMinor])}`;
    }
  }
  out.push(`${JSON.stringify(v)} ${row.join(" ")} ${tail}`);
}
console.log(out.join("\n"));
server.close();
process.exit(0);
