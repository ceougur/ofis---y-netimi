#!/bin/bash
# İş 7 DÜŞÜK-3 / DÜŞÜK-4 koşuları (yük kilidi paylaşımlı; çağıran -n ile alır). Mutant Y21 kendi worktree'mde açılır, koşudan hemen sonra geri yazılır.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a294d4187e1bf9872
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-k7
cd "$W" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
echo "baslangic yuk $(cat /proc/loadavg)"
TZ=UTC timeout -k 5 900 node tools/kanit.mjs kos c5a2-is7-kaynak-iz-utc -- node --test test/defter-kaynak-iz-250.test.mjs | tail -1
TZ=Europe/Istanbul timeout -k 5 900 node tools/kanit.mjs kos c5a2-is7-kaynak-iz-ist -- node --test test/defter-kaynak-iz-250.test.mjs | tail -1
F=test/defter-kaynak-iz-250.test.mjs
cp "$F" "$N/kaynak-iz.yedek"
python3 -I - "$F" <<'EOF' || exit 1
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a='  ["payments.note", "açıklama (§16.2)"],'
assert s.count(a)==1
open(p,'w',encoding='utf-8').write(s.replace(a, a+'\n  ["invoices.gl_json", "mutant"],'))
EOF
TZ=Europe/Istanbul timeout -k 5 900 node tools/kanit.mjs kos c5a2-is7-mutant-Y21 -- node --test test/defter-kaynak-iz-250.test.mjs | tail -1
cp "$N/kaynak-iz.yedek" "$F"
grep -c "invoices.gl_json\", \"mutant" "$F"
TZ=Europe/Istanbul timeout -k 5 3000 node tools/kanit.mjs kos c5a2-is7-kilit-izi-alanlar-ist -- node --test test/kilit-izi-alanlar-250.test.mjs | tail -1
echo "bitis yuk $(cat /proc/loadavg)"
