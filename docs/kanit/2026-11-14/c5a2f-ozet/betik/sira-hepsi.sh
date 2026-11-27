#!/bin/bash
# Tur 2f — dar kontrolün rastgele sıra betiği (kendi kopyam, kendi veri klasörüm /dev/shm/c5a2f-k1/veri): yeni kod × iki TZ, 300 tohum × 16 adım (dar kontrolle aynı hacim), kanit kos ile.
P=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f
unset GIT_DIR GIT_WORK_TREE
cd $WT || exit 1
for zone in Europe/Istanbul UTC; do
  z=${zone//\//_}
  echo "== sıra $zone $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)"
  KOD=$WT TZ=$zone HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 3500 flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
    node tools/kanit.mjs kos c5a2f-sira-yeni-$z --sure 58 -- node --disable-warning=ExperimentalWarning $P/sira.mjs /dev/shm/c5a2f-k1/sablon 1 300 16 2>&1 | tail -1
  grep "^SONUÇ" docs/kanit/2026-11-14/c5a2f-sira-yeni-$z.log
done
echo "bitti $(date -u +%H:%M:%S)"
