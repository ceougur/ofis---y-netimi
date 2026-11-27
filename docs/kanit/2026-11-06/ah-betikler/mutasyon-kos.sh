#!/bin/bash
# AH / BS-6 mutasyon koşusu: ah-mut kopyasında her mutasyon için verilen testler (UTC). Sonda asıl dosyalar geri konur.
#   bash mutasyon-kos.sh "<mutasyonlar>" <test dosyaları (ah-mut'a göre)...>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
M=$S/ah-mut
LIST="$1"
shift
for m in $LIST; do
  python3 $S/ah-betik/mutasyon.py $M $m > /dev/null || { echo "$m UYGULANAMADI"; continue; }
  files=()
  for f in "$@"; do files+=("$M/$f"); done
  HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC node --disable-warning=ExperimentalWarning --test "${files[@]}" > $S/ah-kanit/mut-$m.txt 2>&1
  code=$?
  echo "$m cikis=$code $(grep -E '^# (tests|pass|fail)' $S/ah-kanit/mut-$m.txt | tr '\n' ' ')"
done
python3 $S/ah-betik/mutasyon.py $M asil > /dev/null
