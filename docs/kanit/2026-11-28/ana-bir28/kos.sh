#!/bin/bash
# Birleşim dar testi (28.11): D3 tur 6 + Değersiz tur 2+3 + Mİ tur 3 birleşmiş ağaç (çalışma dalı) — değişen alanların testleri + üç ekran senaryosu, UTC.
cd /home/user/ofis---y-netimi
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 TZ=UTC
k() { ad=$1; shift; timeout -k 5 2400 node tools/kanit.mjs kos bir28-$ad -- "$@" > /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/$ad.log 2>&1; echo "$ad cikis=$? $(date -u +%H:%M)" >> /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/ozet.txt; tail -1 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/$ad.log >> /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/ozet.txt; }
k birim node --test test/devir-d3-*.test.mjs test/supheli-degersiz-*.test.mjs test/mi2-*.test.mjs test/mi1-*.test.mjs test/kilit-*.test.mjs test/maliyet-bagsizlik.test.mjs
k e2e-iptal npm run test:senaryo-degersiz-iptal-m2t2-251
k e2e-siniri npm run test:senaryo-degersiz-siniri-m2-251
k e2e-mi2 npm run test:senaryo-mi2-251
k kahin-cari npm run test:kahin-cari
k kahin-defter npm run test:kahin-defter
echo "BITTI $(date -u +%H:%M) $(cat /proc/loadavg)" >> /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir28/ozet.txt
