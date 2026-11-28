// DK-M2T3 D: formun ÖNERDİĞİ Değersiz tutarı kapıda reddediliyor (eşdeğerlik taraması tohum 37 cari 2'den küçültüldü). node d-oneri-ret.mjs <kök> [geri yükleme yerine doğrudan yaz: 1]
const ROOT = process.argv[2];
const DIRECT = process.argv[3] === "1";
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l}: ${r.status} ${r.error}`); return r.data; };
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const a = await must("cari", api.post(ACC, { name: "D Öneri Ret", type: "customer", registeredOn: "2026-09-01", phone: "0500 601 01 01" }));
const inv = await must("fatura 1.500 @14.09", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-14", lines: [{ name: "Hizmet", qty: 1, unitPrice: "1500", vatRate: 0 }], payment: { rest: "open" } }));
await must("borç 3.400 @12.09", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
const s1 = (await must("S1 500 @01.10", api.post(`${ACC}/${a.id}/doubtful`, { amount: "500", date: "2026-10-01", reason: "lawsuit" }))).record.id;
for (const amount of ["1327,19", "122,85", "168,48"]) await must(`bağlı ${amount} @01.10`, api.post(`${ACC}/${a.id}/entries`, pay(amount, "2026-10-01", inv.id)));
if (DIRECT) {
  await must("bağlı 501,63 @14.09", api.post(`${ACC}/${a.id}/entries`, pay("501,63", "2026-09-14", inv.id)));
  const q = await must("uç", api.get(`${ACC}/${a.id}/doubtful/${s1}/write-off?date=2026-10-15`));
  console.log(`S1 form @15.10: sınır ${q.limitMinor} öneri ${q.offerMinor}`);
  await must("Değersiz 500 @15.10 (S1)", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "500", date: "2026-10-15" }));
} else {
  await must("Değersiz 500 @15.10 (S1)", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "500", date: "2026-10-15" }));
  const line = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(x => x.id === s1).writeOffs.at(-1);
  await must("Değersiz satırını sil", api.del(`${ACC}/${a.id}/doubtful/${s1}/write-offs/${line.entryId}`));
  await must("bağlı 501,63 @14.09", api.post(`${ACC}/${a.id}/entries`, pay("501,63", "2026-09-14", inv.id)));
  const t = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.kind === "doubtful-writeoff" && x.ref === line.entryId);
  await must("geri yükle", api.post("/api/admin/trash/restore", { id: t.id }));
}
const s2 = (await must("S2 1.500 @19.09", api.post(`${ACC}/${a.id}/doubtful`, { amount: "1500", date: "2026-09-19", reason: "lawsuit" }))).record.id;
const card = await must("kart", api.get(`${ACC}/${a.id}`));
const list = await must("liste", api.get(`${ACC}/${a.id}/doubtful`));
const r2 = list.records.find(x => x.id === s2);
console.log(`bakiye ${card.totals.balance} · S2 listesi: bugün ${JSON.stringify(r2.writeOff?.today && [r2.writeOff.today.limitMinor, r2.writeOff.today.offerMinor])} en iyi ${JSON.stringify(r2.writeOff?.best && [r2.writeOff.best.date, r2.writeOff.best.limitMinor, r2.writeOff.best.offerMinor])}`);
const integ = await api.get("/api/workspace/ledger/integrity");
console.log(`Mutabakat (önce) ${integ.data?.ok}`);
for (const day of ["2026-09-19", "2026-09-25", "2026-10-01", "2026-10-15"]) {
  const q = await must("uç", api.get(`${ACC}/${a.id}/doubtful/${s2}/write-off?date=${day}`));
  const tl = m => (m / 100).toFixed(2).replace(".", ",");
  const r = await api.post(`${ACC}/${a.id}/doubtful/${s2}/write-off`, { amount: tl(q.offerMinor), date: day });
  console.log(`S2 @${day}: form sınır ${q.limitMinor} öneri ${q.offerMinor} ${q.why} → önerilen yazım ${r.status} ${r.status !== 200 ? String(r.error).slice(0, 330) : ""}`);
  if (r.status === 200) {
    const line = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(x => x.id === s2).writeOffs.at(-1);
    await must("geri al", api.del(`${ACC}/${a.id}/doubtful/${s2}/write-offs/${line.entryId}`));
  } else {
    // gerçekte yazılabilen en büyük tutar (ikili arama, her deneme ya reddedilir ya geri alınır)
    let lo = 0, hi = q.offerMinor;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const t = await api.post(`${ACC}/${a.id}/doubtful/${s2}/write-off`, { amount: tl(mid), date: day });
      if (t.status === 200) {
        lo = mid;
        const line = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(x => x.id === s2).writeOffs.at(-1);
        await must("geri al", api.del(`${ACC}/${a.id}/doubtful/${s2}/write-offs/${line.entryId}`));
      } else hi = mid;
    }
    console.log(`   gerçekte yazılabilen en çok ${lo} kuruş @${day}`);
  }
}
server.close();
process.exit(0);
