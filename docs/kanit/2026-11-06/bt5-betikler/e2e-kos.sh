#!/bin/bash
# BT5: dokunulan davranışın e2e'leri (sırayla, kanıt aracıyla). Kullanım: e2e-kos.sh <TZ> <senaryo…>  (senaryo = test/e2e/<ad>.mjs adı)
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
cd "$W" || exit 1
ZONE="$1"
shift
SHORT=$([ "$ZONE" = UTC ] && echo utc || echo ist)
for NAME in "$@"; do
  KANIT_DIR="$S/bt5-kanit" TZ="$ZONE" PLAYWRIGHT_BROWSERS_PATH="$S/pw-1194" HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 3000 node tools/kanit.mjs kos "bt5-e2e-$NAME-$SHORT" -- node --disable-warning=ExperimentalWarning "test/e2e/$NAME.mjs" > "$S/bt5-kanit/e2e-$NAME-$SHORT.out" 2>&1
  echo "$NAME ($ZONE): çıkış $? · $(grep -E 'geçti, [0-9]+ kaldı|\[kanit\]' "$S/bt5-kanit/e2e-$NAME-$SHORT.out" | tail -2 | tr '\n' ' ' | cut -c1-260)"
done
