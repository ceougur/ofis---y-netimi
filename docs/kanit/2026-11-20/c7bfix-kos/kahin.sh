#!/bin/bash
# Ç7b aday düzeltme turu — kabul A: kâhin ↔ program (test:kahin-defter, test:kahin-cari) taban (surucu5-uc, /dev/shm/c7bfix-a66/eski) ve son (worktree), iki TZ.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/c7bfix-a66
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit
for kn in eski yeni; do
  if [ $kn = eski ]; then D=/dev/shm/c7bfix-a66/eski; else D=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa660861cba7cd284; fi
  cd "$D" || exit 1
  for tz in UTC Europe/Istanbul; do
    t=$(echo $tz | tr -d '/' | tr 'A-Z' 'a-z')
    for k in defter cari; do
      echo "$(date -u +%H:%M:%S) başla $kn $t $k · yük $(cat /proc/loadavg)"
      TZ=$tz timeout -k 5 2400 flock -s -w 3600 $S/olcum.lock node tools/kanit.mjs kos c7bfix-kahin-$k-$kn-$t -- node --disable-warning=ExperimentalWarning test/bagimsiz/$k/kos.mjs > $A/kahin-$k-$kn-$t.out 2>&1
      echo "$(date -u +%H:%M:%S) bitti $kn $t $k çıkış $? · $(grep -E '^\[kanit\]' $A/kahin-$k-$kn-$t.out | tail -1 | cut -c1-220)"
    done
  done
done
