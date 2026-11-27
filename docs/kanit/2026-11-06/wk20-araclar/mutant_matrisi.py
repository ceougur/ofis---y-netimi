"""WK 20 mutant matrisi: güncelleme 20'nin mutantları (M278–M292) + anlamı genişleyen M263 / M264 — her biri hangi senaryolarda DEĞERLE (elle beklenen) ya da iç
denetim sayacıyla yakalanıyor; istisnayla yakalanma ayrı sayılır. Kullanım: python3 -I mutant_matrisi.py <kahin klasörü> [tum]
  (tum yoksa yalnız yeni + değişen 11 senaryo; tum: bütün senaryolar). TAP: her mutant ≥ 1 senaryoda değerle yakalanmalı."""
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402
import kahin_test  # noqa: E402

MUT = ["M263", "M264"] + [f"M{i}" for i in range(278, 293)]
ONEK = ("S70-", "S71-", "R3T-", "SW3-03", "S61-02")
tum = len(sys.argv) > 2 and sys.argv[2] == "tum"
sen = [s for s in senaryolar.tum_senaryolar() if tum or s["ad"].startswith(ONEK)]
ok = bad = 0
for n, m in enumerate(MUT, 1):
    deger, istisna = [], []
    for s in sen:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
        except Exception as e:  # noqa: BLE001
            istisna.append(f"{s['ad'][:14]}({type(e).__name__})")
            continue
        f = senaryolar.elle_denetle(s, b)
        if not f:
            for g in b:
                f = [x for x in kahin_test.degismez_denetle(s["ad"], g["sonuc"]) if not any(kahin_test.ihlal_bildirili(s, k, x) for k in g["secimler"])]
                if f:
                    break
        if f:
            deger.append(s["ad"][:14])
    durum = "ok" if deger else "not ok"
    ok += bool(deger); bad += not deger
    print(f"{durum} {n} - {m}: değerle {len(deger)} senaryo {deger}; istisnayla {len(istisna)} {istisna[:5]}")
print(f"1..{ok + bad}")
for ad, k in (("tests", ok + bad), ("pass", ok), ("fail", bad), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {k}")
sys.exit(0 if bad == 0 else 1)
