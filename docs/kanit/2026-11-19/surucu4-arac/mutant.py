"""Testin dişi: programın AYRI kopyasında bilinçli hata (sınanan kod 301c0e29; worktree'ye dokunulmaz).
mutant1: satıştan iade KDV'si her zaman eski yöne (B 391; KG-8 A / geçiş günü yok sayılır).
mutant2: kayıt tahsilatı her zaman 602'ye (KG-3 A / 336.90 yok sayılır)."""
import sys
kok, tur = sys.argv[1], sys.argv[2]
p = kok + "/server/lib/general-ledger.mjs"
t = open(p, encoding="utf-8").read()
if tur == "mutant1":
    a = '{ account: oldReturnVat(shift, row.date) ? "391" : "191", side: "debit", amount: vat - withheld },'
    b = '{ account: "391", side: "debit", amount: vat - withheld }, // MUTANT1'
else:
    a = 'oldCollection(shift, row.date) ? "602" : UNCLASSIFIED_GL.collection, row.amount);'
    b = '"602" /* MUTANT2 */, row.amount);'
assert t.count(a) == 1, (tur, t.count(a))
open(p, "w", encoding="utf-8").write(t.replace(a, b))
print(tur, "uygulandı")
