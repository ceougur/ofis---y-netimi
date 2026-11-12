#!/bin/bash
# Saf motor işlemci süresi: önce / bugün / benim (+ varsa deneme kopyası). Yük kilidiyle; süre sınırlı. Kullanım: hiz-uc.sh [ek ad=kök ...]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
Y=$S/c5bkd-yakala
rm -rf "$S/c5bkd-yakala" "$S/c5bkd-veri-kopya-uc"
mkdir -p "$Y" && (cd "$W" && git archive HEAD server test/helpers.mjs package.json | tar -x -C "$Y") || exit 1
cp -a "$W/server/." "$Y/server/" || exit 1   # commit'lenmemiş değişiklikler de
ln -s /home/user/ofis---y-netimi/node_modules "$Y/node_modules"
python3 -I - "$Y/server/lib/obligation-queue.mjs" <<'EOF' || exit 1
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
a = "export function buildObligations(input) {\n"
assert s.count(a) == 1
open(p, "w", encoding="utf-8").write(s.replace(a, a + "  globalThis.__yakala?.push(input);\n"))
EOF
cp -a $S/c5bkd-veri-prof "$S/c5bkd-veri-kopya-uc" || exit 1
HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -s -n $S/olcum.lock timeout 900 node --disable-warning=ExperimentalWarning $S/c5bkd-betik/hiz-uc.mjs "$Y" "$S/c5bkd-veri-kopya-uc" once=$S/c5bkd-once bugun=$S/c5bkd-taban benim=$W "$@"
echo "çıkış $?"
rm -rf "$S/c5bkd-veri-kopya-uc" "$S/c5bkd-yakala"
