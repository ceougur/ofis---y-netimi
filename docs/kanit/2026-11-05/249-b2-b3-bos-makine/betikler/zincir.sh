#!/bin/bash
# 2.4.9 B2/R2/B3 süre ölçümü — makine BOŞKEN, dal ucu (claude/compassionate-galileo-f9kghg, 5a22228a; ürün kodu 78976042 ile aynı).
# Her koşu flock /tmp/destekofis-olcum.lock + flock scratchpad/tam-npm-test.lock altında TEK TEK (ders 15). Önüne/arkasına uptime + df (.uptime).
# Ana depoya YAZMAZ: çıktılar $O/cikti, B3 kanit.mjs kayıtları KANIT_DIR=$O/cikti/kanit.
SP=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad
O=$SP/olcum-249-q5n8
YENI=/home/user/ofis---y-netimi
ESKI=$O/eski-e3f74093
T9=$SP/t9-4c8e1d
TABAN=$SP/b2-kod-a954/hazir-taban          # 03.11 B2 ölçümünün AYNI hazır verisi (salt okunur kaynak; kurulum taze kopya alır)
IADE=$SP/r2-249-aa56/hazir-iade            # 03.11 R2 ölçümünün AYNI hazır verisi (salt okunur kaynak)
K=$O/cikti
L1=/tmp/destekofis-olcum.lock
L2=$SP/tam-npm-test.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=$SP/p1-kod-ac15eb6c/pw
mkdir -p $K || exit 1
avail=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
if [ "$avail" -lt 5 ]; then echo "disk: yalnız ${avail} GB boş (ders 24)" | tee -a $K/zincir.txt; exit 1; fi
kilitli() { # <ad> <kök> <komut…> : iki kilit altında, önce/sonra yük
  local ad=$1 kok=$2; shift 2
  (cd $kok && flock $L1 flock $L2 sh -c '{ date -u; uptime; df -h / | tail -1; ps -eo pid,pcpu,etime,args --sort=-pcpu | head -6; } > "$0"; "$@"; c=$?; { date -u; uptime; } >> "$0"; exit $c' "$K/$ad.uptime" "$@" > $K/$ad.log 2>&1)
  local c=$?
  echo "$(date -u +%H:%M:%S) $ad çıkış=$c" | tee -a $K/zincir.txt
  return $c
}
N="node --disable-warning=ExperimentalWarning"
adim() { case "$1" in
  hazir-gecmis) [ -d $O/hazir-gecmis/data ] || kilitli hazir-gecmis $YENI $N test/b2-249/esitlik-hazirla.mjs $T9/gecmis-40 $O/hazir-gecmis $K/hazir-gecmis-ozet.json ;;
  hazir-bes-bin) [ -d $O/hazir-bes-bin/data ] || kilitli hazir-bes-bin $YENI $N test/b2-249/ek-hazirla.mjs $TABAN $O/hazir-bes-bin bes-bin $K/hazir-bes-bin-ozet.json ;;
  yeni-taban) kilitli olcum-yeni-taban $YENI $N test/b2-249/olcum.mjs $TABAN $O/is-olcum-yeni $K/olcum-yeni-taban.json taban 2; rm -rf $O/is-olcum-yeni ;;
  eski-taban) kilitli olcum-eski-taban $ESKI env ISZ_COMMIT=e3f74093 $N test/b2-249/olcum.mjs $TABAN $O/is-olcum-eski $K/olcum-eski-taban.json taban 1; rm -rf $O/is-olcum-eski ;;
  yeni-bes-bin) kilitli olcum-yeni-bes-bin $YENI $N test/b2-249/olcum.mjs $O/hazir-bes-bin $O/is-olcum-yeni $K/olcum-yeni-bes-bin.json bes-bin 2; rm -rf $O/is-olcum-yeni ;;
  yeni-gecmis) kilitli olcum-yeni-gecmis $YENI $N test/b2-249/olcum.mjs $O/hazir-gecmis $O/is-olcum-yeni $K/olcum-yeni-gecmis.json gecmis 2; rm -rf $O/is-olcum-yeni ;;
  yeni-iade) kilitli olcum-yeni-iade $YENI $N test/b2-249/olcum.mjs $IADE $O/is-olcum-yeni $K/olcum-yeni-iade.json iade 2; rm -rf $O/is-olcum-yeni ;;
  yeni-ek) kilitli olcum-ek-yeni $YENI $N test/r2-249/olcum-ek.mjs $IADE $O/is-olcum-yeni $K/olcum-ek-yeni.json 2; rm -rf $O/is-olcum-yeni ;;
  ekran-yeni) kilitli ekran-yeni $YENI $N test/b2-249/ekran-olcum.mjs $TABAN $O/is-ekran-yeni $K/ekran-yeni.json 2; rm -rf $O/is-ekran-yeni ;;
  b3-uret) kilitli b3-sonra-uret $YENI env KANIT_DIR=$K/kanit $N tools/kanit.mjs kos b3/olcum-sonra-uret -- $N test/t9-248/wa-gecmis-uret.mjs --veri $T9/taban-2910 --is $O/b3-sonra --json $K/sonuc-b3-sonra-uret.json --toplam 100 --bas 0 --adet 10 --olc ;;
  b3-dosya) kilitli b3-sonra-dosya $YENI env KANIT_DIR=$K/kanit $N tools/kanit.mjs kos b3/olcum-sonra-dosya -- $N test/t9-248/b3-dosya-olcum.mjs --veri $O/b3-sonra --is $O/b3-sonra-dosya-is --json $K/sonuc-b3-sonra-dosya.json; rm -rf $O/b3-sonra-dosya-is ;;
  b3-goc) kilitli b3-goc-yeni $YENI env KANIT_DIR=$K/kanit $N tools/kanit.mjs kos b3/olcum-goc-yeni-gecmis40 -- $N test/t9-248/b3-dosya-olcum.mjs --veri $T9/gecmis-40 --is $O/b3-goc-is --json $K/sonuc-b3-goc-yeni-gecmis40.json --goc; rm -rf $O/b3-goc-is ;;
  *) echo "adım? $1"; return 2 ;;
esac; }
for a in "$@"; do adim $a; done
echo "$(date -u +%H:%M:%S) bitti: $*" | tee -a $K/zincir.txt
