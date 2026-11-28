#!/bin/bash
# M2T4 komşular (ders 10) — komsu-liste.txt (184 dosya), YENİ kod, iki saat dilimi sırayla; her biri kendi sınırıyla (ders 55); aynı anda en çok 2 dosya.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a75255d57a32bede8
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd "$W" || exit 1
mapfile -t FILES < /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/komsu-liste.txt
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  cat /proc/loadavg > "$K/komsu-$n-yuk.txt"
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K timeout -k 5 3500 flock -s -w 3600 "$L" node tools/kanit.mjs kos "m2t4-komsular-$n" -- node --test --test-concurrency=2 "${FILES[@]}" > "$K/komsu-$n-cikti.txt" 2>&1
  echo "çıkış $?" >> "$K/komsu-$n-cikti.txt"
  date -u +%H:%M >> "$K/komsu-$n-cikti.txt"
done
echo bitti > "$K/komsu-bitti.txt"
