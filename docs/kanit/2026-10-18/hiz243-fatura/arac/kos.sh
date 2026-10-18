#!/bin/bash
# 2.4.3 hız düzeltmesi ölçümü (önce/sonra AYNI araç, AYNI veri kopyası; ders 15: ortak e2e kilidi altında, tek başına).
# Kullanım: kos.sh <etiket> <kod klasörü> <düzey...>   düzey: D1 (5 ekran) | D2 (8 ekran + 2 API) | D3 (5 ekran + 15 API) | Y (yalıtık)
set -uo pipefail
cd /tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz243-arac
etiket=$1; kod=$2; shift 2
export KLASOR=$PWD/tam HIZ_KOD=$kod HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "[$etiket] kilit bekleniyor $(date -u +%T)" >> kosu-ozet.log
exec 9>/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/e2e-243.lock
flock 9
echo "[$etiket] kilit alındı $(date -u +%T); df $(df -h / | tail -1 | awk '{print $4}') boş" >> kosu-ozet.log
for d in "$@"; do
  case $d in
    D1) spec="5 0" ;; D2) spec="8 2" ;; D3) spec="5 15" ;;
    Y) node --disable-warning=ExperimentalWarning yalitik.mjs > tam/yalitik-$etiket.json 2> kosu-$etiket-Y.log; echo "[$etiket] Y çıkış $? $(date -u +%T)" >> kosu-ozet.log; continue ;;
    *) echo "bilinmeyen düzey $d" >> kosu-ozet.log; continue ;;
  esac
  set -- $spec
  node --disable-warning=ExperimentalWarning hiz.mjs duzey $etiket-$d $1 $2 600 11 > kosu-$etiket-$d.log 2>&1
  echo "[$etiket] $d çıkış $? $(date -u +%T)" >> kosu-ozet.log
done
echo "[$etiket] BİTTİ $(date -u +%T)" >> kosu-ozet.log
