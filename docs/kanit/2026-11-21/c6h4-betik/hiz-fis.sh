#!/bin/bash
# ÖZEL ölçüm kilidi (bir kez): kilitli temiz 100 bin, fişten önce / sonra yanıtlar + fişten sonraki süre; dönüşümlü eski → yeni → yeni → eski. Çağrı: timeout -k 5 7100 bash hiz-fis.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
SRC=$S/ana-kabul/temiz-100k
D=/dev/shm/c6h4-fis
NEW=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
OLD=$A/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 3600 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
one() {
  kod=$1; n=$2
  if [ "$kod" = yeni ]; then ROOT=$NEW; else ROOT=$OLD; fi
  rm -rf "$D" && mkdir -p "$D" && cp -a "$SRC" "$D/v" || exit 1
  python3 -I $A/kilit.py "$D/v/data/destekofis.sqlite" > /dev/null || exit 1
  echo "=== $kod (sıra $n) · başta yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)" | tee -a $A/fis-$kod.log
  TZ=UTC timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/olc-fis.mjs "$ROOT" "$D/v" "$A/fis-$kod-$n" 5 >> $A/fis-$kod.log 2>&1
  echo "çıkış $? · sonda yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)" | tee -a $A/fis-$kod.log
  rm -rf "$D"
}
one eski 1; one yeni 2; one yeni 3; one eski 4
echo "bitti $(date -u +%H:%M:%S)"
