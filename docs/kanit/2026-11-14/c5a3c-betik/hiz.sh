#!/bin/bash
# Ç5-A tur 3c HIZ: taban ↔ yeni, hazırlanmış kopyanın (temiz 100 bin + şüpheli bağlı cari) TAZE kopyalarında, sıra taban → yeni → taban → yeni; ÖZEL kilit (beklemez).
# Kullanım: timeout 7000 bash hiz.sh <kilitsiz|kilitli> [tekrar=5]
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
KIP=${1:-kilitsiz}; N=${2:-5}; OUT=$K/hiz-$KIP.txt
exec 9>"$S/olcum.lock"
flock -x -n 9 || { echo "KİLİT DOLU — ÖLÇÜLEMEDİ" | tee $OUT; exit 3; }
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "HIZ Ç5-A tur 3c · $KIP · tekrar $N · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for ad in taban yeni taban yeni; do
  rm -rf /dev/shm/c5a3c-k7/olc-kopya
  cp -a /dev/shm/c5a3c-k7/hazir /dev/shm/c5a3c-k7/olc-kopya || exit 1
  if [ "$KIP" = kilitli ]; then python3 -I $S/c5a2-olcum/kilit.py /dev/shm/c5a3c-k7/olc-kopya/data/destekofis.sqlite >> $OUT || exit 1; fi
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $ad · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  TZ=Europe/Istanbul timeout -k 5 2400 node --max-old-space-size=8192 --disable-warning=ExperimentalWarning $K/olc-c5a3c.mjs $K/$ad /dev/shm/c5a3c-k7/olc-kopya $N >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf /dev/shm/c5a3c-k7/olc-kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
