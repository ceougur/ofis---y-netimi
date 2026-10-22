#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge numara/gönderim senaryo üreteci — dil `destekofis-ebelge/1` (tohumlu, belirlenimli).

  python3 -I test/bagimsiz/ebelge/uretici.py --tohum 7 [--islem 100] [--cikti <dosya>]

Senaryo: 5 cari (iki kişi → e-Arşiv; işaretli mükellef + PK → e-Fatura; işaretli PK'sız → e-Fatura, gönderilemez; işaretsiz gerçek mükellef →
e-Arşiv, gönderilemez), iki e-seri (TEF, TEA) + kâğıt (FIS). Başlangıç günü tohumdan: ay ortası, ay sonu, yıl dönümü (27.12 → ocak), şubat.
İşlemler: kaydet (sonra/şimdi; geriye tarihli, bugün, ileri tarih reddi), kâğıt kaydet, kartta Gönder, Tümünü Gönder (hepsi) / Seçilenleri Gönder
(seçili; K33 ön sorusuna "onları da ekle" ya da "vazgeç"),
iki oturum eşzamanlı Tümünü Gönder, tur sürerken Listeden Sil, Listeden Sil, İptal, Düzenle (tarih; numaralıda tür), EDM arızası (geçici
hata, kopma önce/sonra), ağ yok/var, Durum Sorgula, gün ilerlet. Son iki adım her zaman: ağ var + Tümünü Gönder.
Üreteç hedef seçerken modelin ilk dünyasına bakar (anlamlı hedefler için); beklenen değer YAZMAZ.
"""

import argparse
import json
import os
import random
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import DIL, Model  # noqa: E402

BASLANGICLAR = ["2026-06-17", "2026-12-27", "2026-01-28", "2026-03-30", "2026-02-26", "2026-08-31"]
CARILER = {"K1": "kisi", "K2": "mukellef", "K3": "mukellef_pksiz", "K4": "gizli_mukellef", "K5": "kisi"}
CARI_AGIRLIK = [("K1", 35), ("K5", 15), ("K2", 30), ("K3", 10), ("K4", 10)]


def agirlikli(r, secenekler):
    toplam = sum(a for _, a in secenekler)
    x = r.uniform(0, toplam)
    for s, a in secenekler:
        x -= a
        if x <= 0:
            return s
    return secenekler[-1][0]


def uret(tohum, islem=100):
    r = random.Random(tohum)
    bugun = r.choice(BASLANGICLAR)
    senaryo = {"dil": DIL, "ad": f"ebelge-t{tohum}-i{islem}", "tohum": tohum, "bugun": bugun, "cariler": dict(CARILER), "adimlar": []}
    m = Model(senaryo)
    sayac = 0
    ag = True
    ariza_bekliyor = False

    def ekle(adim):
        adim["no"] = len(senaryo["adimlar"]) + 1
        senaryo["adimlar"].append(adim)
        m.adim(adim)
        m.sec()

    def belgeler(kosul=lambda b: True):
        d = m.dunyalar[0]
        return [b for b in d.belgeler.values() if b.get("var") is True and kosul(b)]

    def tarih(geri):
        return (date.fromisoformat(m.dunyalar[0].bugun) - timedelta(days=geri)).isoformat()

    while len(senaryo["adimlar"]) < islem - 2:
        bugun = m.dunyalar[0].bugun
        if not ag and r.random() < 0.35:
            ag = True
            ekle({"islem": "ag", "durum": "var"})
            continue
        secim = agirlikli(r, [
            ("kaydet_sonra", 24), ("kaydet_simdi", 15), ("kagit", 3), ("kart_gonder", 8), ("tumunu", 8), ("secili", 3),
            ("listeden_sil", 5), ("iptal", 5), ("duzenle_tarih", 5), ("duzenle_tur", 2), ("ariza", 4), ("ag_yok", 3),
            ("esz", 2), ("tur_sil", 3), ("durum", 3), ("gun", 6), ("ileri", 1),
        ])
        if secim in ("kaydet_sonra", "kaydet_simdi", "ileri", "kagit"):
            sayac += 1
            geri = agirlikli(r, [(0, 40), (r.randint(1, 3), 35), (r.randint(4, 12), 20), (r.randint(13, 25), 5)])
            t = (date.fromisoformat(bugun) + timedelta(days=1)).isoformat() if secim == "ileri" else tarih(geri)
            adim = {"islem": "kagit_kaydet" if secim == "kagit" else "kaydet", "belge": f"B{sayac}", "cari": agirlikli(r, CARI_AGIRLIK), "tarih": t}
            if secim != "kagit":
                adim["gonder"] = "simdi" if secim == "kaydet_simdi" else "sonra"
            ekle(adim)
        elif secim == "kart_gonder":
            xs = belgeler(lambda b: b["tur"] != "kagit") or belgeler()
            if xs:
                # çoğunlukla bekleyen; arada gönderilmiş/iptal/silinmiş belge
                bek = [b for b in xs if not b["prog"] and not b["iptal"]]
                ekle({"islem": "kart_gonder", "belge": r.choice(bek if bek and r.random() < 0.85 else xs)["ad"]})
        elif secim == "tumunu":
            ekle({"islem": "tumunu_gonder", "kapsam": "hepsi"})
        elif secim == "secili":
            xs = belgeler(lambda b: b["tur"] != "kagit" and not b["prog"])
            if xs:
                # K33: seçilmemiş eski bekleyen sorulursa kullanıcının yanıtı ("ekle" / "vazgec"); RNG akışını değiştirmemek için adım sırasından.
                ekle({"islem": "tumunu_gonder", "kapsam": "secili", "belgeler": sorted({b["ad"] for b in r.sample(xs, min(len(xs), r.randint(1, 3)))}),
                      "eski": "ekle" if len(senaryo["adimlar"]) % 2 == 0 else "vazgec"})
        elif secim == "esz":
            ekle({"islem": "esz_tumunu_gonder"})
        elif secim == "tur_sil":
            # Çoğunlukla turda önünde gönderilebilir başka belge olan bir bekleyen (silme tur sürerken işlensin — K15);
            # yoksa herhangi bir bekleyen.
            d0 = m.dunyalar[0]
            sira = [b for b in d0.sira_listesi(None) if d0.engel(b) is None and not d0.tarih_engeli(b)]
            xs = belgeler(lambda b: b["tur"] != "kagit" and not b["prog"] and not b["iptal"] and not b["silindi"])
            if len(sira) >= 2 and r.random() < 0.8:
                ekle({"islem": "tur_sirasinda_sil", "belge": r.choice(sira[1:])["ad"]})
            elif xs:
                ekle({"islem": "tur_sirasinda_sil", "belge": r.choice(xs)["ad"]})
        elif secim == "listeden_sil":
            xs = belgeler(lambda b: b["tur"] != "kagit" and not b["prog"] and not b["iptal"])
            if xs:
                ekle({"islem": "listeden_sil", "belge": r.choice(xs if r.random() < 0.9 else belgeler())["ad"]})
        elif secim == "iptal":
            xs = belgeler(lambda b: not b["iptal"])
            if xs:
                ekle({"islem": "iptal", "belge": r.choice(xs if r.random() < 0.95 else belgeler())["ad"]})
        elif secim == "duzenle_tarih":
            xs = belgeler(lambda b: not b["iptal"])
            if xs:
                b = r.choice(xs)
                geri = r.choice([0, 1, 2, 3, 5, 8, 15])
                t = (date.fromisoformat(bugun) + timedelta(days=1)).isoformat() if r.random() < 0.05 else tarih(geri)
                ekle({"islem": "duzenle_tarih", "belge": b["ad"], "tarih": t})
        elif secim == "duzenle_tur":
            xs = belgeler(lambda b: b["numara"] and b["tur"] != "kagit")
            if xs:
                b = r.choice(xs)
                ekle({"islem": "duzenle_tur", "belge": b["ad"], "profil": "EARSIVFATURA" if b["tur"] == "efatura" else "TEMELFATURA"})
        elif secim == "ariza":
            if ag and not ariza_bekliyor:
                ekle({"islem": "ariza", "tur": agirlikli(r, [("gecici_hata", 40), ("kopma_once", 30), ("kopma_sonra", 30)])})
        elif secim == "ag_yok":
            if ag:
                ag = False
                ekle({"islem": "ag", "durum": "yok"})
        elif secim == "durum":
            xs = belgeler(lambda b: b["tur"] != "kagit" and (b["numara"] or b["edm"]))
            if xs:
                ekle({"islem": "durum_sorgula", "belge": r.choice(xs)["ad"]})
        elif secim == "gun":
            ekle({"islem": "gun_ilerlet", "gun": agirlikli(r, [(1, 60), (2, 20), (3, 15), (9, 5)])})
        ariza_bekliyor = m.dunyalar[0].ariza is not None
    ekle({"islem": "ag", "durum": "var"})
    ekle({"islem": "tumunu_gonder", "kapsam": "hepsi"})
    return senaryo


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tohum", type=int, required=True)
    p.add_argument("--islem", type=int, default=100)
    p.add_argument("--cikti")
    a = p.parse_args()
    s = uret(a.tohum, a.islem)
    metin = json.dumps(s, ensure_ascii=False, indent=1)
    if a.cikti:
        with open(a.cikti, "w", encoding="utf-8") as f:
            f.write(metin + "\n")
    else:
        print(metin)
    return 0


if __name__ == "__main__":
    sys.exit(main())
