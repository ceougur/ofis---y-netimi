#!/bin/bash
# Ç7b aday düzeltme turu — HIZ (ders 47, 52, 53 (a)): taban = surucu5-uc (fce3d272; /dev/shm/c7bfix-a66/eski) ↔ yeni = db290c39 (/dev/shm/c7bfix-a66/yeni).
# Kalıp: ana oturumun ana-c7ba/hiz.sh (okundu). Her ölçüm TAZE veri kopyasında (temiz-100k → /dev/shm/c7bfix-a66/kopya); eski → yeni → eski → yeni → eski → yeni; ÖZEL ölçüm
# kilidi tek seferlik (-w 1800; döngü yok); her ölçüm başında yük < 1,5 beklemesi (en çok 10 dk); başta yük > 2 → GEÇERSİZ. Kilitli kipte kopya kilit.py ile (2026-06-30).
# Çağrı: timeout -k 5 5400 bash hiz.sh <kilitsiz|kilitli> [tekrar=5]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/c7bfix-a66
KIP=${1:-kilitsiz}; REP=${2:-5}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
OUT=$A/hiz-$KIP.txt
exec 9>"$S/olcum.lock"; flock -x -w 1800 9 || { echo "KİLİT ALINAMADI — ÖLÇÜLEMEDİ" > "$OUT"; exit 3; }
echo "HIZ c7bfix · $KIP · tekrar $REP · kilit $(date -u +%H:%M:%S) · başta $(cat /proc/loadavg) · nproc $(nproc) · eski $(git -C /dev/shm/c7bfix-a66/eski rev-parse --short HEAD) · yeni $(git -C /dev/shm/c7bfix-a66/yeni rev-parse --short HEAD)" > "$OUT"
kopya() { rm -rf /dev/shm/c7bfix-a66/kopya && cp -a $S/ana-kabul/temiz-100k /dev/shm/c7bfix-a66/kopya || exit 1; }
bekle() {
  sync; for w in $(seq 1 60); do awk '{exit !($1<1.5)}' /proc/loadavg && break; sleep 10; done
  l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "--- $1 · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> "$OUT"
}
for kn in eski yeni eski yeni eski yeni; do
  R=/dev/shm/c7bfix-a66/$kn
  if [ "$kn" = eski ]; then M=own; else M=shown; fi
  echo "=== $kn · $(date -u +%H:%M:%S)" >> "$OUT"
  kopya
  if [ "$KIP" = kilitli ]; then python3 -I $S/ana-c7ba/betik/kilit.py /dev/shm/c7bfix-a66/kopya/data/destekofis.sqlite >> "$OUT" || exit 1; fi
  bekle "$kn"
  timeout -k 5 1500 node --max-old-space-size=8192 --disable-warning=ExperimentalWarning $A/olc-c7bfix.mjs "$R" /dev/shm/c7bfix-a66/kopya "$M" "$REP" >> "$OUT" 2>&1
  echo "çıkış $? · sonda $(cat /proc/loadavg)" >> "$OUT"
done
rm -rf /dev/shm/c7bfix-a66/kopya
echo "bitti $(date -u +%H:%M:%S) · $(grep -c 'GEÇERSİZ' "$OUT") geçersiz ölçüm" >> "$OUT"
