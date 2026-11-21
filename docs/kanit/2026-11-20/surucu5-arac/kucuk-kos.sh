#!/bin/bash
# Küçük senaryoyu programda koşar ve karşılaştırır: kucuk-kos.sh <senaryo.json> <beklenen.json> <çıktı adı> [TZ] [program kökü]
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a293dd7fb86915c0b
K=/dev/shm/surucu5-a293/kucuk
mkdir -p "$K"
SEN=$1; BEK=$2; AD=$3
TZV=${4:-UTC}
PR=${5:+--program $5}
cd "$W" || exit 1
rm -rf "$K/v-$AD"
TZ=$TZV HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/program.mjs --senaryo "$SEN" --cikti "$K/$AD.program.json" --veri "$K/v-$AD" $PR | tail -1
rm -rf "$K/v-$AD"
python3 -I test/bagimsiz/muhasebe-surucu/karsilastir.py --kok . --senaryo "$SEN" --program "$K/$AD.program.json" --beklenen "$BEK" --cikti "$K/$AD.fark.json" --siniflama test/bagimsiz/muhasebe-surucu/siniflama.json | tail -1
python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu5-a293/arac/kucuk-dokum.py "$K/$AD.fark.json"
