import json, sys, importlib.util
def yukle(yol, ad):
    spec = importlib.util.spec_from_file_location(ad, yol); m = importlib.util.module_from_spec(spec); sys.modules[ad] = m; spec.loader.exec_module(m); return m
eski = json.load(open(sys.argv[1], encoding="utf-8"))
sys.path.insert(0, sys.argv[2])
import kahin, senaryolar
farkli = []
adlar = {s["ad"]: s for s in senaryolar.tum_senaryolar()}
for k in eski["senaryolar"]:
    s = adlar.get(k["ad"])
    if s is None:
        print("YOK", k["ad"]); continue
    b = kahin.hesapla(senaryolar.girdi(s))
    if json.dumps(b, sort_keys=True, ensure_ascii=False) != json.dumps(k["beklenen"], sort_keys=True, ensure_ascii=False):
        farkli.append(k["ad"])
print(len(farkli), "farklı:", farkli)
