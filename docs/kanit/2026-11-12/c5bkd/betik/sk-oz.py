import json, sys

d = json.load(sys.stdin)
for k, v in d.items():
    if isinstance(v, dict):
        if "HATA" in v:
            print(k, "HATA", v["HATA"])
            continue
        print(k, v.get("islem"), "mutabakat", v.get("mutabakat"))
        for a in ("once", "sonra"):
            x = v.get(a) or {}
            print("  ", a, "bakiye", x.get("bakiye"), "gecikmis", x.get("gecikmis"), "vade", x.get("vadeTakip"), "taksit", x.get("taksit"), "kural", x.get("kural"), "sigma", x.get("sigma"))
    else:
        print(k, v)
