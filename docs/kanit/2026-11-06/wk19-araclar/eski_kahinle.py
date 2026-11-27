# WK 19: yeni / değişen senaryolar ESKİ kâhinle (ham ya da nötr kopya) — beklenen sonuç ÖNCEDEN yazıldı (BEKLE); TAP + özet.
# Kullanım: python3 -I eski_kahinle.py <eski kahin.py> <yeni senaryolar.py> <yeni senaryolar.json> <ham|notr>
import importlib.util, json, sys
sys.dont_write_bytecode = True
eski_kahin, yeni_sen, yeni_json, kip = sys.argv[1:5]


def yukle(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    sys.modules[ad] = m
    spec.loader.exec_module(m)
    return m


kahin = yukle("kahin", eski_kahin)
senaryolar = yukle("senaryolar", yeni_sen)
yeni = {s["ad"]: s for s in json.load(open(yeni_json, encoding="utf-8"))["senaryolar"]}
DEGISEN = ("S30-01", "S35-01", "S37-01", "S42-03")
ONEK = ("S58-", "S59-", "S60-", "S61-", "S62-", "S63-") + DEGISEN
# önceden yazılmış beklenti: (kip → önek → sınıf); sınıf: "deger" (elle / tam sonuç değerle KIRMIZI), "istisna:<parça>", "ayni"
BEKLE = {
    "ham": {"S58-": "istisna:bilinmeyen olay: yol_degisti", "S59-": "deger", "S60-": "deger", "S61-": "deger", "S62-": "ayni",
            "S63-": "istisna:bilinmeyen olay: kanca_kaydi", "S30-01": "deger", "S35-01": "deger", "S37-01": "deger", "S42-03": "deger"},
    "notr": {"S58-": "deger", "S59-": "deger", "S60-": "deger", "S61-": "deger", "S62-": "ayni",
             "S63-": "deger", "S30-01": "deger", "S35-01": "deger", "S37-01": "deger", "S42-03": "deger"},
}[kip]


def m(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


satir = []; gecen = kalan = 0
for s in senaryolar.tum_senaryolar():
    on = next((o for o in ONEK if s["ad"].startswith(o)), None)
    if on is None:
        continue
    bek = BEKLE[on]
    if s["ad"].startswith("S62-01"):
        bek = "deger"          # S62 hesabı eski kâhinle AYNI; S62-01 K3 medya_silme 3 ise S60'tan (D talep anında Atlandı, PDF bakım turunda) — eski kâhinde 2
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
        elle = senaryolar.elle_denetle(s, b)
        tam = m(b) != m(yeni[s["ad"]]["beklenen"])
        if elle:
            sonuc, neden = "deger", "elle: " + elle[0][:200]
        elif tam and s["ad"].startswith(DEGISEN):
            sonuc, neden = "deger", "tam sonuç farklı (elle aynı — yalnız elle dışı yaprak değişti)"
        else:
            sonuc, neden = "ayni", ("tam sonuç da aynı" if not tam else "elle aynı, tam sonuç farklı")
    except Exception as e:
        sonuc, neden = f"istisna:{e}", f"{type(e).__name__}: {str(e)[:160]}"
    ok = sonuc == bek or (bek.startswith("istisna:") and sonuc.startswith("istisna:") and bek[8:] in sonuc)
    gecen += ok; kalan += not ok
    satir.append(f"{'ok' if ok else 'not ok'} {gecen + kalan} - [{kip}] {s['ad']}: {'KIRMIZI (değerle)' if sonuc == 'deger' else ('KIRMIZI (istisna)' if sonuc.startswith('istisna') else 'AYNI')} — beklenen {bek}")
    satir.append(f"  # {neden}")
print("\n".join(satir))
print(f"1..{gecen + kalan}")
for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {n}")
sys.exit(0 if kalan == 0 else 1)
