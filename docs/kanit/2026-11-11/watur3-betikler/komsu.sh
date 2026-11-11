# G2 komşuları (test/ taraması, ders 10): bütün test/whatsapp-*.test.mjs + lisans / salt okunur kapısı testleri; iki TZ. Kod: <kök> (sınanan commit'in kopyası).
ROOT=$1
cd "$ROOT" || exit 1
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs
export KANIT_DIR=$S/watur3-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
ls test/whatsapp-*.test.mjs test/license.test.mjs test/kapi-lisans-hosgoru-248.test.mjs > $S/watur3-cikti/komsu-liste.txt
wc -l < $S/watur3-cikti/komsu-liste.txt
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  cat /proc/loadavg
  TZ=$tz node $K kos watur3-komsu-$t -- node --disable-warning=ExperimentalWarning --test --test-concurrency=2 $(cat $S/watur3-cikti/komsu-liste.txt)
done
cat /proc/loadavg
echo BITTI
