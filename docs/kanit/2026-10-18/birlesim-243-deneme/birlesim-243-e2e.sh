#!/bin/bash
SP=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
cd $SP/birlesim-243
export HUKUK_LICENSE_URL=http://127.0.0.1:9
OUT=$SP/birlesim-243-e2e.tsv; : > $OUT
for s in $(cat $SP/birlesim-243-liste.txt); do
  f=${s//:/_}; start=$(date +%s)
  flock $SP/e2e-243.lock timeout 2400 npm run -s "$s" > "$SP/birlesim-243-log-$f.txt" 2>&1; code=$?
  echo -e "$s\t$code\t$(( $(date +%s)-start ))s\t$(tail -1 "$SP/birlesim-243-log-$f.txt" | cut -c1-140)" >> $OUT
done
echo BITTI >> $OUT
