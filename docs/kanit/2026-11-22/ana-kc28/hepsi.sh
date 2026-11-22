#!/bin/bash
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kc28
for a in "utc oz" "ist oz" "utc g3" "ist g3" "utc elle" "ist elle"; do
  bash $N/kos.sh $a > $N/log-${a// /-}.txt 2>&1; echo "$a: $(grep -aE '^\[kanit\]|^== ' $N/log-${a// /-}.txt | tr '\n' ' ' | cut -c1-400)" >> $N/ozet.txt
done
echo "bitti $(date -u +%H:%M:%S)" >> $N/ozet.txt
