"""Madde 3 (S129 = A) — sunucu: kartın kendi hesabı alanları (own*) + gösterilen toplamlar (kuyruk). Çalışma ağacının kökünden koşulur."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:80], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("server/lib/plans.mjs", [
    ("""    return { ...item, paid, remaining, partial: paid > EPS && remaining > EPS, days, state };
  });""", """    // ownPaid / ownRemaining (2.5.0 Ç5-B kapanış düzeltmesi, S129 = A): kartın KENDİ hesabı (kart tahsilatları) — kart ekranı `paid` / `remaining`i Tek Yükümlülük
    // Kuyruğu'ndan gösterir (routes/plans.mjs withQueue); sınır / soru / önerilen tutar (S118 = B), Mutabakat Testi ve mutabakat motoru bu alanları okur.
    return { ...item, paid, remaining, ownPaid: paid, ownRemaining: remaining, partial: paid > EPS && remaining > EPS, days, state };
  });"""),
    ("""totals: { total, planned, unplanned, paidIn: roundMoney(paidIn), paidOut: roundMoney(paidOut), paid: net, remaining, extra, overdue: overdueAmount, overdueCount: overdue.length },""",
     """totals: { total, planned, unplanned, paidIn: roundMoney(paidIn), paidOut: roundMoney(paidOut), paid: net, remaining, ownPaid: net, ownRemaining: remaining, extra, overdue: overdueAmount, overdueCount: overdue.length },"""),
])

edit("server/routes/plans.mjs", [
    ("""      // ownRemaining: kartın KENDİ hesabıyla kalan (allocate) — S118 = B (tur 2b-2): tahsilat formunun önerdiği tutar bundan (sınır ve soru da kartın kendi kalanından).
      return { ...item, remaining, ownRemaining: item.remaining, held, accountPaid, partial: remaining > 0.005 && remaining < item.amount - 0.005, state };
    });""", """      // ownRemaining: kartın KENDİ hesabıyla kalan (allocate) — S118 = B (tur 2b-2): tahsilat formunun önerdiği tutar bundan (sınır ve soru da kartın kendi kalanından).
      // paid (Ç5-B kapanış düzeltmesi, S129 = A — KULLANICI KARARI 12.11 13:26 AYNEN: "taksit satırının 'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı …)"):
      // satırın Ödenen'i = tutarı − kuyruk kalanı (kart seçilmeden alınan tahsilatın / avansın kapattığı pay dahil); kartın kendi tahsilatı ownPaid'de. Kapatılmış kartta
      // bugünkü gösterim AYNEN (kural yazılmadı — kapanış dar kontrolünün kapsam dışı gözlemi).
      return { ...item, remaining, ownRemaining: item.remaining, paid: closed ? item.paid : roundMoney(item.amount - remaining), ownPaid: item.paid, held, accountPaid, partial: remaining > 0.005 && remaining < item.amount - 0.005, state };
    });"""),
    ("""    const overdueExtras = lateExtras.map(item => ({ key: item.key, label: item.label, amount: item.remaining }));
    return {
      ...ledger,
      items,
      // totals.remaining kartın KENDİ hesabı kalır (tutar − kart tahsilatı; Mutabakat Testi plans:totals "ekran = kartın satırları"); kuyruk kalanı ayrı alan.
      // ownOverdue: kartın kendi hesabıyla gecikmiş (taksit − kart tahsilatı; eski anlam) — onarım / göç karşılaştırmaları için.
      totals: { ...ledger.totals, queueRemaining: remaining, accountPaid,""", """    const overdueExtras = lateExtras.map(item => ({ key: item.key, label: item.label, amount: item.remaining }));
    // S129 = A (KULLANICI KARARI 12.11 13:26 AYNEN: "taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit
    // satırının 'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı: örnekte kart 900, bağsız tahsilat 500 → Tahsil Edilen 500 · Kalan 400; kart 600, bağsız tahsilat
    // 800 → Kalan 0 · Tamamlandı); tahsilat formunun sınırı / sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır"): totals.paid / totals.remaining
    // GÖSTERİLEN sayılardır (shownTotals); kartın kendi hesabı totals.ownPaid / ownRemaining (lib/plans.mjs allocate) — sınır, Mutabakat Testi, mutabakat motoru bunları okur.
    const shown = closed ? { paid: ledger.totals.paid, remaining: ledger.totals.remaining } : shownTotals(plan, ledger.totals, remaining);
    return {
      ...ledger,
      items,
      // ownOverdue: kartın kendi hesabıyla gecikmiş (taksit − kart tahsilatı; eski anlam) — onarım / göç karşılaştırmaları için.
      totals: { ...ledger.totals, paid: shown.paid, remaining: shown.remaining, queueRemaining: remaining, accountPaid,"""),
    ("""  // Ç5-B tur 2a (O-3, S91 = A — vadesiz kayıt kayıt gününde vadeli kalem; C5 §2.10 madde 9 "Vade Takip gecikmiş tutarı = gecikmiş"): kuyruğun kart kalemlerinden TAKSİT""",
     """  // S129 = A — kartın GÖSTERİLEN kalanı ve tahsil edileni (kart penceresi, Taksitler listesi, cari kartı, PDF / Excel / raporlar aynı sayı):
  //   Kalan = taksitlerin kuyruk kalanı + taksitlendirilmemiş kalan / Taksit İadesi (queueRemaining) + Mevcut Borç kartının taksitlere BÖLÜNMEMİŞ kısmının kalanı (o kısım
  //           kuyrukta kartın kalemi değildir — alttaki borç kalemi olarak durur; kartın kendi hesabından, bugünkü gibi: bölünmemiş tutar − taksitleri aşan kart tahsilatı).
  //   Tahsil Edilen = Toplam − Kalan (satırların Ödenen'i = tutarı − kuyruk kalanı ile aynı toplam).
  // Karar örnekleri tam taksitlendirilmiş kartlardır; bölünmemiş kısım için karar yok → o kısım bugünkü gösteriminde bırakıldı (kapanış düzeltme turu raporu).
  function shownTotals(plan, totals, queueRemaining) {
    const unplannedLeft = plan.coversBalance ? Math.max(0, roundMoney((totals.unplanned || 0) - (totals.extra || 0))) : 0;
    const remaining = roundMoney(queueRemaining + unplannedLeft);
    return { paid: roundMoney((totals.total || 0) - remaining), remaining };
  }
  // Cari kartı / Cari Listesi (routes/accounts.mjs): kartın özetine (kartın kendi hesabı) aynı gösterilen sayıları verir. tyk: carinin kuyruğu (obligationsFor / allObligations
  // öğesi); yoksa ya da kart kapalıysa null (özet değişmez). Dönüş { paid, remaining }.
  function shownTotalsOf(plan, tyk) {
    const map = tyk && plan.status !== "closed" ? tyk.installments?.get(plan.id) : null;
    if (!map || !plan.totals) return null;
    let queueRemaining = 0;
    for (const row of map.values()) queueRemaining += row.remaining || 0;
    return shownTotals(plan, plan.totals, roundMoney(queueRemaining));
  }
  // Ç5-B tur 2a (O-3, S91 = A — vadesiz kayıt kayıt gününde vadeli kalem; C5 §2.10 madde 9 "Vade Takip gecikmiş tutarı = gecikmiş"): kuyruğun kart kalemlerinden TAKSİT"""),
    ("""  return { uncoveredDebt, assertRestorable,""", """  return { shownTotalsOf, uncoveredDebt, assertRestorable,"""),
])
print("tamam")
