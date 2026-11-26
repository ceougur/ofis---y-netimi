# Testin üretici bölümünü sayaçlı kopyaya çevirir (assert yerine bozuk sayısı): Σ ve taksitli fatura tavanı ayrı.
import sys
s = open(sys.argv[1]).read()
a = "          assert.equal(sigmaMinor(res), balanceMinor(input.lines), `tohum ${seed} cari ${a}: Σ kalem ${sigmaMinor(res) / 100} ≠ bakiye ${balanceMinor(input.lines) / 100}`);"
assert s.count(a) == 1
s = s.replace(a, "          if (sigmaMinor(res) !== balanceMinor(input.lines)) total.sigmaBozuk = (total.sigmaBozuk || 0) + 1;")
b = "            assert.ok(open <= ceiling + 1, `tohum ${seed} cari ${a}: taksitli fatura ${invoice.id} açık ${open / 100} > kartın kendi kalanı ${ceiling / 100}`);"
assert s.count(b) == 1
s = s.replace(b, "            if (open > ceiling + 1) total.tavanBozuk = (total.tavanBozuk || 0) + 1;")
open(sys.argv[2], "w").write(s)
