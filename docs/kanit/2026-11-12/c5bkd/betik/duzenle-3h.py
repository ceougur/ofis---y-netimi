"""Madde 3 — S129: 'Tahsil Edilen' / 'Ödenen' = taksitin kuyrukta PARAYLA kapanan kısmı (kart tahsilatı + kart seçilmeden alınan tahsilatın / avansın payı); iki
yükümlülük kaleminin netleşmesi (elle Alacak, alış faturası) tahsilat DEĞİLDİR — o alt durumda gösterim bugünkü gibi kalır (kâhin d19 N4: tanım alanı dışı)."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("server/lib/obligation-queue.mjs", [
    ("""      const byAccount = inst.closures.filter(c => !c.reverse && c.mode !== "linked").reduce((sum, c) => sum + c.amount, 0);
      map.set(inst.itemId || "rest", { remaining: tl(inst.left), doubtful: tl(held.get(inst.key) || 0), paid: tl(inst.amount - inst.left), byAccount: tl(byAccount), amount: tl(inst.amount), vade: inst.vade, seq: inst.seq || 0 });""",
     """      const byAccount = inst.closures.filter(c => !c.reverse && c.mode !== "linked").reduce((sum, c) => sum + c.amount, 0);
      // collected (Ç5-B kapanış düzeltmesi, S129 = A): taksitin TAHSİL EDİLEN kısmı — kart tahsilatı (bağlı) + kart seçilmeden gelen bağsız ödemenin payı (tahsilat, evrak,
      // faturasız stok iadesi, kart / bağ fazlası — S50) + avansla ödenmiş sayılan kısım (S101). İki YÜKÜMLÜLÜK kaleminin netleşmesi (elle Alacak, alış faturası — karar
      // (5) / S92) tahsilat değildir: sayılmaz (o caride kartın gösterimi bugünkü gibi kalır — kâhin C16.2 "karşı yönlü kalemli kartlı cari: tanım alanı dışı").
      const collected = inst.closures.filter(c => !c.reverse && !c.payer?.due).reduce((sum, c) => sum + c.amount, 0);
      map.set(inst.itemId || "rest", { remaining: tl(inst.left), doubtful: tl(held.get(inst.key) || 0), paid: tl(inst.amount - inst.left), collected: tl(collected), byAccount: tl(byAccount), amount: tl(inst.amount), vade: inst.vade, seq: inst.seq || 0 });"""),
])

edit("server/routes/plans.mjs", [
    ("""      return { ...item, remaining, ownRemaining: item.remaining, paid: closed ? item.paid : roundMoney(item.amount - remaining), ownPaid: item.paid, held, accountPaid, partial: remaining > 0.005 && remaining < item.amount - 0.005, state };""",
     """      return { ...item, remaining, ownRemaining: item.remaining, paid: closed ? item.paid : roundMoney(Math.min(item.amount, row ? row.collected || 0 : 0)), ownPaid: item.paid, held, accountPaid, partial: remaining > 0.005 && remaining < item.amount - 0.005, state };"""),
    ("""      // paid (Ç5-B kapanış düzeltmesi, S129 = A — KULLANICI KARARI 12.11 13:26 AYNEN: "taksit satırının 'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı …)"):
      // satırın Ödenen'i = tutarı − kuyruk kalanı (kart seçilmeden alınan tahsilatın / avansın kapattığı pay dahil); kartın kendi tahsilatı ownPaid'de. Kapatılmış kartta
      // bugünkü gösterim AYNEN (kural yazılmadı — kapanış dar kontrolünün kapsam dışı gözlemi).""",
     """      // paid (Ç5-B kapanış düzeltmesi, S129 = A — KULLANICI KARARI 12.11 13:26 AYNEN: "taksit satırının 'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı …)"):
      // satırın Ödenen'i = taksitin kuyrukta TAHSİL EDİLEN kısmı (lib/obligation-queue.mjs `collected`: kart tahsilatı + kart seçilmeden alınan tahsilatın / avansın payı);
      // kartın kendi tahsilatı ownPaid'de. Kapatılmış kartta bugünkü gösterim AYNEN (kural yazılmadı — kapanış dar kontrolünün kapsam dışı gözlemi)."""),
    ("""    const shown = closed ? { paid: ledger.totals.paid, remaining: ledger.totals.remaining } : shownTotals(plan, ledger.totals, remaining);""",
     """    const shown = closed ? { paid: ledger.totals.paid, remaining: ledger.totals.remaining } : shownTotals(plan, ledger.totals, collectedOf(map));"""),
    ("""  // S129 = A — kartın GÖSTERİLEN kalanı ve tahsil edileni (kart penceresi, Taksitler listesi, cari kartı, PDF / Excel / raporlar aynı sayı):
  //   Kalan = taksitlerin kuyruk kalanı + taksitlendirilmemiş kalan / Taksit İadesi (queueRemaining) + Mevcut Borç kartının taksitlere BÖLÜNMEMİŞ kısmının kalanı (o kısım
  //           kuyrukta kartın kalemi değildir — alttaki borç kalemi olarak durur; kartın kendi hesabından, bugünkü gibi: bölünmemiş tutar − taksitleri aşan kart tahsilatı).
  //   Tahsil Edilen = Toplam − Kalan (satırların Ödenen'i = tutarı − kuyruk kalanı ile aynı toplam).
  // Karar örnekleri tam taksitlendirilmiş kartlardır; bölünmemiş kısım için karar yok → o kısım bugünkü gösteriminde bırakıldı (kapanış düzeltme turu raporu).
  function shownTotals(plan, totals, queueRemaining) {
    const unplannedLeft = plan.coversBalance ? Math.max(0, roundMoney((totals.unplanned || 0) - (totals.extra || 0))) : 0;
    const remaining = roundMoney(queueRemaining + unplannedLeft);
    return { paid: roundMoney((totals.total || 0) - remaining), remaining };
  }""",
     """  // S129 = A — kartın GÖSTERİLEN tahsil edileni ve kalanı (kart penceresi, Taksitler listesi, cari kartı, PDF / Excel / raporlar aynı sayı):
  //   Tahsil Edilen = taksitlerin (ve taksitlendirilmemiş kalanın) kuyrukta TAHSİL EDİLEN kısmı (`collected`: kart tahsilatı + kart seçilmeden alınan tahsilatın / avansın
  //                   payı) = satırların Ödenen toplamı; Mevcut Borç kartının taksitlere BÖLÜNMEMİŞ kısmına yazılan kart tahsilatı (o kısım kuyrukta kartın kalemi değildir —
  //                   alttaki borç kalemi olarak durur) kartın kendi hesabından, bugünkü gibi eklenir.
  //   Kalan = Toplam − Tahsil Edilen (kâhin KARARLAR Y6-4: "Kart kalan = toplam − ödenen").
  // Karar örnekleri yalnız PARAYLA kapanışı söyler. Para dışı kapanışta (elle Alacak / alış faturasıyla netleşme, iade ya da kırpma — EK-2B 32) karar yok: o tutar "tahsil
  // edilen" sayılmaz, kartın göstergesi bugünkü gibi kalır (kapanış düzeltme turu raporu "TOPLU SORULACAKLAR").
  const collectedOf = map => {
    let sum = 0;
    for (const [key, row] of map) if (key !== "back") sum += row.collected || 0;
    return roundMoney(sum);
  };
  function shownTotals(plan, totals, collected) {
    const unplannedPaid = plan.coversBalance ? Math.max(0, Math.min(totals.extra || 0, totals.unplanned || 0)) : 0;
    const paid = roundMoney(Math.min(totals.total || 0, collected + unplannedPaid));
    return { paid, remaining: roundMoney(Math.max(0, (totals.total || 0) - paid)) };
  }"""),
    ("""    const map = tyk && plan.status !== "closed" ? tyk.installments?.get(plan.id) : null;
    if (!map || !plan.totals) return null;
    let queueRemaining = 0;
    for (const row of map.values()) queueRemaining += row.remaining || 0;
    return shownTotals(plan, plan.totals, roundMoney(queueRemaining));""",
     """    const map = tyk && plan.status !== "closed" ? tyk.installments?.get(plan.id) : null;
    if (!map || !plan.totals) return null;
    return shownTotals(plan, plan.totals, collectedOf(map));"""),
])
print("tamam")
