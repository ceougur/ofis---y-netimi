# Kullanım: bash surucu-on.sh <kök> <etiket> [tz…]   (tz verilmezse iki TZ)
ROOT=$1
ETIKET=$2
shift 2
TZS=${*:-"Europe/Istanbul UTC"}
cd "$ROOT" || exit 1
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
export KANIT_DIR=$S/watur3-kanit
for tz in $TZS; do
  t=${tz//\//-}
  cat /proc/loadavg
  node /home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs kos watur3-surucu-$ETIKET-$t -- node $S/watur3-betik/surucu-sar.mjs --uc hizli --tz $tz --cikti $S/watur3-cikti/surucu-$ETIKET-$t
done
cat /proc/loadavg
echo BITTI
