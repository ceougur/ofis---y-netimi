#!/usr/bin/env python3
"""Eski kâhinler bakımı 2 — cari kâhini: bakım 1 (a5a89a1f kopyası) ↔ bakım 2 (çalışma ağacı) karşılaştırması. Program AÇILMAZ.
  python3 -I esdeger_cari.py <eski_kopya_cari_klasoru> <yeni_cari_klasoru>
1. Eşdeğerlik: ESKİ senaryolar (eski kopyada olanlar) + rastgele (s1 / ux18 tohum 1–10 × 120) — kural 2.4.9 / 2.4.6 / 2.4.5 ve /1 /2 dosyalarında 2.4.4: çıktı bayt bayt aynı mı.
2. G3 dökümü: aynı dosyalarda kural 2.5.0 çıktı farkları (anahtar, eski b, yeni b, eski e → yeni e).
3. Yeni senaryolar (yalnız yeni klasörde) eski kâhinde 2.5.0: çökme mi, hangi denetimler farklı.
"""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict


def yukle_mod(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cikti(M, sen, kural, mut=0):
    try:
        return json.dumps(M.Model(sen, mut, kural).kos(), ensure_ascii=False, sort_keys=True)
    except SystemExit as e:
        return "SystemExit: %s" % e


def main(argv):
    eski_d, yeni_d = argv[1], argv[2]
    E = yukle_mod("cari_eski", os.path.join(eski_d, "model.py"))
    Y = yukle_mod("cari_yeni", os.path.join(yeni_d, "model.py"))
    eski_sen = sorted(f for f in os.listdir(os.path.join(eski_d, "senaryolar")) if f.endswith(".json"))
    yeni_sen = sorted(f for f in os.listdir(os.path.join(yeni_d, "senaryolar")) if f.endswith(".json"))
    dosyalar = []
    for f in eski_sen:
        # senaryo dosyası bakım 2'de değiştiyse (d7: yalnız elleBeklenen / aciklama) adımlar aynı olmalı — adımları eski dosyadan al
        with open(os.path.join(eski_d, "senaryolar", f), encoding="utf-8") as g:
            se = json.load(g)
        with open(os.path.join(yeni_d, "senaryolar", f), encoding="utf-8") as g:
            sy = json.load(g)
        if {k: v for k, v in se.items() if not k.startswith("elle") and k != "aciklama"} != {k: v for k, v in sy.items() if not k.startswith("elle") and k != "aciklama"}:
            print("UYARI: %s senaryosunun adımları değişmiş" % f)
        dosyalar.append((f, se))
    # rastgele: iki klasörün üreticisi aynı diziyi üretmeli
    rast_esit = 0
    for tur in ("s1", "ux18"):
        for t in range(1, 11):
            ce = subprocess.run([sys.executable, "-I", os.path.join(eski_d, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "120"], capture_output=True, check=True).stdout
            cy = subprocess.run([sys.executable, "-I", os.path.join(yeni_d, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "120"], capture_output=True, check=True).stdout
            if ce != cy:
                print("FARK: üretici %s %d eski ↔ yeni" % (tur, t))
            else:
                rast_esit += 1
            dosyalar.append(("rastgele-%s-%d" % (tur, t), json.loads(cy)))
    print("üretici bayt bayt aynı: %d/20" % rast_esit)
    # 1. eşdeğerlik
    toplam, esit = 0, 0
    farkli = []
    for ad, sen in dosyalar:
        kurallar = ["2.4.9", "2.4.6", "2.4.5"] + (["2.4.4"] if sen.get("dil") != Y.DIL else [])
        for k in kurallar:
            toplam += 1
            a, b = cikti(E, sen, k), cikti(Y, sen, k)
            if a == b:
                esit += 1
            else:
                farkli.append((ad, k))
    print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / 2.4.4): %d/%d bayt bayt aynı%s" % (esit, toplam, "" if not farkli else " — FARKLI: %s" % farkli[:20]))
    # 2. G3 dökümü (2.5.0)
    print("\nG3 — 2.5.0 kâhin çıktısı bakım 1 ↔ bakım 2 (eski senaryolar + rastgele):")
    g3_toplam = 0
    neden_say = Counter()
    for ad, sen in dosyalar:
        if sen.get("dil") != Y.DIL and not ad.startswith("rastgele-ux18"):
            continue
        try:
            oe = E.Model(sen, 0, "2.5.0").kos()
            oy = Y.Model(sen, 0, "2.5.0").kos()
        except SystemExit as e:
            print("  %s: çökme %s" % (ad, e))
            continue
        de, dy = oe["denetimler"], oy["denetimler"]
        anahtarlar = sorted(set(de) | set(dy))
        satirlar = []
        for k in anahtarlar:
            a, b = de.get(k), dy.get(k)
            if a == b:
                continue
            if a is None:
                neden = "yeni anahtar"
            elif b is None:
                neden = "kalkan anahtar"
            elif a["b"] != b["b"]:
                if isinstance(a["b"], dict) and "catal" in a["b"]:
                    neden = "ÇATAL → tek değer" if not (isinstance(b["b"], dict) and "catal" in b["b"]) else "ÇATAL değişti"
                elif isinstance(b["b"], dict) and "catal" in b["b"]:
                    neden = "tek değer → ÇATAL"
                else:
                    neden = "değer"
            elif a["e"] != b["e"]:
                neden = "etiket %s → %s" % (a["e"], b["e"])
            else:
                neden = "kural metni"
            sinif = "SK-4" if "SK-4" in (a or {}).get("k", "") else "SK-5" if "SK-5" in (b or {}).get("k", "") else "C14.2" if "C14.2" in (b or {}).get("k", "") or "SK-3" in (a or {}).get("k", "") else ""
            neden_say[(neden, sinif)] += 1
            satirlar.append("    %s [%s%s] eski %s · yeni %s" % (k, neden, (" " + sinif) if sinif else "",
                                                                json.dumps(a["b"] if a else None, ensure_ascii=False)[:160], json.dumps(b["b"] if b else None, ensure_ascii=False)[:160]))
        if oe["belirsiz"] != oy["belirsiz"]:
            satirlar.append("    belirsiz: eski %s · yeni %s" % (oe["belirsiz"][:3], oy["belirsiz"][:3]))
        if satirlar:
            g3_toplam += len(satirlar)
            print("  %s: %d" % (ad, len(satirlar)))
            print("\n".join(satirlar))
    print("G3 toplam %d satır; neden sayıları: %s" % (g3_toplam, dict(neden_say)))
    # 3. yeni senaryolar eski kâhinde
    print("\nYENİ SENARYOLAR — eski (bakım 1) kâhinde 2.5.0:")
    for f in yeni_sen:
        if f in eski_sen:
            continue
        with open(os.path.join(yeni_d, "senaryolar", f), encoding="utf-8") as g:
            sen = json.load(g)
        try:
            oe = E.Model(sen, 0, "2.5.0").kos()
        except SystemExit as e:
            print("  %s: eski kâhin ÇÖKTÜ — %s" % (f, e))
            continue
        oy = Y.Model(sen, 0, "2.5.0").kos()
        de, dy = oe["denetimler"], oy["denetimler"]
        fark = [k for k in sorted(set(de) | set(dy)) if de.get(k, {}).get("b") != dy.get(k, {}).get("b")]
        elle = sen.get("elleBeklenen") or {}
        elle_fark = [k for k in elle if de.get(k, {}).get("b", "ANAHTAR YOK") != elle[k]]
        print("  %s: %d denetimde değer farkı; elle tablonun %d/%d anahtarı eski kâhinde TUTMUYOR; eski belirsiz: %s" % (f, len(fark), len(elle_fark), len(elle), oe["belirsiz"][:2]))
        for k in elle_fark[:40]:
            print("    %s: elle %s · eski kâhin %s" % (k, json.dumps(elle[k], ensure_ascii=False)[:140], json.dumps(de.get(k, {}).get("b", "ANAHTAR YOK"), ensure_ascii=False)[:140]))
        for k, alan in (sen.get("elleCatal") or {}).items():
            print("    %s (ÇATAL SK-5): eski kâhin %s" % (k, json.dumps(de.get(k, {}).get("b", "ANAHTAR YOK"), ensure_ascii=False)[:300]))
    print("# tests %d\n# pass %d\n# fail %d" % (toplam, esit, len(farkli)))
    return 0 if not farkli else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
