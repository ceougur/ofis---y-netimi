#!/bin/bash
# Soğuk / ılık ölçüm: önce (8d6ea9c9^1) ↔ yeni (8d6ea9c9), yol başına ayrı süreç, her süreç TAZE veri kopyasında; iki tur (sıra dönüşümlü).
# ÖZEL ölçüm kilidiyle başlatılır (flock -x -n); yük > 2 ile başlayan satır GEÇERSİZ.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1f2aaed82706fb62
OUT=$N/kanit/olc-soguk.out
echo "SOĞUK / ILIK · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > "$OUT"
for tur in 1 2; do
  for yol in liste kart zil vade taksitler; do
    if [ "$tur" = 1 ]; then sira="once yeni"; else sira="yeni once"; fi
    for kod in $sira; do
      if [ "$kod" = once ]; then R=$N/once; else R=$YENI; fi
      rm -rf "$N/olc-kopya" && cp -a "$SRC" "$N/olc-kopya" || { echo "KOPYA HATASI" >> "$OUT"; exit 1; }
      sync
      l0=$(cut -d' ' -f1 /proc/loadavg)
      gecersiz=$(awk -v l="$l0" 'BEGIN{print (l>2)?" GEÇERSİZ(yük>2)":""}')
      satir=$(cd "$N/betik" && timeout -k 5 300 node --disable-warning=ExperimentalWarning olc-soguk.mjs "$R" "$N/olc-kopya" "$yol" 2>&1 | tail -1)
      echo "tur $tur $kod$gecersiz $satir" >> "$OUT"
    done
  done
done
rm -rf "$N/olc-kopya"
echo "bitti $(date -u +%H:%M:%S) · sonda $(cat /proc/loadavg)" >> "$OUT"
