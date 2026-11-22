#!/bin/bash
# ÖZEL ölçüm kilidi: parça ayrıştırması (üç kod; parçalar yeni kodun frozenSums'üyle). Çağrı: timeout -k 5 7000 bash parca.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
NEW=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
D=/dev/shm/c6h5-parca
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 3600 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg) · yeni $(git -C $NEW rev-parse --short=8 HEAD)"
for kod in $NEW $A/kod-f73f4f5a $A/kod-5ee4d99e; do
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    l=$(cut -d' ' -f1 /proc/loadavg)
    python3 -I -c "import sys; sys.exit(0 if float(sys.argv[1]) < 1.5 else 1)" "$l" && break
    sleep 10
  done
  echo "=== $kod · başta yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)"
  rm -rf $D && mkdir -p $D && cp -a $S/ana-kabul/temiz-100k $D/v || exit 1
  python3 -I $A/betik4/kilit.py $D/v/data/destekofis.sqlite > /dev/null || exit 1
  TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/parca5.mjs $kod $D/v $NEW
  echo "çıkış $?"
  rm -rf $D
done
echo "bitti $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
