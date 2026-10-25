# d2cef7c (2.4.4) ayrı kopyasındaki koşunun YALNIZ şüpheli / değersiz adımlarını kâhinle karşılaştırır (durum + kod).
import json, glob, os, sys
K = sys.argv[1]
top = esit = 0; farklar = []; ret_ok = {"ok": 0, "doubtful-writeoff-exceeds": 0, "doubtful-closed": 0, "diğer": 0}
for f in sorted(glob.glob(os.path.join(K, "rastgele-s1-*.kahin.json"))):
    ad = os.path.basename(f)[: -len(".kahin.json")]
    sen = json.load(open(os.path.join(K, ad + ".json")))
    kah = json.load(open(f))["denetimler"]
    prog = json.load(open(os.path.join(K, ad + ".program.json")))
    for a in sen["adimlar"]:
        if a["islem"] not in ("supheli_al", "degersiz"):
            continue
        for alan in ("durum", "kod"):
            k = "adim:%s:%s" % (a["id"], alan)
            if k not in kah:
                continue
            top += 1
            p = prog.get(k, "yok")
            if p == kah[k]["b"]:
                esit += 1
            else:
                farklar.append((ad, k, p, kah[k]["b"], prog.get("adim:%s:yanit" % a["id"], "")))
        if a["islem"] == "degersiz":
            d = kah.get("adim:%s:durum" % a["id"], {}).get("b")
            ret_ok["ok" if d == "ok" else kah.get("adim:%s:kod" % a["id"], {}).get("b", "diğer")] += 1
print(json.dumps({"denetim": top, "tutan": esit, "fark": len(farklar), "kahin_degersiz_dagilimi": ret_ok, "farklar": farklar[:20]}, ensure_ascii=False, indent=1))
