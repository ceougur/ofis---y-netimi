"""Madde 3 — S129 testlerine dişler: bölünmemiş kısma yazılan kart tahsilatı, elle Alacak'la netleşme (tahsilat değil), aylık performans raporu = ekran."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/tyk-kapanis-250.test.mjs", [
    ("""    assert.deepEqual([p.totals.total, p.totals.paid, p.totals.remaining, p.items.map(item => [item.paid, item.remaining]), p.totals.ownRemaining], [1000, 0, 1000, [[0, 300], [0, 300]], 1000]);
    assert.equal((await h.card(acc)).totals.balance, 800);
  });
""", """    assert.deepEqual([p.totals.total, p.totals.paid, p.totals.remaining, p.items.map(item => [item.paid, item.remaining]), p.totals.ownRemaining], [1000, 0, 1000, [[0, 300], [0, 300]], 1000]);
    assert.equal((await h.card(acc)).totals.balance, 800);
    // Karta 700 tahsilat (taksitler 600 + bölünmemiş kısma 100): Tahsil Edilen 700 · Kalan 300 — bölünmemiş kısma yazılan pay kartın kendi hesabından (bugünkü gibi).
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "700", method: "cash", date: day(-3), cashForce: true, similarOk: true }));
    const q = await h.plan(plan.id);
    assert.deepEqual([q.totals.paid, q.totals.remaining, q.totals.ownPaid, q.totals.ownRemaining, q.items.map(item => [item.paid, item.remaining])], [700, 300, 700, 300, [[300, 0], [300, 0]]]);
  });

  it("elle Alacak'la NETLEŞME tahsilat değildir (karar yok — gösterim bugünkü gibi; kâhin d19 N4): Açılış 900 → Mevcut Borç kartı 900 (3 × 300) → Alacak 200 ⇒ Tahsil Edilen 0 · Kalan 900, satırların Ödenen'i 0", async () => {
    const acc = await h.account("S129 Netleşme");
    await h.entry(acc, { kind: "debt", amount: "900", date: day(-45), dueDate: day(-40) });
    const plan = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-38), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-15), everyMonths: "1", coversBalance: true }));
    await h.entry(acc, { kind: "credit", amount: "200", date: day(-36), dueDate: day(15) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.items.map(item => item.paid)], [0, 900, [0, 0, 0]]);
    const card = await h.card(acc);
    assert.deepEqual([card.totals.balance, card.plans[0].totals.paid, card.plans[0].totals.remaining, card.totals.planRemaining], [700, 0, 900, 900]);
  });
"""),
    ("""    // Aylık performans: bu carinin taksit ayları (bu sunucuda başka kartlar da var — yalnız toplamın tutarlılığı: Ödenen + Kalan = Vadesi Gelen).
    const perf = await report("taksit-performans", `from=${day(-60)}&to=${day(120)}`);
    const pHead = perf.headers;
""", """    // Aylık performans = ekran: açık kartların taksitleri (kart penceresinin satırları) ay ay toplanınca raporun Ödenen / Kalan'ını verir.
    const perf = await report("taksit-performans", `from=${day(-60)}&to=${day(120)}`);
    const pHead = perf.headers;
    const months = new Map();
    for (const row of (await h.must("Taksitler", h.api.get("/api/workspace/plans?status=active&limit=500"))).plans) {
      for (const item of (await h.plan(row.id)).items) {
        if (item.dueDate < day(-60) || item.dueDate > day(120)) continue;
        const month = months.get(item.dueDate.slice(0, 7)) || { paid: 0, remaining: 0 };
        months.set(item.dueDate.slice(0, 7), { paid: r2(month.paid + item.paid), remaining: r2(month.remaining + item.remaining) });
      }
    }
    assert.ok(months.size >= 2 && [...months.values()].some(month => month.paid > 0), "ön koşul: birden çok ay, ödeneni olan ay var");
    assert.deepEqual(r2(perf.rows.reduce((sum, cells) => sum + num(cells[pHead.indexOf("Ödenen")]), 0)), r2([...months.values()].reduce((sum, month) => sum + month.paid, 0)), "performans raporu Ödenen toplamı = kart satırlarının Ödenen toplamı");
    assert.deepEqual(r2(perf.rows.reduce((sum, cells) => sum + num(cells[pHead.indexOf("Kalan")]), 0)), r2([...months.values()].reduce((sum, month) => sum + month.remaining, 0)), "performans raporu Kalan toplamı = kart satırlarının Kalan toplamı");
"""),
])
print("tamam")
