# EDM e-SMM örnek UBL'i ile programın ürettiği e-SMM UBL'inin öğe yolları (yerel ad) karşılaştırması. Yalnız yapı; değerler karşılaştırılmaz.
import sys, xml.etree.ElementTree as ET
def paths(file):
    out = set()
    def walk(node, prefix):
        name = node.tag.split('}')[-1]
        path = f"{prefix}/{name}"
        extra = ""
        if name == "TaxTypeCode": extra = f"[{(node.text or '').strip()}]"
        out.add(path + extra)
        for child in node: walk(child, path)
    walk(ET.parse(file).getroot(), "")
    return out
edm, ours = paths(sys.argv[1]), paths(sys.argv[2])
print("EDM örneğinde olup programda OLMAYAN yollar:")
for p in sorted(edm - ours): print("  -", p)
print("Programda olup EDM örneğinde OLMAYAN yollar:")
for p in sorted(ours - edm): print("  +", p)
print(f"Ortak yol: {len(edm & ours)}; yalnız EDM: {len(edm - ours)}; yalnız program: {len(ours - edm)}")
