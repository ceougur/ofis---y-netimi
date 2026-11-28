// DK-M2T3 B: Değersiz Alacak'tan sonra bakiyeyi düşüren HER yol — durum / kod / ileti / bakiye / Mutabakat. Kullanım: node b-yollar.mjs <kod kökü> [vaka süzgeci]
const ROOT = process.argv[2];
const ONLY = process.argv[3] || "";
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
let server, api, store;
async function bootOne() {
  server = await h.startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  api = o.apiOf(await h.loginAdmin(server));
  store = server.app.store;
  await api.post("/api/workspace/bank/setup/dismiss", {});
}
let phone = 0;
const bal = async id => (await api.get(`${ACC}/${id}`)).data?.totals?.balance;
const integ = async () => { const r = await api.get("/api/workspace/ledger/integrity"); return r.data?.ok ? "ok" : `KIRMIZI ${JSON.stringify(r.data?.failures || r.error).slice(0, 500)}`; };
const short = r => `${r.status}${r.code ? " " + r.code : ""}${r.status !== 200 ? " | " + String(r.error || JSON.stringify(r.data)).slice(0, 900) : ""}`;
const fq = async (a, s, d) => { const q = (await api.get(`${ACC}/${a}/doubtful/${s}/write-off?date=${d}`)).data; return `${d}: sınır ${q.limitMinor} öneri ${q.offerMinor} ${q.why || ""} ${q.blocked || ""}`; };
// Taban T (varsayılan): Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz (form önerisi @17.09).
async function base(name, { lines = [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], scenario = "service_sale", payment = { rest: "open" }, bound = true, writeOff = true, debt = "3400", woDate = "2026-09-17", extra = null } = {}) {
  phone += 1;
  const a = (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 391 ${String(phone).padStart(2, "0")} 01` })).data;
  const invR = await api.post(INV, { scenario, accountId: a.id, issueDate: "2026-09-10", lines, payment });
  if (invR.status !== 200) throw new Error(`fatura: ${short(invR)}`);
  const inv = invR.data;
  if (debt) await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: debt, date: "2026-09-12", note: "Borç" });
  if (extra) await extra(a, inv);
  if (bound) {
    const r = await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
    if (r.status !== 200) console.log(`  (bağlı tahsilat ${short(r)})`);
  }
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  let wo = null;
  if (writeOff) {
    const q = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=${woDate}`)).data;
    const amount = (q.offerMinor / 100).toFixed(2).replace(".", ",");
    const r = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount, date: woDate });
    wo = { amount, status: r.status };
  }
  return { a, inv, s, wo, b0: await bal(a.id) };
}
const detailOf = async id => (await api.get(`${INV}/${id}`)).data;
const linesOf = d => d.lines || d.invoice?.lines || [];
const editBody = (d, patch = {}) => ({ scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: linesOf(d).map(l => ({ name: l.name, qty: l.qty, unitPrice: String(l.unitPrice), vatRate: l.vatRate, ...(l.itemId ? { itemId: l.itemId } : {}) })), payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, ...patch });
const cases = {
  async iptal() { const b = await base("B İptal"); const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }); return [b, r]; },
  async sil() { const b = await base("B Sil"); const r = await api.del(`${INV}/${b.inv.id}`); return [b, r]; },
  async topluIptal() { const b = await base("B Toplu İptal"); const r = await api.post(`${INV}/bulk-cancel`, { ids: [b.inv.id], reason: "x" }); return [b, { status: r.status, data: r.data, error: JSON.stringify(r.data?.results || r.data).slice(0, 900) }]; },
  async topluSil() { const b = await base("B Toplu Sil"); const r = await api.post(`${INV}/bulk-delete`, { ids: [b.inv.id] }); return [b, { status: r.status, data: r.data, error: JSON.stringify(r.data?.results || r.data).slice(0, 900) }]; },
  async tamIade() { const b = await base("B Tam İade"); const d = await detailOf(b.inv.id); const r = await api.post(INV, { kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }); return [b, r]; },
  async kismiIade290() { const b = await base("B Kısmi İade 290"); const d = await detailOf(b.inv.id); const r = await api.post(INV, { kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty: 0.1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }); return [b, r]; },
  async duzenle100() { const b = await base("B Düzenle 100"); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async duzenle2800() { const b = await base("B Düzenle 2800"); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "2800"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async duzenle2500() { const b = await base("B Düzenle 2500"); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "2500"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async duzenle3500() { const b = await base("B Düzenle 3500"); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "3500"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async duzenleTarih() { const b = await base("B Düzenle Tarih"); const d = await detailOf(b.inv.id); const r = await api.post(`${INV}/${b.inv.id}/edit`, editBody(d, { issueDate: "2026-09-11" })); return [b, r]; },
  async duzenleCari() { const b = await base("B Düzenle Cari"); phone += 1; const other = (await api.post(ACC, { name: "B Öbür Cari", type: "customer", registeredOn: "2026-09-01", phone: `0500 392 ${String(phone).padStart(2, "0")} 01` })).data; const d = await detailOf(b.inv.id); const r = await api.post(`${INV}/${b.inv.id}/edit`, editBody(d, { accountId: other.id })); return [b, r]; },
  async kalemSil() { const b = await base("B Kalem Sil", { lines: [{ name: "Hizmet A", qty: 1, unitPrice: "2000", vatRate: 0 }, { name: "Hizmet B", qty: 1, unitPrice: "900", vatRate: 0 }] }); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines = body.lines.slice(0, 1); const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async kdvDegis() { const b = await base("B KDV", { lines: [{ name: "Hizmet", qty: 1, unitPrice: "2416,67", vatRate: 20 }] }); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].vatRate = 0; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async taksitli() { const b = await base("B Taksitli", { payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-06", everyMonths: 1 } } }); const d = await detailOf(b.inv.id); const body = editBody(d, { payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: "2026-10-06", everyMonths: 1 } } }); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async smm() { const b = await base("B SMM", { scenario: "smm", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: "3625", vatRate: 0 }] }); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async alistanIade() {
    let ret = null;
    const b = await base("B Alıştan İade", { extra: async a => {
      const p = await api.post(INV, { scenario: "expense_purchase", accountId: a.id, issueDate: "2026-09-11", number: "AL-1", lines: [{ name: "Gider", qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open" } });
      if (p.status !== 200) throw new Error(`alış ${short(p)}`);
      const pd = await detailOf(p.data.id);
      const rr = await api.post(INV, { kind: "purchase_return", originalId: p.data.id, accountId: a.id, issueDate: "2026-09-11", lines: [{ originLineId: linesOf(pd)[0].id, qty: 10 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
      if (rr.status !== 200) throw new Error(`alıştan iade ${short(rr)}`);
      ret = { id: rr.data.id, origin: linesOf(pd)[0].id, pid: p.data.id };
    } });
    const r = await api.post(`${INV}/${ret.id}/edit`, { kind: "purchase_return", originalId: ret.pid, accountId: b.a.id, issueDate: "2026-09-11", lines: [{ originLineId: ret.origin, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
    return [b, r];
  },
  async alistanIadeIptal() {
    let ret = null;
    const b = await base("B Alıştan İade İptal", { extra: async a => {
      const p = await api.post(INV, { scenario: "expense_purchase", accountId: a.id, issueDate: "2026-09-11", number: "AL-2", lines: [{ name: "Gider", qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open" } });
      const pd = await detailOf(p.data.id);
      const rr = await api.post(INV, { kind: "purchase_return", originalId: p.data.id, accountId: a.id, issueDate: "2026-09-11", lines: [{ originLineId: linesOf(pd)[0].id, qty: 10 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
      ret = rr.data.id;
    } });
    const r = await api.post(`${INV}/${ret}/cancel`, { reason: "x" });
    return [b, r];
  },
  async yeniAlis() { const b = await base("B Yeni Alış"); const r = await api.post(INV, { scenario: "expense_purchase", accountId: b.a.id, number: "AL-3", issueDate: "2026-10-01", lines: [{ name: "Gider", qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open" } }); return [b, r]; },
  async borcSil() { const b = await base("B Borç Sil"); const e = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source <> 'invoice' ORDER BY created_at LIMIT 1", b.a.id); const r = await api.del(`${ACC}/${b.a.id}/entries/${e.id}`); return [b, r]; },
  async borcDuzenle() { const b = await base("B Borç Düzenle"); const e = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source <> 'invoice' ORDER BY created_at LIMIT 1", b.a.id); const r = await api.put(`${ACC}/${b.a.id}/entries/${e.id}`, { kind: "debt", amount: "100", date: "2026-09-12", note: "Borç" }); return [b, r]; },
  async degersizsiz100() { const b = await base("B Değersizsiz", { writeOff: false }); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async pesinEkle() { const b = await base("B Peşin Ekle"); const d = await detailOf(b.inv.id); const body = editBody(d, { payment: { cash: [{ amount: "3000", method: "cash" }], cheques: [], endorse: [], rest: "open" }, cashForce: true }); const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async kilitli() { const b = await base("B Kilitli"); await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }); const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }); await api.put("/api/admin/period-lock", { lockedUntil: "" }); return [b, r]; },
  async silSonraIptal() { const b = await base("B Sil Sonra İptal"); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }); return [b, r]; },
  async N_iptal() { const b = await base("N İptal"); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }); console.log(`  N_iptal form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async N_iade() { const b = await base("N İade"); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const d = await detailOf(b.inv.id); const r = await api.post(INV, { kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }); console.log(`  N_iade form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async N_duzenle100() { const b = await base("N Düzenle"); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); console.log(`  N_duzenle100 form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async N_kalemSil() { const b = await base("N Kalem Sil", { lines: [{ name: "Hizmet A", qty: 1, unitPrice: "2000", vatRate: 0 }, { name: "Hizmet B", qty: 1, unitPrice: "900", vatRate: 0 }] }); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const d = await detailOf(b.inv.id); const body = editBody(d); body.lines = body.lines.slice(0, 1); const r = await api.post(`${INV}/${b.inv.id}/edit`, body); console.log(`  N_kalemSil form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async N_iadeDuzenle() { const b = await base("N İade Düzenle"); const d = await detailOf(b.inv.id); const body = qty => ({ kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }); const r1 = await api.post(INV, body(0.1)); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); const r = await api.post(`${INV}/${r1.data.id}/edit`, body(0.5)); console.log(`  N_iadeDuzenle form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async cariDegisBagsiz() { const b = await base("B Cari Bağsız", { bound: false, extra: async a => { await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-16", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }); } }); phone += 1; const other = (await api.post(ACC, { name: "B Öbür Cari 2", type: "customer", registeredOn: "2026-09-01", phone: `0500 393 ${String(phone).padStart(2, "0")} 01` })).data; const d = await detailOf(b.inv.id); const r = await api.post(`${INV}/${b.inv.id}/edit`, editBody(d, { accountId: other.id })); return [b, r]; },
  async taksitliEksi() { const b = await base("B Taksitli Eksi", { debt: "200", payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-06", everyMonths: 1 } } }); const d = await detailOf(b.inv.id); const body = editBody(d, { payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: "2026-10-06", everyMonths: 1 } } }); body.lines[0].unitPrice = "100"; const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async taksitliIptal() { const b = await base("B Taksitli İptal", { debt: "200", payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-06", everyMonths: 1 } } }); const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }); return [b, r]; },
  async pesin2000() { const b = await base("B Peşin 2000", { debt: "6000" }); const d = await detailOf(b.inv.id); const body = editBody(d, { payment: { cash: [{ amount: "20", method: "cash" }], cheques: [], endorse: [], rest: "open" }, cashForce: true }); const r = await api.post(`${INV}/${b.inv.id}/edit`, body); return [b, r]; },
  async taslakIadeKaydet() { const b = await base("B Taslak İade"); const d = await detailOf(b.inv.id); const dr = await api.post(INV, { status: "draft", kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" } }); if (dr.status !== 200) return [b, dr]; const r = await api.post(`${INV}/${dr.data.id}/issue`, { force: true }); return [b, r]; },
  async taslakIadeToplu() { const b = await base("B Taslak İade Toplu"); const d = await detailOf(b.inv.id); const dr = await api.post(INV, { status: "draft", kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" } }); if (dr.status !== 200) return [b, dr]; const r = await api.post(`${INV}/bulk-issue`, { ids: [dr.data.id], force: true }); return [b, { status: r.status, data: r.data, error: JSON.stringify(r.data).slice(0, 700) }]; },
  async N_cariDegis() { const b = await base("N Cari Bağsız", { bound: false, extra: async a => { await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-16", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }); } }); const rec = (await api.get(`${ACC}/${b.a.id}/doubtful`)).data.records.find(x => x.id === b.s); await api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${rec.writeOffs[0].entryId}`); phone += 1; const other = (await api.post(ACC, { name: "N Öbür Cari", type: "customer", registeredOn: "2026-09-01", phone: `0500 394 ${String(phone).padStart(2, "0")} 01` })).data; const d = await detailOf(b.inv.id); const r = await api.post(`${INV}/${b.inv.id}/edit`, editBody(d, { accountId: other.id })); console.log(`  N_cariDegis form ${await fq(b.a.id, b.s, "2026-09-17")} · ${await fq(b.a.id, b.s, TODAY)} · bakiye ${await bal(b.a.id)}`); return [b, r]; },
  async iadeSonraDuzenle() {
    const b = await base("B İade Düzenle", { debt: "3400" });
    const d = await detailOf(b.inv.id);
    const body = qty => ({ kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: linesOf(d)[0].id, qty }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
    const r1 = await api.post(INV, body(0.1));
    if (r1.status !== 200) return [b, r1];
    const r = await api.post(`${INV}/${r1.data.id}/edit`, body(0.5));
    return [b, r];
  },
};
for (const [name, fn] of Object.entries(cases)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  await bootOne();
  try {
    const [b, r] = await fn();
    if (r.data?.results) r.error = JSON.stringify(r.data.results).slice(0, 900), r.status = r.data.failed ? `200(failed ${r.data.failed})` : r.status;
    const after = await bal(b.a.id);
    console.log(`${name}: Değersiz ${b.wo ? `${b.wo.amount} (${b.wo.status})` : "yok"} · önce ${b.b0} · sonuç ${short(r)} · sonra ${after} · Mutabakat ${await integ()}`);
  } catch (error) {
    console.log(`${name}: HATA ${error.message}`);
  }
  server.close();
}
process.exit(0);
