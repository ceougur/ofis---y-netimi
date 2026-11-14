#!/bin/bash
# Kabul C: muhasebe kâhini sürücüsü taban ↔ yeni (program çıktısı) + gerileme.py. Sürücü depodaki (değişmeyen) dosyadan; --program ile kod kökü.
Q=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2c-q
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-abcc7bb2b583ce32f
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd "$W" || exit 1
node test/bagimsiz/muhasebe-surucu/kos.mjs --program $Q/taban --cikti $Q/surucu-taban > $Q/kanit/surucu-taban.txt 2>&1; echo "cikis=$?" >> $Q/kanit/surucu-taban.txt
node test/bagimsiz/muhasebe-surucu/kos.mjs --program $Q/c4 --cikti $Q/surucu-yeni > $Q/kanit/surucu-yeni.txt 2>&1; echo "cikis=$?" >> $Q/kanit/surucu-yeni.txt
python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py $Q/surucu-taban $Q/surucu-yeni > $Q/kanit/surucu-gerileme.txt 2>&1; echo "cikis=$?" >> $Q/kanit/surucu-gerileme.txt
echo BITTI > $Q/kanit/surucu-bitti.txt
