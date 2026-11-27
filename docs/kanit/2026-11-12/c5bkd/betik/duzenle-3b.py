"""Madde 3 (S129 = A) — sunucu 2: ekstre / makbuz PDF, Rapor Merkezi, Mutabakat Testi (kartın kendi alanları), cari kartı / Cari Listesi. Çalışma ağacının kökünden."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new, *count in pairs:
        n = count[0] if count else 1
        assert s.count(old) == n, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


# --- routes/plans.mjs: ekstre / makbuz kart ekranıyla AYNI görünümden; Rapor Merkezi için görünüm dışa verilir.
edit("server/routes/plans.mjs", [
    ("""    const plan = detail(params.id, user);
    const pdf = planStatementPdf(plan,""", """    // S129 = A: ekstre kart penceresiyle AYNI sayıları basar (gösterge, satırın Ödenen / Kalan / Durum'u — kuyruk görünümü; önce kartın kendi hesabıydı: ekran ≠ PDF).
    const plan = detailView(params.id, user);
    const pdf = planStatementPdf(plan,"""),
    ("""    const plan = detail(params.id, user);
    const entry = plan.entries.find(item => item.id === params.entryId);""", """    // S129 = A: makbuzdaki Tahsil edilen / Kalan borç kart penceresiyle aynı (kuyruk görünümü).
    const plan = detailView(params.id, user);
    const entry = plan.entries.find(item => item.id === params.entryId);"""),
    ("""  return { shownTotalsOf, uncoveredDebt, assertRestorable,""", """  return { shownTotalsOf, queueLedger: (plan, ledger, queue, day) => withQueue(plan, ledger, queue, day), queueAll: queueOf, uncoveredDebt, assertRestorable,"""),
])

# --- Rapor Merkezi: taksit vade / geciken raporları ve aylık performans kart ekranıyla aynı görünümden.
edit("server/routes/report-center.mjs", [
    ("""        const list = store.all("SELECT id, name, total, status FROM plans WHERE deleted_at IS NULL AND status = 'active'");""",
     """        const list = store.all("SELECT id, name, total, status, account_id AS accountId, covers_balance AS coversBalance FROM plans WHERE deleted_at IS NULL AND status = 'active'");
        // S129 = A: taksitin Ödenen / Kalan / Geciken'i kart ekranıyla AYNI (Tek Yükümlülük Kuyruğu görünümü — routes/plans.mjs queueLedger).
        const queue = plans()?.queueAll ? plans().queueAll() : null;
        const viewOf = (plan, ledger) => (plans()?.queueLedger ? plans().queueLedger(plan, ledger, queue, day) : ledger);"""),
    ("""          for (const item of allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day }).items) {
            if (!inRange(item.dueDate, range)) continue;""", """          for (const item of viewOf(plan, allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day })).items) {
            if (!inRange(item.dueDate, range)) continue;"""),
    ("""      `SELECT p.id, p.name, p.phone, p.total, p.status, COALESCE(a.name, '') AS accountName FROM plans p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.deleted_at IS NULL AND p.status = 'active'`,
    );""", """      `SELECT p.id, p.name, p.phone, p.total, p.status, p.account_id AS accountId, p.covers_balance AS coversBalance, COALESCE(a.name, '') AS accountName FROM plans p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.deleted_at IS NULL AND p.status = 'active'`,
    );
    // S129 = A: satırın Ödenen / Kalan / Durum'u kart ekranıyla AYNI (Tek Yükümlülük Kuyruğu görünümü) — kart seçilmeden alınan tahsilatın kapattığı taksit "geciken" sayılmaz.
    const queue = plans()?.queueAll ? plans().queueAll() : null;"""),
    ("""      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      for (const item of ledger.items) if (filter(item)) out.push({ plan, item });""", """      const own = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      const ledger = plans()?.queueLedger ? plans().queueLedger(plan, own, queue, day) : own;
      for (const item of ledger.items) if (filter(item)) out.push({ plan, item });"""),
])

# --- Mutabakat Testi "plans:totals": Taksitler ekranının kartın KENDİ hesabı alanları = kartın satırları (S129'dan sonra ekranın paid / remaining'i gösterilen sayıdır).
OWN_NOTE = "// S129 = A: listede totals.paid / remaining GÖSTERİLEN (kuyruk) sayıdır; kartın kendi hesabı ownPaid / ownRemaining — denetim onları satırlarla karşılaştırır.\n"
edit("server/lib/integrity.mjs", [
    ("""        if (toCents(plan.totals.total) !== toCents(row.total) || toCents(plan.totals.paid) !== toCents(row.paid)) wrong.push(`${plan.refNo || plan.id} ${plan.name}: ekran ${plan.totals.total}/${plan.totals.paid} · satır ${row.total}/${row.paid}`);
        else if (plan.status !== "closed" && toCents(plan.totals.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) wrong.push(`${plan.refNo || plan.id} ${plan.name}: kalan ${plan.totals.remaining}`);""",
     "        " + OWN_NOTE + """        const own = { paid: plan.totals.ownPaid ?? plan.totals.paid, remaining: plan.totals.ownRemaining ?? plan.totals.remaining };
        if (toCents(plan.totals.total) !== toCents(row.total) || toCents(own.paid) !== toCents(row.paid)) wrong.push(`${plan.refNo || plan.id} ${plan.name}: ekran ${plan.totals.total}/${own.paid} · satır ${row.total}/${row.paid}`);
        else if (plan.status !== "closed" && toCents(own.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) wrong.push(`${plan.refNo || plan.id} ${plan.name}: kalan ${own.remaining}`);"""),
])
edit("server/lib/integrity-scope.mjs", [
    ("""          if (toCents(plan.totals.total) !== toCents(row.total) || toCents(plan.totals.paid) !== toCents(row.paid)) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}`);
          else if (plan.status !== "closed" && toCents(plan.totals.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}: kalan`);""",
     "          " + OWN_NOTE + """          const own = { paid: plan.totals.ownPaid ?? plan.totals.paid, remaining: plan.totals.ownRemaining ?? plan.totals.remaining };
          if (toCents(plan.totals.total) !== toCents(row.total) || toCents(own.paid) !== toCents(row.paid)) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}`);
          else if (plan.status !== "closed" && toCents(own.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}: kalan`);"""),
])
print("tamam")
