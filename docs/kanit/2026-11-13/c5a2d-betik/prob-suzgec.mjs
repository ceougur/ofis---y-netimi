// Ç5-A tur 2d İş 1 sondası — Y10 / Y11 / Y12 (süzgeç dalları): kapıdan geçen (mağaza) yazımda süzgecin kararı, tam kapının kararı ve yanıt.
// ROOT=<kod kopyası> node prob-suzgec.mjs  → her durum için JSON satırı (gateVerify açık / kapalı).
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const { CURRENT, bootVersion } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/surumler.mjs")).href);
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const TODAY = "2026-10-20";
const LOCK = "2026-10-10";
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

const tpl = mkdtempSync(path.join(tmpdir(), "c5a2d-prob-tpl-"));
const ids = {};
{
  const s = await bootVersion(CURRENT, { dataDir: path.join(tpl, "data"), backupDir: path.join(tpl, "backups"), now: NOW, integrityScan: false });
  const api = await s.login();
  const q = (sql, ...a) => s.app.store.get(sql, ...a);
  await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
  const bank = await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
  ids.bank = bank.id || bank.account?.id;
  await must("çek kullan", api.put(`/api/workspace/bank/accounts/${ids.bank}`, { useCheque: true, useNote: true }));
  const A = await must("A", api.post("/api/workspace/accounts", { name: "Prob A", type: "customer", registeredOn: "2026-10-01" }));
  const B = await must("B", api.post("/api/workspace/accounts", { name: "Prob B", type: "customer", registeredOn: "2026-10-01" }));
  Object.assign(ids, { A: A.id, B: B.id });
  const cheque = body => must(`evrak ${body.serialNo}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", dueDate: "2026-12-01", issueDate: "2026-10-03", ...body }));
  await cheque({ serialNo: "P-1", amount: "400", accountId: A.id });
  await cheque({ serialNo: "P-2", amount: "300" });
  await cheque({ serialNo: "P-4", amount: "350", accountId: A.id });
  await cheque({ serialNo: "P-5", amount: "350", accountId: A.id });
  await cheque({ serialNo: "P-6", amount: "250", accountId: A.id });
  await cheque({ serialNo: "P-3", amount: "220" });
  for (const n of [1, 2, 3, 4, 5, 6]) ids[`c${n}`] = q("SELECT id FROM cheques WHERE serial_no = ?", `P-${n}`).id;
  await must("P-4 tahsile", api.post(`/api/workspace/cheques/${ids.c4}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: ids.bank }));
  await must("P-5 tahsile", api.post(`/api/workspace/cheques/${ids.c5}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: ids.bank }));
  await must("P-6 tahsile", api.post(`/api/workspace/cheques/${ids.c6}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: ids.bank }));
  await must("P-3 karşılıksız (kilitte, carisiz)", api.post(`/api/workspace/cheques/${ids.c3}/actions`, { action: "bounce", date: "2026-10-05" }));
  await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
  await s.app.ledger.snapshots.runPending();
  Object.assign(ids, {
    k4: q("SELECT id, event_id AS e FROM cheque_collections WHERE cheque_id = ?", ids.c4),
    k5: q("SELECT id, event_id AS e FROM cheque_collections WHERE cheque_id = ?", ids.c5),
    k6: q("SELECT id, event_id AS e FROM cheque_collections WHERE cheque_id = ?", ids.c6),
    e1: q("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", ids.c1).id,
  });
  await s.close();
}

const PROBES = [
  ["Y10a tahsil kaydı başlığı: eşit tutarlı iki kaydın event_id'si takas", st => st.run("UPDATE cheque_collections SET event_id = CASE id WHEN ? THEN ? WHEN ? THEN ? END WHERE id IN (?, ?)", ids.k4.id, ids.k5.e, ids.k5.id, ids.k4.e, ids.k4.id, ids.k5.id)],
  ["Y10b tahsil kaydı başlığı: başka kaydın başlığına (farklı tutar)", st => st.run("UPDATE cheque_collections SET event_id = ? WHERE id = ?", ids.k6.e, ids.k4.id)],
  ["Y10c tahsil kaydı başlığı: boşaltılır", st => st.run("UPDATE cheque_collections SET event_id = '' WHERE id = ?", ids.k4.id)],
  ["Y11a bugün tarihli, carisiz kilitli evrağın alış satırı eklenir", st => st.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES ('prob-e1', ?, 'credit', 300, ?, 'x', NULL, 'cheque', ?, 'u', '2026-10-20T09:00:00.000Z')", ids.A, TODAY, ids.c2)],
  ["Y11b bugün tarihli, carili kilitli evrağın ikinci alış satırı (başka cari)", st => st.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES ('prob-e2', ?, 'credit', 400, ?, 'x', NULL, 'cheque', ?, 'u', '2026-10-20T09:00:00.000Z')", ids.B, TODAY, ids.c1)],
  ["Y11c (iki adım) carisiz kilitli karşılıksıza cari, sonra bugün tarihli karşılıksız borç satırı", st => {
    st.run("UPDATE cheques SET account_id = ? WHERE id = ?", ids.A, ids.c3);
    return st.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES ('prob-e3', ?, 'debt', 220, ?, 'x', NULL, 'cheque', ?, 'u', '2026-10-20T09:00:00.000Z')", ids.A, TODAY, ids.c3);
  }],
  ["Y11d (tek işlem) carisiz kilitli karşılıksıza cari + bugün tarihli karşılıksız borç satırı", st => st.tx(() => {
    st.run("UPDATE cheques SET account_id = ? WHERE id = ?", ids.A, ids.c3);
    return st.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, created_by, created_at) VALUES ('prob-e3', ?, 'debt', 220, ?, 'x', NULL, 'cheque', ?, 'u', '2026-10-20T09:00:00.000Z')", ids.A, TODAY, ids.c3);
  })],
  ["Y12a carili kilitli evrağın carisi silinir", st => st.run("UPDATE cheques SET account_id = '' WHERE id = ?", ids.c1)],
  ["Y12b carili kilitli evrağın carisi başka cariye", st => st.run("UPDATE cheques SET account_id = ? WHERE id = ?", ids.B, ids.c1)],
  ["Y12c carisiz kilitli evrağa cari yazılır", st => st.run("UPDATE cheques SET account_id = ? WHERE id = ?", ids.A, ids.c2)],
];

for (const verify of [true, false]) {
  for (const [name, write] of PROBES) {
    const root = mkdtempSync(path.join(tmpdir(), "c5a2d-prob-"));
    cpSync(tpl, root, { recursive: true });
    const s = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: NOW, integrityScan: false, gateVerify: verify });
    let out;
    try {
      await s.app.ledger.snapshots.runPending();
      s.app.integrity.scan();
      try {
        const r = write(s.app.store);
        out = { sonuc: "kabul", changes: r?.changes };
      } catch (error) {
        out = { sonuc: "red", status: error.status, code: error.code || error.details?.code || "", ileti: String(error.message).slice(0, 220) };
      }
      const g = s.app.integrity.stats().gate || {};
      out.kapi = { path: g.path, reason: g.reason };
      if (out.sonuc === "kabul") out.tarama = s.app.integrity.scan().findings.map(f => f.code);
    } finally {
      await s.close();
      rmSync(root, { recursive: true, force: true });
    }
    console.log(JSON.stringify({ kod: process.env.ETIKET || "", gateVerify: verify, durum: name, ...out }));
  }
}
rmSync(tpl, { recursive: true, force: true });
