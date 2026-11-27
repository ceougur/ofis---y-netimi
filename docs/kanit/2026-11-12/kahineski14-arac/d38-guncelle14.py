#!/usr/bin/env python3
"""Bakım 14 (S131 = C — §25 Y14-11): d38 M14 / M15'in SK-26 susması artık "BİLİNEN SINIR (kullanıcı kararı S131 = C)" — yalnız `elleBelirsiz` kaydının parçaları ve açıklama metni; adımlar ve
değer beklentileri AYNEN. Program AÇILMAZ, kâhin koşulmaz. Kullanım: python3 -I d38-guncelle14.py <senaryolar klasörü>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = os.path.join(sys.argv[1], "d38-c5-s128-ozge-kalemli-kart.json")
with open(p, encoding="utf-8") as f:
    s = json.load(f)
eski = [["cari M14 tanımsız", "SK-26"], ["cari M15 tanımsız", "SK-26"]]
for e in eski:
    assert e in s["elleBelirsiz"], e
s["elleBelirsiz"] = [x + ["BİLİNEN SINIR", "S131 = C"] if x in eski else x for x in s["elleBelirsiz"]]
a = "başka kartın taksiti (M14 SUS — SK-18 + SK-26), taksitli faturanın taksiti (M15 SUS — SK-18 + SK-26)"
assert s["aciklama"].count(a) == 1
s["aciklama"] = s["aciklama"].replace(a, "başka kartın taksiti (M14 SUS — SK-18 + SK-26; bakım 14: BİLİNEN SINIR S131 = C), taksitli faturanın taksiti (M15 SUS — SK-18 + SK-26; S131 = C)")
s["dayanak"] = s["dayanak"] + "; §25 Y14-11 (S131 = C)"
bicim.yaz(p, s)
print("d38: M14 / M15 elleBelirsiz + 'BİLİNEN SINIR', 'S131 = C'")
