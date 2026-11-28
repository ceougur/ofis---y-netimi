#!/bin/bash
# m1k7 iş D: onarımı KALKMAYAN tohumlarda (önce mahsupsuz ay) iki not birlikte uygulanınca (s7) not kalkıyor mu — ay UTC (21 tohum) + yıl UTC (10 tohum).
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa8f377d8c9dd1229
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k7
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd "$N" || exit 1
for set in ay yil; do
  : > "$N/s6/s7-$set-utc.jsonl"
  for sd in $(python3 -I -c "
import json,sys
for l in open('$N/s6/$set-utc.jsonl'):
    if l.startswith('{'):
        r=json.loads(l); o=r.get('onarim')
        if o and not (o['uyusmazlikKalkti'] and o['denge'] and o['ayToplami'] and o['raporFis']): print(r['seed'])
"); do
    ROOT=$Y TZ=UTC SET=$set SEEDS=$sd-$sd flock -s -w 3600 "$L" node --disable-warning=ExperimentalWarning "$N/m1k7-s7-iki-not.mjs" >> "$N/s6/s7-$set-utc.jsonl" 2>> "$N/s6/s7-$set-utc.err"
  done
done
echo BITTI > "$N/durum-d.txt"
