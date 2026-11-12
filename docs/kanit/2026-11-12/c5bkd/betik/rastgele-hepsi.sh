#!/bin/bash
# Rastgele sıra koşuları: tohum × saat dilimi; her koşu açık süre sınırıyla ve yük kilidiyle (paylaşımlı, beklemesiz).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
LOCK=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
OPS=${OPS:-350}
for pair in "$@"; do
  seed=${pair%%:*}; tz=${pair##*:}
  ad="r2-t${seed}-$(echo "$tz" | tr '/' '_')"
  if ! TZ=$tz flock -s -n "$LOCK" "$N/betik/kos.sh" "$ad" yeni 900 rastgele2.mjs "$seed" "$OPS"; then echo "KOŞULAMADI $ad (kilit dolu ya da hata)"; fi
done
echo BITTI
