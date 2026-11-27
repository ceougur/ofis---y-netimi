"""Madde 3 (S129 = A + DÜŞÜK-4) — istemci ve mutabakat motoru. Çalışma ağacının kökünden."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new, *count in pairs:
        n = count[0] if count else 1
        assert s.count(old) == n, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("client/assets/hof-plans.js", [
    # Taksit satırı: ₺ düğmesi kartın KENDİ kalanına göre (S118 = B; DÜŞÜK-4 — avansla kapanmış ama kartın kendi hesabında açık taksite de tahsilat girilebilir).
    ("""<td class="hof-cash-actions">${collect && item.remaining > 0 && active ? `<button type="button" class="hof-mini hof-mini-pay" data-pay-item="${esc(item.id)}" title="Bu taksite tahsilat gir" aria-label="${item.seq}. taksite tahsilat gir">₺</button>` : ""}""",
     """<td class="hof-cash-actions">${collect && (item.ownRemaining ?? item.remaining) > 0.005 && active ? `<button type="button" class="hof-mini hof-mini-pay" data-pay-item="${esc(item.id)}" title="Bu taksite tahsilat gir" aria-label="${item.seq}. taksite tahsilat gir">₺</button>` : ""}"""),
    # Form: Hangi Taksite listesi, sınır, açıklama kartın KENDİ hesabından (S118 = B); gösterge kuyruktan (S129 = A) — fark bilgi notunda, açıklama satır durumuyla çelişmez.
    ("""    const openItems = plan.items.filter(row => row.remaining > 0.005 || row.id === entry?.itemId);""",
     """    // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A + dar kontrol DÜŞÜK-4): kart penceresinin göstergeleri ve satırın Ödenen / Kalan'ı Tek Yükümlülük Kuyruğu'ndan
    // (plan.totals.paid / remaining, item.paid / remaining); bu formun sınırı, sorusu, önerisi ve "Hangi Taksite" listesi kartın KENDİ hesabından (S118 = B — sunucunun
    // sınırıyla aynı sayı: plan.totals.ownRemaining, item.ownRemaining, plan.ownNext). Carinin avansıyla kapalı görünen ama kartın kendi hesabında açık taksit seçilebilir.
    const ownLeft = row => row.ownRemaining ?? row.remaining;
    const ownTotalLeft = plan.totals.ownRemaining ?? plan.totals.remaining ?? 0;
    const openItems = plan.items.filter(row => ownLeft(row) > 0.005 || row.id === entry?.itemId);"""),
    ("""    const covered = incoming && !entry && Number.isFinite(plan.totals?.queueRemaining) ? Math.round(((plan.totals.remaining || 0) - plan.totals.queueRemaining) * 100) / 100 : 0;""",
     """    const covered = incoming && !entry && Number.isFinite(plan.totals?.queueRemaining) ? Math.round((ownTotalLeft - plan.totals.remaining) * 100) / 100 : 0;
    // Sıradaki taksit (kartın kendi hesabı) satırda avansla kapalı görünüyorsa açıklama bunu söyler — "40 gün gecikti" ↔ satırda "Ödendi" çelişmesin (DÜŞÜK-4).
    const nextRow = ownNext ? plan.items.find(row => row.id === ownNext.id) : null;
    const nextState = !ownNext ? "" : covered > 0.005 && nextRow && nextRow.remaining <= 0.005 ? "carinin avansıyla kapalı görünüyor" : covered > 0.005 && nextRow && nextRow.remaining < ownNext.remaining - 0.005 ? `${money(Math.round((ownNext.remaining - nextRow.remaining) * 100) / 100)} kadarı carinin avansıyla kapalı görünüyor` : dayLabel(ownNext.days);"""),
    ("""    const paidOff = incoming && !entry && plan.totals.total > 0.005 && plan.totals.remaining <= 0.005;""",
     """    const paidOff = incoming && !entry && plan.totals.total > 0.005 && ownTotalLeft <= 0.005;"""),
    ("""          ? `Kalan ${money(plan.totals.remaining)}${ownNext ? ` · sıradaki ${ownNext.seq}. taksit ${money(ownNext.remaining)} (${dayLabel(ownNext.days)})` : ""}. Tutar""",
     """          ? `${covered > 0.005 ? "Kartın kendi tahsilatlarına göre kalanı" : "Kalan"} ${money(ownTotalLeft)}${ownNext ? ` · sıradaki ${ownNext.seq}. taksit ${money(ownNext.remaining)} (${nextState})` : ""}. Tutar"""),
    ("""options: [{ value: "", label: "En Eski Açık Taksite (önerilen)" }, ...openItems.map(row => ({ value: row.id, label: `${row.seq}. taksit · ${HOF.formatDate(row.dueDate)} · kalan ${money(row.remaining)}` }))] }] : []),""",
     """options: [{ value: "", label: "En Eski Açık Taksite (önerilen)" }, ...openItems.map(row => ({ value: row.id, label: `${row.seq}. taksit · ${HOF.formatDate(row.dueDate)} · kalan ${money(ownLeft(row))}` }))] }] : []),"""),
])

edit("client/assets/hof-accounts.js", [
    # "Taksite Yaz" seçenekleri: tahsilat yazılabilecek kart kartın KENDİ kalanına göre (S118 = B); gösterilen Kalan kuyruktan (S129 = A).
    ("""    const open = account.plans.filter(plan => plan.status === "active" && plan.totals.remaining > 0.005);""",
     """    // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A): özetin Kalan'ı kart penceresiyle aynı (kuyruk); karta tahsilat yazılıp yazılamayacağı kartın KENDİ kalanına bağlı (S118 = B).
    const open = account.plans.filter(plan => plan.status === "active" && (plan.totals.ownRemaining ?? plan.totals.remaining) > 0.005);"""),
])

# Mutabakat motoru: program ↔ model karşılaştırması kartın KENDİ hesabıyla (model kart tahsilatlarını sayar); eski sürüm kodunda alan yoksa eski ad.
edit("test/mutabakat/motor.mjs", [
    ("""  const planLeft = p => Math.max(0, p.total - Math.max(0, p.paid));""", """  const planLeft = p => Math.max(0, p.total - Math.max(0, p.paid));
  // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A): programın kart yanıtında totals.paid GÖSTERİLEN (tek kuyruk) sayıdır; kartın KENDİ tahsilatı totals.ownPaid — model kart
  // tahsilatlarını sayar, onunla karşılaştırılır (eski sürüm kodunu süren koşularda alan yoktur: totals.paid zaten kartın kendi hesabıdır).
  const ownPaidOf = p => p.totals.ownPaid ?? p.totals.paid;"""),
    ("""      if ((m.slack || m.over) && centsOf(p.totals.paid) === m.paid) {""", """      if ((m.slack || m.over) && centsOf(ownPaidOf(p)) === m.paid) {"""),
    ("""      if (centsOf(p.totals.total) !== m.total || centsOf(p.totals.paid) !== m.paid) {""", """      if (centsOf(p.totals.total) !== m.total || centsOf(ownPaidOf(p)) !== m.paid) {"""),
    ("""program ${p.totals.total}/${p.totals.paid} · model""", """program ${p.totals.total}/${ownPaidOf(p)} · model"""),
    ("""      const left = Math.max(0, centsOf(p.totals.total) - Math.max(0, centsOf(p.totals.paid)));""", """      const left = Math.max(0, centsOf(p.totals.total) - Math.max(0, centsOf(ownPaidOf(p))));"""),
    ("""      const { target, refunds } = ownTarget(mi, centsOf(p.totals.paid));
      const want = Math.min(target, Math.max(0, mi.rest - Math.max(0, centsOf(p.totals.paid))));""", """      const { target, refunds } = ownTarget(mi, centsOf(ownPaidOf(p)));
      const want = Math.min(target, Math.max(0, mi.rest - Math.max(0, centsOf(ownPaidOf(p)))));"""),
])
print("tamam")
