"""Madde 3 — mutantlar (KD3-…) + karma testte yazım sırası (önce bağsız tahsilat, sonra kart tahsilatı: kartın yazımında mutabakat kapısı gösterilen ≠ kendi hesabı durumunu görür)."""
import json


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/tyk-kapanis-250.test.mjs", [
    ("""    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "cash", date: day(-8), cashForce: true, similarOk: true }));
    await h.entry(acc, { kind: "in", amount: "200", date: day(-5) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.ownPaid, p.totals.ownRemaining], [500, 400, 300, 600]);""",
     """    // Önce bağsız tahsilat, SONRA kart tahsilatı: kartın yazımında mutabakat kapısı (plans:totals — kartın kendi hesabı = satırlar) gösterilen ≠ kendi hesabı durumunu görür.
    await h.entry(acc, { kind: "in", amount: "200", date: day(-5) });
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "cash", date: day(-8), cashForce: true, similarOk: true }));
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.ownPaid, p.totals.ownRemaining], [500, 400, 300, 600]);"""),
])

OQ = "server/lib/obligation-queue.mjs"
PL = "server/routes/plans.mjs"
AC = "server/routes/accounts.mjs"
RC = "server/routes/report-center.mjs"
KAP = ["test/tyk-kapanis-250.test.mjs"]
M = [
    ["KD3-a", "S129 — iki yükümlülük kaleminin netleşmesi (elle Alacak) de 'tahsil edilen' sayılır", OQ, "const collected = inst.closures.filter(c => !c.reverse && !c.payer?.due).reduce((sum, c) => sum + c.amount, 0);", "const collected = inst.closures.filter(c => !c.reverse).reduce((sum, c) => sum + c.amount, 0);", KAP],
    ["KD3-b", "S129 — satırın Ödenen'i tutar − kuyruk kalanı (netleşme / kırpma da ödenmiş görünür)", PL, "paid: closed ? item.paid : roundMoney(Math.min(item.amount, row ? row.collected || 0 : 0)), ownPaid: item.paid,", "paid: closed ? item.paid : roundMoney(item.amount - remaining), ownPaid: item.paid,", KAP],
    ["KD3-c", "S129 — kapatılmış kartın göstergesi de kuyruktan (kural yazılmadı; bugünkü gösterim bozulur)", PL, "const shown = closed ? { paid: ledger.totals.paid, remaining: ledger.totals.remaining } : shownTotals(plan, ledger.totals, collectedOf(map));", "const shown = shownTotals(plan, ledger.totals, collectedOf(map));", KAP],
    ["KD3-d", "S129 — Mevcut Borç kartının bölünmemiş kısmına yazılan kart tahsilatı gösterilmez", PL, "const unplannedPaid = plan.coversBalance ? Math.max(0, Math.min(totals.extra || 0, totals.unplanned || 0)) : 0;", "const unplannedPaid = 0;", KAP],
    ["KD3-e", "S129 — kartın kendi fazla tahsilatı (K8 avansı) Tahsil Edilen'de görünmez", PL, "const over = Math.max(0, roundMoney((totals.ownPaid ?? totals.paid ?? 0) - total));", "const over = 0;", KAP],
    ["KD3-f", "S129 — cari kartının taksit özeti kartın kendi hesabında kalır (ekran ≠ kart penceresi)", AC, "const viewOf = (id, user) => detail(id, user, { shown: true });", "const viewOf = (id, user) => detail(id, user, { shown: false });", KAP],
    ["KD3-g", "S129 — Cari Listesi 'Taksitten Kalan' kartın kendi hesabında kalır", AC, "const view = tykAll && plans()?.shownTotalsOf ? plans().shownTotalsOf(plan, tykAll.get(row.id)) : null;", "const view = null;", KAP],
    ["KD3-h", "S129 — Mutabakat Testi gösterilen sayıyı satırlarla karşılaştırır (bağsız tahsilatlı her kartta kırmızı)", "server/lib/integrity.mjs", "        const own = { paid: plan.totals.ownPaid ?? plan.totals.paid, remaining: plan.totals.ownRemaining ?? plan.totals.remaining };", "        const own = { paid: plan.totals.paid, remaining: plan.totals.remaining };", KAP],
    ["KD3-i", "S129 — mutabakat kapısı gösterilen sayıyı satırlarla karşılaştırır (kart yazımı reddedilir)", "server/lib/integrity-scope.mjs", "          const own = { paid: plan.totals.ownPaid ?? plan.totals.paid, remaining: plan.totals.ownRemaining ?? plan.totals.remaining };", "          const own = { paid: plan.totals.paid, remaining: plan.totals.remaining };", KAP],
    ["KD3-j", "S129 — taksit ekstresi PDF'i kartın kendi hesabından (ekran ≠ PDF)", PL, "    const plan = detailView(params.id, user);\n    const pdf = planStatementPdf(plan,", "    const plan = detail(params.id, user);\n    const pdf = planStatementPdf(plan,", KAP],
    ["KD3-k", "S129 — makbuz kartın kendi hesabından (ekran ≠ makbuz)", PL, "    const plan = detailView(params.id, user);\n    const entry = plan.entries.find(item => item.id === params.entryId);", "    const plan = detail(params.id, user);\n    const entry = plan.entries.find(item => item.id === params.entryId);", KAP],
    ["KD3-l", "S129 — Rapor Merkezi taksit vadeleri kartın kendi hesabından", RC, "      const ledger = plans()?.queueLedger ? plans().queueLedger(plan, own, queue, day) : own;", "      const ledger = own;", KAP],
    ["KD3-m", "S129 — Rapor Merkezi aylık performans kartın kendi hesabından", RC, "const viewOf = (plan, ledger) => (plans()?.queueLedger ? plans().queueLedger(plan, ledger, queue, day) : ledger);", "const viewOf = (plan, ledger) => ledger;", KAP],
    ["KD3-n", "S129 geri — kart penceresi / Taksitler listesi göstergeleri kartın kendi hesabından (taban davranışı)", PL, "totals: { ...ledger.totals, paid: shown.paid, remaining: shown.remaining, queueRemaining: remaining, accountPaid,", "totals: { ...ledger.totals, queueRemaining: remaining, accountPaid,", KAP],
]
p = "test/tyk-mutasyon-250.mjs"
s = open(p, encoding="utf-8").read()
a = """];
rmSync(base, { recursive: true, force: true });
let killed = 0;"""
assert s.count(a) == 1
s = s.replace(a, "".join("  " + json.dumps(m, ensure_ascii=False) + ",\n" for m in M) + a)
open(p, "w", encoding="utf-8").write(s)
print("tamam")
