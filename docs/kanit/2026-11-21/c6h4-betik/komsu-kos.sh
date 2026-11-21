#!/bin/bash
# Komşu yığını (yük koşusu; paylaşılan kilit bütün zincir için bir kez — ders 50, 52). Çağrı: timeout -k 5 7100 bash komsu-kos.sh <TZ>
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
TZN=${1:-UTC}
cd $W || exit 1
exec 9>$S/olcum.lock
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg) commit $(git -C $W rev-parse --short=8 HEAD)"
TZ=$TZN HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit timeout -k 5 6600 node tools/kanit.mjs kos c6h4-komsu-$(echo $TZN | tr / -) -- node --test --test-concurrency=3 $(cat $A/komsu.txt) > $A/komsu-$(echo $TZN | tr / -).out 2>&1
echo "çıkış $? bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
