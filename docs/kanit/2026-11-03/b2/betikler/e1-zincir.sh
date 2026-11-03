#!/bin/bash
# B2 E1 zinciri: hazırlık (gecmis-40) + eski/yeni eşitlik koşuları. Her koşu flock altında tek tek.
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954
T9=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/t9-4c8e1d
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a95435e4eb1b4db61
ESKI=$S/eski-e3f74093
K=$YENI/docs/kanit/2026-11-03/b2/e1
mkdir -p $K
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export ISZ_COMMIT=e3f74093
L=/tmp/destekofis-olcum.lock
df -h / | tail -1 > $K/df-basta.txt
if [ ! -d $S/hazir-gecmis/data ]; then
  (cd $YENI && flock $L node --disable-warning=ExperimentalWarning test/b2-249/esitlik-hazirla.mjs $T9/gecmis-40 $S/hazir-gecmis $K/hazir-gecmis-ozet.json > $K/hazir-gecmis.log 2>&1) || { echo "hazırlık gecmis düştü" | tee -a $K/zincir.txt; exit 1; }
fi
cp $S/hazir-taban-ozet.json $K/hazir-taban-ozet.json
kos() { # $1 kod (eski|yeni) $2 veri adı $3 saat $4 kapsam $5 tz $6 ek
  local kok=$YENI; [ "$1" = eski ] && kok=$ESKI
  local ad="$1-$2-$(echo $3 | tr -d ':')-$4-$(echo $5 | tr '/' '_')${6:+-$6}"
  (cd $kok && TZ=$5 flock $L node --disable-warning=ExperimentalWarning test/b2-249/esitlik-kos.mjs $S/hazir-$2 $S/is-e1-$1 $S/e1/$ad.json $3 $4 $6 > $K/$ad.log 2>&1)
  echo "$ad çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-e1-$1
}
for TZ in UTC Europe/Istanbul; do
  kos yeni taban 2026-11-03T15:00:00 tam $TZ
  kos eski taban 2026-11-03T15:00:00 tam $TZ
  for SAAT in 2026-12-01T00:30:00 2026-11-30T23:30:00 2026-12-31T23:30:00 2027-01-01T00:30:00; do
    kos yeni taban $SAAT dar $TZ
    kos eski taban $SAAT dar $TZ
  done
  kos yeni gecmis 2026-11-03T15:00:00 dar $TZ
  kos eski gecmis 2026-11-03T15:00:00 dar $TZ
done
kos yeni taban 2026-11-03T15:00:00 tam UTC dis
df -h / | tail -1 > $K/df-sonda.txt
echo bitti | tee -a $K/zincir.txt
