#!/bin/bash
# H4 yük koşuları (ders 15: flock ile tek başına; hız testinin kilidi). Kullanım: kos.sh <kod kökü> <etiket> [isci] [sn] [hazirlik] [duzenler]
# Örnek: kos.sh /yol/eski-kopya eski 20 240 1500 "ayri ayni" [1500-3500]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$1"; TAG="$2"; ISCI="${3:-20}"; SN="${4:-240}"; HAZ="${5:-1500}"; DUZEN="${6:-ayri ayni}"; LAG="${7:-}"; LAGYER="${8:-program}"
LOCK=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz-fatura/olcum.lock
mkdir -p "$HERE/ham"
exec 9>"$LOCK"
flock -w 1800 9 || { echo "kilit alınamadı (başka ölçüm koşuyor)"; exit 1; }
for d in $DUZEN; do
  out="$HERE/ham/$TAG-$d-${ISCI}x${SN}${LAG:+-gecikme$LAG-$LAGYER}"
  node --disable-warning=ExperimentalWarning "$HERE/yuk.mjs" "$ROOT" "$d" "$ISCI" "$SN" "$HAZ" "$LAG" "$LAGYER" > "$out.json" 2> "$out.log"
  echo "cikis=$?" >> "$out.log"
done
