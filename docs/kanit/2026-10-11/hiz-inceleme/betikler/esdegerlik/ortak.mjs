// Ortak karşılaştırma: eski (07b8f60 = 2824f22 dondurulmuş kâhin; diff ile doğrulandı) ↔ yeni (HEAD) — rapor merkezi (yerinde + iş parçacığı)
// ve moneyLines uçları. Ürün kodunu değiştirmez.
import assert from "node:assert/strict";
const R = "/home/user/ofis---y-netimi";
const { registerCashRoutes } = await import(`${R}/server/routes/cash.mjs`);
const { createMoneyLines: createOldMoneyLines } = await import(`${R}/test/fixtures/hiz-210-eski/money-lines.mjs`);
const { registerReportCenter: registerOldReportCenter } = await import(`${R}/test/fixtures/hiz-210-eski/report-center.mjs`);

export const plain = value => JSON.parse(JSON.stringify(value));
const noRouter = () => new Proxy({}, { get: () => () => {} });
export const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export function adminOf(app) {
  const user = app.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
  app.context.access.attach(user);
  user.roleKey = app.context.access.roleKeyOf(user);
  return user;
}
export function oldPath(app) {
  const ctx = app.context;
  const money = createOldMoneyLines(ctx.store);
  const cash = registerCashRoutes(noRouter(), { ...ctx, money });
  const center = registerOldReportCenter(noRouter(), { ...ctx, money, cash: () => cash, accounts: () => ctx.accounts, plans: () => ctx.plans, stock: () => ctx.stock, cheques: () => ctx.cheques, invoices: () => ctx.invoices, overview: () => ctx.overview, ledger: () => ctx.ledger, integrity: () => ctx.integrity });
  return { money, cash, center };
}

export function reportCases(banks) {
  const out = [];
  for (const bankGroup of ["", "real", "debt", "unassigned", "all"]) out.push(["banka-bakiye", bankGroup ? { bankGroup } : {}]);
  const accounts = ["", ...banks.map(bank => bank.id), "unassigned", "bacc-yok"];
  for (const bankAccount of accounts) for (const bankMove of ["", "external", "internal"]) out.push(["banka-hareket", { ...(bankAccount ? { bankAccount } : {}), ...(bankMove ? { bankMove } : {}) }]);
  for (const payMethod of ["", "bank", "card", "cash"]) out.push(["banka-pos-hareketleri", payMethod ? { payMethod } : {}]);
  out.push(["kasa-hareketleri", {}], ["kasa-gunluk", {}], ["alt-hesap-mizani", {}]);
  for (const feeAccount of ["", ...banks.map(bank => bank.id), "bacc-yok"]) out.push(["banka-masraf", feeAccount ? { feeAccount } : {}]);
  return out;
}

/** Her dönem × her rapor: eski ↔ yeni yerinde ↔ yeni iş parçacığı (hepsi). Fark listesi döner (assert etmez). */
export async function compareReports(app, label, periods, banks, { worker = true } = {}) {
  const user = adminOf(app);
  const old = oldPath(app);
  const center = app.context.reportCenter;
  const workerIds = new Set(["banka-bakiye", "banka-hareket", "banka-masraf"]);
  const diffs = [];
  let compared = 0;
  let rows = 0;
  for (const [periodName, period] of periods) {
    for (const [id, filter] of reportCases(banks)) {
      const query = { ...period, ...filter };
      const tag = `${label} · ${id} ${JSON.stringify(filter)} · ${periodName}`;
      let expected;
      let error = null;
      try {
        expected = plain(await old.center.run(user, id, new URLSearchParams(query)));
      } catch (caught) {
        error = caught;
      }
      const paths = [["yerinde", { inline: true }], ...(worker && workerIds.has(id) ? [["iş parçacığı", {}]] : [])];
      for (const [way, options] of paths) {
        compared += 1;
        let actual;
        let got = null;
        try {
          actual = plain(await center.run(user, id, new URLSearchParams(query), options));
        } catch (caught) {
          got = caught;
        }
        if (error || got) {
          if (!error || !got || error.message !== got.message || error.status !== got.status) diffs.push({ tag, way, expected: error ? `HATA ${error.status} ${error.message}` : "ok", actual: got ? `HATA ${got.status} ${got.message}` : "ok" });
          continue;
        }
        try {
          assert.deepStrictEqual(actual, expected);
        } catch (e) {
          // ilk farklı satırı bul
          const first = [];
          for (const key of Object.keys(expected)) if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) first.push(key);
          let rowDiff = null;
          if (first.includes("rows")) {
            const n = Math.max(expected.rows.length, actual.rows.length);
            for (let i = 0; i < n; i += 1) if (JSON.stringify(expected.rows[i]) !== JSON.stringify(actual.rows[i])) { rowDiff = { i, expected: expected.rows[i], actual: actual.rows[i], lenE: expected.rows.length, lenA: actual.rows.length }; break; }
          }
          diffs.push({ tag, way, keys: first, rowDiff, summaryE: first.includes("summary") ? expected.summary : undefined, summaryA: first.includes("summary") ? actual.summary : undefined });
        }
      }
      if (!error) rows += expected.total;
    }
  }
  return { compared, rows, diffs };
}

function oldBalanceTotals(lines, from, day) {
  const sums = new Map();
  const ahead = { count: 0, cents: 0, first: "" };
  for (const line of lines) {
    const signed = line.kind === "in" ? Number(line.cents) : -Number(line.cents);
    if (!line.ref && line.date > day) {
      ahead.count += 1;
      ahead.cents += signed;
      if (!ahead.first || line.date < ahead.first) ahead.first = line.date;
      continue;
    }
    const key = line.ref || `u:${line.way}`;
    if (!sums.has(key)) sums.set(key, { opening: 0, ext_in: 0, ext_out: 0, tr_in: 0, tr_out: 0, adjust: 0, closing: 0, lines: 0 });
    const b = sums.get(key);
    b.closing += signed;
    b.lines += 1;
    if (from && line.date < from) {
      b.opening += signed;
      continue;
    }
    for (const column of ["ext_in", "ext_out", "tr_in", "tr_out", "adjust"]) b[column] += line[column];
  }
  return { sums: Object.fromEntries([...sums].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), ahead };
}
const newBalanceTotals = items => {
  const sums = {};
  const ahead = { count: 0, cents: 0, first: "" };
  for (const item of items) {
    if (Number(item.ahead) === 1) {
      ahead.count += item.lines;
      ahead.cents += item.closing;
      if (!ahead.first || item.first < ahead.first) ahead.first = item.first;
      continue;
    }
    sums[item.key] = { opening: item.opening, ext_in: item.ext_in, ext_out: item.ext_out, tr_in: item.tr_in, tr_out: item.tr_out, adjust: item.adjust, closing: item.closing, lines: item.lines };
  }
  return { sums: Object.fromEntries(Object.entries(sums).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), ahead };
};
function oldBefore(lines, keyOf, from) {
  const order = [];
  const sums = new Map();
  for (const line of lines) {
    if (!(from && line.date < from)) continue;
    const key = keyOf(line);
    if (!sums.has(key)) {
      sums.set(key, { cents: 0, count: 0 });
      order.push(key);
    }
    sums.get(key).cents += line.kind === "in" ? Number(line.cents) : -Number(line.cents);
    sums.get(key).count += 1;
  }
  return order.map(key => ({ key, ...sums.get(key) }));
}

/** moneyLines: eski ↔ yeni; froms: denenecek dönem başları (sınır günleri dahil). */
export function compareMoney(app, label, { today, froms, untils, banks }) {
  const fresh = app.context.money;
  const old = createOldMoneyLines(app.store);
  const diffs = [];
  let checks = 0;
  const same = (actual, expected, tag) => {
    checks += 1;
    const a = JSON.stringify(plain(actual));
    const e = JSON.stringify(plain(expected));
    if (a !== e) diffs.push({ tag: `${label} · ${tag}`, expected: e.slice(0, 600), actual: a.slice(0, 600) });
  };
  const refs = banks.map(bank => bank.id);
  const real = banks.filter(bank => bank.kind !== "card" && bank.kind !== "loan").map(bank => bank.id);
  for (const ways of [null, ["cash"], ["bank"], ["card"], ["bank", "card"], ["bank", "card", "ccard", "loan"], ["ccard"], ["loan"], ["unknown"], ["cash", "unknown"]]) {
    same(fresh.lines({ ways }), old.lines({ ways }), `lines ${ways}`);
    for (const until of untils) same(fresh.classified({ ways, until, light: true }), old.classified({ ways, until, light: true }), `classified light ${ways} ${until}`);
  }
  for (const day of [...untils.filter(Boolean), today, "9999-12-31"]) {
    const full = old.summary(day);
    for (const way of ["cash", "bank", "card"]) same(fresh.wayBalance(way, day), { all: full.byMethod[way], at: full.byMethodAt[way] }, `wayBalance ${way} ${day}`);
  }
  // Okuma uçlarının geri kalanı (kaynağa itilen yol/eşitlik koşulu ve CROSS JOIN bunları da etkiler).
  for (const ref of ["", ...refs, "bacc-silinmis"]) {
    same(fresh.lines({ ref }), old.lines({ ref }), `lines ref ${ref}`);
    same(fresh.refTotal({ ref }), old.refTotal({ ref }), `refTotal ${ref}`);
    for (const after of untils.filter(Boolean)) same(fresh.refTotal({ ref, after }), old.refTotal({ ref, after }), `refTotal ${ref} ${after}`);
    same(fresh.lastDate(ref), old.lastDate(ref), `lastDate ${ref}`);
  }
  for (const method of ["", "cash", "bank", "card", "noncash"]) {
    const ways = method === "" ? null : method === "noncash" ? ["bank", "card"] : [method];
    same(fresh.rows({ ways }), old.rows({ ways }), `rows ${method}`);
  }
  same(fresh.lines({ unbound: true, light: true }), old.lines({ unbound: true, light: true }), "lines unbound");
  same(fresh.groups(), old.groups(), "groups");
  same(fresh.balances(), old.balances(), "balances");
  for (const day of [...untils.filter(Boolean), today, "9999-12-31"]) {
    same(fresh.summary(day), old.summary(day), `summary ${day}`);
    same(fresh.flows(day), old.flows(day), `flows ${day}`);
    same(fresh.unassigned({ until: day }), old.unassigned({ until: day }), `unassigned until ${day}`);
    same(fresh.unassigned({ after: day }), old.unassigned({ after: day }), `unassigned after ${day}`);
  }
  same(fresh.unassignedWays({}), old.unassignedWays({}), "unassignedWays");
  for (const from of froms) for (const to of untils) same(fresh.periodGroups({ from, to }), old.periodGroups({ from, to }), `periodGroups ${from} ${to}`);
  const allWays = ["bank", "card", "ccard", "loan"];
  for (const until of untils) {
    const lines = old.classified({ ways: allWays, until, light: true });
    for (const from of froms) for (const day of [today, addDays(today, 15), addDays(today, -30)]) {
      same(newBalanceTotals(fresh.classifiedTotals({ ways: allWays, until, from, day })), oldBalanceTotals(lines, from, day), `classifiedTotals until ${until} from ${from} day ${day}`);
    }
  }
  const scopes = [
    ["tüm Gerçek Banka", { ways: ["bank"], refs: real }, { ways: ["bank"] }, line => line.ref && real.includes(line.ref), line => line.ref],
    ["Hesabı Atanmamış", { ways: ["bank", "card"], unbound: true }, { ways: ["bank", "card"] }, line => !line.ref, line => `u:${line.way}`],
    ...refs.map(ref => [`hesap ${ref}`, { ref }, { ref }, () => true, line => line.ref]),
  ];
  for (const [name, scope, oldScope, keep, keyOf] of scopes) {
    for (const until of untils) {
      const lines = old.classified({ ...oldScope, until }).filter(keep);
      for (const from of froms) {
        same(fresh.classified({ ...scope, since: from, until }).filter(keep), lines.filter(line => !from || line.date >= from), `${name} dönem satırları ${from}–${until}`);
        same(from ? fresh.keyTotals({ ...scope, before: from, until }) : [], oldBefore(lines, keyOf, from), `${name} devir ${from}–${until}`);
      }
    }
  }
  return { checks, diffs };
}
