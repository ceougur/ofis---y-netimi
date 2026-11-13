"""Madde 6 — diş testi düzeltmeleri: K22 belge tarihi sırası; K28 sağlayıcı carili POS (ödeme kuruluşu)."""
p = "test/tyk-kapanis-dis-250.test.mjs"
s = open(p, encoding="utf-8").read()
pairs = [
    ("""    const a = await account("K22");
    const f = await sale(a, day(-50), 600);
    await entry(a, { kind: "debt", amount: "900", date: day(-49), dueDate: day(30), note: "X" });""",
     """    const a = await account("K22");
    const f = await sale(a, day(-44), 600); // belge tarihi serinin son belgesinden (K8: −45) sonra
    await entry(a, { kind: "debt", amount: "900", date: day(-43), dueDate: day(30), note: "X" });"""),
    ("""  it("POS satışı 10.000 → valörden ÖNCE tam iade → 12.10'da banka komisyonu (250) hesaptan tahsil eder: banka carisine verilen 250 karşılığı gelene kadar 'Tahsil Edilecek' kalemidir", async () => {""",
     """  it("ödeme kuruluşu POS'u (komisyon %2,5 + KDV): satış 10.000 → valörden ÖNCE tam iade → 12.10'da komisyon (250 + KDV 50) bankadan tahsil edilir: sağlayıcı carisine verilen 300, komisyon faturası gelene kadar 'Tahsil Edilecek' kalemidir", async () => {"""),
    ("""      await openPos(w.api, ziraatPos(acc.ziraat.id));""",
     """      const provider = await posMust("sağlayıcı", w.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      await openPos(w.api, ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));"""),
    ("""      assert.deepEqual([fee?.kind, fee?.amount, fee?.date], ["out", 250, "2026-10-12"], "ön koşul: POS Komisyon Tahsili banka carisine 250 (bankadan) yazıldı");
      const provider = await posMust("banka carisi", w.api.get(`/api/workspace/accounts/${fee.accountId}`));""",
     """      assert.deepEqual([fee?.accountId, fee?.kind, fee?.amount, fee?.date], [provider.id, "out", 300, "2026-10-12"], "ön koşul: POS Komisyon Tahsili sağlayıcı carisine 300 (bankadan) yazıldı");
      const providerCard = await posMust("sağlayıcı carisi", w.api.get(`/api/workspace/accounts/${provider.id}`));"""),
    ("""[["account", 250, "2026-10-12", "in"]], "takvimde / zilde ayrı kalem: 250, ödeme gününde vadeli");""", """[["account", 300, "2026-10-12", "in"]], "takvimde / zilde ayrı kalem: 300, ödeme gününde vadeli");"""),
    ("""      assert.deepEqual(vade.rows.filter(row => row.accountId === fee.accountId || row.party === provider.name).map(row => [row.amount, row.date, row.direction]), [[250, "2026-10-12", "in"]], "Vade Takip'te aynı kalem");
      assert.equal(provider.totals.balance, 250, "banka carisi 250 borçlu (verilen avans)");""",
     """      assert.deepEqual(vade.rows.filter(row => row.accountId === provider.id || row.party === provider.name).map(row => [row.amount, row.date, row.direction]), [[300, "2026-10-12", "in"]], "Vade Takip'te aynı kalem");
      assert.equal(providerCard.totals.balance, 300, "sağlayıcı carisi 300 borçlu (verilen avans)");"""),
]
for a, b in pairs:
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)
open(p, "w", encoding="utf-8").write(s)
print("tamam")
