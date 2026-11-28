#!/bin/bash
# M2T3 komşular (ders 10) — komsu-liste.txt (123 dosya), YENİ kod, iki saat dilimi sırayla; her biri kendi sınırıyla (ders 55); aynı anda en çok 2 dosya.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t3-ae39/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ae39a10810940388a
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd "$W" || exit 1
mapfile -t FILES < /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t3-ae39/komsu-liste.txt
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  cat /proc/loadavg > "$K/komsu-$n-yuk.txt"
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K timeout -k 5 3300 flock -s -w 3600 "$L" node tools/kanit.mjs kos "m2t3-komsular-$n" -- node --test --test-concurrency=2 "${FILES[@]}" > "$K/komsu-$n-cikti.txt" 2>&1
  echo "çıkış $?" >> "$K/komsu-$n-cikti.txt"
done
echo bitti > "$K/komsu-bitti.txt"
