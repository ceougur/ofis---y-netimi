#!/bin/bash
# ÖZEL ölçüm kilidi: parça ayrıştırması (yeni kod). Çağrı: timeout -k 5 3500 bash parca.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
D=/dev/shm/c6h4-parca
exec 9>$S/olcum.lock
flock -x -w 3000 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
rm -rf $D && mkdir -p $D && cp -a $S/ana-kabul/temiz-100k $D/v || exit 1
python3 -I $A/kilit.py $D/v/data/destekofis.sqlite > /dev/null || exit 1
TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/parca-fis.mjs /home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e $D/v
echo "çıkış $?"
rm -rf $D
