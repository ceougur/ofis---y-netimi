#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhininin programsız öz denetimi (2.5.0 Ç5 bakımı; KARARLAR.md §13). Program AÇILMAZ.

  python3 -I test/bagimsiz/cari/oz-test.py

1. Elle tablolar: senaryolar/*.json içindeki `elleBeklenen` (elle hesaplanmış beklenenler, kuruş) ↔ 2.5.0 kâhininin çıktısı; `elleCatal`: ÇATAL denetimlerin dalları.
2. Mutantlar 200–213 (kâhinin dişi): her biri en az bir elle senaryoda 2.5.0 çıktısını DEĞERLE değiştirmeli (çökme de yakalandı sayılır — kos.mjs düzeni).
3. Çapraz denetim: tek yükümlülük kuyruğu (C13.4 (2)(3)(4)) "saf" bir zaman çizelgesi simülasyonuyla — yalnız fatura / elle Borç / borçlu Açılış / tahsilat (bağlı ya da bağsız)
   olan carilerde (kart, iade, evrak, kapatıcı, ödeme, şüpheli YOK) — model.py'nin açık / Kalan değerleri bire bir aynı olmalı. Senaryolar: elle /3 dosyaları + uretici.py
   rastgele s1 ve ux18 (tohum 1–3 × 60).
4. 2.4.9 eşitliği: kartsız, vadesiz (vade alanı boş) carilerde 2.5.0 ve 2.4.9 açık / Kalan değerleri aynı olmalı (ANINDA = HAVUZ, tarih sıralı alanda; C13.4 (4)).
Çıktı: TAP benzeri sayılar + son satır "N/M denetim geçti". Çıkış 0 yalnız hepsi geçerse.
"""
import importlib.util
import json
import os
import subprocess
import sys
from collections import defaultdict

BURASI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("kahin_cari_model_oz", os.path.join(BURASI, "model.py"))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)


def yukle(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def calistir(sen, mut=0, kural="2.5.0"):
    m = M.Model(sen, mut, kural)
    return m, m.kos()["denetimler"]


def saf_tyk(m, cari):
    """C13.4'ün saf okuması (model.py'den bağımsız yazıldı): olay listesi tarih → (borç kalemleri önce) → yazım sırası; bağlı tahsilat önce kendi faturasını kapatır,
    fazlası kendi tarihinde bağsız; bağsız para o anda açık kalemlere vade → belge → yazım sırasıyla; artan avans sonra doğan kaleme. Dönüş {kalem: kalan}."""
    kalem = {}
    for ad, f in m.faturalar.items():
        if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis":
            kalem[ad] = [f["tarih"], f["tarih"], f["seq"], f["tutar"]]
    for hn, h in m.hareketler.items():
        if h["cari"] == cari and h["aktif"] and (h["tur"] == "borc" or (h["tur"] == "acilis" and h["yon"] == "borc")):
            kalem[hn] = [h["tarih"], h.get("vade") or h["tarih"], h["seq"], h["tutar"]]
    para = []
    bagli = defaultdict(list)
    for tn, t in m.tahsilatlar.items():
        if t["cari"] != cari or not t["aktif"]:
            continue
        if t["fatura"] and t["fatura"] in kalem:
            bagli[t["fatura"]].append((t["tarih"], t["seq"], t["tutar"]))
        else:
            para.append((t["tarih"], t["seq"], t["tutar"]))
    for e in m.evraklar.values():
        if e["cari"] != cari or e["durum"] in ("silindi", "karsiliksiz"):
            continue  # karşılıksız evrak kapatıcı değil (S8 / B2.2)
        if e["fatura"] and e["fatura"] in kalem:
            bagli[e["fatura"]].append((e["tarih"], e["seq"], e["tutar"]))
        else:
            para.append((e["tarih"], e["seq"], e["tutar"]))
    for f, liste in bagli.items():
        for tarih, seq, tutar in sorted(liste):
            x = min(kalem[f][3], tutar)
            kalem[f][3] -= x
            if tutar > x:
                para.append((tarih, seq, tutar - x))
    olaylar = sorted([(v[0], 0, v[2], ad) for ad, v in kalem.items()] + [(p[0], 1, p[1], i) for i, p in enumerate(para)])
    acik, avans = [], 0
    for tarih, sinif, _seq, ref in olaylar:
        if sinif == 0:
            acik.append(ref)
        else:
            avans += para[ref][2]
        for ad in sorted(acik, key=lambda a: (kalem[a][1], kalem[a][0], kalem[a][2])):
            x = min(kalem[ad][3], avans)
            kalem[ad][3] -= x
            avans -= x
    return {ad: v[3] for ad, v in kalem.items()}


def basit(m, cari):
    if any(kt["cari"] == cari for kt in m.kartlar.values()):
        return False
    if any(f["cari"] == cari and f["durum"] == "kesildi" and (f["tur"] != "satis" or f["taksitli"]) for f in m.faturalar.values()):
        return False
    if any(e.get("ciroCari") == cari for e in m.evraklar.values()):
        return False
    if any(x["cari"] == cari for x in m.kapaticilar.values()) or any(sp["cari"] == cari for sp in m.supheliler.values()):
        return False
    if any(o["cari"] == cari for o in m.odemeler.values()):
        return False
    if any(h["cari"] == cari and h["aktif"] and (h["tur"] == "alacak" or (h["tur"] == "acilis" and h["yon"] == "alacak")) for h in m.hareketler.values()):
        return False
    return True


def main():
    gecen, kalan, satirlar = 0, 0, []

    def denetle(ad, ok, ayrinti=""):
        nonlocal gecen, kalan
        if ok:
            gecen += 1
        else:
            kalan += 1
            satirlar.append("  ✗ %s %s" % (ad, ayrinti))

    d = os.path.join(BURASI, "senaryolar")
    elle = [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".json")]
    v3 = [p for p in elle if yukle(p).get("dil") == M.DIL]
    # 1. elle tablolar
    tabanlar = {}
    for p in v3:
        sen = yukle(p)
        ad = os.path.basename(p)
        try:
            _m, out = calistir(sen)
        except SystemExit as e:
            denetle("%s çalıştı" % ad, False, str(e))
            continue
        tabanlar[p] = out
        for k, b in (sen.get("elleBeklenen") or {}).items():
            g = out.get(k, {}).get("b", "ANAHTAR YOK")
            denetle("%s %s" % (ad, k), g == b, "elle %s · kâhin %s" % (json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False)))
        for k in sen.get("elleYok") or []:
            denetle("%s %s yok (tanımsız — kâhin kurmaz)" % (ad, k), k not in out, json.dumps(out.get(k), ensure_ascii=False))
        for k, alanlar in (sen.get("elleCatal") or {}).items():
            g = out.get(k, {}).get("b")
            dallar = g.get("catal") if isinstance(g, dict) else None
            ok = isinstance(dallar, list) and len(dallar) >= 2
            if ok:
                for alan, beklenen in alanlar.items():
                    degerler = [x.get(alan) for x in dallar]
                    ok = ok and (sorted(degerler) == sorted(beklenen) if isinstance(beklenen, list) else all(x == beklenen for x in degerler))
            denetle("%s %s ÇATAL" % (ad, k), ok, json.dumps(g, ensure_ascii=False)[:300])
    # 2. mutantlar 200–213
    for n, ad in M.MUTASYONLAR.items():
        if n < 200:
            continue
        yakalayan = []
        for p in v3:
            if p not in tabanlar:
                continue
            try:
                _m, out = calistir(yukle(p), n)
                fark = {k: v["b"] for k, v in out.items()} != {k: v["b"] for k, v in tabanlar[p].items()}
            except Exception:
                fark = True
            if fark:
                yakalayan.append(os.path.basename(p))
            if len(yakalayan) >= 3:
                break
        denetle("mutasyon %d yakalandı" % n, bool(yakalayan), ad)
        print("  mutasyon %d (%s): %s" % (n, ad, ("YAKALANDI (%s)" % ", ".join(yakalayan)) if yakalayan else "YAKALANMADI"))
    # 3. + 4. çapraz denetim (saf simülasyon) ve tarih sıralı alanda 2.4.9 eşitliği
    rastgele = []
    for tur in ("s1", "ux18"):
        for t in (1, 2, 3):
            r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "60"], capture_output=True, check=True)
            rastgele.append(("rastgele-%s-%d" % (tur, t), json.loads(r.stdout)))
    capraz, esit249 = 0, 0
    for ad, sen in [(os.path.basename(p), yukle(p)) for p in v3] + rastgele:
        if sen.get("dil") != M.DIL and not ad.startswith("rastgele-ux18"):
            continue
        try:
            m, _ = calistir(sen)
            m249, _ = calistir(sen, 0, "2.4.9")
        except SystemExit:
            continue
        for cari, c in m.cariler.items():
            if c.get("silindi") or not basit(m, cari):
                continue
            beklenen = saf_tyk(m, cari)
            model_acik = dict(m.aciklar(cari))
            model_acik.update(m.kalanlar(cari))
            for kad, v in beklenen.items():
                capraz += 1
                denetle("%s %s %s saf TYK" % (ad, cari, kad), model_acik.get(kad) == v, "saf %s · model %s" % (v, model_acik.get(kad)))
            vadesiz = not any(h["cari"] == cari and h.get("vade") for h in m.hareketler.values())
            if vadesiz:
                a249 = dict(m249.aciklar(cari))
                a249.update(m249.kalanlar(cari))
                for kad, v in beklenen.items():
                    esit249 += 1
                    denetle("%s %s %s 2.4.9 = 2.5.0 (vadesiz)" % (ad, cari, kad), a249.get(kad) == model_acik.get(kad),
                            "2.4.9 %s · 2.5.0 %s" % (a249.get(kad), model_acik.get(kad)))
    print("  çapraz denetim (saf TYK): %d kalem · tarih sıralı alanda 2.4.9 = 2.5.0: %d kalem" % (capraz, esit249))
    toplam = gecen + kalan
    if satirlar:
        print("BAŞARISIZ:")
        print("\n".join(satirlar[:80]))
    print("# tests %d" % toplam)
    print("# pass %d" % gecen)
    print("# fail %d" % kalan)
    print("%d/%d denetim geçti" % (gecen, toplam))
    return 0 if kalan == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
