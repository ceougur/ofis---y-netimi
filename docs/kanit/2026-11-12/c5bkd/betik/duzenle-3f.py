"""Madde 3 — S129 = A ile beklentisi değişen testler (kartın kendi kalanını totals.remaining'den okuyanlar): kendi hesabı ownRemaining'den, gösterilen sayı kuyruktan."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/tyk-api-250.test.mjs", [
    ("""    assert.deepEqual([plan.totals.remaining, plan.totals.queueRemaining, plan.totals.accountPaid, plan.state], [600, 200, 400, "active"]);""",
     """    // S129 = A (kapanış düzeltme turu; KULLANICI KARARI 12.11 13:26): kartın Tahsil Edilen / Kalan'ı ve satırın Ödenen'i TEK KUYRUKTAN — Kalan 200, Tahsil Edilen 400,
    // satırlar Ödenen 300 / 100; kartın KENDİ hesabı (kart tahsilatı yok) ownRemaining 600 / ownPaid 0'da durur (sınır ve Mutabakat Testi onu okur).
    assert.deepEqual([plan.totals.remaining, plan.totals.paid, plan.totals.ownRemaining, plan.totals.ownPaid, plan.totals.queueRemaining, plan.totals.accountPaid, plan.state], [200, 400, 600, 0, 200, 400, "active"]);
    assert.deepEqual(plan.items.map(i => [i.paid, i.ownPaid, i.ownRemaining]), [[300, 0, 300], [100, 0, 300]]);"""),
])
edit("test/tyk-goc-249-250.test.mjs", [
    ("""        assert.equal(plan.totals.remaining, 600, "kartın kendi hesabı (kart tahsilatı yok) değişmez");""",
     """        // S129 = A (kapanış düzeltme turu): gösterilen Kalan / Tahsil Edilen tek kuyruktan (300 / 300); kartın kendi hesabı ownRemaining'de.
        assert.deepEqual([plan.totals.ownRemaining, plan.totals.ownPaid, plan.totals.remaining, plan.totals.paid], [600, 0, 300, 300], "kartın kendi hesabı (kart tahsilatı yok) değişmez; gösterilen sayı kuyruktan");"""),
])
edit("test/tyk-tur2b2-250.test.mjs", [
    ("""    assert.deepEqual([p.totals.remaining, p.totals.queueRemaining, p.ownNext.remaining, p.next.remaining, p.items[0].ownRemaining, p.items[0].remaining], [700, 600, 700, 600, 700, 600]);""",
     """    // S129 = A (kapanış düzeltme turu): totals.remaining GÖSTERİLEN (kuyruk) Kalan 600; kartın kendi kalanı totals.ownRemaining 700 (formun sınırı / önerisi — S118 = B).
    assert.deepEqual([p.totals.ownRemaining, p.totals.remaining, p.totals.queueRemaining, p.ownNext.remaining, p.next.remaining, p.items[0].ownRemaining, p.items[0].remaining], [700, 600, 600, 700, 600, 700, 600]);
    assert.deepEqual([p.totals.ownPaid, p.totals.paid, p.items[0].ownPaid, p.items[0].paid], [300, 400, 300, 400], "Tahsil Edilen / Ödenen kuyruktan 400 (kart tahsilatı 300 + avans 100)");"""),
])
edit("test/tyk-tur2a-250.test.mjs", [
    ("""queue: p.totals.queueRemaining, own: p.totals.remaining });""", """queue: p.totals.queueRemaining, own: p.totals.ownRemaining });"""),
])
edit("test/tyk-son-250.test.mjs", [
    ("""kartKendi: plan.totals.remaining, kartKuyruk: plan.totals.queueRemaining,""", """kartKendi: plan.totals.ownRemaining, kartKuyruk: plan.totals.queueRemaining,"""),
])
print("tamam")
