// S-DKM2T3-1 ölçümü: Değersiz satırlı caride borç yönlü kaydın silinmesi / azaltılması — Borç Yaz, Ödeme, taksit kartı. node s1-olc.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts", INV = "/api/workspace/invoices", PLANS = "/api/workspace/plans";
const short = r => `${r.status}${r.code ? " " + r.code : ""}${r.status !== 200 ? " | " + String(r.error || "").slice(0, 700) : ""}`;
let phone = 0;
async function run(name, fn) {
  const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const api = o.apiOf(await h.loginAdmin(server));
  const store = server.app.store;
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l}: ${short(r)}`); return r.data; };
  const bal = async id => (await api.get(`${ACC}/${id}`)).data?.totals?.balance;
  try {
    phone += 1;
    const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 471 ${String(phone).padStart(2, "0")} 01` }));
    const inv = await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
    const ctx = { api, store, a, inv, must, bal };
    const setup = await fn.setup(ctx);
    await must("bağlı", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
    const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
    if (!fn.noWriteOff) await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
    const b0 = await bal(a.id);
    const r = await fn.act({ ...ctx, s, setup });
    const integ = await api.get("/api/workspace/ledger/integrity");
    console.log(`${name}: önce ${b0} · ${short(r)} · sonra ${await bal(a.id)} · Mutabakat ${integ.data?.ok ? "ok" : "KIRMIZI " + JSON.stringify(integ.data?.failures).slice(0, 300)}`);
  } catch (error) {
    console.log(`${name}: HATA ${error.message}`);
  } finally {
    server.close();
  }
}
const debt = { setup: async c => (await c.must("borç", c.api.post(`${ACC}/${c.a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }))) && c.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source = '' ORDER BY created_at DESC LIMIT 1", c.a.id).id };
const cases = {
  "Borç Yaz sil": { ...debt, act: c => c.api.del(`${ACC}/${c.a.id}/entries/${c.setup}`) },
  "Borç Yaz 100": { ...debt, act: c => c.api.put(`${ACC}/${c.a.id}/entries/${c.setup}`, { kind: "debt", amount: "100", date: "2026-09-12", note: "Borç" }) },
  "Borç Yaz 3.500 (artış)": { ...debt, act: c => c.api.put(`${ACC}/${c.a.id}/entries/${c.setup}`, { kind: "debt", amount: "3500", date: "2026-09-12", note: "Borç" }) },
  "Borç Yaz tarih 13.09": { ...debt, act: c => c.api.put(`${ACC}/${c.a.id}/entries/${c.setup}`, { kind: "debt", amount: "3400", date: "2026-09-13", note: "Borç" }) },
  "Borç Yaz → Alacak": { ...debt, act: c => c.api.put(`${ACC}/${c.a.id}/entries/${c.setup}`, { kind: "credit", amount: "3400", date: "2026-09-12", note: "Borç" }) },
  "Borç Yaz 3.000 (eksiye götürmez)": { ...debt, act: c => c.api.put(`${ACC}/${c.a.id}/entries/${c.setup}`, { kind: "debt", amount: "3000", date: "2026-09-12", note: "Borç" }) },
  "Borç Yaz sil (Değersiz yok)": { ...debt, noWriteOff: true, act: c => c.api.del(`${ACC}/${c.a.id}/entries/${c.setup}`) },
  "Ödeme 3.400 sil": { setup: async c => { await c.must("ödeme", c.api.post(`${ACC}/${c.a.id}/entries`, { kind: "out", amount: "3400", date: "2026-09-12", method: "cash", cashForce: true, similarOk: true, note: "Ödeme" })); return c.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'out' ORDER BY created_at DESC LIMIT 1", c.a.id).id; }, act: c => c.api.del(`${ACC}/${c.a.id}/entries/${c.setup}?cashForce=1`) },
  "Taksit kartı sil": { setup: async c => (await c.must("kart", c.api.post(PLANS, { accountId: c.a.id, name: "Kart", total: 3400, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id, act: c => c.api.del(`${PLANS}/${c.setup}`) },
  "Taksit kartı tutar 100": { setup: async c => (await c.must("kart", c.api.post(PLANS, { accountId: c.a.id, name: "Kart", total: 3400, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id, act: c => c.api.put(`${PLANS}/${c.setup}`, { total: 100 }) },
  "Taksit kartı sil (Değersiz yok)": { noWriteOff: true, setup: async c => (await c.must("kart", c.api.post(PLANS, { accountId: c.a.id, name: "Kart", total: 3400, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id, act: c => c.api.del(`${PLANS}/${c.setup}`) },
};
const only = process.argv[3] ? process.argv[3].split("|") : null;
for (const [name, fn] of Object.entries(cases)) if (!only || only.includes(name)) await run(name, fn);
process.exit(0);
