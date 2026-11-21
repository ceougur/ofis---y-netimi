#!/bin/bash
# Tek seferlik bekleme (yük > 3,5 idi), sonra iki mutant koşusu sırayla (--paralel 1).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu5-a293
sleep 300
echo "yük (bekleme sonrası): $(cat /proc/loadavg)"
bash $S/kos-tam.sh mutant1 --senaryo s40,s60,s121 --paralel 1 --program $S/kod-mutant1 > $S/mutant1.log 2>&1
echo "mutant1 bitti: $(tail -2 $S/mutant1.log | head -1 | cut -c1-200)"
bash $S/kos-tam.sh mutant2 --senaryo s91,s19,s86 --paralel 1 --program $S/kod-mutant2 > $S/mutant2.log 2>&1
echo "mutant2 bitti: $(tail -2 $S/mutant2.log | head -1 | cut -c1-200)"
