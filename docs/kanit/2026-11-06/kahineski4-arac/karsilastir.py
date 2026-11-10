#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 4 (cari; S91 / S92 / S93) — eski kâhin (bakım 3, 2aa1e733 kopyası) ↔ yeni kâhin karşılaştırması. Program AÇILMAZ; yalnız iki model.py koşar.

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi (üretim 2.4.9 kuralıyla — URETIM_KURALI).
2. EŞDEĞERLİK: bütün elle senaryolar (eski kopyadakiler) + rastgele senaryolar × kipler (2.4.9, 2.4.6, 2.4.5, --legacy): iki modelin çıktısı (ya da hatası) bayt bayt aynı.
3. G3: kural seti 2.5.0'da değişen eski beklentiler — her değişen / kalkan / yeni denetim, o KONTROL anındaki durumdan (yeni modelin izi) sınıflanır:
   S91 (vadesiz kayıt kalem; C16.1) · S92-net (karşı yönlü kalemli caride net görünüm; C16.2) · S92-tanimsiz (karşı yönlü kalemli, yalın değil / okumalar ayrışıyor — denetim
   yazılmıyor) · C16.4 (gecikmiş formülü / S93 avans) · sayac (türev sayaç: aynı kontrolde sınıflanmış kalem değişikliği ya da belirsiz üye var) · BEKLENMEYEN (hiçbiri — 0 olmalı).
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


# ── 3. G3 (2.5.0): değişen eski beklentiler — kontrol anındaki izle sınıflama
class Iz(MY.Model):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.izler = {}

    def kontrol(self, a):
        super().kontrol(a)
        cari = {}
        for cad, c in self.cariler.items():
            if c.get("silindi"):
                continue
            nd = self.net_durum(cad)
            vadesiz_acik = any(h["cari"] == cad and h["aktif"] and h["tur"] in ("borc", "alacak", "acilis") and not h["vade"] and not h["beklenen"] for h in self.hareketler.values())
            stok = any(x["aktif"] and x["cari"] == cad and x["tur"] == "stok_satis" for x in self.kapaticilar.values())
            kars = any(e["durum"] == "karsiliksiz" and e.get("karsiliksizCari") == cad for e in self.evraklar.values())
            self.kuyruk_borc(cad)
            avans = any(h == "o" for _d, _x, h, _a in self._onbellek.get(("b250", cad), []))
            cari[cad] = {"nd": nd[0], "neden": nd[1] if nd[0] == "tanimsiz" else None, "vadesiz": vadesiz_acik, "stok": stok, "kars": kars, "avans": avans,
                         "yalin": self._net_uygun(cad)[0]}
        hareket = {hn: {"cari": h["cari"], "vadesiz": h.get("tur") in ("borc", "alacak", "acilis") and not h.get("vade") and not h.get("beklenen")} for hn, h in self.hareketler.items()}
        fatura = {fad: f["cari"] for fad, f in self.faturalar.items()}
        self.izler[a["id"]] = {"cari": cari, "hareket": hareket, "fatura": fatura}


def sinifla(anahtar, iz, eski, yeni, kontrolde_degisen):
    p = anahtar.split(":")
    k = p[0]
    z = iz.get(k)
    if z is None:
        return "BEKLENMEYEN"

    def cari_sinifi(cad, s91_olur=False):
        c = z["cari"].get(cad)
        if c is None:
            return None
        if c["nd"] == "net":
            return "S92-net"
        if c["nd"] == "tanimsiz":
            return "S92-tanimsiz"
        if s91_olur and (c["vadesiz"] or c["stok"] or c["kars"]):
            return "S91"
        return None

    if len(p) >= 4 and p[1] == "hareket" and p[-1] == "kalan":
        h = z["hareket"].get(":".join(p[2:-1]))
        return (cari_sinifi(h["cari"]) if h else None) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        h = z["hareket"].get(":".join(p[3:]))
        if not h:
            return "BEKLENMEYEN"
        return cari_sinifi(h["cari"]) or ("S91" if h["vadesiz"] else "BEKLENMEYEN")
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "fatura":
        cad = z["fatura"].get(":".join(p[3:]))
        return cari_sinifi(cad, s91_olur=True) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "cariToplam":
        return cari_sinifi(":".join(p[3:]), s91_olur=True) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] == "cari" and p[-1] in ("acikToplam", "acikEsitBakiye"):
        return cari_sinifi(":".join(p[2:-1])) or "BEKLENMEYEN"
    if len(p) >= 4 and p[1] == "cari" and p[-1] == "gecikmis":
        return "C16.4"
    if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
        catal = isinstance(yeni, dict) and "catal" in yeni
        tanimsiz = any(c["nd"] == "tanimsiz" for c in z["cari"].values())
        return "sayac" if (kontrolde_degisen.get(k) or catal or (yeni is None and tanimsiz)) else "BEKLENMEYEN"
    return "BEKLENMEYEN"


YOK = "(denetim yok)"
g3 = defaultdict(Counter)
ornek = defaultdict(list)
dokum = []
toplam_eski = toplam_yeni = 0
etiket_degisen = 0
for ad, sen in elle + rastgele:
    if sen.get("dil") != MY.DIL and not ad.startswith("rastgele-"):
        # /1 /2 senaryolar: 2.5.0'da da koşar (geçersiz olmayanlar) — fark beklenmez; yine de karşılaştırılır
        pass
    try:
        e = ME.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        e = None
    try:
        my = Iz(json.loads(json.dumps(sen)), 0, "2.5.0")
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
        eb = e[anahtar]["b"] if anahtar in e else None
        yb = y[anahtar]["b"] if anahtar in y else None
        if anahtar in e and anahtar in y and eb == yb:
            etiket_degisen += e[anahtar]["e"] != y[anahtar]["e"]
            continue
        farklar.append((anahtar, eb if anahtar in e else YOK, yb if anahtar in y else YOK, yb if anahtar in y else None))
    # önce sayaç dışı farklar (sayaçların "türev" sınıfı için)
    kontrolde = Counter()
    sonuc = []
    for anahtar, eb, yb, ham in farklar:
        if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
            continue
        s = sinifla(anahtar, my.izler, eb, yb, {})
        if s != "BEKLENMEYEN":
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append((anahtar, eb, yb, s))
    for anahtar, eb, yb, ham in farklar:
        if anahtar.endswith(":takvim:cariKalemSayisi") or anahtar.endswith(":projeksiyon:cari"):
            sonuc.append((anahtar, eb, yb, sinifla(anahtar, my.izler, eb, ham, kontrolde)))
    for anahtar, eb, yb, s in sonuc:
        tur = "kalkan" if yb == YOK else ("yeni" if eb == YOK else "degisen")
        g3[ad][(s, tur)] += 1
        dokum.append({"senaryo": ad, "anahtar": anahtar, "eski": eb, "yeni": yb, "sinif": s, "tur": tur})
        if len(ornek[(s, tur)]) < 4:
            ornek[(s, tur)].append("%s %s: %s → %s" % (ad, anahtar, json.dumps(eb, ensure_ascii=False)[:110], json.dumps(yb, ensure_ascii=False)[:110]))

genel = Counter()
for ad, c in g3.items():
    for kt, n in c.items():
        genel[kt] += n
beklenmeyen = sum(n for (s, _t), n in genel.items() if s == "BEKLENMEYEN")
print("G3 (kural 2.5.0; %d senaryo): eski %d denetim · yeni %d denetim · değişen / kalkan / yeni toplam %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
      % (len(elle) + len(rastgele), toplam_eski, toplam_yeni, sum(genel.values()), beklenmeyen, etiket_degisen))
for (s, t), n in sorted(genel.items()):
    print("  %-14s %-8s %5d" % (s, t, n))
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
