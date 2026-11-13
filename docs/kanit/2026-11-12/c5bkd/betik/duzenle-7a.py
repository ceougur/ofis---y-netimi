"""S129 = A'nın komşu taramasında çıkan test düzeltmeleri: kartın KENDİ hesabını sınayan testler own* alanlarını okur (alan adları ayrıldı — S129); ekranı sınayan
rapor testi kararın sayısına güncellenir. Liste satırına eski anlamlı alan (planOwnRemaining; overdueInstallments ile aynı düzen)."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


# Ürün: Cari Listesi satırına kartların KENDİ hesabıyla kalan toplamı (eski anlam; onarım eşdeğerliği okur — overdueInstallments düzeni).
edit("server/routes/accounts.mjs", [
    ("""      let planRemaining = 0;
      let next = null;""", """      let planRemaining = 0;
      let planOwnRemaining = 0;
      let next = null;"""),
    ("""          planRemaining += view ? Math.max(0, view.remaining) : Math.max(0, total - paid);
""", """          planRemaining += view ? Math.max(0, view.remaining) : Math.max(0, total - paid);
          planOwnRemaining += Math.max(0, total - paid);
"""),
    ("""        planRemaining: roundMoney(planRemaining),
        overdue: roundMoney(overdue),""", """        planRemaining: roundMoney(planRemaining),
        // Kartların KENDİ hesabıyla kalan toplamı (S129 öncesinin "Taksitten Kalan"ı) — onarım / göç karşılaştırmaları için (overdueInstallments ile aynı düzen).
        planOwnRemaining: roundMoney(planOwnRemaining),
        overdue: roundMoney(overdue),"""),
])

edit("test/guvenilirlik/onarim-dokum.mjs", [
    ("""  put("cariler", rows.map(row => ({ id: row.id, debit: row.debit, credit: row.credit, balance: row.balance, planRemaining: row.planRemaining, overdue: row.overdueInstallments ?? row.overdue })));""",
     """  // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A): listenin `planRemaining`'i ve kartın `paid` / `remaining`'i GÖSTERİLEN sayı oldu (tek kuyruk; bilerek); onarım eşdeğerliği kartın
  // KENDİ hesabını okur (planOwnRemaining, ownPaid, ownRemaining; eski kodda planRemaining, paid, remaining).
  put("cariler", rows.map(row => ({ id: row.id, debit: row.debit, credit: row.credit, balance: row.balance, planRemaining: row.planOwnRemaining ?? row.planRemaining, overdue: row.overdueInstallments ?? row.overdue })));"""),
    ("""    cards.push({ planId: row.planId, total: t.total, paid: t.paid, remaining: t.remaining, overdue: t.ownOverdue ?? t.overdue ?? 0 });""",
     """    cards.push({ planId: row.planId, total: t.total, paid: t.ownPaid ?? t.paid, remaining: t.ownRemaining ?? t.remaining, overdue: t.ownOverdue ?? t.overdue ?? 0 });"""),
])

edit("test/banka-230-k8-taksit.test.mjs", [
    ("""    c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [700, 0, 100]);
    rejected(await collect(api, plan.id, "100,01"), 409, "plan-overpay", "kalan 100 iken 100,01");""",
     """    c = await card(api, plan.id);
    // S129 = A (12.11.2026): totals.paid / remaining GÖSTERİLEN sayıdır (tek kuyruk — bu caride önceki adımların bıraktığı bağsız para taksiti kapatabilir); K8 kuralı kartın KENDİ
    // hesabını okur (ownPaid / ownRemaining) — sınır da ondan.
    assert.deepEqual([c.totals.ownPaid, c.totals.extra, c.totals.ownRemaining], [700, 0, 100]);
    rejected(await collect(api, plan.id, "100,01"), 409, "plan-overpay", "kalan 100 iken 100,01");"""),
    ("""    assert.equal((await card(api, plan.id)).totals.remaining, 100);
    await must("A 500 geri", put({ amount: "500" }));""", """    assert.equal((await card(api, plan.id)).totals.ownRemaining, 100, "kartın kendi kalanı (S129: totals.remaining gösterilen sayıdır)");
    await must("A 500 geri", put({ amount: "500" }));"""),
    ("""    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [1100, 100, 0]);
    const r = await must("iade 100", refund(api, plan.id, "100"));""", """    assert.deepEqual([c.totals.ownPaid, c.totals.extra, c.totals.ownRemaining], [1100, 100, 0]);
    const r = await must("iade 100", refund(api, plan.id, "100"));"""),
    ("""    assert.deepEqual([(await card(api, plan.id)).totals.paid, (await card(api, plan.id)).totals.remaining], [900, 100]);""",
     """    assert.deepEqual([(await card(api, plan.id)).totals.ownPaid, (await card(api, plan.id)).totals.ownRemaining], [900, 100]);"""),
])

edit("test/bulgu-223.test.mjs", [
    ("""cardLeft: card?.totals?.remaining, cardPaid: card?.totals?.paid, balance: account.balance };""",
     """cardLeft: card?.totals?.ownRemaining ?? card?.totals?.remaining, cardPaid: card?.totals?.ownPaid ?? card?.totals?.paid, balance: account.balance }; // kartın KENDİ hesabı (S129 = A: totals.paid / remaining gösterilen sayıdır)"""),
    ("""    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.remaining], [2000, 3000]);""",
     """    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.ownRemaining], [2000, 3000]);"""),
])

edit("test/iade-210-onarim.test.mjs", [
    ("""      out[key] = [t.total, t.paid, t.remaining];""", """      out[key] = [t.total, t.ownPaid ?? t.paid, t.ownRemaining ?? t.remaining]; // kartın KENDİ hesabı (onarım bunu yazar; S129 = A: paid / remaining gösterilen sayıdır)"""),
])

edit("test/tablodan-aktar-244.test.mjs", [
    ("""    assert.deepEqual([detail.totals.total, detail.totals.paid, detail.totals.remaining], [9000, 3500, 5500]);
    const items = detail.items.map(item => [item.seq, item.paid]);""",
     """    // Aktarımın karta YAZDIĞI (kartın kendi hesabı). S129 = A: totals.paid / remaining ve items[].paid gösterilen sayıdır — carinin hesabında kalan 7.000 taksit dışı
    // tahsilat da taksitleri kapatır (tek kuyruk); o gösterim test/tyk-kapanis-250.test.mjs'te.
    assert.deepEqual([detail.totals.total, detail.totals.ownPaid, detail.totals.ownRemaining], [9000, 3500, 5500]);
    const items = detail.items.map(item => [item.seq, item.ownPaid]);"""),
])

edit("test/ux18-cek-fatura-244.test.mjs", [
    ("""    const remaining = async () => (await must("kart", api.get(`/api/workspace/plans/${planned.planId}`))).totals.remaining;""",
     """    const remaining = async () => (await must("kart", api.get(`/api/workspace/plans/${planned.planId}`))).totals.ownRemaining; // kartın KENDİ kalanı (S129 = A: totals.remaining gösterilen sayıdır)"""),
])

edit("test/raporlar-209.test.mjs", [
    ("""    assert.match(perf.summary.find(([label]) => label === "Geciken")[1], /1\\.000,00/);""",
     """    // S129 = A (12.11.2026): raporun Ödenen / Kalan / Geciken'i kart ekranıyla AYNI sayı (tek kuyruk). Ali Veli'nin vadesi geçen 1. taksiti 1.000; alınan senet 700 (S-1)
    // carinin bağsız parasıdır ve vade sırasıyla o taksiti kapatır (S50 / S99) → Geciken 300. (Önceki beklenti 1.000 kartın kendi hesabıydı.)
    assert.match(perf.summary.find(([label]) => label === "Geciken")[1], /^300,00/);"""),
])
print("tamam")
