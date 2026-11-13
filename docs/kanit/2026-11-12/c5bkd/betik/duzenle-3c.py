"""Madde 3 (S129 = A) — cari kartının taksit özeti ve "Taksitten Kalan" (cari kartı, Cari Listesi ekran / PDF / Excel, ekstre). Çalışma ağacının kökünden."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new, *count in pairs:
        n = count[0] if count else 1
        assert s.count(old) == n, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("server/routes/accounts.mjs", [
    # detail: shown seçeneği
    ("""  function detail(id, user, { withRemaining = true } = {}) {
    const account = accountRow(id);""", """  // shown (2.5.0 Ç5-B kapanış düzeltmesi, S129 = A — KULLANICI KARARI 12.11 13:26: kart penceresinin 'Tahsil Edilen' / 'Kalan'ı TEK KUYRUKTAN, "ekranda tek sayı"): true →
  // taksit özetinin (plans[].totals.paid / remaining) ve "Taksitten Kalan"ın (totals.planRemaining) GÖSTERİLEN sayıları kart penceresiyle aynı (routes/plans.mjs
  // shownTotalsOf); kartın kendi hesabı plans[].totals.ownPaid / ownRemaining'de durur. Yalnız EKRANA / PDF'e giden yanıtlarda (viewOf): iç çağıranlar (kartı bakiyeye göre
  // kırpma, taksitlendirilebilecek borç, WhatsApp, fatura kapaması) kartın kendi hesabını okumayı sürdürür — bakiye ve defter DEĞİŞMEZ.
  function detail(id, user, { withRemaining = true, shown = false } = {}) {
    const account = accountRow(id);"""),
    ("""    if (remaining) for (const entry of entries) if (isManualDue(entry)) entry.remaining = remaining.get(entry.id)?.remaining ?? roundMoney(Number(entry.amount) || 0);
    return {
      ...account,
      typeLabel: ACCOUNT_TYPES[account.type] || "",
      entries,
      plans: planList.map(planSummaryOf),
      ledger: ledger.lines,""", """    if (remaining) for (const entry of entries) if (isManualDue(entry)) entry.remaining = remaining.get(entry.id)?.remaining ?? roundMoney(Number(entry.amount) || 0);
    const shownOf = shown && tyk && plans()?.shownTotalsOf ? plan => plans().shownTotalsOf(plan, tyk) : () => null;
    const summaries = planList.map(plan => {
      const view = shownOf(plan);
      return planSummaryOf(view ? { ...plan, totals: { ...plan.totals, paid: view.paid, remaining: view.remaining } } : plan);
    });
    return {
      ...account,
      typeLabel: ACCOUNT_TYPES[account.type] || "",
      entries,
      plans: summaries,
      ledger: ledger.lines,"""),
    ("""      totals: tyk ? { ...ledger.totals, overdueInstallments: ledger.totals.overdue, ...tykTotals(tyk) } : ledger.totals,
      side: balanceSide(ledger.totals.balance),
      canManage: manage,""", """      totals: tyk ? { ...ledger.totals, overdueInstallments: ledger.totals.overdue, ...tykTotals(tyk), ...(shown ? { planRemaining: roundMoney(summaries.reduce((sum, plan) => sum + (plan.status === "closed" ? 0 : Math.max(0, Number(plan.totals?.remaining) || 0)), 0)) } : {}) } : ledger.totals,
      side: balanceSide(ledger.totals.balance),
      canManage: manage,"""),
    # ekrana giden yanıtlar
    ("""  // İş Z (2.4.8, T9 ORTA: 2.000 carili şirkette WhatsApp önizlemesi ~23 sn, olay döngüsü kilitli): WhatsApp toplu gönderiminin önizleme / açma okuması""",
     """  // Ekrana / PDF'e giden cari kartı (S129 = A): taksit özeti ve "Taksitten Kalan" kart penceresiyle aynı sayılar.
  const viewOf = (id, user) => detail(id, user, { shown: true });

  // İş Z (2.4.8, T9 ORTA: 2.000 carili şirkette WhatsApp önizlemesi ~23 sn, olay döngüsü kilitli): WhatsApp toplu gönderiminin önizleme / açma okuması"""),
    ("""      audit(user, "account.created", id, { name: input.name, type: input.type });
      return detail(id, user);""", """      audit(user, "account.created", id, { name: input.name, type: input.type });
      return viewOf(id, user);"""),
    ("""      dueChanged = setOpeningDue(user, previous.id, body);
      return detail(previous.id, user);""", """      dueChanged = setOpeningDue(user, previous.id, body);
      return viewOf(previous.id, user);"""),
    ("""    ok(res, { ...detail(account.id, user), entryId: created?.replayed ? created.refId : created.id, ...(created?.replayed ? { replayed: true } : {}) });""",
     """    ok(res, { ...viewOf(account.id, user), entryId: created?.replayed ? created.refId : created.id, ...(created?.replayed ? { replayed: true } : {}) });"""),
    ("""      return ok(res, { ...detail(targetId, user), movedFrom: account.id, ...(result?.replayed ? { replayed: true } : {}) });""",
     """      return ok(res, { ...viewOf(targetId, user), movedFrom: account.id, ...(result?.replayed ? { replayed: true } : {}) });"""),
    ("""    ok(res, { ...detail(account.id, user), ...(result?.replayed ? { replayed: true } : {}) });""",
     """    ok(res, { ...viewOf(account.id, user), ...(result?.replayed ? { replayed: true } : {}) });"""),
    ("""    ok(res, detail(account.id, user));
  });""", """    ok(res, viewOf(account.id, user));
  });"""),
    ("""  router.get("/api/workspace/accounts/:id/ekstre.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = detail(params.id, user);""", """  router.get("/api/workspace/accounts/:id/ekstre.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = viewOf(params.id, user);"""),
    ("""    const user = auth.requirePermission(req, "accounts.view");
    ok(res, detail(params.id, user));
  });""", """    const user = auth.requirePermission(req, "accounts.view");
    ok(res, viewOf(params.id, user));
  });"""),
    ("""    const account = detail(found.id, user);
    ok(res, { account: { id: account.id,""", """    const account = viewOf(found.id, user);
    ok(res, { account: { id: account.id,"""),
    # Cari Listesi: Taksitten Kalan
    ("""        if (plan.status !== "closed") {
          planRemaining += Math.max(0, total - paid);""", """        if (plan.status !== "closed") {
          // S129 = A: "Taksitten Kalan" (liste, PDF, Excel) kart penceresinin Kalan'ıyla aynı — kullanıcı isteğinde kuyruktan; iç çağıranlarda (kuyruk okunmaz) kartın kendi hesabı.
          const view = tykAll && plans()?.shownTotalsOf ? plans().shownTotalsOf(plan, tykAll.get(row.id)) : null;
          planRemaining += view ? Math.max(0, view.remaining) : Math.max(0, total - paid);"""),
])
print("tamam")
