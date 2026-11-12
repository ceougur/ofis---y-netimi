"""Yeniden üretilen fikstür ↔ depodaki fikstür: eski sınıfların v2.4.9 sayıları AYNI mı, retler aynı mı; yeni sınıfların sayıları. Kullanım: fikstur-karsilastir.py <depo fikstür klasörü> <yeni klasör>"""
import json, sys

old_dir, new_dir = sys.argv[1], sys.argv[2]
old = json.load(open(f"{old_dir}/v249.json", encoding="utf-8"))
new = json.load(open(f"{new_dir}/v249.json", encoding="utf-8"))
same = [k for k in old["cariler"] if json.dumps(old["cariler"][k], sort_keys=True) == json.dumps(new["cariler"].get(k), sort_keys=True)]
diff = [k for k in old["cariler"] if k not in same]
print("eski sınıf:", len(old["cariler"]), "aynı:", len(same), "FARKLI:", diff)
for k in diff:
    print("  ESKİ", json.dumps(old["cariler"][k], ensure_ascii=False))
    print("  YENİ", json.dumps(new["cariler"].get(k), ensure_ascii=False))
print("kod/now/today:", [old[k] == new[k] for k in ("kod", "now", "today")], "node", old.get("node"), new.get("node"))
for k in new["cariler"]:
    if k not in old["cariler"]:
        print("YENİ SINIF", k, json.dumps(new["cariler"][k], ensure_ascii=False))
ol = json.load(open(f"{old_dir}/uretim.json", encoding="utf-8"))["log"]
nl = json.load(open(f"{new_dir}/uretim.json", encoding="utf-8"))["log"]
print("adım eski/yeni:", len(ol), len(nl), "ret eski:", {k: v for k, v in ol.items() if v != 200})
print("ret yeni:", {k: v for k, v in nl.items() if v != 200})
print("eski adımların sonucu aynı:", all(nl.get(k) == v for k, v in ol.items()))
