#!/bin/bash
# Kullanım: komsu.sh <kopya> <çıktı klasörü> <TZ listesi (virgüllü)> <dosya…> — her dosya ayrı koşulur, özet <çıktı>/ozet.txt
KOPYA="$1"; shift
OUT="$1"; shift
ZONES="$1"; shift
mkdir -p "$OUT"
: > "$OUT/ozet.txt"
for zone in ${ZONES//,/ }; do
  for file in "$@"; do
    name="$(basename "$file" .mjs)-$(echo "$zone" | tr '/' '-')"
    case "$file" in
      test/e2e/*) cmd=(node "$file") ;;
      *) cmd=(node --test "$file") ;;
    esac
    /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2c-q/kos-kopya.sh "$KOPYA" "$zone" "$OUT/$name.txt" timeout -k 5 1500 "${cmd[@]}"
    code=$?
    t=$(grep -E "^# tests" "$OUT/$name.txt" | tail -1 | awk '{print $3}')
    p=$(grep -E "^# pass" "$OUT/$name.txt" | tail -1 | awk '{print $3}')
    f=$(grep -E "^# fail" "$OUT/$name.txt" | tail -1 | awk '{print $3}')
    s=$(grep -E "^# skipped" "$OUT/$name.txt" | tail -1 | awk '{print $3}')
    echo "$name çıkış=$code tests=$t pass=$p fail=$f skipped=${s:-0}" >> "$OUT/ozet.txt"
  done
done
echo BITTI >> "$OUT/ozet.txt"
