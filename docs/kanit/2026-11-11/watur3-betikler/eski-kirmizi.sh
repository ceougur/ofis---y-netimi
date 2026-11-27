# Eski kod (1f136bb6 kopyası) üzerinde tur 3'ün yeni hücreleri — beklenen kırmızılar ve nedenleri (ders 7 / 38). İki TZ.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs
export KANIT_DIR=$S/watur3-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $S/watur3-eski || exit 1
cat /proc/loadavg
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  TZ=$tz node $K kos watur3-eski-tur3-$t -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 --test-reporter=spec test/whatsapp-tur3-250.test.mjs
  TZ=$tz node $K kos watur3-eski-t16b-$t -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^T16[bc] ' test/whatsapp-t-durum-karar-tablosu-248-yeni.test.mjs
done
cat /proc/loadavg
echo BITTI
