"""Bakım 3 E1 kırmızı kanıtı: YENİ hijyen kuralı (uretici.valor_tatilsiz) ESKİ üreticinin (71ee26f) tohumlu senaryolarına uygulanır.
python3 pos_tatil_kirmizi.py <yeni klasör> <eski klasör>"""
import datetime as dt
import importlib.util
import sys


def yukle(ad, yol, klasor):
    sys.path.insert(0, klasor)
    sp = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    sys.path.pop(0)
    return m


yeni = yukle("uretici_yeni", sys.argv[1] + "/uretici.py", sys.argv[1])
for ad in ("model", "senaryolar_elle"):
    sys.modules.pop(ad, None)
eski = yukle("uretici_eski", sys.argv[2] + "/uretici.py", sys.argv[2])
kirmizi = 0
for t in eski.TOHUMLAR:
    s = eski.uret(t)
    kotu = [(x.get("id"), x["tarih"], x["valor"]) for x in s["olaylar"] if x.get("yol") == "pos" and x.get("valor")
            and not yeni.valor_tatilsiz(x["tarih"], dt.date.fromisoformat(x["valor"]))]
    print(f"tohum {t}: tatile düşen POS valörü {kotu}")
    kirmizi += bool(kotu)
print(f"# tests {len(eski.TOHUMLAR)}")
print(f"# pass {len(eski.TOHUMLAR) - kirmizi}")
print(f"# fail {kirmizi}")
sys.exit(1 if kirmizi else 0)
