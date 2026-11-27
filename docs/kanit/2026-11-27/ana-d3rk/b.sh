#!/bin/bash
. /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d3rk/ortak.sh
O=$R/ozet-b.txt; echo "başladı $(date -u +%H:%M) $(cat /proc/loadavg)" > $O
k $R/yeni d3rk-gercek-t11-UTC UTC 2400 node test/devir-d3-gercek-veri.mjs --eski $R/v250 --tohum 11
k $R/yeni d3rk-gercek-t11-Istanbul Europe/Istanbul 2400 node test/devir-d3-gercek-veri.mjs --eski $R/v250 --tohum 11
echo "BİTTİ $(date -u +%H:%M)" >> $O
