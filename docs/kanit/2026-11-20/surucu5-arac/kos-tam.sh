#!/bin/bash
# kullanım: kos-tam.sh <ad> [ek kos.mjs argümanları…]  — çıktı /dev/shm/surucu5-a293/<ad>, kanıt KANIT_DIR
AD=$1; shift
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a293dd7fb86915c0b
cd "$W" || exit 1
cat /proc/loadavg
rm -rf "/dev/shm/surucu5-a293/$AD" "/dev/shm/surucu5-a293/veri-$AD"
KANIT_DIR=$SP/surucu5-a293/kanit timeout -k 5 6000 flock -s -w 3600 $SP/olcum.lock node tools/kanit.mjs kos "surucu5-$AD" -- node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti "/dev/shm/surucu5-a293/$AD" --veri "/dev/shm/surucu5-a293/veri-$AD" "$@"
echo "CIKIS $?"
rm -rf "/dev/shm/surucu5-a293/veri-$AD"
