#!/bin/bash
# Yanıt eşdeğerliği (süre değil): kilitli temiz 100 bin, eski ↔ yeni, fişten önce / sonra — PAYLAŞILAN kilit (yük koşusu). Çağrı: timeout -k 5 3500 bash fark-kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
SRC=$S/ana-kabul/temiz-100k
D=/dev/shm/c6h4-fark
NEW=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
OLD=$A/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock
flock -s -w 3000 9 || { echo "kilit alınamadı"; exit 3; }
for kod in eski yeni; do
  if [ "$kod" = yeni ]; then ROOT=$NEW; else ROOT=$OLD; fi
  rm -rf "$D" && mkdir -p "$D" && cp -a "$SRC" "$D/v" || exit 1
  python3 -I $A/kilit.py "$D/v/data/destekofis.sqlite" > /dev/null || exit 1
  echo "=== $kod $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
  TZ=UTC timeout -k 10 1500 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/olc-fis.mjs "$ROOT" "$D/v" "$A/fark-$kod" 1 > $A/fark-$kod.log 2>&1
  echo "çıkış $?"
  rm -rf "$D"
done
python3 -I $A/fark-100k.py $A/fark-eski $A/fark-yeni > $A/fark-100k.out 2>&1; echo "fark çıkış $?"; cat $A/fark-100k.out
