#!/bin/bash
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-ana-cikti; W=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-sinama
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $W
kos(){ s=$1; timeout 5400 npm run test:mutabakat -- --islem 5000 --tohum $s --tohumlar 1 > $O/mut2-t$s.txt 2>&1; echo "cikis $?" >> $O/mut2-t$s.txt; }
kos 8 & kos 10 & wait
echo BITTI > $O/bitti2.txt
