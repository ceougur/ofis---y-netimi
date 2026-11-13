#!/bin/bash
# İşlemci süresi karşılaştırması (yük koşusu; paylaşımlı kilit): önce / yeni / yeni + önerilen yamalar — iki tur, sıra dönüşümlü. Her koşu süre sınırlı.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1f2aaed82706fb62
OUT=$N/kanit/hiz-saf.out
echo "İŞLEMCİ SÜRESİ (kabul ölçümü değil) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > "$OUT"
for sira in "once yeni oneri" "oneri yeni once"; do
  for kod in $sira; do
    case $kod in once) R=$N/once ;; yeni) R=$N/mut ;; oneri) R=$N/mut2 ;; esac
    rm -rf "$N/cpu-kopya" && cp -a "$SRC" "$N/cpu-kopya" || { echo "KOPYA HATASI" >> "$OUT"; exit 1; }
    (cd "$N/betik" && timeout -k 5 420 node --disable-warning=ExperimentalWarning hiz-saf.mjs "$R" "$N/cpu-kopya" "$kod" 2>&1 | tail -1) >> "$OUT"
  done
done
rm -rf "$N/cpu-kopya"
echo "bitti $(date -u +%H:%M:%S) · sonda $(cat /proc/loadavg)" >> "$OUT"
