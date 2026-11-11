# Madde 7: kırılgan kalıbı düzeltilen testler — yük koşusu (komşu yığını) YANINDA ve tek başına; iki TZ. <kök> <etiket>
ROOT=$1
ETIKET=$2
cd "$ROOT" || exit 1
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs
export KANIT_DIR=$S/watur3-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  cat /proc/loadavg
  TZ=$tz node $K kos watur3-kirilgan-$ETIKET-$t -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/whatsapp-s1-satir-denemeyi-bilmiyor-248.test.mjs test/whatsapp-t-durum-karar-tablosu-248.test.mjs test/whatsapp-tur2-kvkk-250.test.mjs test/whatsapp-w3-saklama-250.test.mjs test/whatsapp-w-kok-ttl-249.test.mjs test/whatsapp-w1-baglanti.test.mjs
done
cat /proc/loadavg
echo BITTI
