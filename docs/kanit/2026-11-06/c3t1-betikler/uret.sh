#!/usr/bin/env bash
# Ç3 tur 1: dar kontrol betiklerini verilen kök üzerinde yeniden üretir. Kullanım: uret.sh <kök> <etiket>
ROOT="$1"
TAG="$2"
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
OUT="$S/c3t1-kanit/uret-$TAG"
mkdir -p "$OUT"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  TZ=$tz node --disable-warning=ExperimentalWarning "$S/dk-c3-ad44/p1-onbellek-sifirlama.mjs" "$ROOT" > "$OUT/p1-$t.txt" 2>&1; echo "p1 $tz çıkış $?: $(grep SONUÇ "$OUT/p1-$t.txt")"
  TZ=$tz node --disable-warning=ExperimentalWarning "$S/dk-c3-ad44/p10-ayni-gun-goc-kurali.mjs" "$ROOT" > "$OUT/p10-$t.txt" 2>&1; echo "p10 $tz çıkış $?: $(grep SONUÇ "$OUT/p10-$t.txt")"
  TZ=$tz node --disable-warning=ExperimentalWarning "$S/dk-c3-ad44/p5-eski-sifirla-yeniden-kilit.mjs" "$ROOT" "$S/c3t1-v249-ccf0b0ca" "$S/c3t1-is-p5-$TAG" > "$OUT/p5-$t.txt" 2>&1; echo "p5 $tz çıkış $?: $(grep SONUÇ "$OUT/p5-$t.txt")"
  TZ=$tz node --disable-warning=ExperimentalWarning "$S/dk-c3-ad44/p5b-ileri-kilit.mjs" "$ROOT" "$S/c3t1-v249-ccf0b0ca" "$S/c3t1-is-p5b-$TAG" > "$OUT/p5b-$t.txt" 2>&1; echo "p5b $tz çıkış $?: $(grep SONUÇ "$OUT/p5b-$t.txt")"
done
rm -rf "$S/c3t1-is-p5-$TAG" "$S/c3t1-is-p5b-$TAG"
