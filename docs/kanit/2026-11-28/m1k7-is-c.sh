#!/bin/bash
# m1k7 iş C: tur 6'nın onarım üreteci (docs/kanit/2026-11-28/m1k6-s6-onarim.mjs, değiştirilmeden; s2 ile aynı tohum → aynı veri) YENİ kodda —
# notta 'ilk aydan (X)' varsa (artık devreden farkı kolunda da) o aydan geri al + sırayla yeniden mahsup; not kalkıyor mu. İki TZ.
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa8f377d8c9dd1229
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k7
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$N/s6"
D=$N/durum-c.txt
: > "$D"
read l _ < /proc/loadavg; echo "yük $l (başlangıç)" >> "$D"
awk -v l="$l" 'BEGIN{exit !(l>4)}' && { sleep 120; echo "yük $(cut -d' ' -f1 /proc/loadavg) (tek bekleme sonrası)" >> "$D"; }
run() { # ad tz set seeds
  local s=$(date +%s)
  (cd "$N" && ROOT=$Y TZ=$2 SET=$3 SEEDS=$4 flock -s -w 3600 "$L" node --disable-warning=ExperimentalWarning "$Y/docs/kanit/2026-11-28/m1k6-s6-onarim.mjs" > "$N/s6/$1.jsonl" 2> "$N/s6/$1.err")
  echo "$1 çıkış=$? süre=$(( $(date +%s) - s )) yük=$(cut -d' ' -f1 /proc/loadavg)" >> "$D"
}
run ay-utc UTC ay 1-400
run yil-utc UTC yil 1-200
run ay-ist Europe/Istanbul ay 1-200
run yil-ist Europe/Istanbul yil 1-200
echo BITTI >> "$D"
