#!/bin/bash
# Mutantlar: her biri iki koşu (UTC + Europe/Istanbul); yeni test + plans.test (beklentisi değişen komşu). Sonuç satırı: mutant tz tests pass fail.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7bt-mut
A=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7bt-ana
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab1c286758106cc24
cp $W/test/c7bt-ayni-adli-excel-karti-250.test.mjs $N/test/ || exit 1
cp $W/test/plans.test.mjs $N/test/ || exit 1
OUT=$A/mutant-sonuc.txt
: > $OUT
for m in TEMIZ M1-yalniz-ad M2-telefonsuz-belirsizde-ac M3-kart-sorgusunda-grup-yok M4-telefonsuz-eslesmede-grup-yok M5-belirsizde-hep-ac M6-carisiz-telefon-bakmadan-baska M7-kendi-cari-bakmadan-baska M8-turkce-katlama M9-yuklemede-acilan-kart-eklenmez; do
  if [ "$m" = TEMIZ ]; then python3 -I $A/mutant.py $N geri || exit 1; else python3 -I $A/mutant.py $N $m || exit 1; fi
  for z in UTC Europe/Istanbul; do
    cd $N || exit 1
    TZ=$z HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 600 flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock node --test test/c7bt-ayni-adli-excel-karti-250.test.mjs test/plans.test.mjs > $A/mut-$m-$(echo $z | tr / -).log 2>&1
    code=$?
    t=$(grep -E '^# tests' $A/mut-$m-$(echo $z | tr / -).log | awk '{print $3}'); p=$(grep -E '^# pass' $A/mut-$m-$(echo $z | tr / -).log | awk '{print $3}'); f=$(grep -E '^# fail' $A/mut-$m-$(echo $z | tr / -).log | awk '{print $3}')
    kirmizi=$(grep -E '^    not ok' $A/mut-$m-$(echo $z | tr / -).log | sed -E 's/^    not ok [0-9]+ - //' | cut -c1-60 | tr '\n' '|')
    echo "$m $z çıkış=$code tests=$t pass=$p fail=$f kırmızı: $kirmizi" >> $OUT
  done
done
python3 -I $A/mutant.py $N geri
cat $OUT
