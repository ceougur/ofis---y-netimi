"""Bilinçli hata (sürücünün dişi): python3 -I mutant.py <program kopyası kökü> mutant1|mutant2"""
import os
import sys

kok, ad = sys.argv[1], sys.argv[2]
M = {
    # Kartı Kapat kalanı yine 689'a: yeni Kartı Kapat da eski kuralın işaretini alır (kalan carinin borcundan düşülür).
    "mutant1": ("server/routes/plans.mjs",
                """store.run("UPDATE plans SET closed_at = ?, close_rule = '' WHERE id = ?", status === "closed" ? today() : null, previous.id);""",
                """store.run("UPDATE plans SET closed_at = ?, close_rule = '2.4.9' WHERE id = ?", status === "closed" ? today() : null, previous.id);"""),
    # Excel'de aynı adlı ikinci kişinin kartı yine atlanır: aynı ad (+ grup) açık kart varsa kişiye bakmadan "Aynı adla açık kart var".
    "mutant2": ("server/routes/plans.mjs",
                """if (duplicate === "same") throw new SkippedRow("Aynı adla açık kart var");""",
                """if (duplicate === "same" || cards.length) throw new SkippedRow("Aynı adla açık kart var");"""),
}
dosya, eski, yeni = M[ad]
p = os.path.join(kok, dosya)
t = open(p, encoding="utf-8").read()
assert t.count(eski) == 1, (ad, t.count(eski))
open(p, "w", encoding="utf-8").write(t.replace(eski, yeni))
print(ad, "uygulandı:", dosya)
