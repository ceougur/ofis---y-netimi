import json, sys
f = json.load(open(sys.argv[1], encoding="utf-8"))
for a in f["adim_farklari"]:
    print("ADIM", a["no"], a["olay_turu"], a.get("id"), json.dumps(a["degisim"]), a.get("sinif"))
for rn, r in f["raporlar"].items():
    for y in r["satirlar"]:
        if y["sinif"] != "AYNI":
            print(rn, y["alan"], y["anahtar"], "p", y.get("program"), "k", y.get("kahin"), y["sinif"])
for y in f["son"]:
    if y["sinif"] != "AYNI":
        print("son", y["alan"], y["anahtar"], "p", y.get("program"), "k", y.get("kahin"), y["sinif"])
for r in f["redler"]:
    if r["sonuc"] != "AYNI":
        print("RED", r)
print("ozet", f["ozet"])
