"""Bakım 13 G3 + mutant taraması: eski kâhin (eski senaryolar) ↔ yeni kâhin (yeni senaryolar), her senaryo × kural × mutant (0, 1–39).
Kullanım: python3 -I -B g3.py <eski defter klasörü> <yeni defter klasörü>"""
import importlib.util
import json
import os
import sys

ESKI, YENI = sys.argv[1], sys.argv[2]


def modul(d, ad):
    s = importlib.util.spec_from_file_location(ad, os.path.join(d, "kahin.py"))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


KE, KY = modul(ESKI, "kahin_eski"), modul(YENI, "kahin_yeni")


def dosyalar(d):
    out = ["senaryo.json"]
    out += ["senaryolar/" + f for f in sorted(os.listdir(os.path.join(d, "senaryolar"))) if f.endswith(".json")]
    return out


def yukle(d, f):
    p = os.path.join(d, f)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def kos(K, sen, mut, kural):
    try:
        o = K.hesapla(sen, None, mut, kural)
        o.pop("mutasyon", None)
        return o
    except SystemExit as e:
        return {"__cokme__": str(e)}


def duz(o, yol=""):
    if isinstance(o, dict):
        r = {}
        for k, v in o.items():
            r.update(duz(v, yol + "/" + str(k)))
        return r
    return {yol: o}


def fark(a, b):
    da, db = duz(a), duz(b)
    return sorted((k, da.get(k), db.get(k)) for k in set(da) | set(db) if da.get(k) != db.get(k))


DAR = len(sys.argv) > 3 and sys.argv[3] == "dar"  # dar: yalnız mutasyonsuz (kilitsiz küçük koşu); tam: 0–39
MUTLAR = [0] if DAR else [0] + list(range(1, 40))
toplam = ayni = 0
farklar = {}
for f in sorted(set(dosyalar(ESKI)) | set(dosyalar(YENI))):
    se, sy = yukle(ESKI, f), yukle(YENI, f)
    for kural in ("2.5.0", "2.4.9"):
        for m in MUTLAR:
            if m == 39 and se is not None:
                pass
            a = kos(KE, se, m, kural) if se is not None else {"__yok__": True}
            b = kos(KY, sy, m, kural) if sy is not None else {"__yok__": True}
            toplam += 1
            d = fark(a, b)
            if not d:
                ayni += 1
            else:
                farklar.setdefault(f, []).append((kural, m, d))
print("G3 eski kâhin (eski senaryo) ↔ yeni kâhin (yeni senaryo): %d karşılaştırma, %d aynı, %d farklı" % (toplam, ayni, toplam - ayni))
# BEKLENEN farklar (KARARLAR.md bakım 3, elle — kâhin koşulmadan önce yazıldı): yalnız EX1'in taşınması (eski cari −(T − P), yeni cari +(T − P), cari + yaşlandırma satırı);
# yeni çiğneyen senaryolar (g9 / g9b) eskide yok. Öbür her fark BEKLENMEYEN.
BEKLENEN_YOL = {
    "senaryo.json": {"/cari/Ahmet Yılmaz": (560000, 110000), "/cari/Excel Kart Müşterisi Ltd.": (None, 450000),
                     "/yaslandirma/cariler/Ahmet Yılmaz": (560000, 110000), "/yaslandirma/cariler/Excel Kart Müşterisi Ltd.": (None, 450000)},
    "senaryolar/g4-yeni-kayitlar.json": {"/cari/Elle Alfa Ltd.": (230000, 170000), "/cari/Elle Excel Müşterisi Ltd.": (None, 60000),
                                         "/yaslandirma/cariler/Elle Alfa Ltd.": (230000, 170000), "/yaslandirma/cariler/Elle Excel Müşterisi Ltd.": (None, 60000)},
}
YENI_DOSYA = {"senaryolar/g9-ok1-acik-taksitli-fatura.json", "senaryolar/g9b-ok1-acik-excel-karti.json"}
beklenmeyen = []
for f, lst in farklar.items():
    if f in YENI_DOSYA:
        continue
    for kural, m, d in lst:
        for k, x, y in d:
            bek = BEKLENEN_YOL.get(f, {}).get(k)
            # her koşuda (mutant dahil) yalnız taşınmanın FARKI beklenir: yeni − eski = elle Δ (eski cari −(T − P), yeni cari +(T − P))
            ok = (bek is not None and isinstance(x, (int, type(None))) and isinstance(y, (int, type(None)))
                  and (y or 0) - (x or 0) == (bek[1] or 0) - (bek[0] or 0))
            if not ok:
                beklenmeyen.append((f, kural, m, k, x, y))
print("BEKLENMEYEN fark: %d" % len(beklenmeyen))
for b in beklenmeyen[:40]:
    print("   ", b)
print("# tests %d" % toplam)
print("# pass %d" % (toplam - len({(b[0], b[1], b[2]) for b in beklenmeyen})))
print("# fail %d" % len({(b[0], b[1], b[2]) for b in beklenmeyen}))
for f, lst in farklar.items():
    imzalar = {}
    for kural, m, d in lst:
        imzalar.setdefault(json.dumps(d, ensure_ascii=False), []).append("%s/m%d" % (kural, m))
    print("== %s: %d farklı koşu, %d ayrı fark imzası" % (f, len(lst), len(imzalar)))
    for imza, kim in imzalar.items():
        print("   koşular (%d): %s" % (len(kim), " ".join(kim)))
        for k, x, y in json.loads(imza):
            print("      %s: eski %s → yeni %s" % (k, json.dumps(x, ensure_ascii=False)[:160], json.dumps(y, ensure_ascii=False)[:160]))

# Yeni kâhin ESKİ senaryolarda: yalnız kod değişikliğinin etkisi (senaryo.json beklenen nedenle çökmeli; öbürleri bayt bayt aynı)
print("\nKOD ETKİSİ — eski senaryolar, eski kâhin ↔ yeni kâhin:")
for f in dosyalar(ESKI):
    se = yukle(ESKI, f)
    say = dif = 0
    ornek = None
    for kural in ("2.5.0", "2.4.9"):
        for m in ([0] if DAR else [0] + list(range(1, 39))):
            say += 1
            a, b = kos(KE, se, m, kural), kos(KY, se, m, kural)
            if fark(a, b):
                dif += 1
                ornek = ornek or (kural, m, b.get("__cokme__", "")[:140])
    print("  %s: %d koşu, %d farklı%s" % (f, say, dif, (" — örnek %s" % (ornek,)) if ornek else ""))

# Mutant 39 yeni senaryolarda: ön koşulu çiğnemeyen senaryoda etkisiz olmalı
print("\nMUTANT 39 (yeni senaryolar, 2.5.0): taban ↔ m39")
for f in dosyalar(YENI):
    sy = yukle(YENI, f)
    a, b = kos(KY, sy, 0, "2.5.0"), kos(KY, sy, 39, "2.5.0")
    print("  %s: %s" % (f, "AYNI" if not fark(a, b) else "FARKLI (taban %s · m39 %s)" % (a.get("__cokme__", "sayı")[:60], b.get("__cokme__", "sayı")[:60])))

# EX1 kuralının mutantları (14, 21) taşınan olayla DEĞERLE mi yakalanıyor — yeni cari satırları
print("\nEX1 KURALI MUTANTLARI (yeni senaryolar, 2.5.0): taban ↔ mutant farkı")
for f, ad in (("senaryo.json", "Excel Kart Müşterisi Ltd."), ("senaryolar/g4-yeni-kayitlar.json", "Elle Excel Müşterisi Ltd.")):
    sy = yukle(YENI, f)
    for m in (14, 21):
        a, b = kos(KY, sy, 0, "2.5.0"), kos(KY, sy, m, "2.5.0")
        d = fark(a, b)
        coktu = "__cokme__" in b
        print("  %s m%d: %s, %d fark%s" % (f, m, "ÇÖKTÜ" if coktu else "değerle", len(d), ""))
        for k, x, y in d:
            if m == 21 or "519" in k or "500" in k:
                print("      %s: taban %s → mutant %s" % (k, x, y))
    a, b = kos(KY, sy, 0, "2.5.0"), kos(KY, sy, 21, "2.5.0")
    print("  %s: yeni cari '%s' taban cari %s · yaşlandırma %s" % (f, ad, a["cari"].get(ad), a["yaslandirma"]["cariler"].get(ad)))
