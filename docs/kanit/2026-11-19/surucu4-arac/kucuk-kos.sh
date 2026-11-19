#!/bin/bash
# Küçük senaryoyu programda koşar ve karşılaştırır: kucuk-kos.sh <ad> [TZ] [program kökü]
K=/dev/shm/surucu4-afb4/kucuk
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-afb4030486d151db9
AD=$1
TZV=${2:-UTC}
PR=${3:+--program $3}
cd "$W" || exit 1
rm -rf "$K/v-$AD"
TZ=$TZV timeout -k 5 900 node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/program.mjs --senaryo "$K/$AD.json" --cikti "$K/$AD.program.json" --veri "$K/v-$AD" $PR | tail -1
rm -rf "$K/v-$AD"
python3 -I test/bagimsiz/muhasebe-surucu/karsilastir.py --kok . --senaryo "$K/$AD.json" --program "$K/$AD.program.json" --beklenen "$K/beklenen/$AD.json" --cikti "$K/$AD.fark.json" --siniflama test/bagimsiz/muhasebe-surucu/siniflama.json | tail -1
python3 -I - "$K/$AD.fark.json" <<'EOF'
import json, sys
f = json.load(open(sys.argv[1]))
for a in f["adim_farklari"]:
    print("ADIM", a["no"], a["olay_turu"], a.get("id"), json.dumps(a["degisim"]), a.get("sinif"))
for rn, r in f["raporlar"].items():
    for y in r["satirlar"]:
        if y["sinif"] != "AYNI":
            print(rn, y["alan"], y["anahtar"], "p", y.get("program"), "k", y.get("kahin"), y["sinif"])
for r in f["redler"]:
    if r["sonuc"] != "AYNI":
        print("RED", r)
EOF
