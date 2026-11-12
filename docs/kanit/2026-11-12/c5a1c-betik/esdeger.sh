#!/bin/bash
# esdeger.sh <taban kökü> <uç kökü> <kapsam: buyuk|fikstur|hepsi> — aynı veri kopyasında önce taban, sonra uç; iki TZ; karşılaştırma. Veri kopyaları /dev/shm'de (disk sınırı).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
O=$S/c5a1c-olcum
BASE=$1; TIP=$2; SCOPE=${3:-hepsi}
REPO=/home/user/ofis---y-netimi/.claude/worktrees/agent-abcc687dbece45440
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $O/esdeger
fails=0; total=0
pair() { # <etiket> <veri kökü> <bugün> <tz>
  local tag=$1 dir=$2 today=$3 tz=$4
  # Her kod AYNI verinin AYRI kopyasını açar (Mutabakat Testi günlüğe yazar — taban yazımı ucun çıktısına girmesin).
  rm -rf $dir.uc && cp -a $dir $dir.uc || exit 1
  TZ=$tz node --disable-warning=ExperimentalWarning $O/esdeger.mjs $BASE $dir $today $O/esdeger/$tag-taban.json > $O/esdeger/$tag-taban.log 2>&1 || { echo "TABAN KOŞUSU DÜŞTÜ $tag"; tail -5 $O/esdeger/$tag-taban.log; fails=$((fails+1)); rm -rf $dir.uc; return; }
  TZ=$tz node --disable-warning=ExperimentalWarning $O/esdeger.mjs $TIP $dir.uc $today $O/esdeger/$tag-uc.json > $O/esdeger/$tag-uc.log 2>&1 || { echo "UÇ KOŞUSU DÜŞTÜ $tag"; tail -5 $O/esdeger/$tag-uc.log; fails=$((fails+1)); rm -rf $dir.uc; return; }
  rm -rf $dir.uc
  total=$((total+1))
  node $O/esdeger-karsilastir.mjs $O/esdeger/$tag-taban.json $O/esdeger/$tag-uc.json $tag || fails=$((fails+1))
}
for tz in Europe/Istanbul UTC; do
  z=$(echo $tz | tr '/' '-')
  if [ "$SCOPE" != fikstur ]; then
    for kip in kilitsiz kilitli; do
      D=/dev/shm/c5a1c-e-$kip; rm -rf $D && cp -a $S/ana-kabul/temiz-100k $D || exit 1
      if [ $kip = kilitli ]; then python3 -I $O/kilit.py $D/data/destekofis.sqlite > /dev/null || exit 1; fi
      pair 100k-$kip-$z $D 2026-10-08 $tz
      rm -rf $D
    done
  fi
  if [ "$SCOPE" != buyuk ]; then
    for f in $(ls $REPO/test/fixtures | grep '^surum-' | grep -v 'surum-nesneler'); do
      D=/dev/shm/c5a1c-f-$f
      today=$(node $O/fikstur-ac.mjs $REPO $f $D) || { echo "fikstür açılamadı $f"; fails=$((fails+1)); continue; }
      export PAROLA=fikstur; pair $f-$z $D $today $tz; unset PAROLA
      rm -rf $D
    done
  fi
done
echo "[eşdeğerlik özet] $total çift karşılaştırıldı · $fails başarısız / farklı"
exit $fails
