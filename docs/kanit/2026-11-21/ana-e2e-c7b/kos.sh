#!/bin/bash
# ANA OTURUM — CI #1087 (4d24b069, Ç7b) e2e işi senaryo-acilis-duzeni-250'de durdu; o adım (beklentisi Ç7b'ye uyarlanmış) + CI'de KOŞMAYAN 49 e2e adımı AYNEN (ders 37), TZ=UTC (CI gibi).
# Ağaç /dev/shm/ana-e2e-c7b (dal e2e-acilis-c7b = çalışma dalı b8f034d9 + yalnız bu e2e beklentisi). Her adım paylaşılan kilit (ders 52). Çağrı: timeout -k 5 7100 bash kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-e2e-c7b; W=/dev/shm/ana-e2e-c7b
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 TZ=UTC KANIT_DIR=$A/kanit
cd $W || exit 1
mkdir -p $A/log
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M) · uç $(git rev-parse --short HEAD) · disk $(df -h / | awk 'NR==2{print $4}')"
n=0; while read -r cmd; do n=$((n+1)); ad=$(echo "$cmd" | awk '{print $4}')
  timeout -k 5 1500 flock -s -w 3000 $S/olcum.lock $cmd > $A/log/$ad.log 2>&1; rc=$?
  echo "$n $ad çıkış $rc · $(date -u +%H:%M) · $(grep -E '^\[kanit\]' $A/log/$ad.log | tail -1 | sed 's/.*: //' | cut -c1-90)"
done < $A/adimlar.txt
echo "bitti $(date -u +%H:%M) · $(cat /proc/loadavg) · ağaç: $(git status -s | grep -v node_modules | tr '\n' ' ')"
