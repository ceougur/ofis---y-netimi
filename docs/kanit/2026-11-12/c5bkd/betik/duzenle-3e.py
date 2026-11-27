"""Madde 3 — mutabakat motorunun rapor denetimi: Taksit Kartları raporunun Ödenen'i S129'dan sonra GÖSTERİLEN sayıdır; model ↔ kartın kendi hesabı zinciri korunur."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/mutabakat/motor.mjs", [
    ("""    if (sum(kartlar, "Toplam") !== planTotal || sum(kartlar, "Ödenen") !== planPaid) problems.push(`Taksit Kartları: toplam/ödenen ${tl(sum(kartlar, "Toplam"))}/${tl(sum(kartlar, "Ödenen"))} · model ${tl(planTotal)}/${tl(planPaid)}`);""",
     """    // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A): raporun "Ödenen"i artık GÖSTERİLEN sayıdır (tek kuyruk — kart seçilmeden alınan tahsilatın kapattığı pay dahil); model tek
    // kuyruğu kurmaz. Zincir iki halkayla korunur: (1) Taksitler listesinin kartın KENDİ hesabı (totals.ownPaid) = model (kart tahsilatları); (2) rapor = ekran (raporun
    // Ödenen'i = listenin gösterilen toplamı). Eski sürüm kodunda ownPaid yoktur: totals.paid kartın kendi hesabıdır, iki halka aynı sayıya iner (eski denetim).
    const liste = (await api("GET", "/api/workspace/plans?status=all")).data?.plans || [];
    const ownPaid = liste.reduce((s, p) => s + centsOf(ownPaidOf(p)), 0), shownPaid = liste.reduce((s, p) => s + centsOf(p.totals.paid), 0);
    if (sum(kartlar, "Toplam") !== planTotal || ownPaid !== planPaid) problems.push(`Taksit Kartları: toplam ${tl(sum(kartlar, "Toplam"))} · kartların kendi tahsilatı ${tl(ownPaid)} · model ${tl(planTotal)}/${tl(planPaid)}`);
    if (sum(kartlar, "Ödenen") !== shownPaid) problems.push(`Taksit Kartları: raporun ödeneni ${tl(sum(kartlar, "Ödenen"))} · Taksitler listesinin ödeneni ${tl(shownPaid)} (rapor ≠ ekran)`);"""),
])
print("tamam")
