#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 18 aracı: YENİ senaryoları (yeni senaryolar.py'deki girdi + elle beklenen) ESKİ kâhinle (değişiklikten ÖNCE alınmış kopya, taban 75f1aad9) koşar.

Kipler (eski kopya geçici, benzersiz bir klasöre kopyalanıp yamanır; asıl kopyaya dokunulmaz):
  ham          eski kahin.py aynen (yeni girdi {"gec", "yanit"} eski kâhinde tanınmaz → sınıfsız yanıt; zayıf neden — ders 38)
  uyarlanmis   eski kahin.py + YALNIZ girdi düzeneği: gecikmeli yanıt {"gec", "yanit"} J6 gec_kabul gibi bekletilir, yanıt gelince eski gonder()'in KENDİ satırlarıyla işlenir
               (satırlar eski dosyadan kesilip yöntem yapılır; S42 kuralı EKLENMEZ) → Gönderiliyor anında talep eski kâhinin S35-a hatasına ulaşır (beklenen neden)
  notr         uyarlanmis + eski S35-a hata satırı etkisiz (`None and ValueError(…)`) — karar yokken düşülecek yol (kural eklenmedi)
Kullanım: python3 -I eski_kahinle.py <eski_kahin_klasoru> <yeni_kahin_klasoru> <ham|uyarlanmis|notr> <senaryo önekleri virgüllü>"""
import importlib.util
import json
import os
import shutil
import sys
import tempfile

sys.dont_write_bytecode = True
eski_dir, yeni_dir, kip, onekler = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(",")


def degistir(metin, eski, yeni, ad):
    if metin.count(eski) != 1:
        raise SystemExit(f"YAMA {ad}: desen {metin.count(eski)} kez (1 olmalı)")
    return metin.replace(eski, yeni)


kaynak = open(os.path.join(eski_dir, "kahin.py"), encoding="utf-8").read()
if kip in ("uyarlanmis", "notr"):
    # P1: gecikmeli yanıtın girdi düzeneği (J6 gec_kabul'ün genellemesi; kural yok)
    kaynak = degistir(kaynak,
                      '        if isinstance(y, dict) and "gec_kabul" in y:        # J6/J7: Meta kabul etti, HTTP yanıtı (zaman aşımından önce) gecikmeli — program "Gönderiliyor"da bekler\n'
                      '            self.meta_ileti(j, ts, programa=False)\n'
                      '            varis = zaman_ayristir(y["gec_kabul"], ts)\n',
                      '        if isinstance(y, dict) and ("gec_kabul" in y or "gec" in y):   # WK18 UYARLAMA (yalnız girdi düzeneği)\n'
                      '            ic = "kabul" if "gec_kabul" in y else y.get("yanit")\n'
                      '            if ic in ("kabul", "yanitsiz_kabul"):\n'
                      '                self.meta_ileti(j, ts, programa=False)\n'
                      '            varis = zaman_ayristir(y["gec_kabul"] if "gec_kabul" in y else y["gec"], ts)\n', "P1a")
    kaynak = degistir(kaynak, '{"tur": "_yanit", "is": j.anahtar, "rid": j.son_kayit,', '{"tur": "_yanit", "is": j.anahtar, "rid": j.son_kayit, "yanit": ic,', "P1b")
    # P2: yanıt gelince kabul DIŞI sonuç eski gonder()'in kuyruk satırlarıyla (aynen kesilir)
    bas = '        if y in ("yanitsiz_kabul", "yanitsiz_red"):\n            if y == "yanitsiz_kabul":\n                self.meta_ileti(j, ts, programa=False)\n'
    son = '        self.hata_isle(j, tp, kod, ts)\n\n    def baglanti_yok('
    i, k = kaynak.index(bas), kaynak.index(son)
    govde = '        if y in ("yanitsiz_kabul", "yanitsiz_red"):\n' + kaynak[i + len(bas):k] + '        self.hata_isle(j, tp, kod, ts)\n'
    yontem = "    def _wk18_gec_sonuc(self, j, tp, waba, y, ts):   # WK18 UYARLAMA: eski gonder()'in kabul dışı yanıt satırları AYNEN\n" + govde + "\n"
    kaynak = kaynak.replace("    def baglanti_yok(", yontem + "    def baglanti_yok(", 1)
    kaynak = degistir(kaynak,
                      '        tp = self.toplular[j.toplu]\n        self.programa_kabul(j, o["wamid"], t)\n',
                      '        tp = self.toplular[j.toplu]\n'
                      '        if o.get("yanit", "kabul") != "kabul":           # WK18 UYARLAMA\n'
                      '            return self._wk18_gec_sonuc(j, tp, self.wabalar[tp.sirket], o["yanit"], t)\n'
                      '        self.programa_kabul(j, o["wamid"], t)\n', "P2")
if kip == "notr":
    kaynak = degistir(kaynak, 'raise ValueError("KULLANICIYA SORULMALI S35-a', 'None and ValueError("KULLANICIYA SORULMALI S35-a', "P3")

cikis = 0
gecici = tempfile.mkdtemp(prefix=f"wk18-eski-{kip}-", dir=os.path.dirname(os.path.abspath(__file__)))   # kendi benzersiz klasörü (ders 25); yalnız bu tam yol silinir (ders 36)
try:
    with open(os.path.join(gecici, "kahin.py"), "w", encoding="utf-8") as f:
        f.write(kaynak)
    spec = importlib.util.spec_from_file_location("kahin", os.path.join(gecici, "kahin.py"))
    eski = importlib.util.module_from_spec(spec)
    sys.modules["kahin"] = eski
    spec.loader.exec_module(eski)
    sys.path.insert(0, yeni_dir)
    import senaryolar  # noqa: E402  (yeni senaryolar.py — kendi içinde 'kahin' adını sys.modules'ten, yani ESKİ kâhinden alır)
    if senaryolar.kahin is not eski:
        raise SystemExit("senaryolar eski kâhine bağlanmadı")
    # --bekle "önek=istisna:<parça>|deger|ayni;…": her senaryonun BEKLENEN sonucu (kırmızının nedeni — ders 38); TAP: beklenen gibiyse ok
    bekle = {}
    if "--bekle" in sys.argv:
        for parca in sys.argv[sys.argv.index("--bekle") + 1].split(";"):
            k, v = parca.split("=", 1)
            bekle[k] = v
    kirmizi = ayni = 0; tap = []
    for s in senaryolar.tum_senaryolar():
        if not any(s["ad"].startswith(o) for o in onekler):
            continue
        try:
            b = eski.hesapla(senaryolar.girdi(s))
            hata = None
        except Exception as e:  # noqa: BLE001
            hata = f"{type(e).__name__}: {e}"
        if hata is not None:
            kirmizi += 1; gozlem = "istisna"
            print(f"KIRMIZI (istisna) {s['ad']}: {hata[:300]}")
        else:
            f = senaryolar.elle_denetle(s, b)
            if f:
                kirmizi += 1; gozlem = "deger"
                print(f"KIRMIZI (değer, {len(f)} yaprak) {s['ad']}")
                for x in f[:4]:
                    print("    " + x[len(s['ad']) + 1:][:240])
            else:
                ayni += 1; gozlem = "ayni"
                print(f"AYNI {s['ad']}")
        b_ = next((v for k, v in bekle.items() if s["ad"].startswith(k)), None)
        if b_ is not None:
            tur, _, parca = b_.partition(":")
            tamam = gozlem == tur and (not parca or (hata is not None and parca in hata))
            tap.append((tamam, f"{s['ad']} — beklenen {b_}, gözlenen {gozlem}"))
    print(f"# kip {kip}: KIRMIZI {kirmizi}, AYNI {ayni}")
    if bekle:
        for i, (tamam, ad) in enumerate(tap, 1):
            print(f"{'ok' if tamam else 'not ok'} {i} - {ad}")
        print(f"1..{len(tap)}")
        gecen = sum(1 for t_, _a in tap if t_)
        for ad_, n_ in (("tests", len(tap)), ("pass", gecen), ("fail", len(tap) - gecen), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
            print(f"# {ad_} {n_}")
        cikis = 0 if gecen == len(tap) and tap else 1
finally:
    shutil.rmtree(gecici)
sys.exit(cikis)
