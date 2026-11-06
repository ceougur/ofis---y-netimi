#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eski kâhinler bakımı 3 — cari kâhini ESKİ (bakım 2, d6a7b0d5) ↔ YENİ (bakım 3) karşılaştırması. Program AÇILMAZ.

  python3 -I karsilastir.py <eski cari klasörü> <yeni cari klasörü> [--rastgele-tohum 10] [--islem 120]

1. Üretici eşdeğerliği: uretici.py (eski ve yeni) rastgele s1 / ux18 tohum 1..N × islem aynı bayt dizisini üretir.
2. Eşdeğerlik (bayt bayt): elle senaryolar (YENİ klasörün dosyaları — d12 / d13 dahil) + rastgele, kural setleri 2.4.9 / 2.4.6 / 2.4.5 ve --legacy (2.4.4);
   model.kos() çıktısı json.dumps(sort_keys) ile; ikisi de çökerse çökme iletisi karşılaştırılır.
3. G3 (2.5.0): değişen her denetim (değer b, etiket e, kural metni k) senaryo senaryo; sınıf:
   "SK-5 ÇATAL → S69" = eski b {"catal": [K6.3, S67-değeri]} ve yeni b = ikinci dal (S67/S69 değeri: state overdue, gün sayısı vadeden), anahtar takvim:hareket;
   başka her değişiklik "BEKLENMEYEN" (gerileme adayı — ders 6).
4. Yeni senaryolar (d12 / d13) ve d10'un SK-5 kalemleri eski kâhinde: eski çıktı ↔ yeni çıktı farkı ve NEDENİ (eski kural metni) dökümü (ders 7, 38).
Son satırlar: sayılar; çıkış 0 yalnız eşdeğerlik tam ve BEKLENMEYEN = 0 ise.
"""
import importlib.util
import json
import os
import subprocess
import sys


def model_yukle(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def kos(M, sen, kural, mut=0):
    try:
        return M.Model(sen, mut, kural).kos()
    except SystemExit as e:
        return {"__cokme__": "SystemExit %s" % (e,)}
    except Exception as e:  # noqa: BLE001
        return {"__cokme__": "%s %s" % (type(e).__name__, e)}


def main(argv):
    eski_d, yeni_d = os.path.abspath(argv[1]), os.path.abspath(argv[2])
    tohum_n = int(argv[argv.index("--rastgele-tohum") + 1]) if "--rastgele-tohum" in argv else 10
    islem = int(argv[argv.index("--islem") + 1]) if "--islem" in argv else 120
    E = model_yukle(eski_d, "kahin_cari_eski_b2")
    Y = model_yukle(yeni_d, "kahin_cari_yeni_b3")
    print("eski: %s · yeni: %s · rastgele tohum 1–%d × %d işlem" % (eski_d, yeni_d, tohum_n, islem))

    # 1. üretici eşdeğerliği
    rastgele = []
    ur_ayni, ur_top = 0, 0
    for tur in ("s1", "ux18"):
        for t in range(1, tohum_n + 1):
            cikti = []
            for d in (eski_d, yeni_d):
                r = subprocess.run([sys.executable, "-I", os.path.join(d, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", str(islem)], capture_output=True, check=True)
                cikti.append(r.stdout)
            ur_top += 1
            ur_ayni += cikti[0] == cikti[1]
            rastgele.append(("rastgele-%s-%d" % (tur, t), json.loads(cikti[1])))
    print("ÜRETİCİ: %d/%d aynı bayt dizisi" % (ur_ayni, ur_top))

    sd = os.path.join(yeni_d, "senaryolar")
    elle = [(f[:-5], json.load(open(os.path.join(sd, f), encoding="utf-8"))) for f in sorted(os.listdir(sd)) if f.endswith(".json")]
    hepsi = elle + rastgele

    # 2. eşdeğerlik — eski kural setleri
    es_ayni, es_top, es_fark = 0, 0, []
    for ad, sen in hepsi:
        kipler = ["2.4.9", "2.4.6", "2.4.5"] if sen.get("dil") == Y.DIL else ["2.4.9", "2.4.6", "2.4.5", "2.4.4"]
        if sen.get("dil") == Y.DIL:
            kipler.append("2.4.4")  # --legacy /3'te de çalıştırılır (çökme iletisi karşılaştırılır)
        for kip in kipler:
            a = json.dumps(kos(E, sen, kip), ensure_ascii=False, sort_keys=True)
            b = json.dumps(kos(Y, sen, kip), ensure_ascii=False, sort_keys=True)
            es_top += 1
            if a == b:
                es_ayni += 1
            else:
                es_fark.append("%s [%s]" % (ad, kip))
    print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy): %d/%d bayt bayt aynı" % (es_ayni, es_top))
    for x in es_fark[:50]:
        print("  ✗ eşdeğerlik farkı: %s" % x)

    # 3. G3 — 2.5.0
    g3_toplam, g3_sinif, beklenmeyen, yeni_senaryo = 0, {}, [], []
    print("\nG3 (2.5.0; bakım 2 ↔ bakım 3) — değişen denetimler senaryo senaryo:")
    for ad, sen in hepsi:
        a, b = kos(E, sen, "2.5.0"), kos(Y, sen, "2.5.0")
        if "__cokme__" in a or "__cokme__" in b:
            print("  %s: ÇÖKME eski=%s yeni=%s" % (ad, a.get("__cokme__"), b.get("__cokme__")))
            if a.get("__cokme__") != b.get("__cokme__"):
                beklenmeyen.append((ad, "çökme"))
            continue
        da, db = a["denetimler"], b["denetimler"]
        satir = []
        for k in sorted(set(da) | set(db)):
            x, y = da.get(k), db.get(k)
            if x == y:
                continue
            g3_toplam += 1
            xb = x["b"] if x else "ANAHTAR YOK"
            yb = y["b"] if y else "ANAHTAR YOK"
            if (x and y and ":takvim:hareket:" in k and isinstance(xb, dict) and isinstance(xb.get("catal"), list) and len(xb["catal"]) == 2
                    and yb == xb["catal"][1] and isinstance(yb, dict) and yb.get("state") == "overdue" and "ÇATAL SK-5" in x["k"] and "C15.1 S69 A" in y["k"]):
                sinif = "SK-5 ÇATAL → S69"
            elif x and y and xb == yb:
                sinif = "yalnız etiket / kural metni"
            else:
                sinif = "BEKLENMEYEN"
                beklenmeyen.append((ad, k))
            g3_sinif[sinif] = g3_sinif.get(sinif, 0) + 1
            satir.append("    %s [%s] eski %s (%s) → yeni %s (%s)" % (k, sinif, json.dumps(xb, ensure_ascii=False), x["e"] if x else "-",
                                                                  json.dumps(yb, ensure_ascii=False), y["e"] if y else "-"))
        if a.get("belirsiz") != b.get("belirsiz"):
            satir.append("    belirsiz listesi değişti: eski %d → yeni %d" % (len(a.get("belirsiz") or []), len(b.get("belirsiz") or [])))
        if satir:
            print("  %s: %d denetim" % (ad, len([s for s in satir if s.startswith("    ") and "belirsiz listesi" not in s])))
            print("\n".join(satir))
    print("G3 TOPLAM: %d değişen denetim · %s · BEKLENMEYEN %d" % (g3_toplam, ", ".join("%s %d" % kv for kv in sorted(g3_sinif.items())), len(beklenmeyen)))
    for x in beklenmeyen[:50]:
        print("  ✗ BEKLENMEYEN: %s %s" % x)

    # 4. yeni senaryolar eski kâhinde (ders 7, 38) — elle beklenene göre
    print("\nYENİ / DEĞİŞEN ELLE SENARYOLAR ESKİ (bakım 2) KÂHİNDE — elleBeklenen'e göre:")
    for ad, sen in elle:
        if ad not in ("d10-c5-s67-soz-takvim", "d12-c5-s69-soz-gunu-ve-gecmis", "d13-c5-s69-soz-ertesi-gun"):
            continue
        a = kos(E, sen, "2.5.0")
        if "__cokme__" in a:
            print("  %s: eski kâhin ÇÖKTÜ — %s" % (ad, a["__cokme__"]))
            continue
        kirmizi = []
        for k, bek in (sen.get("elleBeklenen") or {}).items():
            g = a["denetimler"].get(k)
            if not g or g["b"] != bek:
                neden = (g["k"].split(" · ")[-1] if g else "anahtar yok")
                kirmizi.append("    %s: eski %s ↔ elle %s — eski kural: %s" % (k, json.dumps(g["b"] if g else None, ensure_ascii=False)[:160],
                                                                            json.dumps({kk: bek.get(kk) for kk in ("state", "days")} if isinstance(bek, dict) else bek, ensure_ascii=False), neden))
        print("  %s: %d / %d elle beklenen eski kâhinde FARKLI" % (ad, len(kirmizi), len(sen.get("elleBeklenen") or {})))
        print("\n".join(kirmizi))
    ok = ur_ayni == ur_top and es_ayni == es_top and not beklenmeyen
    print("\nSONUÇ: üretici %d/%d · eşdeğerlik %d/%d · G3 %d (BEKLENMEYEN %d) → %s" % (ur_ayni, ur_top, es_ayni, es_top, g3_toplam, len(beklenmeyen), "TAMAM" if ok else "BAŞARISIZ"))
    print("# tests %d" % (ur_top + es_top + 1))
    print("# pass %d" % (ur_ayni + es_ayni + (0 if beklenmeyen else 1)))
    print("# fail %d" % ((ur_top - ur_ayni) + (es_top - es_ayni) + (1 if beklenmeyen else 0)))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
