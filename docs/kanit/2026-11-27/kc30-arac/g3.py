#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakım 30 G3: eski kâhin (taban) ↔ yeni kâhin çıktısı. Kurallar: 2.5.0 (sınıflı fark), 2.4.9 / 2.4.6 / 2.4.5 (bayt bayt aynı olmalı), elle senaryoların elle tabloları (eski ↔ yeni).
  python3 -I g3.py <eski klasör> <yeni klasör> [--tohum 1-10] [--islem 120]
Rastgele: s1 ve ux18 (her iki kopyanın üreticisiyle — dizi aynı mı), m2 yalnız yeni kopyada (yeni sınıf). Fark sınıfı: değişen anahtarın carisinin yeni kâhindeki bakım 30 izi
(m2deg — Değersiz kararı eski K7'den farklı; m2geri — S-M2-1 geriye ölçüm düşüşü değiştirdi; sk55 / m2sus — SUS); izi olmayan fark BEKLENMEYEN."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict

IZLER = ("m2deg", "m2geri", "sk55", "m2sus")


def yukle_model(kl, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(kl, "model.py"))
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    return M


def uret(kl, tur, t, islem):
    r = subprocess.run([sys.executable, "-I", os.path.join(kl, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", str(islem)], capture_output=True, check=True)
    return json.loads(r.stdout)


def cari_of(sen, anahtar):
    p = anahtar.split(":")
    if "cari" in p:
        i = p.index("cari")
        if i + 1 < len(p):
            return p[i + 1]
    if p[0] == "adim" and len(p) > 1:
        for a in sen["adimlar"]:
            if a["id"] == p[1]:
                if a.get("cari"):
                    return a["cari"]
                if a.get("supheli"):
                    for b in sen["adimlar"]:
                        if b.get("islem") == "supheli_al" and b.get("ad") == a["supheli"]:
                            return b["cari"]
                if a.get("hareket"):
                    for b in sen["adimlar"]:
                        if b["id"] == a["hareket"]:
                            return b.get("cari")
                if a.get("evrak"):
                    for b in sen["adimlar"]:
                        if b.get("ad") == a["evrak"]:
                            return b.get("cari")
    return None


def kos(M, sen, kural):
    m = M.Model(sen, 0, kural)
    r = m.kos()
    return m, r


def main(argv):
    eski_kl, yeni_kl = argv[1], argv[2]
    tohum = argv[argv.index("--tohum") + 1] if "--tohum" in argv else "1-10"
    a_, b_ = (int(x) for x in tohum.split("-"))
    islem = int(argv[argv.index("--islem") + 1]) if "--islem" in argv else 120
    E, Y = yukle_model(eski_kl, "g3_eski"), yukle_model(yeni_kl, "g3_yeni")
    senler = []
    d_e, d_y = os.path.join(eski_kl, "senaryolar"), os.path.join(yeni_kl, "senaryolar")
    for f in sorted(os.listdir(d_y)):
        sen = json.load(open(os.path.join(d_y, f), encoding="utf-8"))
        eski_var = os.path.exists(os.path.join(d_e, f))
        if eski_var and json.load(open(os.path.join(d_e, f), encoding="utf-8")) != sen:
            print("ELLE SENARYO DEĞİŞTİ: %s" % f)
        senler.append((f, sen, eski_var))
    ayni_dizi = 0
    for tur in ("s1", "ux18"):
        for t in range(a_, b_ + 1):
            se, sy = uret(eski_kl, tur, t, islem), uret(yeni_kl, tur, t, islem)
            ayni_dizi += se == sy
            if se != sy:
                print("ÜRETİCİ DİZİSİ FARKLI: %s %d" % (tur, t))
            senler.append(("rastgele-%s-%d" % (tur, t), sy, True))
    print("üretici: %d/%d aynı dizi" % (ayni_dizi, 2 * (b_ - a_ + 1)))
    # eski kurallar: bayt bayt aynı
    eski_kural_ayni = eski_kural_top = 0
    for kural in ("2.4.9", "2.4.6", "2.4.5"):
        for ad, sen, eski_var in senler:
            if not eski_var:
                continue
            try:
                _m1, r1 = kos(E, sen, kural)
            except SystemExit:
                r1 = "çıkış"
            try:
                _m2, r2 = kos(Y, sen, kural)
            except SystemExit:
                r2 = "çıkış"
            eski_kural_top += 1
            if json.dumps(r1, sort_keys=True, ensure_ascii=False) == json.dumps(r2, sort_keys=True, ensure_ascii=False):
                eski_kural_ayni += 1
            else:
                print("ESKİ KURAL FARKI: %s %s" % (kural, ad))
    print("--kural 2.4.9 / 2.4.6 / 2.4.5: %d/%d bayt bayt aynı" % (eski_kural_ayni, eski_kural_top))
    # 2.5.0: sınıflı fark
    sinif = Counter()
    ornek = defaultdict(list)
    eski_top = yeni_top = 0
    bekl = []
    etiket = 0
    for ad, sen, eski_var in senler:
        my, ry = kos(Y, sen, "2.5.0")
        oy = ry["denetimler"]
        yeni_top += len(oy)
        if not eski_var:
            continue
        _me, re_ = kos(E, sen, "2.5.0")
        oe = re_["denetimler"]
        eski_top += len(oe)
        for k in sorted(set(oe) | set(oy)):
            ve, vy = oe.get(k), oy.get(k)
            if ve is not None and vy is not None and ve["b"] == vy["b"]:
                if ve["e"] != vy["e"]:
                    etiket += 1
                    c = cari_of(sen, k)
                    iz = sorted(my._iz15.get(c, set()) & set(IZLER)) if c else []
                    sinif["etiket:" + ("+".join(iz) or "İZSİZ")] += 1
                    if len(ornek["etiket:" + ("+".join(iz) or "İZSİZ")]) < 6:
                        ornek["etiket:" + ("+".join(iz) or "İZSİZ")].append("%s %s %s→%s" % (ad, k, ve["e"], vy["e"]))
                continue
            tur = "değişen" if ve is not None and vy is not None else ("kalkan" if vy is None else "yeni")
            c = cari_of(sen, k)
            iz = sorted(my._iz15.get(c, set()) & set(IZLER)) if c else sorted(set().union(*[v & set(IZLER) for v in my._iz15.values()]) if my._iz15 else set())
            s_ = "+".join(iz) if iz else "BEKLENMEYEN"
            sinif["%s %s" % (s_, tur)] += 1
            if len(ornek[s_]) < 8:
                ornek[s_].append("%s %s %s → %s" % (ad, k, json.dumps(ve and ve["b"], ensure_ascii=False)[:40], json.dumps(vy and vy["b"], ensure_ascii=False)[:40]))
            if not iz:
                bekl.append("%s %s" % (ad, k))
    # yeni sınıf: rastgele m2 (yalnız yeni kopya)
    m2_top = 0
    for t in range(a_, b_ + 1):
        sen = uret(yeni_kl, "m2", t, islem)
        _m, r = kos(Y, sen, "2.5.0")
        m2_top += len(r["denetimler"])
    print("2.5.0 G3: eski %d denetim · yeni %d (+ rastgele m2 %d — yeni sınıf) · değişen / kalkan / yeni %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
          % (eski_top, yeni_top, m2_top, sum(v for k, v in sinif.items() if not k.startswith("etiket:")), len(bekl), etiket))
    for k, v in sorted(sinif.items()):
        print("  %s: %d" % (k, v))
    for k, v in sorted(ornek.items()):
        print("  örnek %s:" % k)
        for x in v:
            print("    " + x)
    if bekl:
        print("BEKLENMEYEN (ilk 30):")
        for x in bekl[:30]:
            print("  " + x)
    print("# tests %d" % (len(bekl) + 1))
    print("# pass %d" % (1 if not bekl else 0))
    print("# fail %d" % len(bekl))
    return 0 if not bekl and eski_kural_ayni == eski_kural_top else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
