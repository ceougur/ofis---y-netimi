#!/bin/bash
# Ç5-A tur 3c — kuyruğun ve taşınan modüllerin dışa açık çıktısı taban ↔ yeni (tur 3b'nin dok.mjs'i; AYNI veri kaynağının iki taze kopyası). Kullanım: bash esd.sh <ad> <kaynak> [şimdi]
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
DOK=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4/betik/dok.mjs
AD=$1; KAYNAK=$2; SIMDI=${3:-2026-10-08T12:00:00+03:00}
[ -n "$AD" ] && [ -d "$KAYNAK/data" ] || { echo "kullanım: esd.sh <ad> <kaynak> [şimdi]"; exit 2; }
export HUKUK_LICENSE_URL=http://127.0.0.1:9
OUT=/dev/shm/c5a3c-k7/esd
mkdir -p $K/esd $OUT || exit 1
echo "esd $AD · kaynak $KAYNAK · şimdi $SIMDI · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
for KOD in taban yeni; do
  KOPYA=/dev/shm/c5a3c-k7/esd-$AD-$KOD
  rm -rf "$KOPYA" && cp -a "$KAYNAK" "$KOPYA" || exit 1
  s=$(date +%s)
  TZ=Europe/Istanbul timeout -k 5 3000 node --max-old-space-size=8192 --disable-warning=ExperimentalWarning $DOK "$K/$KOD" "$KOPYA" $OUT/$AD-$KOD.jsonl "$SIMDI" > $K/esd/$AD-$KOD.ozet 2>&1
  echo "$KOD çıkış $? · $(( $(date +%s) - s )) sn · $(tail -1 $K/esd/$AD-$KOD.ozet | cut -c1-300)"
  rm -rf "$KOPYA"
done
sha256sum $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl | sed "s#$OUT/##" > $K/esd/$AD.sha256
if cmp -s $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl; then echo "SONUÇ $AD: BAYT BAYT AYNI ($(wc -l < $OUT/$AD-yeni.jsonl) satır; $(wc -c < $OUT/$AD-yeni.jsonl) bayt; sha256 $(sha256sum < $OUT/$AD-yeni.jsonl | cut -c1-16))"
else
  echo "SONUÇ $AD: FARK VAR"
  python3 -I $K/esd-fark.py $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl > $K/esd/$AD-fark.txt 2>&1; head -40 $K/esd/$AD-fark.txt
fi
rm -f $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
