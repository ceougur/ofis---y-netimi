#!/bin/bash
# Ç6-HESAP tur 5 HIZ — BİR TUR (≤ 40 dk): ÖZEL ölçüm kilidi (flock -x) bu tur için bir kez; üç kod dönüşümlü (sıra tur numarasıyla kayar), her kod kilitsiz + kilitli, her ölçüm TAZE veri kopyası (/dev/shm),
# her ölçüm başında yük < 1,5 beklenir (en çok 5 dk; aşılırsa ölçüm GEÇERSİZ diye işaretlenir). Çağrı: timeout -k 5 2700 bash hiz.sh <tur no 1|2|3> [tekrar=5]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
SRC=$S/ana-kabul/temiz-100k
D=/dev/shm/c6h5-olcum
NEW=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
TUR=${1:-1}
TEKRAR=${2:-5}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $A/hiz || exit 1
exec 9>$S/olcum.lock
echo "tur $TUR · kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 3600 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "tur $TUR · kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg) · yeni $(cd $NEW && git rev-parse --short=8 HEAD)"
one() {
  kod=$1; kip=$2
  case $kod in yeni) ROOT=$NEW;; tur4) ROOT=$A/kod-f73f4f5a;; eski) ROOT=$A/kod-5ee4d99e;; esac
  rm -rf "$D" && mkdir -p "$D" && cp -a "$SRC" "$D/v" || exit 1
  if [ "$kip" = kilitli ]; then python3 -I $A/betik4/kilit.py "$D/v/data/destekofis.sqlite" > /dev/null || exit 1; fi
  ok=GEÇERLİ
  for i in $(seq 1 30); do
    python3 -I -c "import sys; sys.exit(0 if float(open('/proc/loadavg').read().split()[0]) < 1.5 else 1)" && break
    sleep 10
  done
  python3 -I -c "import sys; sys.exit(0 if float(open('/proc/loadavg').read().split()[0]) < 1.5 else 1)" || ok=GEÇERSİZ
  echo "=== tur $TUR · $kod · $kip · başta yük $(cut -d' ' -f1-3 /proc/loadavg) · $ok · $(date -u +%H:%M:%S)" | tee -a $A/hiz/hiz-$kod-$kip.log
  TZ=UTC timeout -k 10 900 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/olc5.mjs "$ROOT" "$D/v" "$kip" "$TEKRAR" >> $A/hiz/hiz-$kod-$kip.log 2>&1
  echo "çıkış $? · sonda yük $(cut -d' ' -f1-3 /proc/loadavg) · $(date -u +%H:%M:%S)" | tee -a $A/hiz/hiz-$kod-$kip.log
  rm -rf "$D"
}
case $TUR in
  1) ORDER="eski tur4 yeni";;
  2) ORDER="yeni eski tur4";;
  *) ORDER="tur4 yeni eski";;
esac
for kip in kilitli kilitsiz; do
  for kod in $ORDER; do one $kod $kip; done
done
echo "tur $TUR bitti $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
