#!/bin/bash
# M2T3: mutant satırlarını ve komşu koşularının bitişini olay olarak yazar; ikisi de bitince çıkar.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t3-ae39/kanit
seen=0
while true; do
  n=$(wc -l < "$K/mutant-ozet.txt" 2>/dev/null || echo 0)
  if [ "$n" -gt "$seen" ]; then sed -n "$((seen+1)),${n}p" "$K/mutant-ozet.txt" | cut -c1-220; seen=$n; fi
  for f in "$K/komsu-UTC-cikti.txt" "$K/komsu-Europe-Istanbul-cikti.txt"; do
    if grep -q "^çıkış" "$f" 2>/dev/null && [ ! -e "$f.bildirildi" ]; then grep "\[kanit\] m2t3\|^çıkış" "$f" | tail -2; touch "$f.bildirildi"; fi
  done
  if grep -q "^çıkış" "$K/mutant-ozet.txt" 2>/dev/null && [ -e "$K/komsu-bitti.txt" ]; then exit 0; fi
  sleep 20
done
