#!/bin/bash
# K-D kanıt koşuları: bash kos.sh <parça>   (temel | mutkd | mut <a:b> <etiket>)
# Her koşu tools/kanit.mjs kos ile, ölçüm kilidinin PAYLAŞIMLI tarafında, süre sınırı flock'un İÇİNDE.
AGAC=/home/user/ofis---y-netimi/.claude/worktrees/agent-ad49f9163f813598d
ND=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kd-devir
KILIT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd "$AGAC" || exit 1
export KANIT_DIR="$ND"
k() {  # k <tz> <ad> <sn> <komut…>
  local tz=$1 ad=$2 sn=$3; shift 3
  echo "== $(date -u +%H:%M:%S) $ad (TZ=$tz) yük $(cut -d' ' -f1-3 /proc/loadavg)"
  TZ=$tz flock -s -w 3600 "$KILIT" timeout -k 5 "$sn" node tools/kanit.mjs kos "$ad" -- "$@" > "$ND/$ad.out" 2>&1
  echo "   çıkış $? · $(grep '^\[kanit\]' "$ND/$ad.out" | tail -1)"
}
case "$1" in
  temel)
    for tz in UTC Europe/Istanbul; do
      e=$([ $tz = UTC ] && echo utc || echo ist)
      k $tz kd-test-$e 1500 python3 -I test/bagimsiz/muhasebe/test_model.py
      k $tz kd-denetle-$e 900 python3 -I test/bagimsiz/muhasebe/uret_beklenen.py --denetle
      k $tz kd-g3-$e 600 python3 -I docs/kanit/2026-11-27/kd-g3-betik.py "$ND/g3-eski/senaryolar" test/bagimsiz/muhasebe/senaryolar "$ND/kd-g3-dokum-$e.json"
      k $tz kd-g3-s1-$e 600 python3 -I docs/kanit/2026-11-27/kd-g3-s1-denetim.py "$ND/kd-g3-dokum-$e.json" "$ND/g3-eski/senaryolar" test/bagimsiz/muhasebe/senaryolar
    done ;;
  mutkd)
    for tz in UTC Europe/Istanbul; do
      e=$([ $tz = UTC ] && echo utc || echo ist)
      MUTASYON_ARALIK=330:347 k $tz kd-yeni-mutantlar-$e 2400 python3 -I test/bagimsiz/muhasebe/mutasyon.py
    done ;;
  mut)   # mut <tz> <a:b> <etiket> [<a:b> <etiket> …]  — her parça kendi 40 dk sınırıyla
    tz=$2; e=$([ $tz = UTC ] && echo utc || echo ist); shift 2
    while [ $# -ge 2 ]; do
      MUTASYON_ARALIK=$1 k $tz kd-mutasyon$2-$e 2400 python3 -I test/bagimsiz/muhasebe/mutasyon.py
      shift 2
    done ;;
esac
