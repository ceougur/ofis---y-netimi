#!/bin/bash
# Fatura/e-Belge/stok ekranına dokunan e2e senaryoları — her biri ortak kilitle tek tek (kilitli.sh), sonuç docs/kanit/<gün>/fatura243-<senaryo>.
# Kullanım (depo kökünden): bash docs/kanit/2026-10-17/fatura243-e2e/hepsi.sh [senaryo…]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LIST=("$@")
if [ ${#LIST[@]} -eq 0 ]; then
  LIST=(senaryo-fatura-243 senaryo-ebelge-242 senaryo-ebelge-243 senaryo-entegrator-240 e2e senaryo-pos-220 senaryo-iz32-230 senaryo-supheli-230 senaryo-215 senaryo-216 senaryo-217 senaryo-210 senaryo-222 senaryo-223 senaryo-224 senaryo-banka-220)
fi
for s in "${LIST[@]}"; do
  bash "$HERE/kilitli.sh" "fatura243-$s" npm run "test:$s" > /dev/null 2>&1
  echo "$s cikis=$?"
done
