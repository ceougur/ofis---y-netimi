"""S99 bulgusunun yeniden üretimi için inceleme motoru: verilen motor.mjs kopyasına dar kontrolün önerdiği "açık ≥ kartın kuyruk kalanı" denetimini ekler (alan adı inv.tryPayable).
Kullanım: s99-motor-kur.py <kaynak motor.mjs> <hedef klasör>   → <hedef>/test/mutabakat/motor.mjs"""
import os, sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
a = "      if (Math.abs(want - left) > 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} (geri ödenen"
assert s.count(a) == 1
b = """      { // DAR KONTROLÜN ÖNERDİĞİ alt sınır (S99 = A "taksitli faturanın açığı = kartının KUYRUK kalanı"): açık ≥ min(kart GET items[].remaining toplamı, ödenecek).
        const pd = (await api("GET", `/api/workspace/plans/${p.id}`)).data;
        const queueLeft = (pd?.items || []).reduce((s, it) => s + centsOf(it.remaining), 0);
        if (pd && centsOf(inv.open) < Math.min(queueLeft, centsOf(inv.tryPayable)) - 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} < kartın KUYRUK kalanı ${tl(queueLeft)} (S99 alt sınır) · kapatanlar ${(inv.closers || []).map(c => `${c.date}:${c.amount}:${c.label}`).join(" | ")}`);
      }
"""
os.makedirs(f"{dst}/test/mutabakat", exist_ok=True)
open(f"{dst}/test/mutabakat/motor.mjs", "w", encoding="utf-8").write(s.replace(a, b + a))
print("inceleme motoru:", f"{dst}/test/mutabakat/motor.mjs")
