#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge numara/gönderim senaryo üreteci — dil `destekofis-ebelge/3` (varsayılan), `/2` ya da `/1` (tohumlu, belirlenimli).

  python3 -I test/bagimsiz/ebelge/uretici.py --tohum 7 [--islem 100] [--dil 3] [--cikti <dosya>]

/3 ekleri (23.10.2026): Sil (Silinenler'e — kâğıt, bırakılmış, numarasız bekleyen, ara sıra başka belge) ve Silinenler'den Geri Yükle (K38/K39, E6); seçimler
ayrı akıştan (r3) — /2 tohum dizisi /3'te aynı kalmaz (yeni işlem araya girer).

/2 ekleri: e-SMM makbuzu (kaydet "belge_turu": "esmm"; kişi ve tüzel alıcı), Seçilenleri Gönder (seçili adımda "eski": "ekle" | "vazgec" — K33
ön sorusuna kullanıcının yanıtı), Yalnız Programda İptal (iptal "yerel": true), üç yeni cari (il yok · vergi dairesi yok · Nihai Tüketici) ve büyük
tutar ("tutar": "buyuk" — K36), iptal süresi sınırına (8./9. gün) düşen gün ilerletmeleri. /1 üretimi UX15'siz modelle eski akışı izler.

Senaryo: 5 cari (iki kişi → e-Arşiv; işaretli mükellef + PK → e-Fatura; işaretli PK'sız → e-Fatura, gönderilemez; işaretsiz gerçek mükellef →
e-Arşiv, gönderilemez), iki e-seri (TEF, TEA) + kâğıt (FIS). Başlangıç günü tohumdan: ay ortası, ay sonu, yıl dönümü (27.12 → ocak), şubat.
İşlemler: kaydet (sonra/şimdi; geriye tarihli, bugün, ileri tarih reddi), kâğıt kaydet, kartta Gönder, Tümünü Gönder (hepsi / seçili),
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

DIL1 = "destekofis-ebelge/1"
DIL2 = "destekofis-ebelge/2"

BASLANGICLAR = ["2026-06-17", "2026-12-27", "2026-01-28", "2026-03-30", "2026-02-26", "2026-08-31"]
CARILER = {"K1": "kisi", "K2": "mukellef", "K3": "mukellef_pksiz", "K4": "gizli_mukellef", "K5": "kisi"}
CARI_AGIRLIK = [("K1", 35), ("K5", 15), ("K2", 30), ("K3", 10), ("K4", 10)]
CARILER2 = dict(CARILER, K6="ilsiz_kisi", K7="vdsiz_mukellef", K8="nihai")
CARI_AGIRLIK2 = [("K1", 30), ("K5", 12), ("K2", 27), ("K3", 8), ("K4", 8), ("K6", 3), ("K7", 3), ("K8", 6)]
SMM_CARI = [("K1", 45), ("K5", 25), ("K2", 30)]


def agirlikli(r, secenekler):
    toplam = sum(a for _, a in secenekler)
    x = r.uniform(0, toplam)
    for s, a in secenekler:
        x -= a
        if x <= 0:
            return s
    return secenekler[-1][0]


def uret(tohum, islem=100, dil=3):
    r = random.Random(tohum)
    r2 = random.Random(tohum * 1000003 + 2)  # /2 seçimleri ayrı akıştan (tohum aynıyken /1 akışı bozulmasın)
    r3 = random.Random(tohum * 7919 + 3)  # /3 seçimleri ayrı akıştan
    v2 = dil >= 2
    v3 = dil == 3
    bugun = r.choice(BASLANGICLAR)
    senaryo = {"dil": {1: DIL1, 2: DIL2, 3: DIL}[dil], "ad": f"ebelge-t{tohum}-i{islem}" + {1: "-d1", 2: "-d2", 3: ""}[dil], "tohum": tohum, "bugun": bugun,
               "cariler": dict(CARILER2 if v2 else CARILER), "adimlar": []}
    m = Model(senaryo, ux15=v2)
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
        if v3 and r3.random() < 0.07:
            # K39 Sil / Geri Yükle: çoğunlukla kâğıt, bırakılmış ya da numarasız bekleyen belge; ara sıra herhangi biri (gönderilmiş → red beklenir)
            copte = belgeler(lambda b: b.get("cop"))
            if copte and r3.random() < 0.35:
                ekle({"islem": "geri_yukle", "belge": r3.choice(copte)["ad"]})
                continue
            uygun = belgeler(lambda b: not b.get("cop") and (b["tur"] == "kagit" or b["silindi"] or (not b["numara"] and not b["prog"])))
            hepsi = belgeler(lambda b: not b.get("cop"))
            xs = uygun if uygun and r3.random() < 0.85 else hepsi
            if xs:
                ekle({"islem": "sil", "belge": r3.choice(xs)["ad"]})
                continue
        secim = agirlikli(r, [
            ("kaydet_sonra", 24), ("kaydet_simdi", 15), ("kagit", 3), ("kart_gonder", 8), ("tumunu", 8), ("secili", 3),
            ("listeden_sil", 5), ("iptal", 5), ("duzenle_tarih", 5), ("duzenle_tur", 2), ("ariza", 4), ("ag_yok", 3),
            ("esz", 2), ("tur_sil", 3), ("durum", 3), ("gun", 6), ("ileri", 1),
        ])
        if v3 and secim == "kaydet_sonra" and r3.random() < 0.1:
            secim = "kagit"  # /3: K38/K39 kâğıt seride silme ve sıra için daha çok kâğıt belge
        if v2 and secim in ("kaydet_sonra", "kaydet_simdi") and r2.random() < 0.3:
            secim = "smm_" + secim  # K34: kayıtların ~%30'u e-SMM makbuzu
        if secim in ("kaydet_sonra", "kaydet_simdi", "ileri", "kagit", "smm_kaydet_sonra", "smm_kaydet_simdi"):
            sayac += 1
            geri = agirlikli(r, [(0, 40), (r.randint(1, 3), 35), (r.randint(4, 12), 20), (r.randint(13, 25), 5)])
            t = (date.fromisoformat(bugun) + timedelta(days=1)).isoformat() if secim == "ileri" else tarih(geri)
            cari = agirlikli(r, CARI_AGIRLIK)
            if v2:
                cari = agirlikli(r2, SMM_CARI if secim.startswith("smm_") else CARI_AGIRLIK2)
            adim = {"islem": "kagit_kaydet" if secim == "kagit" else "kaydet", "belge": f"B{sayac}", "cari": cari, "tarih": t}
            if secim != "kagit":
                adim["gonder"] = "simdi" if secim.endswith("kaydet_simdi") else "sonra"
            if secim.startswith("smm_"):
                adim["belge_turu"] = "esmm"
            if v2 and secim != "kagit" and r2.random() < (0.5 if cari == "K8" else 0.04):
                adim["tutar"] = "buyuk"
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
            # /3: Silinenler'deki belge Gönderilecekler'de görünmez, seçilemez (yalnız API yolu — seçimden dışarıda)
            xs = belgeler(lambda b: b["tur"] != "kagit" and not b["prog"] and not b.get("cop"))
            if xs:
                adim = {"islem": "tumunu_gonder", "kapsam": "secili", "belgeler": sorted({b["ad"] for b in r.sample(xs, min(len(xs), r.randint(1, 3)))})}
                if v2 and r2.random() < 0.85:
                    adim["eski"] = "ekle" if r2.random() < 0.6 else "vazgec"  # K33: Seçilenleri Gönder (yoksa eski { ids } yolu)
                ekle(adim)
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
                adim = {"islem": "iptal", "belge": r.choice(xs if r.random() < 0.95 else belgeler())["ad"]}
                if v2 and r2.random() < 0.3:
                    adim["yerel"] = True  # K35: Yalnız Programda İptal
                ekle(adim)
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
                ekle({"islem": "duzenle_tur", "belge": b["ad"], "profil": "EARSIVFATURA" if b["tur"] in ("efatura", "esmm") else "TEMELFATURA"})
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
            g = agirlikli(r, [(1, 60), (2, 20), (3, 15), (9, 5)])
            if v2 and r2.random() < 0.25:
                g = r2.choice([7, 8, 9])  # K22: iptal süresi sınırına düşsün
            ekle({"islem": "gun_ilerlet", "gun": g})
        ariza_bekliyor = m.dunyalar[0].ariza is not None
    ekle({"islem": "ag", "durum": "var"})
    if m.dunyalar[0].ariza is not None:
        # Bekleyen tek atımlık arıza son tura düşerse belge sonda Sonucu Belirsiz kalır ve I18 (sonda tutarlılık) haksız ateşlenir (kâhin hatası
        # düzeltmesi 23.10.2026, tohum 3 × 150 adım 150): arıza önce ayrı bir turda tüketilir, son tur belirsizi çözer.
        ekle({"islem": "tumunu_gonder", "kapsam": "hepsi"})
    ekle({"islem": "tumunu_gonder", "kapsam": "hepsi"})
    return senaryo


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tohum", type=int, required=True)
    p.add_argument("--islem", type=int, default=100)
    p.add_argument("--dil", type=int, choices=(1, 2, 3), default=3)
    p.add_argument("--cikti")
    a = p.parse_args()
    s = uret(a.tohum, a.islem, dil=a.dil)
    metin = json.dumps(s, ensure_ascii=False, indent=1)
    if a.cikti:
        with open(a.cikti, "w", encoding="utf-8") as f:
            f.write(metin + "\n")
    else:
        print(metin)
    return 0


if __name__ == "__main__":
    sys.exit(main())
