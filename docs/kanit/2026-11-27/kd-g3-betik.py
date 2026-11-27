#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""K-D G3 (eski kâhin = taban ↔ yeni): senaryolar/*.json ve senaryolar/beklenen/*.json yaprak yaprak karşılaştırılır; her değişen yaprak
bir karar numarasına bağlanır, bağlanamayan BEKLENMEYEN sayılır (çıkış 1).

  python3 -I docs/kanit/2026-11-27/kd-g3-betik.py <eski senaryolar klasörü> <yeni senaryolar klasörü> <döküm.json>

Eski klasör: bakımdan önce (t251-taban, model değişmeden) çalışma ağacından kopyalanan senaryolar/ (git geçmişi okunmadı).
"""
import json
import os
import re
import sys
from collections import Counter


def yapraklar(x, yol=""):
    if isinstance(x, dict):
        if not x:
            yield yol, {}
        for k, v in x.items():
            yield from yapraklar(v, f"{yol}/{k}" if yol else str(k))
    elif isinstance(x, list):
        if not x:
            yield yol, []
        for i, v in enumerate(x):
            yield from yapraklar(v, f"{yol}/{i}")
    else:
        yield yol, x


S1_BIL = re.compile(r"^dallar/[^/]+/raporlar/[^/]+/(pasif/V\.[DEF]|detay/V\.[DEF]/.+|onceki_yil_dagitilmamis/\d{4})$")
S1_ELLE = re.compile(r"^elle/[^/]+/[^/]+/(pasif/V\.[DEF]|detay/V\.[DEF]/.+|donem_net_kari)$")
KD9 = re.compile(r"^dallar/[^/]+/degismezler/canli/devir_tabani$")
YENI_SEN = re.compile(r"^(s1(2[2-9]|3[0-5])[ab]?-kd-|rastgele-[47]$)")


def neden(dosya, ad, yol, eski, yeni):
    if YENI_SEN.match(ad):
        return "YENI (K-D senaryosu / tohumu)"
    if dosya == "beklenen":
        if S1_BIL.match(yol):
            return "S-1 = A gösterim (KD1): önceki yılın 590 / 591'i V.F → V.D / V.E 'Önceki Yıl …', onceki_yil_dagitilmamis"
        if KD9.match(yol) and eski is None and yeni == []:
            return "BM§2 (5) yeni değişmez anahtarı (KD9) devir_tabani = []"
    else:
        if S1_ELLE.match(yol):
            return "S-1 = A elle beklenen (KD1) — README K-D G3 tablosu"
    return None


def main(eski_k, yeni_k, cikti):
    sayac, dokum, beklenmeyen, toplam = Counter(), [], [], 0
    for alt, dosya in (("", "senaryo"), ("beklenen", "beklenen")):
        e_kl, y_kl = os.path.join(eski_k, alt), os.path.join(yeni_k, alt)
        adlar = sorted({f for f in os.listdir(e_kl) if f.endswith(".json")} | {f for f in os.listdir(y_kl) if f.endswith(".json")})
        for f in adlar:
            ad = f[:-5]
            e = json.load(open(os.path.join(e_kl, f), encoding="utf-8")) if os.path.exists(os.path.join(e_kl, f)) else {}
            y = json.load(open(os.path.join(y_kl, f), encoding="utf-8")) if os.path.exists(os.path.join(y_kl, f)) else {}
            ey, yy = dict(yapraklar(e)), dict(yapraklar(y))
            toplam += len(set(ey) | set(yy))
            for yol in sorted(set(ey) | set(yy)):
                a, b = ey.get(yol), yy.get(yol)
                if yol in ey and yol in yy and a == b:
                    continue
                n = neden(dosya, ad, yol, a, b)
                sayac[n or "BEKLENMEYEN"] += 1
                kayit = {"dosya": f"{dosya}/{ad}", "yol": yol, "eski": a, "yeni": b, "neden": n or "BEKLENMEYEN"}
                if n is None:
                    beklenmeyen.append(kayit)
                if not YENI_SEN.match(ad):
                    dokum.append(kayit)
    with open(cikti, "w", encoding="utf-8") as fh:
        json.dump({"toplam_yaprak": toplam, "sayac": dict(sayac), "eski_senaryolarda_degisen": dokum, "beklenmeyen": beklenmeyen}, fh,
                  ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")
    print(f"toplam yaprak {toplam}")
    for k, v in sorted(sayac.items()):
        print(f"  {v:6d}  {k}")
    print(f"eski senaryolarda değişen yaprak {len(dokum)}; BEKLENMEYEN {len(beklenmeyen)}")
    for x in beklenmeyen[:40]:
        print("  BEKLENMEYEN", x["dosya"], x["yol"], x["eski"], "→", x["yeni"])
    print("# tests 1")
    print(f"# pass {0 if beklenmeyen else 1}")
    print(f"# fail {1 if beklenmeyen else 0}")
    return 1 if beklenmeyen else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
