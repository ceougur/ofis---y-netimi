NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
cd $NB/taban || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$NB/kanit
for tz in UTC Europe/Istanbul; do
  t=${tz//\//_}
  TZ=$tz node tools/kanit.mjs kos c5a2e-taban-kahin-defter-$t -- npm run test:kahin-defter > $NB/taban-kahin-defter-$t.out 2>&1; echo "defter $tz çıkış $?"
done
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $NB/yapim-taban.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$NB/yapim-taban.json node tools/kanit.mjs kos c5a2e-taban-kahin-cari-UTC -- npm run test:kahin-cari > $NB/taban-kahin-cari-UTC.out 2>&1; echo "cari UTC çıkış $?"
