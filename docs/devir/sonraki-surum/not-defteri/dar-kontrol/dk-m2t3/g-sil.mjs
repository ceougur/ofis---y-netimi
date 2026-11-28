// DK-M2T3 G: S-DKM2-3 = C — başka şüpheli kaydın silinmesi reddinin iletisi; 'ne yapmalı' izlenince silme kabul mü; geri yükleme fiili. node g-sil.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l}: ${r.status} ${r.error}`); return r.data; };
const bal = async id => (await api.get(`${ACC}/${id}`)).data.totals.balance;
const a = await must("cari", api.post(ACC, { name: "G Sil", type: "customer", registeredOn: "2026-09-01", phone: "0500 909 01 01" }));
await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
const s2 = (await must("S2", api.post(`${ACC}/${a.id}/doubtful`, { amount: "1000", date: "2026-09-13", reason: "lawsuit" }))).record.id;
const s1 = (await must("S1", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-15", reason: "lawsuit" }))).record.id;
await must("bağsız 1.000 @01.10", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "1000", date: "2026-10-01", method: "cash", cashForce: true, similarOk: true, note: "t" }));
const q = await must("uç", api.get(`${ACC}/${a.id}/doubtful/${s1}/write-off?date=2026-09-20`));
console.log(`S1 form @20.09 sınır ${q.limitMinor} öneri ${q.offerMinor}`);
await must("Değersiz S1 3.000 @20.09", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "3000", date: "2026-09-20" }));
console.log(`bakiye ${await bal(a.id)}`);
const r = await api.del(`${ACC}/${a.id}/doubtful/${s2}`);
console.log(`S2 sil: ${r.status} ${r.code}\n  ${r.error}`);
// 'Ne yapmalı' izlenir: Değersiz satırını sil → S2'yi sil → Değersiz'i formun önerisiyle yeniden yaz
const line = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(x => x.id === s1).writeOffs[0];
await must("Değersiz sil", api.del(`${ACC}/${a.id}/doubtful/${s1}/write-offs/${line.entryId}`));
const r2 = await api.del(`${ACC}/${a.id}/doubtful/${s2}`);
const q2 = await must("uç", api.get(`${ACC}/${a.id}/doubtful/${s1}/write-off?date=2026-09-20`));
console.log(`Değersiz silindikten sonra S2 sil: ${r2.status} · S1 form @20.09 sınır ${q2.limitMinor} öneri ${q2.offerMinor} · bakiye ${await bal(a.id)}`);
const w = await api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: (q2.offerMinor / 100).toFixed(2).replace(".", ","), date: "2026-09-20" });
console.log(`yeniden Değersiz ${q2.offerMinor}: ${w.status} · bakiye ${await bal(a.id)} · Mutabakat ${(await api.get("/api/workspace/ledger/integrity")).data?.ok}`);
// geri yükleme fiili: S2'yi Silinenler'den geri yükle (S1 Değersiz'i yazılıyken)
const t = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.ref === s2 || String(x.id).includes(s2) || x.kind === "doubtful");
const r3 = t ? await api.post("/api/admin/trash/restore", { id: t.id }) : { status: "yok" };
console.log(`S2 geri yükle (${t?.kind}): ${r3.status} ${r3.code || ""}\n  ${r3.error || ""} · bakiye ${await bal(a.id)} · Mutabakat ${(await api.get("/api/workspace/ledger/integrity")).data?.ok}`);
server.close();
process.exit(0);
