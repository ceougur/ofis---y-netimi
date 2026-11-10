#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari; G1 senaryo düzeni + G2 satışla açılan kart / elle Mevcut Borç kartının reddi) — eski kâhin (bakım 6, a0d8342a kopyası) ↔ yeni kâhin. Program AÇILMAZ; yalnız iki
model.py koşar. (Bakım 6'nın kahineski6-arac/karsilastir.py düzeni; G3 sınıfları bakım 7'ye göre.)

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi.
2. ADIMLAR: eski kopyada da olan elle senaryoların adımları değişmedi — YALNIZ d27–d29 (G1: yalnız yer değişti — adım kümesi ve her carinin dizisi aynı) ve d30–d32 (G2: yeni adım türüne
   taşındı) değişebilir; başka değişen yok.
3. EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy): ESKİ kopyanın bütün elle senaryoları + yeni kopyanın yeni adım türünü KULLANMAYAN bütün elle senaryoları (yer değişen d27–d29 dahil) + rastgele
   senaryolar — iki modelin çıktısı (ya da hatası) bayt bayt aynı. (Yeni adım türü eski kâhinde yok — o dosyalar bu karşılaştırmanın dışında; eski hâlleri içeride.)
4. G3 (2.5.0): ESKİ kopyanın elle senaryoları + rastgele — her değişen / kalkan / yeni denetim sınıflanır: G2b (yeni kâhinin REDDETTİĞİ ya da SUSTUĞU (SK-18) elle Mevcut Borç kartının
   carisi, kartı, adımları ve o karta yazılan kart tahsilatı) · G2b-genel (aynı kontrolde G2b değişikliği varken Kasa / sayaç gibi cari dışı anahtar) · BEKLENMEYEN (hiçbiri — 0 olmalı).
   d27–d29 için değişen / kalkan / yeni 0 olmalı.
Çıkış 0 yalnız: üretici aynı + adımlar beklendiği gibi + eşdeğerlik tam + BEKLENMEYEN 0 + d27–d29'da fark 0. Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict


def arg(ad, vars_=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else vars_


ESKI, YENI = os.path.abspath(arg("--eski")), os.path.abspath(arg("--yeni"))
TOHUM, ISLEM = int(arg("--tohum", "10")), int(arg("--islem", "120"))
DOKUM = arg("--dokum")
G1_SENARYO = {"d27-c5-s99-taksitli-avans", "d28-c5-s99-taksit-vade-gunu", "d29-c5-s99-taksit-ertesi-gun"}
G2_SENARYO = {"d30-c5-s101-bitti-kart", "d31-c5-s101-taksit-vade-gunu", "d32-c5-s101-taksit-ertesi-gun"}


def yukle_modul(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ME, MY = yukle_modul(ESKI, "kahin_cari_eski7"), yukle_modul(YENI, "kahin_cari_yeni7")
gecen = kalan = 0
satirlar = []


def denetle(ad, ok, ayrinti=""):
    global gecen, kalan
    if ok:
        gecen += 1
    else:
        kalan += 1
        satirlar.append("  ✗ %s %s" % (ad, ayrinti))


def uret(klasor, tur, tohum):
    return subprocess.run([sys.executable, "-I", os.path.join(klasor, "uretici.py"), "--tur", tur, "--tohum", str(tohum), "--islem", str(ISLEM)], capture_output=True, check=True).stdout


def kos(M, sen, kural):
    try:
        return json.dumps(M.Model(json.loads(json.dumps(sen)), 0, kural).kos(), ensure_ascii=False, sort_keys=True)
    except SystemExit as e:
        return "SystemExit: %s" % e
    except Exception as e:  # noqa: BLE001 — iki modelin aynı hatayı vermesi de eşdeğerliktir
        return "%s: %s" % (type(e).__name__, e)


def elle_oku(klasor):
    out = []
    d = os.path.join(klasor, "senaryolar")
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            with open(os.path.join(d, f), encoding="utf-8") as g:
                out.append((f[:-5], json.load(g)))
    return out


def yeni_adimli(sen):
    return any(a["islem"] == "stok_satis_taksit" for a in sen["adimlar"])


def cari_dizisi(sen):
    fc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    d = {}
    for a in sen["adimlar"]:
        c = a.get("cari") or (a["ad"] if a["islem"] == "cari_ac" else None) or fc.get(a.get("fatura")) or kc.get(a.get("kayit")) or "<genel>"
        d.setdefault(c, []).append(json.dumps(a, sort_keys=True, ensure_ascii=False))
    return d


# ── 1. üretici
rastgele = []
ayni_dizi = 0
for tur in ("s1", "ux18"):
    for t in range(1, TOHUM + 1):
        e, y = uret(ESKI, tur, t), uret(YENI, tur, t)
        denetle("üretici %s tohum %d aynı dizi" % (tur, t), e == y)
        ayni_dizi += e == y
        rastgele.append(("rastgele-%s-%d" % (tur, t), json.loads(y)))
print("ÜRETİCİ: %d/%d aynı dizi (tur s1 + ux18, tohum 1–%d × %d işlem)" % (ayni_dizi, 2 * TOHUM, TOHUM, ISLEM))

# ── 2. adımlar
elle_eski, elle_yeni = elle_oku(ESKI), elle_oku(YENI)
eski_sen = dict(elle_eski)
degisen = []
for ad, s in elle_yeni:
    if ad not in eski_sen:
        continue
    if s["adimlar"] == eski_sen[ad]["adimlar"]:
        gecen += 1
        continue
    degisen.append(ad)
    if ad in G1_SENARYO:
        denetle("G1 %s: yalnız yer değişti (her carinin dizisi aynı)" % ad, cari_dizisi(s) == cari_dizisi(eski_sen[ad]) and
                sorted(json.dumps(a, sort_keys=True) for a in s["adimlar"]) == sorted(json.dumps(a, sort_keys=True) for a in eski_sen[ad]["adimlar"]))
    else:
        denetle("adımları değişen senaryo beklenen kümede: %s" % ad, ad in G2_SENARYO)
print("ADIMLAR: eski kopyadaki %d elle senaryonun %d'inin adımları değişti: %s (G1: yer; G2: yeni adım türü)" % (len(elle_eski), len(degisen), ", ".join(degisen)))

# ── 3. eşdeğerlik (eski kural setleri)
kume = [("eski:" + ad, s) for ad, s in elle_eski] + [("yeni:" + ad, s) for ad, s in elle_yeni if not yeni_adimli(s)] + rastgele
disarida = [ad for ad, s in elle_yeni if yeni_adimli(s)]
esdeger = toplam_esdeger = 0
for ad, sen in kume:
    for kural in ("2.4.9", "2.4.6", "2.4.5", "2.4.4"):
        toplam_esdeger += 1
        a, b = kos(ME, sen, kural), kos(MY, sen, kural)
        denetle("eşdeğerlik %s [%s]" % (ad, "legacy" if kural == "2.4.4" else kural), a == b, "(çıktı farklı)")
        esdeger += a == b
print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy; eski kopyanın %d elle + yeni kopyanın yeni adımsız %d elle + %d rastgele senaryo × 4 kip): %d/%d bayt bayt aynı · dışarıda (yeni adım türü): %s"
      % (len(elle_eski), len(kume) - len(elle_eski) - len(rastgele), len(rastgele), esdeger, toplam_esdeger, ", ".join(disarida)))

# ── 4. G3 (2.5.0)
YOK = object()
GENEL = ("kasa", "kasaRapor", "nakit", "mizan", "takvim:cariKalemSayisi", "projeksiyon:cari", "rapor")


def g2b_carileri(sen, out):
    """Yeni kâhinin reddettiği (C19 Y7-3) ya da durumunu yazmadığı (SK-18) elle kart_ac adımlarının carileri ve kartları."""
    cariler, kartlar = set(), set()
    for a in sen["adimlar"]:
        if a["islem"] != "kart_ac":
            continue
        d = out.get("adim:%s:durum" % a["id"])
        if (d and d["b"] == "ret" and "C19 Y7-3" in d["k"]) or d is None:
            cariler.add(a["cari"])
            kartlar.add(a["ad"])
    return cariler, kartlar


def cari_of(anahtar, sen):
    p = anahtar.split(":")
    adim = {a["id"]: a for a in sen["adimlar"]}
    fc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    if p[0] == "adim" and len(p) >= 3:
        a = adim.get(p[1], {})
        return a.get("cari") or (a.get("ad") if a.get("islem") == "cari_ac" else None) or kc.get(a.get("kayit"))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        return adim.get(":".join(p[3:]), {}).get("cari")
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "fatura":
        return fc.get(":".join(p[3:]))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "cariToplam":
        return ":".join(p[3:])
    if len(p) >= 4 and p[1] == "hareket":
        return adim.get(":".join(p[2:-1]), {}).get("cari")
    if len(p) >= 4 and p[1] == "fatura":
        return fc.get(":".join(p[2:-1]))
    if len(p) >= 4 and p[1] == "cari":
        return ":".join(p[2:-1])
    if len(p) >= 4 and p[1] == "kart":
        return kc.get(p[2])
    return None


g3 = defaultdict(Counter)
ornek = defaultdict(list)
dokum = []
toplam_eski = toplam_yeni = 0
etiket_degisen = 0


def js(x):
    return "(denetim yok)" if x is YOK else x


for ad, sen in elle_eski + rastgele:
    try:
        e = ME.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        e = None
    try:
        y = MY.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        y = None
    if e is None or y is None:
        denetle("G3 %s iki modelde de aynı biçimde koşuyor" % ad, e is None and y is None)
        continue
    toplam_eski += len(e)
    toplam_yeni += len(y)
    g2c, _g2k = g2b_carileri(sen, y)
    farklar = []
    for anahtar in sorted(set(e) | set(y)):
        eb = e[anahtar]["b"] if anahtar in e else YOK
        yb = y[anahtar]["b"] if anahtar in y else YOK
        if eb is not YOK and yb is not YOK and eb == yb:
            etiket_degisen += e[anahtar]["e"] != y[anahtar]["e"]
            continue
        farklar.append((anahtar, eb, yb))
    kontrolde = Counter()
    sonuc = []
    for anahtar, eb, yb in farklar:
        c = cari_of(anahtar, sen)
        s = "G2b" if c is not None and c in g2c else None
        if s:
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append([anahtar, eb, yb, s])
    for x in sonuc:
        if x[3] is None:
            genel = cari_of(x[0], sen) is None and any((":%s" % g) in x[0] for g in GENEL)
            k_ = x[0].split(":")[0]
            x[3] = "G2b-genel" if (genel and kontrolde.get(k_)) else "BEKLENMEYEN"
    for anahtar, eb, yb, s in sonuc:
        tur = "kalkan" if yb is YOK else ("yeni" if eb is YOK else "degisen")
        g3[ad][(s, tur)] += 1
        dokum.append({"senaryo": ad, "anahtar": anahtar, "eski": js(eb), "yeni": js(yb), "sinif": s, "tur": tur})
        if len(ornek[(s, tur)]) < 4:
            ornek[(s, tur)].append("%s %s: %s → %s" % (ad, anahtar, json.dumps(js(eb), ensure_ascii=False)[:110], json.dumps(js(yb), ensure_ascii=False)[:110]))
    if ad in G1_SENARYO:
        denetle("G3 %s (eski dosya) yeni kâhinde fark 0" % ad, not sonuc, "%d fark" % len(sonuc))

genel = Counter()
for ad, c in g3.items():
    for kt, n in c.items():
        genel[kt] += n
beklenmeyen = sum(n for (s, _t), n in genel.items() if s == "BEKLENMEYEN")
print("G3 (kural 2.5.0; %d senaryo — eski kopyanın %d elle senaryosu + %d rastgele): eski %d denetim · yeni %d denetim · değişen / kalkan / yeni toplam %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
      % (len(elle_eski) + len(rastgele), len(elle_eski), len(rastgele), toplam_eski, toplam_yeni, sum(genel.values()), beklenmeyen, etiket_degisen))
for (s, t), n in sorted(genel.items()):
    print("  %-14s %-8s %5d" % (s, t, n))
    for o in ornek[(s, t)]:
        print("      örn. %s" % o)
print("G3 senaryo senaryo (sınıf/tür: adet; listede olmayan senaryoda fark 0):")
for ad in sorted(g3):
    print("  %-40s %s" % (ad, " · ".join("%s/%s %d" % (s, t, n) for (s, t), n in sorted(g3[ad].items()))))
denetle("G3 BEKLENMEYEN 0", beklenmeyen == 0, "%d beklenmeyen değişiklik" % beklenmeyen)
for x in dokum:
    if x["sinif"] == "BEKLENMEYEN":
        satirlar.append("    BEKLENMEYEN %s %s: %s → %s" % (x["senaryo"], x["anahtar"], json.dumps(x["eski"], ensure_ascii=False)[:160], json.dumps(x["yeni"], ensure_ascii=False)[:160]))
if DOKUM:
    with open(DOKUM, "w", encoding="utf-8") as f:
        json.dump({"ozet": {"%s/%s" % k: v for k, v in sorted(genel.items())}, "senaryo": {ad: {"%s/%s" % k: v for k, v in sorted(c.items())} for ad, c in sorted(g3.items())},
                   "etiket_degisen": etiket_degisen, "dokum": dokum}, f, ensure_ascii=False, indent=1)
if satirlar:
    print("BAŞARISIZ:")
    print("\n".join(satirlar[:120]))
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
