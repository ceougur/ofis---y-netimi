// DK-M2T3 F: yedek → değişiklik → geri yükleme sonrası liste / form / ret aynı mı; iki şirkette aynı taban (ret ikisinde, bellek karışmaz). node f-yedek-sirket.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l}: ${r.status} ${r.error}`); return r.data; };
async function base(tag) {
  const a = await must("cari", api.post(ACC, { name: `F ${tag}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 8${tag.length}1 22 3${tag.length}` }));
  const inv = await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
  await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { a, inv, s };
}
const snap = async b => {
  const list = await must("liste", api.get(`${ACC}/${b.a.id}/doubtful`));
  const r = list.records.find(x => x.id === b.s);
  const q = await must("uç", api.get(`${ACC}/${b.a.id}/doubtful/${b.s}/write-off?date=2026-09-17`));
  const card = await must("kart", api.get(`${ACC}/${b.a.id}`));
  return JSON.stringify({ bal: card.totals.balance, wo: r.writeOffs?.length, writeOff: r.writeOff, q: [q.limitMinor, q.offerMinor, q.why] });
};
const c2pre = await must("002", api.post("/api/companies", { name: "Yedek Şirketi F", select: true }));
const CID = c2pre.id || c2pre.company?.id;
console.log(`şirket ${CID}`);
const b = await base("Yedek");
const s0 = await snap(b);
const backup = await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: CID }));
const name = backup.backups[0].name;
const line = (await must("liste", api.get(`${ACC}/${b.a.id}/doubtful`))).records.find(x => x.id === b.s).writeOffs[0];
await must("Değersiz sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${line.entryId}`));
await must("iptal (Değersiz yok)", api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }));
const s1 = await snap(b);
await must("geri yükle", api.post("/api/admin/backups/restore", { name, company: CID, confirm: "002", password: h.ADMIN_PASSWORD }));
const s2 = await snap(b);
console.log(`yedek öncesi ${s0}\ndeğişiklik ${s1}\ngeri yükleme ${s2}\neşit(önce, geri yükleme) = ${s0 === s2}`);
const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" });
console.log(`geri yüklemeden sonra iptal: ${r.status} ${r.code} · Mutabakat ${(await api.get("/api/workspace/ledger/integrity")).data?.ok}`);
// İkinci şirket
await api.post("/api/companies/select", { id: "sirket-001" });
const c2 = { code: "001" };
const b2 = await base("İkinci");
const r2 = await api.post(`${INV}/${b2.inv.id}/cancel`, { reason: "x" });
const e2 = await api.post(`${INV}/${b2.inv.id}/edit`, { scenario: "service_sale", accountId: b2.a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "100", vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
console.log(`öbür şirket (${c2.code || c2.company?.code || "?"}): iptal ${r2.status} ${r2.code} · düzenle ${e2.status} ${e2.code} · ${await snap(b2)} · Mutabakat ${(await api.get("/api/workspace/ledger/integrity")).data?.ok}`);
await api.post("/api/companies/select", { id: CID });
console.log(`şirket 002'ye dönüş: ${await snap(b)}`);
server.close();
process.exit(0);
