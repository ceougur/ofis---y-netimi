#!/bin/bash
# Ç7b aday düzeltme turu — C + F komşular: Ç7b'nin Kartı Kapat testleri + plans uçlarına dokunan testler + c7b* / c7bt* / tyk* (153 dosya, iki parça), iki TZ, yeni kod (worktree).
# Her parça ayrı kanit koşusu (≤ 40 dk), paylaşılan ölçüm kilidi tek seferlik.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/c7bfix-a66
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-aa660861cba7cd284 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit
for tz in UTC Europe/Istanbul; do
  t=$(echo $tz | tr -d '/' | tr 'A-Z' 'a-z')
  for p in 00 01; do
    echo "$(date -u +%H:%M:%S) başla $t $p · yük $(cat /proc/loadavg)"
    TZ=$tz timeout -k 5 2700 flock -s -w 3600 $S/olcum.lock node tools/kanit.mjs kos c7bfix-komsu-$t-$p -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $(cat $A/komsu-parca$p) > $A/komsu-$t-$p.out 2>&1
    echo "$(date -u +%H:%M:%S) bitti $t $p çıkış $? · $(grep -E '^\[kanit\]' $A/komsu-$t-$p.out | tail -1 | cut -c1-200)"
  done
done
