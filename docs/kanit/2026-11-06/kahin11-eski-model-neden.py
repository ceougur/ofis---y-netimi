"""Bakım 11 — eski kâhinin (d83ccf1c) yeni elle senaryolarda NEDEN kırmızı olduğunun dökümü.

Kullanım: python3 -I kahin11-eski-model-neden.py <eski kopya klasörü (d83ccf1c model.py + bakım 11 senaryolar_elle.py / test_model.py)>
1. bölüm: her yeni elle senaryo (s106–s109) eski modelde susma (senaryo hatası) ile mi düşüyor — ilk susan olay ve iletisi.
2. bölüm: susan düzeltmeler ATLANARAK (olay yok sayılır) koşulduğunda elle değerlerin hangileri farklı (değer farkı = kuralın eski modelde olmadığı).
   Düzeltmeden ÖNCEKİ raporlar (mz0, ak1a, g1a) farklı çıkarsa elle hesap hatalıdır — değişmeyen kurallar için çapraz denetim.
"""
import copy
import sys

sys.path.insert(0, sys.argv[1])
import model as M  # noqa: E402
import senaryolar_elle as E  # noqa: E402
import test_model as T  # noqa: E402

YENI = ("s106-s83-alis-formundaki-pesin-odeme-cari", "s107-s84-formdaki-pesin-bagi", "s108-s85-normal-cari-tutar-tarih",
        "s109-s85-geri-yuklenmis-cari-tutar")
ONCE = ("mz0/", "ak1a", "g1a")
print("# 1. bölüm: eski modelde ilk susma")
for s in E.SENARYOLAR:
    if s["ad"] not in YENI:
        continue
    x = dict(s, **copy.deepcopy(E.TANIM))
    try:
        M.kos(x)
        print(f"{s['ad']}: susma YOK")
    except AssertionError as e:
        print(f"{s['ad']}: SUSAR — {str(e)[:170]}")

print("\n# 2. bölüm: susan düzeltmeler atlanarak koşulunca farklı elle değerler")
eski_duzenle = M.Model._o_duzenle
atlanan = []


def sarili(self, o, d):
    try:
        return eski_duzenle(self, o, d)
    except AssertionError as e:
        atlanan.append((o["kaynak"], o.get("degisiklik"), str(e)[:70]))
        return None


M.Model._o_duzenle = sarili
for s in E.SENARYOLAR:
    if s["ad"] not in YENI:
        continue
    atlanan.clear()
    x = dict(s, **copy.deepcopy(E.TANIM))
    r = M.kos(x)
    print(f"\n{s['ad']}: atlanan (susan) düzeltme {len(atlanan)}")
    for a in atlanan:
        print("   atlandı:", a)
    fark = once_fark = 0
    for yol, bek in s["elle"]["A"].items():
        try:
            g = T.yol_al(r, yol, bek)
        except KeyError as e:
            g = f"YOK ({e})"
        if g != bek:
            fark += 1
            once = yol.startswith(ONCE)
            once_fark += once
            print(f"   FARK{' (DÜZELTME ÖNCESİ — elle hesap?)' if once else ''} {yol}: beklenen {bek!r} · eski model {g!r}")
    print(f"   {fark} anahtar farklı / {len(s['elle']['A'])}; düzeltme öncesi raporlarda fark {once_fark}")
    print(f"   değişmezler tuttu: {M.tumu_tuttu(r['degismezler'])}")
