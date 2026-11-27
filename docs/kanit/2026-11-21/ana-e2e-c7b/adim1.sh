#!/bin/bash
# ANA OTURUM — düzeltilmiş senaryo-acilis-duzeni-250 (ilk denemede kilit beklerken 1500 sn sınırı doldu): yük < 3,5 olunca (en çok 20 dk), paylaşılan kilit, TZ=UTC.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-e2e-c7b; W=/dev/shm/ana-e2e-c7b
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 TZ=UTC KANIT_DIR=$A/kanit
for i in $(seq 1 120); do awk '{exit !($1<3.5)}' /proc/loadavg && break; sleep 10; done
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M)"
cd $W || exit 1
timeout -k 5 3000 flock -s -w 2400 $S/olcum.lock node tools/kanit.mjs kos e2e-senaryo-acilis-duzeni-250 npm run test:senaryo-acilis-duzeni-250 > $A/log/e2e-senaryo-acilis-duzeni-250.log 2>&1
echo "çıkış $? · $(date -u +%H:%M) · $(grep -E '^\[kanit\]' $A/log/e2e-senaryo-acilis-duzeni-250.log | tail -1 | cut -c1-200)"
grep -E "✗|fiş satırları" $A/log/e2e-senaryo-acilis-duzeni-250.log | cut -c1-300
