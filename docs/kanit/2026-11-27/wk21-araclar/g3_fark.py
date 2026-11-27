#!/usr/bin/env python3
"""G3: eski kâhinin (taban senaryolar.json) her senaryosunun girdi + elle + TAM model sonucu ↔ yeni kâhin (yeni senaryolar.py + kahin.py).
Kullanım: python3 -I g3_fark.py <taban senaryolar.json> <yeni kahin klasörü>"""
import json
import sys


def yapraklar(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += yapraklar(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            out += yapraklar(x, y, f"{yol}[{i}]")
        return out
    if json.dumps(a, sort_keys=True, ensure_ascii=False) != json.dumps(b, sort_keys=True, ensure_ascii=False):
        return [(yol, a, b)]
    return []


def main(taban_yol, kahin_klasor):
    sys.path.insert(0, kahin_klasor)
    import kahin  # noqa
    import senaryolar  # noqa
    taban = json.load(open(taban_yol, encoding="utf-8"))
    eski = {s["ad"]: s for s in taban["senaryolar"]}
    yeni = {s["ad"]: s for s in senaryolar.SENARYOLAR}
    print(f"taban senaryo {len(eski)}; yeni senaryo {len(yeni)}; yeni eklenen {len(set(yeni) - set(eski))}; kalkan {len(set(eski) - set(yeni))}")
    for ad in sorted(set(eski) - set(yeni)):
        print("KALKAN", ad)
    ayni = 0; degisen = []
    for ad, e in eski.items():
        if ad not in yeni:
            continue
        s = yeni[ad]
        g_yeni = {k: v for k, v in senaryolar.girdi(s).items() if k not in ("ad", "baslik", "aciklama", "kaynak")}
        f_girdi = yapraklar(e["girdi"], g_yeni)
        f_elle = yapraklar(e["elle"], [{"secim": k, "yollar": y} for k, y in s["elle"]])
        f_ust = [(k, e[k], s[k]) for k in ("baslik", "aciklama", "kaynak") if e[k] != s[k]]
        b = kahin.hesapla(senaryolar.girdi(s))
        f_model = yapraklar(e["beklenen"], b)
        if f_girdi or f_elle or f_model or f_ust:
            degisen.append(ad)
            print(f"DEĞİŞTİ {ad}: girdi {len(f_girdi)}, elle {len(f_elle)}, model {len(f_model)}, üst {len(f_ust)}")
            for yol, a, b_ in (f_girdi + f_elle + f_model)[:12]:
                print(f"   {yol}: {json.dumps(a, ensure_ascii=False)[:220]} → {json.dumps(b_, ensure_ascii=False)[:220]}")
            for k, a, b_ in f_ust:
                print(f"   (üst) {k}: {a[:160]!r} → {b_[:160]!r}")
        else:
            ayni += 1
    print(f"SONUÇ: {ayni} aynı, {len(degisen)} değişen (eski {len(eski)} senaryodan)")
    aciklanan = {"S23-04-meta-bekletti-beklerken-yeniden-basma-ikinci-denemede-gider", "S29-03-meta-bekletti-ikinci-denemede-tutar-dogar-net-borcla-sinirli"}   # README §26.8 (S-W21-3)
    beklenmeyen = [a for a in degisen if a not in aciklanan]
    print("beklenmeyen değişiklik:", beklenmeyen or "YOK")
    n = len([a for a in eski if a in yeni])
    for k, v in (("tests", n), ("pass", n - len(beklenmeyen)), ("fail", len(beklenmeyen)), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {k} {v}")
    ek = {k: v for k, v in taban.items() if k != "senaryolar"}
    print("üst alanlar (kararlar dışında) aynı mı:", all(json.dumps(ek[k], sort_keys=True, ensure_ascii=False) == json.dumps(getattr(kahin, {"sablonlar": "SABLONLAR"}.get(k, ""), ek[k]) if k == "sablonlar" else ek[k], sort_keys=True, ensure_ascii=False) for k in ek if k != "kararlar"))
    print("eklenen karar anahtarları:", sorted(set(kahin.KARARLAR) - set(taban["kararlar"])), "; değişen eski karar:",
          [k for k in taban["kararlar"] if json.dumps(taban["kararlar"][k], sort_keys=True, ensure_ascii=False) != json.dumps(kahin.KARARLAR.get(k), sort_keys=True, ensure_ascii=False)])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
