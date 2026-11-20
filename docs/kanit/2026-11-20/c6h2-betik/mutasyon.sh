#!/bin/bash
# Ç6-HESAP tur 2 — mutasyon koşusu (YÜK: flock -s ile çağrılır). Her mutant temiz kopyada (git archive HEAD), iki TZ = iki koşu. Kullanım: bash mutasyon.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c
MK=/dev/shm/c6h2-mut
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · uç $(cd $WT && git rev-parse --short HEAD)"
python3 -I $N/mutantlar.py x --liste | while read -r name files; do
  for tz in UTC Europe/Istanbul; do
    rm -rf "$MK"
    mkdir -p "$MK" || exit 1
    (cd "$WT" && git archive HEAD ':!docs/kanit' | tar -x -C "$MK") || exit 1
    ln -s /home/user/ofis---y-netimi/node_modules "$MK/node_modules"
    python3 -I $N/mutantlar.py "$MK" "$name" || { echo "$name $tz UYGULANAMADI"; continue; }
    out=$( cd "$MK" && TZ=$tz timeout -k 10 900 node --test $files 2>&1 )
    pass=$(echo "$out" | grep -E '^# pass' | awk '{print $3}')
    fail=$(echo "$out" | grep -E '^# fail' | awk '{print $3}')
    first=$(echo "$out" | grep -E '^    not ok|^not ok' | head -2 | tr '\n' ' ')
    if [ "${fail:-0}" -gt 0 ]; then verdict=YAKALANDI; else verdict=YAŞADI; fi
    echo "$name · TZ=$tz · pass ${pass:-?} fail ${fail:-?} · $verdict · ilk kırmızı: $first"
  done
done
rm -rf "$MK"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
