#!/bin/bash
# ÖZEL ölçüm kilidiyle başlatılır (flock -x -n). (1) ılık zil: önce / yeni / yeni + önerilen yamalar (mut2), iki tur; (2) soğuk / ılık yol başına (olc-soguk.sh).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1f2aaed82706fb62
OUT=$N/kanit/olc-ilik.out
echo "ILIK ZİL · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > "$OUT"
for tur in 1 2; do
  for kod in once yeni oneri; do
    case $kod in once) R=$N/once ;; yeni) R=$YENI ;; oneri) R=$N/mut2 ;; esac
    rm -rf "$N/olc-kopya" && cp -a "$SRC" "$N/olc-kopya" || { echo "KOPYA HATASI" >> "$OUT"; exit 1; }
    sync
    l0=$(cut -d' ' -f1 /proc/loadavg)
    gecersiz=$(awk -v l="$l0" 'BEGIN{print (l>2)?" GEÇERSİZ(yük>2)":""}')
    satir=$(cd "$N/betik" && timeout -k 5 300 node --disable-warning=ExperimentalWarning olc-ilik.mjs "$R" "$N/olc-kopya" "$kod" 2>&1 | tail -1)
    echo "tur $tur$gecersiz $satir" >> "$OUT"
  done
done
rm -rf "$N/olc-kopya"
echo "bitti $(date -u +%H:%M:%S) · sonda $(cat /proc/loadavg)" >> "$OUT"
"$N/betik/olc-soguk.sh"
echo BITTI
