#!/usr/bin/env bash
# Ç3 tur 1 G2 komşu koşusu: 243 dosya (önceki Ç3 tamamlama listesi 242 + yeni test), UTC ve Europe/Istanbul, sırayla.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a247c14721558ab77 || exit 1
mapfile -t FILES < "$S/c3t1-kanit/komsu-birlesik.txt"
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  KANIT_DIR="$S/c3t1-kanit/kanit" HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos "c3t1-komsu-$t" -- env TZ=$tz node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${FILES[@]}" > "$S/c3t1-kanit/komsu-$t-konsol.txt" 2>&1
  echo "$tz çıkış $?"
  grep "^\[kanit\] c3t1" "$S/c3t1-kanit/komsu-$t-konsol.txt"
done
