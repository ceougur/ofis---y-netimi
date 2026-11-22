// 2.5.0 İzleyen tur 3 — İş 1 (görev metni docs/devir/2.5.0-DEVAM/izt3-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §21.1): bütünlük kapısının süzgecinde rowid yeniden kullanımı.
// KARAR (görev metninden AYNEN): BAŞ MİMAR KARARI 22.11 01:02 (1) — "bütünlük kapısının kapsam süzgeci aynı rowid yeniden kullanılınca ('kimlik değişti') TAM denetime düşüyor (~7,1 sn)"; öneri "süzgeçte 'aynı
// rowid + farklı kimlik' SİLİNEN + EKLENEN iki ayrı satır sayılsın". KOŞUL (pazarlıksız): "kapı dışı (program dışından) yapılan HER değişiklik bugünkü gibi YAKALANMAYA DEVAM EDER".
// BEKLENENLER: tabanın (3b420085) GERÇEK kodunun aynı senaryodaki sonucu (eski ↔ yeni döküm docs/kanit/2026-11-22/izt3-kos/; ders 6) — durum, 409 bulgu kodları, Mutabakat Testi bulguları, sayılar.
// Değişen YALNIZ kapı YOLU: yeni kaydedilmiş faturanın Düzenle'si üretim kipinde süzgeçte biter (tabanda "stock_moves: kimlik değişti" → tam kapı).
// Her senaryo iki kipte: üretim (gateVerify kapalı — gerçek kurulum, ders 14) ve test (gateVerify açık — süzgeç "temiz" deyip tam kapı reddederse 500 gate-equivalence).
// NASIL BOZARIM (mutant, rapor): (m1) süzgeç kimlik değişimini hiç saymaz (eşleşme kalır, "kimlik değişti" yok) → K1 / K3 kırmızı (üretimde kabul, testte eşdeğerlik ihlali); (m2) kimlik farkı
// EKLENMEMİŞ rowid'de de bölünür (önceki turun prototipi) → K4 (D8 bekçisi: tam kapı "kimlik değişti") kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boot } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const W = "/api/workspace";
const KIPLER = [["üretim kipi", false], ["test kipi (eşdeğerlik denetimi açık)", true]];

async function world(verify, fn) {
  const ctx = await boot({ now: { time: NOW, fixed: true }, gateVerify: verify, moneyStrict: false });
  const gates = [];
  ctx.store.addCommitGuard({
    check() {},
    after() {
      const g = ctx.app.integrity.stats().gate;
      if (g) gates.push(g.path === "full" ? `full(${g.reason})` : "scoped");
    },
  });
  const must = async (label, p) => {
    const r = await p;
    assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data;
  };
  const h = {
    ...ctx,
    gates,
    must,
    acc: async () => (await must("cari", ctx.api.post(`${W}/accounts`, { name: "Kapı Cari", type: "customer", registeredOn: "2026-08-01" }))).id,
    item: async () => (await must("mal", ctx.api.post(`${W}/stock`, { kind: "goods", code: "KP-1", name: "Kapı Malı", unit: "Adet", openingQty: "50", salePrice: "250" }))).id,
    sale: async (A, item, qty, date = "2026-10-01") => (await must("satış", ctx.api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: A, issueDate: date, lines: [{ itemId: item, name: "Kapı Malı", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" } }))).id,
    edit: async (id, qty) => {
      const d = await must("fatura", ctx.api.get(`${W}/invoices/${id}`));
      return ctx.api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: d.lines.map(l => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty, unitPrice: l.unitPrice, vatRate: l.vatRate })), payment: { rest: "account" }, force: true });
    },
    cash: date => must("Kasa", ctx.api.post(`${W}/cash`, { kind: "in", amount: "40", date, description: "kp" })),
    lock: async day => assert.equal((await ctx.api.put("/api/admin/period-lock", { lockedUntil: day })).status, 200, "Dönem Kilidi"),
    // Mutabakat Testi (tam tarama): "ok" ya da bulgu kodları.
    scan: async () => {
      const r = (await ctx.api.get(`${W}/ledger/integrity`)).data;
      return r.ok ? "ok" : [...new Set((r.failures || []).map(f => f.code))].sort().join(",");
    },
    // Store üzerinden ham SQL (hatalı bir modülün yazacağı gibi; K6'yı store.raw işaretiyle atlar): kabul / 409 + bulgu kodları / eşdeğerlik ihlali.
    tx: fn2 => {
      try {
        ctx.store.raw("test: kapı", () => ctx.store.tx(fn2));
        return "kabul";
      } catch (e) {
        if (e?.extra?.code === "gate-equivalence") return `EŞDEĞERLİK-İHLALİ(${e.extra.failures.map(f => f.code).join(",")})`;
        if (e?.status === 409) return `409:${[...new Set((e.failures || e.extra?.failures || []).map(f => f.code))].sort().join(",")}`;
        return `HATA(${e?.status || ""} ${String(e?.message).slice(0, 160)})`;
      }
    },
    // Store DIŞI (aynı bağlantıda db.prepare — kapı görmez).
    raw: (sql, ...a) => ctx.db.prepare(sql).run(...a),
    last: table => ctx.store.get(`SELECT rowid AS r, * FROM ${table} ORDER BY rowid DESC LIMIT 1`),
    insertOf: (table, row, patch) => {
      const cols = ctx.store.all(`PRAGMA table_info(${table})`).map(c => c.name);
      const next = { ...row, ...patch };
      return [`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map(c => next[c] ?? null)];
    },
    idAt: (table, rowid) => ctx.store.get(`SELECT id FROM ${table} WHERE rowid = ?`, rowid)?.id,
    nextWrite: async () => {
      gates.length = 0;
      return (await ctx.api.post(`${W}/cash`, { kind: "in", amount: "5", date: "2026-10-08", description: "sonraki" })).status;
    },
  };
  try {
    return await fn(h);
  } finally {
    await ctx.server.close();
  }
}
// En son satırı sil + aynı rowid'e (SQLite yeniden verir) patch'li kopya — aynı işlemde, store üzerinden.
const reuse = (h, table, row, patch) => {
  h.store.run(`DELETE FROM ${table} WHERE id = ?`, row.id);
  h.store.run(...h.insertOf(table, row, patch));
};

for (const [kip, verify] of KIPLER) {
  describe(`İzleyen tur 3 — kapı süzgecinde rowid yeniden kullanımı (${kip})`, () => {
    it("P1: yeni kaydedilmiş faturanın Düzenle'si (azaltma, aynı içerik, ikinci azaltma) — sonuç tabanla aynı; üretimde süzgeç yolu (tabanda tam kapı 'kimlik değişti')", () =>
      world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        const f = await h.sale(A, it, 3);
        const moved = h.last("stock_moves");
        const steps = [];
        for (const qty of [2, 2, 1]) {
          h.gates.length = 0;
          const r = await h.edit(f, qty);
          assert.equal(r.status, 200, `Düzenle → ${qty}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
          steps.push([...h.gates]);
        }
        const after = h.last("stock_moves");
        assert.equal(after.r, moved.r, "Düzenle stok hareketini aynı rowid'e yeniden yazdı (sınamanın ön koşulu)");
        assert.notEqual(after.id, moved.id, "yeni kimlikle");
        const flat = steps.flat();
        assert.ok(!flat.some(g => /kimlik değişti/.test(g)), `hiçbir COMMIT 'kimlik değişti' ile tam kapıya düşmez: ${JSON.stringify(steps)}`);
        if (!verify) assert.ok(flat.length > 0 && flat.every(g => g === "scoped"), `üretimde her COMMIT süzgeçte biter: ${JSON.stringify(steps)}`);
        assert.equal(h.store.get("SELECT SUM(CASE WHEN kind = 'in' THEN qty ELSE -qty END) AS q FROM stock_moves WHERE item_id = ?", it).q, 49, "stok 50 − 1");
        assert.equal((await h.must("cari", h.api.get(`${W}/accounts/${A}`))).totals.balance, 300, "bakiye 1 × 250 + KDV");
        assert.equal(await h.scan(), "ok", "Mutabakat Testi");
      }));

    it("Y1 / Y2 / Y4 (açık dönem, store üzerinden): son stok hareketi silinip aynı rowid'e yeni kimlikle (bozmasız / miktar +1) ya da aynı kimlikle miktar +1 yazılır → 409 invoice:stock (tabanda da)", () =>
      world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        await h.sale(A, it, 3);
        const row = h.last("stock_moves");
        assert.equal(h.tx(() => reuse(h, "stock_moves", row, { id: `${row.id}-y` })), "409:invoice:stock", "Y1 bozmasız kopya, yeni kimlik");
        assert.equal(h.idAt("stock_moves", row.r), row.id, "satır geri alındı");
        assert.equal(h.tx(() => reuse(h, "stock_moves", row, { id: `${row.id}-y`, qty: row.qty + 1 })), "409:invoice:stock", "Y2 miktar +1, yeni kimlik");
        assert.equal(h.tx(() => reuse(h, "stock_moves", row, { qty: row.qty + 1 })), "409:invoice:stock", "Y4 miktar +1, aynı kimlik");
        assert.equal(await h.scan(), "ok", "Mutabakat Testi (reddedilenler yazılmadı)");
      }));

    it("Y3 (açık dönem, store üzerinden): son Kasa satırı silinip aynı rowid'e yeni kimlikle (aynı olay bağıyla) yazılır → kapı kabul eder, tarama bank:event bulur (tabanın davranışı AYNEN)", () =>
      world(verify, async h => {
        await h.cash("2026-10-05");
        const row = h.last("cash_entries");
        assert.equal(h.tx(() => reuse(h, "cash_entries", row, { id: `${row.id}-y` })), "kabul", "tabanda da kabul (tam kapı)");
        assert.equal(h.idAt("cash_entries", row.r), `${row.id}-y`, "aynı rowid, yeni kimlik");
        assert.equal(await h.scan(), "bank:event", "tam tarama işlem başlığı bağını bulur (tabanda da)");
      }));

    it("K1 / K2 / K5 (KİLİTLİ dönem, store üzerinden): kilitli tarihli son satır silinip aynı rowid'e yeni kimlikle (içerik aynı) ya da aynı kimlikle miktar +1 yazılır → 409 period-lock (tabanda da)", () =>
      world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        await h.sale(A, it, 3, "2026-09-10");
        await h.cash("2026-09-10");
        await h.lock("2026-09-30");
        const cash = h.last("cash_entries");
        assert.equal(h.tx(() => reuse(h, "cash_entries", cash, { id: `${cash.id}-y` })), "409:period-lock", "K1 Kasa satırı, yalnız kimlik farklı");
        assert.equal(h.idAt("cash_entries", cash.r), cash.id, "kilitli satır değişmedi");
        const move = h.last("stock_moves");
        assert.equal(h.tx(() => reuse(h, "stock_moves", move, { id: `${move.id}-y` })), "409:invoice:stock,period-lock", "K2 stok hareketi, yalnız kimlik farklı");
        assert.equal(h.tx(() => reuse(h, "stock_moves", move, { qty: move.qty + 1 })), "409:invoice:stock,period-lock", "K5 aynı kimlik, miktar +1");
        assert.equal(await h.scan(), "ok", "Mutabakat Testi");
      }));

    it("K3 / K4 (D8 bekçisi): UPDATE … SET id (rowid'in son hâli eklenmemiş) — kilitliyse 409 period-lock; açıksa bugünkü gibi TAM kapı 'kimlik değişti' (kabul, tarama bank:event)", () =>
      world(verify, async h => {
        await h.cash("2026-10-05");
        const open = h.last("cash_entries");
        h.gates.length = 0;
        assert.equal(h.tx(() => h.store.run("UPDATE cash_entries SET id = ? WHERE id = ?", `${open.id}-x`, open.id)), "kabul", "K4 açık dönem (tabanda da kabul)");
        assert.match(h.gates.at(-1) || "", verify ? /^full\(/ : /^full\(cash_entries: kimlik değişti\)$/, `K4 kapı yolu: ${h.gates.join(" ")}`);
        assert.equal(await h.scan(), "bank:event", "K4 tarama (tabanda da)");
        h.store.raw("test: geri al", () => h.store.tx(() => h.store.run("UPDATE cash_entries SET id = ? WHERE id = ?", open.id, `${open.id}-x`)));
        assert.equal(await h.scan(), "ok", "geri alındı");
        await h.cash("2026-09-10");
        await h.lock("2026-09-30");
        const locked = h.last("cash_entries");
        assert.equal(h.tx(() => h.store.run("UPDATE cash_entries SET id = ? WHERE id = ?", `${locked.id}-x`, locked.id)), "409:period-lock", "K3 kilitli dönem");
        assert.equal(await h.scan(), "ok");
      }));

    it("D1–D4 (store DIŞI — program dışından): aynı rowid'e yeni kimlik (açık / kilitli), Düzenle'nin yeniden kullandığı rowid'in miktarı, silinip aynı kimlikle geri yazılan kilitli satır → tarama bulur, sonraki yazım 409 (tabanda da)", async () => {
      await world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        await h.sale(A, it, 3);
        const row = h.last("stock_moves");
        h.raw("DELETE FROM stock_moves WHERE id = ?", row.id);
        h.raw(...h.insertOf("stock_moves", row, { id: `${row.id}-y` }));
        assert.equal(h.idAt("stock_moves", row.r), `${row.id}-y`, "D1 aynı rowid, yeni kimlik");
        assert.equal(await h.scan(), "invoice:stock", "D1 tarama");
        assert.equal(await h.nextWrite(), 409, "D1 sonraki program yazımı tam kapıda reddedilir");
      });
      await world(verify, async h => {
        await h.cash("2026-09-10");
        await h.lock("2026-09-30");
        const row = h.last("cash_entries");
        h.raw("DELETE FROM cash_entries WHERE id = ?", row.id);
        h.raw(...h.insertOf("cash_entries", row, { id: `${row.id}-y` }));
        assert.equal(await h.scan(), "bank:event,ledger:rule-diff,ledger:snapshot,period-lock", "D2 kilitli: tarama kapanmış dönemin değiştiğini bulur");
        assert.equal(await h.nextWrite(), 409, "D2 sonraki yazım");
      });
      await world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        const f = await h.sale(A, it, 3);
        const before = h.last("stock_moves");
        assert.equal((await h.edit(f, 2)).status, 200);
        const after = h.last("stock_moves");
        assert.ok(after.r === before.r && after.id !== before.id, "D3 ön koşul: Düzenle rowid'i yeniden kullandı");
        h.raw("UPDATE stock_moves SET qty = qty + 1 WHERE rowid = ?", after.r);
        assert.equal(await h.scan(), "invoice:stock", "D3 tarama");
        assert.equal(await h.nextWrite(), 409, "D3 sonraki yazım");
      });
      await world(verify, async h => {
        const A = await h.acc();
        const it = await h.item();
        await h.sale(A, it, 3, "2026-09-10");
        await h.lock("2026-09-30");
        const row = h.last("stock_moves");
        h.raw("DELETE FROM stock_moves WHERE id = ?", row.id);
        h.raw(...h.insertOf("stock_moves", row, { qty: row.qty + 1 }));
        assert.equal(h.idAt("stock_moves", row.r), row.id, "D4 aynı rowid, aynı kimlik");
        assert.equal(await h.scan(), "invoice:stock,ledger:snapshot,period-lock", "D4 tarama");
        assert.equal(await h.nextWrite(), 409, "D4 sonraki yazım");
      });
    });
  });
}

// Bozma bulanıklaştırması (test kipi; 2.0.26'nın gerçek verisi — ders 17): her turda bir tablonun EN BÜYÜK rowid'li satırı silinip aynı rowid'e yeni kimlikli kopya (yarısında bir kolon bozulur) yazılır.
// Süzgeç artık bu yazımları kendisi değerlendirir: "temiz" deyip tam kapının reddettiği (gate-equivalence) yazım OLMAMALI (test/banka-210-gg-kapi.test.mjs bozma bulanıklaştırmasının rowid kolu).
describe("İzleyen tur 3 — rowid yeniden kullanımı bozma bulanıklaştırması (test kipi): süzgeç ↔ tam kapı eşdeğerliği", () => {
  const TABLES = {
    cash_entries: ["amount", "kind", "method", "date", "transfer_id", "event_id"],
    account_entries: ["amount", "kind", "method", "date", "account_id", "source", "source_id", "invoice_id", "event_id"],
    payments: ["amount", "method", "date", "event_id"],
    plan_entries: ["amount", "kind", "method", "date", "plan_id", "cheque_id", "opening", "event_id"],
    stock_moves: ["amount", "qty", "kind", "pay", "method", "date", "item_id", "account_id", "invoice_id", "event_id"],
    cheque_events: ["amount", "kind", "method", "date", "cheque_id", "event_id"],
    plans: ["total", "account_id", "status", "covers_balance", "registered_on", "deleted_at", "invoice_id"],
    plan_items: ["amount", "due_date", "plan_id"],
    cheques: ["amount", "status", "direction", "account_id", "deleted_at", "issue_date", "invoice_id", "plan_id"],
    accounts: ["type", "deleted_at"],
    stock_items: ["kind", "deleted_at"],
    invoices: ["status", "kind", "account_id", "try_payable", "issue_date", "original_id"],
    invoice_lines: ["qty", "net", "payable", "move_id", "invoice_id", "origin_line_id"],
    invoice_offsets: ["amount", "invoice_id", "counter_id", "account_id"],
  };
  for (const [seed, lock, rounds] of [[31, "", 160], [37, "lock", 160]]) {
    it(`tohum ${seed}${lock ? " (kilitli dönem)" : ""}: ${rounds} rowid yeniden kullanımı, eşdeğerlik ihlali yok`, async t => {
      const name = "surum-2.0.26-zincir";
      const today = readFixture(name).oncesi.today;
      const fixture = unpackFixture(name);
      let server = null;
      try {
        server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, gateVerify: true, moneyStrict: false, integrityScan: false });
        const store = server.app.store;
        if (lock) {
          const day = store.get("SELECT MAX(date) AS d FROM cash_entries").d || today;
          const api = await server.login();
          await api.post("/api/companies/select", { id: "sirket-001" });
          const res = await api.put("/api/admin/period-lock", { lockedUntil: day < today ? day : today });
          assert.equal(res.status, 200, JSON.stringify(res.data));
        }
        let state = seed;
        const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
        const pick = list => list[Math.floor(rand() * list.length)];
        const columns = new Map();
        const columnsOf = table => {
          if (!columns.has(table)) columns.set(table, store.all(`PRAGMA table_info(${table})`).map(row => row.name));
          return columns.get(table);
        };
        const touch = () => store.run("UPDATE accounts SET type = type WHERE id = (SELECT id FROM accounts LIMIT 1)");
        const equivalence = [];
        const other = [];
        let reused = 0;
        let accepted = 0;
        let refused = 0;
        for (let round = 0; round < rounds; round += 1) {
          const table = pick(Object.keys(TABLES));
          const row = store.get(`SELECT rowid AS __r, * FROM ${table} ORDER BY rowid DESC LIMIT 1`);
          if (!row) continue;
          const copy = { ...row, id: `fz-${Math.floor(rand() * 1e9)}` };
          let label = `${table} rowid ${row.__r} ${row.id} → ${copy.id}`;
          if (rand() < 0.5) {
            const column = pick(TABLES[table].filter(c => columnsOf(table).includes(c)));
            const value = row[column];
            const next = typeof value === "number" ? pick([value + 0.01, value + 1, 0, -value]) : /date|_on$/.test(column) ? pick([today, "2025-01-01", "2099-10-20", ""]) : pick(["", "zzz", value ?? ""]);
            copy[column] = next;
            label += ` · ${column} ${JSON.stringify(value)} → ${JSON.stringify(next)}`;
          }
          const cols = columnsOf(table).filter(c => c in copy);
          let sameRowid = false;
          try {
            store.raw("test: rowid bozma", () => store.tx(() => {
              store.run(`DELETE FROM ${table} WHERE id = ?`, row.id);
              const res = store.run(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map(c => copy[c] ?? null));
              sameRowid = Number(res.lastInsertRowid) === Number(row.__r);
              touch();
            }));
            accepted += 1;
          } catch (error) {
            if (error?.extra?.code === "gate-equivalence") equivalence.push(`${label} → ${error.extra.failures.map(item => item.code).join(", ")}`);
            else if (error?.status === 409) refused += 1;
            else if (!/constraint|UNIQUE|CHECK|NOT NULL|datatype|FOREIGN/i.test(error?.message || "")) other.push(`${label}: ${error.message}`);
          }
          if (sameRowid) reused += 1;
        }
        t.diagnostic(`rowid yeniden kullanımı ${reused} / ${rounds} · kabul ${accepted} · ret ${refused} · eşdeğerlik ihlali ${equivalence.length}`);
        assert.deepEqual(equivalence, [], `süzgeç "temiz" dedi, tam kapı reddetti:\n${equivalence.join("\n")}`);
        assert.deepEqual(other.slice(0, 5), [], "beklenmeyen hata");
        assert.ok(reused >= rounds / 2, `yazımların çoğu aynı rowid'i yeniden kullandı (ön koşul): ${reused} / ${rounds}`);
        assert.ok(refused > 0 && accepted > 0, `bozmaların bir kısmı reddedilmeli, bir kısmı kabul (kabul ${accepted}, ret ${refused})`);
      } finally {
        await server?.close().catch(() => {});
        fixture.cleanup();
      }
    });
  }
});
