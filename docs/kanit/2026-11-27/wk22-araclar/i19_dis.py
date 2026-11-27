#!/usr/bin/env python3
# WK 22: I19 rastgele kümesinin yeni sınıfları ne kadar ürettiği (S-W21-1 basışı, çapraz Atlandı, iki etiketli Yine de Ekle) ve yeni mutantlara karşı dişi (ihlalli senaryo sayısı).
# Kullanım: python3 -I <bu dosya> test/bagimsiz/whatsapp-248/kahin [tohum] [sayı]
import os
import random
import sys
import importlib.util

kok = os.path.abspath(sys.argv[1])
tohum = int(sys.argv[2]) if len(sys.argv) > 2 else 2511
sayi = int(sys.argv[3]) if len(sys.argv) > 3 else 120
sys.path.insert(0, kok)
spec = importlib.util.spec_from_file_location("kahin_test", os.path.join(kok, "kahin_test.py"))
kt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kt)
kahin = kt.kahin

rnd = random.Random(tohum)
kume = [kt.c5c_rastgele(rnd, no)[0] for no in range(sayi)]
sw1 = capraz = iki = 0
for g in kume:
    b = kt._IzliBenzetim(g, kahin.tam_secim({}), "hizli"); r = b.calistir()
    sw1 += sum(1 for v in (r.get("yeniden") or {}).values() if v.get("soz_etiketi") and (v.get("alinan") or v.get("elle_sayilan")))
    for (t_, an, c, n) in b.iz_atla:
        if n in (kahin.SOZ, kahin.SUPHELI) and getattr(b.isler.get(an), "supheli_elle", False):
            capraz += 1
    for o in g["olaylar"]:
        if o["tur"] == "baslat" and o.get("yine_de_ekle"):
            for c in o["yine_de_ekle"]:
                cc = next(x for x in g["cariler"] if x["id"] == c)
                ms = kahin.zaman_ayristir(o["t"], b.T0)
                e = None
                for x in cc["borc"]:
                    if kahin.zaman_ayristir(x["t"], b.T0) <= ms:
                        e = x
                if len(e.get("etiketler") or []) > 1:
                    iki += 1
print(f"# tohum {tohum} × {sayi}: S-W21-1 basışı (söz etiketiyle kabul / elle sayılan) {sw1}; elle işte etiketle Atlandı (S-W21-2) {capraz}; iki etiketli Yine de Ekle {iki}")
for mut in ("M317", "M318", "M319", "M320", "M321", "M322", "M323", "M324", "M325", "M293", "M309"):
    n = 0
    for g in kume:
        try:
            b = kt._IzliBenzetim(g, kahin.tam_secim({}), "hizli")
            b.mut = frozenset([mut])
        except Exception:
            pass
        # c5c_degismez mutantsız kurar; mutantlı Benzetim için kendi kopyası
        orj = kahin.Benzetim.__init__

        def init(self, *a, **kw):
            orj(self, *a, **kw)
            self.mut = frozenset([mut])
        kahin.Benzetim.__init__ = init
        try:
            hh, _r = kt.c5c_degismez(g, "hizli")
            n += 1 if hh else 0
        except Exception:
            n += 1
        finally:
            kahin.Benzetim.__init__ = orj
    print(f"# {mut}: ihlalli senaryo {n} / {sayi}")
