#!/bin/bash
# Ç7b aday düzeltme turu — kabul B: muhasebe sürücüsü (DEĞİŞTİRİLMEDİ; worktree'deki sürücü) taban (surucu5-uc) ↔ son (db290c39 kodu), iki TZ (sürücünün varsayılanı), sonra gerileme.py.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/c7bfix-a66
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa660861cba7cd284
cd "$W" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit
for kn in eski yeni; do
  if [ $kn = eski ]; then P=/dev/shm/c7bfix-a66/eski; else P=/dev/shm/c7bfix-a66/yeni; fi
  echo "$(date -u +%H:%M:%S) başla sürücü $kn · yük $(cat /proc/loadavg)"
  timeout -k 5 3600 flock -s -w 3600 $S/olcum.lock node tools/kanit.mjs kos c7bfix-surucu-$kn -- node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --program "$P" --cikti /dev/shm/c7bfix-a66/surucu-$kn --veri /dev/shm/c7bfix-a66/surucu-veri-$kn > $A/surucu-$kn.out 2>&1
  echo "$(date -u +%H:%M:%S) bitti sürücü $kn çıkış $? · $(grep -E '^\[kanit\]' $A/surucu-$kn.out | tail -1 | cut -c1-220)"
  rm -rf /dev/shm/c7bfix-a66/surucu-veri-$kn
done
python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py /dev/shm/c7bfix-a66/surucu-eski /dev/shm/c7bfix-a66/surucu-yeni > $A/surucu-gerileme.txt 2>&1
echo "gerileme çıkış $? · $(tail -3 $A/surucu-gerileme.txt | tr '\n' ' ' | cut -c1-300)"
