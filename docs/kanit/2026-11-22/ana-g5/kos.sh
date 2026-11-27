#!/bin/bash
# G5 (ana oturum, ajansız): bugünkü muhasebe sürücüsüyle eski program (fce3d272 = sürücü bakımı 5 ucu) ve birleşik kod (çalışma dalı) — iki TZ; sonra gerileme.py. Paylaşılan kilit; süre sınırı içeride.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-g5
R=/home/user/ofis---y-netimi
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S) · yeni $(git -C $R log --oneline -1 | cut -c1-9)" > $D/ozet.txt
rm -rf /dev/shm/ana-g5-eski /dev/shm/ana-g5-veri-eski /dev/shm/ana-g5-veri-yeni && mkdir -p /dev/shm/ana-g5-eski && git -C $R archive fce3d272 server client test/helpers.mjs package.json | tar -x -C /dev/shm/ana-g5-eski || { echo "arşiv hatası" >> $D/ozet.txt; exit 1; }
cd $R || exit 1
timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti $D/yeni --veri /dev/shm/ana-g5-veri-yeni > $D/yeni.log 2>&1; echo "sürücü YENİ çıkış $? $(date -u +%H:%M:%S)" >> $D/ozet.txt
timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti $D/eski --veri /dev/shm/ana-g5-veri-eski --program /dev/shm/ana-g5-eski > $D/eski.log 2>&1; echo "sürücü ESKİ çıkış $? $(date -u +%H:%M:%S)" >> $D/ozet.txt
timeout 900 python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py $D/eski $D/yeni > $D/gerileme.txt 2>&1; echo "gerileme.py çıkış $?" >> $D/ozet.txt
rm -rf /dev/shm/ana-g5-eski /dev/shm/ana-g5-veri-eski /dev/shm/ana-g5-veri-yeni
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
