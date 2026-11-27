// İkinci parti senaryolar — probe.mjs'in yardımcılarıyla (S nesnesine eklenir; probe.mjs içe aktarılmaz, kopyalanır).
export function more(S, { base, snap, run, must, W }) {
  // PUT ile bağ, iadeden SONRA eklenir (ödemenin kaydı iadeden önce): bağsız 600 → iade 300 → PUT bağ F → ikinci iade 300.
  S.put_reorder = async h => {
    const n = "PUT bağ iadeden sonra";
    const { A, f, k } = await base(h, n);
    const e = await h.free(A, 600);
    h.at("2026-10-21"); await h.giveBack(f, A, 1);
    const s = {};
    s.iade1 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    h.at("2026-10-22"); const r = await h.put(A, e, { kind: "in", amount: "600", method: "cash", invoiceId: f, date: "2026-10-20" });
    s.put = { st: r.status, err: r.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
    h.at("2026-10-23"); const r2 = await h.api.post(`${W}/invoices`, await (async () => { const line = (await must("fatura", h.api.get(`${W}/invoices/${f}`))).lines[0].id; return { kind: "sale_return", accountId: A, originalId: f, issueDate: "2026-10-23", lines: [{ originLineId: line, qty: 1 }], payment: { cash: [] }, force: true }; })());
    s.iade2 = { st: r2.status, err: r2.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
    return s;
  };
  // İkiz: iade 300 → bağlı 600 → ikinci iade 300.
  S.reorder_twin = async h => {
    const n = "iade → bağlı → iade";
    const { A, f, k } = await base(h, n);
    h.at("2026-10-21"); await h.giveBack(f, A, 1);
    h.at("2026-10-22"); await h.linked(A, f, 600);
    const s = {};
    s.bagli = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    h.at("2026-10-23"); await h.giveBack(f, A, 1);
    s.iade2 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    return s;
  };
  // İkiz 2: bağsız 600 → iade 300 → ikinci iade 300 (bağ hiç yok).
  S.free_twin = async h => {
    const n = "bağsız → iade → iade";
    const { A, f, k } = await base(h, n);
    await h.free(A, 600);
    h.at("2026-10-21"); await h.giveBack(f, A, 1);
    const s = {};
    s.iade1 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    h.at("2026-10-23"); await h.giveBack(f, A, 1);
    s.iade2 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    return s;
  };
  // Bağlı 600 → iade 300 → ikinci iade 300.
  S.linked_then_2returns = async h => {
    const n = "bağlı → iade → iade";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    h.at("2026-10-21"); await h.giveBack(f, A, 1);
    const s = {};
    s.iade1 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    h.at("2026-10-23"); await h.giveBack(f, A, 1);
    s.iade2 = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    return s;
  };
  // İkinci kart bağlı ödemeden sonra: F2 600 + K2 600; sonra F2'ye bağlı 300.
  S.k2_after = async h => {
    const n = "K2 bağlıdan sonra";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); const kr = await h.coverRaw(A, 600, "2026-11-10", "2026-10-22");
    const k2 = kr.status === 200 ? kr.data.id : null;
    const s = { k2: kr.status, k2err: String(kr.error || "").slice(0, 120) };
    s.acilis = await snap(h, A, { plans: k2 ? { k, k2 } : { k }, invoices: { f, f2 }, name: n });
    h.at("2026-10-23"); await h.linked(A, f2, 300);
    s.bagli = await snap(h, A, { plans: k2 ? { k, k2 } : { k }, invoices: { f, f2 }, name: n });
    return s;
  };
  // İkiz: bağsız 600 → F2 600 → K2 600.
  S.k2_after_free = async h => {
    const n = "K2 bağsızdan sonra";
    const { A, f, k } = await base(h, n);
    await h.free(A, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); const kr = await h.coverRaw(A, 600, "2026-11-10", "2026-10-22");
    const k2 = kr.status === 200 ? kr.data.id : null;
    const s = { k2: kr.status, k2err: String(kr.error || "").slice(0, 120) };
    s.acilis = await snap(h, A, { plans: k2 ? { k, k2 } : { k }, invoices: { f, f2 }, name: n });
    return s;
  };
  // Bağlı 600 sonrası K2 küçük (300) açılır; sonra F2'ye iade.
  S.k2_small = async h => {
    const n = "K2 300 bağlıdan sonra";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); const kr = await h.coverRaw(A, 300, "2026-11-10", "2026-10-22");
    const k2 = kr.status === 200 ? kr.data.id : null;
    const s = { k2: kr.status, k2err: String(kr.error || "").slice(0, 120) };
    s.acilis = await snap(h, A, { plans: k2 ? { k, k2 } : { k }, invoices: { f, f2 }, name: n });
    return s;
  };
  S.k2_small_free = async h => {
    const n = "K2 300 bağsızdan sonra";
    const { A, f, k } = await base(h, n);
    await h.free(A, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); const kr = await h.coverRaw(A, 300, "2026-11-10", "2026-10-22");
    const k2 = kr.status === 200 ? kr.data.id : null;
    const s = { k2: kr.status, k2err: String(kr.error || "").slice(0, 120) };
    s.acilis = await snap(h, A, { plans: k2 ? { k, k2 } : { k }, invoices: { f, f2 }, name: n });
    return s;
  };
  // Bağlı 600 → F2 600 → F2 iade 1 (300); ikiz bağsız.
  S.f2_return = async h => {
    const n = "bağlı → F2 → F2 iade";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); await h.giveBack(f2, A, 1);
    return await snap(h, A, { plans: { k }, invoices: { f, f2 }, name: n });
  };
  S.f2_return_free = async h => {
    const n = "bağsız → F2 → F2 iade";
    const { A, f, k } = await base(h, n);
    await h.free(A, 600);
    h.at("2026-10-21"); const f2 = await h.goods(A, "2026-10-21", 2);
    h.at("2026-10-22"); await h.giveBack(f2, A, 1);
    return await snap(h, A, { plans: { k }, invoices: { f, f2 }, name: n });
  };
  // B9 + karttan sonra başka satır (ön geçiş doğar): F 900 → bağlı 600 → kart 300 → (20.10) Borç Yaz 100 + bağsız 50.
  S.b9_plus = h => run(h, "B9 + sonraki satır", async n => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3); h.at("2026-09-02"); await h.linked(A, f, 600); h.at("2026-09-03"); const k = await h.cover(A, 300, "2026-10-05", "2026-09-03"); h.at("2026-10-20"); await h.debt(A, 100, "2026-10-20"); await h.free(A, 50); return { A, f, k }; });
  // B9 + karttan sonra aynı faturaya ikinci bağlı 100 (gösterilen açık 0 → tamamı kuyruğa).
  S.b9_link2 = h => run(h, "B9 + ikinci bağlı 100", async n => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3); h.at("2026-09-02"); await h.linked(A, f, 600); h.at("2026-09-03"); const k = await h.cover(A, 300, "2026-10-05", "2026-09-03"); h.at("2026-10-20"); await h.linked(A, f, 100); return { A, f, k }; });
  S.b9_free2 = h => run(h, "B9 + bağsız 100", async n => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3); h.at("2026-09-02"); await h.linked(A, f, 600); h.at("2026-09-03"); const k = await h.cover(A, 300, "2026-10-05", "2026-09-03"); h.at("2026-10-20"); await h.free(A, 100); return { A, f, k }; });
  // Kilit değişmezliği: bağlı 600 → (05.11) kilit 31.10 öncesi / sonrası aynı mı.
  S.lock_invariant = async h => {
    const n = "kilit değişmezliği";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    h.at("2026-11-05");
    const s = { once: await snap(h, A, { plans: { k }, invoices: { f }, name: n }) };
    await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-31" }));
    s.sonra = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
    s.esit = JSON.stringify(s.once) === JSON.stringify(s.sonra);
    return s;
  };
  // Kartın ilk taksiti kilitli dönemde (15.09); bağsız 300 (20.09) F'nin gösterilen 300'ünü kapatır; kilit 30.09; bağlı 600 (20.10). İkiz kilitsiz.
  const early = async (h, n, lock) => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3); h.at("2026-09-02"); const k = await h.cover(A, 600, "2026-09-15", "2026-09-02"); h.at("2026-09-20"); await h.free(A, 300, "2026-09-20"); h.at("2026-10-20"); if (lock) await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })); await h.linked(A, f, 600); return { A, f, k }; };
  S.lock_card_early = h => run(h, "kilitli taksit + bağlı", n => early(h, n, true));
  S.nolock_card_early = h => run(h, "kilitsiz taksit + bağlı", n => early(h, n, false));
  // Kilit bağlı ödemeden SONRA, hedef taksit kilitli dönemde; sonra bağlı ödeme silinir (kilit sonrası günde yazılmış ödeme).
  S.lock_then_delete = async h => {
    const n = "bağlı → kilit → sil";
    const { A, f, k } = await base(h, n);
    const e = await h.linked(A, f, 600);
    h.at("2026-11-05");
    await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" }));
    const r = await h.del(A, e);
    return { st: r.status, err: String(r.error || "").slice(0, 160), ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
  };
  // bağsız 300 (20.10) → iade 300 (21.10) → PUT bağ F (22.10): bağın kaydı iadeden ÖNCE, bağın kendisi SONRA.
  S.put300_reorder = async h => {
    const n = "bağsız 300 → iade → PUT bağ";
    const { A, f, k } = await base(h, n);
    const e = await h.free(A, 300);
    h.at("2026-10-21"); await h.giveBack(f, A, 1);
    const s = { iade: await snap(h, A, { plans: { k }, invoices: { f }, name: n }) };
    h.at("2026-10-22"); const r = await h.put(A, e, { kind: "in", amount: "300", method: "cash", invoiceId: f, date: "2026-10-20" });
    s.put = { st: r.status, err: r.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
    return s;
  };
  // İkiz: iade 300 (21.10) → bağlı 300 YENİ kayıt (22.10).
  S.ret_then_link300 = h => run(h, "iade → bağlı 300", async n => { const { A, f, k } = await base(h, n); h.at("2026-10-21"); await h.giveBack(f, A, 1); h.at("2026-10-22"); await h.linked(A, f, 300, "2026-10-20"); return { A, f, k }; });
  // İkiz 2: bağlı 300 (20.10) → iade 300 (21.10) (bağ baştan).
  S.link300_then_ret = h => run(h, "bağlı 300 → iade", async n => { const { A, f, k } = await base(h, n); await h.linked(A, f, 300); h.at("2026-10-21"); await h.giveBack(f, A, 1); return { A, f, k }; });
  // Yetki: personel / muhasebe — bağlı tahsilat denemesi (durum + veri tabanı satır sayısı) ve kart görünümü (yönetici ile aynı mı).
  S.roles = async h => {
    const n = "yetki";
    const { A, f, k } = await base(h, n);
    await h.linked(A, f, 600);
    const out = {};
    const { createUser } = await import(new URL("test/helpers.mjs", `file://${process.env.ROOT}/`).href);
    const adminView = await h.views(A, k);
    for (const role of ["personel", "muhasebe"]) {
      const c = await createUser(h.ctx.server, h.ctx.api.client, { username: `dk-${role}`, role });
      const before = h.store.get("SELECT COUNT(*) AS n FROM account_entries").n;
      const r = await c.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "100", date: "2026-10-20", method: "cash", invoiceId: f });
      const after = h.store.get("SELECT COUNT(*) AS n FROM account_entries").n;
      const v = await c.get(`${W}/plans/${k}`);
      const d = v.data?.data || v.data;
      out[role] = { post: r.status, rows: after - before, view: v.status, w: d?.totals ? [d.total, d.totals.paid, d.totals.remaining] : null };
    }
    out.admin = adminView.w;
    return out;
  };
  // Kart faturadan ÖNCE (elle borç 600 → kart 600 → F 900 → F'ye bağlı 900).
  S.card_before_inv = h => run(h, "kart faturadan önce", async n => { const A = await h.acc(n); await h.debt(A, 600, "2026-09-01"); h.at("2026-09-02"); const k = await h.cover(A, 600, "2026-10-05", "2026-09-02"); h.at("2026-09-10"); const f = await h.goods(A, "2026-09-10", 3); h.at("2026-10-20"); await h.linked(A, f, 900); return { A, f, k }; });
  // Kartın almadığı fatura (karttan sonra F2): F2'ye bağlı 700.
  S.noncovered = h => run(h, "kartsız fatura bağlı", async n => { const { A, f, k } = await base(h, n); h.at("2026-10-01"); const f2 = await h.goods(A, "2026-10-01", 2); h.at("2026-10-20"); await h.linked(A, f2, 700); return { A, f, k, f2 }; });
  // Kartsız cari: F 900, bağlı 1200.
  S.nocard = h => run(h, "kartsız cari", async n => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3); h.at("2026-10-20"); await h.linked(A, f, 1200); return { A, f }; });
  // Elle borç kartsız: Vade Takip'te görünür mü.
  S.vade_elle = h => run(h, "vade elle", async n => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 1); await h.debt(A, 500, "2026-09-01", "2026-11-15"); return { A, f }; });
  // Tedarikçi: alış 900, Mevcut Borç kartı dene, bağlı ödeme 600.
  S.supplier2 = async h => {
    const n = "tedarikçi2";
    const A = await h.acc(n, "supplier");
    const f = await h.buy(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const kr = await h.coverRaw(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const lr = await h.linkedRaw(A, f, 600, "2026-10-20", "out");
    const k = kr.status === 200 ? kr.data?.id : null;
    return { kr: kr.status, kerr: String(kr.error || "").slice(0, 120), lr: lr.status, lerr: String(lr.error || "").slice(0, 120), ...(await snap(h, A, { plans: k ? { k } : {}, invoices: { f }, name: n })) };
  };
  // Faturanın tamamı kartta + bağlı 300 + Kartı Kapat.
  S.full_partial_close = h => run(h, "F600 tam kartta: bağlı 300 → Kartı Kapat", async n => { const { A, f, k } = await base(h, n, { qty: 2 }); await h.linked(A, f, 300); h.at("2026-10-21"); await h.api.put(`${W}/plans/${k}`, { status: "closed" }); return { A, f, k }; });
  S.full_partial_close_free = h => run(h, "F600 tam kartta: bağsız 300 → Kartı Kapat", async n => { const { A, f, k } = await base(h, n, { qty: 2 }); await h.free(A, 300); h.at("2026-10-21"); await h.api.put(`${W}/plans/${k}`, { status: "closed" }); return { A, f, k }; });
}
