#!/usr/bin/env python3
"""Defter kâhininin programsız öz denetimi (2.5.0 Ç5 bakımı; KARARLAR.md). Program AÇILMAZ.

  python3 -I test/bagimsiz/defter/oz-test.py

1. Elle tablolar: senaryo.json ve senaryolar/*.json içindeki `elleBeklenenTL` (elle hesaplanmış beklenenler, TL) kâhinin çıktısıyla karşılaştırılır
   (kontrol mizanı — `kismi` ise yalnız yazılan hesaplar —, retler, onay bekleyen liste, cari bakiyeleri, stok, yaşlandırma toplamı).
2. Değişmez: her kontrol noktasında mizan dengeli (Σ = 0).
3. Mutantlar (kâhinin dişi): 2.5.0 mutantlarının (kahin.py MUTASYONLAR_250) her biri en az bir senaryoda çıktıyı DEĞERLE değiştirmeli ("mutasyon" alanı hariç);
   mutant kâhini çökertirse (SystemExit) davranış değişmiştir — yakalandı sayılır. Yakalanmayan = eksik test.
Çıktı: TAP benzeri sayılar + son satır "N/M denetim geçti". Çıkış 0 yalnız hepsi geçerse.
"""
import importlib.util
import json
import os
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("kahin_defter", os.path.join(BURASI, "kahin.py"))
K = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(K)


def yukle(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def kurus_tl(v):
    return int(round(v * 100))


def senaryolar():
    out = [os.path.join(BURASI, "senaryo.json")]
    d = os.path.join(BURASI, "senaryolar")
    out += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".json")]
    return out


def calistir(sen, mut=0, kural=K.VARSAYILAN_KURAL):
    try:
        return K.hesapla(sen, None, mut, kural)
    except SystemExit as e:
        return {"__cokme__": str(e)}


def main():
    gecen, kalan, satirlar = 0, 0, []

    def denetle(ad, ok, ayrinti=""):
        nonlocal gecen, kalan
        if ok:
            gecen += 1
        else:
            kalan += 1
            satirlar.append("  ✗ %s %s" % (ad, ayrinti))

    dosyalar = senaryolar()
    taban = {}
    for p in dosyalar:
        sen = yukle(p)
        ad = os.path.basename(p)
        out = calistir(sen)
        taban[p] = out
        if "__cokme__" in out:
            denetle("%s çalıştı" % ad, False, out["__cokme__"])
            continue
        denetle("%s çalıştı" % ad, True)
        for k, m in out["kontroller"].items():
            denetle("%s %s mizan dengeli" % (ad, k), sum(m.values()) == 0, "Σ = %d" % sum(m.values()))
        e = sen.get("elleBeklenenTL")
        if not e:
            continue
        kismi = e.get("kismi", False)
        for k, beklenen in e.get("kontroller", {}).items():
            gercek = out["kontroller"].get(k)
            if gercek is None:
                denetle("%s %s var" % (ad, k), False, "kontrol yok")
                continue
            hesaplar = set(beklenen) if kismi else set(beklenen) | set(gercek)
            for h in sorted(hesaplar):
                b = kurus_tl(beklenen.get(h, 0))
                g = gercek.get(h, 0)
                denetle("%s %s %s" % (ad, k, h), b == g, "elle %d · kâhin %d" % (b, g))
        if "retler" in e:
            denetle("%s retler" % ad, sorted(e["retler"]) == out.get("retler"), "elle %s · kâhin %s" % (sorted(e["retler"]), out.get("retler")))
        if "acilisOlabilir" in e:
            denetle("%s acilisOlabilir" % ad, sorted(e["acilisOlabilir"]) == out.get("acilisOlabilir"),
                    "elle %s · kâhin %s" % (sorted(e["acilisOlabilir"]), out.get("acilisOlabilir")))
        for c, v in e.get("cari", {}).items():
            denetle("%s cari %s" % (ad, c), out["cari"].get(c) == kurus_tl(v), "elle %d · kâhin %s" % (kurus_tl(v), out["cari"].get(c)))
        for kod, q in e.get("stok", {}).items():
            denetle("%s stok %s" % (ad, kod), out["stok"].get(kod) == q, "elle %s · kâhin %s" % (q, out["stok"].get(kod)))
        if "yaslandirmaToplam" in e:
            b = kurus_tl(e["yaslandirmaToplam"])
            denetle("%s yaşlandırma toplam" % ad, out["yaslandirma"]["toplam"] == b, "elle %d · kâhin %d" % (b, out["yaslandirma"]["toplam"]))

    # 2.4.9 kuralı yeni olay türlerini tanımaz (eski kâhinin dünyası) — senaryo.json'da 2.5.0 olayları var
    d249 = calistir(yukle(dosyalar[0]), 0, "2.4.9")
    denetle("senaryo.json --kural 2.4.9 yeni olay türünü reddeder", "__cokme__" in d249, str(d249)[:120])

    def deger(o):
        return {k: v for k, v in o.items() if k != "mutasyon"}

    yakalanmayan = []
    for n, ad in K.MUTASYONLAR_250.items():
        yakalayan = []
        for p in dosyalar:
            if "__cokme__" in taban[p]:
                continue
            m = calistir(yukle(p), n)
            if "__cokme__" in m or deger(m) != deger(taban[p]):
                yakalayan.append(os.path.basename(p) + (" (çöktü)" if "__cokme__" in m else ""))
        ok = bool(yakalayan)
        denetle("mutasyon %d yakalandı" % n, ok, ad)
        print("  mutasyon %d (%s): %s" % (n, ad, ("YAKALANDI (%s)" % ", ".join(yakalayan[:3])) if ok else "YAKALANMADI"))
        if not ok:
            yakalanmayan.append(n)

    toplam = gecen + kalan
    if satirlar:
        print("BAŞARISIZ:")
        print("\n".join(satirlar))
    print("# tests %d" % toplam)
    print("# pass %d" % gecen)
    print("# fail %d" % kalan)
    print("%d/%d denetim geçti" % (gecen, toplam))
    return 0 if kalan == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
