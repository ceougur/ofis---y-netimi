#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maliyet Hesap Kartı kâhini — Excel'in KENDİ değerleriyle karşılaştırma (YALNIZ YEREL; 2.4.6 madde 0c kabulü).

    python3 -I test/bagimsiz/maliyet/excel_denetle.py <hucreler.json>

<hucreler.json>: müşterinin Excel'inden ana oturumun YEREL olarak çıkardığı hücre dökümü (README §9'daki betikle):
    {"sekmeler": {"1": {"degerler": {"B2": 2.5, ...}, "formuller": {"E2": "=B2*D2", ...}}, "2": {...}, "3": {...}, "4": {...}}}
Sekme numarası Excel sırasıdır (1 cam, 2 liste-1, 3 mika, 4 liste-2). Dosya MÜŞTERİ VERİSİDİR: not defterinde kalır, depoya / kanıta GİRMEZ.

Ne denetlenir:
  1. KAPSAM — Excel'deki her formül hücresi şablonda karşılığı olan bir hücre mi; şablonun her formül hücresi Excel'de formül mü; şablonun
     elle (girdi) saydığı hücreler (CAM H25, MİKA R20, 2019 I5, H15:K15, B30, bütün TABAN hücreleri) Excel'de formül DEĞİL mi.
  2. YAPI — her formülün metni şablondan türetilen metinle aynı mı (oran, bölen, kaynak hücre, toplam aralığı); fiyat listesinde
     "=<kaynak>+<sabit>" biçimi ve kaynak hücre şablondakiyle aynı mı (sabit = farkın kendisi, girdi olarak alınır).
  3. DEĞER — Excel'in girdi hücreleri kâhine verilir, kâhinin hesabı Excel'in önbellekteki değeriyle karşılaştırılır (göreli 1e-9).
Çıktı YALNIZ sayılar ve hücre adresleri (değer yazılmaz). Son satır "N/M denetim geçti"; çıkış 0 yalnız fark yokken; 3 = okunamadı.
"""
import json
import math
import os
import re
import sys

sys.dont_write_bytecode = True
for _akis in (sys.stdout, sys.stderr):
    if hasattr(_akis, "reconfigure"):
        _akis.reconfigure(encoding="utf-8", errors="replace")   # Windows: -I ile PYTHONIOENCODING yok sayılır, boru ANSI kod sayfasına düşer
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import kahin  # noqa: E402

_SABIT = re.compile(r"^=([A-Z]+\d+)([+-])(\d+(?:\.\d+)?)$")   # =X+n ya da =X-n (FORMÜL TABLOSU: hepsi +; eksi de tanınır)


def _normal(f):
    return re.sub(r"\s+", "", str(f)).replace("$", "").upper()


def _sayi(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def beklenen_formuller():
    """{excel sekme no: {adres: (tür, beklenen formül metni ya da None (matris), kart kodu, görüntü yolu, ek)}} ve elle hücreler."""
    formul = {s["excel_sekme"]: {} for s in kahin.SEKMELER}
    elle = {s["excel_sekme"]: {} for s in kahin.SEKMELER}
    no = {s["kod"]: s["excel_sekme"] for s in kahin.SEKMELER}
    for kod, k in kahin.KARTLAR.items():
        f, e = formul[no[k["sekme"]]], elle[no[k["sekme"]]]
        if k["tur"] == "zincir":
            for s in k["satirlar"]:
                x = s["excel"]
                metin = f"={x['miktar']}*{x['fiyat']}" if k["carpim"] == "miktar*fiyat" else f"={x['fiyat']}*{x['miktar']}"
                f[x["tutar"]] = ("zincir", metin, kod, ("satirlar", s["kimlik"], "tutar"))
                e[x["miktar"]] = e[x["fiyat"]] = (kod, "girdi")
            ad = {a["kod"]: a for a in k["adimlar"]}
            for a in k["adimlar"]:
                if a["islem"] == "toplam":
                    metin = "=" + a["excel_toplam"]
                elif a["islem"] == "yuzde":
                    metin = f"={ad[a['kaynak']]['excel']}*{a['oran']}/100"
                elif a["islem"] == "toplama":
                    metin = f"={ad[a['kaynak'][0]]['excel']}+{ad[a['kaynak'][1]]['excel']}"
                elif a["islem"] == "yuzde_ekle":
                    t = ad[a["kaynak"]]["excel"]
                    metin = f"={t}*{a['oran']}/100+{t}"
                elif a["islem"] == "bolme":
                    metin = f"={ad[a['kaynak']]['excel']}/{a['bolen']}"
                else:
                    e[a["excel"]] = (kod, "elle")
                    continue
                f[a["excel"]] = ("zincir", metin, kod, ("adimlar", a["kod"], "deger"))
        elif k["tur"] == "gramaj":
            for s in k["satirlar"]:
                x = s["excel"]
                if s["elle_kg"]:
                    e[x["giden_kg"]] = (kod, "elle")
                else:
                    f[x["giden_kg"]] = ("gramaj", f"={x['boy']}*{x['br_gramaj']}", kod, ("satirlar", s["kimlik"], "giden_kg"))
                f[x["satir_top"]] = ("gramaj", f"={x['alis_ft']}*{x['giden_kg']}", kod, ("satirlar", s["kimlik"], "satir_top"))
            ilk, son = k["satirlar"][0]["excel"], k["satirlar"][-1]["excel"]
            for alan in ("giden_kg", "satir_top"):
                f[k["excel"]["toplam"][alan]] = ("gramaj", f"=SUM({ilk[alan]}:{son[alan]})", kod, ("toplam", alan))
        elif k["tur"] == "matris":
            for anahtar, h in k["hucreler"].items():
                if h["tur"] == "taban":
                    e[h["excel"]] = (kod, "taban")
                else:
                    f[h["excel"]] = ("matris", None, kod, ("hucreler", anahtar, "deger"), h["excel_kaynak"])
    return formul, elle


def denetle(veri):
    formul, elle = beklenen_formuller()
    n, farklar = 0, []
    sekmeler = veri.get("sekmeler") if isinstance(veri, dict) else None
    if not isinstance(sekmeler, dict):
        raise ValueError("'sekmeler' yok")
    girdiler = {kod: kahin.bos_girdi(k) for kod, k in kahin.KARTLAR.items()}
    excel_deger = {}
    for s in kahin.SEKMELER:
        sn = s["excel_sekme"]
        sv = sekmeler.get(str(sn))
        if not isinstance(sv, dict):
            n += 1
            farklar.append(f"sekme {sn} ({s['kod']}): dökümde yok")
            continue
        deg, form = sv.get("degerler") or {}, {a: _normal(v) for a, v in (sv.get("formuller") or {}).items()}
        bek = formul[sn]
        n += 1
        fazla, eksik = sorted(set(form) - set(bek)), sorted(set(bek) - set(form))
        if fazla or eksik:
            farklar.append(f"sekme {sn} KAPSAM: şablonda karşılığı olmayan formül {fazla[:20]} ({len(fazla)}); Excel'de formül olmayan {eksik[:20]} ({len(eksik)})")
        for adres, (kod, tur) in elle[sn].items():
            n += 1
            if adres in form:
                farklar.append(f"sekme {sn} {adres}: şablonda {tur} hücresi, Excel'de formül ({kod})")
        for adres, spec in bek.items():
            if adres not in form:
                continue
            n += 1
            if spec[0] == "matris":
                m = _SABIT.match(form[adres])
                if not m or m.group(1) != spec[4]:
                    farklar.append(f"sekme {sn} {adres}: YAPI fiyat listesi kuralı beklenen ={spec[4]}+<fark> ({spec[2]})")
                    continue
                girdiler[spec[2]]["fark"][spec[3][1]] = float(m.group(3)) * (-1.0 if m.group(2) == "-" else 1.0)
            elif form[adres] != _normal(spec[1]):
                farklar.append(f"sekme {sn} {adres}: YAPI formül beklenen {spec[1]} ({spec[2]})")
        excel_deger[sn] = deg
        # Girdiler (Excel'in elle hücreleri) → kâhin girdisi
        for kod, k in kahin.KARTLAR.items():
            if k["sekme"] != s["kod"]:
                continue
            g = girdiler[kod]
            if k["tur"] == "zincir":
                for r, s2 in zip(g["satirlar"], k["satirlar"]):
                    r["miktar"], r["fiyat"] = _sayi(deg.get(s2["excel"]["miktar"])), _sayi(deg.get(s2["excel"]["fiyat"]))
                if ":" in k["adimlar"][0]["excel_toplam"]:   # aralıklı ARA: içindeki boş / not satırı (9. / 23.) sayı taşımamalı (V3)
                    bos = re.sub(r"\d+$", "", k["satirlar"][0]["excel"]["tutar"]) + str(k["excel"]["bos_satir"])
                    n += 1
                    if _sayi(deg.get(bos)) not in (None, 0.0):
                        farklar.append(f"sekme {sn} {bos}: ARA aralığındaki boş satırda sayı var ({kod}; kâhin bu satırı taşımaz)")
                for a in k["adimlar"]:
                    if a["islem"] == "elle":
                        g["adimlar"][a["kod"]]["deger"] = _sayi(deg.get(a["excel"]))
            elif k["tur"] == "gramaj":
                for r, s2 in zip(g["satirlar"], k["satirlar"]):
                    for alan in ("giden_mt", "boy", "br_gramaj", "alis_ft") + (("giden_kg",) if s2["elle_kg"] else ()):
                        r[alan] = _sayi(deg.get(s2["excel"][alan]))
            elif k["tur"] == "matris":
                for anahtar, h in k["hucreler"].items():
                    if h["tur"] == "taban":
                        g["taban"][anahtar] = _sayi(deg.get(h["excel"]))
    # Değer: kâhinin hesabı ↔ Excel'in önbellek değeri
    for sn, bek in formul.items():
        deg = excel_deger.get(sn)
        if deg is None:
            continue
        gorler = {}
        for adres, spec in bek.items():
            kod, yol = spec[2], spec[3]
            if kod not in gorler:
                gorler[kod] = kahin.goruntu(kahin.KARTLAR[kod], girdiler[kod])
            _var, kv = kahin._al(gorler[kod], yol)
            ev = _sayi(deg.get(adres))
            n += 1
            if ev is None or kv is None or not math.isfinite(kv) or abs(ev - kv) > max(kahin.TOL_GORELI * max(abs(ev), abs(kv)), kahin.TOL_MUTLAK):
                farklar.append(f"sekme {sn} {adres}: DEĞER kâhin ≠ Excel ({kod} {'/'.join(yol)})")
    return n, farklar


def main(argv):
    if len(argv) != 1:
        print("kullanım: excel_denetle.py <hucreler.json>")
        return 3
    try:
        with open(argv[0], encoding="utf-8") as f:
            veri = json.load(f)
        n, farklar = denetle(veri)
    except (OSError, ValueError, KeyError) as e:
        print(f"BELİRSİZ — hücre dökümü okunamadı: {e}")
        return 3
    formul, _ = beklenen_formuller()
    print(f"şablonun Excel formül hücresi: {sum(len(v) for v in formul.values())} (FORMÜL TABLOSU: 554)")
    for x in farklar[:100]:
        print(f"✗ {x}")
    print(f"{n - len(farklar)}/{n} denetim geçti" + (f", {len(farklar)} fark" if farklar else ""))
    return 1 if farklar else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
