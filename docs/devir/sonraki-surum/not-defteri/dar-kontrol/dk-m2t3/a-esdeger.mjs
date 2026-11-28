// DK-M2T3 A: Değersiz sınırı — YENİ kod (t251-m2t3, kısaltmalar açık) ile ESKİ kod (t251-m2t2-taban = tur 1 tam hesap) aynı işlemlerle; her adımda liste + form ucu karşılaştırılır.
// Kullanım: node a-esdeger.mjs <tohumlar> <cari> <adım>
const NEW = process.env.YENI || "/home/user/ofis---y-netimi/.claude/worktrees/agent-a02b88ddb7dc8cfcb";
const TRACE = process.env.IZ || "";
const OLD = process.env.ESKI || "/dev/shm/dk-m2t3-eski";
const hn = await import(`${NEW}/test/helpers.mjs`);
const ho = await import(`${OLD}/test/helpers.mjs`);
const on = await import(`${NEW}/test/banka-210-ortak.mjs`);
const oo = await import(`${OLD}/test/banka-210-ortak.mjs`);
const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const seeds = (process.argv[2] || "1").split(",").map(Number);
const CARI = Number(process.argv[3] || 4);
const STEPS = Number(process.argv[4] || 14);
const mulberry = seed => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const tl = m => (m / 100).toFixed(2).replace(".", ",");
const CDAYS = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-22", "2026-09-25", "2026-09-28", "2026-10-01", "2026-10-03", "2026-10-05", "2026-10-08", "2026-10-10", "2026-10-12", TODAY];
const stats = { steps: 0, snapshots: 0, quotes: 0, diffs: 0, writes: 0, over: 0, statusDiff: 0, restored: 0, released: 0, recDel: 0, s155: 0, later: 0, mid: 0 };
const diffs = [];
function norm(value, ids) {
  if (Array.isArray(value)) return value.map(v => norm(v, ids));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (["id", "entryId", "recordId", "accountId", "party", "createdAt", "updatedAt", "by", "user", "eventNo", "trashId"].includes(k)) continue;
      out[k] = norm(value[k], ids);
    }
    return out;
  }
  if (typeof value === "string" && ids.has(value)) return `#${ids.get(value)}`;
  return value;
}
async function run(seed) {
  const sn = await hn.startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const so = await ho.startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const an0 = on.apiOf(await hn.loginAdmin(sn));
  let traceOn = false;
  const an = new Proxy(an0, { get(t, k) { const f = t[k]; if (typeof f !== "function" || !["post", "put", "del"].includes(k)) return f; return async (url, body) => { const r = await f(url, body); if (traceOn) console.log(`IZ ${k} ${url.replace(/[a-z]+-[0-9a-f-]{36}/g, m => m.slice(0, 12))} ${JSON.stringify(body || {})} → ${r.status} ${r.status !== 200 ? String(r.error).slice(0, 200) : ""}`); return r; }; } });
  const ao = oo.apiOf(await ho.loginAdmin(so));
  const rand = mulberry(seed * 104729 + 3);
  const pick = l => l[Math.floor(rand() * l.length)];
  try {
    await an.post("/api/workspace/bank/setup/dismiss", {});
    await ao.post("/api/workspace/bank/setup/dismiss", {});
    const both = async (method, urlN, urlO, body) => {
      const rn = await an[method](urlN, body);
      const ro = await ao[method](urlO, body);
      return [rn, ro];
    };
    for (let c = 0; c < CARI; c += 1) {
      traceOn = TRACE === `${seed}:${c}`;
      const body = { name: `DK Eşdeğer ${seed}-${c}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 77${seed % 10} ${String(c).padStart(2, "0")} 01` };
      const [cn, co] = await both("post", ACC, ACC, body);
      const P = { n: cn.data.id, o: co.data.id };
      const invs = [];
      const nInv = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < nInv; i += 1) {
        const price = pick(["2900", "1500", "4000"]);
        const b = id => ({ scenario: "service_sale", accountId: id, issueDate: i ? "2026-09-14" : "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: price, vatRate: 0 }], payment: { rest: "open" } });
        const rn = await an.post(INV, b(P.n));
        const ro = await ao.post(INV, b(P.o));
        invs.push({ n: rn.data.id, o: ro.data.id });
      }
      const debt = process.env.S155 ? pick(["2000", "1200", "500", "3400"]) : pick(["3400", "1200", "6000", "0"]);
      if (debt !== "0") await both("post", `${ACC}/${P.n}/entries`, `${ACC}/${P.o}/entries`, { kind: "debt", amount: debt, date: "2026-09-12", note: "Borç" });
      const recs = []; // {n,o}
      const deleted = []; // {n,o} entry ids
      const ids = new Map();
      const compare = async label => {
        const ln = await an.get(`${ACC}/${P.n}/doubtful`);
        const lo = await ao.get(`${ACC}/${P.o}/doubtful`);
        const idsN = new Map(); const idsO = new Map();
        recs.forEach((r, i) => { idsN.set(r.n, i); idsO.set(r.o, i); });
        const pn = norm(ln.data.records.map(r => ({ status: r.status, writeOff: r.writeOff ?? null, remaining: r.remainingMinor ?? r.remaining })), idsN);
        const po = norm(lo.data.records.map(r => ({ status: r.status, writeOff: r.writeOff ?? null, remaining: r.remainingMinor ?? r.remaining })), idsO);
        stats.snapshots += 1;
        if (JSON.stringify(pn) !== JSON.stringify(po)) { stats.diffs += 1; diffs.push({ label, kind: "liste", n: pn, o: po }); }
        for (const r of recs) {
          const recN = ln.data.records.find(x => x.id === r.n);
          if (!recN || recN.status !== "open") continue;
          if (recN.writeOff?.best && recN.writeOff?.today && recN.writeOff?.first && recN.writeOff.best.date !== recN.writeOff.first.date && recN.writeOff.best.date !== recN.writeOff.today.date) stats.mid += 1;
          for (const day of CDAYS.filter(d => d >= recN.date)) {
            const qn = await an.get(`${ACC}/${P.n}/doubtful/${r.n}/write-off?date=${day}`);
            const qo = await ao.get(`${ACC}/${P.o}/doubtful/${r.o}/write-off?date=${day}`);
            stats.quotes += 1;
            if (qn.data?.s155) stats.s155 += 1;
            const a = JSON.stringify([qn.status, norm(qn.data, idsN)]);
            const b = JSON.stringify([qo.status, norm(qo.data, idsO)]);
            if (a !== b) { stats.diffs += 1; diffs.push({ label: `${label} uç ${day}`, kind: "uç", n: [qn.status, norm(qn.data, idsN)], o: [qo.status, norm(qo.data, idsO)] }); }
          }
        }
      };
      for (let step = 0; step < STEPS; step += 1) {
        stats.steps += 1;
        const kind = !recs.length && step >= 1 ? "take" : pick(["bound", "bound", "bound", "sameday", "sameday", "free", "free", "take", "take", "write", "write", "write", "write", "partial", "partial", "partial", "over", "over", "delete", "delete", "restore", "restore", "release", "recdel"]);
        const date = pick(CDAYS);
        const status = async (label, pair) => { if (pair[0].status !== pair[1].status) { stats.statusDiff += 1; diffs.push({ label: `${label}`, kind: "durum", n: [pair[0].status, pair[0].code, pair[0].error], o: [pair[1].status, pair[1].code, pair[1].error] }); } return pair; };
        if (kind === "bound" || kind === "free" || (kind === "sameday" && recs.length)) {
          let d = date;
          if (kind === "sameday") {
            const r = pick(recs);
            const rec = (await an.get(`${ACC}/${P.n}/doubtful`)).data.records.find(x => x.id === r.n);
            if (!rec) continue;
            d = rec.date;
          }
          const inv = pick(invs);
          const amount = tl(Math.round(1000 + rand() * (kind === "free" ? (process.env.S155 ? 60000 : 150000) : (process.env.S155 ? 120000 : 300000))));
          const b = inv2 => ({ kind: "in", amount, date: d, method: "cash", cashForce: true, similarOk: true, note: kind, ...(kind !== "free" ? { invoiceId: inv2 } : {}) });
          const rn = await an.post(`${ACC}/${P.n}/entries`, b(inv.n));
          const ro = await ao.post(`${ACC}/${P.o}/entries`, b(inv.o));
          await status(`t${seed} c${c} s${step} ${kind}`, [rn, ro]);
        } else if (kind === "take" && recs.length < (process.env.S155 ? 4 : 3)) {
          const b = { amount: pick(["3000", "1500", "500", "1000", "2000"]), date: date < "2026-09-13" ? "2026-09-13" : date, reason: pick(["lawsuit", "lawsuit", "protest"]) };
          const pair = await status(`t${seed} c${c} s${step} take`, await both("post", `${ACC}/${P.n}/doubtful`, `${ACC}/${P.o}/doubtful`, b));
          if (pair[0].status === 200 && pair[1].status === 200) recs.push({ n: pair[0].data.record.id, o: pair[1].data.record.id });
        } else if ((kind === "write" || kind === "partial" || kind === "over") && recs.length) {
          const r = pick(recs);
          const q = await an.get(`${ACC}/${P.n}/doubtful/${r.n}/write-off?date=${date}`);
          if (q.status !== 200 || q.data.blocked || !(q.data.offerMinor > 0)) continue;
          let amount = q.data.offerMinor;
          if (kind === "partial") amount = Math.max(1, Math.floor(amount * (0.2 + rand() * 0.6)));
          if (kind === "over") amount = rand() < 0.5 ? q.data.offerMinor + 1 : (q.data.limitMinor || q.data.offerMinor) + (rand() < 0.5 ? 0 : 1);
          const pair = await status(`t${seed} c${c} s${step} ${kind} ${tl(amount)} @${date}`, await both("post", `${ACC}/${P.n}/doubtful/${r.n}/write-off`, `${ACC}/${P.o}/doubtful/${r.o}/write-off`, { amount: tl(amount), date }));
          if (kind !== "over" && pair[0].status !== 200) diffs.push({ label: `t${seed} c${c} s${step} ÖNERİLEN REDDEDİLDİ ${tl(amount)} @${date}`, kind: "öneri-ret", n: [pair[0].status, pair[0].error] });
          if (kind === "over") stats.over += 1; else stats.writes += 1;
        } else if (kind === "delete" && recs.length) {
          const r = pick(recs);
          const recN = (await an.get(`${ACC}/${P.n}/doubtful`)).data.records.find(x => x.id === r.n);
          const recO = (await ao.get(`${ACC}/${P.o}/doubtful`)).data.records.find(x => x.id === r.o);
          const ln = recN?.writeOffs?.at(-1); const lo = recO?.writeOffs?.at(-1);
          if (!ln || !lo) continue;
          const pair = await status(`t${seed} c${c} s${step} delete`, [await an.del(`${ACC}/${P.n}/doubtful/${r.n}/write-offs/${ln.entryId}`), await ao.del(`${ACC}/${P.o}/doubtful/${r.o}/write-offs/${lo.entryId}`)]);
          if (pair[0].status === 200 && pair[1].status === 200) deleted.push({ n: ln.entryId, o: lo.entryId });
        } else if (kind === "restore" && deleted.length) {
          const e = deleted.splice(Math.floor(rand() * deleted.length), 1)[0];
          const tn = (await an.get("/api/admin/trash")).data.find(x => x.kind === "doubtful-writeoff" && x.ref === e.n);
          const to = (await ao.get("/api/admin/trash")).data.find(x => x.kind === "doubtful-writeoff" && x.ref === e.o);
          if (!tn || !to) continue;
          const pair = await status(`t${seed} c${c} s${step} restore`, [await an.post("/api/admin/trash/restore", { id: tn.id }), await ao.post("/api/admin/trash/restore", { id: to.id })]);
          if (pair[0].status === 200) stats.restored += 1;
        } else if (kind === "release" && recs.length && rand() < 0.5) {
          const r = pick(recs);
          const pair = await status(`t${seed} c${c} s${step} release`, await both("post", `${ACC}/${P.n}/doubtful/${r.n}/release`, `${ACC}/${P.o}/doubtful/${r.o}/release`, { date: pick([TODAY, "2026-10-01"]) }));
          if (pair[0].status === 200) stats.released += 1;
        } else if (kind === "recdel" && recs.length && rand() < 0.4) {
          const i = Math.floor(rand() * recs.length);
          const r = recs[i];
          const pair = await status(`t${seed} c${c} s${step} recdel`, [await an.del(`${ACC}/${P.n}/doubtful/${r.n}`), await ao.del(`${ACC}/${P.o}/doubtful/${r.o}`)]);
          if (pair[0].status === 200 && pair[1].status === 200) { recs.splice(i, 1); stats.recDel += 1; }
        }
        await compare(`t${seed} c${c} s${step} ${kind}`);
      }
    }
    // dönem kilidi
    for (const lock of ["2026-09-17", "2026-09-30"]) {
      await an.put("/api/admin/period-lock", { lockedUntil: lock });
      await ao.put("/api/admin/period-lock", { lockedUntil: lock });
      const accsN = (await an.get(`${ACC}?limit=500`)).data;
      // yalnız liste karşılaştırması (bütün cariler) — kimlik eşleşmesi ad ile
      const listN = Array.isArray(accsN) ? accsN : accsN.accounts || accsN.items || [];
      const accsO = (await ao.get(`${ACC}?limit=500`)).data;
      const listO = Array.isArray(accsO) ? accsO : accsO.accounts || accsO.items || [];
      for (const a of listN.filter(x => String(x.name).startsWith("DK Eşdeğer"))) {
        const b = listO.find(x => x.name === a.name);
        const ln = await an.get(`${ACC}/${a.id}/doubtful`);
        const lo = await ao.get(`${ACC}/${b.id}/doubtful`);
        const strip = l => l.data.records.map(r => norm({ date: r.date, status: r.status, writeOff: r.writeOff ?? null }, new Map()));
        stats.snapshots += 1;
        if (JSON.stringify(strip(ln)) !== JSON.stringify(strip(lo))) { stats.diffs += 1; diffs.push({ label: `kilit ${lock} ${a.name}`, kind: "liste", n: strip(ln), o: strip(lo) }); }
      }
    }
    const inN = await an.get("/api/workspace/ledger/integrity");
    const inO = await ao.get("/api/workspace/ledger/integrity");
    console.log(`# tohum ${seed} Mutabakat yeni ok=${inN.data?.ok} eski ok=${inO.data?.ok}`);
    if (!inN.data?.ok) console.log(JSON.stringify(inN.data?.failures).slice(0, 800));
  } finally {
    sn.close(); so.close();
  }
}
for (const s of seeds) await run(s);
console.log(`# TZ=${process.env.TZ || "(yok)"} ${JSON.stringify(stats)}`);
for (const d of diffs.slice(0, 6)) console.log(JSON.stringify(d).slice(0, 900));
console.log(`# fark ${diffs.length}`);
process.exit(0);
