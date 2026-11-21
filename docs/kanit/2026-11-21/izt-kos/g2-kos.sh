#!/bin/bash
# G2 komşu taraması (170 dosya) iki TZ'de — paylaşılan kilit altında, her TZ en çok 50 dk.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt-a68
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a685ea99951e1d5f9 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  tag=$(echo $tz | tr '/' '-')
  echo "=== $tz başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/g2-$tag.out
  TZ=$tz flock -s -w 3600 $S/olcum.lock timeout -k 5 3000 node --test --test-concurrency=3 $(cat $D/g2-tum.txt) >> $D/g2-$tag.out 2>&1
  echo "çıkış $? sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/g2-$tag.out
done
