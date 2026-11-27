#!/bin/bash
# Ana oturum: sürücü bakımı 3'ün yeniden koşusu — 5 senaryo × iki TZ, kendi worktree kopyam (8a5118ef); depo değişkeni YOK (ders 54).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-surucu3; R=/home/user/ofis---y-netimi
export HUKUK_LICENSE_URL=http://127.0.0.1:9
[ -d $A/ag ] || git -C $R worktree add -q --detach $A/ag 8a5118ef || exit 1; ln -sfn $R/node_modules $A/ag/node_modules
for tz in UTC Europe/Istanbul; do t=${tz//\//-}; mkdir -p $A/cikti-$t /dev/shm/ana-surucu3-$t
  ( cd $A/ag && TZ=$tz timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --senaryo s30,s111,s110,s113,s68 --cikti $A/cikti-$t --veri /dev/shm/ana-surucu3-$t > $A/kos-$t.out 2>&1; echo "sürücü $tz çıkış $?" )
  rm -rf /dev/shm/ana-surucu3-$t
done
echo BİTTİ
