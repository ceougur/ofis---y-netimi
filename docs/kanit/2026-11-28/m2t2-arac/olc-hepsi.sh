#!/bin/bash
# M2T2 hız tablosu: aynı veri kopyaları (taban kodla üretildi) × üç kod (yeni / tur 1 = t251-m2t2-taban / tur 1 öncesi = t251-m2-taban). Yük altında (gösterge); ana oturum flock -x ile yineler.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2
O="$S/kanit/olcum"
mkdir -p "$O"
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2da3cc091eb2c5df
for veri in n60-k1-h0 n60-k1-h1 n250-k3-h0 n250-k3-h1; do
  for kod in yeni eski once; do
    case $kod in yeni) R=$W ;; eski) R=/dev/shm/m2t2-a2da/eski ;; once) R=/dev/shm/m2t2-a2da/once ;; esac
    T=5
    if [ "$kod" = eski ] && [ "${veri#n250}" != "$veri" ]; then T=1; fi
    ROOT=$R VERI=/dev/shm/m2t2-a2da/veri/$veri TEKRAR=$T HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1500 node "$S/betik/p6-olc.mjs" > "$O/$veri-$kod.txt" 2>&1 || echo "HATA $veri $kod" >> "$O/hata.txt"
  done
done
echo bitti > "$O/bitti.txt"
