#!/bin/bash
# Ç5-B kapanış düzeltmesi madde 5 — HIZ KABUL ÖLÇÜMÜ (ders 15, 52, 53): Ç5-B öncesi (8d6ea9c9^1) / bugün (taban 0c9d1069 = 8d6ea9c9 ürünü) / benim kodum.
# Ana oturumun düzeneğiyle AYNI betikler (ana-kabul/betik/olc-yazim.mjs, olc-kart.mjs — buraya kopyalandı), aynı temiz-100k verisi; her ölçüm TAZE kopyada; sıra dönüşümlü.
# Çağrı: flock -x -n <scratchpad>/olcum.lock bash kabul-uc.sh <çıktı klasörü> [tur=2] [tekrar=3]     (yük > 2 ise satır GEÇERSİZ)
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
OUT=$1; TUR=${2:-2}; TEKRAR=${3:-3}
[ -n "$OUT" ] || { echo "kullanım: kabul-uc.sh <çıktı klasörü> [tur] [tekrar]"; exit 2; }
mkdir -p "$OUT" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
K=$S/c5bkd-kabul-kopya
echo "HIZ KABUL · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · benim kodum $(git -C $W rev-parse --short HEAD) + çalışma ağacı" > "$OUT/ozet.txt"
for tur in $(seq 1 $TUR); do
  if [ $((tur % 2)) -eq 1 ]; then sira="once bugun benim"; else sira="benim bugun once"; fi
  for kod in $sira; do
    case $kod in once) R=$S/c5bkd-once ;; bugun) R=$S/c5bkd-taban ;; benim) R=$W ;; esac
    F="$OUT/$kod-$tur.txt"
    echo "kod $kod ($R) · tur $tur · $(date -u +%H:%M:%S)" > "$F"
    for b in olc-yazim.mjs olc-kart.mjs; do
      rm -rf "$S/c5bkd-kabul-kopya"
      cp -a $S/c5bkd-veri-prof "$K" || exit 1
      sync; l0=$(cut -d' ' -f1 /proc/loadavg)
      echo "=== $b · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> "$F"
      (cd $S/c5bkd-betik && timeout 900 node --disable-warning=ExperimentalWarning $b "$R" "$K" $TEKRAR >> "$F" 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> "$F")
    done
    echo "$kod tur $tur bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> "$OUT/ozet.txt"
  done
done
rm -rf "$S/c5bkd-kabul-kopya"
echo "bitti $(date -u +%H:%M:%S) · sonda $(cat /proc/loadavg)" >> "$OUT/ozet.txt"
