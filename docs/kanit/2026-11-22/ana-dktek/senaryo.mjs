// Dar kontrol (TEK): kart kapsamı / küçülme-büyüme / gösterilen açık senaryoları. ROOT=<kod> SC=<adlar,virgüllü> node senaryo.mjs
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const W = "/api/workspace";
const r2 = v => Math.round(Number(v) * 100) / 100;
async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  const api = ctx.api;
  let minute = 0;
  let day = start;
  const at = d => { day = d; minute = 0; ctx.server.clock.set(`${d}T12:00:00+03:00`); };
  const tick = () => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, ctx, at,
    acc: async (name = "Dk Müşteri") => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount, extra = {}) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle", ...extra }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${day} ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
    pay: (planId, amount) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash" }))),
    payInvoice: (A, invoiceId, amount) => (tick(), api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash", invoiceId, note: "fatura tahsilatı" })),
    close: async id => {
      tick();
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining });
      if (r.status !== 200) throw new Error(`Kartı Kapat ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    },
    giveBack: async (invoiceId, accountId, qty) => {
      tick();
      const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
      return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
    },
    cancel: async (id, extra = {}) => { tick(); const r = await api.post(`${W}/invoices/${id}/cancel`, { reason: "x", ...extra }); return `${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`; },
    edit: async (id, qty, payment = { rest: "account" }) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      const r = await api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true });
      return `${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`;
    },
    snap: async (label, A, plans, invoices) => {
      const acc = await must("cari", api.get(`${W}/accounts/${A}`));
      const t = acc.totals || {};
      const out = [`  [${day}] ${label}: bakiye ${t.balance} gecikmiş ${t.overdueDebt ?? "?"} (taksit ${t.overdueInstallments ?? t.overdue})`];
      const list = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans;
      for (const [name, id] of Object.entries(plans)) {
        if (!id) continue;
        const v = await api.get(`${W}/plans/${id}`);
        const w = v.status === 200 ? `${v.data.status} ${v.data.total} T${v.data.totals.paid}/K${v.data.totals.remaining}/G${v.data.totals.overdue ?? "?"}` : `GET ${v.status}`;
        const s = (acc.plans || []).find(x => x.id === id);
        const l = list.find(x => x.id === id);
        const total = Number(ctx.store.get("SELECT total FROM plans WHERE id = ?", id)?.total);
        const paid = Number(ctx.store.get("SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM plan_entries WHERE plan_id = ?", id).n);
        const rows = ctx.store.all("SELECT due_date AS d, amount AS a FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", id).map(x => `${x.d.slice(5)}:${x.a}`).join(" ");
        out.push(`    kart ${name}: pencere[${w}] cari[${s ? `T${s.totals.paid}/K${s.totals.remaining}` : "-"}] liste[${l ? `T${l.totals.paid}/K${l.totals.remaining}` : "-"}] kendi[${total}/${paid}/${r2(total - paid)}] taksit[${rows}]`);
      }
      const inv = (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices;
      for (const [name, id] of Object.entries(invoices)) {
        if (!id) continue;
        const l = inv.find(x => x.id === id);
        const d = await must("fatura", api.get(`${W}/invoices/${id}`));
        const row = ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
        let cov = "";
        try { cov = JSON.stringify(ctx.app.context.invoices.cardLedgerState(row).coveredBy || {}).replace(/"[^"]*"(?=:)/g, k => (Object.entries(plans).find(([, v]) => `"${v}"` === k)?.[0] || "?")); } catch (e) { cov = `hata ${e.message}`; }
        out.push(`    fatura ${name}: ${d.status} ${d.tryPayable} liste[${l?.payState}/${l?.open}] kart[${d.payState}/açık ${d.open}/kendi ${d.ownOpen ?? "-"}/inPlan ${d.inPlan ?? "-"}] kapsam${cov}`);
      }
      const ok = (await must("Mutabakat", api.get(`${W}/ledger/integrity`))).ok;
      out.push(`    Mutabakat ${ok ? "ok" : "BOZUK"}`);
      console.log(out.join("\n"));
    },
  };
  try { return await fn(h); } finally { ctx.server.close(); }
}
const SC = (process.env.SC || "").split(",").filter(Boolean);
const want = n => !SC.length || SC.includes(n);

// SC1 (İlk madde 3, S243): A 600 (01.09), B 600 (02.09), elle kart 600 (03.09) — ardından B iadesi, A iadesi, B iptali, A iptali
if (want("SC1")) for (const branch of ["iadeB-iptalB", "iadeA", "iptalA"]) {
  console.log(`SC1 ${branch}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const fa = await h.goods(A, "2026-09-01", 2);
    h.at("2026-09-02");
    const fb = await h.goods(A, "2026-09-02", 2);
    h.at("2026-09-03");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-03");
    h.at("2026-10-20");
    await h.snap("kart açıldı", A, { K }, { A: fa, B: fb });
    if (branch === "iadeB-iptalB") {
      await h.giveBack(fb, A, 1);
      await h.snap("B iade 1 (300)", A, { K }, { A: fa, B: fb });
      console.log(`  B iptal: ${await h.cancel(fb)}`);
      await h.snap("B iptal", A, { K }, { A: fa, B: fb });
    } else if (branch === "iadeA") {
      await h.giveBack(fa, A, 1);
      await h.snap("A iade 1 (300)", A, { K }, { A: fa, B: fb });
      console.log(`  A Düzenle 2→… (iade sonrası): -`);
    } else {
      console.log(`  A iptal: ${await h.cancel(fa)}`);
      await h.snap("A iptal", A, { K }, { A: fa, B: fb });
    }
  });
}
// SC2 (vade sırası): A 01.09 vadesi 30.09, B 02.09 vadesi 05.09; elle kart 600 (03.09). Hangi fatura kartta (kuyruk ↔ kapama defteri)? A iptali / B iptali.
if (want("SC2")) for (const branch of ["iptalA", "iptalB", "iadeB"]) {
  console.log(`SC2 ${branch}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const fa = await h.goods(A, "2026-09-01", 2, { rest: "account", dueDate: "2026-09-30" });
    h.at("2026-09-02");
    const fb = await h.goods(A, "2026-09-02", 2, { rest: "account", dueDate: "2026-09-05" });
    h.at("2026-09-03");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-03");
    h.at("2026-10-20");
    await h.snap("kart açıldı", A, { K }, { A: fa, B: fb });
    if (branch === "iptalA") console.log(`  A iptal: ${await h.cancel(fa)}`);
    else if (branch === "iptalB") console.log(`  B iptal: ${await h.cancel(fb)}`);
    else await h.giveBack(fb, A, 1);
    await h.snap(branch, A, { K }, { A: fa, B: fb });
  });
}
// SC2e (elle borç vadesi): elle X 600 (01.09, vade 30.09) + elle Y 600 (02.09, vade 05.09), fatura F 600 (01.09); kart 900 (03.09) — S120: elle borçlar eskiden yeniye
if (want("SC2e")) {
  console.log("SC2e");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 2);
    const x = await h.debt(A, "2026-09-01", 600, { dueDate: "2026-09-30" });
    h.at("2026-09-02");
    const y = await h.debt(A, "2026-09-02", 600, { dueDate: "2026-09-05" });
    h.at("2026-09-03");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-03");
    h.at("2026-10-20");
    const due = h.ctx.store.all("SELECT id, due_date AS d FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source = ''", A).map(r => r.d).join(",");
    console.log(`  elle vadeler: ${due}`);
    await h.snap("kart açıldı", A, { K }, { F: f });
    const acc = await must("cari", h.api.get(`${W}/accounts/${A}`));
    const items = (acc.ledger || []).filter(l => l.origin === "account").map(l => `${l.id === x ? "X" : l.id === y ? "Y" : "?"}:${l.remaining ?? l.left ?? "-"}`).join(" ");
    console.log(`  elle kalan (cari ekstresi): ${items}`);
    console.log(`  F iptal: ${await h.cancel(f)}`);
    await h.snap("F iptal", A, { K }, { F: f });
  });
}
// SC3 (İlk madde 4): F 900 → elle kart 900 → tahsilat 300 → Kartı Kapat (Borçta Kalsın) → iade 300 → iade iptali → yedek / geri yükleme
if (want("SC3")) {
  console.log("SC3");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    await h.pay(K, 300);
    await h.snap("tahsilat 300", A, { K }, { F: f });
    h.at("2026-10-12");
    await h.close(K);
    await h.snap("Kartı Kapat", A, { K }, { F: f });
    h.at("2026-10-15");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300 (kapalı kart)", A, { K }, { F: f, R: r });
    h.at("2026-11-20");
    console.log(`  iade iptal: ${await h.cancel(r)}`);
    await h.snap("iade iptali", A, { K }, { F: f, R: r });
    const b = await h.api.post("/api/admin/backups", {});
    console.log(`  yedek: ${b.status} ${JSON.stringify(b.data).slice(0, 120)}`);
  });
}
// SC3a: aynı, kart AÇIK (kapatmadan) — iade → iade iptali (S238 aynı taksite)
if (want("SC3a")) {
  console.log("SC3a");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    await h.pay(K, 300);
    h.at("2026-11-10");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300 (açık kart)", A, { K }, { F: f, R: r });
    h.at("2026-11-20");
    console.log(`  iade iptal: ${await h.cancel(r)}`);
    await h.snap("iade iptali", A, { K }, { F: f, R: r });
  });
}
// SC4 (faturasız stok iadesi): elle borç 900, kart 900; stok iadesi 1 × 300 → düzelt 2 → sil → geri yükle
if (want("SC4")) {
  console.log("SC4");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const mal = (await must("mal", h.api.post(`${W}/stock`, { kind: "goods", code: "DK-MAL", name: "Dk Malı", unit: "Adet", openingQty: "100", salePrice: "300" }))).id;
    await h.debt(A, "2026-09-01", 900);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    await h.pay(K, 300);
    h.at("2026-11-10");
    await must("stok iadesi", h.api.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: A, date: "2026-11-10" }));
    const id = h.ctx.store.get("SELECT id FROM stock_moves WHERE item_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", mal).id;
    await h.snap("stok iadesi 300", A, { K }, {});
    const e = await h.api.put(`${W}/stock/${mal}/moves/${id}`, { qty: "2", unitPrice: "300" });
    console.log(`  düzelt: ${e.status}`);
    await h.snap("düzelt 2 (600)", A, { K }, {});
    const e3 = await h.api.put(`${W}/stock/${mal}/moves/${id}`, { qty: "3", unitPrice: "300" });
    console.log(`  düzelt 3 (900 > açık kalan 600): ${e3.status}`);
    await h.snap("düzelt 3", A, { K }, {});
    const d = await h.api.del(`${W}/stock/${mal}/moves/${id}`);
    console.log(`  sil: ${d.status}`);
    await h.snap("sil", A, { K }, {});
    const row = (await must("Silinenler", h.api.get("/api/admin/trash"))).find(x => x.kind === "stock-move" && x.ref === id);
    const g = await h.api.post("/api/admin/trash/restore", { id: row.id });
    console.log(`  geri yükle: ${g.status}`);
    await h.snap("geri yükle", A, { K }, {});
  });
}
// SC5 (İlk madde 2): F 900, elle kart 600 (F'nin 600'ünü alır); faturadan tahsilat 900 (form 300 önerir; sınır?) — kapama
if (want("SC5")) for (const amount of [300, 900, 1200]) {
  console.log(`SC5 tahsilat ${amount}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    await h.snap("kart açıldı", A, { K }, { F: f });
    const off = await must("mahsup adayları", h.api.get(`${W}/invoices/${f}/offsets`));
    console.log(`  Mahsup Et: sınır open ${off.open} öneri suggest ${off.suggest ?? "-"}`);
    const r = await h.payInvoice(A, f, amount);
    console.log(`  faturadan tahsilat ${amount}: ${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`);
    await h.snap(`tahsilat ${amount}`, A, { K }, { F: f });
  });
}
// SC6 (Düzenle azaltma S241 + artırma S242): F 900 → elle kart 900 → tahsilat 600 → Düzenle 900→300 → Düzenle 300→900 → iade
if (want("SC6")) {
  console.log("SC6");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    await h.pay(K, 600);
    await h.snap("tahsilat 600", A, { K }, { F: f });
    console.log(`  Düzenle 3→1: ${await h.edit(f, 1)}`);
    await h.snap("Düzenle 900→300", A, { K }, { F: f });
    console.log(`  Düzenle 1→3: ${await h.edit(f, 3)}`);
    await h.snap("Düzenle 300→900", A, { K }, { F: f });
    console.log(`  Düzenle 3→2: ${await h.edit(f, 2)}`);
    await h.snap("Düzenle 900→600", A, { K }, { F: f });
  });
}
// SC8: aynı caride iki Mevcut Borç kartı; faturasız stok iadesi / fatura iadesi hangi kartı küçültür
if (want("SC8")) for (const kind of ["stok", "faturaF1"]) {
  console.log(`SC8 ${kind}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const mal = (await must("mal", h.api.post(`${W}/stock`, { kind: "goods", code: "DK-MAL", name: "Dk Malı", unit: "Adet", openingQty: "100", salePrice: "300" }))).id;
    const f1 = await h.goods(A, "2026-09-01", 2);
    h.at("2026-09-02");
    const K1 = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-09-03");
    const f2 = await h.goods(A, "2026-09-03", 2);
    h.at("2026-09-04");
    const K2 = await h.cover(A, 600, "2026-11-05", "2026-09-04");
    h.at("2026-10-20");
    await h.snap("iki kart", A, { K1, K2 }, { F1: f1, F2: f2 });
    if (kind === "stok") await must("stok iadesi", h.api.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: A, date: "2026-10-20" }));
    else await h.giveBack(f1, A, 1);
    await h.snap(`${kind} iadesi 300`, A, { K1, K2 }, { F1: f1, F2: f2 });
  });
}
// SC9: kapalı (Borçta Kalsın) kartta Düzenle azaltma (S234-c / S241) + kart silinip Silinenler'den geri yükleme
if (want("SC9")) {
  console.log("SC9");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    await h.pay(K, 300);
    h.at("2026-10-12");
    await h.close(K);
    h.at("2026-10-15");
    console.log(`  Düzenle 3→2 (kapalı kart): ${await h.edit(f, 2)}`);
    await h.snap("Düzenle 900→600 kapalı kart", A, { K }, { F: f });
    console.log(`  Düzenle 2→… 0 değil 1 (900→300; kalan 600'ü aşar): ${await h.edit(f, 1)}`);
    await h.snap("Düzenle 600→300 kapalı kart", A, { K }, { F: f });
  });
  console.log("SC9b");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-10-10");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300", A, { K }, { F: f, R: r });
    const del = await h.api.del(`${W}/plans/${K}`);
    console.log(`  kart sil: ${del.status} ${del.status !== 200 ? JSON.stringify(del.data).slice(0, 160) : ""}`);
    await h.snap("kart silindi", A, {}, { F: f, R: r });
    const trash = await must("Silinenler", h.api.get("/api/admin/trash"));
    const row = trash.find(x => x.ref === K) || trash.find(x => /plan/.test(x.kind || ""));
    if (!row) console.log(`  Silinenler: ${JSON.stringify(trash.map(x => [x.kind, x.ref, x.title])).slice(0, 300)}`);
    const g = row ? await h.api.post("/api/admin/trash/restore", { id: row.id }) : { status: "yok", data: null };
    console.log(`  kart geri yükle: ${g.status} ${g.status !== 200 ? String(JSON.stringify(g.data)).slice(0, 160) : ""}`);
    await h.snap("kart geri yüklendi", A, { K }, { F: f, R: r });
    h.at("2026-10-20");
    console.log(`  iade iptal: ${await h.cancel(r)}`);
    await h.snap("iade iptali (geri yüklenmiş kart)", A, { K }, { F: f, R: r });
  });
}
// SC7: SC5'in komşusu — bağsız (Otomatik) 900 ve bağlı 600
if (want("SC7")) for (const [amount, linked] of [[900, false], [600, true], [900, true]]) {
  console.log(`SC7 tahsilat ${amount} ${linked ? "F'ye bağlı" : "bağsız"}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const r = linked ? await h.payInvoice(A, f, amount) : await h.api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: String(amount), date: "2026-10-20", method: "cash", note: "bağsız" });
    console.log(`  tahsilat: ${r.status}`);
    await h.snap(`tahsilat ${amount}`, A, { K }, { F: f });
    const rem = await must("cari", h.api.get(`${W}/accounts/${A}`));
    console.log(`  cari planRemaining ${rem.totals.planRemaining ?? "-"} · gecikmiş adet ${rem.totals.overdueDebtCount ?? "-"}`);
  });
}
