#!/bin/bash
# Kırmızı kanıt (ders 7, 38, 51): yeni test dosyaları eski kod kopyasında (5ee4d99e). İki TZ. Paylaşılan kilit.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
E=$A/eski
for f in c6h-alt-hesap-farki c6h-kural-farki-fis c6h-degerleme-dondurma; do cp $W/test/$f.test.mjs $E/test/ || exit 1; done
cd $E || exit 1
exec 9>$S/olcum.lock
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr / -)
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit timeout -k 5 1500 node tools/kanit.mjs kos c6h4-kirmizi-$n -- node --test test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs > $A/kirmizi-$n.out 2>&1
  echo "$tz çıkış $? $(tail -3 $A/kirmizi-$n.out | head -1)"
done
