#!/bin/bash
# Ç6-HESAP tur 4 HIZ (ders 47, 52, 53 (a)) — ÖZEL ölçüm kilidi bütün zincir için BİR kez (flock -x; bekleme süreye sayılmaz). Her koşu TAZE veri kopyası (/dev/shm), dönüşümlü eski ↔ yeni,
# kilitsiz / kilitli (30.06.2026; kilit.py — eski sürümün kilidi benzetimi: açılış onarımı bekleyen koşu açar → "donma (bekleyen koşu)" = dondurma koşusunun süresi, kart dondurması dahil).
# Kullanım: timeout -k 5 7100 bash hiz.sh [tekrar=5]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
SRC=$S/ana-kabul/temiz-100k
D=/dev/shm/c6h4-olcum
NEW=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
OLD=$A/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 3600 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg) · yeni $(git -C $NEW rev-parse --short=8 HEAD)"
one() {
  kip=$1; kod=$2; n=$3
  if [ "$kod" = yeni ]; then ROOT=$NEW; else ROOT=$OLD; fi
  rm -rf "$D/$kip" && mkdir -p "$D" && cp -a "$SRC" "$D/$kip" || exit 1
  if [ "$kip" = kilitli ]; then python3 -I $A/kilit.py "$D/$kip/data/destekofis.sqlite" > /dev/null || exit 1; fi
  echo "=== $kip $kod (sıra $n) · başta yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)" | tee -a $A/hiz-$kip-$kod.log
  timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/olc.mjs "$ROOT" "$D/$kip" "${TEKRAR:-5}" sirket-5a5ffa3a-674f-4df8-b2f6-5c43b11b61a8 >> $A/hiz-$kip-$kod.log 2>&1
  echo "çıkış $? · sonda yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)" | tee -a $A/hiz-$kip-$kod.log
  rm -rf "$D/$kip"
}
TEKRAR=${1:-5}
one kilitsiz eski 1; one kilitsiz yeni 2; one kilitli eski 3; one kilitli yeni 4
one kilitli yeni 5; one kilitli eski 6; one kilitsiz yeni 7; one kilitsiz eski 8
echo "bitti $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
