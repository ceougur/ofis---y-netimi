#!/bin/bash
# Ç5-A tur 2b — kabul koşulları A / B / C: defter kâhini, cari kâhini (+ yapım aşaması listesi kendi kopyamda), muhasebe sürücüsü; sonra (yeni kod) ve önce (taban kopyası).
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a5b6e29fe068192ef
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-q4
K=$D/kanit/kahin-is2
mkdir -p $K
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for side in yeni taban; do
  if [ $side = yeni ]; then R=$W; else R=$D/taban; fi
  cd $R || exit 1
  for tz in Europe/Istanbul UTC; do
    tag=$(echo $tz | tr / -)
    TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/defter/kos.mjs > $K/defter-$side-$tag.txt 2>&1
    echo "defter $side $tz exit=$? $(grep -E '^# (tests|pass|fail)' $K/defter-$side-$tag.txt | tr '\n' ' ')" >> $K/ozet.txt
  done
  TZ=Europe/Istanbul timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs > $K/cari-$side.txt 2>&1
  echo "cari $side exit=$? $(grep -E '^# (tests|pass|fail)' $K/cari-$side.txt | tr '\n' ' ')" >> $K/ozet.txt
  cp $R/test/bagimsiz/cari/YAPIM-ASAMASI.json $K/yapim-$side.json
  KAHIN_YAPIM_ASAMASI=$K/yapim-$side.json TZ=Europe/Istanbul timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $K/cari-yapim-$side.txt 2>&1
  echo "cari-yapim $side exit=$? $(python3 -I -c "import json,sys;print(len(json.load(open(sys.argv[1]))['kayitlar']))" $K/yapim-$side.json) kayıt" >> $K/ozet.txt
  timeout -k 5 3600 node --disable-warning=ExperimentalWarning $W/test/bagimsiz/muhasebe-surucu/kos.mjs --program $R --cikti $K/surucu-$side --paralel 2 > $K/surucu-$side.txt 2>&1
  echo "surucu $side exit=$? $(grep -E '^# (tests|pass|fail|skipped)' $K/surucu-$side.txt | tr '\n' ' ')" >> $K/ozet.txt
done
echo BITTI >> $K/ozet.txt
