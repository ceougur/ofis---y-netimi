#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 5 (cari; S95 / S96 / S97 / S98) — eski kâhin (bakım 4, 14e3f4bb kopyası) ↔ yeni kâhin karşılaştırması. Program AÇILMAZ; yalnız iki model.py koşar.
(Bakım 4'ün kahineski4-arac/karsilastir.py düzeni; G3 sınıfları bakım 5'e göre.)

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi.
2. EŞDEĞERLİK: ESKİ kopyadaki bütün elle senaryolar + rastgele senaryolar × kipler (2.4.9, 2.4.6, 2.4.5, --legacy): iki modelin çıktısı (ya da hatası) bayt bayt aynı.
3. G3: kural seti 2.5.0'da değişen eski beklentiler (eski kopyanın elle senaryoları + rastgele) — her değişen / kalkan / yeni denetim, o KONTROL anındaki iki modelin izinden sınıflanır:
   S96-kalem (Ödeme avansının takvim / Vade Takip / projeksiyon kalemi — Y5-6) · S96-gorunum (avanslı carinin görünüm toplamı artık yazılıyor) · geri-kazanilan (bakım 4'te okumalar
   ayrıştığı için tanımsız olan caride artık değer) · S95-S97-S98 (karşı yönlü kalemli caride değer değişti — Y5-1) · S98-tek (karşı yönlü kalemsiz yalın caride S98 ile değişti) ·
   SK-9-12 (yeni okumalar ayrışıyor — kalktı) · SK-13 (faturanın belge durumu — kalktı) · Y5-7 (yalın olmayan caride S98 kurulamıyor — kalktı) · sayac (türev sayaç; aynı kontrolde
   sınıflanmış kalem değişikliği, belirsiz üye ya da tanımsız cari) · BEKLENMEYEN (hiçbiri — 0 olmalı).
Çıkış 0 yalnız: üretici aynı + eşdeğerlik tam + BEKLENMEYEN 0. Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
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


def yukle_modul(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ME, MY = yukle_modul(ESKI, "kahin_cari_eski"), yukle_modul(YENI, "kahin_cari_yeni")
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

# ── 2. eşdeğerlik (eski kural setleri)
elle = []
d = os.path.join(ESKI, "senaryolar")
for f in sorted(os.listdir(d)):
    if f.endswith(".json"):
        with open(os.path.join(d, f), encoding="utf-8") as g:
            elle.append((f[:-5], json.load(g)))
esdeger = 0
toplam_esdeger = 0
for ad, sen in elle + rastgele:
    for kural in ("2.4.9", "2.4.6", "2.4.5", "2.4.4"):
        toplam_esdeger += 1
        a, b = kos(ME, sen, kural), kos(MY, sen, kural)
        denetle("eşdeğerlik %s [%s]" % (ad, "legacy" if kural == "2.4.4" else kural), a == b, "(çıktı farklı)")
        esdeger += a == b
print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy; %d elle + %d rastgele senaryo × 4 kip): %d/%d bayt bayt aynı" % (len(elle), len(rastgele), esdeger, toplam_esdeger))


# ── 3. G3 (2.5.0): kontrol anındaki iki modelin izi
IZLER = {}  # örnek kimliği → {kontrol: iz} — modelin DIŞINDA (yedek_geri_yukle __dict__'i yedekten geri yazar; iz orada tutulursa geri yüklemeden önceki kontrollerin izi silinir)


def iz_sinifi(Taban):
    class Iz(Taban):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw)
            IZLER[id(self)] = {}

        @property
        def izler(self):
            return IZLER[id(self)]

        def kontrol(self, a):
            super().kontrol(a)
            cari = {}
            for cad, c in self.cariler.items():
                if c.get("silindi"):
                    continue
                nd = self.net_durum(cad)
                odeme = any(o["aktif"] and o["cari"] == cad for o in self.odemeler.values()) or any(e["durum"] == "ciro" and e["ciroCari"] == cad for e in self.evraklar.values())
                bt = self.belge_tanimsiz(cad) if hasattr(self, "belge_tanimsiz") else None
                cari[cad] = {"nd": nd[0], "neden": nd[1] if nd[0] == "tanimsiz" else (nd[1].get("kaynak") if nd[0] == "net" else None), "yalin": self._net_uygun(cad)[0],
                             "capraz": self._capraz250(cad), "odeme": odeme, "belge": bt, "t250": bool(self.tyk250(cad)["neden"])}
            hareket = {hn: {"cari": h["cari"], "tur": h["tur"]} for hn, h in self.hareketler.items()}
            fatura = {fad: f["cari"] for fad, f in self.faturalar.items()}
            self.izler[a["id"]] = {"cari": cari, "hareket": hareket, "fatura": fatura}
    return Iz


IzE, IzY = iz_sinifi(ME.Model), iz_sinifi(MY.Model)


def sinifla(anahtar, ize, izy, eski, yeni, kontrolde_degisen):
    p = anahtar.split(":")
    k = p[0]
    ze, zy = ize.get(k), izy.get(k)
    if ze is None or zy is None:
        return "BEKLENMEYEN"
    kalkan, yeni_d = yeni is YOK, eski is YOK

    def cari_sinifi(cad):
        ce, cy = ze["cari"].get(cad), zy["cari"].get(cad)
        if ce is None or cy is None:
            return None
        if kalkan:
            if cy["nd"] == "tanimsiz":
                return "Y5-7" if "S98 tek taraflı" in (cy["neden"] or "") else ("SK-9-12" if "SK-9" in (cy["neden"] or "") else None)
            return None
        if yeni_d and ce["nd"] == "tanimsiz" and cy["nd"] != "tanimsiz":
            return "geri-kazanilan"
        if cy["nd"] == "net" and cy["capraz"]:
            return "S95-S97-S98"
        if cy["nd"] == "net" and cy["neden"] == "S98":
            return "S98-tek"
        return None

    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        h = zy["hareket"].get(":".join(p[3:]))
        if not h:
            return "BEKLENMEYEN"
        if h["tur"] == "odeme" and yeni_d:
            return "S96-kalem"
        return cari_sinifi(h["cari"]) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] == "hareket" and p[-1] == "kalan":
        h = zy["hareket"].get(":".join(p[2:-1]))
        return (cari_sinifi(h["cari"]) if h else None) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "fatura":
        cad = zy["fatura"].get(":".join(p[3:]))
        cy = zy["cari"].get(cad)
        if yeni_d and p[1] != "takvim" and cy and cy["odeme"] and cy["nd"] != "tanimsiz":
            return "S96-gorunum"  # görünüm toplamı yazılan (avanslı) carinin fatura kalemi (kontrol_gorunum)
        return cari_sinifi(cad) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] == "fatura" and p[-1] == "acik":
        cad = zy["fatura"].get(":".join(p[2:-1]))
        cy = zy["cari"].get(cad)
        if kalkan and cy and cy["belge"]:
            return "Y5-7" if "S98 tek taraflı" in cy["belge"] else "SK-13"
        return "BEKLENMEYEN"
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "cariToplam":
        cad = ":".join(p[3:])
        cy = zy["cari"].get(cad)
        if yeni_d and cy and cy["odeme"] and cy["nd"] != "tanimsiz":
            return "S96-gorunum"
        return cari_sinifi(cad) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] == "cari" and p[-1] in ("acikToplam", "acikEsitBakiye", "gecikmis"):
        cad = ":".join(p[2:-1])
        cy = zy["cari"].get(cad)
        if kalkan and cy and cy["belge"] and p[-1] != "gecikmis":
            return "Y5-7" if "S98 tek taraflı" in cy["belge"] else "SK-13"
        return cari_sinifi(cad) or "BEKLENMEYEN"
    if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
        catal_e = isinstance(eski, dict) and "catal" in eski
        tanimsiz_odeme = any(c["nd"] == "tanimsiz" or c["t250"] for c in zy["cari"].values() if c["odeme"])
        odeme_var = any(c["odeme"] for c in zy["cari"].values())
        return "sayac" if (kontrolde_degisen.get(k) or catal_e or odeme_var or (kalkan and tanimsiz_odeme)) else "BEKLENMEYEN"
    return "BEKLENMEYEN"


YOK = object()
g3 = defaultdict(Counter)
ornek = defaultdict(list)
dokum = []
toplam_eski = toplam_yeni = 0
etiket_degisen = 0


def js(x):
    return "(denetim yok)" if x is YOK else x


for ad, sen in elle + rastgele:
    try:
        me = IzE(json.loads(json.dumps(sen)), 0, "2.5.0")
        e = me.kos()["denetimler"]
    except SystemExit:
        e = None
    try:
        my = IzY(json.loads(json.dumps(sen)), 0, "2.5.0")
        y = my.kos()["denetimler"]
    except SystemExit:
        y = None
    if e is None or y is None:
        denetle("G3 %s iki modelde de aynı biçimde koşuyor" % ad, e is None and y is None)
        continue
    toplam_eski += len(e)
    toplam_yeni += len(y)
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
        if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
            continue
        s = sinifla(anahtar, me.izler, my.izler, eb, yb, {})
        if s != "BEKLENMEYEN":
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append((anahtar, eb, yb, s))
    for anahtar, eb, yb in farklar:
        if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
            sonuc.append((anahtar, eb, yb, sinifla(anahtar, me.izler, my.izler, eb, yb, kontrolde)))
    for anahtar, eb, yb, s in sonuc:
        tur = "kalkan" if yb is YOK else ("yeni" if eb is YOK else "degisen")
        g3[ad][(s, tur)] += 1
        dokum.append({"senaryo": ad, "anahtar": anahtar, "eski": js(eb), "yeni": js(yb), "sinif": s, "tur": tur})
        if len(ornek[(s, tur)]) < 4:
            ornek[(s, tur)].append("%s %s: %s → %s" % (ad, anahtar, json.dumps(js(eb), ensure_ascii=False)[:110], json.dumps(js(yb), ensure_ascii=False)[:110]))

genel = Counter()
for ad, c in g3.items():
    for kt, n in c.items():
        genel[kt] += n
beklenmeyen = sum(n for (s, _t), n in genel.items() if s == "BEKLENMEYEN")
print("G3 (kural 2.5.0; %d senaryo): eski %d denetim · yeni %d denetim · değişen / kalkan / yeni toplam %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
      % (len(elle) + len(rastgele), toplam_eski, toplam_yeni, sum(genel.values()), beklenmeyen, etiket_degisen))
for (s, t), n in sorted(genel.items()):
    print("  %-16s %-8s %5d" % (s, t, n))
    for o in ornek[(s, t)]:
        print("      örn. %s" % o)
print("G3 senaryo senaryo (sınıf/tür: adet):")
for ad in sorted(g3):
    print("  %-40s %s" % (ad, " · ".join("%s/%s %d" % (s, t, n) for (s, t), n in sorted(g3[ad].items()))))
denetle("G3 BEKLENMEYEN 0", beklenmeyen == 0, "%d beklenmeyen değişiklik" % beklenmeyen)
for x in dokum:
    if x["sinif"] == "BEKLENMEYEN":
        satirlar.append("    BEKLENMEYEN %s %s: %s → %s" % (x["senaryo"], x["anahtar"], json.dumps(x["eski"], ensure_ascii=False)[:160], json.dumps(x["yeni"], ensure_ascii=False)[:160]))
if DOKUM:
    with open(DOKUM, "w", encoding="utf-8") as f:
        json.dump({"ozet": {"%s/%s" % k: v for k, v in sorted(genel.items())}, "senaryo": {ad: {"%s/%s" % k: v for k, v in sorted(c.items())} for ad, c in sorted(g3.items())},
                   "dokum": dokum}, f, ensure_ascii=False, indent=1)
if satirlar:
    print("BAŞARISIZ:")
    print("\n".join(satirlar[:120]))
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
