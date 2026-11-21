#!/bin/bash
# Ç7b TUR 2f (devam ajanı) — kabul E: taban (c7b2-taban, /dev/shm kopyası) ↔ yeni (c7b2f-devam ucu, kendi worktree'm), her blok verinin TAZE kopyasında (/dev/shm),
# taban → yeni → taban → yeni; ÖZEL ölçüm kilidi (tek seferlik bekleme, döngü yok); blok başında hazırlığın yükü sönsün diye en çok 10 dk bekleme (ana oturumun hiz.sh kalıbı).
# Çağrı: timeout -k 5 7000 bash hiz.sh <kilitsiz|kilitli> [tekrar=5]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; N=$S/c7b2f-dv; H=$N/hiz; V=/dev/shm/c7b2f-dv
KIP=${1:-kilitsiz}; REP=${2:-5}; TAB=$V/taban; YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a207e4248e7dd70da
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
OUT=$H/hiz-$KIP.txt
exec 9>"$S/olcum.lock"; flock -x -w 1800 9 || { echo "KİLİT ALINAMADI — ÖLÇÜLEMEDİ" > $OUT; exit 3; }
echo "HIZ c7b2f · $KIP · tekrar $REP · kilit $(date -u +%H:%M:%S) · başta $(cat /proc/loadavg) · nproc $(nproc) · yeni $(cd $YENI && git rev-parse --short HEAD)" > $OUT
for k in taban:$TAB yeni:$YENI taban:$TAB yeni:$YENI; do
  kn=${k%%:*}; R=${k#*:}; K=$V/kopya
  rm -rf $K && cp -a $S/ana-kabul/temiz-100k $K || exit 1
  [ "$KIP" = kilitli ] && { python3 -I $S/c5a2-olcum/kilit.py $K/data/destekofis.sqlite >> $OUT || exit 1; }
  sync; for w in $(seq 1 60); do awk '{exit !($1<1.5)}' /proc/loadavg && break; sleep 10; done
  l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $kn · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout -k 5 2400 node --max-old-space-size=8192 --disable-warning=ExperimentalWarning $H/olc-c7b.mjs "$R" $K $REP >> $OUT 2>&1
  echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf $V/kopya
echo "bitti $(date -u +%H:%M:%S) · $(grep -c 'GEÇERSİZ' $OUT) geçersiz blok" >> $OUT
