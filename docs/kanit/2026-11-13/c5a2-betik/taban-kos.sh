#!/bin/bash
# Kullanım: taban-kos.sh <çıktı adı> <komut...>  — taban kopyasında (c5a2-taban), eski sürüm etiketleri ana depodan salt okunur.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-k7
ad="$1"; shift
cd "$N/taban" || exit 1
export GIT_DIR=/home/user/ofis---y-netimi/.git HUKUK_LICENSE_URL=http://127.0.0.1:9
"$@" > "$N/kanit/$ad.out" 2>&1
echo "cikis=$?"
