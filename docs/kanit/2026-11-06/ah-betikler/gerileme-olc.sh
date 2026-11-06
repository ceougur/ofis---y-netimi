#!/bin/bash
# AH ders 6: aynı (v2.1.0 kodunun ürettiği) 100.000 verisi v2.1.0, v2.4.9 ve taban (f5b34f31) koduyla açılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
VERI=${1:-$S/ah-veri210/n-100000}
ETIKET=${2:-v210veri}
shift 2
for kod in "$@"; do
  ad=$(basename "$kod")
  echo "== $ad $(date -u +%H:%M:%S)"
  HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC flock $S/olcum.lock node --disable-warning=ExperimentalWarning --max-old-space-size=8192 $S/ah-betik/acilis-olc.mjs --kod "$kod" --veri "$VERI" --calisma $S/ah-calisma-$ad --cikti $S/ah-kanit/acilis-$ETIKET-$ad.json --acilis 2 --onarim 1 > $S/ah-kanit/acilis-$ETIKET-$ad.log 2>&1
  echo "cikis $? $(date -u +%H:%M:%S)"
done
touch $S/ah-kanit/gerileme-$ETIKET.BITTI
