import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
KALK = ("P5-S4-MAHSUPTAN-SONRA-TERS", "K6-KDV-ORAN-DISI-DUZENLE", "K3-POS-VALOR-RESMI-TATIL")
kalkan = [k["kod"] for k in d["kurallar"] if k["kod"].startswith(KALK)]
d["kurallar"] = [k for k in d["kurallar"] if not k["kod"].startswith(KALK)]
d["bakim4_kalkan"] += ("; ateşlemeyen (eskimiş) kurallar da kalktı — " + ", ".join(kalkan) + " (P5: Ç7b'den sonra s43'te program = kâhin — c7b2-taban'da P5 ateşliyordu; K6 / K3: kâhin bakımı 3'ten beri"
                       " senaryo / üretici düzeltildi, sınamada ve Ç7b öncesi kodda ateşlemiyor). Ateşlemeyen kural bir gerilemeyi örtebilirdi.")
lines = ["{", f' "aciklama": {json.dumps(d["aciklama"], ensure_ascii=False)},', f' "bakim4_kalkan": {json.dumps(d["bakim4_kalkan"], ensure_ascii=False)},', ' "kurallar": [']
lines += [f"  {json.dumps(k, ensure_ascii=False)}," for k in d["kurallar"]]
lines[-1] = lines[-1].rstrip(",")
lines += [" ]", "}"]
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
json.load(open(p, encoding="utf-8"))
print(len(d["kurallar"]), kalkan)
