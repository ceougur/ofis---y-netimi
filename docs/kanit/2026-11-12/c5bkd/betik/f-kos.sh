#!/bin/bash
# Kabul F — dar kontrolün betikleri (DEĞİŞTİRİLMEDEN) benim kodumda; çıktılar c5bkd-kanit/F/<ad>-yeni.json. Sonra f-karsilastir.py dar kontrolün kayıtlı çıktılarıyla karşılaştırır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
mkdir -p $S/c5bkd-kanit/F
for b in s95-98 karar1 karar2 karar3 bayat; do
  TZ=UTC bash $S/c5bkd-betik/b.sh yeni 600 $b.mjs > $S/c5bkd-kanit/F/$b-yeni.json 2> $S/c5bkd-kanit/F/$b-yeni.err
  echo "$b: çıkış $? · $(wc -c < $S/c5bkd-kanit/F/$b-yeni.json) bayt · $(date -u +%H:%M:%S)"
done
