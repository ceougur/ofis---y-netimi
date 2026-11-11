# WhatsApp e2e'leri + şema kapısı + yedek (ders 28 / 37 komşuları). <kök>
ROOT=$1
cd "$ROOT" || exit 1
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs
export KANIT_DIR=$S/watur3-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
for s in senaryo-whatsapp senaryo-whatsapp-ayar-248 senaryo-whatsapp-donem-248 senaryo-whatsapp-sablon-248 senaryo-whatsapp-gonder-248 senaryo-whatsapp-kvkk-250 sema-kapisi-bs7 senaryo-220-yedek; do
  cat /proc/loadavg
  node $K kos watur3-e2e-$s -- npm run test:$s
done
cat /proc/loadavg
echo BITTI
