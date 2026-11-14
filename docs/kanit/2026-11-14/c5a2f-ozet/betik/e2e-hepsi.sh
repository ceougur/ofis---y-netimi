#!/bin/bash
# Tur 2f — Kural Farkı ekran senaryoları (taramayla: test/e2e içinde 'rule-diff' / 'Kural Farkı' geçen iki senaryo + görev metnindeki eşleştirme senaryosu) × iki TZ, kanit kos ile.
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f
unset GIT_DIR GIT_WORK_TREE
cd $WT || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
for zone in Europe/Istanbul UTC; do
  z=${zone//\//_}
  for s in senaryo-acilis-olabilir-250 senaryo-acilis-eslestirme-250 senaryo-acilis-duzeni-250; do
    echo "== $s $zone $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)"
    TZ=$zone timeout -k 5 1800 flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
      node tools/kanit.mjs kos c5a2f-e2e-$s-$z -- node test/e2e/$s.mjs 2>&1 | tail -1
  done
done
echo "bitti $(date -u +%H:%M:%S)"
