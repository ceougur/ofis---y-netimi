#!/bin/bash
# Tur 2f — dar kontrolün hedefli vakaları (A iki kol + yıl dönümü, B, C, D) yeni kod ve taban × iki TZ; her koşu kanit kos ile (betik TAP üretmez — hüküm çıkış kodundan; ham çıktı docs/kanit).
P=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f
unset GIT_DIR GIT_WORK_TREE
cd $WT || exit 1
for zone in Europe/Istanbul UTC; do
  z=${zone//\//_}
  for side in yeni taban; do
    if [ $side = taban ]; then KOD=/dev/shm/c5a2f-k1/taban; else KOD=$WT; fi
    echo "== $side $zone $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)"
    KOD=$KOD TZ=$zone HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1800 flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
      node tools/kanit.mjs kos c5a2f-hedefli-$side-$z -- node --disable-warning=ExperimentalWarning $P/hedefli.mjs /dev/shm/c5a2f-k1/sablon 2>&1 | tail -1
  done
done
echo "bitti $(date -u +%H:%M:%S)"
