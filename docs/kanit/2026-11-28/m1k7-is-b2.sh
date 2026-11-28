#!/bin/bash
# m1k7 iş B2: iş B aracın 30 dk arka plan sınırında kesildi (eski-yil-ist yarıda — BELİRSİZ, ders 2 / 55); yalnız o adım + mutantlar yeniden.
E=/dev/shm/m1k7-eski/eski
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k7
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
D=$N/durum-b.txt
echo "--- B2 (iş B 30 dk araç sınırında kesildi; eski-yil-ist BELİRSİZ, yeniden)" >> "$D"
read l _ < /proc/loadavg; echo "yük $l (B2 başlangıç)" >> "$D"
awk -v l="$l" 'BEGIN{exit !(l>4)}' && { sleep 120; echo "yük $(cut -d' ' -f1 /proc/loadavg) (tek bekleme sonrası)" >> "$D"; }
s=$(date +%s)
(cd "$K" && ROOT=$E TZ=Europe/Istanbul SET=yil SEEDS=1-200 flock -s -w 3600 "$L" node --disable-warning=ExperimentalWarning s2-karisik.mjs > "$N/s2/eski-yil-ist.jsonl" 2> "$N/s2/eski-yil-ist.err")
echo "eski-yil-ist çıkış=$? süre=$(( $(date +%s) - s )) yük=$(cut -d' ' -f1 /proc/loadavg)" >> "$D"
s=$(date +%s)
flock -s -w 3600 "$L" python3 -I "$N/m1k7-mutant.py" "$N" > "$N/mutant-kos.txt" 2>&1
echo "mutant çıkış=$? süre=$(( $(date +%s) - s ))" >> "$D"
echo BITTI >> "$D"
