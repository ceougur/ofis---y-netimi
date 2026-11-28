#!/bin/bash
# m2t6 mutant koşusu 2 (ilk koşu 30 dk arka plan sınırına takıldı — M18'de kesildi, BELİRSİZ; yalnız kalanlar): kalan mutantlar UTC, tur 6'nınkiler (+ M27p) Europe/Istanbul.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a961aa7259bce4276
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t6-kanit
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cat /proc/loadavg
MUT_TZ=UTC flock -s -w 3600 "$L" timeout -k 5 3600 python3 -I "$W/docs/kanit/2026-11-28/m2t6-arac/mutant.py" $(cat "$K/kalan-mutant.txt") > "$K/mutant-UTC-2.txt" 2>&1
echo "UTC çıkış $?"
cat /proc/loadavg
MUT_TZ=Europe/Istanbul flock -s -w 3600 "$L" timeout -k 5 1200 python3 -I "$W/docs/kanit/2026-11-28/m2t6-arac/mutant.py" M27p-alis-faturasi-denetimi-yok M28-alis-tutar-kosulu-geri-geldi M29-alis-ileti-sozu-tutarin-artirilmasi M30-alis-cari-degisiminde-de-denetim M31-alis-yalniz-tutar-duserken > "$K/mutant-Europe-Istanbul.txt" 2>&1
echo "İstanbul çıkış $?"
