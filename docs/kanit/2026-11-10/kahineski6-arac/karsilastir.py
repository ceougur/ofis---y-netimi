#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 6 (cari; S99 / S101 / S102–S105 + SK-13) — eski kâhin (bakım 5, 1ab2d1de kopyası) ↔ yeni kâhin karşılaştırması. Program AÇILMAZ; yalnız iki model.py koşar.
(Bakım 5'in kahineski5-arac/karsilastir.py düzeni; G3 sınıfları bakım 6'ya göre.)

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi.
2. EŞDEĞERLİK: YENİ kopyadaki bütün elle senaryolar (eskilerin hepsi + bakım 6'nınkiler; adımları değişmedi) + rastgele senaryolar × kipler (2.4.9, 2.4.6, 2.4.5, --legacy): iki modelin
   çıktısı (ya da hatası) bayt bayt aynı.
3. G3: kural seti 2.5.0'da değişen eski beklentiler (ESKİ kopyanın elle senaryoları + rastgele) — her değişen / kalkan / yeni denetim, o KONTROL anındaki iki modelin izinden sınıflanır:
   S102-S105 (bakım 5'te okumalar ayrıştığı için tanımsız caride artık değer — Y6-1) · SK-13←S99 (bakım 5'te belge durumu tanımsız caride artık değer — Y6-2) · S99-taksitli (taksitli
   faturalı caride Y5-7 / tanım alanı / açık toplamı — Y6-3) · S101 (bakım 5'te EK-2B 32 ile tanımsız kartlı caride artık değer — Y6-4) · SK-14 / SK-15 / SK-17 (yeni sorularla kalkan) ·
   sayac (türev sayaç; aynı kontrolde sınıflanmış değişiklik ya da tanımsız cari) · BEKLENMEYEN (hiçbiri — 0 olmalı).
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


ME, MY = yukle_modul(ESKI, "kahin_cari_eski6"), yukle_modul(YENI, "kahin_cari_yeni6")
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

# ── 2. eşdeğerlik (eski kural setleri) — yeni kopyanın bütün elle senaryoları (eskilerin süper kümesi)
elle_eski, elle_yeni = elle_oku(ESKI), elle_oku(YENI)
eski_adim = {ad: s["adimlar"] for ad, s in elle_eski}
for ad, s in elle_yeni:
    if ad in eski_adim:
        denetle("eski elle senaryonun adımları değişmedi: %s" % ad, s["adimlar"] == eski_adim[ad])
esdeger = 0
toplam_esdeger = 0
for ad, sen in elle_yeni + rastgele:
    for kural in ("2.4.9", "2.4.6", "2.4.5", "2.4.4"):
        toplam_esdeger += 1
        a, b = kos(ME, sen, kural), kos(MY, sen, kural)
        denetle("eşdeğerlik %s [%s]" % (ad, "legacy" if kural == "2.4.4" else kural), a == b, "(çıktı farklı)")
        esdeger += a == b
print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy; %d elle (%d eski + %d bakım 6) + %d rastgele senaryo × 4 kip): %d/%d bayt bayt aynı"
      % (len(elle_yeni), len(elle_eski), len(elle_yeni) - len(elle_eski), len(rastgele), esdeger, toplam_esdeger))


# ── 3. G3 (2.5.0): kontrol anındaki iki modelin izi
IZLER = {}  # örnek kimliği → {kontrol: iz} — modelin DIŞINDA (yedek_geri_yukle __dict__'i yedekten geri yazar)


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
                yalin, yneden = self._net_uygun(cad)
                cari[cad] = {"nd": nd[0], "neden": nd[1] if nd[0] == "tanimsiz" else (nd[1].get("kaynak") if nd[0] == "net" else None), "yalin": yalin, "yneden": yneden or "",
                             "belge": self.belge_tanimsiz(cad) or "", "t250": "; ".join(sorted(self.tyk250(cad)["neden"])),
                             "taksitli": any(f["cari"] == cad and f["durum"] == "kesildi" and f.get("taksitli") for f in self.faturalar.values()),
                             "kart": any(kt["aktif"] and kt["cari"] == cad and kt["mevcut"] for kt in self.kartlar.values())}
            hareket = {hn: h["cari"] for hn, h in self.hareketler.items()}
            fatura = {fad: f["cari"] for fad, f in self.faturalar.items()}
            kart = {no: kt["cari"] for no, kt in self.kartlar.items()}
            self.izler[a["id"]] = {"cari": cari, "hareket": hareket, "fatura": fatura, "kart": kart}
    return Iz


IzE, IzY = iz_sinifi(ME.Model), iz_sinifi(MY.Model)
YOK = object()


def cari_of(p, z):
    """Anahtarın carisi (izden)."""
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        return z["hareket"].get(":".join(p[3:]))
    if len(p) >= 4 and p[1] == "hareket":
        return z["hareket"].get(":".join(p[2:-1]))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "fatura":
        return z["fatura"].get(":".join(p[3:]))
    if len(p) >= 4 and p[1] == "fatura":
        return z["fatura"].get(":".join(p[2:-1]))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "cariToplam":
        return ":".join(p[3:])
    if len(p) >= 4 and p[1] == "cari":
        return ":".join(p[2:-1])
    if len(p) >= 4 and p[1] == "kart":
        return z["kart"].get(p[2])
    return None


def sinifla(anahtar, ize, izy, eski, yeni, kontrolde_degisen):
    p = anahtar.split(":")
    k = p[0]
    ze, zy = ize.get(k), izy.get(k)
    if ze is None or zy is None:
        return "BEKLENMEYEN"
    if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
        tanimsiz_e = any(c["nd"] == "tanimsiz" or c["t250"] or c["belge"] for c in ze["cari"].values())
        return "sayac" if (kontrolde_degisen.get(k) or tanimsiz_e or (isinstance(eski, dict) and "catal" in eski)) else "BEKLENMEYEN"
    cad = cari_of(p, zy)
    ce, cy = ze["cari"].get(cad), zy["cari"].get(cad)
    if ce is None or cy is None:
        return "BEKLENMEYEN"
    if yeni is YOK:  # kalkan
        for sk in ("SK-14", "SK-15", "SK-17"):
            if sk in (cy["t250"] + " " + (cy["neden"] or "") + " " + cy["belge"] + " " + cy["yneden"]):
                return sk
        return "BEKLENMEYEN"
    if eski is YOK:  # yeni
        if ce["t250"] and "EK-2B 32" in ce["t250"] and not cy["t250"] and cy["kart"]:
            return "S101"
        if ce["nd"] == "tanimsiz" and "okumalar ayrışıyor" in (ce["neden"] or "") and cy["nd"] != "tanimsiz":
            return "S102-S105"
        if ce["belge"] and "SK-13" in ce["belge"] and not cy["belge"]:
            return "SK-13←S99"
        if cy["taksitli"] and ("taksitli fatura" in ce["yneden"] or p[-1] in ("acikToplam", "acikEsitBakiye")):
            return "S99-taksitli"
        return "BEKLENMEYEN"
    # değeri değişen: yalnız kararın doğrudan değiştirdiği yerde beklenir
    if cy["taksitli"] and "taksitli fatura" in ce["yneden"]:
        return "S99-taksitli"
    return "BEKLENMEYEN"


g3 = defaultdict(Counter)
ornek = defaultdict(list)
dokum = []
toplam_eski = toplam_yeni = 0
etiket_degisen = 0
etiket_ornek = []


def js(x):
    return "(denetim yok)" if x is YOK else x


for ad, sen in elle_eski + rastgele:
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
            if e[anahtar]["e"] != y[anahtar]["e"]:
                etiket_degisen += 1
                if len(etiket_ornek) < 6:
                    etiket_ornek.append("%s %s: %s → %s" % (ad, anahtar, e[anahtar]["e"], y[anahtar]["e"]))
            continue
        farklar.append((anahtar, eb, yb))
    kontrolde = Counter()
    sonuc = []
    sayac = lambda a: a.endswith(":takvim:cariKalemSayisi") or a.endswith(":projeksiyon:cari")  # noqa: E731
    for anahtar, eb, yb in farklar:
        if sayac(anahtar):
            continue
        s = sinifla(anahtar, me.izler, my.izler, eb, yb, {})
        if s != "BEKLENMEYEN":
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append((anahtar, eb, yb, s))
    for anahtar, eb, yb in farklar:
        if sayac(anahtar):
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
print("G3 (kural 2.5.0; %d senaryo — eski kopyanın %d elle senaryosu + %d rastgele): eski %d denetim · yeni %d denetim · değişen / kalkan / yeni toplam %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
      % (len(elle_eski) + len(rastgele), len(elle_eski), len(rastgele), toplam_eski, toplam_yeni, sum(genel.values()), beklenmeyen, etiket_degisen))
for (s, t), n in sorted(genel.items()):
    print("  %-14s %-8s %5d" % (s, t, n))
    for o in ornek[(s, t)]:
        print("      örn. %s" % o)
for o in etiket_ornek:
    print("  etiket örn. %s" % o)
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
