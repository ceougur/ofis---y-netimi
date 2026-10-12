// Sonda (bağımsız doğrulayıcı, 12.10.2026; KOD DEĞİŞTİRMEZ): mevcut banka ekranları (İşlem Kartı, Banka Hareketleri, hesap kartı) tahsile
// verilmiş evrakla tutarlı mı? Ana Defter'in kendi kuralı (Alt Hesap Mizanı 101.01/101.02) ile İşlem Kartı'nın yevmiye satırları karşılaştırılır.
//   node docs/kanit/2026-10-12/tahsile-ver/gerileme/sonda-islem-karti.mjs
import { ADMIN_PASSWORD, createClient, startTestServer } from "../../../../../test/helpers.mjs";

const server = await startTestServer({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
const client = createClient(server.base);
await client.login("admin", ADMIN_PASSWORD);
const unwrap = res => ({ status: res.status, data: res.data?.ok === true ? res.data.data : res.data });
const get = async url => unwrap(await client.get(url));
const post = async (url, body) => unwrap(await client.post(url, body));
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const out = {};
const ziraat = await must("ziraat", post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
await must("garanti", post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
const abc = await must("cari", post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
const cheque = await must("çek", post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: abc.id, serialNo: "IK-1" }));
const deposited = await must("tahsile ver", post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: ziraat.id }));
out.depositEventNo = deposited.collection?.eventNo;
const depositCard = await get(`/api/workspace/bank/events/${encodeURIComponent(out.depositEventNo)}`);
out.depositCard = { status: depositCard.status, type: depositCard.data?.type, source: depositCard.data?.source, lines: depositCard.data?.lines, linesSource: depositCard.data?.linesSource };
await must("tahsil", post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: "2026-10-08", method: "bank" }));
const collectEvent = (await get(`/api/workspace/bank/movements?account=${ziraat.id}`)).data;
out.movementsKeys = Object.keys(collectEvent || {});
const rows = collectEvent?.rows || collectEvent?.movements || collectEvent?.items || [];
out.movementRows = rows.map(row => ({ no: row.no, type: row.type, typeLabel: row.typeLabel, amount: row.amountMinor ?? row.amount, date: row.date }));
const collectRow = rows.find(row => /cheque|çek|Çek/i.test(`${row.type} ${row.typeLabel} ${row.description}`) && row.no !== out.depositEventNo);
out.collectEventNo = collectRow?.no || "";
if (collectRow) {
  const card = await get(`/api/workspace/bank/events/${encodeURIComponent(collectRow.no)}`);
  out.collectCard = { status: card.status, type: card.data?.type, lines: (card.data?.lines || []).map(line => ({ gl: line.gl, sub: line.sub, subName: line.subName, side: line.side, tryMinor: line.tryMinor })), linesSource: card.data?.linesSource };
}
out.subTrial = (await get("/api/workspace/bank/sub-trial")).data?.rows?.filter(row => row.account === "101");
out.ledger101 = (await get("/api/workspace/ledger")).data?.trial?.accounts?.find(row => row.code === "101");
out.integrityOk = (await get("/api/workspace/ledger/integrity")).data?.ok;
console.log(JSON.stringify(out, null, 1));
await server.app.close();
