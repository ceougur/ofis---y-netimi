#!/bin/bash
# Ölçümden sonra yük koşuları sırayla (her biri kendi paylaşılan kilidini alır): komşu İstanbul → kırmızı (eski kod) → mutasyon → kâhinler önce / sonra.
A=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag
echo "komşu İstanbul $(date -u +%H:%M:%S)"; timeout -k 5 3000 bash $A/komsu-kos.sh Europe/Istanbul
echo "kırmızı $(date -u +%H:%M:%S)"; timeout -k 5 1800 bash $A/kirmizi.sh
echo "mutasyon $(date -u +%H:%M:%S)"; timeout -k 5 3000 bash $A/mutasyon.sh
echo "kâhin $(date -u +%H:%M:%S)"; timeout -k 5 3600 bash $A/kahin.sh
echo "ZİNCİR BİTTİ $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
