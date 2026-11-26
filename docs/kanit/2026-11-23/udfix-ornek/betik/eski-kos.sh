#!/bin/bash
# Yeni testi eski kodun ayrı kopyasında iki saat diliminde koşar; ham çıktıyı kanıt klasörüne yazar.
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a4444ad6c4d6abab7/docs/kanit/2026-11-23
cd /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/udfix-q7k2/eski || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr '/' '-')
  out=$K/udfix-eski-kirmizi-tyk-kilit-olcum-$n.txt
  {
    echo "# eski kod: aday e7934c5e (server, test/helpers.mjs, package.json) arşivden ayrı kopyaya açıldı (ders 23); yeni test + fikstür kopyalandı; TZ=$tz"
    echo "# komut: node --test test/tyk-kilit-olcum-250.test.mjs"
    TZ=$tz timeout 600 node --test test/tyk-kilit-olcum-250.test.mjs 2>&1
    echo "# çıkış $?"
  } > $out
  grep -E '^# (tests|pass|fail)|^# çıkış' $out | tr '\n' ' '
  echo
done
grep -E "error: '|Σ kalem [0-9]" $K/udfix-eski-kirmizi-tyk-kilit-olcum-UTC.txt | head -8 | cut -c1-200
