#!/bin/bash
# Sınıf testinin dişi: ürün mutantları yalnız test/c6h-v249-sinif.test.mjs ile (her biri temiz kopyada).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964
MK=/dev/shm/c6h3-mut2
echo "başta yük $(cat /proc/loadavg) · uç $(cd $WT && git rev-parse --short HEAD)"
for m in T2-M2-120-yerinde T1-M3-alis-iadesi-dusulmez T2-M6-153-defterden "T1-M8-kilitli-canli-okur'" E4-cari-atla; do
  rm -rf "$MK"; mkdir -p "$MK" || exit 1
  (cd "$WT" && git archive HEAD ':!docs/kanit' | tar -x -C "$MK") || exit 1
  ln -s /home/user/ofis---y-netimi/node_modules "$MK/node_modules"
  python3 -I $N/betik/mutantlar.py "$MK" "$m" > /dev/null || { echo "$m UYGULANAMADI"; continue; }
  out=$(cd "$MK" && HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 900 node --test test/c6h-v249-sinif.test.mjs 2>&1)
  fail=$(echo "$out" | grep -E '^# fail' | awk '{print $3}')
  echo "$m · fail ${fail:-?} · $(echo "$out" | grep -E 'sınıf testi:' | sed 's/^# //' | cut -c1-170) · ilk: $(echo "$out" | grep -m1 -E '^ +[a-z-]+ · kilit' | cut -c1-140)"
done
rm -rf "$MK"
echo "sonda yük $(cat /proc/loadavg)"
