#!/bin/bash
# M1 KÜÇÜK TUR 5 KOPYASI: küçük tur 4ün e2e.sh'i AYNEN — yalnız yollar bu tura (ağaç agent-a925406d24b0912d5, ad öneki m1k5-) ve TZ değişkeni ($6: utc | ist).
# Önceki başlık: M1 küçük tur 3 — KDV Özeti'ne dokunan ekran senaryoları (kabul D). flock -s altında çağrılır.
# $1 = kod kökü, $2 = ekran görüntüsü klasörü, $3 = kanıt klasörü, $4 = senaryo listesi (boşluklu; varsayılan sekizi — git grep 28.11 ile aynı), $5 = ad eki (yeni | taban), $6 = utc | ist.
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a925406d24b0912d5
CODE=${1:-$WT}
SHOTS=${2:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k5/ekran}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=${3:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k5/kanit}
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
LIST=${4:-"senaryo-kdv-mahsup-sonrasi-251 senaryo-kdv-zincir-251 senaryo-kdv-devreden-251 senaryo-kdv-donemi-250 senaryo-defter-243 senaryo-c7b-kabul-250 senaryo-mobil-247 senaryo-banka-210"}
SIDE=${5:-yeni}
case "${6:-utc}" in utc) export TZ=UTC; TAG=utc ;; ist) export TZ=Europe/Istanbul; TAG=ist ;; *) echo "utc | ist"; exit 2 ;; esac
mkdir -p "$SHOTS"
for s in $LIST; do
  mkdir -p "$SHOTS/$TAG/$s"
  echo "== $s $TAG $(cat /proc/loadavg)"
  (cd "$CODE" && EKRAN_DIR="$SHOTS/$TAG/$s" timeout -k 5 2400 node "$WT/tools/kanit.mjs" kos "m1k5-e2e-$SIDE-$TAG-$s" -- node test/e2e/$s.mjs) 2>&1 | grep -E "^\[kanit\]|✗|geçti, [0-9]+ kaldı"
done
