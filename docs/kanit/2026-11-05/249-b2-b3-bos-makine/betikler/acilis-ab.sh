#!/bin/bash
# Açılış süresi dönüşümlü: HEAD (5a22228a) ↔ 91d2a200 (03.11 B3 ölçüm commit'i), aynı veri ($O/b3-sonra, 10 × 2.000 sonrası), b3-dosya-olcum, 3 çift, iki kilit altında tek tek.
SP=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad
O=$SP/olcum-249-q5n8; K=$O/cikti/acilis-ab; mkdir -p $K
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for i in 1 2 3; do
  for kod in head 91d2a200; do
    kok=/home/user/ofis---y-netimi; isz=""; [ $kod = 91d2a200 ] && kok=$O/kod-91d2a200 && isz=91d2a200
    (cd $kok && flock /tmp/destekofis-olcum.lock flock $SP/tam-npm-test.lock sh -c "uptime > $K/$kod-$i.uptime; env ISZ_COMMIT=$isz node --disable-warning=ExperimentalWarning test/t9-248/b3-dosya-olcum.mjs --veri $O/b3-sonra --is $O/ab-is --json $K/$kod-$i.json > $K/$kod-$i.log 2>&1; c=\$?; uptime >> $K/$kod-$i.uptime; exit \$c")
    echo "$kod-$i çıkış=$? $(node -e 'const d=require(process.argv[1]); console.log(JSON.stringify(d.acilis), "bakım", d.bakim.map(b=>b.ms).join("/"))' $K/$kod-$i.json 2>&1)" | tee -a $K/ozet.txt
    rm -rf $O/ab-is
  done
done
