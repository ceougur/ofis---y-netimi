#!/bin/bash
# Mutantlar ayrı kopyada (scratchpad/izt4-ad3/mut) — çalışma ağacına dokunulmaz. Her mutantta yeni sınama dosyası (UTC).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3
M=$N/mut
L=$N/mutant.log
cd $M || exit 1
for m in M1 M2 M3 M4 M5 M6; do
  python3 -I $N/arac/mutant.py $M $m >> $L 2>&1 || { echo "$m UYGULANAMADI" >> $L; continue; }
  TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/izt4-s255-bagli-odeme-250.test.mjs > $N/mutant-$m.out 2>&1
  echo "$m rc=$? $(grep -E '^# (tests|pass|fail)' $N/mutant-$m.out | tr '\n' ' ')" >> $L
  grep -E "^    not ok" $N/mutant-$m.out | cut -c1-90 >> $L
done
python3 -I $N/arac/mutant.py $M geri >> $L
echo BITTI >> $L
