#!/bin/bash
# zorla2.mjs'i eski ve yeni kodla iki işlemde (checkUser, status) koşar; çıktı ham/zorla2-<etiket>-<işlem>.json.
# Kullanım: zorla2-kos.sh <eski kod kökü> <yeni kod kökü>
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
for op in checkUser status; do
  timeout 110 node "$HERE/zorla2.mjs" "$1" 5 "$op" 2500,2000,4000 > "$HERE/ham/zorla2-eski-$op.json" 2>&1; echo "eski $op cikis=$?"
  timeout 110 node "$HERE/zorla2.mjs" "$2" 5 "$op" 2500,2000,4000 > "$HERE/ham/zorla2-yeni-$op.json" 2>&1; echo "yeni $op cikis=$?"
done
tail -n1 "$HERE"/ham/zorla2-eski-checkUser.json "$HERE"/ham/zorla2-yeni-checkUser.json "$HERE"/ham/zorla2-eski-status.json "$HERE"/ham/zorla2-yeni-status.json
