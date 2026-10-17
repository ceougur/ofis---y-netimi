#!/bin/bash
cd "$(dirname "$0")"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
: > sonuc.tsv
for s in $(cat liste.txt); do
  start=$(date +%s)
  timeout 2400 npm run -s "$s" > "log-$s.txt" 2>&1
  code=$?
  echo -e "$s\t$code\t$(( $(date +%s)-start ))s\t$(grep -aE '^# (tests|pass|fail)|✓|✗|GEÇTİ|BAŞARISIZ' "log-$s.txt" | tail -2 | tr '\n\t' '  ' | cut -c1-160)" >> sonuc.tsv
done
echo BITTI >> sonuc.tsv
