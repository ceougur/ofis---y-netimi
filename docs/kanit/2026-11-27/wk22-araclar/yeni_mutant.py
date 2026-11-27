#!/usr/bin/env python3
# WK 22: yeni mutantlar (M317–M325) — her biri kendi SW21 senaryosunda DEĞERLE (istisnasız) yakalanmalı; ayrıca hangi yeni / değişen senaryoların yakaladığı dökülür.
# Kullanım (depo kökünden): python3 -I <bu dosya> test/bagimsiz/whatsapp-248/kahin
import sys
import os

kok = os.path.abspath(sys.argv[1])
sys.path.insert(0, kok)
import kahin       # noqa: E402
import senaryolar  # noqa: E402

KENDI = {
    "M317": "SW21-01", "M318": "SW21-03", "M319": "SW21-03", "M320": "SW21-04", "M321": "SW21-02",
    "M322": "SW21-04", "M323": "SW21-02", "M324": "SW21-05", "M325": "SW21-01",
}
TUM = senaryolar.tum_senaryolar()
ilgili = [s for s in TUM if s["baslik"] == "SW21" or s["ad"].startswith(("S23-04", "S29-03"))]
kirmizi = 0
for mut in sorted(KENDI):
    if mut not in kahin.MUTASYONLAR:
        print(f"not ok {mut}: MUTASYONLAR'da yok"); continue
    yakalayan = []
    kendi_deger = False
    for s in ilgili:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([mut]))
        except Exception as e:
            yakalayan.append(f"{s['ad'][:8]}(istisna {type(e).__name__})")
            continue
        f = senaryolar.elle_denetle(s, b)
        if f:
            yakalayan.append(s["ad"][:8])
            if s["ad"].startswith(KENDI[mut]):
                kendi_deger = True
                ilk = f[0][:220]
    if kendi_deger:
        kirmizi += 1
        print(f"ok {mut} kendi senaryosu {KENDI[mut]} DEĞERLE: {ilk}")
    else:
        print(f"not ok {mut}: kendi senaryosu {KENDI[mut]} değerle yakalamadı")
    print(f"#   {mut} ({kahin.MUTASYONLAR[mut][:90]}…) ← {', '.join(yakalayan) or 'YOK'}")
print(f"# tests {len(KENDI)}\n# pass {kirmizi}\n# fail {len(KENDI) - kirmizi}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if kirmizi == len(KENDI) else 1)
