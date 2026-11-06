#!/usr/bin/env python3
"""Eski kâhinler bakımı 2 — defter kâhini: bakım 1 (a5a89a1f kopyası) ↔ bakım 2 (çalışma ağacı). Program AÇILMAZ.
  python3 -I esdeger_defter.py <eski_defter_klasoru> <yeni_defter_klasoru>
1. Eski senaryolar (senaryo.json + eski senaryolar/*): 2.5.0 ve 2.4.9 çıktısı (mutasyonsuz + 1–34 mutantları) bayt bayt aynı mı; 2.4.9 için senaryo.json'un
   2.5.0 olayları çıkarılmış hâli de (eski 2.4.3 olay dili) — iki kâhinde aynı.
2. Yeni senaryolar (g6–g8) eski kâhinde: çökme / fark dökümü.
"""
import importlib.util
import json
import os
import sys

YENI_TUR = {"borc_yaz", "alacak_yaz", "cek_carisiz", "acilis_evrak", "excel_taksit_karti", "kasa_duzelt", "goc", "acilis_onay", "kayit_sil", "kayit_geri_al", "kural_farki_fisi"}


def yukle_mod(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cikti(K, sen, kural, mut=0):
    try:
        return json.dumps(K.hesapla(sen, None, mut, kural), ensure_ascii=False, sort_keys=True)
    except SystemExit as e:
        return "SystemExit: %s" % e
    except AssertionError as e:
        return "AssertionError: %s" % e


def main(argv):
    E = yukle_mod("defter_eski", os.path.join(argv[1], "kahin.py"))
    Y = yukle_mod("defter_yeni", os.path.join(argv[2], "kahin.py"))
    eski_d = os.path.join(argv[1], "senaryolar")
    yeni_d = os.path.join(argv[2], "senaryolar")
    eski = ["senaryo.json"] + sorted(f for f in os.listdir(eski_d) if f.endswith(".json"))
    yeni = sorted(f for f in os.listdir(yeni_d) if f.endswith(".json") and f not in os.listdir(eski_d))

    def oku(kok, f):
        p = os.path.join(kok, f) if f == "senaryo.json" else os.path.join(kok, "senaryolar", f)
        with open(p, encoding="utf-8") as g:
            return json.load(g)

    toplam, esit, farkli = 0, 0, []
    for f in eski:
        se, sy = oku(argv[1], f), oku(argv[2], f)
        if se != sy:
            print("UYARI: %s dosyası değişmiş" % f)
        senler = [(f, sy)]
        if f == "senaryo.json":
            # 2.4.9 kuralı için eski olay dili: 2.5.0 olayları ve 2.5.0 evrakının karşılıksızı çıkarılır
            yeniler = {o["id"] for o in sy["olaylar"] if o["tur"] in YENI_TUR or o.get("beklenen") == "ret"}
            ol = [o for o in sy["olaylar"] if o["id"] not in yeniler and not (o["tur"] == "karsiliksiz" and o.get("cek") in yeniler)]
            senler.append(("senaryo.json[2.4.3 olayları]", dict(sy, olaylar=ol)))
        for ad, sen in senler:
            for kural in ("2.5.0", "2.4.9"):
                for mut in [0] + list(range(1, 35)):
                    toplam += 1
                    a, b = cikti(E, sen, kural, mut), cikti(Y, sen, kural, mut)
                    if a == b:
                        esit += 1
                    else:
                        farkli.append((ad, kural, mut))
    print("EŞDEĞERLİK (eski senaryolar; kural 2.5.0 + 2.4.9; mutasyonsuz + mutant 1–34): %d/%d bayt bayt aynı%s" % (esit, toplam, "" if not farkli else " — FARKLI: %s" % farkli[:30]))
    sy = oku(argv[2], "senaryo.json")
    yeniler = {o["id"] for o in sy["olaylar"] if o["tur"] in YENI_TUR or o.get("beklenen") == "ret"}
    s243 = dict(sy, olaylar=[o for o in sy["olaylar"] if o["id"] not in yeniler and not (o["tur"] == "karsiliksiz" and o.get("cek") in yeniler)])
    tam = cikti(Y, s243, "2.4.9")
    print("senaryo.json[2.4.3 olayları] 2.4.9 çıktısı çökmeden üretildi: %s (%d olay; mizan kontrolü %d)" % (
        not tam.startswith(("SystemExit", "AssertionError")), len(s243["olaylar"]), len(json.loads(tam)["kontroller"]) if tam.startswith("{") else 0))
    print("\nYENİ SENARYOLAR — eski (bakım 1) kâhinde 2.5.0:")
    for f in yeni:
        sen = oku(argv[2], f)
        a, b = cikti(E, sen, "2.5.0"), cikti(Y, sen, "2.5.0")
        if a.startswith(("SystemExit", "AssertionError")):
            print("  %s: eski kâhin ÇÖKTÜ — %s" % (f, a[:300]))
        else:
            print("  %s: eski kâhin çalıştı; aynı mı: %s" % (f, a == b))
        print("  %s: yeni kâhin %s" % (f, "ÇÖKTÜ " + b[:200] if b.startswith(("SystemExit", "AssertionError")) else "çalıştı"))
    print("# tests %d\n# pass %d\n# fail %d" % (toplam, esit, len(farkli)))
    return 0 if not farkli else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
