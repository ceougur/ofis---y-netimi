import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
KALK = ("P2-ALIS-IADE-KDV", "KG8-IADE-KDV/SONUC", "K-S93-", "K-S108-", "K-S42-", "K-S51-", "R-S62-", "R-S180-", "K-S78-", "K-S104-")
once = len(d["kurallar"])
kalkan = [k["kod"] for k in d["kurallar"] if k["kod"].startswith(KALK)]
d["kurallar"] = [k for k in d["kurallar"] if not k["kod"].startswith(KALK)]
d["bakim4_kalkan"] = "SÜRÜCÜ BAKIMI 4 (19.11.2026): kalkan kurallar — " + ", ".join(kalkan) + " (Ç7b tur 2–2e programda: P2 / KG-8 sonucu; kâhin bakımı 13: s93 kalktı, s108 S155 PKT RED, s42 S192 susması, s51 S120 = A, s62 S198 = A RED, s111 S197 = B, s78 P1-b, s104 sıra / yedekten)"
txt = json.dumps(d, ensure_ascii=False, indent=1)
# özgün biçim: her kural tek satır
lines = ["{", f' "aciklama": {json.dumps(d["aciklama"], ensure_ascii=False)},', f' "bakim4_kalkan": {json.dumps(d["bakim4_kalkan"], ensure_ascii=False)},', ' "kurallar": [']
lines += [f"  {json.dumps(k, ensure_ascii=False)}," for k in d["kurallar"]]
lines[-1] = lines[-1].rstrip(",")
lines += [" ]", "}"]
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
json.load(open(p, encoding="utf-8"))
print(once, "→", len(d["kurallar"]), "kalkan", len(kalkan), kalkan)
