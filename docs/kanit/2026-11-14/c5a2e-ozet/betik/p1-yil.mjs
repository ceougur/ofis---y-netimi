// P1 (K-d): kilit yıl ortasında (v2.4.9 gerçek koduyla), kilitli aday reddi → 602 farkı fişin yılında; fişten sonra kilit yıl sonunu aşar → ön izleme ↔ Mutabakat
import { S, dirs, cur, must, rid, lt, integ, short, sums } from "./ortak.mjs";
const URL = "/api/admin/ledger/rule-diff-correction";
const d = dirs("p1");
try {
  const old = await S.bootVersion("v2.4.9", { dataDir: d.dataDir, backupDir: d.backupDir, now: { time: "2026-10-20T12:00:00+03:00", fixed: true } });
  let entryId;
  try {
    const o = await old.login();
    await o.post("/api/workspace/bank/setup/dismiss", {});
    const a = await must("cari", o.post("/api/workspace/accounts", { name: "Deneme Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    await must("açılış", o.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "700", date: "2026-10-02", note: "Açılış bakiyesi" }));
    entryId = old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Açılış bakiyesi'", a.id).id;
    await must("kilit", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
  } finally {
    await old.close();
  }
  let c = await cur(d, "2026-10-20");
  console.log("aday durumu:", c.app.store.get("SELECT opening_review r FROM account_entries WHERE id = ?", entryId).r);
  const i0 = await integ(c.api);
  console.log("[0] kural farkı (karar yok):", JSON.stringify(short(i0.item)));
  await must("ret", c.api.post(`/api/workspace/opening-review/${entryId}`, { decision: "reject" }));
  const v = (await c.api.get(URL)).data;
  console.log("[1] ön izleme (ret, 2026):", v.date, v.disabled, v.code, "|", lt(v.lines));
  const p = await must("fiş", c.api.post(URL, { requestId: rid(), digest: v.digest, confirm: true }));
  console.log("[1] fiş:", p.voucher.noText, p.voucher.date, lt(p.voucher.lines));
  const i1 = await integ(c.api);
  console.log("[1] Mutabakat:", i1.ok, JSON.stringify(short(i1.item)));
  await c.server.close();
  c = await cur(d, "2027-01-10");
  await must("kilit ilerlet", c.api.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" }));
  await c.app.ledger.snapshots.runPending();
  const i2 = await integ(c.api);
  console.log("[2] Mutabakat (2027, kilit 31.12.2026):", i2.ok, i2.failures.join(","), JSON.stringify(short(i2.item)));
  const v2 = (await c.api.get(URL)).data;
  console.log("[2] ön izleme:", v2.date, "disabled", v2.disabled, v2.code, v2.reason, "|", lt(v2.lines), "| count", v2.count);
  if (!v2.disabled) {
    const p2 = await c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true });
    console.log("[3] ikinci fiş:", p2.status, p2.data?.voucher?.noText, p2.data?.voucher?.date, lt(p2.data?.voucher?.lines));
    const i3 = await integ(c.api);
    console.log("[3] Mutabakat:", i3.ok, JSON.stringify(short(i3.item)));
    const v3 = (await c.api.get(URL)).data;
    console.log("[3] ön izleme:", v3.disabled, v3.code, "|", lt(v3.lines));
    console.log("[3] 2027 defteri:", JSON.stringify(sums(c.app, "2027-01-01", "2027-12-31", ["602", "671", "681", "519", "500"])));
    console.log("[3] 2026 defteri:", JSON.stringify(sums(c.app, "2026-01-01", "2026-12-31", ["602", "671", "681", "519", "500"])));
  }
  await c.server.close();
} finally {
  d.cleanup();
}
