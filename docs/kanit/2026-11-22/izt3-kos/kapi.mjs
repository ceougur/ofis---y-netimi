// İzt3 — kapı senaryo dökümü (eski ↔ yeni eşdeğerlik kanıtı; kalıcı sınama test/izt3-kapi-rowid-250.test.mjs). Kullanım: node kapi.mjs <kod kökü> <prod|test>
// Her senaryo taze sunucuda: sonuç (200 / 409 + bulgu kodları / başka hata), her COMMIT'in kapı yolu (scoped / full + neden), sonunda Mutabakat Testi (ok + bulgu kodları) ve sayılar.
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = path.resolve(process.argv[2]);
const MODE = process.argv[3] || "prod";
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { boot } = await imp("test/banka-210-ortak.mjs");
const NOW = "2026-10-08T12:00:00+03:00";
const W = "/api/workspace";
const options = { now: { time: NOW, fixed: true }, gateVerify: MODE === "test", moneyStrict: false };

async function world(fn) {
  const ctx = await boot(options);
  const gates = [];
  ctx.store.addCommitGuard({ check() {}, after() { const g = ctx.app.integrity.stats().gate; if (g) gates.push(g.path === "full" ? `full(${g.reason})` : "scoped"); } });
  const must = async (label, p) => {
    const r = await p;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data;
  };
  const h = {
    ...ctx, gates, must,
    acc: async () => (await must("cari", ctx.api.post(`${W}/accounts`, { name: "Kapı Cari", type: "customer", registeredOn: "2026-08-01" }))).id,
    item: async () => (await must("mal", ctx.api.post(`${W}/stock`, { kind: "goods", code: "KP-1", name: "Kapı Malı", unit: "Adet", openingQty: "50", salePrice: "250" }))).id,
    sale: async (A, item, qty, date = "2026-10-01") => (await must("satış", ctx.api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: A, issueDate: date, lines: [{ itemId: item, name: "Kapı Malı", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" } }))).id,
    edit: async (id, qty) => {
      const d = await must("fatura", ctx.api.get(`${W}/invoices/${id}`));
      return ctx.api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: d.lines.map(l => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty, unitPrice: l.unitPrice, vatRate: l.vatRate })), payment: { rest: "account" }, force: true });
    },
    integrity: async () => {
      const r = (await ctx.api.get(`${W}/ledger/integrity`)).data;
      return r.ok ? "ok" : `FARK[${[...new Set((r.failures || []).map(f => f.code))].sort().join(",")}]`;
    },
    tx: fn2 => {
      try {
        ctx.store.raw("test: kapı", () => ctx.store.tx(fn2));
        return "kabul";
      } catch (e) {
        if (e?.extra?.code === "gate-equivalence") return `EŞDEĞERLİK-İHLALİ[${e.extra.failures.map(f => f.code).join(",")}]`;
        if (e?.status === 409) return `409[${[...new Set((e.failures || e.extra?.failures || []).map(f => f.code))].sort().join(",")}]`;
        return `HATA(${e?.status || ""} ${String(e?.message).slice(0, 120)})`;
      }
    },
    raw: (sql, ...a) => ctx.db.prepare(sql).run(...a),
    last: table => ctx.store.get(`SELECT rowid AS r, * FROM ${table} ORDER BY rowid DESC LIMIT 1`),
    copyInsert: (table, row, patch) => {
      const cols = ctx.store.all(`PRAGMA table_info(${table})`).map(c => c.name);
      const next = { ...row, ...patch };
      return [`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map(c => next[c] ?? null)];
    },
  };
  try {
    return await fn(h);
  } finally {
    await ctx.server.close();
  }
}
const lockAt = async (h, day) => (await h.api.put("/api/admin/period-lock", { lockedUntil: day })).status;
const cashLast = async (h, date) => (await h.must("Kasa", h.api.post(`${W}/cash`, { kind: "in", amount: "40", date, description: "kp" })));

const S = {
  // 1) program yolu: yeni kaydedilmiş faturanın Düzenle'si (azaltma / aynı / ikinci)
  "P1 Düzenle azaltma + ikinci Düzenle": h => h.acc().then(async A => {
    const it = await h.item();
    const f = await h.sale(A, it, 3);
    h.gates.length = 0;
    const r1 = (await h.edit(f, 2)).status;
    const g1 = h.gates.join(" ");
    h.gates.length = 0;
    const r2 = (await h.edit(f, 2)).status;
    const g2 = h.gates.join(" ");
    h.gates.length = 0;
    const r3 = (await h.edit(f, 1)).status;
    const qty = h.store.get("SELECT SUM(CASE WHEN kind = 'in' THEN qty ELSE -qty END) AS q FROM stock_moves WHERE item_id = ?", it).q;
    const bal = (await h.must("cari", h.api.get(`${W}/accounts/${A}`))).totals.balance;
    return `azalt ${r1} [${g1}] · aynı ${r2} [${g2}] · ikinci azalt ${r3} [${h.gates.join(" ")}] · stok ${qty} · bakiye ${bal} · ${await h.integrity()}`;
  }),
  // 2) store üzerinden ham SQL, açık dönem: son stok hareketini sil + aynı rowid'e yeni kimlikli kopya
  "Y1 açık: son stok hareketi sil + aynı rowid yeni kimlik (aynı içerik)": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3);
    const row = h.last("stock_moves");
    const res = h.tx(() => {
      h.store.run("DELETE FROM stock_moves WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("stock_moves", row, { id: `${row.id}-y` }));
    });
    const now = h.store.get("SELECT rowid AS r, id FROM stock_moves WHERE rowid = ?", row.r);
    return `${res} · rowid aynı ${now?.r === row.r} id ${now?.id === row.id ? "eski" : now?.id ? "yeni" : "yok"} · ${await h.integrity()}`;
  }),
  "Y2 açık: son stok hareketi sil + aynı rowid yeni kimlik + miktar 1 → 2": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3);
    const row = h.last("stock_moves");
    const res = h.tx(() => {
      h.store.run("DELETE FROM stock_moves WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("stock_moves", row, { id: `${row.id}-y`, qty: row.qty + 1 }));
    });
    return `${res} · ${await h.integrity()}`;
  }),
  "Y3 açık: son Kasa satırı sil + aynı rowid yeni kimlik (aynı içerik)": async h => {
    await cashLast(h, "2026-10-05");
    const row = h.last("cash_entries");
    const res = h.tx(() => {
      h.store.run("DELETE FROM cash_entries WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("cash_entries", row, { id: `${row.id}-y` }));
    });
    return `${res} [${h.gates.at(-1) || ""}] · ${await h.integrity()}`;
  },
  // 3) kilitli dönem (store üzerinden)
  "K1 kilitli: son Kasa satırı (kilitli tarih) sil + aynı rowid yeni kimlik (aynı içerik)": async h => {
    await cashLast(h, "2026-09-10");
    const lk = await lockAt(h, "2026-09-30");
    const row = h.last("cash_entries");
    const res = h.tx(() => {
      h.store.run("DELETE FROM cash_entries WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("cash_entries", row, { id: `${row.id}-y` }));
    });
    return `kilit ${lk} · ${res} · satır ${h.store.get("SELECT id FROM cash_entries WHERE rowid = ?", row.r)?.id === row.id ? "eski" : "değişti"} · ${await h.integrity()}`;
  },
  "K2 kilitli: son stok hareketi (kilitli tarihli satış) sil + aynı rowid yeni kimlik (aynı içerik)": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3, "2026-09-10");
    const lk = await lockAt(h, "2026-09-30");
    const row = h.last("stock_moves");
    const res = h.tx(() => {
      h.store.run("DELETE FROM stock_moves WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("stock_moves", row, { id: `${row.id}-y` }));
    });
    return `kilit ${lk} · ${res} · ${await h.integrity()}`;
  }),
  "K3 kilitli: UPDATE SET id (eklenmemiş rowid)": async h => {
    await cashLast(h, "2026-09-10");
    await lockAt(h, "2026-09-30");
    const row = h.last("cash_entries");
    const res = h.tx(() => h.store.run("UPDATE cash_entries SET id = ? WHERE id = ?", `${row.id}-x`, row.id));
    return `${res} [${h.gates.at(-1) || ""}] · ${await h.integrity()}`;
  },
  "K4 açık: UPDATE SET id (eklenmemiş rowid)": async h => {
    await cashLast(h, "2026-10-05");
    const row = h.last("cash_entries");
    h.gates.length = 0;
    const res = h.tx(() => h.store.run("UPDATE cash_entries SET id = ? WHERE id = ?", `${row.id}-x`, row.id));
    return `${res} [${h.gates.join(" ")}] · ${await h.integrity()}`;
  },
  // 4) store DIŞI (db.prepare) — kapı görmez; sonraki COMMIT tam kapı, tarama bulur
  "D1 dış: son stok hareketi sil + aynı rowid yeni kimlik (açık)": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3);
    const row = h.last("stock_moves");
    h.raw("DELETE FROM stock_moves WHERE id = ?", row.id);
    h.raw(...h.copyInsert("stock_moves", row, { id: `${row.id}-y` }));
    const scan = await h.integrity();
    h.gates.length = 0;
    const next = await h.api.post(`${W}/cash`, { kind: "in", amount: "5", date: "2026-10-08", description: "sonraki" });
    return `rowid aynı ${h.store.get("SELECT id FROM stock_moves WHERE rowid = ?", row.r)?.id === `${row.id}-y`} · tarama ${scan} · sonraki yazım ${next.status} [${h.gates.join(" ")}]`;
  }),
  "D2 dış: kilitli Kasa satırı sil + aynı rowid yeni kimlik": async h => {
    await cashLast(h, "2026-09-10");
    await lockAt(h, "2026-09-30");
    const row = h.last("cash_entries");
    h.raw("DELETE FROM cash_entries WHERE id = ?", row.id);
    h.raw(...h.copyInsert("cash_entries", row, { id: `${row.id}-y` }));
    const scan = await h.integrity();
    h.gates.length = 0;
    const next = await h.api.post(`${W}/cash`, { kind: "in", amount: "5", date: "2026-10-08", description: "sonraki" });
    return `tarama ${scan} · sonraki yazım ${next.status} [${h.gates.join(" ")}]`;
  },
  "D3 dış: Düzenle'nin rowid'i yeniden kullandığı stok hareketinin miktarı değişir": h => h.acc().then(async A => {
    const it = await h.item();
    const f = await h.sale(A, it, 3);
    const before = h.last("stock_moves");
    await h.edit(f, 2);
    const after = h.last("stock_moves");
    h.raw("UPDATE stock_moves SET qty = qty + 1 WHERE rowid = ?", after.r);
    const scan = await h.integrity();
    h.gates.length = 0;
    const next = await h.api.post(`${W}/cash`, { kind: "in", amount: "5", date: "2026-10-08", description: "sonraki" });
    return `rowid yeniden ${before.r === after.r && before.id !== after.id} · tarama ${scan} · sonraki yazım ${next.status} [${h.gates.join(" ")}]`;
  }),
  "D4 dış: kilitli stok hareketi silinip aynı rowid + aynı kimlikle miktarı değişik geri yazılır": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3, "2026-09-10");
    await lockAt(h, "2026-09-30");
    const row = h.last("stock_moves");
    h.raw("DELETE FROM stock_moves WHERE id = ?", row.id);
    h.raw(...h.copyInsert("stock_moves", row, { qty: row.qty + 1 }));
    const scan = await h.integrity();
    h.gates.length = 0;
    const next = await h.api.post(`${W}/cash`, { kind: "in", amount: "5", date: "2026-10-08", description: "sonraki" });
    return `rowid aynı ${h.store.get("SELECT id FROM stock_moves WHERE rowid = ?", row.r)?.id === row.id} · tarama ${scan} · sonraki yazım ${next.status} [${h.gates.join(" ")}]`;
  }),
  "Y4 kapı içi: silinip aynı rowid + aynı kimlikle miktarı değişik geri yazılır (açık)": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3);
    const row = h.last("stock_moves");
    const res = h.tx(() => {
      h.store.run("DELETE FROM stock_moves WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("stock_moves", row, { qty: row.qty + 1 }));
    });
    return `${res} · ${await h.integrity()}`;
  }),
  "K5 kapı içi: kilitli stok hareketi silinip aynı rowid + aynı kimlikle miktarı değişik geri yazılır": h => h.acc().then(async A => {
    const it = await h.item();
    await h.sale(A, it, 3, "2026-09-10");
    await lockAt(h, "2026-09-30");
    const row = h.last("stock_moves");
    const res = h.tx(() => {
      h.store.run("DELETE FROM stock_moves WHERE id = ?", row.id);
      h.store.run(...h.copyInsert("stock_moves", row, { qty: row.qty + 1 }));
    });
    return `${res} · ${await h.integrity()}`;
  }),
};
for (const [name, fn] of Object.entries(S)) {
  let out;
  try {
    out = await world(fn);
  } catch (e) {
    out = `PROB HATASI ${e.message}`;
  }
  console.log(`${name} :: ${out}`);
}
process.exit(0);
