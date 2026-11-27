// İş 2 sondası: v2.4.9'un gerçek koduyla üretilmiş kilitli veri (fikstür) → ön izleme → fiş → Mutabakat Testi → değişmez → ters kayıt. ROOT=<kod> FIX=<fikstür adı>.
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const FIX = process.env.FIX || "surum-2.4.9-s127";
const { CURRENT, bootVersion } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/surumler.mjs")).href);
const { readFixture, unpackFixture } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/fikstur.mjs")).href);
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const meta = readFixture(FIX);
const today = process.env.TODAY || meta.oncesi?.today || String(meta.now).slice(0, 10);
const fixture = unpackFixture(FIX);
const out = { fikstur: FIX, today, lock: meta.lockedUntil };
const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false });
const app = server.app;
const rd = r => (r.data?.checks || []).find(c => c.code === "ledger:rule-diff") || null;
const brief = item => item && { ok: item.ok, name: item.name, count: item.count, difference: item.difference, corrected: item.corrected, correction: item.correction, hint: item.hint };
const logN = () => app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
const class15 = entries => {
  const m = new Map();
  for (const e of entries) for (const l of e.lines) if (/^[1-5]/.test(l.account)) m.set(l.account, (m.get(l.account) || 0) + l.debit - l.credit);
  return m;
};
const diffMaps = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter(k => (a.get(k) || 0) !== (b.get(k) || 0)).map(k => `${k}: karma ${(a.get(k) || 0) / 100} ↔ baştan ${(b.get(k) || 0) / 100}`);
try {
  const api = await server.login();
  await app.ledger.snapshots.runPending();
  out.dondurma = app.ledger.snapshots.state();
  const log0 = logN();
  const i0 = await api.get("/api/workspace/ledger/integrity");
  out.once = { mutabakatOk: i0.data.ok, failures: (i0.data.failures || []).map(f => f.code), kuralFarki: brief(rd(i0)) };
  const cand = await api.get("/api/workspace/opening-review");
  out.adaylar = cand.data?.counts;
  let p = await api.get("/api/admin/ledger/rule-diff-correction");
  out.onizleme1 = { status: p.status, disabled: p.data.disabled, reason: p.data.reason, date: p.data.date, lines: p.data.lines?.map(l => `${l.debit ? "B" : "A"} ${l.account}${l.sub ? "/" + l.sub : ""} ${(l.debit || l.credit) / 100}`), excluded: p.data.excluded?.map(r => `${r.account} ${r.party ? "cari" : ""} ${r.minor / 100}`), sourceCount: p.data.sourceCount, ornekKaynak: p.data.sources?.slice(0, 3) };
  if (p.data.code === "rule-diff-candidates") {
    for (const item of cand.data.items) await api.post(`/api/workspace/opening-review/${item.id}`, { decision: "confirm" });
    p = await api.get("/api/admin/ledger/rule-diff-correction");
    out.onizleme2 = { disabled: p.data.disabled, reason: p.data.reason, lines: p.data.lines?.map(l => `${l.debit ? "B" : "A"} ${l.account}${l.sub ? "/" + l.sub : ""} ${(l.debit || l.credit) / 100}`) };
  }
  const yetkisiz = await api.post("/api/admin/ledger/rule-diff-correction", { requestId: "c5a2b-sonda-000000001", digest: "yanlis", confirm: true });
  out.yanlisImza = `${yetkisiz.status} ${yetkisiz.data?.error?.code || yetkisiz.data?.code || ""}`;
  const post = await api.post("/api/admin/ledger/rule-diff-correction", { requestId: "c5a2b-sonda-000000002", digest: p.data.digest, confirm: true });
  out.kaydet = { status: post.status, no: post.data?.voucher?.noText, date: post.data?.voucher?.date, err: post.data?.error };
  const again = await api.post("/api/admin/ledger/rule-diff-correction", { requestId: "c5a2b-sonda-000000002", digest: p.data.digest, confirm: true });
  out.ayniIstek = { status: again.status, replayed: again.data?.replayed };
  const i1 = await api.get("/api/workspace/ledger/integrity");
  out.sonra = { mutabakatOk: i1.data.ok, failures: (i1.data.failures || []).map(f => f.code), kuralFarki: brief(rd(i1)), gunlukArtisi: logN() - log0 };
  const live = app.ledger.build().filter(e => !String(e.id).startsWith("voucher"));
  const karma = app.ledger.book({});
  out.degismez15 = diffMaps(class15(karma), class15(live));
  const p2 = await api.get("/api/admin/ledger/rule-diff-correction");
  out.onizlemeSonra = { disabled: p2.data.disabled, reason: p2.data.reason };
  if (post.data?.voucher?.id) {
    const rev = await api.post(`/api/admin/ledger/vouchers/${post.data.voucher.id}/reverse`, { requestId: "c5a2b-sonda-ters-00000001" });
    out.ters = rev.status;
    const i2 = await api.get("/api/workspace/ledger/integrity");
    out.tersSonra = { mutabakatOk: i2.data.ok, kuralFarki: brief(rd(i2)), gunlukArtisi: logN() - log0 };
  }
} catch (e) { out.HATA = String(e.stack || e).slice(0, 1200); }
console.log(JSON.stringify(out, null, 1));
await server.close();
fixture.cleanup();
